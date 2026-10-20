import type { McEta, McSession, Vendor } from '../../data/types'
import { etaView, statusLabel, toStatus, type Status } from '../../components/ui'
import { leadModelOf, verdictOf, type Verdict } from '../../live/verdict'
import { agentName, isRunning, modelLabel, sessionTitle, sortSessions, vendorOfModel, workspaceName } from '../../live/mission'
import { parseFeedTime } from '../../components/ui/time'
import { SAMPLE_OTHER_WORKSPACES, SAMPLE_SESSIONS, WORKSPACE_NAME } from './data'

/** One session as the hub, the rail and the header need it. */
export interface HubSession {
  id: string
  title: string
  status: Status
  statusText: string
  lead: Vendor
  leadModel: string
  /** Vendor of every agent (lead first), for the little marks on the card. */
  agents: Vendor[]
  agentCount: number
  /** "Now: ..." text without the prefix; '' = not reported. */
  now: string
  /** 0..1 or null = not reported. */
  progress: number | null
  eta: McEta | null
  /** Epoch seconds. */
  finishAt: number | null
  startAt: number | null
  /** Epoch ms of the last event, null = not reported. */
  updatedAt: number | null
  /** Sample only: a known decision time (epoch seconds). */
  decisionAt: number | null
  sample: boolean
}

export interface Workspace {
  name: string
  path: string
  sessions: HubSession[]
  ended: HubSession[]
  running: number
  attention: number
  /** Sample workspace without sessions (only in the left list). */
  placeholder?: boolean
}

export type WsState = 'running' | 'idle' | 'attention'

export function wsState(w: Workspace): WsState {
  return w.attention > 0 ? 'attention' : w.running > 0 ? 'running' : 'idle'
}

export function isEnded(s: { status: Status }): boolean {
  return s.status === 'ended' || s.status === 'offline'
}

/** "10:52 PM" */
export function clock12(epochSec: number): string {
  return new Date(epochSec * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

/**
 * Progress from the feed: eta.progress, else step index/total or a todos list (both being added to the backend,
 * so every shape is optional and unknown shapes are ignored).
 */
function progressOf(s: McSession): number | null {
  if (s.eta?.progress != null) return clamp01(s.eta.progress)
  const x = s as unknown as { step?: unknown; todos?: unknown }
  if (Array.isArray(x.todos) && x.todos.length > 0) {
    const done = x.todos.filter((t) => {
      const st = (t as { status?: unknown } | null)?.status
      return st === 'completed' || st === 'done'
    }).length
    return clamp01(done / x.todos.length)
  }
  const st = x.step as { index?: unknown; i?: unknown; current?: unknown; total?: unknown; n?: unknown } | null | undefined
  if (st && typeof st === 'object') {
    const idx = [st.index, st.i, st.current].find((v) => typeof v === 'number') as number | undefined
    const tot = [st.total, st.n].find((v) => typeof v === 'number') as number | undefined
    if (idx != null && tot && tot > 0) return clamp01(idx / tot)
  }
  return null
}

export function toHub(s: McSession, now: number): HubSession {
  const status = toStatus(s.status, s.online)
  const leadModel = leadModelOf(s as McSession & { model?: string | null })
    const running = status === 'running'
  const eta = running ? (s.eta ?? null) : null
  const tool = s.current_tool
  const prompt = (s.last_prompt || '').trim()
  const first = (s.agents || []).find((a) => a.state === 'running')
  let nowText = prompt
  if (first && tool) nowText = `${agentName(first)} (${tool})`
  else if (tool) nowText = prompt ? `${prompt} (${tool})` : `running ${tool}`
  return {
    id: s.session_id,
    title: sessionTitle(s),
    status,
    statusText: statusLabel(status),
    lead: vendorOfModel(leadModel),
    leadModel: leadModel ? modelLabel(leadModel) : 'Model not reported',
    agents: (s.agents || []).map((a) => vendorOfModel(a.model)),
    agentCount: (s.agents || []).length,
    now: nowText,
    progress: running ? progressOf(s) : null,
    eta,
    finishAt: eta && !eta.overrun ? eta.finish_at : null,
    startAt: s.turn_started ?? null,
    updatedAt: parseFeedTime(s.last_event_t, now),
    decisionAt: null,
    sample: false,
  }
}

export function liveWorkspaces(sessions: McSession[], now: number): Workspace[] {
  const m = new Map<string, McSession[]>()
  sessions.forEach((s) => {
    const k = workspaceName(s.cwd || '') || 'Unknown folder'
    m.set(k, [...(m.get(k) || []), s])
  })
  const out: { ws: Workspace; newest: string }[] = []
  m.forEach((list, name) => {
    const sorted = sortSessions(list)
    const all = sorted.map((s) => toHub(s, now))
    out.push({
      ws: {
        name,
        path: sorted[0]?.cwd || '',
        sessions: all.filter((c) => !isEnded(c)),
        ended: all.filter(isEnded),
        running: sorted.filter(isRunning).length,
        attention: all.filter((c) => c.status === 'attention').length,
      },
      newest: list.reduce((a, s) => ((s.last_event_t || '') > a ? s.last_event_t || '' : a), ''),
    })
  })
  return out.sort((a, b) => b.newest.localeCompare(a.newest)).map((o) => o.ws)
}

export function sampleWorkspaces(isWork: boolean, now: number): Workspace[] {
  const key = isWork ? 'work' : 'personal'
  const sessions: HubSession[] = SAMPLE_SESSIONS.map((s) => {
    const finishAt = now / 1000 + s.doneInMin * 60
    const eta: McEta = {
      seconds_left: s.doneInMin * 60,
      finish_at: finishAt,
      elapsed: s.startedMinAgo * 60,
      progress: s.progress,
      confidence: 'high',
      basis: 'sample estimate',
      overrun: false,
      received: now,
    }
    return {
      id: s.id,
      title: s.title,
      status: 'running' as const,
      statusText: statusLabel('running'),
      lead: s.lead,
      leadModel: s.leadModel[key],
      agents: s.agents,
      agentCount: s.agents.length,
      now: s.now[key],
      progress: s.progress,
      eta,
      finishAt,
      startAt: now / 1000 - s.startedMinAgo * 60,
      updatedAt: now - s.agoMs,
      decisionAt: s.decisionInMin != null ? now / 1000 + s.decisionInMin * 60 : null,
      sample: true,
    }
  })
  const main: Workspace = { name: WORKSPACE_NAME, path: '', sessions, ended: [], running: sessions.length, attention: 0 }
  const others: Workspace[] = SAMPLE_OTHER_WORKSPACES.map((o) => ({
    name: o.name,
    path: '',
    sessions: [],
    ended: [],
    running: o.state === 'running' ? (o.running ?? 1) : 0,
    attention: o.state === 'attention' ? 1 : 0,
    placeholder: true,
  }))
  return [main, ...others]
}

export interface Summary {
  /** Latest finish among working sessions, epoch seconds. */
  allDone: number | null
  /** 'now' = someone needs you already; number = epoch seconds of the first known decision. */
  needs: 'now' | number | null
}

export function summarize(list: HubSession[]): Summary {
  let allDone: number | null = null
  let needs: Summary['needs'] = null
  list.forEach((s) => {
    if (s.status === 'running' && s.finishAt != null) allDone = allDone == null ? s.finishAt : Math.max(allDone, s.finishAt)
    if (s.status === 'attention') needs = 'now'
    else if (s.decisionAt != null && needs !== 'now') needs = needs == null ? s.decisionAt : Math.min(needs, s.decisionAt)
  })
  return { allDone, needs }
}

/** The shared "Should you stay?" rule applied to a hub session, so the hub and the session page agree. */
export function hubVerdict(s: HubSession, nowMs: number): Verdict {
  const v = etaView(s.eta, nowMs)
  return verdictOf({
    status: s.status,
    left: v && v.kind !== 'none' && v.kind !== 'overrun' ? v.left : null,
    overrun: v?.kind === 'overrun',
    decisionAt: s.decisionAt,
    finishAt: s.finishAt,
    nowSec: nowMs / 1000,
  })
}
