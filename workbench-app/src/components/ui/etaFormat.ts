import type { McEta } from '../../data/types'

/** "41s", "4m 12s", "1h 05m". */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

/** Compact: "45s", "2m", "1h5m". For pills. */
export function formatShort(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h${m % 60 ? `${m % 60}m` : ''}`
}

/** "2 min", "45 s", "1 h 5 min". */
function formatLong(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  if (s < 60) return `${s} s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`
}

export function clock(epochSec: number): string {
  const d = new Date(epochSec * 1000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export interface EtaView {
  kind: 'overrun' | 'any' | 'left' | 'range' | 'none'
  left: number
  elapsed: number
  finishAt: number | null
  progress: number | null
  /** "2 min left", "roughly 1–4 min", "any moment", "Taking longer than usual". */
  text: string
  short: string
  confidence: McEta['confidence']
}

/** Pure: what to show for `eta` at wall-clock `nowMs`. Counts down locally, never negative. */
export function etaView(eta: McEta | null | undefined, nowMs: number): EtaView | null {
  if (!eta) return null
  const since = Math.max(0, (nowMs - (eta.received ?? nowMs)) / 1000)
  const elapsed = (Number.isFinite(eta.elapsed) ? eta.elapsed : 0) + since
  const base = { elapsed, progress: eta.progress ?? null, confidence: eta.confidence }
  if (eta.overrun) return { ...base, kind: 'overrun', left: 0, finishAt: null, text: 'Taking longer than usual', short: `${formatShort(elapsed)}+` }
  let left: number | null = null
  let finishAt: number | null = null
  if (eta.finish_at != null) {
    finishAt = eta.finish_at
    left = Math.max(0, eta.finish_at - nowMs / 1000)
  } else if (eta.seconds_left != null) {
    left = Math.max(0, eta.seconds_left - since)
    finishAt = nowMs / 1000 + left
  }
  if (left == null) return { ...base, kind: 'none', left: 0, finishAt: null, text: '', short: '' }
  if (left < 10) return { ...base, kind: 'any', left, finishAt, text: 'any moment', short: 'soon' }
  if (eta.confidence === 'low') {
    const lo = Math.max(1, Math.round((left * 0.5) / 60))
    const hi = Math.max(lo + 1, Math.ceil((left * 2) / 60))
    const range = left < 45 ? `roughly ${Math.round(left * 0.5)}–${Math.round(left * 2)} s` : `roughly ${lo}–${hi} min`
    return { ...base, kind: 'range', left, finishAt, text: range, short: formatShort(left) }
  }
  return { ...base, kind: 'left', left, finishAt, text: `${formatLong(left)} left`, short: formatShort(left) }
}

