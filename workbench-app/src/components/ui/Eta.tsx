import type { ReactNode } from 'react'
import type { McEta } from '../../data/types'
import { Tooltip } from './Tooltip'
import { cn } from './cn'
import { useNow } from './time'
import { clock, etaView, formatDuration, type EtaView } from './etaFormat'

const TIP_TAIL = 'This is an estimate; things can change.'

function tipFor(eta: McEta, v: EtaView): ReactNode {
  if (v.kind === 'overrun') return `Running longer than most comparable runs${eta.basis ? ` (${eta.basis})` : ''}. ${TIP_TAIL}`
  return `${eta.basis ? (/^\d/.test(eta.basis) ? `Based on ${eta.basis}. ` : `${eta.basis}. `) : ''}${v.confidence === 'low' ? 'Low confidence, so shown as a range. ' : ''}${TIP_TAIL}`
}

export interface EtaProps {
  eta: McEta | null | undefined
  /** inline: one text line. pill: compact for cards, nodes, rows. detail: block for panels. */
  variant?: 'inline' | 'pill' | 'detail'
  /** Pill only: short word before the time, e.g. "ETA". */
  label?: string
  className?: string
}

function Rough() {
  return <span className="shrink-0 rounded-sm px-1 text-meta font-normal text-3 shadow-[inset_0_0_0_1px_var(--stroke-1)]">rough</span>
}

/**
 * Honest time estimate for a running turn or agent. Counts down locally between polls (useNow), never goes
 * negative, shows a range when confidence is low, amber when overrunning, renders nothing without an estimate.
 */
export function Eta({ eta, variant = 'inline', label, className }: EtaProps) {
  const now = useNow(1000)
  const v = etaView(eta, now)
  if (!eta || !v) return null

  if (variant === 'pill') {
    if (v.kind === 'none') return null
    const over = v.kind === 'overrun'
    const body = v.kind === 'any' ? 'soon' : over ? v.short : `~${v.short}`
    return (
      <Tooltip content={tipFor(eta, v)}>
        <span
          aria-label={over ? `Taking longer than usual, elapsed ${formatDuration(v.elapsed)}` : `About ${v.short} left`}
          className={cn(
            'inline-flex h-[18px] shrink-0 items-center gap-1 rounded-sm px-1.5 text-meta font-medium whitespace-nowrap tabular-nums',
            over ? 'bg-running/12 text-running' : v.kind === 'range' ? 'bg-fill-4 text-3' : 'bg-fill-3 text-2',
            className,
          )}
        >
          {label && <span className="font-normal text-3">{label}</span>}
          {body}
        </span>
      </Tooltip>
    )
  }

  if (variant === 'inline') {
    if (v.kind === 'none') return null
    const over = v.kind === 'overrun'
    return (
      <Tooltip content={tipFor(eta, v)}>
        <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-caption tabular-nums', over ? 'text-running' : 'text-2', className)}>
          <span className="truncate">
            {over ? `${v.text} · ${formatDuration(v.elapsed)}` : v.kind === 'any' ? 'Finishing any moment' : v.kind === 'range' ? v.text : `~${v.text}`}
            {v.kind === 'left' && v.finishAt != null && <span className="text-3"> · {clock(v.finishAt)}</span>}
          </span>
          {v.kind === 'range' && <Rough />}
        </span>
      </Tooltip>
    )
  }

  const over = v.kind === 'overrun'
  const known = v.progress != null
  const frac = over ? 1 : known ? (v.progress as number) : v.kind === 'none' ? 0 : v.elapsed / Math.max(1, v.elapsed + v.left)
  const pct = Math.round(Math.min(1, Math.max(0, frac)) * 100)
  return (
    <div className={cn('flex flex-col gap-1.5 tabular-nums', className)}>
      {v.kind !== 'none' && (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className={cn('text-title font-semibold', over ? 'text-running' : 'text-1')}>
            {v.kind === 'any' ? 'Finishing any moment' : over || v.kind === 'range' ? v.text : `~${v.text}`}
          </span>
          {v.kind === 'range' && <Rough />}
        </div>
      )}
      {v.finishAt != null && !over && v.kind !== 'none' && <div className="text-caption text-2">finishes around {clock(v.finishAt)}</div>}
      <div
        className="h-1 overflow-hidden rounded-sm bg-fill-2"
        role="progressbar"
        aria-label={known ? 'Progress' : 'Elapsed against estimate'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className={cn('h-full', over ? 'bg-running' : known ? 'bg-accent' : 'bg-fill-1')} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-meta text-3">
        <span>elapsed {formatDuration(v.elapsed)}</span>
        {known && <span>{pct}% of plan done</span>}
      </div>
      {eta.basis && <div className="text-meta text-3">{over || !/^\d/.test(eta.basis) ? eta.basis : `Estimate from ${eta.basis}`}</div>}
    </div>
  )
}
