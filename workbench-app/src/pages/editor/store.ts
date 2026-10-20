import { useSyncExternalStore } from 'react'

/**
 * Editor page state: one entry per open workspace (open files, active file, explorer expansion, panel tab,
 * scroll positions) plus the window layout. Persisted to localStorage; every workspace is kept separately.
 */
export type PanelTab = 'problems' | 'output' | 'terminal' | 'agents' | 'edits'
export type SideView = 'explorer' | 'search' | 'scm' | 'agents'

export interface OpenTab {
  path: string
  /** Italic preview tab: replaced by the next single-click open. */
  preview: boolean
}

export interface WsState {
  openTabs: OpenTab[]
  active: string | null
  expanded: string[]
  panelTab: PanelTab
  scroll: Record<string, number>
}

export interface WsMeta {
  root: string
  name: string
}

export interface EditorState {
  tabs: WsMeta[]
  activeRoot: string | null
  ws: Record<string, WsState>
  sideView: SideView
  sideOpen: boolean
  sideW: number
  panelOpen: boolean
  panelH: number
  aiOpen: boolean
  aiW: number
  openEditorsOpen: boolean
  folderOpen: boolean
}

const KEY = 'wb.editor.v1'

const DEFAULTS: EditorState = {
  tabs: [],
  activeRoot: null,
  ws: {},
  sideView: 'explorer',
  sideOpen: true,
  sideW: 260,
  panelOpen: true,
  panelH: 240,
  aiOpen: true,
  aiW: 340,
  openEditorsOpen: true,
  folderOpen: true,
}

export const newWs = (): WsState => ({ openTabs: [], active: null, expanded: [], panelTab: 'agents', scroll: {} })

function load(): EditorState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    const j = JSON.parse(raw) as Partial<EditorState>
    const ws: Record<string, WsState> = {}
    for (const [k, v] of Object.entries(j.ws ?? {})) ws[k] = { ...newWs(), ...v }
    const tabs = (j.tabs ?? []).filter((t) => t && typeof t.root === 'string')
    return { ...DEFAULTS, ...j, tabs, ws }
  } catch {
    return DEFAULTS
  }
}

let state: EditorState = load()
const subs = new Set<() => void>()
let persistTimer: ReturnType<typeof setTimeout> | null = null

function persist() {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* private mode / quota */
    }
  }, 250)
}

function set(next: EditorState) {
  state = next
  persist()
  subs.forEach((f) => f())
}

export function getEditorState(): EditorState {
  return state
}

export function useEditorState(): EditorState {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => subs.delete(cb)
    },
    () => state,
  )
}

const lastSegment = (root: string) => root.split(/[\\/]/).filter(Boolean).pop() ?? root

function patchWs(root: string, fn: (w: WsState) => WsState) {
  const cur = state.ws[root] ?? newWs()
  set({ ...state, ws: { ...state.ws, [root]: fn(cur) } })
}

// ---------- window layout ----------

export function setUi(patch: Partial<Omit<EditorState, 'tabs' | 'ws' | 'activeRoot'>>) {
  set({ ...state, ...patch })
}

// ---------- workspaces ----------

export function openWorkspace(meta: { root: string; name?: string }, activate = true) {
  const exists = state.tabs.some((t) => t.root === meta.root)
  const tabs = exists ? state.tabs : [...state.tabs, { root: meta.root, name: meta.name ?? lastSegment(meta.root) }]
  set({
    ...state,
    tabs,
    activeRoot: activate || !state.activeRoot ? meta.root : state.activeRoot,
    ws: state.ws[meta.root] ? state.ws : { ...state.ws, [meta.root]: newWs() },
  })
}

export function activateWorkspace(root: string) {
  if (state.activeRoot !== root && state.tabs.some((t) => t.root === root)) set({ ...state, activeRoot: root })
}

export function closeWorkspace(root: string) {
  const i = state.tabs.findIndex((t) => t.root === root)
  if (i < 0) return
  const tabs = state.tabs.filter((t) => t.root !== root)
  const activeRoot = state.activeRoot === root ? (tabs[Math.min(i, tabs.length - 1)]?.root ?? null) : state.activeRoot
  // The per-workspace state stays in storage, so reopening the workspace restores its files.
  set({ ...state, tabs, activeRoot })
}

export function cycleWorkspace(dir: 1 | -1) {
  const n = state.tabs.length
  if (n < 2) return
  const i = Math.max(0, state.tabs.findIndex((t) => t.root === state.activeRoot))
  set({ ...state, activeRoot: state.tabs[(i + dir + n) % n].root })
}

// ---------- files ----------

/** `activate: false` opens the tab inside the workspace without switching to it (live edit playback). */
export function openFile(root: string, path: string, opts: { preview?: boolean; activate?: boolean } = {}) {
  if (!state.tabs.some((t) => t.root === root)) openWorkspace({ root })
  const preview = opts.preview ?? true
  patchWs(root, (w) => {
    const existing = w.openTabs.find((t) => t.path === path)
    if (existing) {
      return {
        ...w,
        active: path,
        openTabs: preview ? w.openTabs : w.openTabs.map((t) => (t.path === path ? { ...t, preview: false } : t)),
      }
    }
    const tab: OpenTab = { path, preview }
    const pi = preview ? w.openTabs.findIndex((t) => t.preview) : -1
    const openTabs = pi >= 0 ? w.openTabs.map((t, i) => (i === pi ? tab : t)) : [...w.openTabs, tab]
    return { ...w, active: path, openTabs }
  })
  if (state.activeRoot !== root && opts.activate !== false) activateWorkspace(root)
}

export function pinTab(root: string, path: string) {
  patchWs(root, (w) => ({ ...w, openTabs: w.openTabs.map((t) => (t.path === path ? { ...t, preview: false } : t)) }))
}

export function setActiveFile(root: string, path: string) {
  patchWs(root, (w) => ({ ...w, active: path }))
}

export function closeTab(root: string, path: string) {
  patchWs(root, (w) => {
    const i = w.openTabs.findIndex((t) => t.path === path)
    if (i < 0) return w
    const openTabs = w.openTabs.filter((t) => t.path !== path)
    const active = w.active === path ? (openTabs[Math.min(i, openTabs.length - 1)]?.path ?? null) : w.active
    return { ...w, openTabs, active }
  })
}

export function closeOtherTabs(root: string, keep: string) {
  patchWs(root, (w) => ({ ...w, openTabs: w.openTabs.filter((t) => t.path === keep), active: keep }))
}

export function closeAllTabs(root: string) {
  patchWs(root, (w) => ({ ...w, openTabs: [], active: null }))
}

// ---------- explorer ----------

export function toggleExpanded(root: string, path: string, force?: boolean) {
  patchWs(root, (w) => {
    const has = w.expanded.includes(path)
    const want = force ?? !has
    if (want === has) return w
    return { ...w, expanded: want ? [...w.expanded, path] : w.expanded.filter((p) => p !== path) }
  })
}

/** Expand every ancestor folder of `path` (reveal in explorer). */
export function revealPath(root: string, path: string) {
  const parts = path.split('/')
  const dirs: string[] = []
  for (let i = 1; i < parts.length; i++) dirs.push(parts.slice(0, i).join('/'))
  patchWs(root, (w) => {
    const add = dirs.filter((d) => !w.expanded.includes(d))
    return add.length ? { ...w, expanded: [...w.expanded, ...add] } : w
  })
}

export function collapseAll(root: string) {
  patchWs(root, (w) => ({ ...w, expanded: [] }))
}

export function setPanelTab(root: string, panelTab: PanelTab) {
  patchWs(root, (w) => ({ ...w, panelTab }))
}

/** Scroll positions change constantly: store them without notifying subscribers. */
export function saveScroll(root: string, path: string, top: number) {
  const w = state.ws[root]
  if (!w) return
  w.scroll[path] = Math.round(top)
  persist()
}
