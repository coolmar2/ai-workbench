import { Check, Circle } from 'lucide-react'
import { AgentMark, Badge, ScrollArea, Tabs, TabsContent, TabsList, TabsTrigger, cn, etaView, toStatus, useNow, type BadgeTone } from '../../components/ui'
import type { Detail, Msg, OutLine } from './data'
import { clock12, inText, type ActivityItem } from './plan'

export type Tab = 'run' | 'msgs'

const TONE: Record<OutLine['tone'], string> = {
  normal: 'text-2',
  ok: 'text-success',
  error: 'text-danger',
  muted: 'text-3',
  coord: 'text-coordinator',
  running: 'text-running',
}
const MSG_TONE: Record<Msg['type'], BadgeTone> = { task: 'info', result: 'success', question: 'attention', note: 'coordinator' }
const BAR = { claude: 'bg-claude', codex: 'bg-codex', gemini: 'bg-gemini' } as const
const STATE_TEXT: Record<string, string> = { running: 'text-running', done: 'text-success', attention: 'text-attention', error: 'text-danger' }

interface Props {
  detail: Detail
  modelText: string
  messages: Msg[]
  live: boolean
  tab: Tab
  onTab: (t: Tab) => void
  /** Recent tool calls of this agent: null = feed unavailable, undefined = not applicable (sample data). */
  activity?: ActivityItem[] | null
  /** False when the session is ended/offline: no "running" claims and no "live" output header. */
  sessionRunning?: boolean
}

const FAIL = /^(FAILED|E\s|Error|Traceback)/

/** Terminal text for the activity feed: "$ cmd" for Bash, "> Tool summary" otherwise, then the output (failures in danger). */
function terminalLines(items: ActivityItem[]): OutLine[] {
  const out: OutLine[] = []
  items.forEach((it, i) => {
    if (i) out.push({ tone: 'muted', text: ' ' })
    out.push({ tone: 'normal', text: it.tool === 'Bash' ? `$ ${it.summary}` : `> ${it.tool} ${it.summary}`.trim() })
    if (it.output)
      it.output
        .trimEnd()
        .split(/\r?\n/)
        .slice(-12)
        .forEach((text) => out.push({ tone: it.state === 'error' || FAIL.test(text) ? 'error' : 'muted', text }))
  })
  return out
}

/** Right panel: the selected agent's header, progress, and Plan and output / Messages tabs. */
export function AgentPanel({ detail, modelText, messages, live, tab, onTab, activity, sessionRunning = true }: Props) {
  const now = useNow(1000)
  const status = toStatus(detail.state)
  const ev = detail.eta ? etaView(detail.eta, now) : null
  const note = ev && ev.kind === 'overrun' ? ev.text : ev && ev.finishAt ? `Done about ${clock12(ev.finishAt)}, ${inText(ev.left)}` : detail.progressNote
  const updated = detail.eta?.received ? `updated ${Math.max(0, Math.round((now - detail.eta.received) / 1000))} s ago` : detail.updated
  const items = activity ?? null
  const running = sessionRunning ? items?.filter((i) => i.state === 'running').at(-1) : undefined
  const lines = items && items.length ? terminalLines(items) : null
  const right = running ? `${running.tool === 'Bash' ? 'script' : running.tool} running ${Math.max(0, Math.round(now / 1000 - running.ts))} s` : lines ? 'idle' : detail.outputRight
  return (
    <aside aria-label="Selected agent" className="flex min-h-0 min-w-0 flex-1 flex-col bg-chrome">
      <div className="flex flex-col gap-2 border-b border-stroke-3 p-4">
        <div className="flex min-w-0 items-center gap-2">
          <AgentMark vendor={detail.vendor} size={10} />
          <h2 className="min-w-0 flex-1 truncate text-title font-semibold text-1">{detail.name}</h2>
          <span className={cn('text-caption', STATE_TEXT[status] ?? 'text-3')}>{detail.state}</span>
        </div>
        <div className="truncate text-caption text-3">
          {modelText} · {detail.subtitle}
        </div>
        <div className="flex items-baseline gap-2">
          <span className={cn('font-semibold text-1 tabular-nums', detail.pct === null ? 'text-body' : 'text-[26px] leading-8')}>{detail.bigText}</span>
          <span className="min-w-0 flex-1 truncate text-caption text-2">{note}</span>
          <span className="shrink-0 text-meta text-3 tabular-nums">{updated}</span>
        </div>
        {detail.pct !== null && (
          <div className="h-2 overflow-hidden rounded-full bg-fill-2" role="progressbar" aria-valuenow={detail.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
            <div className={cn('h-full rounded-full', BAR[detail.vendor])} style={{ width: `${detail.pct}%` }} />
          </div>
        )}
      </div>
      <Tabs value={tab} onValueChange={(v) => onTab(v as Tab)} className="min-h-0 flex-1">
        <TabsList>
          <TabsTrigger value="run">Plan and output</TabsTrigger>
          <TabsTrigger value="msgs" count={messages.length}>
            Messages
          </TabsTrigger>
        </TabsList>
        <TabsContent value="run" className="flex flex-col">
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-4 p-4">
              <section aria-label="Plan" className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <h3 className="caps">Plan</h3>
                  {detail.plan && detail.planRight && <span className="text-meta text-3 tabular-nums">{detail.planRight}</span>}
                </div>
                {detail.plan ? (
                  <ol className="flex flex-col">
                    {detail.plan.map((p, i) => (
                      <li key={i} className="flex min-h-7 items-start gap-2 py-1 text-caption">
                        <span className={cn('mt-0.5 flex w-3.5 shrink-0 justify-center [&_svg]:size-3.5', p.state === 'done' ? 'text-success' : p.state === 'now' ? 'text-running' : 'text-3')}>
                          {p.state === 'done' ? <Check /> : p.state === 'now' ? <span className="mt-1 size-2 rounded-full bg-running" /> : <Circle className="mt-0.5 !size-2.5" />}
                        </span>
                        <span className={cn('min-w-0 flex-1', p.state === 'todo' ? 'text-3' : 'text-1')}>{p.text}</span>
                        {p.time && <span className={cn('shrink-0 text-meta tabular-nums', p.state === 'now' ? 'text-running' : 'text-3')}>{p.time}</span>}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-caption text-3">{detail.planEmpty || 'No plan reported'}</p>
                )}
              </section>
              <section aria-label="Output" className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="caps">{lines && sessionRunning ? 'Live output' : lines ? 'Output' : detail.outputTitle}</h3>
                  {right && <span className={cn('truncate text-meta tabular-nums', running ? 'text-running' : 'text-3')}>{right}</span>}
                </div>
                <div role="region" tabIndex={0} aria-label="Agent output" className="rounded-lg border border-stroke-3 bg-card p-3 font-mono text-code">
                  {(lines ?? detail.output).map((l, i) => (
                    <div key={i} className={cn('break-words whitespace-pre-wrap', TONE[l.tone])}>
                      {l.text || ' '}
                    </div>
                  ))}
                  {running && <span aria-hidden className="inline-block h-[1em] w-2 translate-y-0.5 animate-pulse bg-success" />}
                  {live && activity === null && <div className="mt-2 text-meta text-3">Recent tool calls are not available from the feed yet.</div>}
                </div>
              </section>
            </div>
          </ScrollArea>
        </TabsContent>
        <TabsContent value="msgs" className="flex flex-col">
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between">
                <h3 className="caps">All messages in this session</h3>
                <Badge tone={live ? 'success' : 'outline'}>{live ? 'live' : 'sample'}</Badge>
              </div>
              <p className="text-meta text-3">Highlighted rows involve {detail.name}.</p>
              {messages.length === 0 && <p className="text-caption text-3">No messages yet</p>}
              {messages.map((m, i) => {
                const hot = m.from === detail.id || m.to === detail.id
                return (
                  <div key={i} className={cn('rounded-lg border p-2', hot ? 'border-stroke-1 bg-fill-3' : 'border-stroke-3 bg-card')}>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-meta text-3 tabular-nums">{m.time}</span>
                      <Badge tone={MSG_TONE[m.type]}>{m.type}</Badge>
                      <span className="min-w-0 flex-1 truncate text-meta text-3">{m.route}</span>
                    </div>
                    <p className="mt-1 text-caption whitespace-pre-wrap text-2">{m.text}</p>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </aside>
  )
}
