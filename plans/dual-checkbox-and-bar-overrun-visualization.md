# Dual Checkbox + Bar Overrun Visualization

**Status:** Reviewed (Opus adversarial review applied — 6 CRITICAL + 9 MAJOR fixes incorporated)
**Branch:** to be created — `feat/dual-checkbox-bar-overrun`
**Author:** /blueprint
**Created:** 2026-05-14
**Spec amendment:** M-03

---

## 0. Objective (One-line)

ToDo 入力に「開始」チェックボックスを追加し、ガントバーで「本来の予定 / 実績 / 遅延 / 期日超過」が **4 つの色分け状態 × 4 つの視覚化必須項目 (A/B/C/D)** で一目で把握できるようにする。

---

## 1. User-Specified Visual Spec

ユーザーが定めた **4 つの視覚状態**：

| #   | 条件                                      | バー描画                                    |
| --- | ----------------------------------------- | ------------------------------------------- |
| ①   | 予定通り or 前倒し                        | **緑 solid**                                |
| ②   | 遅延しているが予定 to を超えていない      | **オレンジ solid** + **オレンジ斜線ハッチ** |
| ③   | 予定 to を超えている (overdue)            | **オレンジ solid** + **赤線/extension**     |
| ④   | 予定 from を過ぎても **開始されていない** | **赤斜線ハッチ**                            |

**視覚化必須 4 項目 (A/B/C/D):**

- **A.** 本来のスケジュール from-to (= rowStart / rowEnd)
- **B.** 本来終わっているべきパート (= 今日時点の予定進捗位置 = scheduledPct)
- **C.** 現在の進捗 (= 実績 = actualPct)
- **D.** 期日超過なら超過日数 (= today - rowEnd)

入力 UI：

- 「開始」チェックボックスを追加 (完了の左隣)
- 「完了」チェックボックスは開始済みのみ有効化

---

## 2. Canonical State Definitions (A/B/C/D visibility table)

各状態でバー描画区間が **どの A/B/C/D を視覚化するか** を表で定義する。これがすべての実装の根拠であり、Section 5 (GanttBar 描画) はこれを SVG/div で実装するメモに過ぎない。

### バー X 座標系の定義

```
bar drawing range = [barLeftX, barRightX]
  barLeftX  = rowStart の x (= 計画開始位置、不変)
  barRightX = max(rowEnd, today) ※ State 3 / 4 でのみ今日まで延伸
              ただし「タイムライン軸の projectEnd」は不変
              (axis projectEnd は max(planned milestone end, today) で別途算出)

bar 内 % 座標 (実装では幅 100% に正規化):
  actualX        = bar 内での actualPct の位置 (0〜100%)
  scheduledX     = bar 内での scheduledPct の位置 (0〜100%)
  todayX         = bar 内での today の位置 (0〜100%)
  plannedEndX    = bar 内での planned rowEnd の位置 (0〜100%)
                   - 通常時は 100%
                   - State 3 / 4 で延伸時のみ < 100%
```

### State 表

凡例: 区間記法 `[startX..endX]` は bar 内 X 座標、色名は Tailwind class、ハッチは SVG pattern

| State                                                | 条件                                                                                | バー範囲                                                                             | 区間描画 (A/B/C/D 対応)                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0 scheduled** (gray)                               | `!started && !completed && today < rowStart`                                        | rowStart→rowEnd (不変)                                                               | `[0..100%]` gray bg-gray-100 (A は wrapper 幅で表現)                                                                                                                                                                                                                                                  |
| **1 completed** (green)                              | `completed === true`                                                                | rowStart→rowEnd (※ completedAt > rowEnd でも軸内に収め、L4 のマーカーで late を表現) | `[0..100%]` green bg-green-500 (A 全幅。late の場合 plannedEndX に縦マーカー = 区間 D)                                                                                                                                                                                                                |
| **2 delayed-pre-deadline** (orange + orange hatch)   | `started && !completed && today >= rowStart && today <= rowEnd`                     | rowStart→rowEnd (不変)                                                               | `[0..actualX]` orange solid bg-amber-400 (= C 実績)<br>`[actualX..min(scheduledX, todayX)]` orange diagonal hatch (= B が actualPct を上回る差分)<br>`[max(scheduledX, todayX)..100%]` gray bg-gray-100 (= 残り計画)                                                                                  |
| **3 overdue-past-deadline** (orange + red extension) | `started && !completed && today > rowEnd`                                           | rowStart→today (延伸)                                                                | `[0..actualX]` orange solid (= C)<br>`[actualX..plannedEndX]` orange diagonal hatch (= rowEnd まで未消化な計画分)<br>`[plannedEndX..100%]` red bg-red-500 + 斜線 (= D 超過区間)<br>plannedEndX 位置に縦マーカー (= A の to を明示)                                                                    |
| **4 not-started-overdue** (red diagonal full)        | `!started && !completed && today >= rowStart`                                       | rowStart→today (延伸)                                                                | `[0..plannedEndX]` 赤斜線 + 計画区間が見える薄い背景 (= A 視認可能)<br>`[plannedEndX..100%]` 赤 solid + 斜線 (= D 超過分)<br>plannedEndX 位置に縦マーカー (= A の to を明示)<br>※ actualPct=0, scheduledPct は表示しない (started=false により非適用)                                                 |
| **5 ahead-of-schedule** (green + gray) [v3.3 / M-04] | `actualPct >= scheduledPct && actualPct < 100 && today in range` (**集約バー専用**) | rowStart→rowEnd (不変、延伸なし)                                                     | `[0..actualX]` green solid bg-green-500 (= C 前倒し実績)<br>`[actualX..100%]` gray bg-gray-100 (= 残り計画)<br>※ 緑バーが今日線 (scheduledX) を越えて右にはみ出す。<br>**ToDo 構造上不可** (actualPct ∈ {0, 100} 制約のため `calcRenderStatus` から到達しない)。Task / Milestone / Project の集約のみ |

### 状態判定関数（決定的・直交）

```ts
function calcRenderStatus(todo, today): RenderStatus {
  if (todo.completed) return 'completed'
  if (today < todo.startDate) return 'scheduled'
  if (!todo.started) return 'not-started-overdue' // ← started === false かつ today >= startDate
  if (today > todo.endDate) return 'overdue-past-deadline'
  return 'delayed-pre-deadline' // started && !completed && today within range
}
```

5 状態のみで網羅 (completed-late は green 内で `completedAt > rowEnd` フラグで縦マーカーを描画する派生表現とし、別状態にしない)。`completed && !started` は DB CHECK で防止 (Section 4)。

### 親集約 (Task / Milestone) のルール

ToDo は binary だが Task/Milestone は集約 actualPct (= 子の重み付き平均) を持つ。親の状態決定は **独立に再計算** し、子の worst-state を採用しない（critical #7, #16, major #16 対応）:

```ts
function calcAggregateRenderStatus(parent, today): RenderStatus {
  const actualPct = weightedAvg(children) // 既存ロジック
  const scheduledPct = (today - parent.startDate) / (parent.endDate - parent.startDate)

  // 計画期間前
  if (today < parent.startDate) return 'scheduled'

  // 子が 1 つも started でなく、かつ計画開始経過 → not-started-overdue
  if (actualPct === 0 && !anyChildStarted(parent) && today >= parent.startDate)
    return 'not-started-overdue'

  // 全完了
  if (actualPct === 100) return 'completed'

  // overdue: 計画期日超過 かつ 未完
  if (today > parent.endDate) return 'overdue-past-deadline'

  // 進行中
  // ユーザー要件「予定通り or 前倒し = 緑」を厳密実装
  if (actualPct >= scheduledPct) return 'completed' /* green 扱い */
  return 'delayed-pre-deadline'
}
```

`anyChildStarted` は再帰: Task の子 = Todo (started フラグ直接参照)、Milestone の子 = Task (任意 Todo が started なら true)。

---

## 3. Data Model Changes

### 3.1 Schema

```prisma
model Todo {
  // 既存
  id        String   @id @default(cuid())
  taskId    String
  name      String
  weight    Int
  startDate DateTime
  endDate   DateTime
  order     Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  // 追加
  started     Boolean   @default(false)
  completed   Boolean   @default(false)   // 既存
  startedAt   DateTime?
  completedAt DateTime?

  // DB CHECK (Postgres): completed=true は started=true を必須とする (Major #10)
  // CHECK (NOT (completed = true AND started = false))
}

// DailyReport から `started` フィールドは追加しない (Major #15)
// 履歴は Todo.startedAt / completedAt と既存 DailyReport.completed の組み合わせで表現
```

### 3.2 un-start 操作 (Major #9)

ユーザーが誤って started=true にした場合、再度クリックで started=false に戻せる。仕様:

- `startedAt` は **保持** (false に戻しても null にしない)。最初に started=true にした時刻が「最も早い開始候補」として残る
- 再度 started=true にしても `startedAt` は最初の値を保持 (上書きしない)
- 監査履歴は DailyReport の追記レコードで追跡 (新規 started 列は不要)

### 3.3 Migration backfill (Major #8 修正)

```sql
-- 1. NULLABLE で列を追加
ALTER TABLE "Todo"
  ADD COLUMN "started"     BOOLEAN  NOT NULL DEFAULT false,
  ADD COLUMN "startedAt"   TIMESTAMP,
  ADD COLUMN "completedAt" TIMESTAMP;

-- 2. backfill: 既存 completed=true は started も true に
UPDATE "Todo"
   SET "started"     = true,
       "startedAt"   = "createdAt",   -- 推定値 (実際の開始日は不明、createdAt が最古の確定情報)
       "completedAt" = "updatedAt"    -- 最後の更新を完了時刻とみなす (実情に最も近い)
 WHERE "completed" = true;

-- 3. DB CHECK constraint で不正状態を防止
ALTER TABLE "Todo"
  ADD CONSTRAINT "Todo_completed_implies_started"
  CHECK (NOT ("completed" = true AND "started" = false));
```

backfill 値は **推定値** であり、spec.md 改訂履歴 M-03 に「v3.1 以前の startedAt / completedAt は migration 時点の createdAt / updatedAt からの推定であり、実際の開始/完了日時とは異なる可能性がある」と明記する。

---

## 4. Step Breakdown (8 steps with parallel branches)

依存グラフ:

```
S1 (spec+DB+seed) ──┬→ S2 (server actions)  ──→ S5 (daily UI)
                    │                              ↓
                    └→ S3 (progress logic) ────→ S4a (GanttBar core) ─→ S4b (caller wiring)
                                                                          ↓
                                                                      S6 (status/days pills)
                                                                          ↓
                                                                      S7 (tests + E2E)
```

Parallel windows:

- S1 完了後: **S2 と S3 並列**
- S4a 完了後: **S4b と S6 並列** (caller wiring と pill UI が独立)
- S5 は S2 完了後・S4a 完了前でも着手可能 (UI 層の checkbox のみ)

### Step 1: Spec + DB schema + migration + seed (4 状態再現)

**Model:** Sonnet
**PR:** `chore: M-03 spec + dual-checkbox schema + 4-state seed`
**Files:**

- `docs/spec.md` — M-03 改訂を追記 (Section 2 のテーブルを spec.md に組み込み + バー描画ルールの確定事項化)
- `docs/spec.md` 改訂履歴 — 「v3.2 以前は overdue でバーが今日線をまたぐのはバグだったが、v3.2 以降 State 3/4 では意図的に rowEnd を超えてバー延伸する。タイムライン軸 projectEnd は不変」と Major #12 対応
- `prisma/schema.prisma` — Todo.started/startedAt/completedAt
- `prisma/migrations/<ts>_add_started_and_check/migration.sql` — Section 3.3 の SQL (CHECK 含む)
- `prisma/seed.ts` — **4 状態すべてが再現** される ToDo を 1 つずつ含む (Minor #18 対応):
  - State 0 scheduled: startDate=未来
  - State 1 completed: completed=true & 期日内
  - State 2 delayed: started=true, completed=false, today within range
  - State 3 overdue: started=true, completed=false, today > endDate
  - State 4 not-started: started=false, today > startDate

**Verify:**

```bash
npm run db:migrate
docker compose exec postgres psql -U foresight -d foresight -c '\d "Todo"'
docker compose exec postgres psql -U foresight -d foresight -c \
  "INSERT INTO \"Todo\" (id, \"taskId\", name, weight, \"startDate\", \"endDate\", \"order\", completed, started) VALUES ('x','t','n',1,now(),now(),1,true,false);"
# ↑ CHECK constraint で reject されるべき
npm run db:seed
npm run typecheck
```

**Exit:** スキーマ反映、CHECK で不正状態が拒否される、seed で 4 状態を含むデータが投入され、画面で 4 状態が見える状態。

---

### Step 2: Server actions for start/complete

**Depends:** S1
**Parallel with:** S3
**Model:** Sonnet
**PR:** `feat: submitDailyReport handles started + completed`
**Files:**

- `src/server/actions/daily-report.ts`:
  - `submitDailyReport(todoId, projectId, { started, completed })` シグネチャに変更
  - started=true 遷移時に `startedAt = COALESCE(startedAt, now())` (un-start でも保持、再 start でも上書きしない)
  - completed=true 遷移時に `completedAt = now()`
  - completed=true && started=false の入力は 400 (server-side validation、DB CHECK と二重防御)
  - 既存 DailyReport.completed への監査ログは継続
- `src/server/actions/todo.ts` — 既存 Todo 作成は started=false 明示

**Verify:**

```bash
npm run typecheck
npm test src/server/actions
# 手動: started=false で completed=true を送って 400 を確認
```

**Exit:** dual-input が受理され、timestamp が冪等に記録される。不正入力が拒否される。

---

### Step 3: Progress calculation refactor (RenderStatus)

**Depends:** S1
**Parallel with:** S2
**Model:** Sonnet
**PR:** `feat: RenderStatus 5-state + aggregation + real days deviation`
**Files:**

- `src/types/progress.ts`:
  ```ts
  export type RenderStatus =
    | 'scheduled'
    | 'completed'
    | 'delayed-pre-deadline'
    | 'overdue-past-deadline'
    | 'not-started-overdue'
  ```
- `src/lib/progress.ts`:
  - `calcRenderStatus(todo, today)` — Section 2 の判定関数
  - `calcAggregateRenderStatus(parent, today)` — 親 (Task/Milestone) 用、親自身の actualPct/scheduledPct + anyChildStarted を使用
  - `calcRealDaysDeviation(today, rowEnd, actualPct, scheduledPct, durationDays)` — overdue 時は `today - rowEnd` (実日数) を返す。クランプ無し。
- `src/components/tree-view/progress-utils.ts`:
  - `buildTodoProgressData / buildTaskProgressData / buildMilestoneProgressData` が `renderStatus: RenderStatus` も返すように拡張 (Minor #19 対応 = S3 で完結)
- legacy `calcStatus` / `calcDaysDeviation` は @deprecated とし、Step 6 までは UI から両方アクセス可能。S6 完了で削除。

**Verify:**

```bash
npm test src/lib/__tests__/progress.test.ts
npm test src/components/tree-view  # progress-utils 経由テスト
```

**Exit:** RenderStatus 5 状態が純関数で算出でき、Aggregation テーブル (state × child config matrix) でテストされる。

---

### Step 4a: GanttBar core refactor

**Depends:** S3
**Model:** Opus (描画モデルの整合性)
**PR:** `feat: GanttBar canonical state rendering`
**Files:**

- `src/components/gantt/gantt-bar.tsx` の大幅 refactor:
  - 新 props: `renderStatus: RenderStatus`, `plannedEnd: Date` (= rowEnd の別名)
  - **延伸 wrapper**: outer wrapper の width を `barRightX = max(rowEnd, today) when state in (overdue/not-started)` で算出。タイムライン軸 (projectEnd) は不変なので、wrapper の left/width は `xForDate(rowStart, projectStart, projectEnd)` 〜 `xForDate(max(rowEnd, today), projectStart, projectEnd)` で計算
  - **Section 2 の State 表を 1:1 に実装**。各 state ごとに描画する区間を Section 2 と同じ式で記述。
  - 区画は SVG 1 ノードに集約してリレイアウトコスト最小化 (Major R6 対応)
  - plannedEndX 位置に縦マーカー (State 3 / 4)
- Legacy variant (日付プロパティ無し) は保持 (preview/dashboard 互換)

**Verify:**

```bash
npm test src/components/__tests__/gantt-bar.test.ts
# 5 状態 × A/B/C/D 視認テストすべて pass
```

**Exit:** GanttBar が Section 2 の表通りに 5 状態を描画。Layer 3 廃止 (旧 bg-red-700) 済みであることを確認。

---

### Step 4b: GanttBar caller wiring

**Depends:** S4a
**Parallel with:** S6
**Model:** Sonnet (機械的配線)
**PR:** `feat: thread renderStatus through all GanttBar callers`
**Files (caller 6 箇所):**

- `src/components/tree-view/milestone-row.tsx`
- `src/components/tree-view/task-row.tsx`
- `src/components/tree-view/todo-row.tsx`
- `src/components/daily-report/todo-input-row.tsx`
- `src/components/timeline-view/timeline-view.tsx` (V2 マイルストーン詳細)
- `src/components/task-detail/task-detail-view.tsx` (V3 タスク詳細)

各 caller で `progress.renderStatus` と `progress.plannedEnd` を GanttBar に追加で渡す。Snapshot/test の更新は **本 step 内** で同時に行う (Major #14 対応)。

**Verify:**

```bash
npm test
npm run build
```

**Exit:** 全画面で GanttBar が renderStatus 駆動で描画され、テストが green。

---

### Step 5: Daily report UI - dual checkbox

**Depends:** S2 (S4a 不要、UI 層のみ)
**Model:** Sonnet
**PR:** `feat: TodoInputRow dual checkbox`
**Files:**

- `src/components/daily-report/started-checkbox.tsx` — 新規、CompletedCheckbox の双子
- `src/components/daily-report/completed-checkbox.tsx` — `disabled` prop 追加
- `src/components/daily-report/todo-input-row.tsx`:
  - 既存 progress column (88px) を **「開始 / 完了」2 サブカラムに内分** (44px × 2、flex 内で並べる)
  - 5 カラム grid 自体は変えない (Major #13 で grid 列幅変更不可)
  - 開始 → 完了 順序強制 (started=false なら completed checkbox disable)
  - completed=true 時、started 未チェックなら自動 true に (UI 内で対応、server も二重防御)

**Verify:**

```bash
npm test src/components/daily-report
# E2E: 開始だけ → 完了だけ → 両方 の各遷移をテスト
```

**Exit:** 開始/完了の 2 チェックボックスが 88px 内に並び、順序強制が動作する。

---

### Step 6: StatusPill / DaysPill + tree view 配線

**Depends:** S3, S4a (S4b と並列可)
**Model:** Sonnet
**PR:** `feat: status pill 5-state + real days`
**Files:**

- `src/components/status-pill.tsx`:
  - 5 状態に対応 (RenderStatus 駆動):
    - scheduled → 「予定」灰
    - completed → 「完了」緑 (※ 進行中・予定通り も green 集約のため completed pill)
    - delayed-pre-deadline → 「遅延」オレンジ
    - overdue-past-deadline → 「超過」赤
    - not-started-overdue → 「未着」赤 (※ **3 文字以内**で 60px 内に収める。Major #13 対応 — column 幅は変更しない)
- `src/components/days-pill.tsx`:
  - `calcRealDaysDeviation` を使い、overdue 時は実日数 (例: -16日) を表示
  - 既存クランプロジック削除
- `src/components/tree-view/{milestone-row,task-row,todo-row}.tsx`:
  - StatusPill に `renderStatus` を渡す
  - DaysPill に `today`, `rowEnd` を渡し real days を計算

**Verify:**

```bash
npm test src/components/__tests__/status-pill.test.ts
npm test src/components/__tests__/days-pill.test.ts
npm run build
```

**Exit:** ピル 5 状態 + 実日数表示。「未着」ラベルが 60px 列に収まる。

---

### Step 7: Test coverage + E2E

**Depends:** S4b, S5, S6
**Model:** Sonnet
**PR:** `test: dual checkbox + 5-state visual + bar extension`
**Files:**

- `src/lib/__tests__/progress.test.ts` — RenderStatus 5 状態 × 境界条件 (today = rowStart, today = rowEnd, ±1ms)
- `src/components/__tests__/gantt-bar.test.ts` — Section 2 表を直接テスト化 (各 state で A/B/C/D が描画されるか)
- `src/components/__tests__/todo-input-row.test.tsx` — dual checkbox 状態遷移 + validation
- `src/lib/__tests__/integration/daily-report.test.ts` — DB 反映 + CHECK constraint 動作
- E2E (Playwright): 「未開始 → 開始 → 完了」のハッピーパス、未着手 overdue の見た目 visual diff

**Verify:**

```bash
npm test
npm run test:e2e
npm run lint
npm run typecheck
npm run build
```

**Exit:** 全 423 + 新規テストが green、E2E のスナップショットが 4 状態を確認。

---

## 5. Risks & Mitigations (revised)

| #   | リスク                                               | 影響                           | 対策                                                                                                                                                        |
| --- | ---------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Migration backfill の startedAt/completedAt は推定値 | 過去の所要日数集計が不正確     | spec.md 改訂履歴 M-03 に明記。新規 ToDo のみ正確 (Major #8)                                                                                                 |
| R2  | バー延伸がタイムライン軸とずれる可能性               | 軸変動による全行レイアウトずれ | **タイムライン軸 projectEnd は不変**、バー延伸は wrapper の width 拡張のみ。projectEnd は `max(planned milestone end, today)` で 1 度だけ算出 (Critical #4) |
| R3  | StatusPill 60px に「未着手」が入らない               | 列幅変更が他に波及             | 3 文字「未着」ラベルで対応。アイコン併用も可 (Major #13)                                                                                                    |
| R4  | started=false + completed=true の不正状態            | データ整合性                   | **DB CHECK constraint** で防御 (Major #10)、server side validation で二重防御                                                                               |
| R5  | 各 Step の snapshot 更新タイミング                   | 中間 Step で CI 赤             | 各 Step の PR 内で snapshot を同時更新 (Major #14)                                                                                                          |
| R6  | GanttBar 描画レイヤー増加で paint cost               | 行数 100+ で重い               | SVG 1 ノードに区間を集約。region の `<rect>` を増やすだけで再レイアウトしない                                                                               |
| R7  | un-start の startedAt 仕様が誤解されやすい           | 履歴解釈ブレ                   | spec で「startedAt = 最初に started=true にした時刻、un-start でも保持」と明記 (Major #9)                                                                   |
| R8  | 親集約で「any started」だけだと未着手判定が漏れる    | parent の State 4 が出ない     | 集約は actualPct=0 && !anyChildStarted で State 4 判定 (Major #16)                                                                                          |

---

## 6. Open Questions (1 件のみ)

ユーザー要件で決定可能な Q はすべて Section 2/3 に組み込み済み (Critical #5, Minor #17 対応)。残る要確認は 1 件のみ：

**Q1:** completed-late (= `completedAt > rowEnd`) の視覚化方針：

- 案 A: 緑 solid + plannedEnd 位置に縦マーカー (現 plan の採用案)
- 案 B: 別状態 'completed-late' として赤縁取りグリーン
- 案 C: 一律緑のみ (late かどうかは履歴データを別画面で表示)

採用案: **A** (この plan 内では A で進める)。

---

## 7. Definition of Done

- Seed データで 4 状態 (および scheduled の合計 5 状態) すべてがブラウザで視覚確認できる
- 不正状態 (completed=true, started=false) が DB CHECK で reject される
- `npm test` 全 pass (新規テスト含む)
- `npm run typecheck` 全 pass
- `npm run lint` クリーン
- `npm run build` 成功
- E2E Playwright で 4 状態の visual diff が記録される
- `docs/spec.md` の改訂履歴に M-03 (dual checkbox + 4-state visual) を追記
- `memory/MEMORY.md` にこの plan を index 追加

---

## 8. Rollback Strategy

各 Step が独立 PR、Step 順マージ:

- **S1 (DB)**: migration を reset (`npx prisma migrate reset`、ローカル DB のみ)。CHECK constraint は migration revert で消える
- **S2-S6**: PR revert
- **S7 のみ失敗**: テスト側のバグを優先疑う。コード側は revert しない

---

## 9. Files Touched

| ファイル                                                     | Step | 目的                                                                 |
| ------------------------------------------------------------ | ---- | -------------------------------------------------------------------- |
| `prisma/schema.prisma`                                       | S1   | started/startedAt/completedAt 追加                                   |
| `prisma/migrations/<ts>_add_started_and_check/migration.sql` | S1   | backfill + CHECK constraint                                          |
| `prisma/seed.ts`                                             | S1   | 4 状態の ToDo を seed                                                |
| `docs/spec.md`                                               | S1   | M-03 改訂 + Section 2 table を spec として組み込み                   |
| `src/server/actions/daily-report.ts`                         | S2   | dual checkbox 入力受付                                               |
| `src/server/actions/todo.ts`                                 | S2   | started=false 明示                                                   |
| `src/types/progress.ts`                                      | S3   | RenderStatus enum                                                    |
| `src/lib/progress.ts`                                        | S3   | calcRenderStatus / calcAggregateRenderStatus / calcRealDaysDeviation |
| `src/components/tree-view/progress-utils.ts`                 | S3   | renderStatus を return に追加                                        |
| `src/components/gantt/gantt-bar.tsx`                         | S4a  | Section 2 表に従う 5 状態描画                                        |
| GanttBar callers (×6)                                        | S4b  | renderStatus + plannedEnd 配線 + snapshot                            |
| `src/components/daily-report/started-checkbox.tsx`           | S5   | 新規                                                                 |
| `src/components/daily-report/completed-checkbox.tsx`         | S5   | disabled prop                                                        |
| `src/components/daily-report/todo-input-row.tsx`             | S5   | dual checkbox 88px 内分                                              |
| `src/components/status-pill.tsx`                             | S6   | 5 状態対応、「未着」ラベル                                           |
| `src/components/days-pill.tsx`                               | S6   | クランプ廃止                                                         |
| `src/components/__tests__/*.{ts,tsx}` + e2e                  | S7   | 全 update + 新規 + Playwright                                        |

---

## 10. Notes

- 「共有タイムライン」「5 カラム grid」「Layer 3 廃止 (status 色ハッチ)」と矛盾しない。本 plan は L4 (overdue 赤拡張) と L5 (not-started 赤斜線) を **追加** することで 4 状態を実現する
- v3.1 以前で「バーが今日線をまたぐのはバグ」と判断した case は**カラム不整合**による副作用であり、本 plan の「意図的な overrun 表示」とは別物。spec M-03 で区別を明記
- Phase 1 / Phase 2 範囲内で完結。インフラ変更は不要
