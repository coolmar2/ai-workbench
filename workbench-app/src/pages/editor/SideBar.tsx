import { useState, type ReactNode } from 'react'
import { dirs, loadDir, useEditMarks } from './api'
import { AgentsList } from './AgentsList'
import { Codicon, IconBtn } from './chrome'
import { FileTree } from './FileTree'
import { fileIconOf } from './fileTypes'
import { closeTab, collapseAll, openFile, revealPath, setUi, toggleExpanded, type EditorState, type SideView, type WsMeta, type WsState } from './store'

function Section({
  title,
  open,
  onToggle,
  actions,
  grow,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  actions?: ReactNode
  grow?: boolean
  children: ReactNode
}) {
  return (
    <section className="vsc-sec" style={open && grow ? { flex: '1 1 0' } : { flex: 'none' }}>
      <div className="vsc-sec-head" role="button" tabIndex={0} aria-expanded={open} onClick={onToggle} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onToggle())}>
        <Codicon name={open ? 'chevron-down' : 'chevron-right'} />
        <span className="vsc-sec-head-label">{title}</span>
        {actions && (
          <span className="vsc-sec-actions" onClick={(e) => e.stopPropagation()}>
            {actions}
          </span>
        )}
      </div>
      {open && <div className="vsc-sec-body">{children}</div>}
    </section>
  )
}

function SideTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="vsc-side-title">
      <span>{children}</span>
      {actions}
    </div>
  )
}

function ExplorerView({ ws, w, ui, sample }: { ws: WsMeta; w: WsState; ui: EditorState; sample: boolean }) {
  const marks = useEditMarks(ws.root)
  const openEditors = w.openTabs
  return (
    <>
      <SideTitle
        actions={
          sample ? (
            <span className="vsc-pcount" style={{ background: '#613214' }}>Sample data</span>
          ) : undefined
        }
      >
        Explorer
      </SideTitle>
      <div style={{ display: 'flex', minHeight: 0, flex: 1, flexDirection: 'column' }}>
        <Section
          title={`Open Editors${openEditors.length ? ` (${openEditors.length})` : ''}`}
          open={ui.openEditorsOpen}
          onToggle={() => setUi({ openEditorsOpen: !ui.openEditorsOpen })}
        >
          {openEditors.length === 0 ? (
            <div className="vsc-empty" style={{ padding: '4px 20px' }}>No editors open.</div>
          ) : (
            <div style={{ maxHeight: 22 * 8, overflow: 'auto' }} role="listbox" aria-label="Open editors">
              {openEditors.map((t) => {
                const name = t.path.split('/').pop() ?? t.path
                const ic = fileIconOf(name)
                const dir = t.path.includes('/') ? t.path.split('/').slice(0, -1).join('/') : ''
                return (
                  <div
                    key={t.path}
                    role="option"
                    aria-selected={w.active === t.path}
                    data-selected={w.active === t.path}
                    className="vsc-row"
                    style={{ paddingLeft: 4 }}
                    onClick={() => openFile(ws.root, t.path, { preview: t.preview })}
                  >
                    <button
                      type="button"
                      className="vsc-row-close"
                      aria-label={`Close ${name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        closeTab(ws.root, t.path)
                      }}
                    >
                      <Codicon name="close" />
                    </button>
                    <span className="vsc-ficon">
                      <Codicon name={ic.icon} style={{ color: ic.color }} />
                    </span>
                    <span className="vsc-row-label" style={{ fontStyle: t.preview ? 'italic' : undefined }}>{name}</span>
                    {dir && <span className="vsc-row-dim">{dir}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </Section>
        <Section
          grow
          title={ws.name}
          open={ui.folderOpen}
          onToggle={() => setUi({ folderOpen: !ui.folderOpen })}
          actions={
            <>
              <IconBtn icon="refresh" label="Refresh Explorer" onClick={() => {
                for (const k of dirs.keys()) {
                  const [r, p] = k.split('\n')
                  if (r === ws.root) void loadDir(r, p ?? '', true)
                }
              }} />
              <IconBtn icon="collapse-all" label="Collapse Folders in Explorer" onClick={() => collapseAll(ws.root)} />
            </>
          }
        >
          <FileTree
            root={ws.root}
            expanded={w.expanded}
            active={w.active}
            marks={marks}
            onToggle={(p, force) => toggleExpanded(ws.root, p, force)}
            onOpen={(p, pin) => openFile(ws.root, p, { preview: !pin })}
          />
        </Section>
      </div>
    </>
  )
}

function SearchView({ ws }: { ws: WsMeta }) {
  const [query, setQuery] = useState('')
  const version = dirs.useVersion()
  const q = query.trim().toLowerCase()
  // Only folders already loaded in the explorer are searched; the API has no search endpoint.
  void version
  const hits: string[] = []
  if (q) {
    for (const k of dirs.keys()) {
      const [r, p] = k.split('\n')
      if (r !== ws.root) continue
      const d = dirs.get(k)
      if (d?.state !== 'ready') continue
      for (const e of d.entries) if (e.type === 'file' && e.name.toLowerCase().includes(q)) hits.push(p ? `${p}/${e.name}` : e.name)
    }
    hits.sort()
  }
  return (
    <>
      <SideTitle>Search</SideTitle>
      <div style={{ padding: '0 12px 8px 20px' }}>
        <input className="vsc-input" placeholder="Search file names" aria-label="Search file names" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="vsc-sec-body">
        {!q ? (
          <div className="vsc-empty">Type to find files by name in the folders you have expanded. Text search is not available yet.</div>
        ) : hits.length === 0 ? (
          <div className="vsc-empty">No results in the loaded folders.</div>
        ) : (
          hits.slice(0, 200).map((p) => {
            const name = p.split('/').pop() ?? p
            const ic = fileIconOf(name)
            return (
              <div key={p} className="vsc-row" style={{ paddingLeft: 20 }} onClick={() => { openFile(ws.root, p, { preview: true }); revealPath(ws.root, p) }}>
                <span className="vsc-ficon"><Codicon name={ic.icon} style={{ color: ic.color }} /></span>
                <span className="vsc-row-label">{name}</span>
                <span className="vsc-row-dim">{p.includes('/') ? p.split('/').slice(0, -1).join('/') : ''}</span>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

export function SideBar({ ws, w, ui, view, sample }: { ws: WsMeta; w: WsState; ui: EditorState; view: SideView; sample: boolean }) {
  if (view === 'explorer') return <ExplorerView ws={ws} w={w} ui={ui} sample={sample} />
  if (view === 'search') return <SearchView ws={ws} />
  if (view === 'scm')
    return (
      <>
        <SideTitle>Source Control</SideTitle>
        <div className="vsc-empty">
          <Codicon name="source-control" /> No git info for this workspace.
          <br />
          The editor is read-only; agents work in private copies and never commit, so there is nothing to stage here.
        </div>
      </>
    )
  return (
    <>
      <SideTitle>Agents</SideTitle>
      <div className="vsc-sec-body">
        <AgentsList root={ws.root} sample={sample} compact />
      </div>
    </>
  )
}
