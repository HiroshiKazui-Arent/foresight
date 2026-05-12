'use client'

interface ProgressInputProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}

export function ProgressInput({ value, onChange, disabled }: ProgressInputProps) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => {
          const n = Math.max(0, Math.min(100, Number(e.target.value)))
          onChange(Number.isNaN(n) ? 0 : n)
        }}
        disabled={disabled}
        className="w-16 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:ring-1 focus:ring-blue-400 focus:outline-none disabled:opacity-50"
        aria-label="進捗率"
      />
      <span className="text-sm text-gray-500">%</span>
    </div>
  )
}
