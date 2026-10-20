import { useSyncExternalStore } from 'react'
import type { Vendor } from '../data/types'

/**
 * Which CLIs are installed and signed in on this machine, from wb_mc.py GET /accounts (through the Vite
 * proxy). wb_mc asks each CLI's own status command; nothing here is sample data. One shared poll for the
 * whole app; `state.accounts` is null until the first answer, and stays at the last answer while offline.
 */

export interface Account {
  vendor: Vendor
  name: string
  installed: boolean
  /** null = installed but sign-in could not be checked. */
  signed_in: boolean | null
  detail: string
  plan?: string | null
  email?: string | null
}

export interface AccountsState {
  accounts: Account[] | null
  /** The last poll failed (wb_mc.py down or refused). */
  offline: boolean
}

const POLL_MS = 30_000
let state: AccountsState = { accounts: null, offline: false }
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

function set(next: AccountsState) {
  state = next
  listeners.forEach((l) => l())
}

async function poll() {
  try {
    const r = await fetch('/api/mc/accounts', { headers: { Accept: 'application/json' } })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const j = (await r.json()) as { accounts?: Account[] }
    set({ accounts: Array.isArray(j.accounts) ? j.accounts : [], offline: false })
  } catch {
    set({ accounts: state.accounts, offline: true })
  }
}

function subscribe(l: () => void) {
  listeners.add(l)
  if (!timer) {
    void poll()
    timer = setInterval(poll, POLL_MS)
  }
  return () => {
    listeners.delete(l)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

export function useAccounts(): AccountsState {
  return useSyncExternalStore(subscribe, () => state)
}

/** Short status for a row: "Signed in", "Not signed in", "Not installed", "Not checked". */
export function accountStatus(a: Account): string {
  if (!a.installed) return 'Not installed'
  if (a.signed_in === true) return 'Signed in'
  if (a.signed_in === false) return 'Not signed in'
  return 'Not checked'
}
