import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { ChevronRight, FolderClosed, Plus, WifiOff } from 'lucide-react'
import { useMissionFeed, sessionTitle, isRunning } from '../../live/mission'
import { EmptyState, Eta, ListRow, RelativeTime, SkeletonRows, StatusDot, Tooltip, cn, toStatus } from '../ui'
import { sessionIdFromPath, groupByWorkspace, type WorkspaceGroup } from './nav'

const MAX_SESSIONS = 6

/**
 * Live workspace/session list: collapsible workspace groups (max 6 sessions each, "Show N more"),
 * status dots, and a "New session" row. Embed it in a page's own sidebar:
 *   <WorkspaceList onNavigate={() => ...} />
 * Props: onNavigate? - called after any link inside is followed (e.g. to close a drawer).
 * Highlights the session of the current /mission/session/:id route.
 */
export function WorkspaceList({ onNavigate }: { onNavigate?: () => void }) {
  const feed = useMissionFeed()
  const { pathname } = useLocation()
  const current = sessionIdFromPath(pathname)

  if (!feed.checked) return <SkeletonRows rows={4} />
  if (!feed.live)
    return (
      <EmptyState
        compact
        icon={<WifiOff />}
        title="Live feed offline"
        hint="wb_mc.py isn't answering on port 47832."
      />
    )
  const groups = groupByWorkspace(feed.state?.sessions ?? [])
  if (!groups.length)
    return <EmptyState compact icon={<FolderClosed />} title="No sessions yet" hint="Start Claude Code in a folder and it shows up here." />

  return (
    <div className="flex flex-col gap-px">
      {groups.map((g) => (
        <WorkspaceRows key={g.cwd} group={g} current={current} onNavigate={onNavigate} />
      ))}
      <ListRow leading={<Plus />} className="text-3" onClick={() => onNavigate?.()} asChild>
        <NavLink to="/agent">New session</NavLink>
      </ListRow>
    </div>
  )
}

function WorkspaceRows({ group, current, onNavigate }: { group: WorkspaceGroup; current: string | null; onNavigate?: () => void }) {
  const [open, setOpen] = useState(true)
  const [all, setAll] = useState(false)
  // The open session is always listed, even when it is beyond the first MAX_SESSIONS.
  const shown = all
    ? group.sessions
    : group.sessions.filter((s, i) => i < MAX_SESSIONS || s.session_id === current)
  const hidden = group.sessions.length - shown.length
  return (
    <div className="flex flex-col gap-px">
      <ListRow
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        leading={<ChevronRight className={cn('transition-transform duration-100', open && 'rotate-90')} />}
        trailing={group.sessions.length}
        className="font-medium"
      >
        <Tooltip content={group.cwd} side="right">
          <span>{group.name}</span>
        </Tooltip>
      </ListRow>
      {open && (
        <>
          {shown.map((s) => {
            const href = `/mission/session/${encodeURIComponent(s.session_id)}`
            return (
              <motion.div key={s.session_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
                <ListRow
                  asChild
                  depth={1}
                  selected={current === s.session_id}
                  leading={<StatusDot status={toStatus(s.status, s.online)} />}
                  trailing={s.eta && isRunning(s) ? <Eta eta={s.eta} variant="pill" /> : <RelativeTime t={s.last_event_t ?? s.started} />}
                >
                  <NavLink to={href} onClick={onNavigate}>
                    {sessionTitle(s)}
                  </NavLink>
                </ListRow>
              </motion.div>
            )
          })}
          {hidden > 0 && (
            <ListRow depth={1} className="text-3" onClick={() => setAll(true)}>
              Show {hidden} more
            </ListRow>
          )}
        </>
      )}
    </div>
  )
}
