import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Search, Settings2, Smartphone } from 'lucide-react'
import { DropdownMenu as DM } from 'radix-ui'
import { useIdentity, type Identity } from '../../context/identity'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  IdentityMark,
  Kbd,
  SegmentedControl,
  Tooltip,
  cn,
  toast,
} from '../ui'
import { useShell } from './context'
import { NAV } from './nav'

const IDENTITY_LABEL: Record<Identity, string> = { personal: 'Personal', work: 'Work' }

function useIdentitySwitch() {
  const { identity, setIdentity, accountLabel } = useIdentity()
  const switchIdentity = (id: Identity) => {
    if (id === identity) return
    setIdentity(id)
    toast(`Switched to ${IDENTITY_LABEL[id]}`, { description: 'Sessions, models and workers now follow this identity.' })
  }
  return { identity, accountLabel, switchIdentity }
}

/** 40px app bar: app tabs | identity | centered search | page actions slot + phone chip. */
export function TopBar({ actionsRef }: { actionsRef: (el: HTMLDivElement | null) => void }) {
  const { openPalette, drawer: compact } = useShell()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { identity, accountLabel, switchIdentity } = useIdentitySwitch()
  return (
    <header className="flex h-10 shrink-0 items-center gap-2 border-b border-stroke-3 bg-chrome px-2">
      <nav aria-label="Apps" className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-fill-4 p-0.5 shadow-[inset_0_0_0_1px_var(--stroke-3)]">
        {NAV.map((n) => (
          <Tooltip key={n.to} content={n.label} shortcut={n.shortcut} side="bottom">
            <NavLink
              to={n.to}
              aria-label={n.label}
              className={cn(
                  'inline-flex h-6 items-center justify-center gap-1.5 rounded-[4px] px-2 text-caption font-medium whitespace-nowrap text-3 transition-colors-fast hover:text-1 [&_svg]:size-3.5',
                  pathname.startsWith(n.to) && 'bg-fill-1 text-1 shadow-[inset_0_0_0_1px_var(--stroke-2)]',
                  compact && 'w-8 px-0',
              )}
            >
              <n.icon />
              {!compact && n.label}
            </NavLink>
          </Tooltip>
        ))}
      </nav>

      {compact ? (
        <DropdownMenu>
          <Tooltip content={`${IDENTITY_LABEL[identity]} - ${accountLabel}`} side="bottom">
            <DM.Trigger asChild>
              <button
                type="button"
                aria-label="Switch identity"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-2 transition-colors-fast hover:bg-fill-3 hover:text-1 aria-expanded:bg-fill-2"
              >
                <IdentityMark identity={identity} className="size-2.5" />
              </button>
            </DM.Trigger>
          </Tooltip>
          <DropdownMenuContent side="bottom" align="start">
            <DropdownMenuLabel>Identity</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={identity} onValueChange={(v) => switchIdentity(v as Identity)}>
              <DropdownMenuRadioItem value="personal">Personal</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="work">Work</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem icon={<Settings2 />} onSelect={() => navigate('/identity')}>
              Manage
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <SegmentedControl<Identity>
            label="Identity"
            value={identity}
            onValueChange={switchIdentity}
            options={[
              { value: 'personal', label: 'Personal', icon: <IdentityMark identity="personal" /> },
              { value: 'work', label: 'Work', icon: <IdentityMark identity="work" /> },
            ]}
          />
          <Tooltip content={accountLabel} side="bottom">
            <Link to="/identity" className="rounded-sm text-caption text-3 transition-colors-fast hover:text-1">
              Manage
            </Link>
          </Tooltip>
        </div>
      )}

      <div className={cn('flex min-w-0 flex-1 justify-center', compact && 'justify-end')}>
        {compact ? (
          <button
            type="button"
            aria-label="Search"
            onClick={openPalette}
            className="inline-flex size-7 items-center justify-center rounded-md text-2 transition-colors-fast hover:bg-fill-3 hover:text-1 [&_svg]:size-4"
          >
            <Search />
          </button>
        ) : (
          <button
            type="button"
            onClick={openPalette}
            className="flex h-7 w-full max-w-[440px] min-w-0 items-center gap-2 rounded-md bg-fill-4 px-2.5 text-caption text-3 shadow-[inset_0_0_0_1px_var(--stroke-3)] transition-colors-fast hover:bg-fill-3 hover:text-2"
          >
            <Search className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">Search files, sessions, agents</span>
            <Kbd>Ctrl P</Kbd>
          </button>
        )}
      </div>

      <div ref={actionsRef} className="flex shrink-0 items-center gap-2 empty:hidden" />
      {/* No live signal for Remote Control yet, so this is a neutral pointer, not an "on" light. */}
      <Tooltip content="Sessions started with Remote Control also show in the Claude app's Code tab" side="bottom">
        <span
          tabIndex={0}
          aria-label="Phone view: Claude app"
          className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-fill-4 px-2 text-meta text-2 shadow-[inset_0_0_0_1px_var(--stroke-3)]"
        >
          <Smartphone className="size-3" />
          {!compact && 'Phone view'}
        </span>
      </Tooltip>
    </header>
  )
}
