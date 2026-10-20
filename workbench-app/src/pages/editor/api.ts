import { useMemo, useSyncExternalStore } from 'react'
import type { McAgent, McSession, McState, Vendor } from '../../data/types'
import { useMissionFeed, vendorOfModel, isRunning } from '../../live/mission'
import { useNow } from '../../components/ui'
import { isSampleRoot, sampleList, sampleMarks, sampleRead, sampleWorkspaces } from './sampleFs'

/* ---------- tiny keyed cache with subscriptions ---------- */

export function createCache<T>() {
  const map = new Map<string, T>()
  const subs = new Set<() => void>()
  let version = 0
  const subscribe = (cb: () => void) => {
    subs.add(cb)
    return () => subs.delete(cb)
  }
  return {
    get: (k: string) => map.get(k),
    set(k: string, v: T) {
      map.set(k, v)
      version++
      subs.forEach((f) => f())
    },
    delete(k: string) {
      if (map.delete(k)) {
        version++
        subs.forEach((f) => f())
      }
    },
    keys: () => [...map.keys()],
    /** Re-render on any change of this cache. */
    useVersion: () => useSyncExternalStore(subscribe, () => version),
    /** Re-render when the value under `k` changes. */
    useValue: (k: string) => useSyncExternalStore(subscribe, () => map.get(k)),
  }
}

/* ---------- output log (the OUTPUT panel tab) ---------- */

const outLines: string[] = []
const outSubs = new Set<() => void>()
let outSnap: readonly string[] = []
export function logOutput(line: string) {
  const t = new Date().toTimeString().slice(0, 8)
  outLines.push(`${t} ${line}`)
  if (outLines.length > 300) outLines.shift()
  outSnap = [...outLines]
  outSubs.forEach((f) => f())
}
export function useOutputLog(): readonly string[] {
  return useSyncExternalStore(
    (cb) => {
      outSubs.add(cb)
      return () => outSubs.delete(cb)
    },
    () => outSnap,
  )
}

/* ---------- HTTP ---------- */

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function getJson<T>(url: string, timeoutMs = 6000): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    const text = await r.text()
    let body: unknown = null
    try {
      body = JSON.parse(text)
    } catch {
      /* not JSON */
    }
    if (!r.ok) {
      const msg = (body as { error?: string } | null)?.error
      throw new ApiError(r.status, msg ?? `${r.status} ${r.statusText}`)
    }
    if (body === null) throw new ApiError(502, 'Not a JSON answer (is the backend running?)')
    return body as T
  } finally {
    clearTimeout(t)
  }
}

const q = encodeURIComponent

/* ---------- workspaces ---------- */

export interface Workspace {
  root: string
  name: string
  last_ts?: number
  session_ids?: string[]
}

export interface WorkspacesFeed {
  workspaces: Workspace[]
  /** True when the backend did not answer and the sample workspaces are shown. */
  sample: boolean
  checked: boolean
}

const nameOf = (root: string) => root.split(/[\\/]/).filter(Boolean).pop() ?? root

const SAMPLE_FEED: WorkspacesFeed = {
  workspaces: sampleWorkspaces.map((w) => ({ root: w.root, name: w.name, last_ts: w.last_ts })),
  sample: true,
  checked: true,
}
let wsFeed: WorkspacesFeed = { workspaces: [], sample: false, checked: false }
const wsSubs = new Set<() => void>()
let wsTimer: ReturnType<typeof setTimeout> | null = null

async function pollWorkspaces() {
  try {
    const j = await getJson<{ workspaces?: Workspace[] }>('/api/mc/workspaces')
    if (!Array.isArray(j.workspaces)) throw new ApiError(502, 'bad payload')
    const list = j.workspaces.map((w) => ({ ...w, name: w.name || nameOf(w.root) }))
    if (wsFeed.sample || !wsFeed.checked) logOutput(`[info] workspaces: live (${list.length})`)
    wsFeed = { workspaces: list, sample: false, checked: true }
  } catch (e) {
    if (!wsFeed.checked || !wsFeed.sample) logOutput(`[warn] /api/mc/workspaces failed (${(e as Error).message}); showing sample data`)
    wsFeed = wsFeed.checked && !wsFeed.sample && wsFeed.workspaces.length ? { ...wsFeed } : SAMPLE_FEED
  }
  wsSubs.forEach((f) => f())
  wsTimer = wsSubs.size ? setTimeout(pollWorkspaces, 8000) : null
}

export function useWorkspaces(): WorkspacesFeed {
  const f = useSyncExternalStore(
    (cb) => {
      wsSubs.add(cb)
      if (!wsTimer) wsTimer = setTimeout(pollWorkspaces, 0)
      return () => {
        wsSubs.delete(cb)
        if (!wsSubs.size && wsTimer) {
          clearTimeout(wsTimer)
          wsTimer = null
        }
      }
    },
    () => wsFeed,
  )
  return f
}

/* ---------- directory + file access ---------- */

export interface DirEntry {
  name: string
  type: 'dir' | 'file'
  size?: number
  mtime?: number
}
export type DirState = { state: 'loading' } | { state: 'ready'; entries: DirEntry[] } | { state: 'error'; message: string }
export type FileState =
  | { state: 'loading' }
  | { state: 'ready'; text: string; size: number; mtime: number; encoding: string }
  | { state: 'error'; status: number; message: string }

export const dirs = createCache<DirState>()
export const fileCache = createCache<FileState>()
export const dirKey = (root: string, path: string) => `${root}\n${path}`

export async function loadDir(root: string, path: string, force = false) {
  const k = dirKey(root, path)
  const cur = dirs.get(k)
  if (!force && cur && cur.state !== 'error') return
  if (cur?.state === 'loading') return
  if (!cur || cur.state === 'error') dirs.set(k, { state: 'loading' })
  try {
    let entries: DirEntry[]
    if (isSampleRoot(root)) entries = sampleList(root, path)
    else {
      const j = await getJson<{ entries?: DirEntry[] }>(`/api/mc/fs/list?root=${q(root)}&path=${q(path)}`)
      entries = Array.isArray(j.entries) ? j.entries : []
    }
    dirs.set(k, { state: 'ready', entries })
  } catch (e) {
    logOutput(`[error] list ${path || '/'}: ${(e as Error).message}`)
    dirs.set(k, { state: 'error', message: (e as Error).message })
  }
}

export async function loadFile(root: string, path: string, force = false) {
  const k = dirKey(root, path)
  const cur = fileCache.get(k)
  if (!force && cur && cur.state !== 'error') return
  if (cur?.state === 'loading') return
  if (!cur || cur.state === 'error') fileCache.set(k, { state: 'loading' })
  try {
    if (isSampleRoot(root)) {
      const text = sampleRead(root, path)
      if (text === null) throw new ApiError(404, 'File not found')
      fileCache.set(k, { state: 'ready', text, size: text.length, mtime: Date.now() / 1000, encoding: 'utf-8' })
    } else {
      const j = await getJson<{ text?: string; size?: number; mtime?: number; encoding?: string }>(`/api/mc/fs/read?root=${q(root)}&path=${q(path)}`)
      fileCache.set(k, { state: 'ready', text: j.text ?? '', size: j.size ?? 0, mtime: j.mtime ?? 0, encoding: j.encoding ?? 'utf-8' })
    }
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 0
    logOutput(`[error] read ${path}: ${(e as Error).message}`)
    fileCache.set(k, { state: 'error', status, message: (e as Error).message })
  }
}

/** Drop a cached file so the next view reloads it (live edit playback uses this). */
export function invalidateFile(root: string, path: string) {
  fileCache.delete(dirKey(root, path))
}

/* ---------- agents of a workspace (from /api/mc/state) ---------- */

const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()

export function sessionInWorkspace(cwd: string, root: string): boolean {
  if (!cwd) return false
  const a = norm(cwd)
  const b = norm(root)
  return a === b || a.startsWith(b + '/')
}

export interface WsAgents {
  sessions: McSession[]
  /** Running agents across the workspace's sessions (the lead counts when its session runs). */
  running: number
  vendors: Vendor[]
}

export function wsAgents(state: McState | null, root: string): WsAgents {
  const sessions = state ? state.sessions.filter((s) => sessionInWorkspace(s.cwd, root)) : []
  let running = 0
  const vendors = new Set<Vendor>()
  for (const s of sessions) {
    if (isRunning(s)) {
      running++
      vendors.add('claude')
    }
    for (const a of s.agents) {
      if (a.state === 'running') {
        running++
        vendors.add(vendorOfModel(a.model))
      }
    }
  }
  return { sessions, running, vendors: [...vendors] }
}

export function useWsAgents(root: string | null): { agents: WsAgents; live: boolean } {
  const feed = useMissionFeed()
  const state = feed.state
  const agents = useMemo(() => (root && !isSampleRoot(root) ? wsAgents(state, root) : { sessions: [], running: 0, vendors: [] }), [state, root])
  return { agents, live: feed.live }
}

export function agentLabel(a: McAgent): string {
  return a.description?.trim() || a.agent_type || 'agent'
}

/* ---------- files agents touched recently (/api/mc/edits) ---------- */

interface EditRec {
  ts: number
  session_id: string
  agent_id: string | null
  file_path: string
}

let edits: EditRec[] = []
let editsNext = 0
let editsSnap: readonly EditRec[] = []
const editSubs = new Set<() => void>()
let editTimer: ReturnType<typeof setTimeout> | null = null
let editsOk = true

async function pollEdits() {
  try {
    for (let page = 0; page < 10; page++) {
      const j = await getJson<{ next?: number; edits?: (EditRec & { phase?: string })[] }>(`/api/mc/edits?since=${editsNext}&limit=200`)
      const list = j.edits ?? []
      if (typeof j.next === 'number') editsNext = Math.max(editsNext, j.next)
      if (!list.length) break
      edits = [...edits, ...list.filter((e) => e.file_path)].slice(-3000)
      editsSnap = edits
      editSubs.forEach((f) => f())
      if (list.length < 200) break
    }
    editsOk = true
  } catch (e) {
    if (editsOk) logOutput(`[warn] /api/mc/edits unavailable (${(e as Error).message}); no agent dots`)
    editsOk = false
  }
  editTimer = editSubs.size ? setTimeout(pollEdits, 3000) : null
}

function useEdits(): readonly EditRec[] {
  return useSyncExternalStore(
    (cb) => {
      editSubs.add(cb)
      if (!editTimer) editTimer = setTimeout(pollEdits, 0)
      return () => {
        editSubs.delete(cb)
        if (!editSubs.size && editTimer) {
          clearTimeout(editTimer)
          editTimer = null
        }
      }
    },
    () => editsSnap,
  )
}

const RECENT_SEC = 30 * 60

/** Marks keyed by lower-cased relative path (files and every parent folder): vendors that edited recently. */
export function useEditMarks(root: string | null): (path: string) => Vendor[] {
  const all = useEdits()
  const feed = useMissionFeed()
  const now = useNow(30_000)
  const state = feed.state
  return useMemo(() => {
    const out = new Map<string, Set<Vendor>>()
    const add = (rel: string, v: Vendor) => {
      const parts = rel.split('/')
      for (let i = 1; i <= parts.length; i++) {
        const k = parts.slice(0, i).join('/').toLowerCase()
        if (!out.has(k)) out.set(k, new Set())
        out.get(k)!.add(v)
      }
    }
    if (root && isSampleRoot(root)) {
      for (const [p, vs] of Object.entries(sampleMarks(root))) vs.forEach((v) => add(p, v))
    } else if (root) {
      const rootN = norm(root)
      const cutoff = now / 1000 - RECENT_SEC
      for (const e of all) {
        if (e.ts < cutoff) continue
        const fp = e.file_path.replace(/\\/g, '/')
        if (!fp.toLowerCase().startsWith(rootN + '/')) continue
        const s = state?.sessions.find((x) => x.session_id === e.session_id)
        const ag = e.agent_id ? s?.agents.find((a) => a.agent_id === e.agent_id) : null
        add(fp.slice(rootN.length + 1), ag ? vendorOfModel(ag.model) : 'claude')
      }
    }
    return (path: string) => [...(out.get(path.toLowerCase()) ?? [])]
  }, [all, root, state, now])
}
