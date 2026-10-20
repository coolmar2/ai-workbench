import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Vendor } from '../data/types'

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
      orgLabel: 'Acme Corp · Claude only',
      accountLabel: isWork ? 'Acme Corp · Claude Enterprise' : 'Omar Mostafa · Claude Max',
    }
  }, [identity, setIdentity])
  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useIdentity(): IdentityValue {
  const v = useContext(IdentityContext)
  if (!v) throw new Error('useIdentity outside IdentityProvider')
  return v
}
