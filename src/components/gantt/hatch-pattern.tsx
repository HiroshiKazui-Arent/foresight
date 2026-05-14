/**
 * SVG ハッチングパターン定義コンポーネント
 *
 * <defs> 内に斜線パターンを定義する。
 * width/height=0 の不可視 SVG として DOM に配置し、
 * 他コンポーネントから url(#hatch-{status}) で参照できる。
 *
 * ハッチングは実績 < 予定の「遅延ギャップ」のみに使用するため
 * warning / delayed の2ステータスのみ定義する。
 */

import type { ProgressStatus } from '@/types/progress'

const HATCH_COLORS: Partial<Record<ProgressStatus, string>> = {
  warning: '#f59e0b',
  delayed: '#ef4444',
}

export function HatchPattern() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {Object.entries(HATCH_COLORS).map(([status, color]) => (
          <pattern
            key={status}
            id={`hatch-${status}`}
            patternUnits="userSpaceOnUse"
            width="8"
            height="8"
          >
            {/* 45度の斜線: (0,8)→(8,0) */}
            <line x1="0" y1="8" x2="8" y2="0" stroke={color} strokeWidth="1.5" />
          </pattern>
        ))}
      </defs>
    </svg>
  )
}
