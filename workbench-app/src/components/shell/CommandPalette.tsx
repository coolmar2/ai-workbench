import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useIdentity, type Identity } from '../../context/identity'
import { useMissionFeed, sessionTitle, sortSessions, workspaceName } from '../../live/mission'
import { CommandDialog, CommandEmpty, CommandGroup, CommandItem, IdentityMark, StatusDot, relativeTime, toStatus, toast, useNow } from '../ui'
import { NAV, IDENTITY_NAV } from './nav'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const IDENTITIES: { id: Identity; label: string }[] = [
  { id: 'personal', label: 'Personal' },
  { id: 'work', label: 'Work' },
]

/** Ctrl+K / Ctrl+P: go to pages, switch identity, jump to live sessions. */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { identity, setIdentity } = useIdentity()
  const feed = useMissionFeed()
  const now = useNow(30_000)
  const sessions = feed.live && feed.state ? sortSessions(feed.state.sessions).slice(0, 30) : []

  const run = (fn: () => void) => {
    onOpenChange(false)
    fn()
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} placeholder="Go to a page, switch identity, open a session…">
      <CommandEmpty>No matches.</CommandEmpty>
      <CommandGroup heading="Go to">
        {[...NAV, IDENTITY_NAV].map((n) => (
          <CommandItem key={n.to} value={`go ${n.label}`} icon={<n.icon />} shortcut={n.shortcut} onSelect={() => run(() => navigate(n.to))}>
            {n.label}
          </CommandItem>
        ))}
      </CommandGroup>
      <CommandGroup heading="Identity">
        {IDENTITIES.map((i) => (
          <CommandItem
            key={i.id}
            value={`identity switch to ${i.label}`}
            icon={<IdentityMark identity={i.id} />}
            hint={identity === i.id ? <Check className="size-3.5 text-2" aria-label="Active" /> : undefined}
            onSelect={() =>
              run(() => {
                if (identity !== i.id) {
                  setIdentity(i.id)
                  toast(`Switched to ${i.label}`)
                }
              })
            }
          >
            Switch to {i.label}
          </CommandItem>
        ))}
      </CommandGroup>
      {sessions.length > 0 && (
        <CommandGroup heading="Live sessions">
          {sessions.map((s) => (
            <CommandItem
              key={s.session_id}
              value={`session ${sessionTitle(s)} ${workspaceName(s.cwd)} ${s.session_id}`}
              icon={<StatusDot status={toStatus(s.status, s.online)} />}
              hint={`${workspaceName(s.cwd)} · ${relativeTime(s.last_event_t ?? s.started, now)}`}
              onSelect={() => run(() => navigate(`/mission/session/${encodeURIComponent(s.session_id)}`))}
            >
              {sessionTitle(s)}
            </CommandItem>
          ))}
        </CommandGroup>
      )}
    </CommandDialog>
  )
}
