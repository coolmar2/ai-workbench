import { Link } from 'react-router-dom'
import { AgentMark, Badge, Eta, etaView, cn, useNow } from '../../components/ui'
import type { Vendor } from '../../data/types'
import { Bar } from './parts'
import { VENDOR_TEXT } from './style'
import { clock12, hubVerdict, type HubSession } from './model'

const MAX_MARKS = 8

function ago(updatedAt: number | null, now: number): string {
  if (updatedAt == null) return 'update time not reported'
  const s = Math.max(0, Math.round((now - updatedAt) / 1000))
  if (s < 60) return `updated ${s} s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `updated ${m} min ago`
  return `updated ${Math.floor(m / 60)} h ago`
}

function rangeText(s: HubSession): string | null {
  if (s.startAt == null || s.finishAt == null) return null
  const a = clock12(s.startAt)
  const b = clock12(s.finishAt)
  const sameHalf = a.slice(-2) === b.slice(-2)
  return `${sameHalf ? a.slice(0, -3) : a} to ${b}`
}

function DoneLine({ s }: { s: HubSession }) {
  const now = useNow(1000)
  const v = etaView(s.eta, now)
  if (!s.eta || !v || v.kind === 'none') {
    return <span className="text-caption text-3">{s.status === 'running' ? 'No estimate yet' : s.statusText}</span>
  }
  if (v.kind === 'overrun') return <Eta eta={s.eta} variant="inline" />
  if (v.kind === 'any') return <span className="text-body font-semibold text-1">Finishing any moment</span>
  const mins = v.left < 60 ? `${Math.round(v.left)} s` : `${Math.max(1, Math.round(v.left / 60))} min`
  const range = rangeText(s)
  return (
    <div className="flex min-w-0 items-baseline gap-2 tabular-nums">
      <span className="shrink-0 text-body font-semibold text-1">Done about {v.finishAt != null ? clock12(v.finishAt) : ''}</span>
      {v.kind === 'range' ? (
        <>
          <span className="min-w-0 truncate text-caption text-3">{v.text}</span>
          <Badge tone="outline">rough</Badge>
        </>
      ) : (
        <span className="shrink-0 text-caption text-3">in {mins}</span>
      )}
      {range && <span className="ml-auto shrink-0 pl-2 text-meta whitespace-nowrap text-3">{range}</span>}
    </div>
  )
}

export function VerdictChip({ s }: { s: HubSession }) {
  const now = useNow(1000)
  const v = hubVerdict(s, now)
  const cls = 'h-5 px-2 text-caption'
  switch (v.kind) {
    case 'needed':
      return <Badge tone="attention" className={cls}>Needed now</Badge>
    case 'error':
      return <Badge tone="danger" className={cls}>Something failed</Badge>
    case 'stay': {
      const min = Math.max(1, Math.round(((s.decisionAt ?? now / 1000) - now / 1000) / 60))
      return (
        <Badge tone="running" className={cls}>
          Stay {min} min{s.decisionAt != null ? `: decision at ${clock12(s.decisionAt)}` : ''}
        </Badge>
      )
    }
    case 'overrun':
      return <Badge tone="running" className={cls}>Taking longer</Badge>
    case 'soon':
      return <Badge tone="neutral" className={cls}>Finishing soon</Badge>
    case 'safe':
      return <Badge tone="success" className={cls}>Safe to leave</Badge>
    case 'unknown':
      return <Badge tone="outline" className={cls}>No estimate yet</Badge>
    default:
      return <Badge tone="outline" className={cls}>{s.statusText}</Badge>
  }
}

function Marks({ vendors }: { vendors: Vendor[] }) {
  return (
    <span className="flex min-w-0 items-center gap-[3px] overflow-hidden">
      {vendors.slice(0, MAX_MARKS).map((v, i) => (
        <AgentMark key={i} vendor={v} size={10} label="" />
      ))}
    </span>
  )
}

/** Board session card: title, lead + agents, Now, progress, Done about, verdict. */
export function HubCard({ s, className, style }: { s: HubSession; className?: string; style?: React.CSSProperties }) {
  const now = useNow(1000)
  const pct = s.progress == null ? null : Math.round(s.progress * 100)
  return (
    <Link
      to={`/mission/session/${s.id}`}
      style={style}
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-lg border border-stroke-2 bg-card px-3.5 py-3 transition-colors-fast animate-fade-in',
        'hover:border-stroke-1 hover:bg-elevated',
        className,
      )}
    >
      <h3 className="truncate text-body font-semibold text-1">{s.title}</h3>
      <div className="flex min-w-0 items-center gap-2 text-caption text-3">
        <span className="flex shrink-0 items-center gap-1.5">
          Lead
          <AgentMark vendor={s.lead} size={10} label="" />
          <span className={cn('whitespace-nowrap', VENDOR_TEXT[s.lead])}>{s.leadModel}</span>
        </span>
        <span className="ml-auto flex min-w-0 items-center gap-2 tabular-nums">
          <Marks vendors={s.agents} />
          <span className="shrink-0 whitespace-nowrap">{s.agentCount} {s.agentCount === 1 ? 'agent' : 'agents'}</span>
        </span>
      </div>
      <p className="line-clamp-2 min-h-8 text-caption text-2">{s.now ? <>{s.status === 'running' ? 'Now' : 'Last prompt'}: {s.now}</> : 'Current activity not reported'}</p>
      <div className="flex items-center gap-2.5">
        <Bar value={s.progress} vendor={s.lead} label={`${s.title} progress`} className="h-2 flex-1" />
        <span className="w-8 shrink-0 text-right text-caption font-semibold text-1 tabular-nums">{pct == null ? '–' : `${pct}%`}</span>
      </div>
      <DoneLine s={s} />
      <div className="mt-auto flex items-center gap-2">
        <VerdictChip s={s} />
        <span className="ml-auto truncate text-meta text-3 tabular-nums">{ago(s.updatedAt, now)}</span>
      </div>
    </Link>
  )
}
