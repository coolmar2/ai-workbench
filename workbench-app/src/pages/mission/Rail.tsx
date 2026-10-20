import { Link } from 'react-router-dom'
import { Folder, Plus } from 'lucide-react'
import { AgentMark, IconButton, ListRow, ScrollArea, cn } from '../../components/ui'
import { Bar } from './parts'
import { WS_STATE_CLASS, wsStateText } from './style'
import { clock12, wsState, type HubSession, type Workspace } from './model'

interface RailProps {
  workspaces: Workspace[]
  selected: string
  onSelect: (name: string) => void
  onNewWorkspace: () => void
  /** Called after navigating (closes the drawer). */
  onNavigate?: () => void
  className?: string
}

/** Page-owned left rail: WORKSPACES, each with its state; the selected one expands to its sessions. */
export function WorkspaceRail({ workspaces, selected, onSelect, onNewWorkspace, onNavigate, className }: RailProps) {
  return (
    <nav aria-label="Workspaces" className={cn('flex min-h-0 flex-col bg-sidebar', className)}>
      <div className="flex h-10 shrink-0 items-center justify-between pr-2 pl-4">
        <span className="caps text-3">Workspaces</span>
        <IconButton label="New workspace" icon={<Plus />} onClick={onNewWorkspace} />
      </div>
      <ScrollArea className="min-h-0 flex-1 px-2 pb-3">
        <ul className="flex flex-col gap-0.5">
          {workspaces.map((w) => {
            const st = wsState(w)
            const open = w.name === selected
            return (
              <li key={w.name}>
                <ListRow
                  selected={open}
                  onClick={() => onSelect(w.name)}
                  leading={<Folder />}
                  trailing={<span className={cn('text-meta', WS_STATE_CLASS[st])}>{wsStateText(st, w.running)}</span>}
                  className={cn(open && 'font-medium')}
                >
                  {w.name}
                </ListRow>
                {open && w.sessions.length > 0 && (
                  <ul className="mt-0.5 mb-1.5 flex flex-col">
                    {w.sessions.map((s) => (
                      <RailSession key={s.id} s={s} onNavigate={onNavigate} />
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </ScrollArea>
    </nav>
  )
}

function RailSession({ s, onNavigate }: { s: HubSession; onNavigate?: () => void }) {
  const finish = s.finishAt != null && s.status === 'running' ? clock12(s.finishAt) : null
  return (
    <li>
      <Link
        to={`/mission/session/${s.id}`}
        onClick={onNavigate}
        className="group flex flex-col gap-1.5 rounded-md py-1.5 pr-2 pl-[30px] transition-colors-fast hover:bg-fill-3"
      >
        <span className="flex min-w-0 items-center gap-2 text-caption text-2 group-hover:text-1">
          <AgentMark vendor={s.lead} size={10} />
          <span className="truncate">{s.title}</span>
        </span>
        <span className="flex items-center gap-2 pl-[18px]">
          <Bar value={s.progress} vendor={s.lead} label={`${s.title} progress`} className="flex-1" />
          <span className="w-[58px] shrink-0 text-right text-meta text-3 tabular-nums">{finish ?? (s.status === 'attention' ? 'needs you' : '')}</span>
        </span>
      </Link>
    </li>
  )
}
