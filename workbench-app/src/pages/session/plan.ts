import { useEffect, useRef, useState } from 'react'
import { etaView } from '../../components/ui'
import type { McEta } from '../../data/types'
import type { PlanStep } from './data'

/** Fields the backend adds to sessions and agents (API_CONTRACT.md). Missing on older backends. */
export interface Todo {
  content: string
  status: 'pending' | 'in_progress' | 'completed' | string
  active_form?: string
}
export interface StepInfo {
  index: number
  total: number
  label: string
}
export interface Planned {
  todos?: Todo[] | null
  step?: StepInfo | null
  eta?: McEta | null
}

export const plannedOf = (x: unknown): Planned => (x && typeof x === 'object' ? (x as Planned) : {})

/** 0..100 from eta.progress, else completed/total of the todos, else null. */
export function pctOf(p: Planned): number | null {
  if (p.eta && p.eta.progress != null) return Math.round(p.eta.progress * 100)
  const t = p.todos
  if (t && t.length) return Math.round((t.filter((x) => x.status === 'completed').length / t.length) * 100)
  return null
}

/** "Step 4 of 6" + the current step label, from step, else todos. */
export function stepOf(p: Planned): { text: string; label: string } | null {
  if (p.step && p.step.total) return { text: `Step ${p.step.index} of ${p.step.total}`, label: p.step.label }
  const t = p.todos
  if (t && t.length) {
    const i = t.findIndex((x) => x.status === 'in_progress')
    const j = i >= 0 ? i : t.findIndex((x) => x.status !== 'completed')
    const at = j >= 0 ? j : t.length - 1
    return { text: `Step ${at + 1} of ${t.length}`, label: t[at].content }
  }
  return null
}

const about = (sec: number) => (sec < 60 ? `about ${Math.max(5, Math.round(sec / 5) * 5)} s` : `about ${Math.max(1, Math.round(sec / 60))} min`)

/** The agent's todos as a checklist; eta.seconds_left is spread evenly over the unfinished steps. */
export function planOf(p: Planned, now: number): PlanStep[] | null {
  const t = p.todos
  if (!t || !t.length) return null
  const ev = p.eta && !p.eta.overrun ? etaView(p.eta, now) : null
  const left = ev && ev.kind !== 'none' ? ev.left : null
  const remaining = t.filter((x) => x.status !== 'completed').length
  const per = left != null && remaining > 0 ? left / remaining : null
  return t.map((x): PlanStep => {
    if (x.status === 'completed') return { state: 'done', text: x.content, time: '' }
    if (x.status === 'in_progress') return { state: 'now', text: x.content, time: per != null ? `${about(per)} left` : '' }
    return { state: 'todo', text: x.content, time: per != null ? about(per) : '' }
  })
}

/** "10:52 PM" */
export function clock12(epochSec: number): string {
  return new Date(epochSec * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
/** "10:52" without the am/pm, for the history line */
export function clockShort(epochSec: number): string {
  return clock12(epochSec).replace(/\s?[AP]M$/i, '')
}
export function inText(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  if (s < 10) return 'any moment'
  if (s < 60) return `in ${s} s`
  const m = Math.round(s / 60)
  if (m < 60) return `in ${m} min`
  return `in ${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`
}
export function range(finishAt: number, leftSec: number, conf: McEta['confidence']): string {
  const f = conf === 'high' ? 0.1 : conf === 'medium' ? 0.25 : 0.5
  const lo = clock12(finishAt - leftSec * f)
  const hi = clock12(finishAt + leftSec * f)
  const sameHalf = lo.slice(-2) === hi.slice(-2)
  return `Likely between ${sameHalf ? lo.slice(0, -3) : lo} and ${hi}`
}

/** Keeps the last 4 distinct finish times seen while this page is open (minute resolution). */
export function useFinishHistory(finishAt: number | null): string[] {
  const [hist, setHist] = useState<string[]>([])
  const last = useRef<string | null>(null)
  useEffect(() => {
    if (finishAt == null) return
    const label = clockShort(finishAt)
    if (label === last.current) return
    last.current = label
    setHist((h) => [...h, label].slice(-4))
  }, [finishAt])
  return hist
}

// ---------- recent tool calls (loopback-only /api/mc/activity) ----------

export interface ActivityItem {
  ts: number
  tool: string
  tool_use_id?: string
  state: 'running' | 'done' | 'error'
  summary: string
  output: string | null
}
export interface Activity {
  /** null = the endpoint is not available (404 / offline), [] = nothing yet. */
  items: ActivityItem[] | null
}

const FAST_MS = 2000
const SLOW_MS = 10000

interface Poller {
  items: ActivityItem[] | null
  raw: string
  subs: Set<(items: ActivityItem[] | null) => void>
  timer?: ReturnType<typeof setTimeout>
  delay: number
  stopped: boolean
  run: () => void
  dispose: () => void
}
/** At most one poller per (session, agent), shared by every hook instance that asks for it. */
const pollers = new Map<string, Poller>()

async function fetchActivity(session: string, agent: string): Promise<{ raw: string; items: ActivityItem[] | null }> {
  try {
    const r = await fetch(`/api/mc/activity?session=${encodeURIComponent(session)}&agent=${encodeURIComponent(agent)}&limit=40`, { headers: { Accept: 'application/json' } })
    if (!r.ok) return { raw: `status:${r.status}`, items: null }
    const raw = await r.text()
    const j = JSON.parse(raw) as { items?: ActivityItem[] }
    return { raw, items: Array.isArray(j.items) ? j.items : null }
  } catch {
    return { raw: 'error', items: null }
  }
}

function startPoller(key: string, session: string, agent: string): Poller {
  const pl: Poller = { items: null, raw: '', subs: new Set(), delay: FAST_MS, stopped: false, run: () => undefined, dispose: () => undefined }
  const schedule = () => {
    if (pl.stopped) return
    pl.timer = setTimeout(pl.run, pl.delay)
  }
  pl.run = async () => {
    if (pl.stopped) return
    if (typeof document !== 'undefined' && document.hidden) return // resumed by visibilitychange
    const res = await fetchActivity(session, agent)
    if (pl.stopped) return
    if (res.raw === pl.raw) pl.delay = SLOW_MS
    else {
      pl.delay = FAST_MS
      pl.raw = res.raw
      pl.items = res.items
      pl.subs.forEach((f) => f(res.items))
    }
    schedule()
  }
  const onVis = () => {
    if (document.hidden || pl.stopped) return
    if (pl.timer) clearTimeout(pl.timer)
    pl.delay = FAST_MS
    void pl.run()
  }
  document.addEventListener('visibilitychange', onVis)
  pl.dispose = () => {
    pl.stopped = true
    if (pl.timer) clearTimeout(pl.timer)
    document.removeEventListener('visibilitychange', onVis)
    pollers.delete(key)
  }
  void pl.run()
  return pl
}

/**
 * Polls the activity feed (2 s, backing off to 10 s while the response is unchanged, paused while the tab is hidden).
 * `agent` null disables it. `active` false (session ended/offline) fetches once and stops. Never throws; 404 gives items = null.
 */
export function useActivity(session: string | null, agent: string | null, active = true): Activity {
  const [res, setRes] = useState<{ key: string; items: ActivityItem[] | null }>({ key: '', items: null })
  const key = session && agent ? `${session}|${agent}` : ''
  useEffect(() => {
    if (!key) return
    let dead = false
    const push = (items: ActivityItem[] | null) => {
      if (!dead) setRes((p) => (p.key === key && JSON.stringify(p.items) === JSON.stringify(items) ? p : { key, items }))
    }
    if (!active) {
      void fetchActivity(session as string, agent as string).then((r) => push(r.items))
      return () => {
        dead = true
      }
    }
    const pl = pollers.get(key) ?? startPoller(key, session as string, agent as string)
    pollers.set(key, pl)
    pl.subs.add(push)
    if (pl.raw) push(pl.items)
    return () => {
      dead = true
      pl.subs.delete(push)
      if (!pl.subs.size) pl.dispose()
    }
  }, [key, session, agent, active])
  return { items: key && res.key === key ? res.items : null }
}
