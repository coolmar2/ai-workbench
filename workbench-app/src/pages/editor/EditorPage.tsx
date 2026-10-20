import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageActions, ShellCrumbs } from '../../components/shell/PageActions'
import { useShell } from '../../components/shell/context'
import { Badge, Button, EmptyState, useElementWidth } from '../../components/ui'
import { useMissionFeed } from '../../live/mission'
import { ActivityBar } from './ActivityBar'
import { AiPanel } from './AiPanel'
import { dirKey, dirs, useWorkspaces, wsAgents } from './api'
import { BottomPanel } from './BottomPanel'
import { Codicon, IconBtn, Sash } from './chrome'
import { EditorCommands } from './EditorCommands'
import { EditorApiContext, getEditorOf, openFileIn, type EditorApi } from './editorApi'
import { EditorGroup } from './EditorGroup'
import type { CursorInfo } from './fileTypes'
import { monaco } from './monacoSetup'
import { useBadges } from './playback/engine'
import { PlaybackHost } from './playback/PlaybackHost'
import { problemCount } from './problems'
import { sampleWorkspaces } from './sampleFs'
import { SideBar } from './SideBar'
import { StatusBar } from './StatusBar'
import {
  activateWorkspace,
  closeTab,
  closeWorkspace,
  cycleWorkspace,
  getEditorState,
  newWs,
  openWorkspace,
  revealPath,
  setPanelTab,
  setUi,
  useEditorState,
  type SideView,
} from './store'
import { AddWorkspaceDialog, WorkspaceTabs, type WsTabView } from './WorkspaceTabs'
import './vscode.css'

type Mode = 'wide' | 'mid' | 'narrow'

// Survives StrictMode's simulated remount (see the shell effect below).
let restoreTimer: ReturnType<typeof setTimeout> | null = null
let collapsedByUs = false

/** Files of already-loaded folders, for "Go to File". */
function loadedFiles(root: string): string[] {
  const out: string[] = []
  for (const k of dirs.keys()) {
    const [r, p] = k.split('\n')
    if (r !== root) continue
    const d = dirs.get(dirKey(r, p ?? ''))
    if (d?.state !== 'ready') continue
    for (const e of d.entries) if (e.type === 'file') out.push(p ? `${p}/${e.name}` : e.name)
  }
  return out.slice(0, 400)
}

export default function EditorPage() {
  const st = useEditorState()
  const { workspaces, sample, checked } = useWorkspaces()
  const feed = useMissionFeed()
  const badges = useBadges()
  const shell = useShell()
  const rootRef = useRef<HTMLDivElement>(null)
  const width = useElementWidth(rootRef)
  const mode: Mode = width === 0 || width >= 900 ? 'wide' : width >= 700 ? 'mid' : 'narrow'

  // The editor gets the room a VS Code window would: collapse the app sidebar to its rail while this page is open.
  const shellRef = useRef(shell)
  useEffect(() => {
    shellRef.current = shell
  })
  useEffect(() => {
    if (restoreTimer) {
      // StrictMode's simulated unmount/remount: keep what we did.
      clearTimeout(restoreTimer)
      restoreTimer = null
    } else if (!shellRef.current.collapsed && !shellRef.current.drawer) {
      shellRef.current.toggleSidebar()
      collapsedByUs = true
    }
    return () => {
      restoreTimer = setTimeout(() => {
        restoreTimer = null
        if (collapsedByUs) {
          collapsedByUs = false
          if (shellRef.current.collapsed) shellRef.current.toggleSidebar()
        }
      }, 60)
    }
  }, [])

  const [addOpen, setAddOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [infos, setInfos] = useState<Record<string, { info: CursorInfo | null; enc: string }>>({})
  const [visited, setVisited] = useState<string[]>([])

  const tabs = st.tabs
  const activeMeta = tabs.find((t) => t.root === st.activeRoot) ?? null
  const root = activeMeta?.root ?? null
  const w = (root && st.ws[root]) || newWs()
  const activeKey = `${root}|${w.active}`

  // Drawers for the non-wide layouts close when a file is picked (their key is the file open at that time).
  const [drawer, setDrawer] = useState<{ side: 'left' | 'right' | null; at: string }>({ side: null, at: '' })
  const drawerSide = mode !== 'wide' && drawer.at === activeKey ? drawer.side : null

  if (root && !visited.includes(root)) setVisited([...visited, root])

  useEffect(() => {
    if (!checked) return
    if (!sample) for (const t of getEditorState().tabs) if (t.root.startsWith('sample:')) closeWorkspace(t.root)
    if (getEditorState().tabs.length === 0 && workspaces.length > 0) openWorkspace(workspaces[0])
  }, [checked, sample, workspaces])

  const onInfo = useCallback((r: string, info: CursorInfo | null, enc: string) => {
    setInfos((prev) => {
      const p = prev[r]
      const same = p && p.enc === enc && JSON.stringify(p.info) === JSON.stringify(info)
      return same ? prev : { ...prev, [r]: { info, enc } }
    })
  }, [])

  const tabViews: WsTabView[] = useMemo(
    () =>
      tabs.map((t) => {
        if (t.root.startsWith('sample:')) {
          const s = sampleWorkspaces.find((x) => x.root === t.root)
          return { root: t.root, name: t.name, vendors: s?.dots ?? [], running: s?.dots.length ?? 0, badge: badges[t.root] }
        }
        const a = wsAgents(feed.state, t.root)
        return { root: t.root, name: t.name, vendors: a.vendors, running: a.running, badge: badges[t.root] }
      }),
    [tabs, feed.state, badges],
  )
  const current = tabViews.find((t) => t.root === root)
  const sampleRoot = !!root?.startsWith('sample:')
  const agentsRunning = current?.running ?? 0
  const problems = problemCount(sampleRoot, root ?? '')

  const api = useMemo<EditorApi>(() => ({ root, getEditor: (r) => getEditorOf(r ?? root ?? ''), openFile: openFileIn, monaco }), [root])

  const togglePanel = () => setUi({ panelOpen: !getEditorState().panelOpen })
  const toggleSide = () => {
    if (mode === 'wide') setUi({ sideOpen: !getEditorState().sideOpen })
    else setDrawer((d) => ({ side: d.side === 'left' && d.at === activeKey ? null : 'left', at: activeKey }))
  }
  const toggleChat = () => {
    if (mode === 'wide') setUi({ aiOpen: !getEditorState().aiOpen })
    else setDrawer((d) => ({ side: d.side === 'right' && d.at === activeKey ? null : 'right', at: activeKey }))
  }
  const pickView = (v: SideView) => {
    const s = getEditorState()
    if (mode === 'wide') {
      if (s.sideOpen && s.sideView === v) setUi({ sideOpen: false })
      else setUi({ sideView: v, sideOpen: true })
    } else {
      setUi({ sideView: v })
      setDrawer((d) => ({ side: d.side === 'left' && s.sideView === v && d.at === activeKey ? null : 'left', at: activeKey }))
    }
  }

  // The key handler is installed once and calls the latest versions of these.
  const fns = useRef({ togglePanel, toggleSide, toggleChat, pickView })
  useEffect(() => {
    fns.current = { togglePanel, toggleSide, toggleChat, pickView }
  })

  // Keyboard shortcuts (capture phase so Monaco does not swallow them).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      const run = (fn: () => void) => {
        e.preventDefault()
        e.stopPropagation()
        fn()
      }
      if (ctrl && e.key === 'Tab') return run(() => cycleWorkspace(e.shiftKey ? -1 : 1))
      if (ctrl && !e.shiftKey && (e.key === 'PageDown' || e.key === 'PageUp')) return run(() => cycleWorkspace(e.key === 'PageDown' ? 1 : -1))
      if (ctrl && e.shiftKey && k === 'p') return run(() => setPaletteOpen(true))
      if (e.key === 'F1') return run(() => setPaletteOpen(true))
      if (ctrl && !e.shiftKey && !e.altKey && k === 'p') return run(() => setPaletteOpen(true))
      if (ctrl && !e.shiftKey && !e.altKey && k === 'j') return run(() => fns.current.togglePanel())
      if (ctrl && e.altKey && k === 'b') return run(() => fns.current.toggleChat())
      if (ctrl && !e.shiftKey && !e.altKey && k === 'b') return run(() => fns.current.toggleSide())
      if (ctrl && e.shiftKey && k === 'o') return run(() => setAddOpen(true))
      if (ctrl && e.shiftKey && k === 'e') return run(() => fns.current.pickView('explorer'))
      if (ctrl && e.shiftKey && k === 'f') return run(() => fns.current.pickView('search'))
      if (ctrl && e.shiftKey && k === 'g') return run(() => fns.current.pickView('scm'))
      if (ctrl && !e.shiftKey && !e.altKey && k === 'w') {
        const s = getEditorState()
        const r = s.activeRoot
        const a = r ? s.ws[r]?.active : null
        if (r && a) run(() => closeTab(r, a))
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const crumbs = useMemo(() => [{ label: 'Editor', to: '/editor' }, ...(activeMeta ? [{ label: activeMeta.name }] : [])], [activeMeta])
  const candidates = workspaces.filter((x) => !tabs.some((t) => t.root === x.root))

  const aiBody = <AiPanel root={root} extra={<IconBtn icon="close" label="Close Chat" shortcut="Ctrl Alt B" onClick={toggleChat} />} />
  const sideBody = activeMeta ? <SideBar ws={activeMeta} w={w} ui={st} view={st.sideView} sample={sampleRoot} /> : null

  const wide = mode === 'wide'
  const showPanel = st.panelOpen && mode !== 'narrow' && !!activeMeta

  return (
    <EditorApiContext.Provider value={api}>
      <div ref={rootRef} className="vsc" data-mode={mode}>
        <PlaybackHost roots={tabs.map((t) => t.root)} activeRoot={root} />
        <h1 className="sr-only">Editor{activeMeta ? `, workspace ${activeMeta.name}` : ''}</h1>
        <ShellCrumbs items={crumbs} />
        <PageActions>{sample ? <Badge tone="attention">Sample data</Badge> : <Badge tone="success">Live files</Badge>}</PageActions>

        <WorkspaceTabs
          tabs={tabViews}
          activeRoot={root}
          onSelect={activateWorkspace}
          onClose={closeWorkspace}
          onAdd={() => setAddOpen(true)}
          leading={mode === 'narrow' ? <IconBtn icon="files" label="Files" className="vsc-wtab-add" onClick={() => pickView('explorer')} /> : undefined}
        />

        <div className="vsc-body">
          {mode !== 'narrow' && (
            <ActivityBar
              view={st.sideView}
              open={wide ? st.sideOpen : drawerSide === 'left'}
              agentCount={agentsRunning}
              onPick={pickView}
              onSettings={() => setPaletteOpen(true)}
            />
          )}

          {wide && st.sideOpen && activeMeta && (
            <>
              <div className="vsc-side" style={{ width: st.sideW }}>
                {sideBody}
              </div>
              <Sash orientation="v" label="Resize side bar" size={st.sideW} min={170} max={520} onChange={(n) => setUi({ sideW: n })} onReset={() => setUi({ sideW: 260 })} />
            </>
          )}

          <div className="vsc-center">
            {!activeMeta ? (
              <EmptyState
                icon={<Codicon name="folder-opened" />}
                title="No workspace open"
                hint="Open a workspace to browse its files in a tab."
                action={<Button onClick={() => setAddOpen(true)}>Open workspace</Button>}
                className="m-auto"
              />
            ) : (
              <>
                {tabs
                  .filter((t) => visited.includes(t.root))
                  .map((t) => (
                    <EditorGroup
                      key={t.root}
                      ws={t}
                      w={st.ws[t.root] ?? newWs()}
                      visible={t.root === root}
                      sample={t.root.startsWith('sample:')}
                      compact={mode === 'narrow'}
                      onInfo={onInfo}
                      onReveal={(r, p) => {
                        revealPath(r, p)
                        setUi({ sideView: 'explorer', sideOpen: true })
                      }}
                    />
                  ))}
                {showPanel && (
                  <>
                    <Sash orientation="h" label="Resize panel" size={st.panelH} min={80} max={640} sign={-1} onChange={(n) => setUi({ panelH: n })} onReset={() => setUi({ panelH: 240 })} />
                    <div style={{ height: st.panelH, maxHeight: '70%', flex: 'none', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                      <BottomPanel ws={activeMeta} tab={w.panelTab} sample={sampleRoot} onClose={togglePanel} />
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {wide && st.aiOpen && (
            <>
              <Sash orientation="v" label="Resize chat" size={st.aiW} min={260} max={640} sign={-1} onChange={(n) => setUi({ aiW: n })} onReset={() => setUi({ aiW: 340 })} />
              <aside className="vsc-ai" style={{ width: st.aiW }} aria-label="Chat">
                {aiBody}
              </aside>
            </>
          )}

          {drawerSide && (
            <>
              <div className="vsc-scrim" onClick={() => setDrawer({ side: null, at: activeKey })} />
              {drawerSide === 'left' && activeMeta ? (
                <div className="vsc-drawer" style={{ left: mode === 'mid' ? 48 : 0, width: `min(320px, calc(100% - ${mode === 'mid' ? 48 : 0}px))` }}>
                  {sideBody}
                </div>
              ) : drawerSide === 'right' ? (
                <div className="vsc-drawer" data-side="right" style={{ width: 'min(380px, 100%)' }}>
                  {aiBody}
                </div>
              ) : null}
            </>
          )}
        </div>

        <StatusBar
          info={root ? (infos[root]?.info ?? null) : null}
          encoding={root ? (infos[root]?.enc ?? 'utf-8') : 'utf-8'}
          errors={problems.errors}
          warnings={problems.warnings}
          agentsRunning={agentsRunning}
          sample={sample}
          chatOpen={wide ? st.aiOpen : drawerSide === 'right'}
          onProblems={() => {
            if (root) setPanelTab(root, 'problems')
            setUi({ panelOpen: true })
          }}
          onAgents={() => {
            if (root) setPanelTab(root, 'agents')
            setUi({ panelOpen: true })
          }}
          onChat={toggleChat}
          onPalette={() => setPaletteOpen(true)}
        />

        <AddWorkspaceDialog open={addOpen} onOpenChange={setAddOpen} candidates={candidates} sample={sample} onPick={(x) => openWorkspace(x)} />
        <EditorCommands
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          state={st}
          candidates={candidates}
          files={root ? loadedFiles(root) : []}
          actions={{ togglePanel, toggleSide, toggleChat, addWorkspace: () => setAddOpen(true), pickView }}
        />
      </div>
    </EditorApiContext.Provider>
  )
}
