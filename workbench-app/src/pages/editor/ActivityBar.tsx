import type { ReactNode } from 'react'
import { Tooltip } from '../../components/ui'
import { AgentsGlyph, Codicon } from './chrome'
import type { SideView } from './store'

const ITEMS: { view: SideView; label: string; shortcut?: string; icon: ReactNode }[] = [
  { view: 'explorer', label: 'Explorer', shortcut: 'Ctrl Shift E', icon: <Codicon name="files" /> },
  { view: 'search', label: 'Search', shortcut: 'Ctrl Shift F', icon: <Codicon name="search" /> },
  { view: 'scm', label: 'Source Control', shortcut: 'Ctrl Shift G', icon: <Codicon name="source-control" /> },
  { view: 'agents', label: 'Agents', icon: <AgentsGlyph /> },
]

/** 48px activity bar: picks the side bar view; clicking the active one hides the side bar, like VS Code. */
export function ActivityBar({
  view,
  open,
  agentCount,
  onPick,
  onSettings,
}: {
  view: SideView
  open: boolean
  agentCount: number
  onPick: (v: SideView) => void
  onSettings: () => void
}) {
  return (
    <nav className="vsc-activity" aria-label="Activity bar">
      {ITEMS.map((it) => (
        <Tooltip key={it.view} content={it.label} shortcut={it.shortcut} side="right">
          <button
            type="button"
            className="vsc-act"
            aria-label={it.label}
            aria-pressed={open && view === it.view}
            onClick={() => onPick(it.view)}
          >
            {it.icon}
            {it.view === 'agents' && agentCount > 0 && <span className="vsc-badge" aria-label={`${agentCount} agents running`}>{agentCount}</span>}
          </button>
        </Tooltip>
      ))}
      <div className="vsc-activity-spacer" />
      <Tooltip content="Settings (command palette)" shortcut="Ctrl Shift P" side="right">
        <button type="button" className="vsc-act" aria-label="Settings" onClick={onSettings}>
          <Codicon name="settings-gear" />
        </button>
      </Tooltip>
    </nav>
  )
}
