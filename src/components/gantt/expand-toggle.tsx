/**
 * ExpandToggle — ツリー行の展開/折りたたみボタン (▼ / ▶)
 *
 * level=2 (ToDo) のような子なし行では描画しないため、children の有無は呼び出し側で判定する。
 */

export interface ExpandToggleProps {
  expanded: boolean
  onToggle: () => void
  ariaLabel?: string
}

export function ExpandToggle({
  expanded,
  onToggle,
  ariaLabel,
}: ExpandToggleProps): React.ReactElement {
  const label = ariaLabel ?? (expanded ? '折りたたむ' : '展開する')
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={label}
      className="inline-flex h-5 w-5 items-center justify-center rounded text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
    >
      <span aria-hidden="true">{expanded ? '▼' : '▶'}</span>
    </button>
  )
}
