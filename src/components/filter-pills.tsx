'use client'

/**
 * FilterPills — フィルターピル群コンポーネント
 *
 * state を持つため 'use client' 指定。
 * 5つのフィルター値に対応するピルを表示する。
 */

import type { FilterValue } from '@/lib/summary'

export interface FilterPillsProps {
  value: FilterValue
  onChange: (v: FilterValue) => void
}

const PILLS: { label: string; value: FilterValue }[] = [
  { label: 'すべて', value: 'all' },
  { label: '遅延', value: 'delayed' },
  { label: '未着手リスク', value: 'not-started-risk' },
  { label: '進行中', value: 'in-progress' },
  { label: '完了', value: 'completed' },
]

export function FilterPills({ value, onChange }: FilterPillsProps): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-2">
      {PILLS.map((pill) => {
        const isActive = pill.value === value
        return (
          <button
            key={pill.value}
            type="button"
            onClick={() => onChange(pill.value)}
            aria-pressed={isActive}
            className={[
              'rounded-full border px-3 py-1 text-sm transition-colors',
              isActive
                ? 'border-blue-600 bg-blue-600 font-semibold text-white'
                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400',
            ].join(' ')}
          >
            {pill.label}
          </button>
        )
      })}
    </div>
  )
}
