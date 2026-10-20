import { useEffect, useState } from 'react'
import type { McAgent, McEta, McSession, McState, Vendor } from '../data/types'
import { mockEtaState } from './mockEta'

/**
 * Read-only feed from wb_mc.py through the Vite proxy (/api/mc -> 127.0.0.1:47832).
 * One shared poller per page load, every 1 s, so several components can subscribe
 * without multiplying requests. Never POSTs.
 */
export interface MissionFeed {
  /** Last good payload, or null if the spike has never answered. */
  state: McState | null
  /** True while the last poll succeeded. */
  live: boolean
  /**
   * True when the last poll failed but an earlier good payload is still in `state`.
   * Keep showing `state` (with an "offline / stale" chip); only fall back to sample data when `state` is null.
   */
  stale: boolean
  /**
   * Wall-clock ms of the last successful poll that changed something (data changed, or liveness flipped).
   * It is NOT bumped by identical polls, so the feed object stays referentially stable.
   */
  lastOk: number | null
  /** False until the first poll has finished (success or failure): show a skeleton, not "offline". */
  checked: boolean
}

const URL = '/api/mc/state'
/** Dev only: `?mockEta=1` feeds a fixture covering high/medium/low/overrun/no-eta instead of the backend. */
const MOCK_ETA = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('mockEta')

function stamp(eta: McEta | null | undefined, at: number): McEta | null {
  return eta && typeof eta === 'object' ? { ...eta, received: at } : null
}
const INTERVAL = 1000
const TIMEOUT = 2500

let feed: MissionFeed = { state: null, live: false, stale: false, lastOk: null, checked: false }
let lastRaw = ''
const subs = new Set<(f: MissionFeed) => void>()
let timer: ReturnType<typeof setTimeout> | null = null
let inflight = false

function isState(x: unknown): x is McState {
  return !!x && typeof x === 'object' && Array.isArray((x as McState).sessions)
}

async function poll() {
  if (inflight) return
  inflight = true
  let changed = true
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    let raw: string
    if (MOCK_ETA) raw = JSON.stringify(mockEtaState(Date.now()))
    else {
      const r = await fetch(URL, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
      if (!r.ok) throw new Error(String(r.status))
      raw = await r.text()
    }
    const j: unknown = JSON.parse(raw)
    if (!isState(j)) throw new Error('bad payload')
    if (raw === lastRaw && feed.live && feed.checked) {
      changed = false // identical payload: keep the same feed object, no re-render
      return
    }
    lastRaw = raw
    const at = Date.now()
    j.sessions = j.sessions.map((s) => ({
      ...s,
      eta: stamp(s.eta, at),
      turn_started: s.turn_started ?? null,
      cwd: s.cwd ?? '',
      last_prompt: s.last_prompt ?? '',
      last_reply: s.last_reply ?? '',
      agents: Array.isArray(s.agents) ? s.agents.map((a) => ({ ...a, eta: stamp(a.eta, at) })) : [],
    }))
    feed = { state: j, live: true, stale: false, lastOk: Date.now(), checked: true }
  } catch {
    if (feed.checked && !feed.live) changed = false // still failing: nothing new to publish
    else feed = { ...feed, live: false, stale: feed.state !== null, checked: true }
    lastRaw = ''
  } finally {
    clearTimeout(t)
    inflight = false
    if (changed) subs.forEach((s) => s(feed))
    if (subs.size) timer = setTimeout(poll, INTERVAL)
    else timer = null
  }
}

export function useMissionFeed(): MissionFeed {
  const [f, setF] = useState<MissionFeed>(feed)
  useEffect(() => {
    subs.add(setF)
    if (!timer && !inflight) void poll()
    return () => {
      subs.delete(setF)
    }
  }, [])
  return f
}

// ---------- mapping helpers (pure) ----------

/** Guess the vendor from a model string ("opus", "claude-sonnet-5-5", "gpt-5-codex", "gemini-2.5-pro"). */
export function vendorOfModel(model: string | null | undefined): Vendor {
  const m = (model || '').toLowerCase()
  if (m.includes('codex') || m.includes('gpt') || /^o\d/.test(m)) return 'codex'
  if (m.includes('gemini')) return 'gemini'
  return 'claude'
}

/** "haiku" -> "Haiku", "claude-sonnet-5-5" -> "Sonnet 5.5", null -> "Inherited model". */
export function modelLabel(model: string | null | undefined): string {
  if (!model) return 'Inherited model'
  const m = model.toLowerCase().replace(/^claude-/, '')
  const fam = m.match(/^(opus|sonnet|haiku|fable)(?:-(\d+)(?:-(\d+))?)?/)
  if (fam) {
    const name = fam[1][0].toUpperCase() + fam[1].slice(1)
    return fam[2] ? `${name} ${fam[2]}${fam[3] ? '.' + fam[3] : ''}` : name
  }
  return model
}

/** Last path segment of the session's cwd, e.g. "workbench-spike". */
export function workspaceName(cwd: string): string {
  const parts = (cwd || '').split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] || cwd || ''
}

/** A human session name: the last prompt (trimmed) or "<workspace> session". Never "S1". */
export function sessionTitle(s: McSession): string {
  const p = (s.last_prompt || '').trim().replace(/\s+/g, ' ')
  if (p) return p.length > 48 ? p.slice(0, 47) + '…' : p
  return `${workspaceName(s.cwd) || 'Unknown folder'} session`
}

export function shortId(id: string): string {
  return id.slice(0, 8)
}

export function isRunning(s: { status: string }): boolean {
  return s.status === 'running' || s.status === 'agents running'
}

/** Running first, then idle, then by most recent event. */
export function sortSessions(list: McSession[]): McSession[] {
  const rank = (s: McSession) => (isRunning(s) ? 0 : s.online ? 1 : s.status === 'idle' ? 2 : 3)
  return [...list].sort((a, b) => rank(a) - rank(b) || (b.last_event_t || '').localeCompare(a.last_event_t || ''))
}

export interface AgentNode {
  agent: McAgent
  children: AgentNode[]
  depth: number
}

/** parent_agent_id gives the tree; agents whose parent is null or unknown hang off the lead. */
export function buildAgentTree(agents: McAgent[]): AgentNode[] {
  const byId = new Map<string, AgentNode>()
  agents.forEach((a) => byId.set(a.agent_id, { agent: a, children: [], depth: 0 }))
  const roots: AgentNode[] = []
  byId.forEach((n) => {
    const p = n.agent.parent_agent_id ? byId.get(n.agent.parent_agent_id) : undefined
    if (p && p !== n) p.children.push(n)
    else roots.push(n)
  })
  const setDepth = (n: AgentNode, d: number, seen: Set<string>) => {
    if (seen.has(n.agent.agent_id)) return
    seen.add(n.agent.agent_id)
    n.depth = d
    n.children.forEach((c) => setDepth(c, d + 1, seen))
  }
  const seen = new Set<string>()
  roots.forEach((r) => setDepth(r, 1, seen))
  return roots
}

/** Display name for an agent: description, else agent_type, else short id. */
export function agentName(a: McAgent): string {
  return (a.description || a.agent_type || shortId(a.agent_id)).trim()
}
