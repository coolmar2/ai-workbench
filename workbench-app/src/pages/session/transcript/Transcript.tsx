import { useCallback, useEffect, useRef } from 'react'
import type { TranscriptRow, Vendor } from '../../../data/types'
import { AgentMark, Button, Eta, ScrollArea, StatusDot, TranscriptAssistantText, TranscriptThinkingRow, cn } from '../../../components/ui'
import type { Status } from '../../../components/ui'

export interface TranscriptProps {
  rows: TranscriptRow[]
  /** Vendor by agent display name, to mark sub-agent handoffs. */
  vendorOf: (agentName: string) => Vendor | undefined
  onAsk: (action: string) => void
  onOpenAgent: (agentName: string) => void
  /** Height reserved at the bottom for the floating composer. */
  bottomInset: number
}

const DOT: Record<string, Status> = { muted: 'idle', ok: 'done', running: 'running', error: 'error' }
const TONE = { normal: 'text-2', error: 'text-danger', muted: 'text-3', ok: 'text-success' } as const
const MAX_LINES = 14

type Row = Extract<TranscriptRow, { kind: 'tool' }>

function Line({ tag, children }: { tag: 'IN' | 'OUT'; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 px-3 py-2">
      <span className="w-6 shrink-0 pt-px font-mono text-meta text-3">{tag}</span>
      <div className="min-w-0 flex-1 font-mono text-code break-words whitespace-pre-wrap">{children}</div>
    </div>
  )
}

/** A tool call with its IN and OUT always visible, like the original design. */
function ToolBlock({ r, vendorOf, onOpenAgent }: { r: Row; vendorOf: TranscriptProps['vendorOf']; onOpenAgent: (n: string) => void }) {
  const handoff = /handoff|^agent$/i.test(r.name)
  const target = handoff ? r.detail?.replace(/^to\s+/i, '') : undefined
  const out = (r.output ?? []).flatMap((o) => o.text.split(/\r?\n/).map((text) => ({ text, tone: o.tone ?? 'normal' })))
  const shown = out.slice(0, MAX_LINES)
  return (
    <div className="animate-fade-in flex flex-col gap-1.5 pl-1">
      <div className="flex min-h-5 min-w-0 items-center gap-2 text-caption">
        {handoff ? <AgentMark vendor={(target && vendorOf(target)) || 'claude'} size={10} /> : r.dot ? <StatusDot status={DOT[r.dot]} decorative /> : <span className="size-1.5" />}
        <span className="shrink-0 font-semibold text-1">{r.name}</span>
        {r.detail &&
          (target ? (
            <button type="button" onClick={() => onOpenAgent(target)} className="min-w-0 truncate rounded-sm text-3 transition-colors-fast hover:text-1">
              {r.detail}
            </button>
          ) : (
            <span className="min-w-0 truncate text-3">{r.detail}</span>
          ))}
        {r.eta && <Eta eta={r.eta} variant="pill" />}
      </div>
      <div className="ml-4 divide-y divide-stroke-3 overflow-hidden rounded-lg border border-stroke-3 bg-card">
        <Line tag="IN">
          <span className="text-1">{r.input.join('\n')}</span>
        </Line>
        {shown.length > 0 && (
          <Line tag="OUT">
            {shown.map((o, i) => (
              <div key={i} className={cn(TONE[o.tone])}>
                {o.text || ' '}
              </div>
            ))}
            {out.length > shown.length && <div className="text-3">… {out.length - shown.length} more lines</div>}
          </Line>
        )}
      </div>
    </div>
  )
}

/** Scrolling conversation; sticks to the bottom while the user is at the bottom. */
export function Transcript({ rows, vendorOf, onAsk, onOpenAgent, bottomInset }: TranscriptProps) {
  const scroller = useRef<HTMLDivElement | null>(null)
  const stuck = useRef(true)

  const toBottom = useCallback(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    if (stuck.current) toBottom()
  }, [rows, bottomInset, toBottom])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      if (stuck.current) toBottom()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [toBottom])

  return (
    <ScrollArea
      ref={scroller}
      className="flex-1"
      onScroll={(e) => {
        const el = e.currentTarget
        stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
      }}
    >
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-3 px-6 pt-4" style={{ paddingBottom: bottomInset + 16 }}>
        {rows.map((r, i) => {
          switch (r.kind) {
            case 'user':
              return (
                <div key={i} className="animate-fade-in rounded-lg border border-stroke-3 bg-fill-3 px-3 py-2">
                  <div className="mb-0.5 text-meta text-3 tabular-nums">You{r.time ? ` · ${r.time}` : ''}</div>
                  <p className="text-body whitespace-pre-wrap text-1">{r.text}</p>
                </div>
              )
            case 'text':
              return <TranscriptAssistantText key={i} text={r.text} />
            case 'thinking':
              return <TranscriptThinkingRow key={i} text={r.text} />
            case 'ask':
              return (
                <div key={i} className="animate-fade-in flex flex-wrap items-center gap-3 rounded-lg border border-coordinator/30 bg-coordinator/12 px-3 py-2">
                  <span className="caps shrink-0 text-coordinator">{r.label ?? 'Lead asks'}</span>
                  <p className="min-w-0 flex-1 text-body text-1">{r.text}</p>
                  <div className="flex shrink-0 gap-2">
                    {r.actions.map((a, j) => (
                      <Button key={a} variant={j === 0 ? 'primary' : 'secondary'} size="sm" onClick={() => onAsk(a)}>
                        {a}
                      </Button>
                    ))}
                  </div>
                </div>
              )
            case 'tool':
              return <ToolBlock key={i} r={r} vendorOf={vendorOf} onOpenAgent={onOpenAgent} />
          }
        })}
      </div>
    </ScrollArea>
  )
}
