import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Circle, ExternalLink, Loader2, PanelRight, PanelRightClose, Play, SearchX, SquarePen, UserX } from 'lucide-react'
import { useIdentity } from '../../context/identity'
import { useAccounts } from '../../live/accounts'
import { sendPrompt } from '../../live/actions'
import { agentName, modelLabel, sessionTitle, useMissionFeed, vendorOfModel, workspaceName } from '../../live/mission'
import type { McSession, TranscriptRow } from '../../data/types'
import { PageActions } from '../../components/shell/PageActions'
import { sameFolder, useStartSession } from '../../components/shell/StartSession'
import {
  AgentMark, Badge, Button, Composer, EmptyState, IconButton, ListRow, PageHeader, Popover, PopoverContent, PopoverTrigger, ScrollArea,
  Skeleton, StatusDot, cn, toStatus, toast,
} from '../../components/ui'
import { leadModelLabel, liveRows } from '../session/live'
import { plannedOf, useActivity, type Todo } from '../session/plan'
import { Transcript } from '../session/transcript/Transcript'
import type { AgAccount } from './data'

type Vendor = 'claude' | 'codex' | 'gemini'
const VENDOR_NAME: Record<Vendor, string> = { claude: 'Claude', codex: 'Codex', gemini: 'Gemini' }

interface Pending {
  folder: string
  at: number
  /** Session ids that already existed when the start finished; the new one is not among them. */
  known: Set<string>
}

function TodoIcon({ status }: { status: string }) {
  if (status === 'completed') return <Check className="size-3.5 text-success" aria-label="Done" />
  if (status === 'in_progress') return <StatusDot status="running" />
  return <Circle className="size-3.5 text-4" aria-label="Pending" />
}

/** Online sessions first, then newest event first. */
function byRecent(list: McSession[]): McSession[] {
  return [...list].sort((a, b) => Number(b.online) - Number(a.online) || (b.last_event_t || '').localeCompare(a.last_event_t || ''))
}

export default function AgentPage() {
  const { isWork } = useIdentity()
  const feed = useMissionFeed()
  const startDialog = useStartSession()
  const [params, setParams] = useSearchParams()
  const [pending, setPending] = useState<Pending | null>(null)
  const [railOpen, setRailOpen] = useState(true)
  const acc = useAccounts()

  const feedRef = useRef(feed)
  useEffect(() => {
    feedRef.current = feed
  }, [feed])

  const paramId = params.get('session')
  const sessions = feed.state?.sessions
  const arrived = useMemo(
    () => (pending ? sessions?.find((s) => !pending.known.has(s.session_id) && sameFolder(s.cwd, pending.folder)) : undefined),
    [pending, sessions],
  )
  const chosenId = paramId ?? arrived?.session_id ?? null

  // Keep the chosen session in the URL so a reload keeps it.
  useEffect(() => {
    if (!paramId && arrived) setParams({ session: arrived.session_id }, { replace: true })
  }, [paramId, arrived, setParams])

  const select = (id: string | null) => {
    setPending(null)
    setParams(id ? { session: id } : {}, { replace: false })
  }
  const startNew = () =>
    startDialog.open(undefined, (info) => {
      const known = new Set((feedRef.current.state?.sessions ?? []).map((s) => s.session_id))
      setPending({ folder: info.folder, at: info.at, known })
      setParams({}, { replace: false })
    })

  const session = chosenId ? sessions?.find((s) => s.session_id === chosenId) : undefined

  const accounts: AgAccount[] = acc.accounts
    ? acc.accounts.map((a) => ({ vendor: a.vendor, name: a.name, how: a.signed_in ? `Signed in · ${a.detail}` : a.detail }))
    : [{ vendor: 'claude', name: 'Accounts', how: acc.offline ? 'wb_mc.py is not answering' : 'Checking…' }]

  const actions = (
    <PageActions>
      <IconButton label="Start a session" icon={<SquarePen />} tooltipSide="bottom" onClick={startNew} />
      {session && (
        <>
          <IconButton
            label={railOpen ? 'Hide side rail' : 'Show side rail'}
            icon={railOpen ? <PanelRightClose /> : <PanelRight />}
            tooltipSide="bottom"
            className="max-lg:hidden"
            onClick={() => setRailOpen((o) => !o)}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" icon={<PanelRight />} className="lg:hidden">Details</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="max-h-[70vh] w-[min(320px,calc(100vw-24px))] overflow-y-auto p-0">
              <RailContent session={session} accounts={accounts} />
            </PopoverContent>
          </Popover>
        </>
      )}
    </PageActions>
  )

  if (isWork) {
    return (
      <>
        {actions}
        <EmptyState
          icon={<UserX />}
          title="Work account not set up on this PC"
          hint="Sessions from this workbench run under your personal account. Set up the Work account to see them here."
          className="flex-1"
        />
      </>
    )
  }

  let body: ReactNode
  if (!feed.checked) {
    body = (
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4" aria-busy="true" aria-label="Loading sessions">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="min-h-0 flex-1" />
      </div>
    )
  } else if (session) {
    body = (
      <div className="flex min-h-0 min-w-0 flex-1">
        <SessionChat key={session.session_id} session={session} stale={feed.stale} onBack={() => select(null)} />
        {railOpen && (
          <aside aria-label="Plan, workers and accounts" className="hidden w-[280px] shrink-0 border-l border-stroke-2 lg:flex lg:flex-col">
            <ScrollArea className="flex-1">
              <RailContent session={session} accounts={accounts} />
            </ScrollArea>
          </aside>
        )}
      </div>
    )
  } else if (chosenId && sessions) {
    body = (
      <EmptyState
        icon={<SearchX />}
        title="Session not found"
        hint="This id is not in the feed. It may be old, or the link is wrong."
        action={<Button variant="secondary" size="sm" onClick={() => select(null)}>Pick another session</Button>}
        className="flex-1"
      />
    )
  } else if (pending) {
    body = (
      <EmptyState
        icon={<Loader2 className="animate-spin" />}
        title="Waiting for claude to start…"
        hint={`${pending.folder} · it appears here as soon as claude reports in.`}
        action={<Button variant="ghost" size="sm" onClick={() => setPending(null)}>Stop waiting</Button>}
        className="flex-1"
      />
    )
  } else {
    body = <SessionPicker sessions={sessions ?? null} stale={feed.stale} onPick={select} onStart={startNew} />
  }

  return (
    <>
      {actions}
      {body}
    </>
  )
}

/* ---------------- Empty state + live sessions ---------------- */

function SessionPicker({ sessions, stale, onPick, onStart }: { sessions: McSession[] | null; stale: boolean; onPick: (id: string) => void; onStart: () => void }) {
  const list = useMemo(() => byRecent(sessions ?? []), [sessions])
  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-4 py-10">
        <EmptyState
          icon={<AgentMark vendor="claude" size={14} respectIdentity={false} />}
          title="No session chosen"
          hint={
            sessions === null
              ? 'wb_mc.py is not answering, so live sessions cannot be listed. You can still start a new one.'
              : 'Start a new session, or pick a live one to follow and message it from here.'
          }
          action={<Button icon={<Play />} onClick={onStart}>Start a session</Button>}
        />
        {list.length > 0 && (
          <section className="flex flex-col gap-1" aria-label="Live sessions">
            <h2 className="caps flex items-center gap-2 px-2">
              Sessions
              <span className="tabular-nums text-3">{list.length}</span>
              {stale && <Badge tone="attention">Stale</Badge>}
            </h2>
            {list.map((s) => (
              <ListRow
                key={s.session_id}
                leading={<StatusDot status={toStatus(s.status, s.online)} />}
                trailing={<span className="text-meta text-3">{workspaceName(s.cwd) || 'Unknown folder'}</span>}
                onClick={() => onPick(s.session_id)}
              >
                <span className="truncate">{sessionTitle(s)}</span>
              </ListRow>
            ))}
          </section>
        )}
      </div>
    </ScrollArea>
  )
}

/* ---------------- Selected session ---------------- */

function SessionChat({ session, stale, onBack }: { session: McSession; stale: boolean; onBack: () => void }) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [inset, setInset] = useState(120)
  const status = toStatus(session.status, session.online)
  const polling = !['ended', 'offline'].includes(status)
  const act = useActivity(session.session_id, 'lead', polling)
  const rows = useMemo<TranscriptRow[]>(() => liveRows(session, act.items), [session, act.items])

  const sendPort = session.online && session.port != null ? session.port : null
  const blocked = !session.online
    ? 'Session is not running'
    : sendPort == null
      ? 'No terminal wrapper for this session'
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

  return (
    <section className="relative flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Lead chat">
      <div className="px-4 pt-4">
        <div className="mx-auto w-full max-w-[760px]">
          <PageHeader
            as="h1"
            title={<span className="block min-w-0 truncate">{sessionTitle(session)}</span>}
            meta={
              <>
                <Badge tone="claude"><AgentMark vendor="claude" size={10} respectIdentity={false} />{leadModelLabel(session)}</Badge>
                <span className="text-caption text-3">{workspaceName(session.cwd) || 'Unknown folder'}</span>
                <span className="inline-flex items-center gap-1 text-caption text-3">
                  <StatusDot status={status} />
                  {session.status}
                </span>
                {stale && <Badge tone="attention">Stale</Badge>}
              </>
            }
            actions={
              <>
                <button type="button" onClick={onBack} className="text-caption text-3 transition-colors-fast hover:text-1">All sessions</button>
                <Link to={`/mission/session/${session.session_id}`} className="inline-flex items-center gap-1 text-caption text-3 transition-colors-fast hover:text-1">
                  Open in Mission control <ExternalLink className="size-3" />
                </Link>
              </>
            }
          />
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <Transcript rows={rows} vendorOf={() => undefined} onAsk={() => {}} onOpenAgent={() => {}} bottomInset={inset} />
        <Composer
          value={draft}
          onChange={setDraft}
          onSubmit={submit}
          label="Message the lead"
          placeholder="Message the lead…"
          disabledReason={blocked}
          onHeightChange={setInset}
          maxWidthClass="max-w-[760px]"
          leftExtra={<span className="pl-1 text-meta text-3">Lead · {leadModelLabel(session)}</span>}
        />
      </div>
    </section>
  )
}

/* ---------------- Right rail ---------------- */

function RailSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b border-stroke-3 p-3 last:border-b-0">
      <h2 className="caps flex items-center gap-2">
        {title}
        <span className="tabular-nums text-3">{count}</span>
      </h2>
      {children}
    </section>
  )
}

function RailContent({ session, accounts }: { session: McSession; accounts: AgAccount[] }) {
  const { vendorFor } = useIdentity()
  const todos: Todo[] = plannedOf(session).todos ?? []
  return (
    <div className="flex flex-col">
      <RailSection title="Plan" count={todos.length}>
        {todos.length === 0 ? (
          <p className="text-caption text-3">No plan reported</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {todos.map((t, i) => (
              <li key={`${i}-${t.content}`} className="flex items-start gap-2 text-caption">
                <span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center">
                  <TodoIcon status={t.status} />
                </span>
                <span className={cn('min-w-0', t.status === 'completed' ? 'text-3 line-through' : 'text-2')}>{t.content}</span>
              </li>
            ))}
          </ul>
        )}
      </RailSection>
      <RailSection title="Live workers" count={session.agents.length}>
        {session.agents.length === 0 ? (
          <p className="text-caption text-3">No workers in this session</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {session.agents.map((a) => {
              const v = vendorOfModel(a.model)
              return (
                <li key={a.agent_id} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 text-caption text-1">
                    <AgentMark vendor={v} size={10} />
                    <span className="min-w-0 truncate">{agentName(a)}</span>
                    <StatusDot status={toStatus(a.state, true)} className="ml-auto" />
                  </div>
                  <div className="text-meta text-3">
                    {VENDOR_NAME[vendorFor(v)]}
                    {a.model ? ` · ${modelLabel(a.model)}` : ''} · {a.state}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <Link to={`/mission/session/${session.session_id}`} className="inline-flex items-center gap-1 text-caption text-3 transition-colors-fast hover:text-1">
          Open in Mission control <ExternalLink className="size-3" />
        </Link>
      </RailSection>
      <RailSection title="Accounts" count={accounts.length}>
        <ul className="flex flex-col gap-1.5">
          {accounts.map((a) => (
            <li key={a.name} className="flex items-start gap-2 text-caption">
              <AgentMark vendor={a.vendor} size={10} respectIdentity={false} className="mt-1" />
              <div className="min-w-0">
                <div className="text-1">{a.name}</div>
                <div className="text-meta text-3">{a.how}</div>
              </div>
            </li>
          ))}
        </ul>
      </RailSection>
    </div>
  )
}
