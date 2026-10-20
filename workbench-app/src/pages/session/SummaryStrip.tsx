import { Badge, cn } from '../../components/ui'
import type { SummaryModel } from './summaryModel'

function Col({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <h2 className="caps">{title}</h2>
      {children}
    </div>
  )
}

/** Three columns: Session progress, Estimated finish, Should you stay. */
export function SummaryStrip({ m, history }: { m: SummaryModel; history: string[] }) {
  // The 30px numerals have no kit type token (hero is 20px), so they stay arbitrary on purpose.
  return (
    <section aria-label="Session summary" className="@container shrink-0 border-b border-stroke-3 bg-fill-4">
      {/* Phone: one compact line so the conversation keeps the room. */}
      <div className="flex min-h-10 items-center gap-3 px-4 py-1.5 text-caption sm:hidden">
        <span className="font-semibold text-1 tabular-nums">{m.pct === null ? '–' : `${m.pct}%`}</span>
        <span aria-hidden className="text-4">·</span>
        <span className="min-w-0 flex-1 truncate text-2 tabular-nums">{m.finish ? `Done ${m.finish}` : 'No finish estimate'}</span>
        <Badge tone={m.verdict.tone} className="shrink-0">{m.verdict.label}</Badge>
      </div>
      <div className="hidden grid-cols-1 gap-x-8 gap-y-4 px-6 py-3 sm:grid @[760px]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.2fr)]">
      <Col title="Session progress">
        <div className="flex items-baseline gap-2">
          <span className="text-[30px] leading-9 font-semibold text-1 tabular-nums">{m.pct === null ? '–' : `${m.pct}%`}</span>
          {m.stepText && <span className="text-caption text-3 tabular-nums">{m.stepText}</span>}
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-fill-2" role="progressbar" aria-label="Session progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={m.pct ?? undefined}>
          <div className="h-full rounded-full bg-claude" style={{ width: `${m.pct ?? 0}%` }} />
        </div>
        <div className="truncate text-caption text-2">{m.stepLabel}</div>
      </Col>
      <Col title="Estimated finish">
        <div className="flex items-baseline gap-2">
          <span className="text-[30px] leading-9 font-semibold whitespace-nowrap text-1 tabular-nums">{m.finish ?? '–'}</span>
          {m.finishIn && <span className="text-caption whitespace-nowrap text-3 tabular-nums">{m.finishIn}</span>}
        </div>
        <div className="truncate text-caption text-2 tabular-nums">{m.range}</div>
        {m.updated && (
          <div className="flex items-center gap-1.5 text-caption text-3 tabular-nums">
            <span className="size-1.5 shrink-0 rounded-full bg-success" aria-hidden />
            <span className="truncate">{m.updated}</span>
          </div>
        )}
        {history.length > 1 && <div className="truncate text-meta text-3 tabular-nums">Estimate history: {history.join(' → ')}</div>}
      </Col>
      <Col title="Should you stay?">
        <div>
          <Badge tone={m.verdict.tone} className="h-6 px-2 text-caption">
            {m.verdict.label}
          </Badge>
        </div>
        <p className="text-caption text-2">{m.reason}</p>
      </Col>
      </div>
    </section>
  )
}
