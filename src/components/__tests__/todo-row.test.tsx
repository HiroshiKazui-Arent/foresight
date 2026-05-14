import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TodoRow } from '@/components/tree-view/todo-row'

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------
const projectStart = new Date('2026-01-01')
const projectEnd = new Date('2026-12-31')
const today = new Date('2026-05-14')

const baseTodo = {
  id: 'todo-1',
  name: 'テスト ToDo',
  completed: false,
  startDate: new Date('2026-04-01'),
  endDate: new Date('2026-06-30'),
}

function makeRow(overrides: Partial<typeof baseTodo> = {}) {
  return createElement(TodoRow, {
    todo: { ...baseTodo, ...overrides },
    today,
    projectStart,
    projectEnd,
  })
}

// ---------------------------------------------------------------------------
// 完了チェックマーク
// ---------------------------------------------------------------------------
describe('completed チェックマーク', () => {
  it('completed=true のとき ✓ マークが表示される', () => {
    const html = renderToStaticMarkup(makeRow({ completed: true }))
    expect(html).toContain('✓')
  })

  it('completed=false のとき ✓ マークは表示されない', () => {
    const html = renderToStaticMarkup(makeRow({ completed: false }))
    expect(html).not.toContain('✓')
  })
})

// ---------------------------------------------------------------------------
// ToDo 名表示
// ---------------------------------------------------------------------------
describe('ToDo 名表示', () => {
  it('ToDo 名がレンダリングされる', () => {
    const html = renderToStaticMarkup(makeRow({ name: '設計書を書く' }))
    expect(html).toContain('設計書を書く')
  })
})

// ---------------------------------------------------------------------------
// ProgressPill / StatusPill / DaysPill
// ---------------------------------------------------------------------------
describe('ProgressPill / StatusPill / DaysPill のレンダリング', () => {
  it('ProgressPill が存在する (% / % 形式)', () => {
    const html = renderToStaticMarkup(makeRow())
    // ProgressPill は "XX% / YY%" 形式
    expect(html).toMatch(/\d+%\s*\/\s*\d+%/)
  })

  it('StatusPill が存在する (ステータスラベル)', () => {
    const html = renderToStaticMarkup(makeRow({ completed: true }))
    // completed=true → StatusPill は '完了'
    expect(html).toContain('完了')
  })

  it('StatusPill: completed=false, 将来日程 → 予定', () => {
    const futureTodo = {
      ...baseTodo,
      completed: false,
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-09-30'),
    }
    const html = renderToStaticMarkup(
      createElement(TodoRow, {
        todo: futureTodo,
        today,
        projectStart,
        projectEnd,
      }),
    )
    expect(html).toContain('予定')
  })

  it('DaysPill が存在する (日 という文字)', () => {
    const html = renderToStaticMarkup(makeRow())
    expect(html).toContain('日')
  })
})

// ---------------------------------------------------------------------------
// GanttBar: left / width スタイルが存在する
// ---------------------------------------------------------------------------
describe('GanttBar のレンダリング', () => {
  it('role="img" が付与される (GanttBar がレンダリングされている)', () => {
    const html = renderToStaticMarkup(makeRow())
    expect(html).toContain('role="img"')
  })

  it('position:absolute スタイルが存在する (バー位置が算出されている)', () => {
    const html = renderToStaticMarkup(makeRow())
    expect(html).toContain('position:absolute')
  })

  it('left:% スタイルが存在する (projectStart/End から offset 算出)', () => {
    const html = renderToStaticMarkup(makeRow())
    expect(html).toMatch(/left:\d+(\.\d+)?%/)
  })

  it('width:% スタイルが存在する (行期間の幅が算出されている)', () => {
    const html = renderToStaticMarkup(makeRow())
    expect(html).toMatch(/width:\d+(\.\d+)?%/)
  })

  it('rowStart=projectStart のとき outer div の left が 0%', () => {
    const html = renderToStaticMarkup(
      createElement(TodoRow, {
        todo: {
          ...baseTodo,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
        },
        today,
        projectStart: new Date('2026-01-01'),
        projectEnd: new Date('2026-12-31'),
      }),
    )
    expect(html).toContain('left:0%')
  })
})

// ---------------------------------------------------------------------------
// 5 カラム Grid レイアウト: name / progress / status / days / bar
// ---------------------------------------------------------------------------
describe('5 カラム Grid レイアウト (name / progress / status / days / bar)', () => {
  it('gridTemplateColumns が "240px 88px 60px 56px 1fr" (各列固定幅 + バー 1fr) を含む', () => {
    const html = renderToStaticMarkup(makeRow())
    expect(html).toContain('grid-template-columns:240px 88px 60px 56px 1fr')
  })

  it('ProgressPill / StatusPill / DaysPill が個別のカラム (各 px-1) に配置される', () => {
    const html = renderToStaticMarkup(makeRow())
    // ピル間の右寄せ集約 (justify-end gap-2) は廃止し、各セルで justify-start に
    expect(html).not.toContain('justify-end gap-2')
  })
})

// ---------------------------------------------------------------------------
// インデント (ml-12 廃止 → ラベルセル内 pl-[60px] へ移動)
// ---------------------------------------------------------------------------
describe('インデント', () => {
  it('最外ラッパーに ml-12 クラスが付かない (grid 起点を全行で揃えるため廃止)', () => {
    const html = renderToStaticMarkup(makeRow())
    expect(html).not.toContain('ml-12')
  })

  it('ラベルセル内に pl-[60px] (ToDo 階層インデント) が付く', () => {
    const html = renderToStaticMarkup(makeRow())
    expect(html).toContain('pl-[60px]')
  })
})
