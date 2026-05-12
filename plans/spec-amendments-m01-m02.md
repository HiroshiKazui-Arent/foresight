# 仕様修正 M-01 + M-02 実装計画

**目的:** `docs/spec-amendments.md` の M-01(日報チェックボックス化、`actualPct` 全廃)と M-02(`TodoTemplate` 自動投入)を実装する。
**仕様書:** `docs/spec.md` v3.0 + `docs/spec-amendments.md` v1.0
**テスト仕様:** `docs/test-spec.md` v1.0(本変更で関連 TC を再計画)
**前提:** Phase 1〜3 実装済み。`develop` ブランチ起点。
**ベースブランチ:** `develop`
**機能ブランチ:** `feat/spec-amendments-m01-m02`
**gh CLI:** インストール済み・認証済み(`HiroshiKazui-Arent`)。`gh pr create` で PR 発行可。
**コマンド注意:** Windows/PowerShell 環境。チェーンは `&&` でなく `;`。Claude Code セッション内では `$env:Path` 再ロードが必要な場合あり。

---

## 不変ルール(全ステップ共通)

1. **`actualPct` は完全削除。** `Todo.actualPct` / `DailyReport.actualPct` 参照を 1 件も残さない。grep で 0 件になることを各ステップ末で確認。
2. **`completed: boolean` のみが進捗の真理値。** UI / 計算 / DB すべて completed 単独で表現。
3. **`DailyReport` テーブルは保持する。** 監査ログとして追記オンリー。`Todo.completed` がソース・オブ・トゥルース(Q-03 の `actualPct` 表現は M-01 で更新)。
4. **`prisma migrate dev --name <descriptive>` を使う。** 自動生成名(`prisma_xxx`)は不可。
5. **Task 作成時の TodoTemplate 自動展開は単一トランザクション内で実行。** 部分投入状態を観測させない。`createTask` 全体を `prisma.$transaction` で囲む。
6. **`TodoTemplate` の編集 UI は本変更では作らない。** seeder 経由のみ。
7. **各 Server Action 末尾の `revalidatePath` を必ず維持。** Phase 1 の規約踏襲。
8. **重み均等割りは `src/lib/weight.ts` の `redistributeWeights` を必ず使う。** 二重実装禁止(`docs/spec.md` 6.7 確定事項)。
9. **`progress.ts` の Task 実績% は `Σ(completed の weight) / totalWeight × 100` で計算する。** `/100` 固定にしない(テストフィクスチャの重み合計が 100 でないため。本変更で `spec-amendments.md` の式表記も同期する)。

---

## 仕様判断: ToDo ステータスと V4 への影響

M-01 により `Todo.actualPct` が消えるため、ToDo 単独の「乖離 ≤ -20%」判定が不能となる(0% or 100% の二値)。
これに伴う仕様判断を**本変更の一部として実装する**:

| 影響箇所                                       | 対応                                                                                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ToDo の 5 段階ステータス(`spec.md` 4.4)        | 「完了 / 未着手 / 進行中(=期間内未完了)/ 遅延(=期日超過かつ未完了)」の 4 段階に簡素化。「警告」状態は ToDo レベルでは持たない |
| `forecast.ts` の `warningTodos`                | Task の期日と今日の日付のみから「期日超過かつ未完了」を判定するロジックに置換(actualPct 速度ベースの予測は廃止)               |
| V4 ダッシュボード根元(`spec.md` 5.3 V4)        | 連鎖の根元は「期日超過/直前の未完了 ToDo」となる。表示要件は変えず根拠ロジックのみ差し替え                                    |
| Task / Milestone / Project の 5 段階ステータス | 変更なし(actualPct 集計値に対する乖離判定は引き続き機能する)                                                                  |

この判断は Step 7 で `docs/spec.md` 4.4 / 5.3 V4 に反映する。

---

## ステップ一覧と依存関係

```
Step 1 ─┬─→ Step 2 ─→ Step 3 ─→ Step 4 ─┐
        │                                ├─→ Step 6 ─→ Step 7
        └─→ Step 5 ──────────────────────┘
```

| #   | タイトル                                                        | 依存            | 並列可能な相手 |
| --- | --------------------------------------------------------------- | --------------- | -------------- |
| 1   | Prisma スキーマ + マイグレーション + seed.ts 型修正             | なし            | —              |
| 2   | 進捗計算ロジック + 型定義の更新                                 | 1               | Step 5         |
| 3   | UI コンポーネントの actualPct 全廃                              | 1, 2            | Step 5         |
| 4   | I1 画面 + `submitDailyReport` チェック化                        | 1, 2, 3(型のみ) | Step 5         |
| 5   | TodoTemplate seed + Task 作成時の自動展開                       | 1               | Step 2, 3, 4   |
| 6   | テストコード全面更新                                            | 2, 3, 4, 5      | —              |
| 7   | ドキュメント整合性(spec.md / test-spec.md / spec-amendments.md) | 6               | —              |

**並列実行のヒント:** Step 1 完了後、Step 5 は他ステップと独立に進められる(編集ファイルが重ならない)。Step 2 → Step 3(コンポーネント)→ Step 4(I1)はシリアル。Step 4 の `progress-input.tsx` 削除等の UI 改修は Step 3 で `src/types/progress.ts` から `actualPct` を削った後に進める。

---

## Step 1: Prisma スキーマ + マイグレーション

### コンテキスト

現状の `prisma/schema.prisma` には:

- `Todo.actualPct Int @default(0)` ← 削除対象
- `DailyReport.actualPct Int` ← 削除対象
- `TodoTemplate` モデル ← 新規追加

### 作業タスク

1. `prisma/schema.prisma` を編集:

   ```prisma
   model Todo {
     // actualPct Int @default(0)  ← 行ごと削除
     // 他フィールドはそのまま
   }

   model DailyReport {
     // actualPct Int  ← 行ごと削除
     // 他フィールドはそのまま
   }

   // ファイル末尾に追加
   model TodoTemplate {
     id        String   @id @default(cuid())
     name      String
     order     Int
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt

     @@index([order])
   }
   ```

2. マイグレーション生成:

   ```powershell
   npm run db:migrate -- --name spec_amendments_m01_m02
   ```

   生成された `prisma/migrations/<timestamp>_spec_amendments_m01_m02/migration.sql` を目視確認し、以下を含むことを確認:
   - `ALTER TABLE "Todo" DROP COLUMN "actualPct";`
   - `ALTER TABLE "DailyReport" DROP COLUMN "actualPct";`
   - `CREATE TABLE "TodoTemplate" (...);`
   - `CREATE INDEX "TodoTemplate_order_idx" ON "TodoTemplate"("order");`

3. Prisma Client 再生成(マイグレーションコマンドで自動実行されるが念のため):

   ```powershell
   npm run db:generate
   ```

4. **`prisma/seed.ts` の型エラーを最低限解消する** — マイグレーション後 seeder が実行不能になるため、本ステップ内で:
   - 既存サンプル ToDo の `actualPct: <int>` 行を**全削除**(`completed: true|false` のみ残す)
   - 既存 `DailyReport.create` から `actualPct: <int>` を削除
   - `TodoTemplate` の本格投入は Step 5 で行う(本ステップでは型修正のみ)
   - `npm run db:seed` がエラーなく完走することを確認

### 検証

```powershell
npm run db:generate
npm run db:seed   # seed.ts が通ること
npm run typecheck # UI/lib は赤のままで OK(Step 2〜5 で 0 にする)
```

このステップでは UI / lib コードが旧型に依存しているので、`typecheck` は意図的に**多数のエラーを出す**。エラー数を控えておき、Step 2〜5 で 0 件に向かうことを確認する。

### 完了条件

- マイグレーションファイルが生成され、SQL が想定通り
- `npx prisma format` がエラーなく通る
- スキーマファイル末尾の改行コードが LF のまま(Prisma の慣習)
- `npm run db:seed` が完走する(seed.ts に `actualPct` 参照 0 件)

### コミット

```
chore(prisma): actualPct を削除し TodoTemplate を追加 — M-01/M-02 スキーマ変更
```

---

## Step 2: 進捗計算ロジック更新

### コンテキスト

`src/lib/progress.ts` の `calcTaskActualPct` は現在 `todos: { actualPct, weight }[]` を受け取る。これを `{ completed, weight }[]` に変更する。`completed: true` の重みのみを合計する。

`calcMilestoneActualPct` / `calcProjectActualPct` は `actualPct` を引数に取るが、これらは「集計済みの%」を受け取る形なので**シグネチャはそのまま**(呼び出し側で `calcTaskActualPct` の結果を渡す)。

### 作業タスク

1. `src/lib/progress.ts` を編集:

   ```ts
   export function calcTaskActualPct(todos: { completed: boolean; weight: number }[]): number {
     if (todos.length === 0) return 0
     const totalWeight = todos.reduce((sum, t) => sum + t.weight, 0)
     if (totalWeight === 0) return 0
     const completedWeight = todos.reduce((sum, t) => sum + (t.completed ? t.weight : 0), 0)
     return (completedWeight / totalWeight) * 100
   }
   ```

   `calcDaysDeviation` / `calcStatus` の `actualPct` パラメータ名はそのまま(意味的に「実績%」のままで OK)。

2. `src/lib/forecast.ts`: 仕様判断セクションで決めた通り、ToDo の actualPct 速度ベースの予測を**廃止**:
   - `warningTodos` の判定を「期日超過 or 期日が今日から N 日以内かつ `completed: false`」のシンプルロジックに置換(N は定数。`spec.md` 5.3 V4 に既に明示的な数値がなければ **N=3** を初期値として採用)
   - 完了予測日の計算は Task 以上のレベル(Task の `actualPct` ≒ `calcTaskActualPct` 結果)で行う
   - `forecast.ts` の export 型から ToDo 単独の `actualPct` 参照を削除

3. `src/types/progress.ts`, `src/types/task-detail.ts`, `src/types/timeline.ts`, `src/types/dashboard.ts` から `Todo.actualPct` を削除し `completed: boolean` を必須化。

4. 単体テスト `src/lib/__tests__/progress.test.ts` / `forecast.test.ts` を新シグネチャに合わせて更新(詳細は Step 6 で実施するが、本ステップで型エラーを潰すために最低限の修正は許容)。

### 検証

```powershell
npm run typecheck
npx vitest run src/lib/__tests__/progress.test.ts
```

`progress.test.ts` の更新は Step 6 で完成させる。本ステップでは型エラーが 0 になればよい(一部テストが赤でも可、commit メッセージで明記)。

### 完了条件

- `src/lib/progress.ts` / `forecast.ts` 内で `actualPct` 参照が ToDo 由来のものが 0 件:

  ```powershell
  Select-String -Path "src/lib/progress.ts","src/lib/forecast.ts" -Pattern "todo.*actualPct|\.actualPct" | Where-Object { $_.Line -notmatch "Task実績|Milestone実績|Project実績" }
  ```

- `npm run typecheck` で本ファイル起因のエラーが 0 件

### コミット

```
refactor(progress): ToDo の actualPct 参照を completed ベースに置換
```

---

## Step 3: UI コンポーネントの actualPct 全廃

### コンテキスト

`actualPct` を参照する UI 側ファイル(grep 済):

- `src/components/progress-pill.tsx`
- `src/components/gantt/gantt-bar.tsx`
- `src/components/tree-view/{task-row,milestone-row,progress-utils}.tsx`
- `src/components/task-detail/task-detail-view.tsx`
- `src/components/timeline-view/timeline-view.tsx`
- `src/components/dashboard/dashboard-view.tsx`
- `src/components/daily-report/todo-input-row.tsx`(Step 4 で深く触るためここでは最小限)
- `src/app/(app)/projects/{page.tsx,project-list.tsx}`
- `src/app/(app)/projects/[id]/milestones/[milestoneId]/page.tsx`
- `src/app/(app)/projects/[id]/tasks/[taskId]/page.tsx`
- `src/app/(app)/_preview/page.tsx`
- `src/types/{progress,task-detail,timeline,dashboard}.ts`

### 作業タスク

1. **型ファイル先行**(`src/types/*.ts`): Todo 型から `actualPct` を削除、`completed: boolean` を必須化。

2. **計算経路**: 各ページ Server Component で Prisma から Todo を取得している箇所で、`select` から `actualPct` を削除し `completed` を含める。続いて `calcTaskActualPct` を Step 2 の新シグネチャで呼ぶ(`todos.map(t => ({ completed: t.completed, weight: t.weight }))`)。

3. **表示コンポーネント**: `progress-pill` 等は「集計済みの実績%」を受け取るため**変更不要**な箇所が多い。ToDo 単独の実績% を表示している箇所(タスク詳細など)は「✓ / 未」のアイコン表示に置換。

4. `src/components/daily-report/todo-input-row.tsx` は Step 4 の主戦場のためここでは触らない(型エラーが残ってよい)。同じく `src/components/daily-report/progress-input.tsx` および `completed-checkbox.tsx` も Step 4 で扱う(本ステップでは型エラー許容)。

### 検証

```powershell
npm run typecheck
npm run lint
```

`daily-report/todo-input-row.tsx` の型エラーは Step 4 で解消する旨をコミットメッセージに明記する。それ以外のファイルでは 0 エラーを目標とする。

### 完了条件

- `daily-report` ディレクトリ以外で `actualPct` 参照 0 件:

  ```powershell
  Select-String -Path "src/**/*.ts","src/**/*.tsx" -Pattern "actualPct" -Exclude "*daily-report*","*__tests__*"
  ```

- 既存の UI 動作(進捗バー / ピル表示)が `npm run build` で破綻しない

### コミット

```
refactor(ui): コンポーネントから ToDo.actualPct 参照を撤去 — completed ベースへ
```

---

## Step 4: I1 画面 + `submitDailyReport` チェックボックス化

### コンテキスト

現在の `submitDailyReport`(`src/server/actions/daily-report.ts`)は `actualPct` と `completed` の両方を受け取り、`completed=true` のときは強制 100% にしている。M-01 では `actualPct` 廃止のため、引数を `completed: boolean` 単独にする。

I1 画面(`src/app/(app)/projects/[id]/daily/page.tsx`)と `src/components/daily-report/todo-input-row.tsx` から、進捗% 入力 UI を削除しチェックボックスのみに変更する。

### 作業タスク

1. **Server Action 簡素化** — `src/server/actions/daily-report.ts`:

   ```ts
   export async function submitDailyReport(
     todoId: string,
     projectId: string,
     completed: boolean,
     comment?: string,
   ): Promise<void> {
     if (!todoId?.trim() || !projectId?.trim()) throw new Error('不正なリクエストです')
     if (comment !== undefined && comment.length > 1000)
       throw new Error('コメントは1000文字以内にしてください')

     const userId = await requireProjectMember(projectId)
     const now = new Date()
     const reportDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())

     await prisma.$transaction(async (tx) => {
       const todo = await tx.todo.findFirst({
         where: { id: todoId, task: { milestone: { projectId } } },
       })
       if (!todo) throw new Error('権限がありません')

       await tx.dailyReport.create({
         data: { todoId, reportedBy: userId, date: reportDate, completed, comment },
       })
       await tx.todo.update({ where: { id: todoId }, data: { completed } })
     })

     revalidatePath('/projects/' + projectId)
     revalidatePath('/projects/' + projectId + '/daily')
   }
   ```

2. **UI コンポーネント** — `src/components/daily-report/`:
   - `progress-input.tsx`: **ファイルごと削除**(進捗% スライダー / 数値入力本体)
   - `completed-checkbox.tsx`: チェック ON 時に `setActualPct(100)` 連動するロジックを撤去、`completed` のみ管理に変更
   - `todo-input-row.tsx`: `progress-input` import を削除、`CompletedCheckbox` のみ残す(チェック ON で `submitDailyReport(todoId, projectId, true)`)
   - 既に `completed: true` のとき再度クリックで `false` に戻せる(追記される `DailyReport.completed = false` も監査ログとして有効)

3. **I1 ページ** — `src/app/(app)/projects/[id]/daily/page.tsx`:
   - 一覧描画箇所で ToDo 行の進捗% 表示を撤去
   - 「完了済み: 5/12 件」のような件数サマリを表示する(完了条件に含める)

### 検証

```powershell
npm run typecheck
npm run lint
docker compose up -d app
# ブラウザで /projects/<id>/daily を開きチェックボックス操作で更新を確認
```

### 完了条件

- `submitDailyReport` の signature が `(todoId, projectId, completed, comment?)` になった
- I1 画面に進捗% 入力 UI が存在しない
- `src/components/daily-report/progress-input.tsx` が削除されている
- I1 ページ上部に「完了済み: N/M 件」の件数サマリが表示される
- チェックボックス ON/OFF で `DailyReport` が追記され、`Todo.completed` が同期する

### コミット

```
feat(daily-report): I1 画面と submitDailyReport をチェックボックスのみに変更 — M-01
```

---

## Step 5: TodoTemplate seed + Task 作成時の自動展開

### コンテキスト

Task 作成 Server Action `src/server/actions/task.ts` の `createTask` を **`prisma.$transaction` で囲む形に書き換え**、Task 作成と同一トランザクション内で `TodoTemplate` から ToDo を一括生成する。重みは `src/lib/weight.ts` の `redistributeWeights` を必ず使用する(不変ルール 8)。

### 作業タスク

1. **Seeder** — `prisma/seed.ts` の `main()` 冒頭(既存ユーザー作成より前でも可):

   ```ts
   const templates = [
     { name: '画面設計', order: 1 },
     { name: 'データベース設計', order: 2 },
     { name: 'バックエンド開発', order: 3 },
     { name: 'フロントエンド開発', order: 4 },
     { name: 'テストコードの実装', order: 5 },
     { name: 'テスト・レビュー', order: 6 },
   ]
   for (const t of templates) {
     await prisma.todoTemplate.upsert({
       where: { id: `seed-tpl-${t.order}` }, // 固定 ID で冪等化
       update: { name: t.name, order: t.order },
       create: { id: `seed-tpl-${t.order}`, name: t.name, order: t.order },
     })
   }
   ```

   既存のサンプル `Todo.actualPct` / `DailyReport.actualPct` 参照は Step 1 で既に削除済み。

2. **Task 作成 Server Action 書き換え** — `src/server/actions/task.ts`:
   - 現状の `prisma.task.create(...)` 単発呼出を `prisma.$transaction(async (tx) => { ... })` で囲む
   - トランザクション内で Task を作成後、`TodoTemplate` を `order` 昇順で読み、テンプレが 1 件以上あれば配下に ToDo を一括生成

   ```ts
   import { redistributeWeights } from '@/lib/weight'

   await prisma.$transaction(async (tx) => {
     const task = await tx.task.create({ data: { ...taskInput } })
     const templates = await tx.todoTemplate.findMany({ orderBy: { order: 'asc' } })
     if (templates.length === 0) return task

     const weights = redistributeWeights(templates.length) // number[] を返す既存関数
     await tx.todo.createMany({
       data: templates.map((tpl, i) => ({
         taskId: task.id,
         name: tpl.name,
         weight: weights[i],
         completed: false,
         startDate: task.startDate,
         endDate: task.endDate,
         order: i,
       })),
     })
     return task
   })
   ```

   `TodoTemplate` が 0 件の場合は ToDo を作らない(従来通り空 Task で開始)。

3. **`redistributeWeights` の API 確認** — 既存実装の引数・戻り値型を **本ステップ着手前に必ず確認**(`src/lib/weight.ts` を Read)。スニペット中の呼び方 `redistributeWeights(templates.length): number[]` と異なる場合は、ラッパー追加ではなく**実際のシグネチャに合わせる**こと(二重実装禁止、不変ルール 8)。

### 検証

```powershell
npm run db:push --force-reset  # 開発 DB を初期化
npm run db:seed
npm run db:studio  # TodoTemplate 6件と既存サンプル Project が両立することを確認
```

E2E でも確認:

```powershell
npx playwright test e2e/projects.spec.ts -g "Task 作成"
```

### 完了条件

- Seeder 実行後、`TodoTemplate` テーブルに 6 件存在し `order` が 1〜6
- 新規 Task を作成すると配下に 6 件の ToDo が `order: 0〜5` で自動生成され、weight 合計が 100
- 既存 Task の挙動は変わらない(自動展開は新規作成時のみ)

### コミット

```
feat(template): TodoTemplate seed と Task 作成時の自動展開を追加 — M-02
```

---

## Step 6: テストコード全面更新

### コンテキスト

`actualPct` を参照する既存テスト(grep 済):

- `src/lib/__tests__/progress.test.ts`
- `src/lib/__tests__/daily-report.test.ts`
- `src/lib/__tests__/forecast.test.ts`
- `src/lib/__tests__/screens.test.ts`
- `src/components/__tests__/{progress-pill,gantt-bar,tree-view}.test.ts`
- `e2e/daily-report.spec.ts`

これらを `completed` ベースに更新する。さらに `docs/test-spec.md` で新規追加された TC(TC-TPL-\*)に対応するテストを新規作成。

### 作業タスク

1. **既存テスト更新:**
   - `progress.test.ts`: TC-AGG-001(Task実績%)を `[{completed:true,weight:50},{completed:false,weight:50}]` → 50% のような形に
   - `daily-report.test.ts`: 進捗% 引数を削除、`completed` のみのフィクスチャに
   - `forecast.test.ts`: ToDo 単位の予測テストを Task 以上のレベルに引き上げ
   - 他: 同様に actualPct 参照を撤去

2. **新規テスト** — `src/lib/__tests__/todo-template.test.ts`(または相応):
   - TC-TPL-001: Seeder 実行で 6 件投入される
   - TC-TPL-002: Task 作成時に 6 件の ToDo が `order` 順に展開される
   - TC-TPL-003: 展開後の weight 合計 = 100(6 件のとき `[16,16,16,16,16,20]` を期待。端数 4 が最後に寄る)
   - TC-TPL-004: テンプレ 0 件のとき ToDo は作られない
   - TC-TPL-005: 自動展開された ToDo を削除すると残り 5 件で再分配される(端数あり: 例 `[20,20,20,20,20]` のような均等割)
   - TC-TPL-006: 7 件のテンプレ構成(`[14,14,14,14,14,14,16]`)で端数が最後の ToDo に寄ることを検証

3. **E2E** — `e2e/daily-report.spec.ts`:
   - 進捗% スライダー操作を削除
   - チェックボックスクリックで Task 進捗 が再計算されることを検証

4. **テスト DB クリーン戦略**: 既存パターンに従い `beforeEach` で truncate(`fix-all-tests.md` 参照)。

### 検証

```powershell
npm test  # 全ユニット
npx playwright test  # 全 E2E
npm run lint
npm run typecheck
npm run build
```

CI と同等の 4 工程すべてグリーン。

### 完了条件

- `npm test` 全件パス
- `npx playwright test` 全件パス
- `actualPct` 参照を含むファイルが 0 件:

  ```powershell
  Select-String -Path "src/**/*","e2e/**/*","prisma/seed.ts" -Pattern "actualPct"
  ```

### コミット

```
test: actualPct 廃止と TodoTemplate 自動展開のテストカバレッジ更新
```

---

## Step 7: ドキュメント整合性

### コンテキスト

実装が確定したら、仕様書本体・テスト仕様書・seed.ts の記述を最終整合させる。

### 作業タスク

1. **`docs/spec.md`**:
   - 3.2 表の「ToDo: 人が直接入力(進捗% or 完了チェック)」→「完了チェックのみ」に修正
   - 4.2 集計式の `actualPct` を `completed` ベースに書き換え(Task 実績% = Σ(completed の weight) / totalWeight × 100、`progress.ts` 実装と一致)
   - 4.4 ToDo の 5 段階ステータスを 4 段階に簡素化(「警告」は ToDo レベルでは持たない)
   - 5.1 表の I1 行「目的」列を「ToDo の完了チェック」に変更
   - 5.3 の I1 画面記述を「完了チェックボックス」のみに(進捗% 入力欄の記述を撤去)
   - 5.3 V4 ダッシュボードの連鎖根元の判定根拠を「期日超過/直前の未完了 ToDo」に変更
   - 6.4 Prisma スキーマセクションを実装後の状態に同期(`Todo.actualPct` 削除、`DailyReport.actualPct` 削除、`TodoTemplate` 追加、`User.reports` / `Todo.reports` 関係はそのまま)
   - 改訂履歴に v3.1 として「M-01/M-02 反映、ToDo ステータス 4 段階化」を追記

2. **`docs/test-spec.md`**:
   - 14 章 Q-01 の「`actualPct` 優先関係」記述を「M-01 で `actualPct` 廃止のため項目クローズ」に書き換え
   - 14 章 Q-03 の「`Todo.actualPct` が現在値のソース・オブ・トゥルース」→「`Todo.completed` がソース・オブ・トゥルース」に書き換え
   - TC-AGG-001〜005 を `completed` ベースの新テストケースに置き換え(TC-AGG-006 は項目削除)
   - TC-DATA-010 を「`completed` の直接更新可否」、TC-DATA-011 を「`completed` 更新後の Task 実績% 再計算」に書き換え
   - TC-I1-002〜004 を新仕様に更新(進捗% 範囲テスト削除、チェックボックス ON/OFF テストに置換)
   - TC-I1-006 を「日報入力後の Task / Milestone / Project 実績% 再計算」に維持(`completed` ベース)
   - 新規 TC-TPL-001〜006 を §5 重み均等割りに続く新節として追加
   - 6.6 V1 / 6.7 V2 / 6.8 V3 の表示要件から「進捗%入力」関連記述を撤去
   - 改訂履歴に v1.1 を追記

3. **`docs/spec-amendments.md`**:
   - M-01 の「Task実績%」式を `progress.ts` 実装と一致するよう `Σ(completed の weight) / totalWeight × 100` に修正
   - 「テスト仕様への影響」セクションの実装後ステータスを追記
   - 改訂履歴に「実装完了: <YYYY-MM-DD>」を追記

### 検証

- 3 つのドキュメントを通読し、`actualPct` / 「進捗%入力」記述が残っていないことを確認
- `Get-ChildItem docs -Filter *.md | Select-String -Pattern "actualPct|進捗率を入力|進捗%を入力"` で 0 件
- 破壊的スキーマ変更(DROP COLUMN)は Phase 4(AWS デプロイ)前に完了させる旨を `spec-amendments.md` の補足に残す

### 完了条件

- `docs/spec.md` v3.1、`docs/test-spec.md` v1.1 として改訂版確定
- 仕様書とコードの記述が一致

### コミット

```
docs: M-01/M-02 を spec.md / test-spec.md に反映 — v3.1 / v1.1
```

---

## PR 作成

### push

```powershell
git push -u origin feat/spec-amendments-m01-m02
```

### gh CLI で PR 作成

```powershell
gh pr create --base develop --title "feat: 仕様修正 M-01 + M-02 を実装" --body @'
## Summary
- M-01: 日報入力をチェックボックスのみに変更、`Todo.actualPct` / `DailyReport.actualPct` を削除
- M-02: `TodoTemplate` 6 件を seeder で投入、Task 作成時に自動展開
- `docs/spec.md` v3.1、`docs/test-spec.md` v1.1 に反映

## Test plan
- [ ] `npm run lint` グリーン
- [ ] `npm run typecheck` グリーン
- [ ] `npm test` グリーン
- [ ] `npx playwright test` グリーン
- [ ] `npm run build` グリーン
- [ ] 手動: Task 新規作成で 6 件の ToDo が自動展開される
- [ ] 手動: I1 画面のチェックボックスで `DailyReport` が追記、Task 実績% が再計算される
'@
```

---

## ロールバック方針

開発 DB のみ(Phase 4 未着手のため本番 DB なし)。破壊的 DROP COLUMN なので「カラム復元」は実質不能。以下を前提とする:

| ステップ | ロールバック                                                                                                                                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | **DB を再構築**: `git checkout <pre-step1-commit> -- prisma/schema.prisma prisma/migrations` → `npm run db:push -- --force-reset` → `npm run db:seed`(過去の `actualPct` 列を持つ schema を seed と整合した状態で復元) |
| 2〜5     | `git revert <commit>` で個別ステップを巻き戻し。コード戻し後、Step 1 のロールバック手順を実施                                                                                                                          |
| 6        | テスト変更のみなのでブランチ放棄で済む                                                                                                                                                                                 |
| 7        | ドキュメント変更のみなので `git revert` で容易                                                                                                                                                                         |

Phase 4 着手前であれば本番影響なし。Phase 4 後にこの種の破壊的マイグレーションを行う場合は別途データバックアップ + 段階的マイグレーション計画が必要。

---

## 完了基準(全体)

- [ ] Step 1〜7 すべての完了条件を満たす
- [ ] `feat/spec-amendments-m01-m02` ブランチで CI 全工程グリーン
- [ ] PR がレビューを経て `develop` にマージ
- [ ] `docs/spec.md` v3.1、`docs/test-spec.md` v1.1、`docs/spec-amendments.md` の改訂履歴が更新済み
