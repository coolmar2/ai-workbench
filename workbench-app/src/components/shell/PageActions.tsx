import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useShell, type Crumb } from './context'

/**
 * Render page actions (buttons, live chip...) into the top bar's right-hand slot (before the phone chip).
 *   <PageActions><Badge tone="success">live</Badge><IconButton .../></PageActions>
 */
export function PageActions({ children }: { children: ReactNode }) {
  const { actionsEl } = useShell()
  return actionsEl ? createPortal(children, actionsEl) : null
}

/**
 * Override the breadcrumb (no longer displayed; kept so pages compile) for the current page, e.g.
 *   <ShellCrumbs items={[{ label: 'Mission control', to: '/mission' }, { label: 'workbench-spike' }]} />
 * Pass a stable array (useMemo) to avoid needless updates.
 */
export function ShellCrumbs({ items }: { items: Crumb[] }) {
  const { setCrumbs } = useShell()
  const key = JSON.stringify(items)
  useEffect(() => {
    setCrumbs(JSON.parse(key) as Crumb[])
    return () => setCrumbs(null)
  }, [key, setCrumbs])
  return null
}
