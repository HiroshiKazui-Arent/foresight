# Phase 2 実装計画 — タイムライン + タスク詳細 (V2, V3)

**目的:** Milestone ズーム閲覧(V2)と Task 詳細 + ToDo CRUD(V3)を実装する  
**仕様書:** `docs/spec.md` v3.0 §7.4  
**前提:** Phase 1 完了(main ブランチにマージ済み) — 認証・CRUD アクション・進捗計算・共通 UI コンポーネント・V1 ツリービュー・I1 日報入力・A4/A5 管理画面がすべて動作済み  
**ブランチ戦略:** feature ブランチ → `develop` へ PR(PR は GitHub Web UI で作成)  
**gh CLI:** 未インストール。各 Step 完了後に `git push origin <branch>` し、https://github.com/HiroshiKazui-Arent/foresight/compare で PR 作成。  
**コマンド注意:** Windows/PowerShell 環境。チェーンは `&&` でなく `;` を使う。

---

## 不変ルール(全ステップ共通)

1. **`prisma/schema.prisma` は Phase 2 で変更しない。** Phase 1 で全モデルが揃っている。スキーマ変更が必要と思ったら STOP して確認。
2. **`src/middleware.ts` と `src/lib/auth.config.ts` に Prisma 呼び出しを追加しない。** Edge runtime 制約(CLAUDE.md §Auth.js v5 の二重構成 参照)。
3. **各 mutating Server Action は必ず `revalidatePath` を呼ぶ。** Phase 1 の Server Actions はすでに内部で `revalidatePath('/projects/' + projectId)` を呼んでいる。Client Component 側では `router.refresh()` を呼ぶ。`revalidatePath` を Client Component から直接呼ばない(サーバー専用 API)。
4. **PowerShell コマンドでの `&&` 連結不可。** `;` または別コマンドに分割。
5. **進捗計算はサーバー側(Server Component)で実行。** `calcXxx` 関数を呼んで計算済みデータにしてから Client Component に渡す。
6. **GanttBar の offset はラッパーで制御する。** V2/V3 では `<GanttBar>` を `<div style={{ marginLeft: \`\${offsetPct}%\`, width: \`\${widthPct}%\` }}>`で包む。GanttBar 自身は引き続きローカル 0〜100% 座標で`actualPct`/`scheduledPct` を描画する。GanttBar の内部実装は変更しない。
7. **今日線3役の原則を維持する(`docs/spec.md` §2.2)。** 今日線は actualPct バー右端が実績境界を兼ねる既存設計を維持。V2/V3 での「スコープ外判定」は下記ルールに従う。
8. **既存の `<InlineEdit>` クリック動作を壊さない。** V1 の Milestone 名/Task 名は `<InlineEdit>` でクリック編集できる。V2/V3 への遷移はその隣に置く独立したアイコンリンクで行い、名前テキスト自体のクリック挙動を変えない。

---

## ステップ一覧と依存関係

```
Step 1 (V2) ─┐
              ├─→ Step 3 (QA)
Step 2 (V3) ─┘
(Step 1 と Step 2 は並列実行可能 — 異なるファイルを編集する)
```

| #   | タイトル                           | 依存         | 並列可能な相手 |
| --- | ---------------------------------- | ------------ | -------------- |
| 1   | V2 タイムラインビュー              | Phase 1 完了 | Step 2         |
| 2   | V3 タスク詳細 + ToDo CRUD          | Phase 1 完了 | Step 1         |
| 3   | 回帰テスト・バグ修正 + main へ統合 | Step 1, 2    | なし           |

**並列可能な根拠:** Step 1 は `src/types/timeline.ts`(新規)、`src/components/timeline-view/`(新規)、`milestone-row.tsx`(リンク追加のみ)に触れる。Step 2 は `src/types/task-detail.ts`(新規)、`src/components/task-detail/`(新規)、`task-row.tsx`(リンク追加のみ)に触れる。`src/types/progress.ts` は両ステップとも変更しない。

---

## 既存の再利用可能リソース(Phase 1 実装済み)

- **進捗計算:** `src/lib/progress.ts` — `calcScheduledPct`, `calcStatus`, `calcDaysDeviation`, `calcTaskActualPct`, `calcMilestoneActualPct`
- **進捗 Builder:** `src/components/tree-view/progress-utils.ts` — `buildTaskProgressData`, `buildMilestoneProgressData`、型 `TaskProgressData`, `MilestoneProgressData`
- **UI コンポーネント:** `<ProgressPill>`, `<StatusPill>`, `<DaysPill>`, `<GanttBar>`
- **Server Actions:**
  - `getProject(id)`: Project + Milestone[] + Task[] + Todo[] を全階層で返す(`src/server/actions/project.ts`)
  - `createTask(milestoneId, projectId, name, startDate, endDate)`: Task 作成
  - `updateTask(id, projectId, data: { name?, startDate?, endDate?, assigneeId? })`: Task 更新
  - `createTodo(taskId, projectId, name, startDate, endDate)`: ToDo 作成 + weight 自動均等割り
  - `updateTodo(id, projectId, data: { name?, startDate?, endDate? })`: ToDo 更新
  - `deleteTodo(id, projectId)`: ToDo 削除 + weight 自動再計算
- **認可:** `requireProjectMember(projectId)` (`src/lib/authz.ts`)
- **既存型:** `ProgressBarData`, `ProgressStatus` (`src/types/progress.ts`)

> **`getProject(id)` は全データを取得する**。Phase 2 のスケール(2名・プロジェクト数件)では許容範囲。Project 規模が増えた時点で Phase 5 で専用クエリ(`getMilestone`, `getTask`)を追加検討する。今は `getProject` を再利用してよい。

---

## 座標計算の共通ルール

V2 と V3 では「スコープ期間」に対してバーの位置(offsetPct)と幅(widthPct)を計算する。

```ts
// scope = Milestone (V2の場合) または Task (V3の場合)
const scopeRangeMs = scope.endDate.getTime() - scope.startDate.getTime()

// ゼロ除算ガード: スコープが 0ms の場合はデgenerate表示
if (scopeRangeMs <= 0) {
  offsetPct = 0
  widthPct = 100 // バー全幅で表示
} else {
  const rawOffset = ((item.startDate.getTime() - scope.startDate.getTime()) / scopeRangeMs) * 100
  const rawWidth = ((item.endDate.getTime() - item.startDate.getTime()) / scopeRangeMs) * 100
  // スコープ範囲外クリップ
  offsetPct = Math.max(0, rawOffset)
  widthPct = Math.max(1, Math.min(100 - offsetPct, rawWidth))
}
```

`GanttBar` の `actualPct` / `scheduledPct` はこれとは別の概念: アイテム自身の期間内の進捗% (ローカル座標 0〜100)。`buildTaskProgressData(task, today)` や `calcScheduledPct(todo.startDate, todo.endDate, today)` で計算したものをそのまま渡す。

**今日線のスコープ外判定:**

```ts
const todayOffsetPct =
  scopeRangeMs > 0 ? ((today.getTime() - scope.startDate.getTime()) / scopeRangeMs) * 100 : -1
const showTodayLine = todayOffsetPct >= 0 && todayOffsetPct <= 100
```

`todayOffsetPct < 0` (今日 < スコープ開始) または `> 100` (今日 > スコープ終了) のとき今日線を非表示にする。このとき `calcScheduledPct` は 0 or 100 を返すため `scheduledPct` の表示は正確に保たれる(今日線3役の「予定%位置」役は GanttBar 内で依然として機能している)。

---

## Step 1: V2 タイムラインビュー

### コンテキスト

Phase 1 完了済みで以下が利用可能(詳細は「既存の再利用可能リソース」参照)。

**V2 の仕様** (`docs/spec.md` §5.3):

> V1 と同レイアウト、表示範囲を Milestone 単位にズーム

- V1 は Project 全体(全 Milestone の union 期間)でガントバーを描画
- V2 は選択した **1 Milestone の期間を全幅** として、その配下の Task と ToDo をガントバーで表示
- ガントバーの時間軸が Milestone 期間にズームされること以外は V1 と同じビジュアル言語

### 作業タスク

1. **型定義** `src/types/timeline.ts`(新規作成):

   ```ts
   import type { TaskProgressData } from '@/components/tree-view/progress-utils'
   import type { ProgressBarData } from '@/types/progress'

   export type TimelineTodo = {
     id: string
     name: string
     startDate: Date
     endDate: Date
     actualPct: number
     completed: boolean
     progressData: ProgressBarData
   }

   export type TimelineTask = TaskProgressData & {
     id: string
     name: string
     todos: TimelineTodo[]
   }

   export type TimelineMilestone = {
     id: string
     name: string
     startDate: Date
     endDate: Date
     progressData: ProgressBarData
   }
   ```

2. **V1 からの遷移リンク追加** `src/components/tree-view/milestone-row.tsx`:
   - Milestone 名の `<InlineEdit>` の隣(右)に `<Link>` コンポーネントを追加する
   - **重要:** `<InlineEdit>` 自体は変更しない。名前クリックでの編集挙動を保持する
   - `mode !== 'input'` のときのみリンクを表示(日報入力モードからは遷移しない)

   ```tsx
   // milestone-row.tsx の InlineEdit 直後に追加
   import Link from 'next/link'
   // ...
   {
     mode !== 'input' && (
       <Link
         href={`/projects/${projectId}/milestones/${milestone.id}`}
         className="shrink-0 rounded p-1 text-xs text-gray-400 hover:text-blue-500"
         aria-label="タイムラインビューで開く"
         title="タイムラインビュー"
       >
         →
       </Link>
     )
   }
   ```

3. **ページ** `src/app/(app)/projects/[id]/milestones/[milestoneId]/page.tsx`:
   - Server Component
   - `requireProjectMember(id)` で認可確認
   - `getProject(id)` でプロジェクト全データ取得
   - `milestoneId` に一致する Milestone が存在しない場合は `notFound()`
   - 各 Task の進捗を `buildTaskProgressData(task, today)` で計算
   - Milestone 自体の進捗を `buildMilestoneProgressData(milestone, today)` で計算
   - 各 Task 配下の ToDo の進捗を `calcScheduledPct`, `calcStatus`, `calcDaysDeviation` で計算
   - 計算済みデータを `TimelineTask[]` + `TimelineMilestone` 形式に変換して `<TimelineView>` に渡す
   - `today = new Date()` をサーバー側で1回生成してコンポーネントに渡す(Client Component が `new Date()` を呼ばないようにする)
   - ページヘッダー: パンくずリスト `プロジェクト名 > マイルストーン名` — V1 (`/projects/[id]`) への戻るリンク付き

4. **TimelineView コンポーネント** `src/components/timeline-view/timeline-view.tsx`:
   - Client Component
   - props:
     ```ts
     type Props = {
       milestone: TimelineMilestone
       tasks: TimelineTask[]
       projectId: string
       today: Date
     }
     ```
   - **Milestone サマリ行**: 全幅 `<GanttBar>` + `<ProgressPill>` + `<StatusPill>` + `<DaysPill>`
   - **今日線**: 「共通ルール」の `todayOffsetPct` 計算式で位置を求め、`showTodayLine === true` のときに `position: absolute` の縦線を描画。ガントバー行の外側(コンテナ全体)に重ねる
   - **Task 行(各 Task)**:
     - 「共通ルール」の座標計算で `offsetPct` / `widthPct` を求め、ラッパー `<div style={{ marginLeft: \`\${offsetPct}%\`, width: \`\${widthPct}%\` }}>` を適用
     - ラッパー内で `<GanttBar actualPct scheduledPct status>`
     - `<ProgressPill>`, `<StatusPill>`, `<DaysPill>`
     - Task 名の隣に V3 リンク `<Link href={\`/projects/\${projectId}/tasks/\${task.id}\`}>→</Link>`
     - 展開/折りたたみボタン → 配下 ToDo 表示
   - **ToDo 行(展開時)**:
     - **座標基準は Milestone ではなく Task スコープ** (ToDo の日付は Task 期間内に収まることが多い)
     - `taskRangeMs = task.endDate - task.startDate` で計算
     - 「共通ルール」に従い offsetPct / widthPct をクリップ
     - `<GanttBar>` + `<ProgressPill>` + `<StatusPill>`
   - **Task 追加**: `+` ボタン → インラインフォーム(名前・開始日・終了日) → `createTask(milestone.id, projectId, name, startDate, endDate)` → `router.refresh()`

5. **コンポーネントを `timeline-view/index.ts` でエクスポート**(任意、import path を統一する場合)。

### 検証コマンド

```powershell
npm run typecheck
npm run lint
npm run build
# ブラウザで確認:
# docker compose up -d
# - V1 の Milestone 名の右の → リンクで V2 に遷移
# - V2 で各 Task が Milestone 期間内の正しい x 位置・幅で表示される
# - 今日線が Milestone 期間内に表示(期間外は非表示)
# - Task の展開で ToDo 行が表示される
# - V1 のインライン編集が引き続き動作する(回帰)
```

### 完了基準

- `/projects/[id]/milestones/[milestoneId]` で Task 一覧が Milestone 時間軸でズーム表示される
- ガントバーの x オフセット・width が Milestone 期間に対して数学的に正確(端の Task が端に表示)
- 今日線が Milestone 期間内のとき正しい位置に表示、期間外のとき非表示
- V1 の Milestone 名の横リンクで V2 に遷移できる(V1 のインライン編集は動作を維持)
- TypeScript エラーなし、ビルド通過

### ブランチ / PR

`feature/phase2-step1-timeline-v2` → `develop`

---

## Step 2: V3 タスク詳細 + ToDo CRUD

### コンテキスト

Phase 1 完了済みで以下が利用可能(詳細は「既存の再利用可能リソース」参照)。

**V3 の仕様** (`docs/spec.md` §5.3):

> Task 全体行 + 配下 ToDo を期間バーで表示、ToDo の CRUD

- Task のサマリ行(Task 期間 full-width でガントバー)
- 配下 ToDo を各行で期間バー表示(ToDo の startDate〜endDate を Task 期間内にマッピング)
- ToDo の追加・名前編集・日付編集・削除
- ボトルネック警告: `warning` ステータスの ToDo 行を赤背景でハイライト

### 作業タスク

1. **型定義** `src/types/task-detail.ts`(新規作成):

   ```ts
   import type { TaskProgressData } from '@/components/tree-view/progress-utils'
   import type { ProgressBarData } from '@/types/progress'

   export type TodoWithProgress = {
     id: string
     name: string
     startDate: Date
     endDate: Date
     weight: number
     actualPct: number
     completed: boolean
     progressData: ProgressBarData
   }

   export type TaskWithDetail = TaskProgressData & {
     id: string
     name: string
     milestoneId: string
   }
   ```

2. **V1/V2 からの遷移リンク追加** `src/components/tree-view/task-row.tsx`:
   - Task 名の `<InlineEdit>` の隣(右)に `<Link>` コンポーネントを追加する
   - **重要:** `<InlineEdit>` 自体は変更しない
   - `mode !== 'input'` のときのみリンクを表示

   ```tsx
   import Link from 'next/link'
   // タスク名 InlineEdit の直後に追加
   {
     mode !== 'input' && (
       <Link
         href={`/projects/${projectId}/tasks/${task.id}`}
         className="shrink-0 rounded p-1 text-xs text-gray-400 hover:text-blue-500"
         aria-label="タスク詳細を開く"
         title="タスク詳細"
       >
         →
       </Link>
     )
   }
   ```

3. **ページ** `src/app/(app)/projects/[id]/tasks/[taskId]/page.tsx`:
   - Server Component
   - `requireProjectMember(id)` で認可確認
   - `getProject(id)` で全データ取得
   - `taskId` に一致する Task が存在しない場合は `notFound()`
   - 親 Milestone と親 Project の情報を抽出(パンくずリスト用)
   - Task 進捗を `buildTaskProgressData(task, today)` で計算
   - 各 ToDo の進捗を計算:
     - `actualPct`: `todo.actualPct`
     - `scheduledPct`: `calcScheduledPct(todo.startDate, todo.endDate, today)`
     - `status`: `calcStatus(todoActual, todoScheduled)`
     - `daysDeviation`: `calcDaysDeviation(todoActual, todoScheduled, todoDurationDays)`
   - 計算済みデータを `TaskWithDetail` + `TodoWithProgress[]` 形式に変換して `<TaskDetailView>` に渡す
   - `today = new Date()` をサーバー側で1回生成
   - ページヘッダー: パンくずリスト `プロジェクト名 > マイルストーン名 > タスク名`
     - V1 戻り: `/projects/[id]`
     - V2 戻り: `/projects/[id]/milestones/[milestone.id]`

4. **TaskDetailView コンポーネント** `src/components/task-detail/task-detail-view.tsx`:
   - Client Component
   - props:
     ```ts
     type Props = {
       task: TaskWithDetail
       todos: TodoWithProgress[]
       projectId: string
       today: Date
     }
     ```
   - **Task サマリ行**:
     - 全幅 `<GanttBar actualPct scheduledPct status>`
     - `<ProgressPill>`, `<StatusPill>`, `<DaysPill>`
   - **今日線**: 「共通ルール」の計算式で `todayOffsetPct` を求め、Task スコープ内のとき縦線を描画
   - **ToDo 行(各 ToDo)**:
     - 「共通ルール」の座標計算(スコープ = Task)で `offsetPct` / `widthPct` を求めてラッパー `<div>` に適用
     - ラッパー内で `<GanttBar>`
     - `<ProgressPill>` + `<StatusPill>` + `<DaysPill>`
     - **ボトルネック警告**: `todo.progressData.status === 'warning'` のとき行全体に赤背景(`bg-red-50 border-l-2 border-red-400` など)
     - **ToDo 名インライン編集**: クリックで `<input>` 表示、blur/Enter で `updateTodo(id, projectId, { name })` → `router.refresh()`
     - **ToDo 日付インライン編集**: 開始日・終了日をそれぞれ `<input type="date">` で編集、blur で `updateTodo(id, projectId, { startDate?, endDate? })` → `router.refresh()`
     - **削除ボタン**: クリック → `window.confirm('このToDo を削除しますか？')` で確認 → 確認後 `deleteTodo(id, projectId)` → `router.refresh()`
   - **ToDo 0件のとき**:
     - 空状態メッセージ「ToDo がありません」を表示
     - `+ ToDo を追加` フォームのみ提示
   - **ToDo 追加**:
     - `+` ボタン → インラインフォーム展開(名前・開始日・終了日)
     - 送信 → `createTodo(task.id, projectId, name, startDate, endDate)` → `router.refresh()`
     - 追加後の weight 再計算は Server Action 内で自動実施(Phase 1 実装済み)

5. **日付 `<input>` の値形式**: `Date` ↔ HTML date input の変換ユーティリティが必要:
   ```ts
   // YYYY-MM-DD 形式に変換
   const toDateInputValue = (d: Date) => d.toISOString().slice(0, 10)
   // 文字列から Date に変換
   const fromDateInputValue = (s: string) => new Date(s + 'T00:00:00')
   ```
   このユーティリティを `src/lib/date-utils.ts` に追加する(Phase 1 でまだ存在しない場合のみ)。

### 検証コマンド

```powershell
npm run typecheck
npm run lint
npm run build
# ブラウザで確認:
# docker compose up -d
# - V1 の Task 名の右の → リンクで V3 に遷移
# - V3 で ToDo が Task 期間内の正しい x 位置・幅で表示
# - ToDo を3件追加 → Prisma Studio(npm run db:studio)で weight が [33,33,34]
# - ToDo を1件削除 → 残 2 件の weight が [50,50]
# - warning ステータスの ToDo 行が赤背景になる
# - ToDo 名・日付のインライン編集が動作
# - 削除時に確認ダイアログが表示される
# - ToDo 0件時に空状態メッセージが表示される
# - V1 のインライン編集が引き続き動作する(回帰)
```

### 完了基準

- `/projects/[id]/tasks/[taskId]` で ToDo 一覧が Task 時間軸で表示される
- ToDo の追加・名前編集・日付編集・削除が動作し、操作後に weight が自動再計算される
- `warning` ステータスの ToDo 行が赤背景でハイライト表示される
- 削除前に `window.confirm` が表示される
- ToDo 0件のとき空状態メッセージが表示される
- V1/V2 の Task 名横リンクで V3 に遷移できる(V1 のインライン編集は動作を維持)
- TypeScript エラーなし、ビルド通過

### ブランチ / PR

`feature/phase2-step2-task-detail-v3` → `develop`

---

## Step 3: 回帰テスト・バグ修正

### コンテキスト

**依存:** Step 1, 2 すべてが `develop` にマージ済みであること。

Phase 2 で追加された V2/V3 と、Phase 1 の既存機能(V1, I1, A3〜A5)の回帰テストを行う。

### 作業タスク

1. **CI グリーン確認:**

   ```powershell
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```

2. **E2E フロー確認(手動チェックリスト):**
   - [ ] V1 の Milestone 名横 → リンクで V2 に遷移し、ガントバーの x 位置が正しい
   - [ ] V2 の今日線が Milestone 期間内に表示(期間外は非表示)
   - [ ] V2 でタスク追加 → V1 にも反映されている
   - [ ] V2 の Task 名横 → リンクで V3 に遷移
   - [ ] V3 で ToDo を3件追加 → weight が [33,33,34] になる(Prisma Studio で確認)
   - [ ] V3 で ToDo を1件削除 → 残 2 件の weight が [50,50] になる
   - [ ] V3 での ToDo 名インライン編集 → リロード後に反映
   - [ ] V3 での ToDo 日付インライン編集 → バーの x 位置・幅が変わる
   - [ ] V3 の削除ボタンで確認ダイアログが表示される
   - [ ] V3 で ToDo 0件のとき空状態メッセージが表示される
   - [ ] I1(日報入力)で進捗入力 → V2/V3 の進捗ピルが更新される
   - [ ] 非メンバーが V2/V3 にアクセスすると 404 になる
   - [ ] V1 のインライン編集・ドラッグ&ドロップが引き続き動作する(Phase 1 回帰)
   - [ ] A4 設定・A5 招待フローが引き続き動作する(Phase 1 回帰)

3. **発見した全バグを修正**し、バグを検出するテストを追加する。

4. **`develop` → `main` PR 作成:** Step 3 ブランチを `develop` にマージ後、`develop` → `main` の PR を作成する。

### 完了基準

- CI 全ジョブ(lint, typecheck, test, build)グリーン
- 上記 E2E チェックリスト 14 項目すべて完了
- Phase 1 の既存機能に回帰なし
- `develop` → `main` PR が作成済み

### ブランチ / PR

`feature/phase2-step3-qa-regression` → `develop`  
完了後: `develop` → `main` PR を作成

---

## 実装開始手順

`develop` ブランチはすでに存在するため作成不要。

```powershell
git checkout develop
git pull origin develop
# Step 1 と Step 2 は並列実行可能 — 別エージェントに委任する場合は2ブランチを同時に切る
git checkout -b feature/phase2-step1-timeline-v2
```

```powershell
# Step 2 (別ターミナルまたは別エージェント):
git checkout develop
git checkout -b feature/phase2-step2-task-detail-v3
```

## 変更・中断プロトコル

- **ステップを分割:** このファイルを更新し、末尾に改訂コメントと日付を追記する
- **ステップをスキップ:** 該当ステップに `[SKIP: 理由]` を付記し、依存関係を更新する
- **仕様変更が必要:** `docs/spec.md` を先に更新し改訂履歴を追記してから本ファイルを更新する

---

_作成日: 2026-05-13 | 仕様書バージョン: v3.0 | Opus 4.7 adversarial review 実施済み(2 CRITICAL, 10 MAJOR 修正済み)_
