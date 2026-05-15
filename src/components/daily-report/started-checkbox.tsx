'use client'

interface StartedCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function StartedCheckbox({ checked, onChange, disabled }: StartedCheckboxProps) {
  return (
    <label
      className={`flex items-center gap-1 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-400 disabled:opacity-50"
        aria-label="開始"
      />
      <span className="text-xs text-gray-500">開始</span>
    </label>
  )
}
