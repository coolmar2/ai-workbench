import { createContext, useContext } from 'react'

export interface Crumb {
  label: string
  to?: string
}

export interface ShellValue {
  /** DOM node of the top bar's actions slot (PageActions portals into it). */
  actionsEl: HTMLElement | null
  /** Breadcrumb override set by a page (ShellCrumbs); null = derived from the route. */
  crumbs: Crumb[] | null
  setCrumbs: (c: Crumb[] | null) => void
  openPalette: () => void
  /** Legacy: there is no global sidebar any more; always true. */
  collapsed: boolean
  /** Legacy no-op (kept so the Editor keeps working). */
  toggleSidebar: () => void
  /** True under 700px (compact top bar). */
  drawer: boolean
}

export const ShellContext = createContext<ShellValue | null>(null)

export function useShell(): ShellValue {
  const v = useContext(ShellContext)
  if (!v) throw new Error('useShell outside AppShell')
  return v
}

export { useMediaQuery } from '../ui/hooks'
