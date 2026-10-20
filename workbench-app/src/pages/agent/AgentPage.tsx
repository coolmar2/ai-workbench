import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, Circle, ExternalLink, PanelRight, PanelRightClose, SquarePen } from 'lucide-react'
import { useIdentity } from '../../context/identity'
import { useAccounts } from '../../live/accounts'
import { PageActions } from '../../components/shell/PageActions'
import {
  AgentMark, Badge, Button, Card, Composer, IconButton, PageHeader, Popover, PopoverContent, PopoverTrigger, ScrollArea, StatusDot,
  TranscriptAssistantText, TranscriptToolRow, TranscriptUserBlock, Tooltip, cn,
} from '../../components/ui'
import {
  type AgAccount, CHAT_TITLE, CHAT_WORKSPACE, DECISION_TEXT, LEAD_LABEL, LIVE, LIVE_WORK, MODELS, PLAN, PLAN_WORK,
  SESSION_LINK, SUGGESTIONS, TOOL_CALLS, USER_PROMPT,
} from './data'

type Vendor = 'claude' | 'codex' | 'gemini'
const VENDOR_NAME: Record<Vendor, string> = { claude: 'Claude', codex: 'Codex', gemini: 'Gemini' }
/** Sample progress for the plan checklist, by row index. */
const PLAN_STATE = ['running', 'running', 'done', 'pending'] as const

function PlanIcon({ state }: { state: (typeof PLAN_STATE)[number] }) {
  if (state === 'done') return <Check className="size-3.5 text-success" aria-label="Done" />
  if (state === 'running') return <StatusDot status="running" />
  return <Circle className="size-3.5 text-4" aria-label="Pending" />
}

export default function AgentPage() {
  const { isWork } = useIdentity()
  const [started, setStarted] = useState(true)
  const [railOpen, setRailOpen] = useState(true)
  const [draft, setDraft] = useState('')
  const [composerH, setComposerH] = useState(96)

  const plan = isWork ? PLAN_WORK : PLAN
  const live = isWork ? LIVE_WORK : LIVE
  const acc = useAccounts()
  const accounts: AgAccount[] = isWork
    ? [{ vendor: 'claude', name: 'Claude Code', how: 'Work account not set up on this PC' }]
    : acc.accounts
      ? acc.accounts.map((a) => ({ vendor: a.vendor, name: a.name, how: a.signed_in ? `Signed in · ${a.detail}` : a.detail }))
      : [{ vendor: 'claude', name: 'Accounts', how: acc.offline ? 'wb_mc.py is not answering' : 'Checking…' }]
  const rail = <RailContent plan={plan} live={live} accounts={accounts} />

  return (
    <>
      <PageActions>
        <IconButton label="New chat" icon={<SquarePen />} tooltipSide="bottom" onClick={() => { setStarted(false); setDraft('') }} />
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
          <PopoverContent align="end" className="max-h-[70vh] w-[min(320px,calc(100vw-24px))] overflow-y-auto p-0">{rail}</PopoverContent>
        </Popover>
      </PageActions>

      <div className="flex min-h-0 min-w-0 flex-1">
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Lead chat">
          <ScrollArea className="flex-1">
            <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-4 pt-6" style={{ paddingBottom: composerH + 24 }}>
              {started ? (
                <Conversation isWork={isWork} plan={plan} />
              ) : (
                <Welcome onPick={(t) => { setDraft(t) }} />
              )}
            </div>
          </ScrollArea>
          <LeadComposer isWork={isWork} draft={draft} setDraft={setDraft} onHeightChange={setComposerH} />
        </section>
        {railOpen && (
          <aside aria-label="Plan, workers and accounts" className="hidden w-[280px] shrink-0 border-l border-stroke-2 lg:flex lg:flex-col">
            <ScrollArea className="flex-1">{rail}</ScrollArea>
          </aside>
        )}
      </div>
    </>
  )
}

/* ---------------- Welcome ---------------- */

function Welcome({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-6 pt-[8vh] text-center">
      <div className="flex flex-col items-center gap-2">
        <AgentMark vendor="claude" size={18} respectIdentity={false} />
        <h1 className="text-hero font-semibold text-1">What should the lead work on?</h1>
        <p className="text-body text-3">Routing is automatic. The lead splits the work across workers and reports back.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="max-w-full rounded-lg bg-fill-4 px-3 py-1.5 text-left text-caption text-2 shadow-[inset_0_0_0_1px_var(--stroke-3)] transition-colors-fast hover:bg-fill-3 hover:text-1"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Transcript ---------------- */

function Conversation({ isWork, plan }: { isWork: boolean; plan: typeof PLAN }) {
  const [decision, setDecision] = useState<string | null>(null)
  return (
    <>
      <PageHeader
        as="h1"
        title={<span className="block min-w-0 truncate">{CHAT_TITLE}</span>}
        meta={
          <>
            <Badge tone="claude"><AgentMark vendor="claude" size={10} respectIdentity={false} />{LEAD_LABEL}</Badge>
            <span className="text-caption text-3">{CHAT_WORKSPACE}</span>
          </>
        }
        actions={
          <Link to={SESSION_LINK} className="inline-flex items-center gap-1 text-caption text-3 transition-colors-fast hover:text-1">
            Open session view <ExternalLink className="size-3" />
          </Link>
        }
      />

      <TranscriptUserBlock text={USER_PROMPT} />

      <div className="animate-fade-in flex flex-col gap-3 text-body text-1">
        <TranscriptAssistantText text="I will start by finding where links are created, then split the work." />
        <div className="flex flex-col">
          {TOOL_CALLS.map((t) => (
            <TranscriptToolRow key={t.name + t.summary} name={t.name} input={[t.summary]} output={[{ text: t.output }]} dot="ok" />
          ))}
        </div>
        <TranscriptAssistantText text="Here is how I am splitting it. Change any row and I will re-route it." />
        <PlanCard plan={plan} />
        <TranscriptAssistantText
          className="text-2"
          text={`Each worker has its own git worktree, so nothing collides.${isWork ? ' In Work, all workers run on Claude.' : ''}`}
        />
        <Card className="flex flex-col gap-2 p-3">
          {decision ? (
            <>
              <Badge tone="success" caps className="self-start">Decision made</Badge>
              <p className="text-body text-1">{DECISION_TEXT}</p>
              <p className="text-body text-1">
                <span className="text-3">You chose: </span>
                <span className="font-medium">{decision}</span>
              </p>
              <p className="text-caption text-3">Sent to the lead — sending is simulated here</p>
            </>
          ) : (
            <>
              <Badge tone="attention" caps className="self-start">Needs a decision</Badge>
              <p className="text-body text-1">{DECISION_TEXT}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setDecision('Apply to link_batch')}>Apply to link_batch</Button>
                <Button size="sm" variant="ghost" onClick={() => setDecision('Leave for now')}>Leave for now</Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  )
}

function PlanCard({ plan }: { plan: typeof PLAN }) {
  const { vendorFor } = useIdentity()
  return (
    <Card className="divide-y divide-stroke-3">
      {plan.map((p, i) => {
        const state = PLAN_STATE[i] ?? 'pending'
        return (
          <div key={p.task} className="flex items-start gap-2 px-3 py-2">
            <span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center">
              <PlanIcon state={state} />
            </span>
            <div className="min-w-0 flex-1">
              <div className={cn('text-body', state === 'done' ? 'text-3 line-through' : 'text-1')}>{p.task}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-meta text-3">
                <span className="inline-flex items-center gap-1">
                  <AgentMark vendor={p.vendor} size={10} />
                  {VENDOR_NAME[vendorFor(p.vendor)]} · {p.model}
                </span>
                <span>{p.why}</span>
              </div>
            </div>
          </div>
        )
      })}
    </Card>
  )
}

/* ---------------- Composer ---------------- */

function LeadComposer({ isWork, draft, setDraft, onHeightChange }: { isWork: boolean; draft: string; setDraft: (v: string) => void; onHeightChange: (h: number) => void }) {
  const [model, setModel] = useState<string>(MODELS[0])
  const [allowed, setAllowed] = useState({ codex: true, gemini: true })
  return (
    <Composer
      onHeightChange={onHeightChange}
      value={draft}
      onChange={setDraft}
      onSubmit={() => {}}
      label="Message the lead"
      placeholder="Message the lead. Type @ to pull in another chat."
      disabledReason="Sending from the workbench comes later"
      models={MODELS.map((m) => ({ value: m, label: m }))}
      model={model}
      onModelChange={setModel}
      leftExtra={
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 pl-1">
          {isWork ? (
            <Badge tone="work">Claude only · set by Acme Corp</Badge>
          ) : (
            <>
              <span className="text-meta text-3">Workers allowed</span>
              <WorkerChip label="Claude" vendor="claude" on locked />
              <WorkerChip label="Codex" vendor="codex" on={allowed.codex} onToggle={() => setAllowed((a) => ({ ...a, codex: !a.codex }))} />
              <WorkerChip label="Gemini" vendor="gemini" on={allowed.gemini} onToggle={() => setAllowed((a) => ({ ...a, gemini: !a.gemini }))} />
            </>
          )}
        </div>
      }
    />
  )
}

function WorkerChip({ label, vendor, on, locked, onToggle }: { label: string; vendor: Vendor; on: boolean; locked?: boolean; onToggle?: () => void }) {
  const tip = locked ? 'The lead is always Claude' : on ? `Stop allowing ${label} workers` : `Allow ${label} workers`
  return (
    <Tooltip content={tip}>
      <button
        type="button"
        aria-pressed={on}
        aria-label={`${label} workers`}
        aria-disabled={locked || undefined}
        onClick={locked ? undefined : onToggle}
        className={cn(
          'inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-meta transition-colors-fast',
          on ? 'bg-fill-3 text-1' : 'text-3 hover:bg-fill-4 hover:text-2',
          locked && 'cursor-default',
        )}
      >
        <AgentMark vendor={vendor} size={10} respectIdentity={false} />
        <span className="max-sm:sr-only">{label}</span>
      </button>
    </Tooltip>
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

function RailContent({ plan, live, accounts }: { plan: typeof PLAN; live: typeof LIVE; accounts: AgAccount[] }) {
  const { vendorFor } = useIdentity()
  return (
    <div className="flex flex-col">
      <RailSection title="Plan" count={plan.length}>
        <ul className="flex flex-col gap-1.5">
          {plan.map((p, i) => {
            const state = PLAN_STATE[i] ?? 'pending'
            return (
              <li key={p.task} className="flex items-start gap-2 text-caption">
                <span className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center">
                  <PlanIcon state={state} />
                </span>
                <span className={cn('min-w-0', state === 'done' ? 'text-3' : 'text-2')}>{p.task}</span>
              </li>
            )
          })}
        </ul>
      </RailSection>
      <RailSection title="Live workers" count={live.length}>
        <ul className="flex flex-col gap-2">
          {live.map((r) => (
            <li key={r.task} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-caption text-1">
                <AgentMark vendor={r.vendor} size={10} />
                <span className="min-w-0 truncate">{VENDOR_NAME[vendorFor(r.vendor)]} · {r.model}</span>
                <StatusDot status={r.status === 'running' ? 'running' : 'done'} className="ml-auto" />
              </div>
              <div className="text-caption text-2">{r.task}</div>
              <div className="text-meta text-3">{r.depth}</div>
            </li>
          ))}
        </ul>
        <Link to="/mission" className="inline-flex items-center gap-1 text-caption text-3 transition-colors-fast hover:text-1">
          Open mission control <ExternalLink className="size-3" />
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
