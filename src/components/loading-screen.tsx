interface LoadingScreenProps {
  label?: string
}

export function LoadingScreen({ label = '読み込み中…' }: LoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-[40vh] items-center justify-center"
    >
      <div className="flex items-center gap-3 text-gray-500">
        <span
          aria-hidden
          className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500"
        />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  )
}
