import { describe, it, expect } from 'vitest'
import {
  buildGanttRows,
  hasMatchingDescendant,
  collectTaskRowsForDelaySummary,
  type ProjectForGantt,
} from '@/lib/gantt-rows'

function d(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

const today = d(2025, 6, 1)

function makeProject(overrides?: Partial<ProjectForGantt>): ProjectForGantt {
  return {
    startDate: d(2025, 1, 1),
    endDate: d(2025, 12, 31),
    milestones: [
      {
        id: 'ms-1',
        name: 'M1',
        startDate: d(2025, 3, 1),
        endDate: d(2025, 8, 31),
        tasks: [
          {
            id: 't-1',
            name: 'T1',
            startDate: d(2025, 3, 1),
            endDate: d(2025, 5, 31),
            todos: [
              {
                id: 'td-1',
                name: 'TD1',
                startDate: d(2025, 3, 1),
                endDate: d(2025, 4, 30),
                actualStartDate: d(2025, 3, 5),
                actualEndDate: d(2025, 4, 25),
              },
              {
                id: 'td-2',
                name: 'TD2',
                startDate: d(2025, 5, 1),
                endDate: d(2025, 5, 31),
                actualStartDate: d(2025, 5, 1),
                actualEndDate: null,
              },
            ],
          },
        ],
      },
    ],
    ...overrides,
  }
}

describe('buildGanttRows — 階層構造', () => {
  it('Milestone → Task → ToDo の階層を返す', () => {
    const rows = buildGanttRows(makeProject(), today)
    expect(rows).toHaveLength(1)
    expect(rows[0].type).toBe('milestone')
    expect(rows[0].children).toHaveLength(1)
    expect(rows[0].children[0].type).toBe('task')
    expect(rows[0].children[0].children).toHaveLength(2)
    expect(rows[0].children[0].children[0].type).toBe('todo')
  })

  it('WBS 番号 (1-indexed) を付与する', () => {
    const rows = buildGanttRows(makeProject(), today)
    expect(rows[0].wbs).toBe('1')
    expect(rows[0].children[0].wbs).toBe('1.1')
    expect(rows[0].children[0].children[0].wbs).toBe('1.1.1')
    expect(rows[0].children[0].children[1].wbs).toBe('1.1.2')
  })

  it('Task の taskId が設定される (進捗入力リンク用)', () => {
    const rows = buildGanttRows(makeProject(), today)
    expect(rows[0].children[0].taskId).toBe('t-1')
    expect(rows[0].taskId).toBeUndefined()
    expect(rows[0].children[0].children[0].taskId).toBeUndefined()
  })
})

describe('buildGanttRows — actualPct 計算', () => {
  it('ToDo.actualPct: actualEndDate あり → 100、なし → 0', () => {
    const rows = buildGanttRows(makeProject(), today)
    expect(rows[0].children[0].children[0].actualPct).toBe(100)
    expect(rows[0].children[0].children[1].actualPct).toBe(0)
  })

  it('Task.actualPct = 完了 ToDo 数 / 全 ToDo 数 × 100 (1/2 で 50%)', () => {
    const rows = buildGanttRows(makeProject(), today)
    expect(rows[0].children[0].actualPct).toBe(50)
  })

  it('Milestone.actualPct: 子 Task の actualPct を期間日数加重平均', () => {
    const rows = buildGanttRows(makeProject(), today)
    // 1 Task のみなので 50% がそのまま伝播
    expect(rows[0].actualPct).toBe(50)
  })
})

describe('buildGanttRows — hasAnyActualStart', () => {
  it('ToDo: actualStartDate != null → true', () => {
    const rows = buildGanttRows(makeProject(), today)
    expect(rows[0].children[0].children[0].hasAnyActualStart).toBe(true)
  })

  it('Task: 配下 ToDo のいずれかに actualStartDate ありで true', () => {
    const rows = buildGanttRows(makeProject(), today)
    expect(rows[0].children[0].hasAnyActualStart).toBe(true)
  })

  it('Task: 配下全 ToDo の actualStartDate が null なら false', () => {
    const project = makeProject({
      milestones: [
        {
          id: 'ms-1',
          name: 'M',
          startDate: d(2025, 3, 1),
          endDate: d(2025, 5, 31),
          tasks: [
            {
              id: 't-1',
              name: 'T',
              startDate: d(2025, 3, 1),
              endDate: d(2025, 5, 31),
              todos: [
                {
                  id: 'td-1',
                  name: 'TD',
                  startDate: d(2025, 3, 1),
                  endDate: d(2025, 4, 30),
                  actualStartDate: null,
                  actualEndDate: null,
                },
              ],
            },
          ],
        },
      ],
    })
    const rows = buildGanttRows(project, today)
    expect(rows[0].children[0].hasAnyActualStart).toBe(false)
    expect(rows[0].hasAnyActualStart).toBe(false)
  })
})

describe('buildGanttRows — status 判定', () => {
  it('未着手 ToDo (未来 startDate): not-started', () => {
    const project = makeProject({
      milestones: [
        {
          id: 'ms',
          name: 'M',
          startDate: d(2025, 7, 1),
          endDate: d(2025, 8, 31),
          tasks: [
            {
              id: 't',
              name: 'T',
              startDate: d(2025, 7, 1),
              endDate: d(2025, 8, 31),
              todos: [
                {
                  id: 'td',
                  name: 'TD',
                  startDate: d(2025, 7, 1),
                  endDate: d(2025, 8, 31),
                  actualStartDate: null,
                  actualEndDate: null,
                },
              ],
            },
          ],
        },
      ],
    })
    const rows = buildGanttRows(project, today)
    expect(rows[0].children[0].children[0].status).toBe('not-started')
  })

  it('未着手リスク (過去 startDate, 未着手): delayed', () => {
    const project = makeProject({
      milestones: [
        {
          id: 'ms',
          name: 'M',
          startDate: d(2025, 4, 1),
          endDate: d(2025, 5, 31),
          tasks: [
            {
              id: 't',
              name: 'T',
              startDate: d(2025, 4, 1),
              endDate: d(2025, 5, 31),
              todos: [
                {
                  id: 'td',
                  name: 'TD',
                  startDate: d(2025, 4, 1),
                  endDate: d(2025, 5, 31),
                  actualStartDate: null,
                  actualEndDate: null,
                },
              ],
            },
          ],
        },
      ],
    })
    const rows = buildGanttRows(project, today)
    expect(rows[0].children[0].children[0].status).toBe('delayed')
  })

  it('完了 ToDo: completed', () => {
    const rows = buildGanttRows(makeProject(), today)
    expect(rows[0].children[0].children[0].status).toBe('completed')
  })

  it('Task の actualStartDate / actualEndDate を子 ToDo から集約する (in-progress 子あり → actualEndDate=null)', () => {
    const rows = buildGanttRows(makeProject(), today)
    // td-1: actualStart=3/5, actualEnd=4/25 (completed)
    // td-2: actualStart=5/1, actualEnd=null (in-progress)
    expect(rows[0].children[0].actualStartDate).toEqual(d(2025, 3, 5)) // min
    expect(rows[0].children[0].actualEndDate).toBeNull() // in-progress 子があるため
  })

  it('Task の actualEndDate を集約 (全子完了 → max(actualEndDate))', () => {
    const project = makeProject({
      milestones: [
        {
          id: 'ms',
          name: 'M',
          startDate: d(2025, 3, 1),
          endDate: d(2025, 5, 31),
          tasks: [
            {
              id: 't',
              name: 'T',
              startDate: d(2025, 3, 1),
              endDate: d(2025, 5, 31),
              todos: [
                {
                  id: 'td1',
                  name: 'TD1',
                  startDate: d(2025, 3, 1),
                  endDate: d(2025, 4, 1),
                  actualStartDate: d(2025, 3, 5),
                  actualEndDate: d(2025, 3, 30),
                },
                {
                  id: 'td2',
                  name: 'TD2',
                  startDate: d(2025, 4, 1),
                  endDate: d(2025, 5, 31),
                  actualStartDate: d(2025, 4, 5),
                  actualEndDate: d(2025, 5, 20),
                },
              ],
            },
          ],
        },
      ],
    })
    const rows = buildGanttRows(project, today)
    expect(rows[0].children[0].actualStartDate).toEqual(d(2025, 3, 5)) // min
    expect(rows[0].children[0].actualEndDate).toEqual(d(2025, 5, 20)) // max
  })

  it('Task の actualStartDate / actualEndDate は子が全未着手なら null', () => {
    const project = makeProject({
      milestones: [
        {
          id: 'ms',
          name: 'M',
          startDate: d(2025, 7, 1),
          endDate: d(2025, 8, 31),
          tasks: [
            {
              id: 't',
              name: 'T',
              startDate: d(2025, 7, 1),
              endDate: d(2025, 8, 31),
              todos: [
                {
                  id: 'td',
                  name: 'TD',
                  startDate: d(2025, 7, 1),
                  endDate: d(2025, 8, 31),
                  actualStartDate: null,
                  actualEndDate: null,
                },
              ],
            },
          ],
        },
      ],
    })
    const rows = buildGanttRows(project, today)
    expect(rows[0].children[0].actualStartDate).toBeNull()
    expect(rows[0].children[0].actualEndDate).toBeNull()
  })

  it('Milestone の actualStartDate / actualEndDate を配下全 ToDo から集約する', () => {
    const rows = buildGanttRows(makeProject(), today)
    // makeProject: ms-1 配下に t-1、t-1 配下に td-1 (completed 3/5→4/25) + td-2 (in-progress 5/1→)
    expect(rows[0].actualStartDate).toEqual(d(2025, 3, 5))
    expect(rows[0].actualEndDate).toBeNull()
  })

  it('ToDo 0 件の Task は not-started 扱い (phantom delayed 防止)', () => {
    const project = makeProject({
      milestones: [
        {
          id: 'ms',
          name: 'M',
          startDate: d(2025, 3, 1),
          endDate: d(2025, 5, 31),
          tasks: [
            {
              id: 't-empty',
              name: 'Empty Task',
              startDate: d(2025, 3, 1), // 過去 startDate
              endDate: d(2025, 5, 31),
              todos: [], // ToDo なし
            },
          ],
        },
      ],
    })
    const rows = buildGanttRows(project, today)
    expect(rows[0].children[0].status).toBe('not-started')
  })
})

describe('hasMatchingDescendant', () => {
  it('filter=all は常に true', () => {
    const rows = buildGanttRows(makeProject(), today)
    expect(hasMatchingDescendant(rows[0], 'all', today)).toBe(true)
  })

  it('milestone 自身が一致しなくても子 task が一致すれば true', () => {
    const project = makeProject({
      milestones: [
        {
          id: 'ms',
          name: 'M',
          startDate: d(2025, 4, 1),
          endDate: d(2025, 12, 1),
          tasks: [
            {
              id: 't',
              name: 'T',
              startDate: d(2025, 4, 1),
              endDate: d(2025, 5, 1),
              todos: [
                {
                  id: 'td',
                  name: 'TD',
                  startDate: d(2025, 4, 1),
                  endDate: d(2025, 5, 1),
                  actualStartDate: null,
                  actualEndDate: null,
                },
              ],
            },
          ],
        },
      ],
    })
    const rows = buildGanttRows(project, today)
    // milestone.status は delayed (配下子の actualPct=0 が反映)、task.status も delayed
    // → 'delayed' filter で true
    expect(hasMatchingDescendant(rows[0], 'delayed', today)).toBe(true)
  })

  it('未着手リスク filter: 該当 ToDo を持たない milestone は false', () => {
    const project = makeProject({
      milestones: [
        {
          id: 'ms',
          name: 'M',
          startDate: d(2025, 3, 1),
          endDate: d(2025, 5, 1),
          tasks: [
            {
              id: 't',
              name: 'T',
              startDate: d(2025, 3, 1),
              endDate: d(2025, 5, 1),
              todos: [
                {
                  id: 'td',
                  name: 'TD',
                  startDate: d(2025, 3, 1),
                  endDate: d(2025, 5, 1),
                  actualStartDate: d(2025, 3, 5),
                  actualEndDate: d(2025, 4, 25),
                },
              ],
            },
          ],
        },
      ],
    })
    const rows = buildGanttRows(project, today)
    expect(hasMatchingDescendant(rows[0], 'not-started-risk', today)).toBe(false)
  })

  it('completed filter: milestone 配下に completed ToDo があれば true', () => {
    const rows = buildGanttRows(makeProject(), today)
    expect(hasMatchingDescendant(rows[0], 'completed', today)).toBe(true)
  })
})

describe('collectTaskRowsForDelaySummary', () => {
  it('Task レベルのみ抽出する (ToDo は含まない)', () => {
    const rows = buildGanttRows(makeProject(), today)
    const tasks = collectTaskRowsForDelaySummary(rows)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].startDate).toEqual(d(2025, 3, 1))
  })

  it('空 milestones なら空配列', () => {
    const rows = buildGanttRows({ ...makeProject(), milestones: [] }, today)
    expect(collectTaskRowsForDelaySummary(rows)).toEqual([])
  })
})
