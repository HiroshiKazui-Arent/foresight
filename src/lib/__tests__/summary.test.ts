import { describe, it, expect } from 'vitest'
import { buildDelaySummary, buildProjectSummary, matchesFilter } from '@/lib/summary'
import type { DelaySummary, ProjectSummary } from '@/lib/summary'
import type { Status } from '@/lib/status'

const d = (s: string) => new Date(s + 'T00:00:00Z')

// ────────────────────────────────────────────────────────────────────────────
// buildProjectSummary
// ────────────────────────────────────────────────────────────────────────────
describe('buildProjectSummary', () => {
  const projectStart = d('2026-01-01')
  const projectEnd = d('2026-12-31')

  it('空プロジェクト (Milestone なし) は actualPct=0、scheduledPct は期間ベース', () => {
    const today = d('2026-07-01')
    const result = buildProjectSummary(
      { startDate: projectStart, endDate: projectEnd, milestones: [] },
      today,
    )
    expect(result.actualPct).toBe(0)
    expect(result.scheduledPct).toBeGreaterThan(0)
    expect(result.scheduledPct).toBeLessThanOrEqual(100)
  })

  it('全 ToDo 完了で actualPct=100', () => {
    const today = d('2026-07-01')
    const result = buildProjectSummary(
      {
        startDate: projectStart,
        endDate: projectEnd,
        milestones: [
          {
            startDate: d('2026-01-01'),
            endDate: d('2026-06-30'),
            tasks: [
              {
                startDate: d('2026-01-01'),
                endDate: d('2026-06-30'),
                todos: [{ actualEndDate: d('2026-03-01') }, { actualEndDate: d('2026-06-01') }],
              },
            ],
          },
        ],
      },
      today,
    )
    expect(result.actualPct).toBe(100)
  })

  it('全 ToDo 未完了で actualPct=0', () => {
    const today = d('2026-07-01')
    const result = buildProjectSummary(
      {
        startDate: projectStart,
        endDate: projectEnd,
        milestones: [
          {
            startDate: d('2026-01-01'),
            endDate: d('2026-06-30'),
            tasks: [
              {
                startDate: d('2026-01-01'),
                endDate: d('2026-06-30'),
                todos: [{ actualEndDate: null }, { actualEndDate: null }],
              },
            ],
          },
        ],
      },
      today,
    )
    expect(result.actualPct).toBe(0)
  })

  it('Milestone レベル / Task レベルで期間日数加重平均が機能する', () => {
    // M1: 期間 30 日、Task 1 つ (todos 2件中 1件 完了 → 50%)
    // M2: 期間 90 日、Task 1 つ (todos 4件中 2件 完了 → 50%)
    // 両方 50% なので加重平均は 50%
    const today = d('2026-07-01')
    const result = buildProjectSummary(
      {
        startDate: projectStart,
        endDate: projectEnd,
        milestones: [
          {
            startDate: d('2026-01-01'),
            endDate: d('2026-01-31'),
            tasks: [
              {
                startDate: d('2026-01-01'),
                endDate: d('2026-01-31'),
                todos: [{ actualEndDate: d('2026-01-15') }, { actualEndDate: null }],
              },
            ],
          },
          {
            startDate: d('2026-02-01'),
            endDate: d('2026-05-01'),
            tasks: [
              {
                startDate: d('2026-02-01'),
                endDate: d('2026-05-01'),
                todos: [
                  { actualEndDate: d('2026-02-15') },
                  { actualEndDate: d('2026-03-01') },
                  { actualEndDate: null },
                  { actualEndDate: null },
                ],
              },
            ],
          },
        ],
      },
      today,
    )
    expect(result.actualPct).toBe(50)
  })

  it('返り値型 ProjectSummary に scheduledPct と actualPct を含む', () => {
    const today = d('2026-07-01')
    const result: ProjectSummary = buildProjectSummary(
      { startDate: projectStart, endDate: projectEnd, milestones: [] },
      today,
    )
    expect(result).toHaveProperty('scheduledPct')
    expect(result).toHaveProperty('actualPct')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// buildDelaySummary
// ────────────────────────────────────────────────────────────────────────────
describe('buildDelaySummary', () => {
  it('空配列は全ゼロ', () => {
    const result = buildDelaySummary([], d('2026-05-15'))
    expect(result).toEqual<DelaySummary>({
      delayedCount: 0,
      maxDelayDays: 0,
      notStartedRiskCount: 0,
    })
  })

  it('遅延なし: 全タスク in-progress は delayedCount=0', () => {
    const tasks = [
      {
        status: 'in-progress' as Status,
        actualPct: 50,
        scheduledPct: 40,
        hasAnyActualStart: true,
        startDate: d('2026-01-01'),
        endDate: d('2026-12-31'),
      },
    ]
    const result = buildDelaySummary(tasks, d('2026-05-15'))
    expect(result.delayedCount).toBe(0)
    expect(result.notStartedRiskCount).toBe(0)
  })

  it('遅延 1 件: delayedCount=1', () => {
    const tasks = [
      {
        status: 'delayed' as Status,
        actualPct: 20,
        scheduledPct: 50,
        hasAnyActualStart: true,
        startDate: d('2026-01-01'),
        endDate: d('2026-04-30'),
      },
    ]
    const result = buildDelaySummary(tasks, d('2026-05-15'))
    expect(result.delayedCount).toBe(1)
  })

  it('未着手リスク 1 件: notStartedRiskCount=1 かつ delayedCount も 1', () => {
    const tasks = [
      {
        status: 'delayed' as Status,
        actualPct: 0,
        scheduledPct: 50,
        hasAnyActualStart: false,
        startDate: d('2026-04-01'),
        endDate: d('2026-04-30'),
      },
    ]
    const result = buildDelaySummary(tasks, d('2026-05-15'))
    expect(result.delayedCount).toBe(1)
    expect(result.notStartedRiskCount).toBe(1)
  })

  it('未着手リスク判定: today <= startDate のタスクはリスクにならない', () => {
    const tasks = [
      {
        status: 'not-started' as Status,
        actualPct: 0,
        scheduledPct: 0,
        hasAnyActualStart: false,
        startDate: d('2026-06-01'),
        endDate: d('2026-12-31'),
      },
    ]
    const result = buildDelaySummary(tasks, d('2026-05-15'))
    expect(result.delayedCount).toBe(0)
    expect(result.notStartedRiskCount).toBe(0)
  })

  it('maxDelayDays: 期日超過日数と予定乖離日数の大きい方を採用', () => {
    const today = d('2026-05-15')
    // タスク: 2026-01-01 〜 2026-04-30 (119日), actualPct=0, scheduledPct=100
    // today - endDate = (2026-05-15 - 2026-04-30) = 15日
    // (100-0) * 119 / 100 = 119日
    // max(15, 119) = 119
    const tasks = [
      {
        status: 'delayed' as Status,
        actualPct: 0,
        scheduledPct: 100,
        hasAnyActualStart: false,
        startDate: d('2026-01-01'),
        endDate: d('2026-04-30'),
      },
    ]
    const result = buildDelaySummary(tasks, today)
    expect(result.maxDelayDays).toBe(119)
  })

  it('maxDelayDays: 複数タスクの最大値を返す', () => {
    const today = d('2026-05-15')
    // タスクA: endDate=2026-04-01(44日超過), scheduledPct=100, actualPct=0, period=90日 → max(44, 90)=90
    // タスクB: endDate=2026-03-01(75日超過), scheduledPct=100, actualPct=0, period=59日 → max(75, 59)=75
    const tasks = [
      {
        status: 'delayed' as Status,
        actualPct: 0,
        scheduledPct: 100,
        hasAnyActualStart: false,
        startDate: d('2026-01-01'),
        endDate: d('2026-04-01'), // 44日超過
      },
      {
        status: 'delayed' as Status,
        actualPct: 0,
        scheduledPct: 100,
        hasAnyActualStart: false,
        startDate: d('2026-01-01'),
        endDate: d('2026-03-01'), // 75日超過
      },
    ]
    const result = buildDelaySummary(tasks, today)
    // タスクA: endDate=04-01, period=(Jan1~Apr1)=90日, max(44, 90)=90
    // タスクB: endDate=03-01, period=(Jan1~Mar1)=59日, max(75, 59)=75
    expect(result.maxDelayDays).toBe(90)
  })

  it('completed/not-started タスクは delayedCount に含まれない', () => {
    const tasks = [
      {
        status: 'completed' as Status,
        actualPct: 100,
        scheduledPct: 100,
        hasAnyActualStart: true,
        startDate: d('2026-01-01'),
        endDate: d('2026-03-31'),
      },
      {
        status: 'not-started' as Status,
        actualPct: 0,
        scheduledPct: 0,
        hasAnyActualStart: false,
        startDate: d('2026-06-01'),
        endDate: d('2026-12-31'),
      },
    ]
    const result = buildDelaySummary(tasks, d('2026-05-15'))
    expect(result.delayedCount).toBe(0)
    expect(result.notStartedRiskCount).toBe(0)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// matchesFilter — フィルター真理表 5×5 全件
// ────────────────────────────────────────────────────────────────────────────

/**
 * フィルター真理表 (Section 2.4)
 *
 * | 行の status            | all | delayed | not-started-risk | in-progress | completed |
 * | ---------------------- | --- | ------- | ---------------- | ----------- | --------- |
 * | completed              | ✓   | —       | —                | —           | ✓         |
 * | in-progress            | ✓   | —       | —                | ✓           | —         |
 * | delayed (進行中で遅延) | ✓   | ✓       | —                | —           | —         |
 * | delayed (未着手リスク) | ✓   | ✓       | ✓                | —           | —         |
 * | not-started (開始日前) | ✓   | —       | —                | —           | —         |
 */
describe('matchesFilter — フィルター真理表 5×5', () => {
  const today = d('2026-05-15')
  // ── 行1: completed ───────────────────────────────────────────────────────
  describe('行: completed', () => {
    const row = {
      status: 'completed' as Status,
      actualPct: 100,
      hasAnyActualStart: true,
      startDate: d('2026-01-01'),
      today,
    }

    it('all → true', () => expect(matchesFilter(row, 'all')).toBe(true))
    it('delayed → false', () => expect(matchesFilter(row, 'delayed')).toBe(false))
    it('not-started-risk → false', () => expect(matchesFilter(row, 'not-started-risk')).toBe(false))
    it('in-progress → false', () => expect(matchesFilter(row, 'in-progress')).toBe(false))
    it('completed → true', () => expect(matchesFilter(row, 'completed')).toBe(true))
  })

  // ── 行2: in-progress ─────────────────────────────────────────────────────
  describe('行: in-progress', () => {
    const row = {
      status: 'in-progress' as Status,
      actualPct: 50,
      hasAnyActualStart: true,
      startDate: d('2026-01-01'),
      today,
    }

    it('all → true', () => expect(matchesFilter(row, 'all')).toBe(true))
    it('delayed → false', () => expect(matchesFilter(row, 'delayed')).toBe(false))
    it('not-started-risk → false', () => expect(matchesFilter(row, 'not-started-risk')).toBe(false))
    it('in-progress → true', () => expect(matchesFilter(row, 'in-progress')).toBe(true))
    it('completed → false', () => expect(matchesFilter(row, 'completed')).toBe(false))
  })

  // ── 行3: delayed (進行中で遅延) ──────────────────────────────────────────
  describe('行: delayed — 進行中で遅延 (actualPct>0)', () => {
    const row = {
      status: 'delayed' as Status,
      actualPct: 20, // > 0 なのでリスクではない
      hasAnyActualStart: true,
      startDate: d('2026-01-01'),
      today,
    }

    it('all → true', () => expect(matchesFilter(row, 'all')).toBe(true))
    it('delayed → true', () => expect(matchesFilter(row, 'delayed')).toBe(true))
    it('not-started-risk → false', () => expect(matchesFilter(row, 'not-started-risk')).toBe(false))
    it('in-progress → false', () => expect(matchesFilter(row, 'in-progress')).toBe(false))
    it('completed → false', () => expect(matchesFilter(row, 'completed')).toBe(false))
  })

  // ── 行4: delayed (未着手リスク) ──────────────────────────────────────────
  describe('行: delayed — 未着手リスク (actualPct=0 && !hasAnyActualStart && today > startDate)', () => {
    const row = {
      status: 'delayed' as Status,
      actualPct: 0,
      hasAnyActualStart: false,
      startDate: d('2026-04-01'), // today(05-15) > startDate(04-01) → リスク
      today,
    }

    it('all → true', () => expect(matchesFilter(row, 'all')).toBe(true))
    it('delayed → true', () => expect(matchesFilter(row, 'delayed')).toBe(true))
    it('not-started-risk → true', () => expect(matchesFilter(row, 'not-started-risk')).toBe(true))
    it('in-progress → false', () => expect(matchesFilter(row, 'in-progress')).toBe(false))
    it('completed → false', () => expect(matchesFilter(row, 'completed')).toBe(false))
  })

  // ── 行5: not-started (開始日前) ──────────────────────────────────────────
  describe('行: not-started (開始日前)', () => {
    const row = {
      status: 'not-started' as Status,
      actualPct: 0,
      hasAnyActualStart: false,
      startDate: d('2026-06-01'), // today(05-15) < startDate → 未着手リスクではない
      today,
    }

    it('all → true', () => expect(matchesFilter(row, 'all')).toBe(true))
    it('delayed → false', () => expect(matchesFilter(row, 'delayed')).toBe(false))
    it('not-started-risk → false', () => expect(matchesFilter(row, 'not-started-risk')).toBe(false))
    it('in-progress → false', () => expect(matchesFilter(row, 'in-progress')).toBe(false))
    it('completed → false', () => expect(matchesFilter(row, 'completed')).toBe(false))
  })

  // ── not-started-risk の境界: today === startDate はリスクにならない ────────
  describe('not-started-risk 境界: today === startDate はリスク外 (today > startDate が条件)', () => {
    it('delayed かつ today === startDate は not-started-risk=false', () => {
      const row = {
        status: 'delayed' as Status,
        actualPct: 0,
        hasAnyActualStart: false,
        startDate: today, // startDate = today → today > startDate は false
        today,
      }
      expect(matchesFilter(row, 'not-started-risk')).toBe(false)
    })
  })

  // ── 全フィルターで "all" は常に true ─────────────────────────────────────
  describe('all フィルターはすべての status で true', () => {
    const statuses: Status[] = ['completed', 'in-progress', 'delayed', 'not-started']
    statuses.forEach((status) => {
      it(`status=${status} → all=true`, () => {
        const row = {
          status,
          actualPct: status === 'completed' ? 100 : 0,
          hasAnyActualStart: false,
          startDate: d('2026-01-01'),
          today,
        }
        expect(matchesFilter(row, 'all')).toBe(true)
      })
    })
  })
})
