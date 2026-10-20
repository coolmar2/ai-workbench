/**
 * The one "Should you stay?" rule, shared by the Mission hub cards and the Session summary strip so
 * they can never disagree. Pure: callers pass seconds left from etaView(eta, now) so it ticks.
 */
export type VerdictKind = 'needed' | 'error' | 'stay' | 'overrun' | 'unknown' | 'soon' | 'safe' | 'idle'
export type VerdictTone = 'attention' | 'danger' | 'running' | 'success' | 'neutral'

export interface VerdictInput {
  /** kit status: 'attention' (needs you), 'running', 'error', anything else = not running */
  status: string
  /** seconds left from etaView(eta, now); null when there is no estimate */
  left: number | null
  overrun: boolean
  /** epoch seconds of a known upcoming decision (sample data only; the live feed never has one) */
  decisionAt?: number | null
  /** epoch seconds of the estimated finish, for the reason text */
  finishAt?: number | null
  nowSec: number
}

export interface Verdict {
  kind: VerdictKind
  tone: VerdictTone
  label: string
  reason: string
}

/** Under this many seconds left a running session is "Finishing soon". */
export const FINISHING_SOON_S = 300

const clock = (epoch: number) =>
  new Date(epoch * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export function verdictOf(v: VerdictInput): Verdict {
  if (v.status === 'attention')
    return { kind: 'needed', tone: 'attention', label: 'Needs you now', reason: 'The lead is waiting for your answer.' }
  if (v.status === 'error')
    return { kind: 'error', tone: 'danger', label: 'Something failed', reason: 'The session reported an error. Check the output before you leave.' }
  if (v.status !== 'running')
    return { kind: 'idle', tone: 'neutral', label: 'Nothing running', reason: 'Nothing is running in this session.' }
  if (v.decisionAt != null && v.decisionAt > v.nowSec) {
    const min = Math.max(1, Math.round((v.decisionAt - v.nowSec) / 60))
    return { kind: 'stay', tone: 'running', label: `Stay about ${min} min`, reason: `At about ${clock(v.decisionAt)} the lead needs your decision. After that, you can leave it.` }
  }
  if (v.overrun)
    return { kind: 'overrun', tone: 'running', label: 'Taking longer', reason: 'This is past its usual time. Check the live output before you leave.' }
  if (v.left == null)
    return { kind: 'unknown', tone: 'neutral', label: 'No estimate yet', reason: 'It is working, but there is no history to estimate from yet.' }
  if (v.left < FINISHING_SOON_S)
    return { kind: 'soon', tone: 'running', label: 'Finishing soon', reason: 'Almost done. No decision is needed from you.' }
  return {
    kind: 'safe', tone: 'success', label: 'Safe to leave',
    reason: v.finishAt != null ? `No decision from you is pending. Done about ${clock(v.finishAt)}.` : 'No decision from you is pending. It keeps working without you.',
  }
}

/** The lead's model, only when the feed reports it. Never guessed from sub-agents (they often run cheaper models). */
export function leadModelOf(s: { model?: string | null }): string | null {
  return s.model || null
}
