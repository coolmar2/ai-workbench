import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CommandPalette } from './CommandPalette'
import { TopBar } from './TopBar'
import { ShellContext, useMediaQuery, type Crumb, type ShellValue } from './context'
import { NAV } from './nav'

/**
 * App frame: one 40px top bar (app tabs, identity, search, page actions, phone chip) above the page.
 * Pages own their sidebars. Owns Ctrl+K / Ctrl+P (palette) and Alt+1..3 (apps).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const compact = useMediaQuery('(max-width: 699px)')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [actionsEl, setActionsEl] = useState<HTMLElement | null>(null)
  const [crumbs, setCrumbs] = useState<Crumb[] | null>(null)

  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const toggleSidebar = useCallback(() => {}, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (k === 'k' || k === 'p')) {
        e.preventDefault()
        setPaletteOpen((o) => !o)
        return
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const item = NAV.find((n) => n.key === e.key)
        if (item) {
          e.preventDefault()
          navigate(item.to)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  const value = useMemo<ShellValue>(
    () => ({ actionsEl, crumbs, setCrumbs, openPalette, collapsed: true, toggleSidebar, drawer: compact }),
    [actionsEl, crumbs, openPalette, toggleSidebar, compact],
  )

  return (
    <ShellContext.Provider value={value}>
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main')?.focus()
        }}
        className="fixed top-2 left-2 z-[60] -translate-y-16 rounded-md bg-elevated px-3 py-1.5 text-body text-1 shadow-float focus:translate-y-0"
      >
        Skip to content
      </a>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-chrome">
        <TopBar actionsRef={setActionsEl} />
        <main id="main" tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
          {children}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </ShellContext.Provider>
  )
}
