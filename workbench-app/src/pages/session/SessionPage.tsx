import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MessageSquare, Network, Pause, Pencil, SearchX, TerminalSquare } from 'lucide-react'
import { LiveTerminal } from '../../components/terminal/LiveTerminal'
import {
  AgentMark,
  Badge,
  Button,
  Composer,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  EmptyState,
  IconButton,
  Input,
  ResizableSplit,
  ResizablePane,
  ResizeHandle,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  formatShort,
  toast,
  toStatus,
  useMediaQuery,
  useNow,
} from '../../components/ui'
import { SAMPLE_SESSIONS } from '../mission/data'
import { useIdentity } from '../../context/identity'
import type { McSession, TranscriptRow, Vendor } from '../../data/types'
import { sessionTitle, useMissionFeed, workspaceName } from '../../live/mission'
import { sendKeys, sendPrompt } from '../../live/actions'
import { useTranscript } from '../../live/history'
import { ResumeButton } from '../../components/shell/ResumeButton'
import { AgentCloud } from './Cloud'
import { AgentPanel, type Tab } from './Panel'
import {
  SAMPLE_CHIPS,
  SAMPLE_DOTS,
  SAMPLE_EDGES,
  SAMPLE_MESSAGES,
  SAMPLE_NODES,
  sampleDetails,
  sampleRows,
  sampleSession,
  type Detail,
  type GEdge,
  type GNode,
  type Msg,
} from './data'
import { leadModelLabel, liveDetails, liveGraph, liveMessages, liveRows } from './live'
import { useActivity, useFinishHistory } from './plan'
import { liveSummary, sampleSummary } from './summaryModel'
import { SummaryStrip } from './SummaryStrip'
import { Transcript } from './transcript/Transcript'

type View = 'chat' | 'cloud' | 'agent' | 'term'

const SAMPLE_IDS = new Set(['zzz-sample', ...SAMPLE_SESSIONS.map((s) => s.id)])

export default function SessionPage({ initialView }: { initialView: 'chat' | 'cloud' }) {
  const { id } = useParams()
  const feed = useMissionFeed()
  if (!feed.checked) return <SessionSkeleton />
  const found = feed.state?.sessions.find((s) => s.session_id === id)
  if (!found && !(id && SAMPLE_IDS.has(id)) && feed.state !== null) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyState
          icon={<SearchX />}
          title="Session not found"
          hint="This id is not in the feed. It may be old, or the link is wrong."
          action={
            <Button variant="secondary" size="sm" asChild>
              <Link to="/mission">Back to Mission control</Link>
            </Button>
          }
          className="flex-1"
        />
      </div>
    )
  }
  return <SessionBody key={id} id={id ?? ''} initialView={initialView} live={found} stale={!!found && feed.stale} sampleMode={!found} />
}

function SessionSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4" aria-busy="true" aria-label="Loading session">
      <Skeleton className="h-5 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="h-8 w-full" />
      <Skeleton className="min-h-0 flex-1" />
    </div>
  )
}

interface Model {
  nodes: GNode[]
  edges: GEdge[]
  messages: Msg[]
  baseRows: TranscriptRow[]
}

function SessionBody({ id, initialView, live, stale, sampleMode }: { id: string; initialView: 'chat' | 'cloud'; live?: McSession; stale: boolean; sampleMode: boolean }) {
  const { isWork, vendorFor } = useIdentity()
  const navigate = useNavigate()
  const narrow = useMediaQuery('(max-width: 899px)')
  const now = useNow(1000)
  const [view, setView] = useState<View>(initialView)
  const [renamed, setRenamed] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const [ask, setAsk] = useState<string | null>(null)
  const [panelTab, setPanelTab] = useState<Tab>('run')
  const [inset, setInset] = useState(150)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const cancelRename = useRef(false)

  const sample = sampleSession(id)
  const polling = live ? !['ended', 'offline'].includes(toStatus(live.status, live.online)) : false
  const leadAct = useActivity(live && !live.imported ? id : null, 'lead', polling)
  // Past sessions have no hook data: their conversation comes from the Claude Code transcript.
  const transcriptRows = useTranscript(live?.imported ? id : null)

  const model = useMemo<Model>(() => {
    if (live) {
      const g = liveGraph(live)
      return { nodes: g.nodes, edges: g.edges, messages: liveMessages(live), baseRows: [] }
    }
    return { nodes: SAMPLE_NODES, edges: SAMPLE_EDGES, messages: SAMPLE_MESSAGES, baseRows: sampleRows(isWork) }
  }, [live, isWork])

  // Details tick every second (plan step times), the graph does not (it would reset the cloud's fit).
  const details = useMemo<Record<string, Detail>>(() => (live ? liveDetails(live, now) : sampleDetails()), [live, now])

  // Default selection: the first running agent, else the lead.
  const defaultSel = live ? (live.agents.find((a) => a.state === 'running')?.agent_id ?? 'lead') : 'link-batch-fix'
  const selected = sel && details[sel] ? sel : details[defaultSel] ? defaultSel : 'lead'
  const detail = details[selected]
  const selAct = useActivity(live ? id : null, live && selected !== 'lead' ? selected : null, polling)
  const panelActivity = !live ? undefined : selected === 'lead' ? leadAct.items : selAct.items

  const modelOf = useCallback((n: { model: string; workModel?: string }) => (isWork && n.workModel ? n.workModel : n.model), [isWork])
  const stateOf = useCallback((nid: string) => details[nid]?.state ?? 'idle', [details])

  const changeView = (v: string) => {
    setView(v as View)
    if (v === 'chat' || v === 'cloud') navigate(v === 'cloud' ? `/mission/session/${id}/cloud` : `/mission/session/${id}`, { replace: true })
  }

  const rows = useMemo<TranscriptRow[]>(() => {
    const base = live ? (live.imported ? transcriptRows.rows : liveRows(live, leadAct.items)) : model.baseRows
    return base.flatMap((r): TranscriptRow[] => {
      if (r.kind !== 'ask') return [r]
      if (ask === 'Apply') return [{ kind: 'text', text: 'Applied: link_batch now has the same no-replace rule as require_dev. Nothing is committed.' }]
      if (ask) return [{ kind: 'text', text: 'Left for now. link_batch keeps its current behaviour until you decide.' }]
      return [r]
    })
  }, [live, leadAct.items, transcriptRows.rows, model.baseRows, ask])

  const nodeByName = useCallback((name: string) => model.nodes.find((n) => n.name === name), [model.nodes])
  const openAgent = (name: string) => {
    const n = nodeByName(name)
    if (!n) return
    setSel(n.id)
    setPanelTab('run')
    if (narrow) setView('agent')
  }
  const selectAgent = (nid: string) => {
    setSel(nid)
    setPanelTab('run')
    if (narrow) setView('agent')
  }

  const agentNodes = model.nodes.filter((n) => n.kind === 'worker' || n.kind === 'helper')
  const agentVendors = Array.from(new Set(agentNodes.map((n) => vendorFor(n.vendor)))) as Vendor[]
  const name = renamed ?? (live ? sessionTitle(live) : sample.name)
  const workspace = live ? workspaceName(live.cwd) || 'Unknown folder' : 'Orbit'
  const leadModel = live ? leadModelLabel(live) : sample.leadModel
  const prompt = live ? live.last_prompt.trim().replace(/\s+/g, ' ') : ''
  const task = live ? (renamed ? prompt : live.cwd) : sample.title
  const hasPort = live ? live.port != null : true
  // Only a live, online session with a terminal wrapper can be typed to (composer, terminal, Pause).
  const sendPort = live && live.online && live.port != null ? live.port : null
  const pause = async () => {
    if (sendPort == null) return
    const r = await sendKeys(sendPort, 'esc')
    if (r.ok) toast('Sent Esc: claude stops what it is doing')
    else toast.error(`Could not pause: ${r.error ?? 'unknown error'}`)
  }

  const summary = live ? liveSummary(live, now) : sampleSummary(sample)
  const liveHistory = useFinishHistory(live?.eta ? (live.eta.finish_at ?? null) : null)
  const history = live ? liveHistory : sample.history.replace(/^Estimate history:\s*/, '').split(' → ')
  const elapsed = live
    ? live.eta
      ? formatShort(live.eta.elapsed + Math.max(0, (now - (live.eta.received ?? now)) / 1000))
      : live.turn_started
        ? formatShort(now / 1000 - live.turn_started)
        : null
    : sample.elapsed
  const running = live ? toStatus(live.status, live.online) === 'running' : true

  const rename = (v: string) => {
    if (!editing) return
    const t = v.trim()
    if (t && !cancelRename.current) setRenamed(t)
    cancelRename.current = false
    setEditing(false)
  }
  const startEdit = () => {
    cancelRename.current = false
    setEditing(true)
  }

  const titleEl = editing ? (
    <Input
      autoFocus
      size="sm"
      aria-label="Session name"
      defaultValue={name}
      className="w-60 max-w-full font-normal"
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => rename(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') rename(e.currentTarget.value)
        if (e.key === 'Escape') {
          cancelRename.current = true
          setEditing(false)
        }
      }}
    />
  ) : (
    <span className="group/name inline-flex max-w-[24rem] min-w-0 shrink items-center gap-1">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <h1 className="min-w-0 truncate text-title font-semibold text-1">{name}</h1>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem icon={<Pencil />} onSelect={startEdit}>
            Rename
          </ContextMenuItem>
          <ContextMenuItem icon={<Pause />} disabled={sendPort == null} onSelect={() => void pause()}>
            Pause (send Esc)
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <IconButton label="Rename" icon={<Pencil />} onClick={startEdit} className="opacity-0 group-hover/name:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100" />
    </span>
  )

  const header = (
    <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-stroke-3 px-6 py-2">
      <Link to="/mission" className="shrink-0 rounded-sm text-caption text-3 transition-colors-fast hover:text-1">
        ← {workspace} workspace
      </Link>
      <span aria-hidden className="text-4">
        |
      </span>
      {titleEl}
      <span className="min-w-0 flex-1 basis-0 truncate text-caption text-3">{task}</span>
      {sampleMode ? <Badge tone="outline">Sample data</Badge> : stale ? <Badge tone="attention">Stale</Badge> : null}
      <span className="inline-flex shrink-0 items-center gap-1.5 text-caption text-3">
        Lead
        <AgentMark vendor="claude" size={10} />
        <span className="text-claude">{leadModel}</span>
      </span>
      {live?.imported && <ResumeButton session={live} />}
      {sendPort != null && (
        <Button variant="secondary" size="md" icon={<Pause />} onClick={() => void pause()}>
          Pause
        </Button>
      )}
      <Tooltip
        content={sendPort != null ? 'Watch and type to the real terminal' : !live ? 'Sample session' : hasPort ? 'Session is not running' : 'No terminal wrapper is running for this session'}
        side="bottom"
      >
        <span tabIndex={0} className="inline-flex shrink-0 rounded-md">
          <Button variant="secondary" size="md" icon={<TerminalSquare />} disabled={sendPort == null} onClick={() => setView('term')}>
            Open terminal
          </Button>
        </span>
      </Tooltip>
    </header>
  )

  const cloudEl = (
    <AgentCloud
      nodes={model.nodes}
      edges={model.edges}
      chips={live ? undefined : SAMPLE_CHIPS}
      dots={live ? undefined : SAMPLE_DOTS}
      messages={model.messages}
      selected={selected}
      onSelect={selectAgent}
      modelOf={modelOf}
      stateOf={stateOf}
      emptyNote={live && live.agents.length === 0 ? 'No subagents in this session yet' : undefined}
      bottomInset={inset}
    />
  )

  const chatEl = <Transcript rows={rows} vendorOf={(n) => nodeByName(n)?.vendor} onAsk={setAsk} onOpenAgent={openAgent} bottomInset={inset} />

  const agentCount = agentNodes.length
  const sendBlocked = !live
    ? 'Sample session: nothing to send to'
    : live.imported
      ? 'Past session: press Resume to continue it'
    : sendPort == null
      ? 'No terminal wrapper is running for this session'
      : sending
        ? 'Sending…'
        : undefined
  const submit = async (text: string) => {
    if (sendPort == null || sending) return
    setSending(true)
    const r = await sendPrompt(sendPort, text)
    setSending(false)
    if (r.ok) {
      setDraft('')
      toast.success('Sent to the lead')
    } else toast.error(`Not sent: ${r.error ?? 'unknown error'}`)
  }
  const composer = (
    <Composer
      value={draft}
      onChange={setDraft}
      onSubmit={submit}
      disabledReason={sendBlocked}
      placeholder="Queue another message for the lead…"
      models={[{ value: 'lead', label: live ? leadModel : `${leadModel} Medium`, icon: <AgentMark vendor="claude" size={10} /> }]}
      model="lead"
      running={running}
      onHeightChange={setInset}
      maxWidthClass="max-w-[900px]"
      className="[&_textarea]:min-h-[72px]"
      leftExtra={
        <>
          {elapsed && <span className="inline-flex h-6 items-center rounded-full border border-stroke-2 px-2 text-meta text-2 tabular-nums">{elapsed}</span>}
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-stroke-2 px-2 text-meta text-2 tabular-nums">
            <span className="inline-flex items-center gap-0.5">
              {agentVendors.map((v) => (
                <AgentMark key={v} vendor={v} size={10} />
              ))}
            </span>
            {agentCount} {agentCount === 1 ? 'agent' : 'agents'}
          </span>
        </>
      }
    />
  )

  const panelEl = <AgentPanel key={selected} detail={detail} modelText={modelOf(detail)} messages={model.messages} live={!!live} tab={panelTab} onTab={setPanelTab} activity={panelActivity} sessionRunning={running} />

  const current = narrow || view !== 'agent' ? view : 'chat'

  const tabs = (
    <Tabs value={current} onValueChange={changeView} className="min-h-0 flex-1">
      <TabsList>
        <TabsTrigger value="chat" icon={<MessageSquare />}>
          Conversation
        </TabsTrigger>
        <TabsTrigger value="cloud" icon={<Network />}>
          Agent cloud
        </TabsTrigger>
        {narrow && <TabsTrigger value="agent">Agent</TabsTrigger>}
        {sendPort != null && (
          <TabsTrigger value="term" icon={<TerminalSquare />}>
            Terminal
          </TabsTrigger>
        )}
        <span className="my-auto ml-auto hidden truncate pl-4 text-caption text-3 lg:block">Every prompt you sent to this lead and what happened after it</span>
      </TabsList>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <TabsContent value="chat" className="flex flex-col">
          {chatEl}
        </TabsContent>
        <TabsContent value="cloud" className="flex flex-col">
          {cloudEl}
        </TabsContent>
        {narrow && (
          <TabsContent value="agent" className="flex flex-col">
            {panelEl}
          </TabsContent>
        )}
        {current === 'term' && sendPort != null && (
          <TabsContent value="term" className="flex flex-col">
            <LiveTerminal port={sendPort} className="min-h-0 flex-1" />
          </TabsContent>
        )}
        {current !== 'agent' && current !== 'term' && composer}
      </div>
    </Tabs>
  )

  const main = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {header}
      <SummaryStrip m={summary} history={history} />
      {tabs}
    </div>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {narrow ? (
        main
      ) : (
        <ResizableSplit orientation="horizontal" className="min-h-0 flex-1">
          <ResizablePane id="session-main" minSize="40">
            {main}
          </ResizablePane>
          <ResizeHandle />
          <ResizablePane id="session-agent" defaultSize={400} minSize={300} maxSize={600}>
            {panelEl}
          </ResizablePane>
        </ResizableSplit>
      )}
    </div>
  )
}
