import { describe, it, expect } from 'vitest'
import { calcStatus } from '@/lib/status'
import type { Status } from '@/lib/status'

// spec 4.3 表と 1:1 対応するヘルパー
const d = (s: string) => new Date(s + 'T00:00:00Z')

describe('calcStatus — spec 4.3 表との 1:1 対応', () => {
  // ─── 行1: 完了 ───────────────────────────────────────────────────────────
  describe('完了 (actualPct = 100)', () => {
    it('actualPct=100 なら他の条件に関わらず completed を返す', () => {
      const result = calcStatus({
        actualPct: 100,
        scheduledPct: 80,
        startDate: d('2026-01-01'),
        endDate: d('2026-03-31'),
        today: d('2026-02-15'),
        hasAnyActualStart: true,
      })
      expect(result).toBe<Status>('completed')
    })

    it('actualPct=100 かつ today < startDate でも completed', () => {
      const result = calcStatus({
        actualPct: 100,
        scheduledPct: 0,
        startDate: d('2026-06-01'),
        endDate: d('2026-12-31'),
        today: d('2026-05-15'),
        hasAnyActualStart: false,
      })
      expect(result).toBe<Status>('completed')
    })

    it('actualPct=100 かつ scheduledPct=100 でも completed', () => {
      const result = calcStatus({
        actualPct: 100,
        scheduledPct: 100,
        startDate: d('2026-01-01'),
        endDate: d('2026-03-31'),
        today: d('2026-04-01'),
        hasAnyActualStart: true,
      })
      expect(result).toBe<Status>('completed')
    })
  })

  // ─── 行2: 未着手 (開始日前) ──────────────────────────────────────────────
  describe('未着手 (actualPct=0 && !hasAnyActualStart && today < startDate)', () => {
    it('開始日前の未着手は not-started', () => {
      const result = calcStatus({
        actualPct: 0,
        scheduledPct: 0,
        startDate: d('2026-06-01'),
        endDate: d('2026-12-31'),
        today: d('2026-05-31'),
        hasAnyActualStart: false,
      })
      expect(result).toBe<Status>('not-started')
    })

    it('境界: today が startDate の前日は not-started', () => {
      const result = calcStatus({
        actualPct: 0,
        scheduledPct: 0,
        startDate: d('2026-05-16'),
        endDate: d('2026-06-30'),
        today: d('2026-05-15'),
        hasAnyActualStart: false,
      })
      expect(result).toBe<Status>('not-started')
    })

    it('scheduledPct が正でも today < startDate かつ actualPct=0 かつ !hasAnyActualStart なら not-started', () => {
      // 不整合データだが関数は日付で判断
      const result = calcStatus({
        actualPct: 0,
        scheduledPct: 50,
        startDate: d('2026-06-01'),
        endDate: d('2026-12-31'),
        today: d('2026-05-15'),
        hasAnyActualStart: false,
      })
      expect(result).toBe<Status>('not-started')
    })
  })

  // ─── 行3/4: 遅延 ─────────────────────────────────────────────────────────
  describe('遅延 — 未着手リスク (actualPct=0 && !hasAnyActualStart && today >= startDate)', () => {
    it('today === startDate の未着手は delayed (未着手リスク)', () => {
      const result = calcStatus({
        actualPct: 0,
        scheduledPct: 0,
        startDate: d('2026-05-15'),
        endDate: d('2026-06-30'),
        today: d('2026-05-15'),
        hasAnyActualStart: false,
      })
      expect(result).toBe<Status>('delayed')
    })

    it('today > startDate の未着手は delayed (未着手リスク)', () => {
      const result = calcStatus({
        actualPct: 0,
        scheduledPct: 30,
        startDate: d('2026-04-01'),
        endDate: d('2026-06-30'),
        today: d('2026-05-15'),
        hasAnyActualStart: false,
      })
      expect(result).toBe<Status>('delayed')
    })

    it('today > endDate の未着手は delayed', () => {
      const result = calcStatus({
        actualPct: 0,
        scheduledPct: 100,
        startDate: d('2026-01-01'),
        endDate: d('2026-03-31'),
        today: d('2026-05-15'),
        hasAnyActualStart: false,
      })
      expect(result).toBe<Status>('delayed')
    })
  })

  describe('遅延 — 進行中で遅延 (actualPct > 0 && actualPct < scheduledPct)', () => {
    it('actualPct < scheduledPct は delayed', () => {
      const result = calcStatus({
        actualPct: 20,
        scheduledPct: 50,
        startDate: d('2026-01-01'),
        endDate: d('2026-06-30'),
        today: d('2026-04-01'),
        hasAnyActualStart: true,
      })
      expect(result).toBe<Status>('delayed')
    })

    it('境界: actualPct = scheduledPct - 1 は delayed', () => {
      const result = calcStatus({
        actualPct: 49,
        scheduledPct: 50,
        startDate: d('2026-01-01'),
        endDate: d('2026-06-30'),
        today: d('2026-04-01'),
        hasAnyActualStart: true,
      })
      expect(result).toBe<Status>('delayed')
    })

    it('actualPct=1 scheduledPct=100 は delayed', () => {
      const result = calcStatus({
        actualPct: 1,
        scheduledPct: 100,
        startDate: d('2026-01-01'),
        endDate: d('2026-03-31'),
        today: d('2026-05-15'),
        hasAnyActualStart: true,
      })
      expect(result).toBe<Status>('delayed')
    })
  })

  // ─── 行5/6: 進行中 ───────────────────────────────────────────────────────
  describe('進行中 (actualPct >= scheduledPct かつ actualPct < 100)', () => {
    it('actualPct === scheduledPct (0 以外) は in-progress', () => {
      const result = calcStatus({
        actualPct: 50,
        scheduledPct: 50,
        startDate: d('2026-01-01'),
        endDate: d('2026-06-30'),
        today: d('2026-04-01'),
        hasAnyActualStart: true,
      })
      expect(result).toBe<Status>('in-progress')
    })

    it('actualPct > scheduledPct は in-progress (順調)', () => {
      const result = calcStatus({
        actualPct: 70,
        scheduledPct: 50,
        startDate: d('2026-01-01'),
        endDate: d('2026-06-30'),
        today: d('2026-04-01'),
        hasAnyActualStart: true,
      })
      expect(result).toBe<Status>('in-progress')
    })

    it('境界: actualPct = scheduledPct + 1 は in-progress', () => {
      const result = calcStatus({
        actualPct: 51,
        scheduledPct: 50,
        startDate: d('2026-01-01'),
        endDate: d('2026-06-30'),
        today: d('2026-04-01'),
        hasAnyActualStart: true,
      })
      expect(result).toBe<Status>('in-progress')
    })

    it('scheduledPct=0 かつ actualPct=50 は in-progress', () => {
      const result = calcStatus({
        actualPct: 50,
        scheduledPct: 0,
        startDate: d('2026-05-16'),
        endDate: d('2026-12-31'),
        today: d('2026-05-15'),
        hasAnyActualStart: true,
      })
      expect(result).toBe<Status>('in-progress')
    })
  })

  // ─── 行6: 集約特殊ケース ─────────────────────────────────────────────────
  describe('集約特殊ケース: actualPct=0 かつ hasAnyActualStart=true', () => {
    it('子に着手済みが1件あるが集計0%なら in-progress (spec 2.1 行6)', () => {
      const result = calcStatus({
        actualPct: 0,
        scheduledPct: 30,
        startDate: d('2026-01-01'),
        endDate: d('2026-06-30'),
        today: d('2026-02-15'),
        hasAnyActualStart: true,
      })
      expect(result).toBe<Status>('in-progress')
    })

    it('actualPct=0 && hasAnyActualStart=true && today < startDate でも in-progress', () => {
      const result = calcStatus({
        actualPct: 0,
        scheduledPct: 0,
        startDate: d('2026-06-01'),
        endDate: d('2026-12-31'),
        today: d('2026-05-15'),
        hasAnyActualStart: true,
      })
      expect(result).toBe<Status>('in-progress')
    })

    it('actualPct=0 && hasAnyActualStart=true && scheduledPct=100 でも in-progress', () => {
      const result = calcStatus({
        actualPct: 0,
        scheduledPct: 100,
        startDate: d('2026-01-01'),
        endDate: d('2026-03-31'),
        today: d('2026-04-01'),
        hasAnyActualStart: true,
      })
      expect(result).toBe<Status>('in-progress')
    })
  })

  // ─── 境界条件 ──────────────────────────────────────────────────────────────
  describe('境界条件', () => {
    it('today === endDate: actualPct=100 は completed', () => {
      const result = calcStatus({
        actualPct: 100,
        scheduledPct: 100,
        startDate: d('2026-01-01'),
        endDate: d('2026-05-15'),
        today: d('2026-05-15'),
        hasAnyActualStart: true,
      })
      expect(result).toBe<Status>('completed')
    })

    it('today === endDate: actualPct < 100 は delayed (scheduledPct=100)', () => {
      const result = calcStatus({
        actualPct: 80,
        scheduledPct: 100,
        startDate: d('2026-01-01'),
        endDate: d('2026-05-15'),
        today: d('2026-05-15'),
        hasAnyActualStart: true,
      })
      expect(result).toBe<Status>('delayed')
    })

    it('today === startDate: actualPct=0 && !hasAnyActualStart は delayed', () => {
      const result = calcStatus({
        actualPct: 0,
        scheduledPct: 0,
        startDate: d('2026-05-15'),
        endDate: d('2026-06-30'),
        today: d('2026-05-15'),
        hasAnyActualStart: false,
      })
      expect(result).toBe<Status>('delayed')
    })

    it('startDate === endDate (同日タスク): actualPct=0 && today < startDate は not-started', () => {
      const result = calcStatus({
        actualPct: 0,
        scheduledPct: 0,
        startDate: d('2026-06-01'),
        endDate: d('2026-06-01'),
        today: d('2026-05-15'),
        hasAnyActualStart: false,
      })
      expect(result).toBe<Status>('not-started')
    })

    it('startDate === endDate (同日タスク): actualPct=0 && today >= startDate は delayed', () => {
      const result = calcStatus({
        actualPct: 0,
        scheduledPct: 100,
        startDate: d('2026-05-15'),
        endDate: d('2026-05-15'),
        today: d('2026-05-15'),
        hasAnyActualStart: false,
      })
      expect(result).toBe<Status>('delayed')
    })
  })
})
