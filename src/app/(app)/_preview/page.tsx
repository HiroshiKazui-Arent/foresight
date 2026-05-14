import { ProgressPill } from '@/components/progress-pill'
import { StatusPill } from '@/components/status-pill'
import { DaysPill } from '@/components/days-pill'
import { GanttBar } from '@/components/gantt/gantt-bar'

export default function PreviewPage() {
  return (
    <div className="space-y-6 p-8">
      <h1 className="text-2xl font-bold">コンポーネントプレビュー</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">ProgressPill</h2>
        <ProgressPill actualPct={44} scheduledPct={83} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">StatusPill</h2>
        <div className="flex flex-wrap gap-2">
          <StatusPill status="completed" />
          <StatusPill status="on-track" />
          <StatusPill status="delayed" />
          <StatusPill status="warning" />
          <StatusPill status="scheduled" />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">DaysPill</h2>
        <div className="flex gap-4">
          <DaysPill days={-9} />
          <DaysPill days={1} />
          <DaysPill days={0} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">GanttBar</h2>
        <div className="max-w-md space-y-2">
          <div>空バー (actualPct=0)</div>
          <GanttBar actualPct={0} scheduledPct={50} status="scheduled" />
          <div>半塗り (actualPct=50)</div>
          <GanttBar actualPct={50} scheduledPct={60} status="on-track" />
          <div>完了</div>
          <GanttBar actualPct={100} scheduledPct={100} status="completed" />
          <div>警告 (actualPct=20, scheduledPct=50)</div>
          <GanttBar actualPct={20} scheduledPct={50} status="warning" />
          <div>期日超過 — overdue 赤ベタ (actualPct=40, today が rowEnd を超過)</div>
          <GanttBar
            projectStart={new Date('2024-01-01')}
            projectEnd={new Date('2024-03-31')}
            rowStart={new Date('2024-01-01')}
            rowEnd={new Date('2024-03-31')}
            today={new Date('2024-05-01')}
            actualPct={40}
            scheduledPct={100}
            status="delayed"
          />
        </div>
      </section>
    </div>
  )
}
