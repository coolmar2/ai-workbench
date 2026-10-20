import { useEffect, useState } from 'react'

/**
 * Parse a feed timestamp. wb_mc.py sends local wall-clock "HH:MM:SS" (today); ISO strings also work.
 * A clock time later than now (+1 min slack) is taken as yesterday.
 */
export function parseFeedTime(t: string | null | undefined, now: number): number | null {
  if (!t) return null
  const hms = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t.trim())
  if (hms) {
    const d = new Date(now)
    d.setHours(Number(hms[1]), Number(hms[2]), Number(hms[3] ?? 0), 0)
    let ms = d.getTime()
    if (ms > now + 60_000) ms -= 86_400_000
    return ms
  }
  const ms = Date.parse(t)
  return Number.isNaN(ms) ? null : ms
}

/** "now", "45s", "12m", "3h", "2d". Compact, for list rows. */
export function relativeTime(t: string | number | null | undefined, now: number): string {
  const ms = typeof t === 'number' ? t : parseFeedTime(t, now)
  if (ms == null) return ''
  const s = Math.max(0, Math.round((now - ms) / 1000))
  if (s < 10) return 'now'
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

/** Current time in ms, re-rendering every `intervalMs` (default 15 s). */
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
