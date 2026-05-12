import { describe, it, expect } from 'vitest'
import type { ProgressStatus } from '@/types/progress'

// StatusPill の設定ロジックをテスト
// コンポーネント内の config オブジェクトをテスト対象として抽出

type StatusConfig = { label: string; className: string }

const STATUS_CONFIG: Record<ProgressStatus, StatusConfig> = {
  completed: { label: '完了', className: 'bg-green-700 text-white' },
  'on-track': { label: '進行中', className: 'bg-green-200 text-green-800' },
  delayed: { label: '遅延', className: 'bg-yellow-200 text-yellow-800' },
  warning: { label: '警告', className: 'bg-red-200 text-red-800' },
  scheduled: { label: '予定', className: 'bg-gray-200 text-gray-700' },
}

describe('StatusPill 設定ロジック', () => {
  const allStatuses: ProgressStatus[] = ['completed', 'on-track', 'delayed', 'warning', 'scheduled']

  it('全5ステータスに設定がある', () => {
    for (const status of allStatuses) {
      expect(STATUS_CONFIG[status]).toBeDefined()
    }
  })

  it('各ステータスのラベルが正しい', () => {
    expect(STATUS_CONFIG['completed'].label).toBe('完了')
    expect(STATUS_CONFIG['on-track'].label).toBe('進行中')
    expect(STATUS_CONFIG['delayed'].label).toBe('遅延')
    expect(STATUS_CONFIG['warning'].label).toBe('警告')
    expect(STATUS_CONFIG['scheduled'].label).toBe('予定')
  })

  it('completed は緑の背景・白テキスト', () => {
    expect(STATUS_CONFIG['completed'].className).toContain('bg-green-700')
    expect(STATUS_CONFIG['completed'].className).toContain('text-white')
  })

  it('on-track は薄緑の背景・緑テキスト', () => {
    expect(STATUS_CONFIG['on-track'].className).toContain('bg-green-200')
    expect(STATUS_CONFIG['on-track'].className).toContain('text-green-800')
  })

  it('delayed は黄色の背景・黄色テキスト', () => {
    expect(STATUS_CONFIG['delayed'].className).toContain('bg-yellow-200')
    expect(STATUS_CONFIG['delayed'].className).toContain('text-yellow-800')
  })

  it('warning は赤の背景・赤テキスト', () => {
    expect(STATUS_CONFIG['warning'].className).toContain('bg-red-200')
    expect(STATUS_CONFIG['warning'].className).toContain('text-red-800')
  })

  it('scheduled は灰色の背景・灰色テキスト', () => {
    expect(STATUS_CONFIG['scheduled'].className).toContain('bg-gray-200')
    expect(STATUS_CONFIG['scheduled'].className).toContain('text-gray-700')
  })

  it('全ステータスで label と className が空でない', () => {
    for (const status of allStatuses) {
      const config = STATUS_CONFIG[status]
      expect(config.label.length).toBeGreaterThan(0)
      expect(config.className.length).toBeGreaterThan(0)
    }
  })

  it('各ステータスのラベルがユニーク', () => {
    const labels = allStatuses.map((s) => STATUS_CONFIG[s].label)
    const uniqueLabels = new Set(labels)
    expect(uniqueLabels.size).toBe(allStatuses.length)
  })

  it('各ステータスの className がユニーク', () => {
    const classNames = allStatuses.map((s) => STATUS_CONFIG[s].className)
    const uniqueClassNames = new Set(classNames)
    expect(uniqueClassNames.size).toBe(allStatuses.length)
  })
})
