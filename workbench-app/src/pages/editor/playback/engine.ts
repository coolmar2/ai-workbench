import { useSyncExternalStore } from 'react'
import type { Vendor } from '../../../data/types'
import { dirKey, fileCache, invalidateFile, logOutput } from '../api'
import { getEditorState, openFile as storeOpenFile } from '../store'
import { toast } from '../../../components/ui'
import { toStatus } from '../../../components/ui/status'
import { getModel, patchModel, runAnimation, type AnimChange, type Hold } from './animate'

/**
 * Live edit playback engine: polls GET /api/mc/edits, keeps the activity list, and plays each `pre` edit back in
 * Monaco (animate.ts) before `post` makes the disk the truth again. Module state, no React inside; hooks at the bottom.
 */

export interface EditEvent {
  seq: number
  ts: number
  session_id: string
  agent_id: string | null
  agent_type: string | null
  phase: 'pre' | 'post'
  tool: string
  tool_use_id: string
  file_path: string
  cwd?: string
  changes?: { old: string; new: string; replace_all?: boolean }[]
  content?: string
  truncated?: boolean
  /** Dev simulation: never reads or writes the disk. 'new' pretends the file does not exist yet. */
  sim?: boolean | 'new'
}

export interface ActivityItem {
  id: string
  ts: number
  agent: string
  vendor: Vendor
  tool: string
  /** Workspace root and path inside it; null when the file is outside every open workspace. */
  root: string | null
  rel: string | null
  file: string
  plus: number
  minus: number
  line: number | null
  phase: 'pending' | 'applied' | 'no-result' | 'not-applied'
  /** pending and the session is waiting for the user's permission */
  awaiting?: boolean
}

export interface PlaybackCtx {
  /** Roots of the open workspace tabs. */
  roots: () => string[]
  activeRoot: () => string | null
  vendorOf: (ev: EditEvent) => Vendor
  /** Current status and event_count of a session from /api/mc/state; null when unknown. */
  session?: (id: string) => { status: string; events: number } | null
}

/* ---------- snapshot store ---------- */

interface Snap {
  items: readonly ActivityItem[]
  follow: boolean
  badges: Readonly<Record<string, number>>
  /** key (root\npath lower-case) -> vendor of the agent whose edit is animating there */
  animating: ReadonlyMap<string, Vendor>
  /** key (root\npath) of files that do not exist on disk yet */
  fresh: ReadonlySet<string>
}

const FOLLOW_KEY = 'wb.editor.follow'
function loadFollow() {
  try {
    return localStorage.getItem(FOLLOW_KEY) !== '0'
  } catch {
    return true
  }
}

let items: ActivityItem[] = []
let badges: Record<string, number> = {}
const animating = new Map<string, Vendor>()
const fresh = new Set<string>()
const managed = new Set<string>()
let follow = loadFollow()
let snap: Snap = { items, follow, badges, animating: new Map(), fresh: new Set() }
const subs = new Set<() => void>()

function emit() {
  snap = { items: [...items], follow, badges, animating: new Map(animating), fresh: new Set(fresh) }
  subs.forEach((f) => f())
}

export function setFollow(on: boolean) {
  follow = on
  try {
    localStorage.setItem(FOLLOW_KEY, on ? '1' : '0')
  } catch {
    /* private mode */
  }
  emit()
}

export function clearBadge(root: string) {
  if (badges[root]) {
    badges = { ...badges }
    delete badges[root]
    emit()
  }
}

/** True once playback has taken over the text of this file (the editor must not reset it from the file cache). */
export const isManaged = (root: string, path: string) => managed.has(dirKey(root, path))

/* ---------- paths ---------- */

const slash = (p: string) => p.replace(/\\/g, '/')
const lc = (p: string) => slash(p).replace(/\/+$/, '').toLowerCase()

export function matchRoot(filePath: string, roots: string[]): { root: string; rel: string } | null {
  const fp = slash(filePath)
  const fl = fp.toLowerCase()
  let best: { root: string; rel: string; len: number } | null = null
  for (const r of roots) {
    const rl = lc(r)
    if (fl.startsWith(rl + '/') && (!best || rl.length > best.len)) best = { root: r, rel: fp.slice(rl.length + 1), len: rl.length }
  }
  if (!best) return null
  // Reuse the spelling of an already open tab (Windows paths are case-insensitive).
  const open = getEditorState().ws[best.root]?.openTabs.find((t) => t.path.toLowerCase() === best!.rel.toLowerCase())
  return { root: best.root, rel: open ? open.path : best.rel }
}

const fileKey = (root: string, rel: string) => `${root}\n${rel.toLowerCase()}`

/* ---------- disk ---------- */

interface Disk {
  text: string
  size: number
  mtime: number
  encoding: string
}

async function readDisk(root: string, rel: string): Promise<Disk | 'missing' | null> {
  try {
    const r = await fetch(`/api/mc/fs/read?root=${encodeURIComponent(root)}&path=${encodeURIComponent(rel)}`, { headers: { Accept: 'application/json' } })
    if (r.status === 404) return 'missing'
    if (!r.ok) return null
    const j = (await r.json()) as { text?: string; size?: number; mtime?: number; encoding?: string }
    return { text: j.text ?? '', size: j.size ?? 0, mtime: j.mtime ?? 0, encoding: j.encoding ?? 'utf-8' }
  } catch {
    return null
  }
}

/** The text of the model goes into the file cache so a tab switch cannot bring back an older version. */
function syncCache(root: string, rel: string) {
  const model = getModel(root, rel)
  const k = dirKey(root, rel)
  const cur = fileCache.get(k)
  if (model && !model.isDisposed() && cur?.state === 'ready') fileCache.set(k, { ...cur, text: model.getValue() })
}

/** Disk is the truth: after `post`, replace the model text where it differs (no animation, cursor and scroll stay). */
async function reconcile(root: string, rel: string) {
  const k = dirKey(root, rel)
  const d = await readDisk(root, rel)
  if (d === null || d === 'missing') return
  fresh.delete(k)
  const model = getModel(root, rel)
  const cur = fileCache.get(k)
  if (model && !model.isDisposed()) {
    managed.add(k)
    if (model.getValue().replace(/\r\n/g, '\n') !== d.text.replace(/\r\n/g, '\n')) patchModel(model, d.text)
    fileCache.set(k, { state: 'ready', text: model.getValue(), size: d.size, mtime: d.mtime, encoding: d.encoding })
  } else if (cur?.state === 'ready') {
    fileCache.set(k, { state: 'ready', text: d.text, size: d.size, mtime: d.mtime, encoding: d.encoding })
  } else if (getEditorState().ws[root]?.active !== rel) {
    invalidateFile(root, rel)
  }
  emit()
}

/* ---------- per-file queues ---------- */

interface FileQ {
  tasks: (() => Promise<void>)[]
  running: boolean
  /** tool_use_ids whose pre was seen and whose post is still to come */
  open: Set<string>
}
const queues = new Map<string, FileQ>()
const ctl = { skip: false }

function queueOf(key: string): FileQ {
  let q = queues.get(key)
  if (!q) queues.set(key, (q = { tasks: [], running: false, open: new Set() }))
  return q
}

function enqueue(key: string, fn: () => Promise<void>): Promise<void> {
  const q = queueOf(key)
  return new Promise<void>((resolve) => {
    q.tasks.push(async () => {
      try {
        await fn()
      } catch (e) {
        logOutput(`[warn] edit playback: ${(e as Error).message}`)
      }
      resolve()
    })
    void pump(q)
  })
}

async function pump(q: FileQ) {
  if (q.running) return
  q.running = true
  for (let t = q.tasks.shift(); t; t = q.tasks.shift()) await t()
  q.running = false
}

/* ---------- ingest ---------- */

const PENDING_TIMEOUT_MS = 90_000
const STALE_MS = 20_000
const MAX_ITEMS = 200
const lines = (s: string | undefined) => (s ? s.split('\n').length : 0)

let ctx: PlaybackCtx | null = null
const seen = new Set<string>()

function put(it: ActivityItem) {
  const i = items.findIndex((x) => x.id === it.id)
  if (i >= 0) items[i] = it
  else items = [...items, it].slice(-MAX_ITEMS)
}
function patchItem(id: string, p: Partial<ActivityItem>) {
  const i = items.findIndex((x) => x.id === id)
  if (i >= 0) {
    items = items.slice()
    items[i] = { ...items[i], ...p }
  }
}

function setAnimating(key: string, vendor: Vendor | null) {
  if (vendor) animating.set(key, vendor)
  else animating.delete(key)
  emit()
}

/**
 * Handle one edit event. Resolves when its animation task (pre) or reconcile (post) has finished;
 * the dev simulator uses that to send the matching post.
 */
export function ingest(ev: EditEvent): Promise<void> {
  if (!ctx || !ev.file_path || !ev.tool_use_id) return Promise.resolve()
  const id = ev.tool_use_id
  const m = matchRoot(ev.file_path, ctx.roots())
  if (ev.phase === 'post') return onPost(ev, m)
  if (seen.has(id)) return Promise.resolve()
  seen.add(id)
  if (seen.size > 2000) seen.clear()

  const vendor = ctx.vendorOf(ev)
  const agent = ev.agent_type || (ev.agent_id ? 'Agent' : 'Lead')
  const changes = ev.changes ?? []
  const item: ActivityItem = {
    id,
    ts: ev.ts * 1000,
    agent,
    vendor,
    tool: ev.tool,
    root: m?.root ?? null,
    rel: m?.rel ?? null,
    file: m ? m.rel : slash(ev.file_path),
    plus: ev.tool === 'Write' ? lines(ev.content) : changes.reduce((n, c) => n + lines(c.new), 0),
    minus: changes.reduce((n, c) => n + lines(c.old), 0),
    line: null,
    phase: 'pending',
  }
  put(item)
  logOutput(`[agent] ${agent} ${ev.tool} ${item.file}`)
  emit()
  if (!m) return Promise.resolve()

  const { root, rel } = m
  const key = fileKey(root, rel)
  const q = queueOf(key)
  q.open.add(id)
  setTimeout(() => {
    if (q.open.has(id)) dropPending(id, 'no-result', false)
  }, PENDING_TIMEOUT_MS)
  pend.set(id, { id, sid: ev.session_id, t0: Date.now(), events0: ctx.session?.(ev.session_id)?.events ?? null, root, rel, key, sim: !!ev.sim, before: null, hold: null, posted: false, label: '' })

  if (root !== ctx.activeRoot()) {
    badges = { ...badges, [root]: (badges[root] ?? 0) + 1 }
    emit()
  }

  const stale = Date.now() - ev.ts * 1000 > STALE_MS && !ev.sim
  const animatable = (ev.tool === 'Edit' || ev.tool === 'MultiEdit' ? changes.length > 0 : ev.tool === 'Write') && !ev.truncated && !stale
  if (!animatable) return Promise.resolve()

  const hadModel = !!getModel(root, rel)
  // A Write to a file that is not there yet: show an empty file (tab says "(new)") to type into.
  const prep = (async () => {
    if (!follow && !hadModel) return
    if (ev.tool === 'Write' && !hadModel && !root.startsWith('sample:')) {
      const k = dirKey(root, rel)
      const d = ev.sim ? (ev.sim === 'new' ? 'missing' : null) : await readDisk(root, rel)
      if (d === 'missing') {
        fresh.add(k)
        fileCache.set(k, { state: 'ready', text: '', size: 0, mtime: 0, encoding: 'utf-8' })
      }
    }
    if (follow) storeOpenFile(root, rel, { preview: true, activate: root === ctx?.activeRoot() })
  })()

  return enqueue(key, async () => {
    await prep
    const k = dirKey(root, rel)
    if (!getModel(root, rel) && !follow) return
    managed.add(k)
    setAnimating(key, vendor)
    const pr = pend.get(id)
    if (pr) pr.before = getModel(root, rel)?.getValue() ?? null
    try {
      const res = await runAnimation({
        root,
        rel,
        vendor,
        label: agent,
        tool: ev.tool === 'Write' ? 'write' : 'edit',
        changes: changes.map<AnimChange>((c) => ({ old: c.old, new: c.new, replaceAll: c.replace_all })),
        content: ev.content,
        ctl,
        hold: true,
      })
      if (res.hold) {
        if (pr && pend.has(id) && !pr.posted) {
          pr.hold = res.hold
          pr.label = ''
          applyLabel(pr)
        } else if (pr?.posted) res.hold.settle()
        else res.hold.discard()
      }
      if (res.animated) {
        patchItem(id, { line: res.firstLine ?? null, plus: res.plus || item.plus, minus: ev.tool === 'Write' ? res.minus : item.minus })
        syncCache(root, rel)
      } else managed.delete(k)
    } finally {
      setAnimating(key, null)
    }
  })
}

function onPost(ev: EditEvent, m: { root: string; rel: string } | null): Promise<void> {
  const id = ev.tool_use_id
  if (!items.some((x) => x.id === id)) {
    put({ id, ts: ev.ts * 1000, agent: ev.agent_type || (ev.agent_id ? 'Agent' : 'Lead'), vendor: ctx?.vendorOf(ev) ?? 'claude', tool: ev.tool, root: m?.root ?? null, rel: m?.rel ?? null, file: m ? m.rel : slash(ev.file_path), plus: 0, minus: 0, line: null, phase: 'applied' })
    seen.add(id)
  }
  patchItem(id, { phase: 'applied', awaiting: false })
  emit()
  const pr = pend.get(id)
  if (pr) {
    pr.posted = true
    pr.hold?.settle()
    pend.delete(id)
  }
  if (!m) return Promise.resolve()
  const key = fileKey(m.root, m.rel)
  const q = queueOf(key)
  q.open.delete(id)
  if (ev.sim) {
    fresh.delete(dirKey(m.root, m.rel))
    emit()
    return Promise.resolve()
  }
  return enqueue(key, async () => {
    // Another edit of the same file is still to be applied: its own post reconciles.
    if (q.open.size === 0) await reconcile(m.root, m.rel)
  })
}

/* ---------- pending (pre seen, post not yet) ---------- */

interface Pend {
  id: string
  sid: string
  t0: number
  events0: number | null
  root: string
  rel: string
  key: string
  sim: boolean
  /** model text before the animation (used to revert simulated edits, which have no disk) */
  before: string | null
  hold: Hold | null
  posted: boolean
  label: string
}
const pend = new Map<string, Pend>()
const GRACE_MS = 4000
const MOVED_ON_EVENTS = 3

/** Dev simulation: mocked session status/event count, overrides /api/mc/state. */
const simSessions = new Map<string, { status: string; events: number }>()
export function setSimSession(id: string, v: { status: string; events: number } | null) {
  if (v) simSessions.set(id, v)
  else simSessions.delete(id)
}
const sessionInfo = (id: string) => simSessions.get(id) ?? ctx?.session?.(id) ?? null

function applyLabel(p: Pend) {
  const info = sessionInfo(p.sid)
  const waiting = !!info && toStatus(info.status) === 'attention'
  const text = waiting ? 'awaiting approval' : 'applying…'
  if (text !== p.label) {
    p.label = text
    p.hold?.setLabel(text)
  }
  const it = items.find((x) => x.id === p.id)
  if (it && it.phase === 'pending' && !!it.awaiting !== waiting) {
    patchItem(p.id, { awaiting: waiting })
    emit()
  }
}

/** The edit will not reach the disk (denied, or nothing came back): drop the marks and show the disk text again. */
function dropPending(id: string, phase: 'not-applied' | 'no-result', notify: boolean) {
  const p = pend.get(id)
  pend.delete(id)
  const it = items.find((x) => x.id === id)
  patchItem(id, { phase, awaiting: false })
  p?.hold?.discard()
  if (p) {
    const q = queueOf(p.key)
    q.open.delete(id)
    void enqueue(p.key, async () => {
      if (q.open.size) return
      if (p.sim) {
        const model = getModel(p.root, p.rel)
        if (model && !model.isDisposed() && p.before !== null) patchModel(model, p.before)
        fresh.delete(dirKey(p.root, p.rel))
        syncCache(p.root, p.rel)
        emit()
      } else await reconcile(p.root, p.rel)
    })
  }
  emit()
  if (notify && it) toast(`Edit to ${it.file.split('/').pop() ?? it.file} was not applied`)
}

function checkPending() {
  for (const p of [...pend.values()]) {
    applyLabel(p)
    if (Date.now() - p.t0 < GRACE_MS) continue
    const info = sessionInfo(p.sid)
    if (!info) continue
    const st = toStatus(info.status)
    const gone = st === 'idle' || st === 'ended' || st === 'offline'
    const moved = p.events0 !== null && info.events - p.events0 >= MOVED_ON_EVENTS
    if (gone || moved) dropPending(p.id, 'not-applied', true)
  }
}

/* ---------- poller ---------- */

const POLL_MS = 500
let gen = 0
let warned = false
/** Survives a quick remount (StrictMode) so the end of the feed is not searched twice. */
let kept: { cursor: number; at: number } | null = null

async function getEdits(since: number, limit: number): Promise<{ next: number; edits: EditEvent[] }> {
  const r = await fetch(`/api/mc/edits?since=${since}&limit=${limit}`, { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  const j = (await r.json()) as { next?: number; edits?: EditEvent[] }
  return { next: typeof j.next === 'number' ? j.next : since, edits: Array.isArray(j.edits) ? j.edits : [] }
}

/** The feed only reports `next` as the seq of what it returned, so find the end with a search over `since`. */
async function findEnd(): Promise<number> {
  const has = async (n: number) => (await getEdits(n, 1)).edits.length > 0
  if (!(await has(0))) return 0
  let lo = 0
  let hi = 1
  while (await has(hi)) {
    lo = hi
    hi *= 2
    if (hi > 1 << 26) return hi
  }
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (await has(mid)) lo = mid
    else hi = mid
  }
  return hi
}

async function loop(my: number) {
  let cursor: number | null = kept && Date.now() - kept.at < 3000 ? kept.cursor : null
  while (gen === my) {
    try {
      if (!document.hidden) {
        if (cursor === null) cursor = await findEnd()
        else {
          for (let page = 0; page < 5 && gen === my; page++) {
            const j = await getEdits(cursor, 200)
            cursor = Math.max(cursor, j.next)
            if (gen === my) for (const e of j.edits) void ingest(e)
            if (j.edits.length < 200) break
          }
        }
        warned = false
      }
    } catch (e) {
      if (!warned) logOutput(`[warn] /api/mc/edits unavailable (${(e as Error).message}); no live playback`)
      warned = true
    }
    if (cursor !== null) kept = { cursor, at: Date.now() }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}

/** Start polling and playback; returns the stop function. Starts from the current end of the feed, so old edits never replay. */
export function startPlayback(c: PlaybackCtx): () => void {
  ctx = c
  ctl.skip = false
  const my = ++gen
  void loop(my)
  const timer = setInterval(checkPending, 1000)
  return () => {
    clearInterval(timer)
    if (gen === my) gen++
    if (kept) kept.at = Date.now()
    // Running animations finish at once; a new mount re-arms them.
    ctl.skip = true
  }
}

export function setCtx(c: PlaybackCtx) {
  ctx = c
}

export function currentCtx() {
  return ctx
}

/* ---------- hooks ---------- */

function useSnap<T>(pick: (s: Snap) => T): T {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => pick(snap),
  )
}

export const useActivity = () => useSnap((s) => s.items)
export const useFollow = () => useSnap((s) => s.follow)
export const useBadges = () => useSnap((s) => s.badges)
export const useAnimating = () => useSnap((s) => s.animating)
export const useFresh = () => useSnap((s) => s.fresh)
