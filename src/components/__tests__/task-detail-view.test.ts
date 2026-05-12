import { describe, it, expect } from 'vitest'
import { calcTodoBarPosition, getBottleneckClass } from '@/components/task-detail/task-detail-utils'
import type { ProgressStatus } from '@/types/progress'

// ─── calcTodoBarPosition ─────────────────────────────────────────────────────

describe('calcTodoBarPosition', () => {
  it('通常ケース: ToDo がタスクスコープ内に収まる', () => {
    const taskStart = new Date('2026-01-01').getTime()
    const taskEnd = new Date('2026-12-31').getTime()
    const todoStart = new Date('2026-04-01').getTime()
    const todoEnd = new Date('2026-07-01').getTime()

    const { offsetPct, widthPct } = calcTodoBarPosition(taskStart, taskEnd, todoStart, todoEnd)

    expect(offsetPct).toBeGreaterThan(0)
    expect(offsetPct).toBeLessThan(100)
    expect(widthPct).toBeGreaterThan(0)
    expect(widthPct).toBeLessThan(100)
    expect(offsetPct + widthPct).toBeLessThanOrEqual(100)
  })

  it('スコープ左外クリップ: ToDo がタスク開始より前に始まる', () => {
    const taskStart = new Date('2026-04-01').getTime()
    const taskEnd = new Date('2026-12-31').getTime()
    const todoStart = new Date('2026-01-01').getTime() // タスク開始より前
    const todoEnd = new Date('2026-06-01').getTime()

    const { offsetPct, widthPct } = calcTodoBarPosition(taskStart, taskEnd, todoStart, todoEnd)

    expect(offsetPct).toBe(0)
    expect(widthPct).toBeGreaterThan(0)
  })

  it('スコープ右外クリップ: ToDo がタスク終了より後に終わる', () => {
    const taskStart = new Date('2026-01-01').getTime()
    const taskEnd = new Date('2026-06-01').getTime()
    const todoStart = new Date('2026-04-01').getTime()
    const todoEnd = new Date('2026-12-31').getTime() // タスク終了より後

    const { offsetPct, widthPct } = calcTodoBarPosition(taskStart, taskEnd, todoStart, todoEnd)

    expect(offsetPct).toBeLessThan(100)
    expect(offsetPct + widthPct).toBeLessThanOrEqual(100)
  })

  it('ゼロ除算ガード: taskStart === taskEnd のとき offsetPct=0, widthPct=100', () => {
    const sameTime = new Date('2026-01-01').getTime()
    const todoStart = new Date('2026-01-01').getTime()
    const todoEnd = new Date('2026-06-01').getTime()

    const { offsetPct, widthPct } = calcTodoBarPosition(sameTime, sameTime, todoStart, todoEnd)

    expect(offsetPct).toBe(0)
    expect(widthPct).toBe(100)
  })

  it('offsetPct 上限クランプ: ToDo がタスクスコープ右外に完全にある', () => {
    const taskStart = new Date('2026-01-01').getTime()
    const taskEnd = new Date('2026-06-01').getTime()
    const todoStart = new Date('2026-07-01').getTime() // タスク終了より後
    const todoEnd = new Date('2026-12-31').getTime()

    const { offsetPct, widthPct } = calcTodoBarPosition(taskStart, taskEnd, todoStart, todoEnd)

    // offsetPct は 100 にクランプされ、widthPct は最小 1
    expect(offsetPct).toBe(100)
    expect(widthPct).toBe(1)
  })

  it('widthPct の最小値は 1', () => {
    const taskStart = new Date('2026-01-01').getTime()
    const taskEnd = new Date('2026-12-31').getTime()
    const todoStart = new Date('2026-06-01').getTime()
    const todoEnd = new Date('2026-06-01').getTime() // 同じ日付

    const { widthPct } = calcTodoBarPosition(taskStart, taskEnd, todoStart, todoEnd)

    expect(widthPct).toBeGreaterThanOrEqual(1)
  })

  it('ToDo がタスクと同じ範囲: offsetPct=0, widthPct=100', () => {
    const taskStart = new Date('2026-01-01').getTime()
    const taskEnd = new Date('2026-12-31').getTime()

    const { offsetPct, widthPct } = calcTodoBarPosition(taskStart, taskEnd, taskStart, taskEnd)

    expect(offsetPct).toBe(0)
    expect(widthPct).toBe(100)
  })
})

// ─── getBottleneckClass ──────────────────────────────────────────────────────

describe('getBottleneckClass', () => {
  it('status が warning のとき赤背景クラスを返す', () => {
    const cls = getBottleneckClass('warning' as ProgressStatus)
    expect(cls).toContain('bg-red-50')
    expect(cls).toContain('border-l-2')
    expect(cls).toContain('border-red-400')
  })

  it('status が on-track のとき空文字を返す', () => {
    const cls = getBottleneckClass('on-track' as ProgressStatus)
    expect(cls).toBe('')
  })

  it('status が delayed のとき空文字を返す', () => {
    const cls = getBottleneckClass('delayed' as ProgressStatus)
    expect(cls).toBe('')
  })

  it('status が completed のとき空文字を返す', () => {
    const cls = getBottleneckClass('completed' as ProgressStatus)
    expect(cls).toBe('')
  })

  it('status が scheduled のとき空文字を返す', () => {
    const cls = getBottleneckClass('scheduled' as ProgressStatus)
    expect(cls).toBe('')
  })
})
