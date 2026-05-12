# Phase 1 実装計画 — 認証 + 最低限の閲覧/入力

**目的:** ログインして登録・進捗入力できる状態にする  
**仕様書:** `docs/spec.md` v3.0 §7.3  
**前提:** Phase 0 完了(Prisma スキーマ全モデル、Auth.js v5 二重構成、A1 ログイン画面、ミドルウェア、CI)  
**ブランチ戦略:** feature ブランチ → `develop` へ PR(PR は GitHub Web UI で作成)  
**gh CLI:** 未インストール。各 Step 完了後に `git push origin <branch>` し、https://github.com/HiroshiKazui-Arent/foresight/compare で PR 作成。  
**コマンド注意:** Windows/PowerShell 環境。チェーンは `&&` でなく `;` を使う。

---

## 不変ルール(全ステップ共通)

1. **`prisma/schema.prisma` は Phase 1 で変更しない。** 必要なテーブルは全モデル(User, Account, Session, Invitation, Project, ProjectMember, Milestone, Task, Todo, DailyReport)が揃っている。スキーマ変更が必要と思ったら STOP して確認。
2. **`src/middleware.ts` と `src/lib/auth.config.ts` に Prisma 呼び出しを追加しない。** この2ファイルは Edge runtime で動く。Prisma/bcrypt は Node.js API 依存のため Edge で動かない(CLAUDE.md 参照)。
3. **各 mutating Server Action は必ず `revalidatePath` を呼ぶ。** `revalidatePath('/projects')` および対象プロジェクト `revalidatePath(\`/projects/\${id}\`)` を return 前に実行。
4. **Server Action のバレル `src/server/actions/index.ts` は作らない。** 各コンポーネントから action ファイルを直接 import する(バレルは Tree-shaking の妨げ + 並列実装での競合を防ぐ)。
5. **PowerShell コマンドでの `&&` 連結不可。** `;` または別コマンドに分割。

---

## ステップ一覧と依存関係

```
Step 1 ─┐
Step 2 ─┼─→ Step 4 ─→ Step 5 ─→ Step 7 ─→ Step 8
Step 3 ─┤
        └─→ Step 6        ↑
              (Step 6 は Step 4 と並列可)
```

| #   | タイトル                                            | 依存       | 並列可能な相手 |
| --- | --------------------------------------------------- | ---------- | -------------- |
| 1   | TypeScript 型拡張 + 招待アクション                  | なし       | Step 2, 3      |
| 2   | Project/Milestone/Task/ToDo CRUD + ビジネスロジック | なし       | Step 1, 3      |
| 3   | 共通 UI コンポーネント (進捗バー・ピル・ガント)     | なし       | Step 1, 2      |
| 4   | A2 招待受諾画面 + A3 プロジェクト一覧               | 1, 2, 3    | Step 6         |
| 5   | V1 ツリービュー                                     | 2, 3, 4    | Step 6         |
| 6   | A4 プロジェクト設定 + A5 ユーザー管理               | 1, 2, 3    | Step 4         |
| 7   | I1 日報入力                                         | 2, 3, 5    | なし           |
| 8   | 整合性確認・バグ修正                                | 4, 5, 6, 7 | なし           |

---

## Step 1: TypeScript 型拡張 + 招待アクション

### コンテキスト

Phase 0 で Prisma スキーマに `Invitation` モデルが追加済み。Auth.js v5 の Credentials Provider と `bcrypt` も設定済み (`src/lib/auth.ts`)。  
招待フロー (`docs/spec.md` §6.6):

1. 招待発行 → `Invitation` レコード生成(token, expiresAt=7日後)
2. 招待リンク `/invite/{token}` を手動伝達
3. A2 画面でパスワード設定 → User 作成 → ProjectMember 追加 → Invitation ACCEPTED 更新 → **クライアントサイドで** `signIn('credentials', ...)` → 自動サインイン

**Auth.js v5 注意:** `acceptInvitation` は Server Action として `{ success: true, email }` を返すのみ。`signIn` の呼び出しは Client Component 側で行う。Server Action から NextAuth のセッション Cookie を直接発行しない(database session strategy の制約)。

### 作業タスク

1. **TypeScript 型拡張** `src/types/next-auth.d.ts` を新規作成:

   ```ts
   import 'next-auth'

   declare module 'next-auth' {
     interface Session {
       user: {
         id: string
         email: string
         name: string
       }
     }
   }
   ```

2. **Project メンバー認可ヘルパー** `src/lib/authz.ts`:

   ```ts
   // 注意: middleware.ts (Edge) ではなく Server Component / Server Action から呼ぶ
   import { auth } from '@/lib/auth'
   import { prisma } from '@/lib/prisma'
   import { notFound } from 'next/navigation'

   export async function requireProjectMember(projectId: string) {
     const session = await auth()
     if (!session?.user?.id) throw new Error('Unauthorized')
     const member = await prisma.projectMember.findUnique({
       where: { projectId_userId: { projectId, userId: session.user.id } },
     })
     if (!member) notFound()
     return session.user.id
   }
   ```

3. **招待アクション** `src/server/actions/invitation.ts`:

   ```ts
   'use server'
   ```

   以下の関数を実装:
   - `createInvitation(email: string, projectId?: string): Promise<{ token: string }>`:
     - トークン: `crypto.randomBytes(32).toString('base64url')` (Node built-in `crypto` を使用。`Math.random` 不可)
     - `expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)`
     - 既存 PENDING 招待(同メール・同プロジェクト)があれば先に REVOKED にする
   - `getInvitation(token: string): Promise<Invitation & { project: Project | null } | null>`:
     - `status === 'PENDING' && expiresAt > new Date()` の場合のみ返す。それ以外は `null`
   - `acceptInvitation(token: string, name: string, password: string): Promise<{ success: true; email: string } | { error: string }>`:
     - トークン検証(無効/期限切れ/REVOKED は `{ error }` 返却)
     - 同メールの User が既に存在する場合: User を作成せず ProjectMember だけ追加(パスワード変更しない)し Invitation ACCEPTED → `{ success: true, email }` を返す
     - User が存在しない場合: `bcrypt.hash(password, 12)` → User 作成 → ProjectMember 追加(projectId が null なら ProjectMember は作らない) → Invitation ACCEPTED → `{ success: true, email }` を返す
     - 全操作を単一トランザクション内で実行
     - 完了後 `revalidatePath('/projects')` を呼ぶ
   - `revokeInvitation(invitationId: string): Promise<void>`:
     - `status` を REVOKED に更新 → `revalidatePath('/admin/users')`

4. **テスト** `src/lib/__tests__/invitation.test.ts`:
   - `acceptInvitation` 正常系(新規ユーザー)
   - `acceptInvitation` 正常系(既存ユーザー)
   - `acceptInvitation` 異常系(期限切れトークン)
   - `acceptInvitation` 異常系(REVOKED トークン)
   - `getInvitation` が期限切れ時に null を返す

### 検証コマンド

```powershell
npm run typecheck
npm test
npm run lint
```

### 完了基準

- `acceptInvitation` が期限切れトークンで `{ error }` を返す
- `acceptInvitation` が既存ユーザーのパスワードを上書きしない
- TypeScript エラーなし、lint エラーなし、テスト全件パス

### ブランチ / PR

`feature/phase1-step1-invitation-actions` → `develop`

---

## Step 2: Project/Milestone/Task/ToDo CRUD + ビジネスロジック

### コンテキスト

Phase 0 で全 Prisma モデルが `schema.prisma` に定義・マイグレーション済み。  
**既存ファイル注意:** `src/lib/__tests__/progress.test.ts` が存在するが、`redistributeWeights` と `calcScheduledPct` をテストファイル内でローカル再定義している。このステップで実際の実装を作成し、テストファイルを import ベースに書き換える。

進捗計算ロジック(`docs/spec.md` §4):

- 予定進捗 = 経過日数比例 §4.1
- Task 重み付き集計(ToDo重み均等割り §6.7、Task/Milestone重みは期間日数) §4.2
- 5段階ステータス(乖離 -20% 以下で警告) §4.4

### 作業タスク

1. **重み均等割り** `src/lib/weight.ts`:
   - `redistributeWeights(n: number): number[]` — 合計が必ず100になる整数配列を返す。最後の要素に端数を寄せる。
   - `n=0` は `[]` を返す。`n=1` は `[100]`。`n=3` は `[33, 33, 34]`。
   - この関数はDBに触れない純関数。

2. **進捗計算** `src/lib/progress.ts`(純関数群):
   - `calcScheduledPct(startDate: Date, endDate: Date, today: Date): number` — 0〜100 にクランプ
   - `calcDaysDeviation(actualPct: number, scheduledPct: number, durationDays: number): number` — 遅れは負値
   - `calcStatus(actualPct: number, scheduledPct: number): ProgressStatus` — 以下の5段階:
     - `'completed'`: actualPct === 100
     - `'on-track'`: 進行中 && actualPct >= scheduledPct
     - `'delayed'`: 進行中 && gap > -20 && gap < 0 (gap = actualPct - scheduledPct)
     - `'warning'`: 進行中 && gap <= -20
     - `'scheduled'`: actualPct === 0 && scheduledPct === 0(未着手かつ予定通り)
   - `calcTaskActualPct(todos: { actualPct: number; weight: number }[]): number`
   - `calcMilestoneActualPct(tasks: { actualPct: number; startDate: Date; endDate: Date }[]): number` — Taskの重みは期間日数
   - `calcProjectActualPct(milestones: { actualPct: number; startDate: Date; endDate: Date }[]): number`

3. **型定義** `src/types/progress.ts`:

   ```ts
   export type ProgressStatus = 'completed' | 'on-track' | 'delayed' | 'warning' | 'scheduled'

   export type ProgressBarData = {
     actualPct: number
     scheduledPct: number
     status: ProgressStatus
     daysDeviation: number // 負=遅れ
   }
   ```

   このファイルは Step 3(UI コンポーネント)と Step 5(ツリービュー)が import する。

4. **サーバーアクション群**(`src/server/actions/`):
   - `project.ts`:
     - `getUserProjects()`: `prisma.project.findMany({ where: { members: { some: { userId: session.user.id } } }, orderBy: { createdAt: 'desc' } })` — 全件取得は禁止
     - `getProject(id)`: ProjectMember 確認後に返す
     - `createProject(name, startDate, endDate)`: Project 作成 + 作成者を ProjectMember に追加 → `revalidatePath('/projects')`
     - `updateProject(id, data)`: `requireProjectMember(id)` 確認後に更新 → `revalidatePath`
     - `deleteProject(id)`: `requireProjectMember(id)` 確認後に削除(CASCADE で Milestone/Task/ToDo も削除) → `revalidatePath('/projects')`
   - `milestone.ts`: `createMilestone`, `updateMilestone`, `deleteMilestone`, `reorderMilestones`
   - `task.ts`: `createTask`, `updateTask`, `deleteTask`, `reorderTasks`
   - `todo.ts`: `createTodo`, `updateTodo`, `deleteTodo` — 操作後に同一 Task 配下の全 ToDo を取得し `redistributeWeights(n)` で weight を再計算してトランザクション内一括更新
   - `user.ts`: `getAllUsers()`, `getAllInvitations()`

5. **並び替えアルゴリズム(全 reorder アクション共通):**
   - 並び替え後は `order` を `0, 1, 2, ...` の連続整数で全 sibling を一括更新する(トランザクション内)
   - 分数インデックス不使用

6. **既存テストファイルの修正** `src/lib/__tests__/progress.test.ts`:
   - ファイル先頭のローカル定義(`redistributeWeights`, `calcScheduledPct`)を削除
   - `import { redistributeWeights } from '@/lib/weight'` に置き換え
   - `import { calcScheduledPct, calcStatus } from '@/lib/progress'` に置き換え

7. **新規テスト** `src/lib/__tests__/weight.test.ts`:
   - n=0, n=1, n=2, n=3, n=7 で合計が100になることを確認
   - n=3 で `[33, 33, 34]` を確認

### 検証コマンド

```powershell
npm run typecheck
npm test
npm run lint
```

### 完了基準

- `redistributeWeights(0)` = `[]`
- `redistributeWeights(3)` の合計 = 100
- `calcStatus` が spec §4.4 の5条件すべてで正しいステータスを返す
- TypeScript エラーなし

### ブランチ / PR

`feature/phase1-step2-crud-business-logic` → `develop`

---

## Step 3: 共通 UI コンポーネント — 進捗バー・ピル・ガント SVG

### コンテキスト

**package.json の確認:** `tailwindcss: ^4`(Tailwind v4)。shadcn/ui の標準 init は Tailwind v3 前提のため、Tailwind v4 向けの手順が必要。

共通ビジュアル言語(`docs/spec.md` §5.2):

- 進捗ピル: `44% / 83%`
- 状態ピル: `完了`/`進行中`/`遅延`/`警告`/`予定`(5段階)
- 日数ピル: `-9日`/`+1日`
- ガントバー(SVG): 今日線は「実績の右端境界 + 予定%位置 + 現在日付マーカー」の3役を兼ねる(spec §2.2)

**今日線の実装方針:** 今日線は別の `<line>` 要素として描画するのではなく、actualPct 分だけ塗られた `<rect>` の右端が今日線を兼ねる。つまり `x=0 width=actualPct% height=100%` の塗り `<rect>` + `x=scheduledPct% height=100%` の細線「予定位置マーカー」のみ。spec §2.2「無闇に分割しないこと」を守る。

### 作業タスク

1. **shadcn/ui セットアップ**:

   ```powershell
   npx shadcn@canary init --yes
   ```

   Tailwind v4 で `shadcn@canary` が失敗する場合、以下の最小プリミティブを `src/components/ui/` に手書きする:
   - `button.tsx` — `type ButtonProps` + variants: `primary` / `secondary` / `destructive` / `ghost`
   - `input.tsx` — ラベル付きテキスト入力
   - `dialog.tsx` — shadcn/ui 準拠の Modal (Radix UI `@radix-ui/react-dialog` を使用)
   - `badge.tsx` — 小さい色付きタグ

   `npm install @radix-ui/react-dialog @radix-ui/react-slot` を実行。

2. **進捗・状態コンポーネント** (`src/components/`):
   - `progress-pill.tsx`:
     - props: `{ actualPct: number; scheduledPct: number }`
     - 表示: `44% / 83%`
   - `status-pill.tsx`:
     - props: `{ status: ProgressStatus }` (import from `@/types/progress`)
     - 色マッピング: `completed`=緑(濃), `on-track`=緑(淡), `delayed`=黄, `warning`=赤, `scheduled`=グレー
     - 日本語ラベル: `完了`/`進行中`/`遅延`/`警告`/`予定`
   - `days-pill.tsx`:
     - props: `{ days: number }` (負=遅れ)
     - 表示: `-9日` / `+1日`

3. **ガント SVG コンポーネント** (`src/components/gantt/`):
   - `gantt-bar.tsx`:
     - props: `{ actualPct: number; scheduledPct: number; status: ProgressStatus }`
     - SVG `<rect>` x=0 width=`${actualPct}%` を実績バーとして塗る。右端が今日線を兼ねる
     - SVG `<line>` x1=x2=`${scheduledPct}%` を薄い予定位置マーカーとして描く(別の役)
     - status に応じた塗り色を使用
   - `today-line.tsx`: `gantt-bar.tsx` 内から参照する共有定数/ユーティリティ(スタンドアロンのコンポーネントとしては不要)

4. **開発確認ページ** `src/app/(app)/_preview/page.tsx`(先頭アンダースコアはプライベートフォルダ、URL ルートに現れない):
   - 各コンポーネントのサンプル表示(本番影響なし)

   > Note: `_preview` のような Private Folder は Next.js App Router のルーティングに含まれない。

### 検証コマンド

```powershell
npm run typecheck
npm run lint
npm run build
```

### 完了基準

- `status-pill.tsx` が5種類すべてのステータスで異なる色を表示
- `gantt-bar.tsx` が `actualPct=0` で空バー、`actualPct=50` で半塗りを表示
- TypeScript エラーなし、ビルド通過

### ブランチ / PR

`feature/phase1-step3-ui-components` → `develop`

---

## Step 4: A2 招待受諾画面 + A3 プロジェクト一覧

### コンテキスト

**依存:** Step 1, 2, 3 が `develop` にマージ済みであること。このブランチは `develop` から切る。

**重要: ルート構成の統一**  
全認証済みルートは `src/app/(app)/` に置く。`src/app/projects/` は作らない。  
Next.js App Router はルートグループ `(app)` と裸のセグメントが同一 URL を解決しようとするとビルドエラーになる。

**既存ファイルの変更:**

- `src/app/page.tsx` の内容を完全に置き換える:
  ```tsx
  import { redirect } from 'next/navigation'
  export default function RootPage() {
    redirect('/projects')
  }
  ```
  ミドルウェアが未認証ユーザーを `/login` に飛ばすため、この redirect は認証済みユーザー専用となる。

### 作業タスク

1. **認証済み共通レイアウト** `src/app/(app)/layout.tsx`:
   - `auth()` でセッション確認 → null なら `redirect('/login')`
   - ヘッダー: アプリ名 `フォーサイトマネジメント`、ユーザー名表示、サインアウトボタン(`signOut()` 呼び出し)
   - `children` を下に展開

2. **A2 招待受諾** `src/app/invite/[token]/page.tsx`(認証不要なので `(app)` 外):
   - Server Component: `getInvitation(token)` 呼び出し
   - `null` 返却(無効/期限切れ): エラーメッセージ表示
   - 有効: パスワード設定フォーム(Client Component `<AcceptInviteForm>`)を表示
   - フォーム送信時の Client 側フロー:
     1. Server Action `acceptInvitation(token, name, password)` を呼ぶ
     2. `{ success: true, email }` なら `signIn('credentials', { email, password, redirect: false })` を呼ぶ
     3. `result.ok` なら `router.push('/projects')`
     4. `{ error }` なら エラーメッセージ表示

3. **A3 プロジェクト一覧** `src/app/(app)/projects/page.tsx`:
   - Server Component: `getUserProjects()` でログインユーザーの参加プロジェクトのみ取得
   - 取得時に進捗計算(`calcProjectActualPct`, `calcScheduledPct`, `calcStatus`, `calcDaysDeviation`)を実行し `ProgressBarData` に変換してからコンポーネントへ渡す
   - カード形式: プロジェクト名、`<ProgressPill>`, `<StatusPill>`, `<DaysPill>`, `<GanttBar>`
   - 「+ 新規プロジェクト」ボタン → `<Dialog>` モーダル(名前・開始日・終了日) → `createProject` → `revalidatePath`
   - カードクリックで `/projects/[id]` へ

4. **`src/app/page.tsx` 更新**: 上記の単純 redirect に置き換え

### 検証コマンド

```powershell
npm run typecheck
npm run lint
npm run build
# 動作確認:
docker compose up -d
# http://localhost:3000 → /projects (login required) → /login → A1
# admin@example.com / password123 でログイン → /projects
```

### 完了基準

- `/login` でサインイン後 `/projects` に遷移
- `/projects` にプロジェクトカードが表示される(seed データ使用)
- `/invite/{有効トークン}` でパスワード設定フォームが表示
- `/invite/{無効トークン}` でエラーメッセージが表示
- `/invite/{token}` からパスワード設定後に `/projects` に遷移
- TypeScript エラーなし

### ブランチ / PR

`feature/phase1-step4-screens-a2-a3` → `develop`

---

## Step 5: V1 ツリービュー

### コンテキスト

**依存:** Step 2 (CRUD アクション), Step 3 (UI コンポーネント), Step 4 (A3 → プロジェクト選択) が `develop` にマージ済みであること。

V1 はプロジェクト全体の主ビューかつ登録・編集の主戦場(`docs/spec.md` §5.3):

- Project → Milestone → Task の3階層インデント表示
- 各行に `<ProgressPill>`, `<StatusPill>`, `<DaysPill>`, `<GanttBar>`
- `+` ボタンで追加 → インライン入力フォーム展開
- 行クリックでインライン編集(blur/Enter で Server Action)
- ドラッグ&ドロップで並び替え (dnd-kit)

### 作業タスク

1. **dnd-kit インストール**:

   ```powershell
   npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
   ```

   インストール後: `docker compose build app` でコンテナ再ビルド確認(CI は `npm ci` で自動対応)。

2. **ページ** `src/app/(app)/projects/[id]/page.tsx`:
   - Server Component: `getProject(id)` でプロジェクト全データ(Milestone + Task + ToDo 含む)取得
   - `requireProjectMember(id)` でメンバー確認(非メンバーは notFound())
   - サーバー側で全進捗計算を実行 → `ProgressBarData` に変換
   - `<TreeView>` Client Component に渡す
   - ヘッダーに「日報入力」(`/projects/[id]/daily`)、「設定」(`/projects/[id]/settings`)へのリンク

3. **ツリービューコンポーネント** (`src/components/tree-view/`):
   - `tree-view.tsx` — Client Component、`DndContext` + `SortableContext` を設定
   - `milestone-row.tsx` — Milestone 行(折りたたみ可)、配下 Task の `<SortableContext>` ラップ
   - `task-row.tsx` — Task 行
   - `inline-edit.tsx` — クリックで `<input>` 表示、blur/Enter で対応する Server Action を呼ぶ
   - `add-row-button.tsx` — `+` ボタン → name 入力展開 → `createMilestone`/`createTask`/`createTodo`

4. **ドラッグ&ドロップ並び替え:**
   - `onDragEnd` で `reorderMilestones` / `reorderTasks` を呼ぶ
   - 並び替えアルゴリズム: Step 2 の仕様通り、`order` を `0, 1, 2, ...` の連続整数で全 sibling を一括更新

5. **進捗の自動計算表示:** サーバー側で `calcMilestoneActualPct`, `calcTaskActualPct` 等を呼んで計算済みデータをコンポーネントに渡す

### 検証コマンド

```powershell
npm run typecheck
npm run lint
npm run build
# ブラウザで確認:
# - Milestone/Task の追加
# - インライン編集
# - ドラッグ&ドロップ並び替えがリロード後も維持される
# - 進捗ピル・状態ピルの表示
```

### 完了基準

- Project → Milestone → Task の3階層がインデント表示
- `+` ボタンで各レベルに新規追加できる
- インライン編集が動作する
- ドラッグ&ドロップ並び替えがリロード後も維持
- TypeScript エラーなし、ビルド通過

### ブランチ / PR

`feature/phase1-step5-tree-view-v1` → `develop`

---

## Step 6: A4 プロジェクト設定 + A5 ユーザー管理

### コンテキスト

**依存:** Step 1, 2, 3 が `develop` にマージ済みであること。  
**Step 4 と並列実行可能。** `develop` から切る。

**重要: ロール区分なし**(`docs/spec.md` §1.2「役割区分: なし」)。A5 は全ログインユーザーが閲覧・操作可能。パス名が `admin/` でもロールチェック不要。

### 作業タスク

1. **A4 プロジェクト設定** `src/app/(app)/projects/[id]/settings/page.tsx`:
   - `requireProjectMember(id)` で認可確認
   - プロジェクト名・開始日・終了日の編集フォーム → `updateProject` 呼び出し
   - メンバー一覧テーブル(名前・メール)
   - 「+ メンバーを招待」ボタン → `<Dialog>` モーダル(メールアドレス入力) → `createInvitation(email, projectId)` → 生成された招待リンク(`/invite/{token}`)をコピーボタン付きで表示
   - プロジェクト削除ボタン(確認ダイアログ付き) → `deleteProject` → `/projects` へリダイレクト

2. **A5 ユーザー管理** `src/app/(app)/users/page.tsx`(ロール不要なので `admin/` でなく `users/`):
   - 全ユーザー一覧テーブル(名前・メール・作成日): `getAllUsers()` 使用
   - 招待中一覧(メール・ステータス・期限・発行者・プロジェクト): `getAllInvitations()` 使用
   - 「+ ユーザーを招待」ボタン → `<Dialog>` モーダル(メールアドレス入力、プロジェクト選択は任意) → `createInvitation` → リンク表示
   - 招待取り消しボタン → `revokeInvitation`

3. ヘッダーナビゲーションに「ユーザー管理」(`/users`) リンクを追加(Step 4 の `(app)/layout.tsx` を更新)

### 検証コマンド

```powershell
npm run typecheck
npm run lint
npm run build
```

### 完了基準

- A4 でプロジェクト名・期間を編集できる
- A4 で招待リンクが生成されコピーできる
- A4 でプロジェクト削除が確認ダイアログ付きで動作
- A5 で全ユーザー・全招待が表示される
- 招待取り消しが動作する
- TypeScript エラーなし

### ブランチ / PR

`feature/phase1-step6-settings-user-management` → `develop`

---

## Step 7: I1 日報入力

### コンテキスト

**依存:** Step 2 (CRUD + ビジネスロジック), Step 3 (UI コンポーネント), Step 5 (V1 ツリービュー) が `develop` にマージ済みであること。

**`DailyReport` と `Todo.actualPct` の関係:**

- `DailyReport` は**監査ログ専用**。進捗の全履歴を保持。
- 進捗集計は常に `Todo.actualPct` を読む(`DailyReport` は集計に使わない)。
- `submitDailyReport` は: DailyReport 行を新規追加(同日でも行を追加)+ `Todo.actualPct`/`Todo.completed` を最新値で上書き。
- 1日に複数入力した場合は全履歴が残り、`Todo.actualPct` は最後の入力値になる。

### 作業タスク

1. **Server Action** `src/server/actions/daily-report.ts`:
   - `submitDailyReport(todoId: string, actualPct: number, completed: boolean, date: Date, comment?: string)`:
     - 単一トランザクション内で:
       1. `DailyReport` 行を INSERT(upsert しない — 同日でも履歴として保持)
       2. `Todo` の `actualPct` と `completed` を UPDATE
     - `revalidatePath` を呼ぶ(対象プロジェクトの ID が必要なので、todo → task → milestone → project を辿るか、Server Action の引数に `projectId` を追加する)
     - `completed=true` の場合は `actualPct` を 100 に強制

2. **I1 ページ** `src/app/(app)/projects/[id]/daily/page.tsx`:
   - V1 と同じデータ取得ロジック
   - `<TreeView mode="input">` として渡す(Step 5 の `TreeView` に `mode?: 'view' | 'input'` prop を追加)
   - `input` モードでは ToDo 行の右端に:
     - 数値入力(0-100): `<ProgressInput>`
     - 完了チェックボックス: `<CompletedCheckbox>` (チェック時に `actualPct=100`)

3. **コンポーネント** (`src/components/daily-report/`):
   - `progress-input.tsx` — 0〜100 の数値入力 + `%` ラベル
   - `completed-checkbox.tsx` — 完了チェックボックス

### 検証コマンド

```powershell
npm run typecheck
npm run lint
npm run build
# ブラウザで確認:
# - /projects/[id]/daily でツリーと入力欄が表示
# - 進捗入力後に Todo.actualPct が更新される
# - 完了チェックで actualPct=100, completed=true になる
```

### 完了基準

- `/projects/[id]/daily` で各 ToDo の進捗入力ができる
- 入力後に `DailyReport` 行が追加され `Todo.actualPct` が更新される
- 完了チェックで `actualPct=100, completed=true`
- 親 Task/Milestone/Project の進捗ピルが更新後に変化する
- TypeScript エラーなし

### ブランチ / PR

`feature/phase1-step7-daily-report-i1` → `develop`

---

## Step 8: 整合性確認・バグ修正

### コンテキスト

**依存:** Step 4, 5, 6, 7 すべてが `develop` にマージ済みであること。

**spec §11 の注意:** spec.md §11「参考: サンプルデータ整合性」は「v1.0/v2.0 と同じため省略」とある。seed.ts で以下のテストデータを構築して代替とする。

### 作業タスク

1. **シードデータ拡張** `prisma/seed.ts`:
   - `admin@example.com` をメンバーとして持つプロジェクト1件を追加:
     - 開始日: 30日前、終了日: 30日後(全60日)
     - Milestone x2: 各30日
     - Milestone 1 配下: Task x2(各15日)、各 Task に ToDo x3(9件合計)
     - ToDo weight は均等割り(33/33/34)になっているか確認
     - Milestone 2 配下: Task x2
   - 一部 ToDo に `DailyReport` と `actualPct` を設定して進捗ありの状態にする

2. **計算整合性チェック**(手動確認チェックリスト):
   - [ ] `npm run db:seed` 後、`/projects` で上記プロジェクトの進捗ピルが 0% より大きい数値になっている
   - [ ] V1 で ToDo を3件追加した Task の weight が `[33, 33, 34]`(Prisma Studio または seed 後のデータで確認)
   - [ ] 予定進捗 = (今日 - 開始日) / 60 × 100 の計算結果がステータスピルに反映されている

3. **E2E フロー確認**(全チェックを完了させること):
   - [ ] 招待フロー: A5 → リンクコピー → シークレットウィンドウで開く → パスワード設定 → `/projects` に自動遷移
   - [ ] プロジェクト作成: A3 「+ 新規プロジェクト」→ V1 に遷移
   - [ ] V1: Milestone → Task → ToDo の追加(インライン編集含む)
   - [ ] V1: ドラッグ&ドロップ → リロード後も順序維持
   - [ ] I1: 進捗入力 → V1 の進捗ピルが更新
   - [ ] A4: プロジェクト名変更・メンバー招待
   - [ ] 非メンバーが `/projects/[id]` にアクセスすると 404 または `/projects` にリダイレクト

4. **CI グリーン確認:**

   ```powershell
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```

5. **発見した全バグを修正**し、バグを検出するテストを追加する

### 完了基準

- CI 全ジョブ(lint, typecheck, test, build) グリーン
- 上記 E2E チェックリスト7項目すべて完了
- ToDo weight の合計が常に100になることを実データで確認
- 進捗計算が期待値と一致する

### ブランチ / PR

`feature/phase1-step8-qa-bugfix` → `develop`

---

## 実装開始手順

```powershell
git checkout develop
git checkout -b feature/phase1-step1-invitation-actions
```

Step 1, 2, 3 は並列実行可能。別エージェントに委任する場合は3つを同時に起動できる。

## 変更・中断プロトコル

- **ステップを分割:** このファイルを更新し、末尾に改訂コメントと日付を追記する
- **ステップをスキップ:** 該当ステップに `[SKIP: 理由]` を付記し、依存関係を更新する
- **仕様変更が必要:** `docs/spec.md` を先に更新し改訂履歴を追記してから本ファイルを更新する

---

_作成日: 2026-05-12 | 仕様書バージョン: v3.0 | 初版レビュー: Opus 4.7 (11 CRITICAL 修正済み, 9 MAJOR 修正済み)_
