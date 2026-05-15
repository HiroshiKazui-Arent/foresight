# Spec v4.0 Reset — ガント / 進捗描画モデルの根本リセット

**Status:** Reviewed (Opus adversarial review applied — 4 CRITICAL + 6 MAJOR + 7 MINOR fixes incorporated)
**Branch:** to be created — `feat/spec-v4-reset` (from `main`)
**Author:** /blueprint
**Created:** 2026-05-15
**Spec amendment:** v4.0(v3.3 を全廃)

---

## 0. Objective (One-line)

`docs/spec.md` を v3.3 → v4.0 にリセットし、コードベースも「**バー = 期間のみ / 進捗 = 数値のみ / ToDo = 着手日+完了日の二値**」のシンプル仕様に書き直す。v3.0〜v3.3 で積み上げた重み / 5 段階状態 / 今日線 3 役 / ahead-of-schedule / dual checkbox / 連鎖予測を全廃止する。

---

## 1. Context for Cold-Start Agent

### 1.1 何が起きたか

v3.0〜v3.3 で「ガントバーの塗りつぶしで進捗% を表現する」設計を進めた結果、M-01〜M-04 の累積仕様修正で UI/計算ロジックが破綻寸前に。ユーザーが「迷走」と判断し、`C:\develop\project-manager\mocks\gantt_progress_mock_html2.html` + `C:\develop\project-manager\docs\gantt_ui_handoff.md` で簡素仕様を再策定。本 plan はこの新仕様(spec.md v4.0)を実装に落とす。

### 1.2 v4.0 の中核設計(spec.md と同期)

- **バー = 期間のみ**(進捗の塗りつぶしはしない、ハッチング・色分け状態描画は廃止)
- **進捗 = 数値のみ**(`予定 X% / 実績 Y%` の 2 行表示、実績色は予定以上で緑/未満で赤)
- **ToDo は二値**: `actualStartDate` + `actualEndDate` の DateTime 入力。完了日ありで 100%、なしで 0%
- **集計は単純**: Task 実績% = `完了 ToDo 数 / 全 ToDo 数 × 100`。Milestone/Project は **期間日数を重みに加重平均**。ToDo に重みカラムは持たない
- **ステータス 4 段階**: 完了 / 進行中 / 遅延 / 未着手。未着手リスクは「未着手 AND today > startDate」のサブカテゴリ
- **今日線**: 単純な現在日付の縦線マーカー(`今日(MM/DD)` ラベル)。「3 役」判定は廃止
- **画面**: A1〜A5(管理系)+ G1(ガント表示)+ G2(工程管理)+ G3(進捗入力タスク単位)に集約。V2/V3/V4 と I1 は廃止
- **実績バー終端**: 進行中(`actualEndDate == null`)は `min(today, projectEnd)` まで(Task 予定終了日でクランプしない、超過は projectEnd の右端で頭打ち)
- **未着手の実績バー**: 表示しない

### 1.3 残す資産

- Auth.js v5 二重構成(`auth.config.ts` Edge 軽量 + `auth.ts` Node + bcrypt + 招待制)
- DB スキーマ骨格(User/Account/Session/Invitation/Project/ProjectMember/Milestone/Task)
- `TodoTemplate`(標準 5 件: 画面設計 → DB 設計 → BE 開発 → FE 開発 → テスト)
- A1〜A5 画面群と関連 server actions(招待・プロジェクト・メンバー管理)
- Docker Compose / GitHub Actions CI / `.env` 二重管理
- E2E `e2e/auth.spec.ts`, `e2e/invitation.spec.ts`, `e2e/projects.spec.ts`, `e2e/settings.spec.ts`, `e2e/users.spec.ts`(管理系のみ残る)

### 1.4 撤去対象(完全削除 / 修正大)

#### 1.4.1 確定削除ファイル

| 種別           | パス                                                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gantt UI       | `src/components/gantt/gantt-bar.tsx`(5/6 状態描画、ahead-of-schedule)                                                                                |
| Gantt UI       | `src/components/gantt/hatch-pattern.tsx`(overdue ハッチ)                                                                                             |
| Gantt UI       | `src/components/gantt/today-line.tsx`(3 役判定)                                                                                                      |
| Gantt UI test  | `src/components/__tests__/gantt-bar.test.ts`                                                                                                         |
| Lib            | `src/lib/weight.ts` + `src/lib/__tests__/weight.test.ts`                                                                                             |
| Lib            | `src/lib/forecast.ts` + `src/lib/__tests__/forecast.test.ts`                                                                                         |
| Lib            | `src/lib/progress.ts`(完全置換 — S3 で削除、S4 で新規作成)                                                                                           |
| Lib tests      | `src/lib/__tests__/progress.test.ts`(S4 で新規作成)                                                                                                  |
| Lib tests      | `src/lib/__tests__/daily-report.test.ts`                                                                                                             |
| Lib tests      | `src/lib/__tests__/integration/daily-report-m03.test.ts`                                                                                             |
| Lib tests      | `src/lib/__tests__/integration/todo-weight-daily.test.ts`                                                                                            |
| Components     | `src/components/daily-report/*`(dual checkbox UI 一式、ディレクトリごと)                                                                             |
| Components     | `src/components/status-pill.tsx`(S5 で 4 状態版を新規作成)                                                                                           |
| Components     | `src/components/__tests__/status-pill.test.ts`(S5 で新規作成)                                                                                        |
| Components     | `src/components/days-pill.tsx` + `__tests__/days-pill.test.ts`(廃止)                                                                                 |
| Components     | `src/components/tree-view/progress-utils.ts`                                                                                                         |
| Views          | `src/components/timeline-view/*`(V2 全部)                                                                                                            |
| Views          | `src/components/task-detail/*`(V3 全部)                                                                                                              |
| Views          | `src/components/dashboard/*`(V4 全部)                                                                                                                |
| Routes         | `src/app/(app)/projects/[id]/daily-report/` 配下                                                                                                     |
| Routes         | `src/app/(app)/projects/[id]/milestones/` 配下(V2、存在すれば)                                                                                       |
| Routes         | `src/app/(app)/projects/[id]/tasks/[id]/` 配下の V3 詳細(S7 で別パスに再作成)                                                                        |
| Routes         | `src/app/(app)/projects/[id]/dashboard/` 配下                                                                                                        |
| Preview        | `src/app/(app)/_preview/page.tsx`(v3.x コンポーネント参照のため撤去)                                                                                 |
| Server actions | `src/server/actions/daily-report.ts`                                                                                                                 |
| E2E            | `e2e/daily-report.spec.ts`, `e2e/dashboard.spec.ts`, `e2e/task-detail.spec.ts`, `e2e/timeline.spec.ts`, `e2e/tree-view.spec.ts`(v4 で S9 に書き直し) |
| DB             | `DailyReport` モデル / `Todo.weight` / `started` / `startedAt` / `completedAt` / `completed`                                                         |

#### 1.4.2 修正必要ファイル(weight / actualPct / started / completed / DailyReport を参照する 12 + 10 ファイル)

S3 着手時に **最初に以下のコマンドで残存参照を全件洗い出す**:

```powershell
# 残存参照の確定的洗い出し
rg "redistributeWeights|\.weight\b|\.started\b|\.completed\b|completedAt|startedAt|actualPct|DailyReport|calcRenderStatus|calcAggregateRenderStatus|forecast" src/ prisma/seed.ts
```

確認済みの参照箇所(2026-05-15 時点):

| パス                                                      | 種別             | 修正方針                                                         |
| --------------------------------------------------------- | ---------------- | ---------------------------------------------------------------- |
| `src/server/actions/todo.ts`                              | server action    | `redistributeWeights` 削除、`weight`/`started` 削除              |
| `src/server/actions/task.ts`                              | server action    | `redistributeWeights` 削除、TodoTemplate 展開時の重み再配分撤去  |
| `src/app/(app)/projects/[id]/tasks/[taskId]/page.tsx`     | route (V3 系)    | S3 で削除(S7 で別パス `/progress` に再作成)                      |
| `src/lib/__tests__/progress.test.ts`                      | test             | S3 で削除、S4 で新規作成                                         |
| `src/lib/__tests__/forecast.test.ts`                      | test             | S3 で削除                                                        |
| `src/lib/__tests__/weight.test.ts`                        | test             | S3 で削除                                                        |
| `src/lib/__tests__/todo.test.ts`                          | test             | v3.x 前提箇所(weight/started 等)を削除、v4.0 仕様で書き直し      |
| `src/lib/__tests__/todo-template.test.ts`                 | test             | 標準 5 件展開ロジックは残るので weight 部分のみ削除              |
| `src/lib/__tests__/screens.test.ts`                       | test             | `ProgressBarData` 計算が v3.x ロジック前提のため書き直し or 削除 |
| `src/lib/__tests__/daily-report.test.ts`                  | test             | S3 で削除                                                        |
| `src/lib/__tests__/integration/db-constraints.test.ts`    | integration test | `completed=true → started=true` CHECK 制約テスト削除             |
| `src/lib/__tests__/integration/todo-weight-daily.test.ts` | integration test | S3 で削除                                                        |
| `src/lib/__tests__/integration/daily-report-m03.test.ts`  | integration test | S3 で削除                                                        |

`screens.test.ts` の扱いは S3 で判断: 内部の `ProgressBarData` 計算ロジックが v3.x の `actualPct`/`weight` 前提なら全削除し S9 で v4 仕様の screens 検証に書き直す。

### 1.5 新規実装

| 種別         | パス                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------- |
| DB migration | `prisma/migrations/<ts>_v4_reset/migration.sql`(列削除+追加、テーブル削除、冪等)          |
| Lib          | `src/lib/status.ts`(4 段階ステータス判定)                                                 |
| Lib          | `src/lib/progress.ts`(単純集計 + 期間日数加重)                                            |
| Lib          | `src/lib/summary.ts`(全体進捗+遅延サマリー集計)                                           |
| Lib          | `src/lib/timeline.ts`(`xForDate`, `barOffsetWidth` 等の座標計算共通 util — S5 で先に作る) |
| Gantt UI     | `src/components/gantt/period-bar.tsx`(予定バー+実績バー、期間のみ)                        |
| Gantt UI     | `src/components/gantt/today-marker.tsx`(単純縦線+ラベル)                                  |
| Components   | `src/components/status-pill.tsx`(4 状態に書き直し)                                        |
| Components   | `src/components/summary-cards.tsx`(全体進捗カード+遅延サマリーカード)                     |
| Components   | `src/components/filter-pills.tsx`(すべて/遅延/未着手リスク/進行中/完了)                   |
| Screens      | G1 = `src/app/(app)/projects/[id]/page.tsx` を v4 に再構築                                |
| Screens      | G2 = `src/app/(app)/projects/[id]/manage/page.tsx` 新規                                   |
| Screens      | G3 = `src/app/(app)/projects/[id]/tasks/[taskId]/progress/page.tsx` 新規                  |
| Server       | `src/server/actions/progress.ts`(actualStartDate/actualEndDate 更新)                      |
| E2E          | `e2e/v4-happy-path.spec.ts`, `e2e/v4-filter.spec.ts`, `e2e/v4-visual.spec.ts`(S9)         |

---

## 2. Canonical Definitions

### 2.1 ステータス判定関数(4 段階、純関数、spec 4.3 表と一致)

```ts
// src/lib/status.ts
export type Status = 'completed' | 'in-progress' | 'delayed' | 'not-started'

export function calcStatus(input: {
  actualPct: number // 0..100
  scheduledPct: number // 0..100
  startDate: Date
  endDate: Date
  today: Date
  hasAnyActualStart: boolean // 集約用: 配下に actualStartDate が入っている子があるか
}): Status {
  // 完全完了 (最優先)
  if (input.actualPct === 100) return 'completed'

  // 未着手かつ開始予定日前 → 未着手
  if (input.actualPct === 0 && !input.hasAnyActualStart && input.today < input.startDate) {
    return 'not-started'
  }

  // 開始予定日経過しても着手ゼロ → 遅延 (未着手リスクは delayed の subset、フィルターで再判定)
  if (input.actualPct === 0 && !input.hasAnyActualStart && input.today >= input.startDate) {
    return 'delayed'
  }

  // 着手済み (actualPct > 0 OR hasAnyActualStart) で 100% 未満 → 進行中 or 遅延
  if (input.actualPct < input.scheduledPct) return 'delayed'
  return 'in-progress'
}
```

**spec 4.3 表との対応:**

| spec 行 | 条件                                                                       | 関数の到達点                                                |
| ------- | -------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 完了    | actualPct = 100                                                            | 1 番目の `if` で `completed`                                |
| 未着手  | actualPct = 0 AND !hasAnyActualStart AND today < startDate                 | 2 番目の `if` で `not-started`                              |
| 遅延    | actualPct = 0 AND !hasAnyActualStart AND today >= startDate (未着手リスク) | 3 番目の `if` で `delayed`                                  |
| 遅延    | actualPct > 0 (進行中) AND actualPct < scheduledPct                        | 4 番目の `if` で `delayed`                                  |
| 進行中  | actualPct > 0 AND actualPct >= scheduledPct AND actualPct < 100            | 最終 `return` で `in-progress`                              |
| 進行中  | actualPct = 0 AND hasAnyActualStart (集約特殊ケース)                       | 最終 `return` で `in-progress`(子は着手済みだが集計 0%、稀) |

**ToDo の単純化:** ToDo は `hasAnyActualStart = (actualStartDate != null)`、`actualPct = actualEndDate != null ? 100 : 0`。集約特殊ケースは ToDo では発生しない。

### 2.2 進捗計算(spec.md 4.1〜4.2)

```ts
// src/lib/date-utils.ts に追加
export function daysBetween(start: Date, end: Date): number {
  const diff = (end.getTime() - start.getTime()) / 86400000
  return Math.max(1, Math.ceil(diff)) // ゼロ除算回避 + 同日タスクも最低 1 日扱い
}

// src/lib/progress.ts
export function calcScheduledPct(startDate: Date, endDate: Date, today: Date): number {
  const total = endDate.getTime() - startDate.getTime()
  if (total <= 0) return today >= endDate ? 100 : 0 // 不整合データのフォールバック
  const elapsed = today.getTime() - startDate.getTime()
  return clamp((elapsed / total) * 100, 0, 100)
}

export function calcTaskActualPct(todos: { actualEndDate: Date | null }[]): number {
  if (todos.length === 0) return 0
  const completed = todos.filter((t) => t.actualEndDate != null).length
  return (completed / todos.length) * 100
}

export function calcWeightedActualPct(
  children: {
    actualPct: number
    startDate: Date
    endDate: Date
  }[],
): number {
  if (children.length === 0) return 0
  // 各 child の重み = daysBetween (最低 1 日) → 0 日タスクも完全に無視されない
  const weights = children.map((c) => daysBetween(c.startDate, c.endDate))
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  return children.reduce((acc, c, i) => acc + (c.actualPct * weights[i]) / totalWeight, 0)
}
```

### 2.3 バー描画ルール(spec.md 4.4 と整合)

```
予定バー:
  - 常に表示
  - 範囲: clamp(startDate, projectStart, projectEnd) → clamp(endDate, projectStart, projectEnd)
  - 色 = 青系

実績バー:
  - completed (actualEndDate != null):
      範囲: clamp(actualStartDate, projectStart, projectEnd) → clamp(actualEndDate, projectStart, projectEnd)
  - in-progress (actualStartDate != null && actualEndDate == null):
      範囲: clamp(actualStartDate, projectStart, projectEnd) → clamp(today, projectStart, projectEnd)
      ※ Task の予定終了日 (endDate) ではクランプしない。Task の予定終了日を超過したら projectEnd で頭打ち(超過視認可能)
  - not-started (actualStartDate == null):
      描画しない
  - 色 = 緑系

今日線:
  - projectStart <= today <= projectEnd のとき表示
  - それ以外は非表示(spec v4.0 5.2 で「ガント上の今日線」は projectEnd を超えたら描画対象外)
  - 上部に `今日(MM/DD)` ラベル
```

`PeriodBar` コンポーネントは `wrapperLeft = xForDate(startDate)`, `wrapperWidth = xForDate(endDate) - wrapperLeft` で配置し、内部に予定バー(全幅)と実績バー(条件付き、左端 = `xForDate(actualStartDate) - wrapperLeft`, 右端 = `xForDate(min(actualEndDate or today, projectEnd)) - wrapperLeft`)を div で重ねる。**進捗の塗りつぶしロジックは一切持たない**。

### 2.4 サマリー集計 + フィルター仕様

```ts
// src/lib/summary.ts
export type ProjectSummary = {
  scheduledPct: number // プロジェクト予定%
  actualPct: number // プロジェクト実績%
}

export type DelaySummary = {
  delayedCount: number // status === 'delayed' の Task 数(Milestone はカウントしない)
  maxDelayDays: number // 遅延中の最大遅れ日数 = max(today - endDate, scheduledDelay)
  notStartedRiskCount: number // 未着手リスク = actualPct === 0 AND !hasAnyActualStart AND today > startDate の Task 数
}
```

**フィルター真理表(F1〜F5):**

| 行の status            | F1 すべて | F2 遅延 | F3 未着手リスク | F4 進行中 | F5 完了 |
| ---------------------- | --------- | ------- | --------------- | --------- | ------- |
| completed              | ✓         | —       | —               | —         | ✓       |
| in-progress            | ✓         | —       | —               | ✓         | —       |
| delayed (進行中で遅延) | ✓         | ✓       | —               | —         | —       |
| delayed (未着手リスク) | ✓         | ✓       | ✓               | —         | —       |
| not-started (開始日前) | ✓         | —       | —               | —         | —       |

- **F2 遅延**: status === 'delayed' のすべて(未着手リスクも含む)
- **F3 未着手リスク**: F2 のサブセット。再判定式 = `status === 'delayed' && actualPct === 0 && !hasAnyActualStart && today > startDate`
- 該当する子を持つ親階層はフィルター適用時も表示する(spec v4.0 5.2)

`maxDelayDays` の算出: 各遅延中 Task で `today - endDate` (期日超過日数) と `(scheduledPct - actualPct) × periodDays / 100` (予定との乖離日数換算) の **大きい方** を採用。

---

## 3. Data Model Changes

### 3.1 v4.0 Prisma スキーマ(差分)

```prisma
model Todo {
  id              String   @id @default(cuid())
  taskId          String
  task            Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  name            String
  order           Int
  startDate       DateTime  // 予定開始日
  endDate         DateTime  // 予定終了日
  actualStartDate DateTime? // [v4.0 新規] 着手日 (= 実績バー開始)
  actualEndDate   DateTime? // [v4.0 新規] 完了日 (= 100% 判定)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([taskId, order])
}

// [v4.0 削除] DailyReport モデル
// [v4.0 削除] Todo.weight / started / startedAt / completedAt / completed
// [v4.0 削除] Todo.reports DailyReport[] リレーション
// [v4.0 削除] User.reports DailyReport[] リレーション
// [v4.0 削除] CHECK 制約 Todo_completed_implies_started
```

### 3.2 Migration 戦略(冪等 SQL)

ローカル独り動きフェーズのため **`prisma migrate reset` を許容**(spec.md v4.0 8.2)。新規 migration `<ts>_v4_reset/migration.sql` を作成し、**SQL は全て冪等(`IF NOT EXISTS` / `IF EXISTS` 付与)**:

```sql
-- 旧 CHECK 制約 (存在すれば) 削除
ALTER TABLE "Todo" DROP CONSTRAINT IF EXISTS "Todo_completed_implies_started";

-- M-03 / M-01 カラム削除(冪等)
ALTER TABLE "Todo" DROP COLUMN IF EXISTS "started";
ALTER TABLE "Todo" DROP COLUMN IF EXISTS "startedAt";
ALTER TABLE "Todo" DROP COLUMN IF EXISTS "completedAt";
ALTER TABLE "Todo" DROP COLUMN IF EXISTS "completed";
ALTER TABLE "Todo" DROP COLUMN IF EXISTS "weight";

-- v4.0 カラム追加(冪等)
ALTER TABLE "Todo" ADD COLUMN IF NOT EXISTS "actualStartDate" TIMESTAMP;
ALTER TABLE "Todo" ADD COLUMN IF NOT EXISTS "actualEndDate"   TIMESTAMP;

-- DailyReport テーブル削除(冪等、外部キー CASCADE)
DROP TABLE IF EXISTS "DailyReport" CASCADE;
```

**Pre-condition check (S2 着手前):** `npx prisma migrate dev --create-only` で生成された SQL を **手動で `IF NOT EXISTS` / `IF EXISTS` を全行付与する**。Prisma は標準で冪等 SQL を出さないため、PR レビュー時にここを必ず確認。

**本番反映時のリスク (R2):** 本 migration は `DROP COLUMN` / `DROP TABLE` を含むため Phase 4 で本番に流す時は **手動で blue-green migration を組む**(本番未稼働の現時点では問題なし)。

`prisma generate` 検証(S2 verify で必須):

```powershell
npx prisma validate           # schema.prisma の整合性
npx prisma generate            # 生成エラーがないこと
```

`schema.prisma` 内の `DailyReport` 参照を grep で全件確認(S2 着手前必須):

```powershell
rg "DailyReport" prisma/schema.prisma
# 2026-05-15 時点: 3 件(User.reports / Todo.reports / model DailyReport 本体)。全部削除対象
```

### 3.3 Seed データ要件

S2 の seed では **4 状態すべてが G1 で視覚確認できる** ToDo を含める:

- **completed**: actualStartDate + actualEndDate 両方あり(緑バー、進捗 100%)
- **in-progress (順調)**: actualStartDate あり、actualEndDate なし、`actualPct >= scheduledPct`(緑バー、青進行中バッジ)
- **in-progress (遅延)**: actualStartDate あり、actualEndDate なし、`actualPct < scheduledPct`(緑バー、赤遅延バッジ)
- **not-started**: actualStartDate なし、startDate 未来(灰、未着手バッジ)
- **not-started-risk**: actualStartDate なし、startDate 過去(赤、遅延バッジ + サマリーで未着手リスク件数++)

---

## 4. Step Breakdown (9 steps)

### 依存グラフ

```
S1 (branch + spec commit) ──→ S2 (DB) ──→ S3 (撤去) ──→ S4 (lib)
                                                            │
                                                            ↓
                                                          S5 (base components + timeline util + G1 layout shell)
                                                            │
                                                       ┌────┴────┐
                                                       ↓         ↓
                                                      S6        S7
                                                     (G2)      (G3)
                                                       └────┬────┘
                                                            ↓
                                                          S8 (G1 完成)
                                                            │
                                                            ↓
                                                          S9 (E2E + DoD)
```

**Parallel window:** S5 完了後、S6(G2 工程管理)と S7(G3 進捗入力)は独立。**`projects/[id]/page.tsx` は S5 で暫定 layout を確定させ、S6/S7 では触らない**(M1 対応)。G1 ナビゲーション配線は S8 で行う。

### Step 1: Branch 準備 + spec.md commit + .gitignore 整備

**Model:** Sonnet
**PR title:** `chore: spec v4.0 + reset branch setup`
**Files:**

- `docs/spec.md`(既に v4.0 へ書き換え済み — commit のみ)
- `.gitignore`(`shot_*.png`, `ss_*.png`, `ss2_*.png`, `ss3_*.png`, 日本語ファイル名 screenshot パターン追加)

**手順(順序厳守):**

```powershell
# 1. M-04 未コミット変更を破棄(stash しない、確定破棄)
git restore src/components/gantt/gantt-bar.tsx
git restore src/components/__tests__/gantt-bar.test.ts
# spec.md は v4.0 へ書き換え済みなので保持

# 2. screenshot untracked を .gitignore でガード
# .gitignore 編集後:
git clean -nd                   # 削除対象の確認
git clean -fd                   # screenshots 全削除(必要なら現時点で別ディレクトリに退避)

# 3. main 同期 & ブランチ切替
git checkout main
git pull --ff-only
git checkout -b feat/spec-v4-reset

# 4. spec.md + .gitignore コミット
git add docs/spec.md .gitignore
git commit -m "chore: spec v4.0 reset + ignore screenshots"

# 5. 旧ブランチ削除(remote には push 済み、本人独占のため local-only でも問題なし)
git branch -D feat/ahead-of-schedule-bar
# remote 側もユーザー操作で削除(本人確認後):
# git push origin --delete feat/ahead-of-schedule-bar
```

**Verify:**

```powershell
git status --short              # 作業ツリーがクリーン
git log -1 --stat               # spec.md と .gitignore のみ
git branch                       # feat/spec-v4-reset のみ(または main + 当該)
npm run typecheck
npm test
npm run build
```

**Exit:** `feat/spec-v4-reset` が main から切られた状態で、spec.md v4.0 が commit 済み、screenshots は gitignore、現状の test/build は green。`feat/ahead-of-schedule-bar` は local から削除済み。

**Rollback:** `git checkout main; git branch -D feat/spec-v4-reset`(空ブランチを捨てるだけ)

---

### Step 2: DB schema + migration + seed reset

**Depends:** S1
**Model:** Sonnet
**PR title:** `feat(db): v4.0 schema reset (drop weight/dual-checkbox/DailyReport, add actual dates)`

**Files:**

- `prisma/schema.prisma`:
  - `Todo` から `weight` / `started` / `startedAt` / `completedAt` / `completed` 削除
  - `Todo` に `actualStartDate: DateTime?` / `actualEndDate: DateTime?` 追加
  - **`Todo.reports DailyReport[]` リレーション削除**(L155)
  - **`User.reports DailyReport[]` リレーション削除**(L22)
  - **`DailyReport` モデル本体削除**(L162〜)
  - 削除後 `rg "DailyReport" prisma/schema.prisma` が 0 件であることを確認
- `prisma/migrations/<ts>_v4_reset/migration.sql`(Section 3.2 の冪等 SQL、`IF NOT EXISTS` / `IF EXISTS` 全行付与)
- `prisma/seed.ts`: 新スキーマで投入。Section 3.3 の 5 種類(完了/順調/遅延/未着手/未着手リスク)を再現

**Pre-condition checks:**

```powershell
rg "DailyReport" prisma/schema.prisma   # 削除前に 3 件、削除後 0 件
npx prisma validate                      # 削除後にエラーが出ないこと
```

**Verify:**

```powershell
# DB を完全リセット
npx prisma migrate reset --force
npx prisma generate
# 冪等性確認(2 回 reset しても動く)
npx prisma migrate reset --force
# スキーマ確認
docker compose exec postgres psql -U foresight -d foresight -c '\d "Todo"'
docker compose exec postgres psql -U foresight -d foresight -c '\d "DailyReport"' # ← "does not exist" が正
npm run db:seed
# Prisma Studio で 5 種類が見えることを目視確認
npm run db:studio
```

**Exit:** DB が v4.0 スキーマ、seed で 5 種類のサンプルが投入される。**app の typecheck は意図的に通らない**(次の S3 で対応)。Migration SQL は冪等。

**Rollback:** `git revert <commit>` + `npx prisma migrate reset` で前 migration 状態に戻す

---

### Step 3: 撤去フェーズ — UI/lib/test を一括削除し build green に戻す

**Depends:** S2
**Model:** Sonnet
**PR title:** `chore: tear down v3.x legacy (gantt-bar 5-state / forecast / weight / daily-report / dual-checkbox / V2-V4 views)`

**Pre-condition checks(必ず最初に実行):**

```powershell
# 残存参照を全件洗い出し、削除/スタブ/削除テストの三分類で作業表を作る
rg "redistributeWeights|\.weight\b|\.started\b|\.completed\b|completedAt|startedAt|actualPct|DailyReport|calcRenderStatus|calcAggregateRenderStatus|forecast" src/ prisma/seed.ts
```

**削除ファイル(Section 1.4.1 の確定削除リスト全件):**

```
src/components/gantt/gantt-bar.tsx
src/components/gantt/hatch-pattern.tsx
src/components/gantt/today-line.tsx
src/components/__tests__/gantt-bar.test.ts
src/lib/weight.ts
src/lib/__tests__/weight.test.ts
src/lib/forecast.ts
src/lib/__tests__/forecast.test.ts
src/lib/progress.ts                              (S4 で新規作成)
src/lib/__tests__/progress.test.ts               (S4 で新規作成)
src/lib/__tests__/daily-report.test.ts
src/lib/__tests__/integration/daily-report-m03.test.ts
src/lib/__tests__/integration/todo-weight-daily.test.ts
src/components/daily-report/                     (ディレクトリごと)
src/components/status-pill.tsx                   (S5 で 4 状態版を新規作成)
src/components/__tests__/status-pill.test.ts     (S5 で新規作成)
src/components/days-pill.tsx
src/components/__tests__/days-pill.test.ts
src/components/tree-view/progress-utils.ts
src/components/timeline-view/                    (V2 全部)
src/components/task-detail/                      (V3 全部)
src/components/dashboard/                        (V4 全部)
src/server/actions/daily-report.ts
src/app/(app)/projects/[id]/daily-report/
src/app/(app)/projects/[id]/tasks/[taskId]/page.tsx    (V3 系、S7 で /progress に再作成)
src/app/(app)/projects/[id]/milestones/                (V2 系、存在すれば)
src/app/(app)/projects/[id]/dashboard/                 (V4 系)
src/app/(app)/_preview/page.tsx                        (v3.x コンポーネント参照)
e2e/daily-report.spec.ts
e2e/dashboard.spec.ts
e2e/task-detail.spec.ts
e2e/timeline.spec.ts
e2e/tree-view.spec.ts
```

**書き直し / 削除を判断するテスト(Section 1.4.2):**

- `src/lib/__tests__/todo.test.ts` — `weight`/`started`/`completed` 参照を削除、v4.0 仕様(`actualStartDate`/`actualEndDate`)で書き直し。新スキーマに合わない記述は削除し、S4 で minimal な smoke test に書き換え
- `src/lib/__tests__/todo-template.test.ts` — 標準 5 件展開ロジックは残るので weight 部分のみ削除
- `src/lib/__tests__/screens.test.ts` — `ProgressBarData` 計算が v3.x 前提のため **削除し S9 の E2E に思想を移管**
- `src/lib/__tests__/integration/db-constraints.test.ts` — `completed=true → started=true` CHECK 制約テスト削除、`actualStartDate` の入力検証テストは S7 で別途追加

**修正ファイル(最小スタブで build green 維持):**

- `src/server/actions/todo.ts`:
  - `import { redistributeWeights } from '@/lib/weight'` 削除
  - `createTodo` から `weight: 0` 削除、`started: false` 削除
  - `redistributeWeights` 呼び出し(transaction 内の `findMany` + `update` ループ)を完全撤去
  - server action は `name` / `startDate` / `endDate` のみ受付に縮小
- `src/server/actions/task.ts`:
  - `redistributeWeights` import / 呼び出し削除
  - `TodoTemplate` 展開時の重み再配分撤去、各 Todo は startDate/endDate のみ持つ
- `src/server/actions/milestone.ts` / `project.ts`:
  - `weight` / `started` / `completed` / `actualPct` 参照があれば全削除
- `src/components/tree-view/tree-view.tsx`:
  - `<GanttBar>` 参照を削除し `<div className="h-6 bg-slate-100 rounded" title="v4.0 reset 中" />` プレースホルダ
  - `<TodayLine>` 参照削除
  - `progress-utils.ts` import 削除
- `src/components/tree-view/{milestone-row,task-row,todo-row}.tsx`:
  - 同様にプレースホルダ化、ステータスバッジは `—` 表示
- `src/app/(app)/projects/[id]/page.tsx`:
  - 暫定プレースホルダ:「v4.0 リセット中です」+ 工程管理(G2)へのリンク(S6 リンク先は S6 で実装、リンクラベルだけ先出し)
- `src/app/(app)/projects/[id]/layout.tsx`:
  - ナビから daily-report / timeline / task-detail / dashboard リンク削除、`G2 工程管理` プレースホルダリンク追加

**Verify:**

```powershell
rg "redistributeWeights|\.weight\b|DailyReport|calcRenderStatus|forecast|completedAt|startedAt|actualPct" src/   # ← 0 件であること
npm run typecheck       # green
npm run lint            # green
npm test                # 残ったテストが green、テスト数は大幅減
npm run build           # green
```

**Exit:** typecheck/lint/test/build がすべて green。プロジェクト一覧 → プロジェクト詳細 までは遷移可能、詳細画面は「v4.0 リセット中」プレースホルダ。コード量は S3 開始前から大幅減(目安: 3,000+ 行削除)。

**Rollback:** PR revert(削除ファイルは git から復元される、置換した stub も同時に戻る)

---

### Step 4: 新規 lib(status / progress / summary / date-utils / timeline 拡張)

**Depends:** S3
**Model:** Sonnet
**PR title:** `feat(lib): v4 status/progress/summary calculation + daysBetween hardening`

**Files (新規):**

- `src/lib/status.ts` — Section 2.1 の `calcStatus`(spec 4.3 表と一致)
- `src/lib/progress.ts` — Section 2.2 の `calcScheduledPct` / `calcTaskActualPct` / `calcWeightedActualPct`
- `src/lib/summary.ts` — Section 2.4 の `buildProjectSummary` / `buildDelaySummary` + フィルター真理表に対応する `matchesFilter(row, filter)`
- `src/lib/__tests__/status.test.ts` — 4 状態 × 境界条件(today = startDate, today = endDate, today < startDate 等)+ spec 4.3 表との 1:1 対応テスト
- `src/lib/__tests__/progress.test.ts` — `today` 内/外、空 ToDo、加重平均(均等期間 / 偏った期間 / 子なし / 子全完了 / 子全未着手 / **子が 0 日タスクのみ**)
- `src/lib/__tests__/summary.test.ts` — 遅延件数 / 最大遅れ日数 / 未着手リスク件数 + フィルター真理表 5×5 テスト

**Files (拡張):**

- `src/lib/date-utils.ts` — `daysBetween(a, b)`(`max(1, ...)`)、`addDays(d, n)`, `clampDate(d, min, max)` を追加(既存にあれば再利用)

**Decisions to lock in this step:**

- 遅延サマリーは **Task のみカウント**(Milestone は除く、Section 2.4)
- `daysBetween` は `max(1, Math.ceil((end - start) / 86400000))` で定義、JSDoc で「両端含む」明示
- `calcStatus` で `actualPct === 0 && hasAnyActualStart === true` の集約特殊ケースは `in-progress` 扱い(Section 2.1 表 6 行目)

**Verify:**

```powershell
npm test src/lib/__tests__/status.test.ts
npm test src/lib/__tests__/progress.test.ts
npm test src/lib/__tests__/summary.test.ts
npm run typecheck
```

**Exit:** 全 lib テストが pass(状態境界 + 加重平均 + 0 日タスク + フィルター真理表すべてカバー)、関数シグネチャがコンポーネント層から呼べる形に確定。

**Rollback:** PR revert

---

### Step 5: 新規 base components + timeline util + G1 layout shell

**Depends:** S4
**Model:** Opus(座標計算 + SVG/div レイアウト)
**PR title:** `feat(ui): v4 base components (timeline util / period bar / today marker / pills / summary cards / G1 layout shell)`

**Files (新規):**

- `src/lib/timeline.ts`(Minor 5 対応): `xForDate(date, projectStart, projectEnd)` / `barOffsetWidth(rowStart, rowEnd, projectStart, projectEnd)` — `period-bar.tsx` と `today-marker.tsx` が同じ座標系を共有
- `src/components/gantt/period-bar.tsx`:
  - Props: `{ startDate, endDate, actualStartDate?, actualEndDate?, today, projectStart, projectEnd }`
  - Section 2.3 の挙動を実装、進捗の塗りつぶしは持たない
  - hover ツールチップ: `予定: MM/DD → MM/DD（N日）` / `実績: ...`
  - **境界テスト**: `actualStartDate < startDate`(先行着手) / `actualEndDate > endDate`(超過完了) / `today > endDate` AND `actualEndDate == null`(進行中で期日超過、実績バーは projectEnd で頭打ち)
- `src/components/gantt/today-marker.tsx`:
  - Props: `{ projectStart, projectEnd, today, showLabel }`
  - `projectStart <= today <= projectEnd` でのみ描画
  - 縦線 1 本 + 上部 `今日(MM/DD)` バッジ
- `src/components/status-pill.tsx`(新規、4 状態):
  - 「完了」緑 / 「進行中」青 / 「遅延」赤 / 「未着手」灰
  - Props: `{ status: Status }`
- `src/components/summary-cards.tsx`:
  - 全体進捗カード: `予定 X%` / `実績 Y%`(数値、実績色付け)
  - 遅延サマリーカード: 遅延中件数 / 最大遅れ日数 / 未着手リスク件数
- `src/components/filter-pills.tsx`:
  - `[すべて, 遅延, 未着手リスク, 進行中, 完了]` のピル群、Section 2.4 のフィルター真理表に従う
  - Props: `{ value, onChange }`

**Files (修正、G1 layout shell):**

- `src/app/(app)/projects/[id]/page.tsx`:
  - 5 列 grid のヘッダ + 空の表(WBS / 工程名 / ステータス / 進捗 / ガント領域)+ サマリーカード placeholder + フィルター placeholder
  - **列幅(Minor 1 対応)**: WBS=`64px` / 工程名=`248px` / ステータス=`90px` / 進捗=`112px` / ガント領域=`1fr`(モック HTML を参照)
  - ガント領域の中身は S8 で配線、S5 では空の `<TodayMarker>` だけ overlay 配置
  - 「進捗入力」リンクのプレースホルダ(Task 行に挿入する想定だが Task 行は S8 で実装)
- `src/app/(app)/projects/[id]/layout.tsx`:
  - ナビ: 「ガント表示 / 工程管理」のトグル(リンク先 G2 は S6 で実装、リンクラベルだけ先出し)

**Verify:**

```powershell
npm test src/components/__tests__/period-bar.test.tsx
npm test src/components/__tests__/today-marker.test.tsx
npm test src/components/__tests__/status-pill.test.tsx
npm test src/components/__tests__/summary-cards.test.tsx
npm test src/components/__tests__/filter-pills.test.tsx
npm test src/lib/__tests__/timeline.test.ts
npm run build
# 手動: G1 を開いて 5 列 grid のヘッダと空表が表示されることを確認
```

**Exit:** 各コンポーネント単独テスト pass、G1 layout shell が描画(中身は空、TodayMarker のみ overlay)、S6/S7 でファイル衝突しない準備が完了。

**Rollback:** PR revert

---

### Step 6: G2 工程管理画面

**Depends:** S5(base components 完成 + G1 layout shell)
**Parallel with:** S7
**Touches:** `src/app/(app)/projects/[id]/manage/` 配下のみ(S5 の `projects/[id]/page.tsx` には触らない、M1 対応)
**Model:** Sonnet
**PR title:** `feat(ui): G2 management screen (project / milestone / task / todo CRUD)`

**Files (新規):**

- `src/app/(app)/projects/[id]/manage/page.tsx`:
  - 認証 + ProjectMember 認可
  - ツリー形式 CRUD レンダリング
- `src/components/management/management-tree.tsx`(ツリー全体)
- `src/components/management/management-row.tsx`(1 行: レベルマーク + 工程名 input + 開始日 + 終了日 + `+`/`×` ボタン)
- `src/components/management/empty-stack.tsx`(モックの「+ 同階層の工程を追加」プレースホルダ)
- 標準 ToDo 5 件展開: Task 追加時に `TodoTemplate` から自動展開(S3 で server action の重み撤去後の状態を活用)

**Server Actions (修正):**

- `src/server/actions/project.ts`(`createProject` / `updateProject` / `deleteProject` 既存活用)
- `src/server/actions/milestone.ts`(同上)
- `src/server/actions/task.ts`(`createTask` で `TodoTemplate` 自動展開、`actualStartDate`/`actualEndDate` は null で作成)
- `src/server/actions/todo.ts`(`createTodo` / `updateTodo` で `name` / `startDate` / `endDate` のみ受付、actual 系は受け付けない)

**重要制約:** G2 では `actualStartDate` / `actualEndDate` は **一切編集不可**(spec v4.0 2.4)

**Verify:**

```powershell
npm test src/components/management
npm run build
# 手動: docker compose up -d & ブラウザで G2 開いて P/M/T/Todo の追加・編集・削除を確認
# 手動: Task 追加で標準 5 件の ToDo が自動展開されるか確認
```

**Exit:** G2 で 4 階層の CRUD が動作。Task 追加で標準 5 件展開。実績日は触れない。

**Rollback:** PR revert

---

### Step 7: G3 進捗入力画面

**Depends:** S5
**Parallel with:** S6
**Touches:** `src/app/(app)/projects/[id]/tasks/[taskId]/progress/` 配下のみ(S5 の `projects/[id]/page.tsx` には触らない、M1 対応)
**Model:** Sonnet
**PR title:** `feat(ui): G3 task-scoped progress input (actualStartDate / actualEndDate)`

**Files (新規):**

- `src/app/(app)/projects/[id]/tasks/[taskId]/progress/page.tsx`:
  - 認証 + 認可 + 該当 Task が ProjectMember に属するか確認
  - Task 配下 ToDo を縦に並べ、各行に着手日/完了日 input + 進捗バッジ(0% / 100%)
- `src/components/progress-input/progress-input-row.tsx`
- `src/components/progress-input/task-progress-summary.tsx`(右側のサマリー: `完了 1/5` / `実績 20%`)
- `src/server/actions/progress.ts`(新規):
  - `updateTodoActualDates(todoId, projectId, { actualStartDate, actualEndDate })`
  - バリデーション: `actualEndDate != null` なら `actualStartDate != null` 必須(完了日があるなら着手日もある)
  - バリデーション: `actualStartDate <= actualEndDate`
- `src/server/actions/__tests__/progress.test.ts`(新規、バリデーション境界)

**Files (修正、G1 への遷移リンクは S5 で配置済みなので **`projects/[id]/page.tsx` は触らない**):**

- `src/app/(app)/projects/[id]/layout.tsx` のナビは S5 でセット済み

**Verify:**

```powershell
npm test src/components/progress-input
npm test src/server/actions/__tests__/progress.test.ts
npm run build
# 手動: G3 で着手日/完了日を入力 → DB 反映確認(G1 は S8 で見えるようになる)
```

**Exit:** G3 でタスク配下 ToDo の着手日/完了日が入力でき、DB に反映される。

**Rollback:** PR revert(actualStartDate/actualEndDate カラムは S2 で追加済みなので残る)

---

### Step 8: G1 ガント表示画面(完成形)

**Depends:** S6, S7
**Model:** Opus(集約レイアウト + フィルター連携 + 5 列 grid 統合)
**PR title:** `feat(ui): G1 gantt main screen (tree + bars + summary cards + filters)`

**Files (新規 / 大改修):**

- `src/app/(app)/projects/[id]/page.tsx`(G1 として完成形に置換):
  - 上部ツールバー(今日 / 表示期間 / すべて展開 / すべて折りたたみ)
  - `<SummaryCards>`(S5 の component)に集計結果を渡す
  - `<FilterPills>` で行フィルタ
  - ガント表(S5 で確定済みの 5 列 grid)に行を埋める
  - Task 行のみ「進捗入力」ボタン → `/projects/[id]/tasks/[taskId]/progress`(G3、S7)へ
- `src/components/gantt/gantt-view.tsx`(新規、テーブル + サマリ + フィルタの組立)
- `src/components/gantt/gantt-row.tsx`(1 階層分の行 = WBS + 工程名セル + StatusPill + 進捗 2 行 + PeriodBar + TodayMarker)
- `src/components/gantt/gantt-progress-cell.tsx`(進捗カラム、`予定 X%` / `実績 Y%` を 2 行で表示、色付け)
- `src/components/gantt/expand-toggle.tsx`(▼/▶)
- `src/components/tree-view/` 配下を G1 用に整理(S3 でスタブ化済みのファイルを `gantt-row.tsx` に統合 or 削除)

**状態管理:**

- 展開状態(`open`)はクライアント state(URL 同期は将来課題)
- フィルター状態はクライアント state、Section 2.4 真理表に従う `matchesFilter` を `src/lib/summary.ts` から import
- フィルター適用時、該当する子を持つ親階層は表示(`hasMatchingDescendant` の単体テスト必須)

**Verify:**

```powershell
npm test src/components/gantt
npm run lint
npm run typecheck
npm run build
# 手動: G1 で全体表示 → 展開/折りたたみ → フィルター 5 種切替 → サマリーカード更新 → 進捗入力ボタンから G3 遷移
# 手動: 5 種類の seed データが正しい色/ピル/バーで描画されるか
```

**Exit:** G1 が完全機能、5 種類のサンプルが視覚確認できる、フィルターとサマリーが正しく連動する。

**Rollback:** PR revert(`projects/[id]/page.tsx` は S5 の layout shell に戻る)

---

### Step 9: E2E + Definition of Done + spec.md 最終整合

**Depends:** S8
**Model:** Sonnet
**PR title:** `test: v4 reset E2E happy path + DoD final check`

**Files (新規、e2e/ 配下に直接):**

- `e2e/v4-happy-path.spec.ts`(Playwright、`playwright.config.ts` の testDir 設定をそのまま使用):
  1. 招待リンクから A2 でパスワード設定 → 自動サインイン
  2. A3 プロジェクト一覧で新規プロジェクト作成
  3. G2 でマイルストーン → タスク → 標準 5 ToDo 自動展開を確認
  4. G3 で 1 ToDo に着手日 + 完了日を入力
  5. G1 でサマリーカード/フィルターが更新されているのを確認
- `e2e/v4-filter.spec.ts`:
  - 各フィルター(すべて/遅延/未着手リスク/進行中/完了)で表示行が変わるか(Section 2.4 真理表を E2E で検証)
- `e2e/v4-visual.spec.ts`(visual snapshot):
  - 5 種類のサンプルが seed データで再現される G1 のスナップショット

**Files (確認のみ、変更なし):**

- `docs/spec.md` v4.0 と実装の最終整合確認(乖離があれば spec を修正、Risk R10)
- `CLAUDE.md` の Phase 表を「Phase 1(v4.0 reset 完了)」に更新

**Memory 更新:**

- `memory/MEMORY.md`: 本 plan を index に追加済み、status を Completed に更新
- `memory/project_spec_v4_reset.md`: status を `done` に更新

**Verify:**

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

**Exit:** 全 CI green、E2E 全 pass、DoD 全項目 ✓、v4.0 リセット完了。`feat/spec-v4-reset` を main にマージ可能。

**Rollback:** E2E のみ失敗の場合、テスト側のバグを優先疑う。コード側は revert しない

---

## 5. Risks & Mitigations

| #   | リスク                                                | 影響                                      | 対策                                                                                                                                                                          |
| --- | ----------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | S3 撤去で削除漏れ・参照漏れ                           | typecheck エラーで build 不可             | S3 の Pre-condition checks で `rg` 全件洗い出し、削除/スタブ/書き直しの三分類で作業表を作る。Section 1.4.2 の確認済み 12+10 ファイルから外れた残存参照は Pre-condition で発見 |
| R2  | DB migration を本番に流すと既存データ消失             | 本番未稼働だが将来事故源                  | Migration SQL を `IF NOT EXISTS`/`IF EXISTS` で冪等化(Section 3.2)。Phase 4 で本番に流す時は blue-green migration を別途設計                                                  |
| R3  | Milestone/Project の期間日数加重平均が想定外          | 集計値が直感と合わない                    | S4 で単体テストを 6 ケース以上(均等期間 / 偏った期間 / 子なし / 子全完了 / 子全未着手 / **子が 0 日タスクのみ**)用意                                                          |
| R4  | G2 で標準 ToDo 5 件展開ロジックが TodoTemplate 不整合 | Task 追加で展開されない                   | S2 seed で TodoTemplate を投入、S6 で展開テストを必須化                                                                                                                       |
| R5  | フィルター適用時の親階層表示ロジックがバグりやすい    | 「該当子なしなのに親が表示」or 逆         | S8 で `hasMatchingDescendant` の単体テストを書く                                                                                                                              |
| R6  | 「未着手リスク」が delayed の subset で混乱           | フィルター F2/F3 で重複表示               | Section 2.4 真理表で F1〜F5 の動作を明示。S4 で `matchesFilter` の真理表テストを書く                                                                                          |
| R7  | 進行中の実績バーが Task 予定終了日で頭打ち(直感違反)  | 期日超過の視認性低下                      | 実績バー終端は `min(today, projectEnd)`(Task.endDate でクランプしない、Section 2.3)。S5 の period-bar 境界テストで `today > Task.endDate AND actualEndDate == null` を必須    |
| R8  | screenshots 大量 untracked のまま PR に混入           | リポ肥大化                                | S1 で `.gitignore` に screenshot パターン追加、`git clean -fd` で除去、PR 前に `git status` 確認                                                                              |
| R9  | M-04 未コミット変更を `stash` で残すと混乱            | 後続 step で誤参照                        | S1 で **破棄一本化**(`git restore .`)。`stash` は使わない                                                                                                                     |
| R10 | spec.md v4.0 と実装の細部乖離                         | spec が信用されなくなる                   | S9 で最終整合確認、乖離発見時は spec を実装に合わせて修正(実装ベース、ただし設計原則は曲げない)                                                                               |
| R11 | M-04 ahead-of-schedule ブランチが残存                 | 後続作業で誤って切り替え                  | S1 Verify に `git branch -D feat/ahead-of-schedule-bar` を含める。remote 側は本人確認後に削除                                                                                 |
| R12 | E2E のディレクトリパスが既存と分離(`tests/e2e/`)      | `playwright.config.ts` を分割管理に変更要 | E2E は **既存の `e2e/` 配下**に新規ファイルを追加(Section 1.5、S9)。`playwright.config.ts` の testDir 設定はそのまま                                                          |
| R13 | フィルター切替の URL state 非同期                     | ブラウザリロードで状態消失                | v4.0 では非対応(Pending、Phase 2 で再検討)。spec/plan には記載しない                                                                                                          |

---

## 6. Open Questions(S4 / S5 / S8 で確定する)

**Q1 (S4 で確定):** `daysBetween` の境界(両端含む / 排他)定義

- 採用案: **`max(1, Math.ceil((end - start) / 86400000))`、両端含む**(`startDate = endDate` の同日タスクで `1` を返す)
- JSDoc に明記し、S4 単体テストで境界(同日 / 1 日差 / 30 日差)を検証

**Q2 (S4 で確定):** 遅延サマリーで Milestone 行をカウントするか

- 採用: **Task のみ**(モックの遅延サマリー件数表記がコンパクトなため、Section 2.4)

**Q3 (S5/S8 で確定):** G1 のタイムライン軸 `projectEnd` の決め方

- 採用案: **`Project.endDate` のみ**(spec v4.0 で「バー延伸」は廃止)
- `today > Project.endDate` の場合、`<TodayMarker>` は非表示(`projectStart <= today <= projectEnd` で判定)
- 進行中の実績バーは `min(today, projectEnd)` でクランプ(Section 2.3)

**Q4 (S2 で確定):** `User.reports` / `Todo.reports` 両方削除後、Prisma で型が壊れないか

- S2 Pre-condition で `npx prisma validate` を必須化。`rg "DailyReport" prisma/schema.prisma` で 0 件確認

---

## 7. Definition of Done

- [ ] `docs/spec.md` v4.0 が main にマージされている
- [ ] `feat/spec-v4-reset` ブランチが main にマージされ、`feat/ahead-of-schedule-bar` は **local と remote 両方から削除**
- [ ] DB: `Todo.weight/started/startedAt/completedAt/completed` カラムが削除、`actualStartDate/actualEndDate` が追加されている
- [ ] DB: `DailyReport` テーブルが削除されている、`User.reports` / `Todo.reports` リレーションが schema.prisma から消えている(`rg "DailyReport" prisma/schema.prisma` が 0 件)
- [ ] Migration SQL が冪等(`IF NOT EXISTS` / `IF EXISTS` 全行付与)
- [ ] `prisma migrate reset` 実行で seed が動き、5 種類のサンプル(完了/順調/遅延進行中/未着手/未着手リスク)が投入される
- [ ] `npm run lint` / `typecheck` / `test` / `build` 全 green
- [ ] `rg "redistributeWeights|\.weight\b|DailyReport|calcRenderStatus|forecast"` の src/ ヒットが 0 件
- [ ] G1 ガント表示で 5 種類のバー描画 + サマリーカード + フィルター(5 種、Section 2.4 真理表通り)が動作
- [ ] G2 工程管理で 4 階層 CRUD + 標準 5 ToDo 自動展開が動作
- [ ] G3 進捗入力でタスク配下 ToDo の着手日/完了日が更新できる
- [ ] G2 → G1 / G3 → G1 の遷移動作確認
- [ ] Playwright E2E ハッピーパス(`e2e/v4-*.spec.ts`)が pass
- [ ] CI(`.github/workflows/ci.yml`)が PR で green
- [ ] `memory/MEMORY.md` に本 plan の completed status を反映
- [ ] CLAUDE.md の Phase 表が v4.0 状態を反映

---

## 8. Rollback Strategy

### Step 単位

各 step は独立 PR、step 順マージ:

- **S1**: 空ブランチ削除(`git branch -D feat/spec-v4-reset`)+ `feat/ahead-of-schedule-bar` を必要なら remote から復元(本人独占ブランチで意義は低い)
- **S2**: PR revert + `npx prisma migrate reset` で旧 schema 再構築(seed.ts も同時 revert)
- **S3〜S8**: PR revert
- **S9**: テスト側だけ revert(コード残す)

### 全体ロールバック(S9 まで完了後に重大不具合発見の場合)

- 本 plan で導入した 9 PR を逆順 revert
- spec.md を v3.3 に戻す revert PR を別途作成
- ただし v3.3 → v4.0 への移行は「迷走」解消が目的のため、全体ロールバックは原則回避。問題箇所のピンポイント修正で対応

### S2 を revert する時の注意

S3〜S8 のコードは v4.0 スキーマ(`actualStartDate`/`actualEndDate`)に依存する。S2 だけ revert すると S3 以降が型エラーで動かなくなる。S2 を revert する場合は **同時に S3 以降の PR も逆順 revert** が必要。

---

## 9. Files Touched (Summary)

| 区分             | Step | パス                                                                                                                                               |
| ---------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spec             | S1   | `docs/spec.md`(commit のみ、既に書き換え済み)                                                                                                      |
| Git config       | S1   | `.gitignore`                                                                                                                                       |
| DB               | S2   | `prisma/schema.prisma`(Todo + User + DailyReport), `prisma/migrations/<ts>_v4_reset/*`, `prisma/seed.ts`                                           |
| 撤去(大量)       | S3   | Section 1.4.1 の確定削除リスト全件 + Section 1.4.2 の修正/書き直しリスト                                                                           |
| Server actions   | S3   | `src/server/actions/daily-report.ts`(削除)、`todo.ts` / `task.ts`(`redistributeWeights` 撤去)                                                      |
| Lib(新規)        | S4   | `src/lib/{status,progress,summary,date-utils,timeline}.ts` + tests                                                                                 |
| Components(新規) | S5   | `src/components/gantt/{period-bar,today-marker}.tsx`, `src/components/{status-pill,summary-cards,filter-pills}.tsx` + tests                        |
| G1 layout shell  | S5   | `src/app/(app)/projects/[id]/page.tsx`(layout のみ、中身は S8)、`layout.tsx`(ナビ)                                                                 |
| Screen G2        | S6   | `src/app/(app)/projects/[id]/manage/page.tsx`, `src/components/management/*`                                                                       |
| Screen G3        | S7   | `src/app/(app)/projects/[id]/tasks/[taskId]/progress/page.tsx`, `src/components/progress-input/*`, `src/server/actions/progress.ts`                |
| Screen G1 完成   | S8   | `src/app/(app)/projects/[id]/page.tsx`(layout shell → 完成形), `src/components/gantt/{gantt-view,gantt-row,gantt-progress-cell,expand-toggle}.tsx` |
| E2E + DoD        | S9   | `e2e/v4-*.spec.ts`(既存 `e2e/` 配下に追加)、`CLAUDE.md`、`memory/MEMORY.md`                                                                        |

---

## 10. Notes

- 本 plan は **Phase 1 範囲内** で完結(A1〜A5 + G1/G2/G3)。Phase 2/3/4 は当初想定どおり後続
- v4.0 リセット後、Phase 5(連鎖予測再導入など)を検討する際は「バーで進捗を塗りつぶす」アプローチには戻らない(spec 10.3)
- M-03/M-04 で書いた `gantt-bar.test.ts` の状態 5/6 テストはすべて削除対象。引き継ぐべきテスト思想は「seed データから 5 種類を視覚確認できる E2E」に置き換える(S9)
- TodoTemplate の標準 5 件展開ロジックは v3.x から `weight` 部分のみ撤去で残せる。Task 追加 server action での自動展開テストを S6 で追加
- screenshots 量産による作業ツリー汚染は今後も再発しやすい。`.gitignore` でガード(S1)
- E2E ディレクトリは **既存 `e2e/`** をそのまま使う。`tests/e2e/` を新設しない(`playwright.config.ts` 一本管理)

---

## Appendix: Opus Adversarial Review Log (2026-05-15)

レビュアー: Opus 4.7(architect agent)
判定: **REVISE** → 反映後 finalize

| #   | Severity | 指摘                                                     | 反映先                                                  |
| --- | -------- | -------------------------------------------------------- | ------------------------------------------------------- |
| C1  | CRITICAL | `calcStatus` 判定順が spec 4.3 表と乖離(集約特殊ケース)  | Section 2.1 関数を再設計                                |
| C2  | CRITICAL | 進行中実績バーが Task 予定終了日で頭打ち(超過視認不可)   | Section 2.3、R7、Q3、S5 境界テスト                      |
| C3  | CRITICAL | schema.prisma の `DailyReport` 参照が 3 箇所(漏れ)       | S2 Files + Pre-condition checks                         |
| C4  | CRITICAL | `weight` 参照 12+10 ファイルが S3 リストから過小評価     | Section 1.4.2、S3 Pre-condition + e2e/screens.test 扱い |
| M1  | MAJOR    | S6/S7 並列で `projects/[id]/page.tsx` を両方触る         | S5 で layout shell、S6/S7 では触らない                  |
| M2  | MAJOR    | Migration SQL が冪等でない                               | Section 3.2 全行 `IF NOT EXISTS`                        |
| M3  | MAJOR    | `daysBetween = 0` フォールバックが実装擬似コードに未反映 | Section 2.2、Q1                                         |
| M4  | MAJOR    | フィルター「未着手リスク」が二重定義で混乱               | Section 2.4 真理表追加                                  |
| M5  | MAJOR    | M-04 未コミット変更を stash か破棄か両論併記             | S1 で破棄一本化、R9 更新                                |
| M6  | MAJOR    | `feat/ahead-of-schedule-bar` ブランチ削除手順がない      | S1 手順 + R11                                           |
| m1  | MINOR    | G1 5 列 grid 列幅未指定                                  | S5 Files                                                |
| m2  | MINOR    | `screens.test.ts` の扱い未明                             | Section 1.4.2、S3                                       |
| m3  | MINOR    | `progress-pill.test.ts` の処理                           | Section 1.4.1 days-pill 名で確認                        |
| m4  | MINOR    | `_preview` ページ撤去漏れ                                | Section 1.4.1 に追加                                    |
| m5  | MINOR    | `xForDate` 共通 util(`timeline.ts`)を S5 で先に作る      | S5 Files + Section 1.5                                  |
| m6  | MINOR    | E2E ディレクトリパス間違い(`tests/e2e/` → `e2e/`)        | S9, R12                                                 |
| m7  | MINOR    | R7 の period-bar 境界テストが C2 と不整合                | R7 書き直し                                             |
