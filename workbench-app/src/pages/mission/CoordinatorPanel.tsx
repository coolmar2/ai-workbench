import { Fragment } from 'react'
import { Bot } from 'lucide-react'
import { AgentMark, EmptyState, ScrollArea, cn, useNow } from '../../components/ui'
import { SAMPLE_COORDINATOR_MODEL, SAMPLE_FEED, type FeedTag } from './data'
import { clock12 } from './model'

const TAG_CLASS: Record<FeedTag, string> = {
  NOTE: 'text-coordinator shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--coordinator)_55%,transparent)]',
  HANDOFF: 'text-success shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--success)_55%,transparent)]',
  QUESTION: 'text-danger shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--danger)_55%,transparent)]',
  'PLAN SYNC': 'text-2 shadow-[inset_0_0_0_1px_var(--stroke-1)]',
}

/** "**file.py** text" -> bold mono file names. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
        i % 2 === 1 ? (
          <b key={i} className="font-mono text-code font-semibold text-claude">
            {part}
          </b>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}

export interface CoordinatorPanelProps {
  workspace: string
  /** Sample mode shows the design's feed; live mode has no coordinator yet. */
  sample: boolean
  /** Epoch ms the sample feed's "minutes ago" is measured from. */
  t0: number
  className?: string
}

export function CoordinatorPanel({ workspace, sample, t0, className }: CoordinatorPanelProps) {
  const now = useNow(1000)
  const sinceLoad = Math.max(0, Math.round((now - t0) / 1000))
  const lastCheck = (12 + sinceLoad) % 30
  return (
    <aside aria-label={`${workspace} coordinator`} className={cn('flex min-h-0 flex-col bg-sidebar', className)}>
      <div className="shrink-0 border-b border-stroke-3 px-4 pt-3.5 pb-3">
        <div className="flex items-center gap-2">
          <span className="size-2 shrink-0 rounded-full bg-coordinator" aria-hidden />
          <h2 className="min-w-0 truncate text-title font-semibold text-1">{workspace} coordinator</h2>
          {sample && (
            <span className="ml-auto flex shrink-0 items-center gap-1.5 text-meta text-claude">
              <AgentMark vendor="claude" size={10} label="" />
              {SAMPLE_COORDINATOR_MODEL}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-caption text-3">
          Reads every session&apos;s plan and diff in this workspace and tells each lead what the others are doing, so work builds on work instead of over it.
        </p>
      </div>
      {sample ? (
        <>
          <ScrollArea className="min-h-0 flex-1">
            <ul className="flex flex-col gap-2.5 p-3.5">
              {SAMPLE_FEED.map((m, i) => (
                <li key={i} className="rounded-lg border border-stroke-3 bg-card px-3 py-2.5 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className={cn('inline-flex h-[18px] items-center rounded-full px-2 text-meta tracking-caps', TAG_CLASS[m.tag])}>{m.tag}</span>
                    <span className="ml-auto text-meta text-3 tabular-nums">{clock12((t0 - m.minAgo * 60_000) / 1000)}</span>
                  </div>
                  <p className="mt-1.5 text-body text-1">
                    <Rich text={m.text} />
                  </p>
                  <p className="mt-1 text-meta text-3">{m.route}</p>
                </li>
              ))}
            </ul>
          </ScrollArea>
          <div className="flex shrink-0 items-center gap-2 border-t border-stroke-3 px-4 py-2.5 text-meta text-3 tabular-nums">
            <span className="size-1.5 rounded-full bg-coordinator" aria-hidden />
            Checks every 30 s · last check {lastCheck} s ago
            <span className="ml-auto rounded-sm px-1 text-meta text-3 shadow-[inset_0_0_0_1px_var(--stroke-1)]">sample</span>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState icon={<Bot />} title="Coordinator not running" hint="No data source yet, so no notes or hand-offs to show." compact />
        </div>
      )}
    </aside>
  )
}
