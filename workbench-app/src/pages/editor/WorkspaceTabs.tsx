import { useEffect, useRef, type ReactNode } from 'react'
import { AgentMark, Button, Dialog, DialogClose, DialogContent, EmptyState, RelativeTime } from '../../components/ui'
import type { Vendor } from '../../data/types'
import type { Workspace } from './api'
import { Codicon, IconBtn } from './chrome'

export interface WsTabView {
  root: string
  name: string
  vendors: Vendor[]
  running: number
  /** Agent edits played back in this workspace while another tab was showing. */
  badge?: number
}

/** Browser-style strip of workspace tabs: the thing VS Code lacks. */
export function WorkspaceTabs({
  tabs,
  activeRoot,
  onSelect,
  onClose,
  onAdd,
  leading,
}: {
  tabs: WsTabView[]
  activeRoot: string | null
  onSelect: (root: string) => void
  onClose: (root: string) => void
  onAdd: () => void
  leading?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeRoot, tabs.length])

  return (
    <div className="vsc-wstabs">
      {leading}
      <div ref={ref} role="tablist" aria-label="Workspaces" className="vsc-wstabs-scroll vsc-noscroll">
        {tabs.map((t) => (
          <div
            key={t.root}
            role="tab"
            tabIndex={0}
            aria-selected={t.root === activeRoot}
            className="vsc-wtab"
            onClick={() => onSelect(t.root)}
            onMouseDown={(e) => e.button === 1 && e.preventDefault()}
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault()
                onClose(t.root)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(t.root)
              }
            }}
          >
            <Codicon name="folder" style={{ fontSize: 14 }} />
            <span className="vsc-wtab-label">{t.name}</span>
            {!!t.badge && t.root !== activeRoot && (
              <span className="wbpb-badge" aria-label={`${t.badge} agent edits`}>
                {t.badge > 99 ? '99+' : t.badge}
              </span>
            )}
            {t.vendors.length > 0 && (
              <span className="vsc-wtab-dots" aria-label={`${t.running || t.vendors.length} agents running`}>
                {[...new Set(t.vendors)].map((v) => (
                  <AgentMark key={v} vendor={v} activity="editing" label="" />
                ))}
              </span>
            )}
            <IconBtn
              icon="close"
              label={`Close ${t.name}`}
              onClick={(e) => {
                e.stopPropagation()
                onClose(t.root)
              }}
            />
          </div>
        ))}
      </div>
      <IconBtn icon="add" label="Open workspace" shortcut="Ctrl Shift O" className="vsc-wtab-add" onClick={onAdd} />
      <div className="vsc-wtab-spacer" />
    </div>
  )
}

/** "+": the known workspaces that are not open yet. */
export function AddWorkspaceDialog({
  open,
  onOpenChange,
  candidates,
  sample,
  onPick,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  candidates: Workspace[]
  sample: boolean
  onPick: (w: Workspace) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Open workspace"
        description={sample ? 'Sample workspaces: the backend did not answer.' : 'Workspaces Claude Code sessions have run in. Each opens in its own tab.'}
        footer={
          <DialogClose asChild>
            <Button variant="secondary">Close</Button>
          </DialogClose>
        }
        width="max-w-[480px]"
      >
        {candidates.length === 0 ? (
          <EmptyState compact title="Every known workspace is open" hint="New ones appear here when a session starts in another folder." />
        ) : (
          <div className="vsc-pick" role="list">
            {candidates.map((w) => (
              <button
                key={w.root}
                type="button"
                role="listitem"
                className="vsc-pick-row"
                onClick={() => {
                  onPick(w)
                  onOpenChange(false)
                }}
              >
                <Codicon name="folder" />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="vsc-pick-name" style={{ display: 'block' }}>{w.name}</span>
                  <span className="vsc-pick-path" style={{ display: 'block' }}>{w.root}</span>
                </span>
                {w.last_ts ? (
                  <span className="vsc-pick-path" style={{ flex: 'none' }}>
                    <RelativeTime t={w.last_ts * 1000} />
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
