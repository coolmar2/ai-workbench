import { etaView, toStatus, type BadgeTone } from '../../components/ui'
import type { McSession } from '../../data/types'
import type { SampleSession } from './data'
import { verdictOf } from '../../live/verdict'
import { clock12, inText, pctOf, plannedOf, range, stepOf } from './plan'

export interface SummaryModel {
  pct: number | null
  stepText: string | null
  stepLabel: string
  /** Big finish time, or null when there is no estimate. */
  finish: string | null
  finishIn: string
  range: string
  updated: string | null
  verdict: { tone: BadgeTone; label: string }
  reason: string
}

export function sampleSummary(s: SampleSession): SummaryModel {
  return {
    pct: s.pct,
    stepText: s.stepLabel,
    stepLabel: s.stepText,
    finish: s.finish,
    finishIn: s.finishIn,
    range: s.finishRange,
    updated: 'Updated 8 s ago, re-estimated as work lands',
    verdict: { tone: s.verdict.startsWith('Stay') ? 'running' : 'success', label: s.verdict },
    reason: s.verdictNote,
  }
}

/** Summary from the live feed: progress from step/todos/eta, finish from eta, verdict from status and time left. */
export function liveSummary(s: McSession, now: number): SummaryModel {
  const p = plannedOf(s)
  const step = stepOf(p)
  const ev = s.eta ? etaView(s.eta, now) : null
  const status = toStatus(s.status, s.online)
  const hasFinish = !!ev && ev.finishAt != null && ev.kind !== 'overrun' && ev.kind !== 'none'
  const finishAt = hasFinish && ev ? ev.finishAt : null
  const left = ev?.left ?? 0
  const v = verdictOf({
    status,
    left: ev && ev.kind !== 'none' && ev.kind !== 'overrun' ? left : null,
    overrun: ev?.kind === 'overrun',
    finishAt,
    nowSec: now / 1000,
  })
  const verdict: SummaryModel['verdict'] = { tone: v.tone === 'neutral' ? 'neutral' : v.tone, label: v.label }
  const reason = v.reason
  return {
    pct: pctOf(p),
    stepText: step?.text ?? null,
    stepLabel: step?.label ?? 'No plan reported',
    finish: finishAt != null ? clock12(finishAt) : null,
    finishIn: hasFinish ? inText(left) : '',
    range: hasFinish && finishAt != null && s.eta ? range(finishAt, left, s.eta.confidence) : ev?.kind === 'overrun' ? 'Taking longer than usual' : status === 'running' ? 'No estimate yet' : 'Nothing is running',
    updated: s.eta?.received ? `Updated ${Math.max(0, Math.round((now - s.eta.received) / 1000))} s ago, re-estimated as work lands` : null,
    verdict,
    reason,
  }
}

