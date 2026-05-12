# Phase 3 実装計画 — 予兆検知ダッシュボード (V4)

**目的:** 遅延の連鎖を可視化する予兆検知ダッシュボード(V4)を実装し、Phase 3 を完結させる  
**仕様書:** `docs/spec.md` v3.0 §4.5〜4.6, §5.3 (V4), §7.5  
**前提:** Phase 2 完了(develop ブランチにマージ済み) — V2 タイムライン・V3 タスク詳細・ToDo CRUD がすべて動作済み  
**ブランチ戦略:** feature ブランチ → `develop` へ PR(PR は GitHub Web UI: https://github.com/HiroshiKazui-Arent/foresight/compare で作成)  
**gh CLI:** 未インストール。各 Step 完了後に `git push origin <branch>` し、上記 URL で PR を作成。  
**コマンド注意:** Windows/PowerShell 環境。チェーンは `&&` でなく `;` を使う。  
**Phase 3 完了時の方針:** Phase 3 完了後 `develop` → `main` にマージ。AWS 未デプロイだが「機能完成版」として main に上げる(Phase 4 で AWS デプロイ)。

---

## 不変ルール(全ステップ共通)

1. **`prisma/schema.prisma` は Phase 3 で変更しない。** Phase 1 で全モデルが揃っている。
2. **`src/middleware.ts` と `src/lib/auth.config.ts` に Prisma 呼び出しを追加しない。** Edge runtime 制約。
3. **`src/lib/progress.ts` および `src/components/tree-view/progress-utils.ts` は変更しない。** 新規関数は `src/lib/forecast.ts` に置く。
4. **進捗計算はサーバー側(Server Component)で実行。** `buildDashboardData` を Server Component から呼ぶ。
5. **`today` は Server Component で1回生成する。** `today` は UTC 時刻を含む `new Date()`(他 Phase と同様、日付に丸めない)。
6. **`calcCompletionDate` のゼロ除算・未着手ガード:** `actualPct === 0` または `elapsedMs <= 0` のとき `null` を返す。
7. **`today` の比較は日付レベルで行う。** 時刻差が誤差を生むケースは `elapsedDays < 0.5` を目安に「未着手」扱いとする。
8. **V4 ダッシュボードは読み取り専用。** mutation は Phase 3 範囲外。将来追加時は `revalidatePath('/projects/${id}/dashboard')` を呼ぶこと。
9. **PowerShell コマンドでの `&&` 連結不可。** `;` または別コマンドに分割。

---

## ステップ一覧と依存関係

```
Step 1 (連鎖計算ロジック + 型定義)
      ↓ (src/types/dashboard.ts と src/lib/forecast.ts を提供)
Step 2 (V4 ダッシュボード UI + ナビゲーション統合)
      ↓
Step 3 (QA 回帰テスト + main 統合)
```

| #   | タイトル                                  | 依存         | 並列可能な相手 |
| --- | ----------------------------------------- | ------------ | -------------- |
| 1   | 連鎖予測計算ロジック + 型定義             | Phase 2 完了 | なし           |
| 2   | V4 ダッシュボード UI + ナビゲーション統合 | Step 1       | なし           |
| 3   | 回帰テスト・バグ修正 + main へ統合        | Step 1, 2    | なし           |

**Step 1 と Step 2 が直列な理由:** Step 2 は `src/types/dashboard.ts` と `src/lib/forecast.ts` を直接 import する。型が確定していないとコンパイルが通らない。

---

## 既存の再利用可能リソース(Phase 1〜2 実装済み)

- **進捗計算:** `src/lib/progress.ts` — `calcScheduledPct`, `calcStatus`, `calcDaysDeviation`, `calcTaskActualPct`, `calcMilestoneActualPct`, `calcProjectActualPct`
- **UI コンポーネント(パスは確認済み):**
  - `import { ProgressPill } from '@/components/progress-pill'`
  - `import { StatusPill } from '@/components/status-pill'`
  - `import { DaysPill } from '@/components/days-pill'`
- **データ取得:** `getProject(id)` (`src/server/actions/project.ts`) — Project + Milestone[] + Task[] + Todo[] を全階層で返す
  - **認可:** `getProject` 内で `requireProjectMember(id)` を呼んでいる。ダッシュボードページは `await getProject(id)` だけで認可が通る(`tasks/[taskId]/page.tsx` と同じパターン)。プロジェクトが存在しない場合は `getProject` 内の `notFound()` が走るため、ページ側の明示的 null チェックは不要。
- **既存型:** `ProgressBarData`, `ProgressStatus` (`src/types/progress.ts`)

---

## `calcCompletionDate` の式と仕様書 §4.5 の対応

仕様書 §4.5 の式:

```
完了予測日 = 今日 + (残作業% × 全期間日数 / 実績進捗速度)
```

「実績進捗速度」を「1日あたりの進捗%」と解釈すると:

```
実績進捗速度 = actualPct / elapsedDays  (単位: %/日)
```

これを代入すると:

```
残日数 = (100 - actualPct) / 実績進捗速度
       = (100 - actualPct) / (actualPct / elapsedDays)
       = (100 - actualPct) × elapsedDays / actualPct
```

この式は「全期間日数(totalDays)」を使わない。仕様書の `全期間日数` は式の分子に含まれているが、「速度」の定義が `actualPct / totalDays × 経過率` でなく `actualPct / elapsedDays` であるため、代入後に約分される。**実装では `totalDays` を引数に取る必要はない。** テストで「50%進行・経過5日 → 残5日」を確認すれば仕様書の意図と一致していることを検証できる。

---

## Step 1: 連鎖予測計算ロジック + 型定義

### コンテキスト

Phase 2 完了済みで「既存の再利用可能リソース」が利用可能。

**V4 の仕様** (`docs/spec.md` §4.5〜4.6, §5.3):

> 連鎖予測: ToDo の遅延 → Task の完了予測日のスリップ → Milestone の完了予測日のスリップ → Project の完了予測日のスリップ  
> V4 予兆検知ダッシュボード: ToDo → Task → Milestone → Project の連鎖を縦に並べ、矢印で連結

**連鎖集約ルール:**

- ToDo が `warning` または `delayed` → その親 Task を warningTasks に含める
- Task が warningTasks に含まれる → その親 Milestone を warningMilestones に含める
- Milestone 自体が `warning`/`delayed` でも warningMilestones に含める
- 上記いずれにも当てはまらない場合: `allClear: true`

### 作業タスク

#### 1. 型定義 `src/types/dashboard.ts`(新規作成)

```ts
import type { ProgressStatus } from './progress'

export type TodoForecast = {
  id: string
  name: string
  startDate: Date
  endDate: Date
  actualPct: number
  scheduledPct: number
  status: ProgressStatus
  daysDeviation: number
  completionDate: Date | null // null = actualPct=0 or 未着手のため予測不能
  slipDays: number // completionDate が endDate を超過する日数。0 = スリップなし or 予測不能
  recommendation: string // 推奨アクション文字列
}

export type TaskForecast = {
  id: string
  name: string
  startDate: Date
  endDate: Date
  milestoneId: string
  milestoneName: string
  actualPct: number
  scheduledPct: number
  status: ProgressStatus
  daysDeviation: number
  completionDate: Date | null
  slipDays: number
  warningTodos: TodoForecast[]
}

export type MilestoneForecast = {
  id: string
  name: string
  startDate: Date
  endDate: Date
  actualPct: number
  scheduledPct: number
  status: ProgressStatus
  daysDeviation: number
  completionDate: Date | null
  slipDays: number
  warningTasks: TaskForecast[]
}

export type ProjectForecast = {
  id: string
  name: string
  startDate: Date
  endDate: Date
  actualPct: number
  scheduledPct: number
  status: ProgressStatus
  daysDeviation: number
  completionDate: Date | null
  slipDays: number
  warningMilestones: MilestoneForecast[]
  allClear: boolean
}
```

#### 2. 計算ロジック `src/lib/forecast.ts`(新規作成)

`getProject(id)` の戻り値型と整合する入力型を使う。Prisma 型のままで構造的互換性があるため `as` キャストは不要。シグネチャ:

```ts
buildDashboardData(
  project: Awaited<ReturnType<typeof getProject>>,
  today: Date,
): ProjectForecast
```

**公開ユーティリティ関数:**

```ts
/**
 * 完了予測日。actualPct が 0 または未着手(elapsedMs <= 0)なら null。
 * actualPct は [0, 100] にクランプしてから計算する。
 */
export function calcCompletionDate(
  actualPct: number,
  startDate: Date,
  endDate: Date, // 引数に含めるが式では使わない(将来の拡張余地のため)
  today: Date,
): Date | null {
  const clamped = Math.max(0, Math.min(100, actualPct))
  if (clamped >= 100) return today
  if (clamped === 0) return null
  const elapsedMs = today.getTime() - startDate.getTime()
  if (elapsedMs <= 0) return null
  const elapsedDays = elapsedMs / (24 * 60 * 60 * 1000)
  const progressPerDay = clamped / elapsedDays
  const remainingDays = (100 - clamped) / progressPerDay
  return new Date(today.getTime() + remainingDays * 24 * 60 * 60 * 1000)
}

/**
 * スリップ日数。completionDate が null または endDate 以前なら 0。
 * 正数 = スリップ(遅延)、0 = スリップなし。
 */
export function calcSlipDays(completionDate: Date | null, endDate: Date): number {
  if (!completionDate) return 0
  const ms = completionDate.getTime() - endDate.getTime()
  return Math.max(0, ms / (24 * 60 * 60 * 1000))
}

/**
 * 推奨アクション文字列を生成する。
 * warning + スリップあり → 至急対応メッセージ
 * warning + スリップなし → 大幅遅延メッセージ
 * delayed + スリップあり → 確認メッセージ + スリップ日数
 * delayed + スリップなし → 進捗確認メッセージ
 */
export function buildRecommendation(status: ProgressStatus, slipDays: number): string {
  if (status === 'warning') {
    if (slipDays > 0) {
      return `大幅遅延: ${Math.ceil(slipDays)}日のスリップ予測 — 即時対応が必要です`
    }
    return '大幅遅延(-20%以上) — 即時対応が必要です'
  }
  if (status === 'delayed') {
    if (slipDays > 0) {
      return `遅延傾向: ${Math.ceil(slipDays)}日のスリップ予測 — 担当者への確認を推奨`
    }
    return '遅延傾向 — 進捗確認を推奨'
  }
  return ''
}
```

**buildDashboardData の全実装:**

```ts
import { getProject } from '@/server/actions/project'
import {
  calcScheduledPct,
  calcStatus,
  calcDaysDeviation,
  calcTaskActualPct,
  calcMilestoneActualPct,
  calcProjectActualPct,
} from './progress'
import type { ProgressStatus } from '@/types/progress'
import type {
  TodoForecast,
  TaskForecast,
  MilestoneForecast,
  ProjectForecast,
} from '@/types/dashboard'

const WARNING_STATUSES: ProgressStatus[] = ['warning', 'delayed']

export function buildDashboardData(
  project: Awaited<ReturnType<typeof getProject>>,
  today: Date,
): ProjectForecast {
  // Milestone が0件のとき
  if (project.milestones.length === 0) {
    return {
      id: project.id,
      name: project.name,
      startDate: today,
      endDate: today,
      actualPct: 0,
      scheduledPct: 0,
      status: 'scheduled',
      daysDeviation: 0,
      completionDate: null,
      slipDays: 0,
      warningMilestones: [],
      allClear: true,
    }
  }

  const warningMilestones: MilestoneForecast[] = []

  for (const milestone of project.milestones) {
    const taskActualsForMs = milestone.tasks.map((task) => ({
      actualPct: calcTaskActualPct(task.todos),
      startDate: task.startDate,
      endDate: task.endDate,
    }))

    const msActualPct = calcMilestoneActualPct(taskActualsForMs)
    const msScheduledPct = calcScheduledPct(milestone.startDate, milestone.endDate, today)
    const msStatus = calcStatus(msActualPct, msScheduledPct)
    const msDurationDays =
      (milestone.endDate.getTime() - milestone.startDate.getTime()) / (24 * 60 * 60 * 1000)
    const msDaysDeviation = calcDaysDeviation(msActualPct, msScheduledPct, msDurationDays)
    const msCompletionDate = calcCompletionDate(
      msActualPct,
      milestone.startDate,
      milestone.endDate,
      today,
    )
    const msSlipDays = calcSlipDays(msCompletionDate, milestone.endDate)

    const warningTasks: TaskForecast[] = []

    for (const task of milestone.tasks) {
      const taskActualPct = calcTaskActualPct(task.todos)
      const taskScheduledPct = calcScheduledPct(task.startDate, task.endDate, today)
      const taskStatus = calcStatus(taskActualPct, taskScheduledPct)

      if (!WARNING_STATUSES.includes(taskStatus)) continue

      const taskDurationDays =
        (task.endDate.getTime() - task.startDate.getTime()) / (24 * 60 * 60 * 1000)
      const taskDaysDeviation = calcDaysDeviation(taskActualPct, taskScheduledPct, taskDurationDays)
      const taskCompletionDate = calcCompletionDate(
        taskActualPct,
        task.startDate,
        task.endDate,
        today,
      )
      const taskSlipDays = calcSlipDays(taskCompletionDate, task.endDate)

      const warningTodos: TodoForecast[] = []

      for (const todo of task.todos) {
        const todoScheduledPct = calcScheduledPct(todo.startDate, todo.endDate, today)
        const todoStatus = calcStatus(todo.actualPct, todoScheduledPct)

        if (!WARNING_STATUSES.includes(todoStatus)) continue

        const todoDurationDays =
          (todo.endDate.getTime() - todo.startDate.getTime()) / (24 * 60 * 60 * 1000)
        const todoDaysDeviation = calcDaysDeviation(
          todo.actualPct,
          todoScheduledPct,
          todoDurationDays,
        )
        const todoCompletionDate = calcCompletionDate(
          todo.actualPct,
          todo.startDate,
          todo.endDate,
          today,
        )
        const todoSlipDays = calcSlipDays(todoCompletionDate, todo.endDate)

        warningTodos.push({
          id: todo.id,
          name: todo.name,
          startDate: todo.startDate,
          endDate: todo.endDate,
          actualPct: todo.actualPct,
          scheduledPct: todoScheduledPct,
          status: todoStatus,
          daysDeviation: todoDaysDeviation,
          completionDate: todoCompletionDate,
          slipDays: todoSlipDays,
          recommendation: buildRecommendation(todoStatus, todoSlipDays),
        })
      }

      warningTasks.push({
        id: task.id,
        name: task.name,
        startDate: task.startDate,
        endDate: task.endDate,
        milestoneId: milestone.id,
        milestoneName: milestone.name,
        actualPct: taskActualPct,
        scheduledPct: taskScheduledPct,
        status: taskStatus,
        daysDeviation: taskDaysDeviation,
        completionDate: taskCompletionDate,
        slipDays: taskSlipDays,
        warningTodos,
      })
    }

    if (WARNING_STATUSES.includes(msStatus) || warningTasks.length > 0) {
      warningMilestones.push({
        id: milestone.id,
        name: milestone.name,
        startDate: milestone.startDate,
        endDate: milestone.endDate,
        actualPct: msActualPct,
        scheduledPct: msScheduledPct,
        status: msStatus,
        daysDeviation: msDaysDeviation,
        completionDate: msCompletionDate,
        slipDays: msSlipDays,
        warningTasks,
      })
    }
  }

  // プロジェクト全体の集計
  const msActualsForProject = project.milestones.map((ms) => {
    const taskActuals = ms.tasks.map((t) => ({
      actualPct: calcTaskActualPct(t.todos),
      startDate: t.startDate,
      endDate: t.endDate,
    }))
    return {
      actualPct: calcMilestoneActualPct(taskActuals),
      startDate: ms.startDate,
      endDate: ms.endDate,
    }
  })

  const projectActualPct = calcProjectActualPct(msActualsForProject)
  const projectStartDate = msActualsForProject.reduce(
    (min, ms) => (ms.startDate < min ? ms.startDate : min),
    msActualsForProject[0].startDate,
  )
  const projectEndDate = msActualsForProject.reduce(
    (max, ms) => (ms.endDate > max ? ms.endDate : max),
    msActualsForProject[0].endDate,
  )
  const projectScheduledPct = calcScheduledPct(projectStartDate, projectEndDate, today)
  const projectStatus = calcStatus(projectActualPct, projectScheduledPct)
  const projectDurationDays =
    (projectEndDate.getTime() - projectStartDate.getTime()) / (24 * 60 * 60 * 1000)
  const projectDaysDeviation = calcDaysDeviation(
    projectActualPct,
    projectScheduledPct,
    projectDurationDays,
  )
  const projectCompletionDate = calcCompletionDate(
    projectActualPct,
    projectStartDate,
    projectEndDate,
    today,
  )
  const projectSlipDays = calcSlipDays(projectCompletionDate, projectEndDate)

  return {
    id: project.id,
    name: project.name,
    startDate: projectStartDate,
    endDate: projectEndDate,
    actualPct: projectActualPct,
    scheduledPct: projectScheduledPct,
    status: projectStatus,
    daysDeviation: projectDaysDeviation,
    completionDate: projectCompletionDate,
    slipDays: projectSlipDays,
    warningMilestones,
    allClear: warningMilestones.length === 0,
  }
}
```

#### 3. ユニットテスト `src/lib/__tests__/forecast.test.ts`(新規作成)

テストケース一覧(すべてカバーすること):

**`calcCompletionDate` (6 ケース)**

| #   | 条件                                      | 期待値         |
| --- | ----------------------------------------- | -------------- |
| 1   | `actualPct=0`                             | `null`         |
| 2   | `actualPct=100`                           | `today`        |
| 3   | `today < startDate`(未着手)               | `null`         |
| 4   | 順調: `actualPct=50`, 経過5日, 全期間10日 | `today + 5日`  |
| 5   | 遅延: `actualPct=20`, 経過5日, 全期間10日 | `today + 20日` |
| 6   | `actualPct=-5`(クランプ確認)              | `null`         |

**`calcSlipDays` (3 ケース)**

| #   | 条件                               | 期待値 |
| --- | ---------------------------------- | ------ |
| 7   | `completionDate = null`            | `0`    |
| 8   | `completionDate < endDate`(前倒し) | `0`    |
| 9   | `completionDate = endDate + 3日`   | 約 `3` |

**`buildRecommendation` (2 ケース)**

| #   | 条件                             | 期待値                                               |
| --- | -------------------------------- | ---------------------------------------------------- |
| 10  | `status='warning'`, `slipDays=5` | `"大幅遅延: 5日のスリップ予測 — 即時対応が必要です"` |
| 11  | `status='delayed'`, `slipDays=0` | `"遅延傾向 — 進捗確認を推奨"`                        |

**`buildDashboardData` (5 ケース)**

| #   | 条件                                             | 期待値                                                                      |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------- |
| 12  | Milestone 0件                                    | `allClear: true`, `warningMilestones: []`, `status: 'scheduled'`            |
| 13  | 全 ToDo 順調                                     | `allClear: true`, `warningMilestones: []`                                   |
| 14  | 警告 ToDo が 1件(actualPct < scheduledPct - 20%) | `warningMilestones[0].warningTasks[0].warningTodos.length === 1`            |
| 15  | Milestone 自体は順調 + 配下に警告 Task           | `warningMilestones` に含まれる, `warningMilestones[0].status !== 'warning'` |
| 16  | 全 ToDo が `actualPct=100` → `allClear: true`    | `allClear: true`                                                            |

### 検証コマンド

```powershell
npm run typecheck
npm run lint
npm test -- --reporter=verbose
# forecast.test.ts が PASS すること(16 ケース以上)
```

### 完了基準

- `src/types/dashboard.ts` が存在し、4つの型が export されている
- `src/lib/forecast.ts` が存在し、`calcCompletionDate`, `calcSlipDays`, `buildRecommendation`, `buildDashboardData` が export されている
- `src/lib/__tests__/forecast.test.ts` で上記 16 ケースがすべて PASS する
- `npm run typecheck` エラーなし
- `npm run lint` エラーなし
- `npm test` グリーン

### ブランチ / PR

`feature/phase3-step1-forecast-logic` → `develop`

---

## Step 2: V4 ダッシュボード UI + ナビゲーション統合

### コンテキスト

**依存:** Step 1 が `develop` にマージ済みであること。`src/types/dashboard.ts` と `src/lib/forecast.ts` が存在する。

**V4 の画面構成:**

```
[Project サマリカード]   ← 常に表示。全体進捗 + 完了予測日
       ↓ (矢印: warningMilestones がある場合のみ)
[Milestone カード]       ← 警告・遅延 Milestone
       ↓ (矢印: warningTasks がある場合のみ)
[Task カード]            ← 警告・遅延 Task(Milestone 名ラベル付き)
       ↓ (矢印: warningTodos がある場合のみ)
[ToDo カード]            ← 警告・遅延 ToDo + 推奨アクション
```

`allClear === true` のとき: Project サマリ + 「すべての項目が順調です」のみ表示。  
Milestone 0件のとき: Project サマリ + 「マイルストーンが登録されていません」を表示。

**URL:** `/projects/[id]/dashboard`(dashboard は Project ごとに1つのため子リソース ID を取らない)

**コンポーネント分類:**

- `page.tsx` — Server Component(認可・データ取得・計算を担当)
- `DashboardView` — Server Component(インタラクション不要のため Client にしない)

**利用可能リソース:**

- `buildDashboardData` (`src/lib/forecast.ts`) — Step 1 で実装済み
- `getProject(id)` — 認可込みで全データを返す
- `ProgressPill` → `@/components/progress-pill`
- `StatusPill` → `@/components/status-pill`
- `DaysPill` → `@/components/days-pill`

### 作業タスク

#### 1. ナビゲーションリンク追加 `src/app/(app)/projects/[id]/page.tsx`

既存ファイルを Read してから編集すること。既存の `<div className="flex gap-2">` 内に「予兆検知」リンクを追加する。既存の「日報入力」「設定」ボタンは変更しない。

```tsx
// 既存の「日報入力」ボタンの前に追加
<Link
  href={`/projects/${id}/dashboard`}
  className="inline-flex items-center justify-center rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
>
  予兆検知
</Link>
```

#### 2. ページ `src/app/(app)/projects/[id]/dashboard/page.tsx`(新規作成)

```tsx
import { getProject } from '@/server/actions/project'
import { buildDashboardData } from '@/lib/forecast'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import Link from 'next/link'

export default async function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // getProject 内で requireProjectMember(id) と notFound() を呼ぶため
  // ここでの明示的認可チェックや null ガードは不要
  const project = await getProject(id)

  const today = new Date()
  const forecast = buildDashboardData(project, today)

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link href={`/projects/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← {project.name}
        </Link>
        <h1 className="text-2xl font-bold">予兆検知ダッシュボード</h1>
      </div>
      <DashboardView forecast={forecast} projectId={id} />
    </div>
  )
}
```

#### 3. DashboardView コンポーネント `src/components/dashboard/dashboard-view.tsx`(新規作成)

Server Component(インタラクション不要のため `'use client'` 不要)。

**完了予測日フォーマット:**

```ts
function formatDate(d: Date | null): string {
  if (!d) return '予測不能'
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
}
```

**ステータスによる背景色:**

```ts
function statusBgClass(status: string): string {
  if (status === 'warning') return 'border-red-400 bg-red-50'
  if (status === 'delayed') return 'border-yellow-400 bg-yellow-50'
  return 'border-gray-200 bg-white'
}
```

**各カードの構成(Project / Milestone / Task / ToDo):**

各カードは `rounded-lg border-l-4 p-4 shadow-sm` を基本とし、`statusBgClass` で色分けする。内部に `<ProgressPill>`, `<StatusPill>`, `<DaysPill>` を横並びで表示し、完了予測日とスリップ日数を続ける。

Task カードは `<Link href={\`/projects/${projectId}/tasks/${task.id}\`}>` でタスク名にリンクを張り、V3 に遷移できるようにする。

ToDo カードは推奨アクション(`todo.recommendation`)を `bg-white/60` の囲み内に表示する。`recommendation` が空文字の場合は非表示にする(テンプレート: `{todo.recommendation && <div>...</div>}`)。

**チェーン矢印:**

```tsx
function ChainArrow() {
  return <div className="flex justify-center py-2 text-2xl text-gray-400">↓</div>
}
```

**DashboardView のメイン構成:**

```tsx
export function DashboardView({
  forecast,
  projectId,
}: {
  forecast: ProjectForecast
  projectId: string
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-2">
      {/* Project サマリ — 常に表示 */}
      <ProjectCard forecast={forecast} />

      {/* Milestone 0件 */}
      {forecast.status === 'scheduled' &&
        forecast.warningMilestones.length === 0 &&
        forecast.actualPct === 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-gray-500">
            マイルストーンが登録されていません
          </div>
        )}

      {/* allClear */}
      {forecast.allClear && forecast.actualPct > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center text-green-800">
          ✓ すべての項目が順調です
        </div>
      )}

      {/* 連鎖表示 */}
      {forecast.warningMilestones.map((ms) => (
        <div key={ms.id}>
          <ChainArrow />
          <MilestoneCard milestone={ms} />
          {ms.warningTasks.map((task) => (
            <div key={task.id}>
              <ChainArrow />
              <TaskCard task={task} projectId={projectId} />
              {task.warningTodos.length > 0 && (
                <div className="ml-6 space-y-2">
                  {task.warningTodos.map((todo) => (
                    <div key={todo.id}>
                      <ChainArrow />
                      <TodoCard todo={todo} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
```

### 検証コマンド

```powershell
npm run typecheck
npm run lint
npm run build
# Phase 3 は schema 変更なし。npm run build は既存 DB に対して走る。
# ブラウザで確認:
# docker compose up -d
# - V1 (/projects/{id}) のヘッダーに「予兆検知」ボタン(amber色)が表示される
# - ボタンクリックで /projects/{id}/dashboard に遷移
# - Project サマリカードが表示される
# - Milestone 0件プロジェクトで「マイルストーンが登録されていません」が表示される
# - allClear プロジェクトで「すべての項目が順調です」が表示される
# - 警告 ToDo/Task/Milestone がある場合、連鎖が矢印で表示される
# - Task カードのリンクで V3 タスク詳細に遷移する
# - warning カードが赤背景、delayed カードが黄背景
# - 非メンバーが /projects/{id}/dashboard にアクセスすると 403/404 になる
# - V1 の既存ボタン(日報入力・設定)と V2/V3 リンクが引き続き動作する(回帰)
```

### 完了基準

- `/projects/[id]/dashboard` が 200 で表示される
- Project サマリカードが常に表示される(完了予測日が `toLocaleDateString` でフォーマットされている)
- `allClear === true` のとき「すべての項目が順調です」が表示される
- `warning` カードが赤背景、`delayed` カードが黄背景で表示される
- 連鎖がある場合、矢印(↓)で Project → Milestone → Task → ToDo が連結される
- Task カードから V3 タスク詳細に遷移できる
- ToDo カードに推奨アクション文字列が表示される
- 非メンバーへのアクセスが適切にブロックされる
- TypeScript エラーなし、ビルド通過

### ブランチ / PR

`feature/phase3-step2-dashboard-ui` → `develop`

---

## Step 3: 回帰テスト・バグ修正 + main 統合

### コンテキスト

**依存:** Step 1, 2 すべてが `develop` にマージ済みであること。

Phase 3 で追加された V4 ダッシュボードと、Phase 1〜2 の既存機能の回帰テストを行う。

### 作業タスク

1. **CI グリーン確認:**

   ```powershell
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```

2. **E2E フロー確認(手動チェックリスト):**

   **Phase 3 新規機能(11 項目):**
   - [ ] V1 のヘッダーに「予兆検知」ボタン(amber 色)が表示されている
   - [ ] 「予兆検知」ボタンで `/projects/[id]/dashboard` に遷移する
   - [ ] Project サマリカードが常に表示される
   - [ ] Milestone 0 件プロジェクトで「マイルストーンが登録されていません」が表示される
   - [ ] 全 ToDo が順調なプロジェクトで「すべての項目が順調です」が表示される
   - [ ] 警告がある場合、Milestone → Task → ToDo の連鎖が矢印で表示される
   - [ ] `warning` ステータスのカードが赤背景、`delayed` が黄背景になっている
   - [ ] Task カードをクリックすると V3 タスク詳細に遷移する
   - [ ] ToDo カードに推奨アクション文字列が表示される(`warning`/`delayed` のみ)
   - [ ] 完了予測日が日本語日付形式で表示される、または「予測不能」が表示される
   - [ ] 非メンバーが `/projects/[id]/dashboard` に直接アクセスすると適切にブロックされる

   **Phase 1〜2 の回帰確認(8 項目):**
   - [ ] V1 の Milestone 名横 → リンクで V2 に遷移し、ガントバーが正常表示される
   - [ ] V1 のインライン編集とドラッグ&ドロップが動作する
   - [ ] V2 の Task 名横 → リンクで V3 に遷移する
   - [ ] V3 の ToDo 追加・編集・削除が動作し、weight が自動再計算される
   - [ ] I1(日報入力)で進捗% を入力すると V2/V3 の進捗ピルが更新される
   - [ ] A3 プロジェクト一覧が正常に表示される
   - [ ] A4 プロジェクト設定が動作する
   - [ ] A5 ユーザー管理と招待フローが動作する

3. **発見した全バグを修正**し、バグを検出するテストを追加する。

4. **`develop` → `main` PR 作成:** Step 3 ブランチを `develop` にマージ後、`develop` → `main` の PR を作成する。PR 本文に Phase 3 の変更内容(Step 1〜2)を明記する。

### 完了基準

- CI 全ジョブ(lint, typecheck, test, build)グリーン
- 上記 E2E チェックリスト 11 + 8 = 19 項目すべて完了
- Phase 1〜2 の既存機能に回帰なし
- `develop` → `main` PR が作成済み

### ブランチ / PR

`feature/phase3-step3-qa-regression` → `develop`  
完了後: `develop` → `main` PR を作成

---

## 実装開始手順

`develop` ブランチはすでに存在するため作成不要。Phase 2 Step 3 が `develop` にマージ済みであることを確認してから開始する。

```powershell
git checkout develop
git pull origin develop
git checkout -b feature/phase3-step1-forecast-logic
```

Step 1 完了・マージ後:

```powershell
git checkout develop
git pull origin develop
git checkout -b feature/phase3-step2-dashboard-ui
```

Step 2 完了・マージ後:

```powershell
git checkout develop
git pull origin develop
git checkout -b feature/phase3-step3-qa-regression
```

## 変更・中断プロトコル

- **ステップを分割:** このファイルを更新し、末尾に改訂コメントと日付を追記する
- **ステップをスキップ:** 該当ステップに `[SKIP: 理由]` を付記し、依存関係を更新する
- **仕様変更が必要:** `docs/spec.md` を先に更新し改訂履歴を追記してから本ファイルを更新する

---

_作成日: 2026-05-13 | 仕様書バージョン: v3.0 | Opus 4.7 adversarial review 実施済み(5 CRITICAL, 10 MAJOR 修正済み)_
