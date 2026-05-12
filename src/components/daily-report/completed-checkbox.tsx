'use client'

interface CompletedCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function CompletedCheckbox({ checked, onChange, disabled }: CompletedCheckboxProps) {
  return (
    <label className="flex cursor-pointer items-center gap-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400 disabled:opacity-50"
        aria-label="完了"
      />
      <span className="text-xs text-gray-500">完了</span>
    </label>
  )
}
