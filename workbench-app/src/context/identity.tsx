import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Vendor } from '../data/types'
import { useAccounts, type AccountsState } from '../live/accounts'

/** Top bar / palette line for the personal identity, from the live Claude account check. */
function personalLabel({ accounts, offline }: AccountsState): string {
  if (!accounts) return offline ? 'Account status unknown (backend offline)' : 'Checking account…'
  const c = accounts.find((a) => a.vendor === 'claude')
  if (!c?.installed) return 'Claude Code not installed'
  if (!c.signed_in) return 'Claude Code not signed in'
  return [c.email, c.plan].filter(Boolean).join(' · ') || 'Claude Code signed in'
}

export type Identity = 'personal' | 'work'

interface IdentityValue {
  identity: Identity
  isWork: boolean
  setIdentity: (id: Identity) => void
  /** Vendors usable in the current identity. Work = Claude only. */
  vendors: Vendor[]
  /** In Work, every Codex/Gemini mark is replaced by Claude (boards' `col()`). */
  vendorFor: (v: Vendor) => Vendor
  orgLabel: string
  /** One-line account summary for the active identity (sidebar footer, palette). */
  accountLabel: string
}

const IdentityContext = createContext<IdentityValue | null>(null)
const KEY = 'wb.identity'

function readStored(): Identity {
  try {
    return localStorage.getItem(KEY) === 'work' ? 'work' : 'personal'
  } catch {
    return 'personal'
  }
}

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [identity, setState] = useState<Identity>(readStored)
  const acc = useAccounts()
  const setIdentity = useCallback((id: Identity) => {
    setState(id)
    try { localStorage.setItem(KEY, id) } catch { /* private mode */ }
  }, [])
  const value = useMemo<IdentityValue>(() => {
    const isWork = identity === 'work'
    return {
      identity,
      isWork,
      setIdentity,
      vendors: isWork ? ['claude'] : ['claude', 'codex', 'gemini'],
      vendorFor: (v) => (isWork ? 'claude' : v),
      orgLabel: 'Work · not set up on this PC',
      accountLabel: isWork ? 'Work account not set up on this PC' : personalLabel(acc),
    }
  }, [identity, setIdentity, acc])
  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useIdentity(): IdentityValue {
  const v = useContext(IdentityContext)
  if (!v) throw new Error('useIdentity outside IdentityProvider')
  return v
}
