import { Bot, Code2, LayoutGrid, UserRound, type LucideIcon } from 'lucide-react'
import type { McSession } from '../../data/types'
import { sortSessions, workspaceName } from '../../live/mission'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Global shortcut, shown as Kbd. Handled in AppShell (Alt+digit). */
  shortcut?: string
  key?: string
}

/** Primary navigation (sidebar rows, command palette, Alt+1..3). */
export const NAV: NavItem[] = [
  { to: '/agent', label: 'Agent', icon: Bot, shortcut: 'Alt 1', key: '1' },
  { to: '/editor', label: 'Editor', icon: Code2, shortcut: 'Alt 2', key: '2' },
  { to: '/mission', label: 'Mission control', icon: LayoutGrid, shortcut: 'Alt 3', key: '3' },
]

export const IDENTITY_NAV: NavItem = { to: '/identity', label: 'Identity', icon: UserRound }

export interface WorkspaceGroup {
  cwd: string
  name: string
  sessions: McSession[]
  running: number
}

/** Live sessions grouped by workspace (cwd), groups with running sessions first. */
export function groupByWorkspace(sessions: McSession[]): WorkspaceGroup[] {
  const map = new Map<string, WorkspaceGroup>()
  for (const s of sortSessions(sessions)) {
    const cwd = s.cwd || ''
    let g = map.get(cwd)
    if (!g) {
      g = { cwd, name: workspaceName(cwd) || 'Unknown folder', sessions: [], running: 0 }
      map.set(cwd, g)
    }
    g.sessions.push(s)
    if (s.status === 'running' || s.status === 'agents running') g.running++
  }
  return [...map.values()].sort((a, b) => b.running - a.running || a.name.localeCompare(b.name))
}

/** Session id from the current path, if on a session route. */
export function sessionIdFromPath(pathname: string): string | null {
  const m = /^\/mission\/session\/([^/]+)/.exec(pathname)
  return m ? decodeURIComponent(m[1]) : null
}
