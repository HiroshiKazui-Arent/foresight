# Today線セントリング + ガントバー overdue 赤塗り 実装計画

**作成日:** 2026-05-14
**ブランチ:** `feat/shared-timeline-today-line-hatching` (現状のまま継続)
**想定 PR 数:** 1 (単一ブランチ・単一 PR)
**全ステップ完了見込み:** 半日〜1日

---

## 0. 目的 (objective)

ユーザー指摘 3 点を 1 PR で解決する:

1. **プロジェクト一覧画面の今日線:** 赤の縦線が「今日 M/D」バッジテキストの **中心** に来るようにする。
2. **ツリー表示画面 (TreeView):** 同じセントリングを適用する。
3. **ガントバーの定義を厳密化:**
   - **斜線エリア:** 遅延が生じている場合のみ。当初予定の「今日まで終わっているべきパート」だが未完了の部分。**斜線の右端は今日線を超えてはならない。**
   - **赤色塗りエリア:** 当初の予定デッドラインを超えて未完了の部分は、斜線ではなく **ソリッド赤** で埋める。

---

## 1. 背景 (context for cold-start agent)

### 1.1 リポジトリ前提

- Next.js (App Router) + TypeScript + React 19、Prisma + PostgreSQL。
- `CLAUDE.md` と `docs/spec.md` (v3.0) が単一情報源。
- 現ブランチ `feat/shared-timeline-today-line-hatching` で既に共有タイムライン + 斜線ハッチング機能が実装済み。本 PR はそれを **微修正・厳密化**する位置づけ。
- 開発サーバー: `docker compose up -d` または `npm run dev` (postgres は Docker)。
- CI 等価チェック: `npm run lint && npm run typecheck && npm test && npm run build`。

### 1.2 仕様の invariant (動かしてはならない)

`docs/spec.md` 2.2 節「1本の今日線で全てを語る」:

> ガントチャート上で、今日線は以下の3役を兼ねる:
>
> - 「現在の日付」
> - 「各バー上の予定%位置」(時間軸上の位置と完全に一致)
> - 「実績との境界」

`docs/spec.md` 4.1: `予定進捗% = (今日 - 開始日) / (期日 - 開始日) × 100`

**幾何学的帰結:** バー内の `scheduledPct%` 位置は、親グリッドの今日線 X と必ず一致する (バーの `rowStart→rowEnd` と `xForDate` ロジックが同じ線型変換なため)。これは数学的に保証されており、本 PR で破ってはならない。

### 1.3 既存実装サマリ (確認済み)

| ファイル                                          | 役割                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/components/gantt/timeline-utils.ts`          | `xForDate`, `barOffsetWidth`, `monthBoundaries` — タイムゾーン非依存 (UTC ベース)。       |
| `src/components/gantt/gantt-bar.tsx`              | 3層 (実績色 / ハッチング / 未来予定灰) でバーを描く。`useId` で SVG pattern id を一意化。 |
| `src/components/gantt/timeline-header.tsx`        | 月ラベル + 今日バッジ。バッジは `left: ${todayX}%` のみ (左端基準)。                      |
| `src/components/gantt/today-line.tsx`             | 縦線オーバーレイ。`isValidTodayX` で 0〜100 範囲チェック。                                |
| `src/app/(app)/projects/project-list.tsx`         | プロジェクト一覧。今日線 + バッジを `translate-x-1` で線の右側に表示中 (これが論点)。     |
| `src/components/tree-view/tree-view.tsx`          | ツリービュー。`TimelineHeader` + `TodayLine` をオーバーレイ。                             |
| `src/components/tree-view/milestone-row.tsx`      | マイルストーン行。`GanttBar` に `projectStart/projectEnd/rowStart/rowEnd` を渡す。        |
| `src/components/tree-view/task-row.tsx`           | タスク行。`GanttBar` を同様に呼ぶ。                                                       |
| `src/components/tree-view/todo-row.tsx`           | ToDo 行。`GanttBar` を同様に呼ぶ。                                                        |
| `src/components/timeline-view/timeline-view.tsx`  | マイルストーン詳細 (V2)。`calcTodayLine` で別ロジックを使用 (milestoneScope ベース)。     |
| `src/components/task-detail/task-detail-view.tsx` | タスク詳細 (V3)。`GanttBar` を使う。                                                      |

### 1.4 GanttBar の現状シグネチャ (重要)

```tsx
type GanttBarProps = {
  actualPct: number
  scheduledPct: number
  status: ProgressStatus
} & (
  | { projectStart: Date; projectEnd: Date; rowStart: Date; rowEnd: Date }
  | { projectStart?: never; projectEnd?: never; rowStart?: never; rowEnd?: never }
)
```

日付プロパティは **4 つ揃えるか全部省略** の discriminated union。

### 1.5 GanttBar の現状呼び出し箇所 (Opus 対敵レビューで確認済み)

| 呼出ファイル                                      | 行          | 日付クォーテット渡してる? |
| ------------------------------------------------- | ----------- | ------------------------- |
| `src/components/tree-view/milestone-row.tsx`      | L130        | **yes**                   |
| `src/components/tree-view/task-row.tsx`           | 要確認      | **yes**                   |
| `src/components/tree-view/todo-row.tsx`           | 要確認      | **yes**                   |
| `src/app/(app)/projects/project-list.tsx`         | L184        | **no** (全幅 100%)        |
| `src/components/timeline-view/timeline-view.tsx`  | L41,133,191 | **no** (全 3 箇所)        |
| `src/components/task-detail/task-detail-view.tsx` | L155,387    | **no** (全 2 箇所)        |
| `src/app/(app)/_preview/page.tsx`                 | 4 箇所      | **no** (プレビュー)       |

**設計判断 (Opus 対敵レビュー後):** 「日付なし variant にも `today` を渡せる」緩い設計より、**全 caller に `rowStart/rowEnd/today` を必須化する** 厳格設計を採る。これにより:

- overdue 赤レイヤーが全画面で動作する。
- discriminated union が一意な「日付あり」一本になり、prop の意味が明確。
- 「日付なし」variant は **`_preview/page.tsx` などプレビュー用にのみ残す** (本番コンポーネントには使わない)。

各 caller では、バーが全幅 (100%) のときは `projectStart=rowStart, projectEnd=rowEnd` を渡せば `barOffsetWidth` の結果が `left=0, width=100` になり、現状の見た目を保つ。

---

## 2. ゴール状態 (exit criteria for the whole PR)

- [ ] プロジェクト一覧 (`/projects`) で「今日 M/D」バッジの中心に赤縦線が貫いている。
- [ ] ツリー表示 (`/projects/[id]`) でも同じセントリング。
- [ ] 任意のガントバーで:
  - **斜線エリアの右端は必ず今日線位置と一致または左側** (今日線より右に斜線は出ない)。
  - 今日 > rowEnd かつ未完了の場合、`(actualPct → 100)` のギャップは **ソリッド赤 (例: `#dc2626` / `bg-red-600`) で塗りつぶし**、斜線は使わない。
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` が全て通る。
- [ ] 手動ブラウザ確認で全画面 (プロジェクト一覧 / ツリー / V2タイムライン / V3タスク詳細 / ダッシュボード) に視覚回帰がない。
- [ ] 既存単体テスト (`gantt-bar.test.ts`, `timeline-utils.test.ts`, `timeline-header.test.ts`, `today-line.test.ts`) は全 green。
- [ ] 新規テストで「斜線右端 ≤ 今日線位置」「today > rowEnd で overdue 赤レイヤー描画」を assert。

---

## 3. ステップ構成 (4 steps, serial)

依存グラフ:

```
Step 1 (badge centering, CSS only) ─────┐
                                         │
Step 2 (GanttBar semantics) ─────────────┼──> Step 4 (browser QA)
                                         │
Step 3 (wire `today` to call sites) ─────┘
```

Step 1 は Step 2/3 と独立で並列着手可能だが、単一ブランチで連続コミットするため **直列実行を推奨**。

---

### Step 1: 今日バッジを赤線の中央に揃える

#### 1.1 Self-contained context brief

cold-start agent が読むべき情報:

- `src/app/(app)/projects/project-list.tsx` の **L160〜L174**: 現在 `translate-x-1` で線の右側に置いている。バッジは `pointer-events-none absolute top-0 z-10 rounded bg-red-500 ...` で線と同じ `left: ${todayX}%`。
- `src/components/gantt/timeline-header.tsx` の **L46〜L55**: 同じく `left: ${todayX}%` でバッジを置いているが、赤線 (TodayLine) はオーバーレイで別 z-index。テキストは線の右側にぶら下がる形。
- セントリング手法: Tailwind v4 で `translate-x-[-50%]` または `-translate-x-1/2`。`left: ${todayX}%` と組み合わせて中央寄せ。

#### 1.2 タスク

1. `project-list.tsx` のバッジ要素から `translate-x-1` を削除、`-translate-x-1/2` を付ける。
2. `timeline-header.tsx` のバッジ要素にも `-translate-x-1/2` を付ける。
3. **`timeline-header.tsx` の `formatTodayLabel` を `getMonth/getDate` から `getUTCMonth/getUTCDate` に変更** (CLAUDE.md 既定の TZ ハンドリング規約に合わせ、`project-list.tsx` L172 の `getUTCMonth() + 1 / getUTCDate()` と統一)。これにより SSR (UTC) と CSR (JST) で日付がずれる境界 (JST 08:00〜09:00 = UTC 23:00〜00:00 翌日) でも一貫表示。
4. 既存テスト `timeline-header.test.ts` `formatTodayLabel` の入力 `Date` は `new Date(2025, m-1, d)` (ローカル TZ) のため、`getUTCMonth/getUTCDate` 化すると **既存テストが落ちる**。テストヘルパを `new Date(Date.UTC(2025, m-1, d))` に書き換えること (CLAUDE.md の `monthBoundaries` テスト同様の修正)。
5. プロジェクト期間の左端 (`todayX = 0`) / 右端 (`todayX = 100`) でバッジが画面外にはみ出さないかを確認 (端の場合は `overflow-hidden` 親要素により切れる) — 仕様上許容。バッジは `-translate-x-1/2` で半分は左にはみ出すため、`overflow-hidden` クリッピングは想定動作。

#### 1.3 検証コマンド

```bash
npm run typecheck
npm test -- timeline-header
npm run build
```

ブラウザ:

- `/projects` を開き、各カードで赤線がバッジテキストの中央を貫いていること。
- 任意のプロジェクトに入り `/projects/[id]` のヘッダーでも同じこと。

#### 1.4 Exit

- [ ] 2 ファイル変更 (約 4 行差分)。
- [ ] typecheck + 既存テスト全 green。
- [ ] ブラウザで両画面確認。

#### 1.5 Rollback

`git revert` 1 コミットで済む。視覚 CSS のみで挙動変更なし。

---

### Step 2: GanttBar — 斜線 today クランプ + overdue 赤塗り

#### 2.1 Self-contained context brief

**現状の問題:**

- 現在の `gantt-bar.tsx` は `actualPct → scheduledPct` 区間を斜線 (SVG pattern) で描く。`scheduledPct` は呼び出し側 (server) で計算され、バーに渡される。
- **invariant (spec 2.2 + 4.1):** バー内 `scheduledPct%` 位置 = 親グリッドの今日線 X (`xForDate(today, rowStart, rowEnd)`)。これは数学的に成立。
- **問題ケース:**
  - **today > rowEnd:** `scheduledPct` は 100 にクランプされている。`actualPct → 100` のギャップは現状 **斜線**。仕様改訂: ここは **ソリッド赤** にする。
  - **計算ドリフト/丸め誤差で `scheduledPct > todayInBar` が出る可能性:** ユーザー要件「斜線が今日線の右側に絶対来ない」を守るため、ハッチング右端を明示的に `min(scheduledPct, todayInBar)` でクランプする。

**新セマンティクス (確定版):**

```
todayInBar = xForDate(today, rowStart, rowEnd)  // 0〜100 (クランプ済み)
isOverdue = (status !== 'completed')
            && (today.getTime() > rowEnd.getTime())  // 厳格大なり: today === rowEnd は overdue 扱いせず
            && (cActual < 100)

// 各レイヤーの x 区間 (左端 → 右端、%):
Layer 1 (実績色):       [0, cActual]
Layer 2 (斜線 SVG):     !isOverdue && gapWidth > 0
                        → [cActual, min(cScheduled, todayInBar)]
Layer 3 (overdue 赤):   isOverdue
                        → [cActual, 100]
Layer 4 (未来予定灰):   !isOverdue && futureWidth > 0
                        → [max(cScheduled, todayInBar), 100]   ← 左端も today クランプ
```

**排他ルール (Critical):**

- `isOverdue === true` のとき **Layer 2 (斜線) と Layer 4 (灰) は描画しない** (条件付きレンダリングでガード)。Layer 3 だけが `cActual → 100` を塗りつぶす。
- `isOverdue === false` のとき Layer 3 は描画しない。Layer 2 と Layer 4 が今日線位置で接続する。

**境界値の挙動 (明文化):**

- `today === rowEnd` (期日ちょうど): `today > rowEnd` が false → overdue にならない。Layer 2 (斜線) は `cActual → cScheduled` (= 100) で残る。これは仕様 4.1 で「予定% = 100%」になる瞬間と一致するため妥当。
- `today < rowStart` (未着手): `xForDate` クランプにより `todayInBar = 0`、Layer 2 は幅 0 (`cScheduled = 0` なはず)、Layer 4 が全幅 (0〜100) 灰塗り。
- `cActual >= 100`: `isOverdue` 不成立。Layer 1 が全幅、Layer 2/3/4 描画なし。

**ドリフトケース対策:**

- `cScheduled` (server 計算) と `todayInBar` (client 計算) が浮動小数誤差で 0.01% ずれる可能性。Layer 2 の右端を `min(cScheduled, todayInBar)`、Layer 4 の左端を `max(cScheduled, todayInBar)` でクランプし、両者の間に隙間や重複が出ないよう保証する。
- 加えて、`Math.abs(cScheduled - todayInBar) < 0.5` (0.5%) のときは両者を `todayInBar` に揃える (描画スリバー回避)。

**新シグネチャ:**

```tsx
// 日付あり variant: rowStart/rowEnd/today を必須化
type GanttBarPropsWithDates = {
  actualPct: number
  scheduledPct: number
  status: ProgressStatus
  projectStart: Date
  projectEnd: Date
  rowStart: Date
  rowEnd: Date
  today: Date // required
}

// 日付なし variant: プレビュー専用 (_preview/page.tsx 等)
type GanttBarPropsLegacy = {
  actualPct: number
  scheduledPct: number
  status: ProgressStatus
  projectStart?: never
  projectEnd?: never
  rowStart?: never
  rowEnd?: never
  today?: never
}

type GanttBarProps = GanttBarPropsWithDates | GanttBarPropsLegacy
```

「日付なし」variant では `isOverdue = false`, Layer 2 の右端クランプも掛からない (従来挙動)。Step 3 で本番 caller を全て「日付あり」variant に移行する。

#### 2.2 タスク

1. `src/components/gantt/gantt-bar.tsx`:
   - 型シグネチャを上記 2 variants に変更 (Section 2.1 参照)。
   - `todayInBar` を計算: `today && rowStart && rowEnd` が揃う日付あり variant のときのみ `xForDate(today, rowStart, rowEnd)`。未指定なら `null` (Legacy variant)。
   - `isOverdue` 判定 (`today.getTime() > rowEnd.getTime() && status !== 'completed' && cActual < 100`) を関数の冒頭で計算。
   - **Layer 2 (SVG 斜線):** 既存の `gapWidth > 0` ガードに加え **`!isOverdue` ガードも必須**。幅は `Math.max(0, hatchEnd - cActual)` ここで `hatchEnd = todayInBar !== null ? Math.min(cScheduled, todayInBar) : cScheduled`。
   - **Layer 3 (overdue 赤) 追加:** `isOverdue` のときのみレンダリング。`position: absolute; left: ${cActual}%; width: ${100 - cActual}%; height: 100%`、`className="bg-red-700"` (既存 `bg-red-500` の実績バーと区別するため濃いシェード)。`aria-label` を別途持たせる必要はない (親 `role="img"` 側に統合)。
   - **Layer 4 (未来灰) 変更:** 既存 `futureWidth > 0` ガードに加え **`!isOverdue` ガードも必須**。左端を `Math.max(cScheduled, todayInBar ?? cScheduled)` でクランプ。幅は `100 - futureLeft`。
   - `aria-label` 改善: `isOverdue` のとき末尾に `" (期日超過)"` を追加。例: `"進捗バー: 遅延 実績50% (期日超過)"`。
2. `src/components/__tests__/gantt-bar.test.ts`:
   - **新規テストケース (8 件):**
     1. `today > rowEnd && actualPct=60 && status='delayed'` → `bg-red-700` 含む、`url(#hatch` 含まない、`bg-gray-100` 含まない、`aria-label` に `(期日超過)` 含む。
     2. `today > rowEnd && actualPct=60 && status='warning'` → 同上 (status 不問で overdue 描画される)。
     3. `today > rowEnd && actualPct=100` → `bg-red-700` 含まない (cActual=100 で overdue 不成立)、Layer 1 のみ。
     4. `today > rowEnd && status='completed'` → `bg-red-700` 含まない、`bg-green-500` 全幅。
     5. `today === rowEnd && actualPct=80 && status='delayed'` → 境界値: overdue 不成立、斜線残る、赤レイヤーなし。
     6. `today === rowStart && actualPct=0` → 斜線なし、灰全幅。
     7. **ドリフトケース:** scheduledPct=80, today を rowEnd 直前に置き todayInBar≈60 → 斜線右端は 60% でクランプ (`width:40%` でなく `width:60%`... 実際は計算が複雑なので XML html.toContain でレイヤー存在のみ assert)。
     8. **Legacy variant (`today` 等なし):** 現挙動を維持 (既存テストが全 green であること自体が保証)。
   - 既存テストヘルパ `makeBar` のデフォルト props に `today: new Date('2024-04-01')` (rowStart=Jan-1, rowEnd=Jun-30 の真ん中) を追加。これで既存テストの semantics が「今日線がバー中央」のケースに変わる。既存 assert (`width:50%`, `width:30%`, `bg-gray-100`, `url(#hatch` 等) が引き続き通ることを確認。
   - **Legacy variant 用ヘルパ `makeBarLegacy`** を新規追加し、`today` ありテストとなしテストを分離。
3. SVG pattern ID `useId` ベースなので新レイヤー (赤) は SVG ではなく `<div>` で描き、pattern ID 衝突は発生しない。

#### 2.3 検証コマンド

```bash
npm run typecheck
npm test -- gantt-bar
npm run lint
```

#### 2.4 Exit

- [ ] `gantt-bar.tsx` 約 40〜70 行差分。
- [ ] `gantt-bar.test.ts` で新規 8 ケース追加 (2.2 リスト)、既存全 green。
- [ ] typecheck OK (新 discriminated union が破綻していない)。
- [ ] lint OK。

#### 2.5 Rollback

`git revert` で Step 2 を取り消すと Step 3 の caller 側で「`today` 等が宣言されているが GanttBar 旧型は受け付けない」型エラーになるため、**Step 3 と同時に revert** する必要がある。コミットを 1 つにまとめるか、PR 単位で revert する設計を推奨。

#### 2.6 Risk / Anti-pattern guard

- **アンチパターン: 浮動小数比較のずれ** — `cScheduled === todayInBar` の等価判定は使わない。`Math.min` / `Math.max` でクランプして暗黙的に解決。Layer 2 右端と Layer 4 左端の両方に対称的に適用。
- **アンチパターン: 斜線レイヤーと赤レイヤーの z-index 競合** — どちらも `position: absolute` で `left` が排他、かつ `!isOverdue` ガードで条件付きレンダリングなので物理的に共存しない。重複描画ゼロを保証。
- **アンチパターン: `status === 'delayed'` を overdue 判定に流用** — spec 4.4 上 `delayed` は乖離 -20% 未満であって「期日超過」ではない。必ず `today > rowEnd` を条件に使う。
- **3 種類の赤の意味分離 (Opus 対敵レビュー指摘):**
  - Layer 1 status=`delayed` → `bg-red-500` (実績バー、進行中だが遅れている)
  - Layer 2 status=`delayed` の斜線 → `#ef4444` (実績と予定のギャップ、本来今日までに終わっているべき分)
  - Layer 3 overdue → `bg-red-700` (期日を超過してなお未完の部分)
  - 視覚的に: 「明るい赤 → 斜線赤 → 暗い赤」のグラデーション。aria-label に `(期日超過)` を追記し、screen reader でも区別可能にする。
- **invariant 視覚消失 (Opus 対敵レビュー指摘):** isOverdue のとき Layer 3 (赤) が `cActual → 100` を覆うため、本来「予定% 位置 = 今日線位置」を視覚的に示していた `cScheduled` 位置の境界線が消える。これは仕様上の「今日線3役」のうち「予定%位置」役が overdue レイヤーで隠れることを意味するが、**今日線は親グリッド側で別途描かれている**ため (Step 1 のセントリング、`TodayLine.tsx`)、視認性は損なわれない。テスト・QA で「赤レイヤーの left=`cActual` で塗り始めること」「親グリッドの今日線が赤レイヤーを縦断していること」を確認する。
- **Date 比較スタイル統一:** `today.getTime() > rowEnd.getTime()` を採用 (`Date > Date` は TS valueOf 経由で動くが明示的)。プラン全文でも `.getTime()` 比較に統一。

---

### Step 3: 全 GanttBar 呼び出し箇所を「日付あり variant」に移行

#### 3.1 Self-contained context brief

Step 2 で discriminated union を厳格化 (`today: Date` を required 化) したため、**現在 `projectStart/projectEnd/rowStart/rowEnd` を渡していない 6 箇所の caller を移行**する必要がある。各 caller には `today: Date` が既に prop / scope 内で利用可能。

**移行対象 (Opus 対敵レビューで確認した実際の呼び出し箇所):**

| #   | ファイル                                               | 行        | 状態      | 移行戦略                                                                                                                                                  |
| --- | ------------------------------------------------------ | --------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/components/tree-view/milestone-row.tsx`           | L130      | OK (既存) | `today={today}` を追加するだけ                                                                                                                            |
| 2   | `src/components/tree-view/task-row.tsx`                | (要 grep) | OK (既存) | 同上                                                                                                                                                      |
| 3   | `src/components/tree-view/todo-row.tsx`                | (要 grep) | OK (既存) | 同上                                                                                                                                                      |
| 4   | `src/app/(app)/projects/project-list.tsx`              | L184      | **新規**  | `projectStart=project.startDate, projectEnd=project.endDate, rowStart=同, rowEnd=同, today={today}` を追加 (バーは全幅維持)                               |
| 5   | `src/components/timeline-view/timeline-view.tsx` L41   | L41       | **新規**  | マイルストーン サマリバー: `projectStart=rowStart=milestone.startDate, projectEnd=rowEnd=milestone.endDate, today={today}`                                |
| 6   | `src/components/timeline-view/timeline-view.tsx` L133  | L133      | **新規**  | TaskRow バー: `projectStart=milestoneScope.startDate, projectEnd=milestoneScope.endDate, rowStart=task.startDate, rowEnd=task.endDate, today={today}`     |
| 7   | `src/components/timeline-view/timeline-view.tsx` L191  | L191      | **新規**  | TodoList バー: `projectStart=taskScope.startDate, projectEnd=taskScope.endDate, rowStart=todo.startDate, rowEnd=todo.endDate, today={today}`              |
| 8   | `src/components/task-detail/task-detail-view.tsx` L155 | L155      | **新規**  | バーが何を表すか実装読んで決定 (Task 全体? ToDo?) し、対応する日付を渡す                                                                                  |
| 9   | `src/components/task-detail/task-detail-view.tsx` L387 | L387      | **新規**  | 同上                                                                                                                                                      |
| 10  | `src/app/(app)/_preview/page.tsx`                      | 4 箇所    | (任意)    | **Legacy variant を残す** (デモ用)、ただし 1 箇所だけ「overdue ケース」のフィクスチャ (rowEnd < today, actual<100) を追加し赤レイヤーを視覚確認可能にする |

**注意:** `_preview/page.tsx` の既存 4 箇所はそのまま Legacy variant を使う (テストフィクスチャ価値あり)。新規 5 箇所目に「overdue 例」を追加する。

#### 3.2 タスク

1. `git grep -n "<GanttBar"` で全呼び出し箇所を再確認し、上表と差分がないかチェック。差分があれば本 plan 表を更新。
2. **`/dashboard` 配下の `GanttBar` 利用を事前確認** (Opus 対敵レビュー指摘): `git grep "GanttBar" src/components/dashboard/` で利用有無を確認。利用あれば本表に追加し移行対象に含める。
3. 各 caller で日付プロップを追加 (上表の戦略どおり)。
4. `task-detail-view.tsx` は事前に Read で内容把握 (どのデータをバーで表すか) してから対応日付を渡す。
5. `_preview/page.tsx` の overdue 例フィクスチャ追加。
6. **既存テスト追従:** `tree-view-shared-timeline.test.tsx`, `todo-row.test.tsx` などが prop 変更で落ちるなら追従修正 (`today` を渡す)。
7. **型エラー確認:** `npm run typecheck` で discriminated union 厳格化により Legacy variant でない caller が `today` 必須エラーを出さないこと。

#### 3.3 検証コマンド

```bash
npm run typecheck
npm test
npm run build
```

#### 3.4 Exit

- [ ] 全 caller で `today` 渡し完了 (grep で `<GanttBar` を全件確認)。
- [ ] `npm test` の全 suite green。
- [ ] `npm run build` 成功 (Next.js プロダクションビルド)。

#### 3.5 Rollback

Step 3 のみ revert すると Step 2 の厳格化された型定義により本番 caller が型エラーになる。**Step 3 を revert するときは Step 2 も同時に revert** すること (2 コミットを 1 revert PR にまとめる)。または Step 2 の Legacy variant を一時的に本番 caller 用に緩める応急修正で凌ぐ。

---

### Step 4: Playwright + 視覚 QA + 最終 regression

#### 4.1 Self-contained context brief

ユーザーは前セッションで「すべての画面でイシューが発生していない状態」を Stop hook で強く要求している。プロジェクト一覧と詳細画面の視覚乖離 (赤線・日付バッジの長さ) で過去にフィードバックを受けた経緯あり。

#### 4.2 タスク

1. `docker compose up -d` でアプリ + DB 起動 (既起動ならスキップ)。
2. **Playwright MCP が利用可能な場合** (`mcp__plugin_everything-claude-code_playwright__browser_navigate` 等):
   - `/login` → `admin@example.com / password123` でサインイン。
   - `/projects` を開き、`browser_take_screenshot` で全カード表示を取得。赤線がバッジ中央を貫くか目視。
   - 任意のプロジェクトに入り `/projects/[id]` のヘッダー / マイルストーン行 / タスク行で同じ確認。
   - マイルストーン詳細 `/projects/[id]/milestones/[mid]` (V2)、タスク詳細 `/projects/[id]/tasks/[tid]` (V3)、ダッシュボード `/dashboard` も巡回。
   - `/_preview` を開いて overdue フィクスチャ (Step 3.2.5 で追加) で赤レイヤー視認。
   - ブラウザコンソール (`browser_console_messages`) に新規エラーがないこと。
3. **Playwright MCP 不在 / 失敗時のフォールバック手順:**
   - ユーザーに `localhost:3000` の以下 URL を順番に開いてもらい目視確認を依頼:
     - `/projects` (一覧、赤線中央 + バーセントリング)
     - `/projects/[任意ID]` (ツリー、ヘッダー + 全行のバー)
     - `/projects/[任意ID]/milestones/[任意ID]` (V2 タイムライン)
     - `/projects/[任意ID]/tasks/[任意ID]` (V3 タスク詳細)
     - `/dashboard` (回帰確認、Step 3.2.2 で GanttBar 利用ありと判明していれば重点)
     - `/_preview` (overdue 視覚確認)
   - チェックリスト (markdown コピー):
     ```
     - [ ] /projects: 赤線がバッジテキスト中央
     - [ ] /projects/[id]: ヘッダーの赤線中央
     - [ ] /projects/[id]: マイルストーン/タスク/ToDo バーで斜線が今日線右側に出ない
     - [ ] 期日超過行で斜線でなく赤ベタが (実績→100%) を埋める
     - [ ] /dashboard: 視覚回帰なし
     - [ ] /_preview: overdue フィクスチャで濃赤レイヤー表示
     - [ ] コンソールエラー新規なし
     ```
4. **回帰テストフィクスチャ:** `_preview/page.tsx` の overdue 例 (Step 3.2.5) で本番 DB 投入なしに視覚確認可能。本番 seed (`prisma/seed.ts`) は触らない。
5. **PR 作成:** 全 green 確認後、`/pr` (本リポジトリのカスタムコマンド) を優先使用。CI で失敗するなら手動 `gh pr create --title ... --body ...` でフォールバック。PR description に Before/After スクショ添付推奨 (4.2 で取得した `browser_take_screenshot` を流用)。

#### 4.3 検証コマンド

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

全 green を確認したら commit & push、PR 作成は Section 4.2.5 の手順に従う。

#### 4.4 Exit

- [ ] 5 画面以上で視覚回帰なし。
- [ ] overdue 赤塗りが想定通り表示される (フィクスチャかプレビューで確認)。
- [ ] CI 4 種類 (lint / typecheck / test / build) 全 green。
- [ ] PR description に Before/After スクショ添付。

#### 4.5 Rollback

ブランチごと revert または特定コミットを cherry-pick で戻す。

---

## 4. 並列実行の余地

- Step 1 と Step 2 はファイルが重ならないため理論上並列可能だが、単一ブランチで連続コミットする方が PR レビュー容易性が高い。直列実行を推奨。
- Step 3 は Step 2 に依存 (新 prop)。並列不可。
- Step 4 は最終ステップ。

## 5. モデル割り当て

- **Step 1:** default (Sonnet) — CSS のみ。
- **Step 2:** strongest (Opus) — 幾何学的 invariant の保持判定があるため。
- **Step 3:** default (Sonnet) — 機械的配線。
- **Step 4:** default (Sonnet) — ブラウザ QA とテストランナー。

## 6. invariants (各ステップ後に検証)

- バー内 `scheduledPct%` 位置 = 親グリッドの今日線 X (spec 2.2)。**Step 2 後も保証** (新規レイヤーはこの座標系を変えていない)。
- 既存テスト `timeline-utils.test.ts` の `xForDate` / `barOffsetWidth` / `monthBoundaries` の挙動は変えない。
- `GanttBar` の Legacy variant (`_preview` 等) は従来挙動を維持。本番 caller (Section 1.5 表の 6 箇所) はすべて新 variant に移行する。
- **invariant の視覚的影響 (明示):** `isOverdue` のとき Layer 3 (赤) が `cActual → 100` を覆うため、`cScheduled = todayInBar` 位置の境界が赤レイヤー内部に埋もれる。仕様「今日線3役」のうち「予定%位置」と「実績との境界」役は、**親グリッドの今日線 (`TodayLine.tsx` の赤縦線)** が赤レイヤーを縦断することで視認的に保持される。テストで「今日線が赤レイヤーを縦断していること」を Playwright スクショで確認する。
- TZ 統一: 今日表示 (`formatTodayLabel`, project-list バッジ) はすべて `getUTCMonth/getUTCDate` を使う。`getMonth/getDate` (ローカル TZ) は CLAUDE.md 規約上禁止。

## 7. プラン改変プロトコル

実装中に以下が発生した場合は本 plan を編集する:

- Step 2 で `today` 配線に副作用 (SSR hydration mismatch 等) が出たら、Step 2.6 に既知問題として追記。
- Step 3 で想定外の caller が見つかったら、3.1 表を更新。
- Step 4 で新たな視覚回帰が見つかったら、新 Step を追加し本 plan を改訂。

## 8. 仕様改訂の必要性

本 PR は `docs/spec.md` 2.2 / 4.1 の invariant を破らず、バーの表現を厳密化するだけ。**spec.md 改訂は不要**。ただし以下を spec.md 5.3 (各画面詳細) にユーザー判断で追記しても良い:

> ガントバー内訳:
>
> - 実績エリア: ステータス色
> - 斜線エリア: 遅延ギャップ (`actualPct` 〜 `min(scheduledPct, todayInBar)`)、今日線より右には絶対出ない
> - overdue 赤エリア: 期日超過後の未完部分 (`actualPct` 〜 100%)、斜線とは排他
> - 未来予定エリア: 薄灰 (`scheduledPct` 〜 100%)、overdue 時は描画しない

ユーザー確認の上、必要なら本 PR 内で spec.md を更新する。

---

## 9. PR テンプレート (参考)

```
## Summary
- 今日バッジを赤縦線の中央に揃える (project list + tree view header)、`getUTCMonth/getUTCDate` で TZ 統一
- GanttBar の斜線右端を今日線位置でクランプ、期日超過部分を赤ソリッド (`bg-red-700`) で塗りつぶす
- GanttBar の discriminated union を厳格化、全本番 caller (6 箇所) を「日付あり variant」に移行
- `_preview/page.tsx` に overdue フィクスチャ追加で視覚回帰確認可能

## Test plan
- [ ] npm run lint && npm run typecheck && npm test && npm run build 全 green
- [ ] /projects で赤線がバッジテキスト中央を貫く
- [ ] /projects/[id] ヘッダーでも中央
- [ ] /projects/[id] のマイルストーン/タスク/ToDo バーで、斜線が今日線右側に絶対出ない
- [ ] 期日超過タスクでバー末尾 (実績→100%) が斜線でなく濃赤 (`bg-red-700`) ソリッド
- [ ] today === rowEnd 境界では overdue 扱いせず (テスト & 視覚)
- [ ] /dashboard /tasks/[id] /milestones/[id] で視覚回帰なし
- [ ] /_preview の overdue フィクスチャで赤レイヤー視認
- [ ] aria-label に `(期日超過)` が overdue 行にのみ含まれる
```

---

**END OF PLAN**
