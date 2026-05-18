'use client'

interface EmptyStackProps {
  label: string
  onAdd: () => void | Promise<void>
}

/**
 * 「+ 同階層の工程を追加」プレースホルダ。
 * モック (`gantt_progress_mock_html2.html`) の `.empty-stack` の役割:
 * 親階層に子が無い、または末尾に同階層を追加するためのボタン。
 */
export function EmptyStack({ label, onAdd }: EmptyStackProps) {
  return (
    <button
      type="button"
      onClick={() => onAdd()}
      className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-gray-300 bg-gray-50 px-3 py-1.5 text-xs text-gray-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
    >
      <span>+</span>
      <span>{label}</span>
    </button>
  )
}
