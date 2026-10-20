import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, FolderPlus, MessageSquarePlus, Pencil, Plus } from 'lucide-react'
import {
  AgentMark,
  Button,
  Card,
  Composer,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  EmptyState,
  IconButton,
  Input,
  Panel,
  ScrollArea,
  TranscriptAssistantText,
  TranscriptHandoffRow,
  TranscriptThinkingRow,
  TranscriptToolRow,
  TranscriptUserBlock,
  cn,
  toast,
  toStatus,
} from '../../components/ui'
import { useIdentity } from '../../context/identity'
import type { McSession, TranscriptRow } from '../../data/types'
import { useStartSession } from '../../components/shell/StartSession'
import { sendPrompt } from '../../live/actions'
import { sessionTitle } from '../../live/mission'
import { leadModelLabel, liveRows } from '../session/live'
import { inText, useActivity } from '../session/plan'
import { useWsAgents } from './api'
import { sdefsAll, transcripts, type SessionDef } from './data'
import { VENDOR_BG } from './layout'

/** The agent's question card: choosing an answer is recorded locally and the buttons lock. */
function AskCard({ row, readOnly }: { row: Extract<TranscriptRow, { kind: 'ask' }>; readOnly?: boolean }) {
  const [choice, setChoice] = useState<string | null>(null)
  return (
    <Card className="flex animate-fade-in flex-col gap-2 p-3">
      {row.label && <div className="caps">{row.label}</div>}
      <p className="text-body text-1">{row.text}</p>
      {readOnly ? (
        <p className="text-meta text-3">Answer in the session terminal or on the session page.</p>
      ) : choice ? (
        <p className="text-meta text-3">You chose: <span className="text-2">{choice}</span>. The reply is not sent from the workbench yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {row.actions.map((a) => <Button key={a} size="sm" variant="secondary" onClick={() => setChoice(a)}>{a}</Button>)}
        </div>
      )}
    </Card>
  )
}

function Row({ row, readOnly }: { row: TranscriptRow; readOnly?: boolean }) {
  switch (row.kind) {
    case 'user':
      return <TranscriptUserBlock text={row.text} time={row.time} />
    case 'thinking':
      return <TranscriptThinkingRow text={row.text ?? 'Reasoning is collapsed.'} />
    case 'text':
      return <TranscriptAssistantText text={row.text} />
    case 'ask':
      return <AskCard row={row} readOnly={readOnly} />
    case 'tool':
      return row.name === 'SubagentHandoff' ? (
        <TranscriptHandoffRow target={row.detail?.replace(/^to /, '')} input={row.input} output={row.output} />
      ) : (
        <TranscriptToolRow name={row.name} detail={row.detail} input={row.input} output={row.output} dot={row.dot} />
      )
  }
}

function RenameInput({ name, onRename }: { name: string; onRename: (v: string | null) => void }) {
  const [draft, setDraft] = useState(name)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  return (
    <Input
      ref={ref}
      size="sm"
      aria-label="Session name"
      className="w-32 shrink-0"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onRename(draft.trim() || null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onRename(draft.trim() || null)
        if (e.key === 'Escape') onRename(null)
      }}
    />
  )
}

function SessionTab({
  name,
  active,
  vendor,
  editing,
  onSelect,
  onStartRename,
  onRename,
  onMenuOpenChange,
}: {
  name: string
  active: boolean
  vendor: 'claude' | 'codex' | 'gemini'
  editing: boolean
  onSelect: () => void
  onStartRename: () => void
  onRename: (v: string | null) => void
  onMenuOpenChange: (open: boolean) => void
}) {
  if (editing) return <RenameInput name={name} onRename={onRename} />
  return (
    <ContextMenu onOpenChange={onMenuOpenChange}>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          aria-pressed={active}
          onClick={onSelect}
          onKeyDown={(e) => e.key === 'F2' && onStartRename()}
          className={cn(
            'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-caption text-3 transition-colors-fast hover:bg-fill-3 hover:text-1',
            active && 'bg-fill-2 text-1',
          )}
        >
          <AgentMark vendor={vendor} />
          {name}
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
        <ContextMenuItem icon={<Pencil />} shortcut="F2" onSelect={onStartRename}>Rename</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

/** The AI panel: same transcript style as the Mission control session view, with a session switcher. `extra` sits at the end of the header. */
export function AiPanel({ extra, root }: { extra?: ReactNode; root?: string | null }) {
  if (root && !root.startsWith('sample:')) return <LiveAiPanel root={root} extra={extra} />
  // Sample conversations only beside sample workspaces (feed offline); with no folder open, say so.
  if (root) return <SampleAiPanel extra={extra} />
  return <NoFolderAiPanel extra={extra} />
}

function NoFolderAiPanel({ extra }: { extra?: ReactNode }) {
  const { open } = useStartSession()
  return (
    <div className="flex h-full min-h-0 flex-col">
      {extra}
      <EmptyState
        icon={<MessageSquarePlus />}
        title="No folder open"
        hint="Open a workspace to see its sessions here, or start a session in a folder."
        action={
          <Button size="sm" onClick={() => open()}>
            Start a session
          </Button>
        }
        className="flex-1"
      />
    </div>
  )
}

function LiveAiPanel({ root, extra }: { root: string; extra?: ReactNode }) {
  const { agents } = useWsAgents(root)
  const { open } = useStartSession()
  const sessions = useMemo(() => [...agents.sessions].sort((a, b) => Number(b.online) - Number(a.online)), [agents.sessions])
  const [sid, setSid] = useState<string | null>(null)
  const cur: McSession | undefined = sessions.find((s) => s.session_id === sid) ?? sessions[0]
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [inset, setInset] = useState(80)
  const polling = cur ? !['ended', 'offline'].includes(toStatus(cur.status, cur.online)) : false
  const act = useActivity(cur ? cur.session_id : null, 'lead', polling)
  const rows = useMemo(() => (cur ? liveRows(cur, act.items) : []), [cur, act.items])
  const sendPort = cur && cur.online && cur.port != null ? cur.port : null
  const blocked = !cur
    ? 'Start a session in this folder first'
    : sendPort == null
      ? cur.online
        ? 'No terminal wrapper is running for this session'
        : 'This session is offline'
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
  const newSession = () => open(root)
  const eta = cur?.eta
  const pct = eta?.progress != null ? Math.round(eta.progress * 100) : null
  const etaText = eta ? (eta.seconds_left != null ? `about ${inText(eta.seconds_left)} left` : eta.overrun ? 'running long' : null) : null

  return (
    <Panel className="h-full bg-chrome" aria-label="AI panel">
      <header className="flex h-8 shrink-0 items-center gap-2 border-b border-stroke-3 px-3">
        <AgentMark vendor="claude" size={14} />
        <span className="text-body font-medium text-1">Lead</span>
        <span className="min-w-0 flex-1 truncate text-caption text-3">{cur ? leadModelLabel(cur) : ''}</span>
        {cur && (
          <Button asChild variant="ghost" size="sm">
            <Link to={`/mission/session/${cur.session_id}`}><ExternalLink />Mission control</Link>
          </Button>
        )}
        {extra}
      </header>

      <div className="flex shrink-0 items-center gap-1 border-b border-stroke-3 px-2 py-1.5">
        <ScrollArea orientation="horizontal" className="flex min-w-0 flex-1 items-center gap-1" role="group" aria-label="Sessions">
          {sessions.map((s) => (
            <button
              key={s.session_id}
              type="button"
              aria-pressed={s.session_id === cur?.session_id}
              onClick={() => setSid(s.session_id)}
              className={cn(
                'inline-flex h-6 max-w-44 shrink-0 items-center gap-1.5 rounded-md px-2 text-caption text-3 transition-colors-fast hover:bg-fill-3 hover:text-1',
                s.session_id === cur?.session_id && 'bg-fill-2 text-1',
                !s.online && 'opacity-60',
              )}
            >
              <AgentMark vendor="claude" />
              <span className="truncate">{sessionTitle(s)}</span>
            </button>
          ))}
        </ScrollArea>
        <IconButton label="New session" icon={<Plus />} onClick={newSession} />
      </div>

      {cur && (
        <div className="shrink-0 border-b border-stroke-3 px-3 py-2">
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-caption text-1">{sessionTitle(cur)}</span>
            {etaText && <span className="shrink-0 text-meta text-3 tabular-nums">{pct != null ? `${pct}% · ${etaText}` : etaText}</span>}
          </div>
          {pct != null && (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-fill-3" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Session progress">
              <div className="h-full rounded-full bg-claude" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <ScrollArea className="absolute inset-0" style={{ paddingBottom: inset }}>
          {!cur ? (
            <EmptyState
              compact
              icon={<FolderPlus />}
              title="No session in this folder"
              hint="Sessions started here show up with their live conversation."
              action={<Button size="sm" variant="secondary" onClick={newSession}>Start a session in this folder</Button>}
            />
          ) : rows.length === 0 ? (
            <EmptyState compact icon={<MessageSquarePlus />} title="No messages yet" hint="Send a message to the lead below." />
          ) : (
            <div className="flex flex-col gap-3 px-3 py-3">
              {rows.map((r, i) => <Row key={`${cur.session_id}-${i}`} row={r} readOnly />)}
            </div>
          )}
        </ScrollArea>
        <Composer
          value={draft}
          onChange={setDraft}
          onSubmit={submit}
          label="Message the lead"
          placeholder="Message the lead"
          disabledReason={blocked}
          maxWidthClass="max-w-none"
          onHeightChange={setInset}
        />
      </div>
    </Panel>
  )
}

function SampleAiPanel({ extra }: { extra?: ReactNode }) {
  const { isWork, vendorFor } = useIdentity()
  const base = isWork ? sdefsAll.slice(0, 2) : sdefsAll
  const [fresh, setFresh] = useState<SessionDef[]>([])
  const defs = [...base, ...fresh]
  const [sid, setSid] = useState('s1')
  const [names, setNames] = useState<Record<string, string>>({})
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [inset, setInset] = useState(80)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuGen, setMenuGen] = useState(0)

  // Esc while a session menu is open closes only the menu. The surrounding Sheet leaves that Esc alone (see EditorPage), and the kit's
  // layers do not share one stack, so close the menu here (ContextMenu has no `open` prop: remount it).
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setMenuOpen(false)
      setMenuGen((g) => g + 1)
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [menuOpen])
  const cur = defs.find((d) => d.key === sid) ?? defs[0]
  const rows = transcripts[cur.key]?.[isWork ? 'work' : 'personal'] ?? []
  const nameOf = (k: string, fallback: string) => names[k] ?? fallback
  const bar: CSSProperties = { width: `${cur.pct}%` }

  const newSession = () => {
    const n = fresh.length + 1
    const def: SessionDef = { key: `new${n}`, name: `New session ${n}`, title: 'Not started', model: cur.model, vendor: cur.vendor, pct: 0, eta: 'not started' }
    setFresh((f) => [...f, def])
    setSid(def.key)
  }

  return (
    <Panel className="h-full bg-chrome" aria-label="AI panel">
      <header className="flex h-8 shrink-0 items-center gap-2 border-b border-stroke-3 px-3">
        <AgentMark vendor={cur.vendor} size={14} />
        <span className="text-body font-medium text-1">Lead</span>
        <span className="min-w-0 flex-1 truncate text-caption text-3">{cur.model}</span>
        <Button asChild variant="ghost" size="sm">
          <Link to="/mission/session/importer-scan"><ExternalLink />Mission control</Link>
        </Button>
        {extra}
      </header>

      <div className="flex shrink-0 items-center gap-1 border-b border-stroke-3 px-2 py-1.5">
        <ScrollArea orientation="horizontal" className="flex min-w-0 flex-1 items-center gap-1" role="group" aria-label="Sessions">
          {defs.map((d) => (
            <SessionTab
              key={`${d.key}-${menuGen}`}
              onMenuOpenChange={setMenuOpen}
              name={nameOf(d.key, d.name)}
              active={d.key === cur.key}
              vendor={d.vendor}
              editing={renaming === d.key}
              onSelect={() => setSid(d.key)}
              onStartRename={() => setRenaming(d.key)}
              onRename={(v) => {
                if (v) setNames((n) => ({ ...n, [d.key]: v }))
                setRenaming(null)
              }}
            />
          ))}
        </ScrollArea>
        <IconButton label="New session" icon={<Plus />} onClick={newSession} />
      </div>

      <div className="shrink-0 border-b border-stroke-3 px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-caption text-1">{cur.title}</span>
          <span className="shrink-0 text-meta text-3 tabular-nums">{cur.pct > 0 ? `${cur.pct}% · done about ${cur.eta}` : cur.eta}</span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-fill-3" role="progressbar" aria-valuenow={cur.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${nameOf(cur.key, cur.name)} progress`}>
          <div className={cn('h-full rounded-full', VENDOR_BG[vendorFor(cur.vendor)])} style={bar} />
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <ScrollArea className="absolute inset-0" style={{ paddingBottom: inset }}>
          {rows.length === 0 ? (
            <EmptyState compact icon={<MessageSquarePlus />} title="No messages yet" hint="Sending from the workbench comes later." />
          ) : (
            <div className="flex flex-col gap-3 px-3 py-3">
              {rows.map((r, i) => <Row key={`${cur.key}-${i}`} row={r} />)}
            </div>
          )}
        </ScrollArea>
        <Composer
          value={draft}
          onChange={setDraft}
          onSubmit={() => setDraft('')}
          label="Message the lead"
          placeholder="Message the lead"
          disabledReason="Sending from the workbench comes later"
          maxWidthClass="max-w-none"
          onHeightChange={setInset}
        />
      </div>
    </Panel>
  )
}
