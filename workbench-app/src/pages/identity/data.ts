import type { Vendor } from '../../data/types'
import { accountStatus, type AccountsState } from '../../live/accounts'

export interface AccountRow {
  vendor: Vendor
  name: string
  detail: string
  status: string
  available: boolean
}

export interface IdentityCard {
  id: 'personal' | 'work'
  badge: string
  managed?: string
  title: string
  subtitle: string
  accounts: AccountRow[]
}

export const HEADING = 'Identity'
export const EXPLANATION =
  "Switching identity changes which account new sessions use. Session history from both identities stays visible in this spike. In Work, only Claude is available, because work runs on your organization's Claude subscription."

const VENDOR_NAME: Record<Vendor, string> = { claude: 'Claude', codex: 'Codex', gemini: 'Gemini' }
const WORK_OFF = "Off in this identity. Work runs on the org's Claude subscription only."

/** Identity cards from the live account check (GET /accounts). `available` = signed in and usable. */
export function buildCards({ accounts, offline }: AccountsState): IdentityCard[] {
  const claude = accounts?.find((a) => a.vendor === 'claude')
  const personalSubtitle = !accounts
    ? offline
      ? 'Account status unknown: wb_mc.py is not answering.'
      : 'Checking which CLIs are signed in…'
    : claude?.signed_in
      ? `Claude Code signed in${claude.plan ? ` on ${claude.plan}` : ''}${claude.email ? ` as ${claude.email}` : ''}.`
      : 'Claude Code is not signed in on this PC. Run claude once to sign in.'
  const personalRows: AccountRow[] = (['claude', 'codex', 'gemini'] as Vendor[]).map((v) => {
    const a = accounts?.find((x) => x.vendor === v)
    if (!a) return { vendor: v, name: VENDOR_NAME[v], detail: offline ? 'Backend offline' : 'Checking…', status: 'Unknown', available: false }
    return { vendor: v, name: VENDOR_NAME[v], detail: a.detail, status: accountStatus(a), available: a.signed_in === true }
  })
  return [
    { id: 'personal', badge: 'PERSONAL', title: 'Personal', subtitle: personalSubtitle, accounts: personalRows },
    {
      id: 'work',
      badge: 'WORK',
      managed: 'Managed by your organization',
      title: 'Work',
      subtitle: 'Not set up on this PC. Your work account stays on the work laptop.',
      accounts: [
        { vendor: 'claude', name: 'Claude', detail: 'Sign in with your organization on the work laptop', status: 'Not set up', available: false },
        { vendor: 'codex', name: 'Codex', detail: WORK_OFF, status: 'Not available', available: false },
        { vendor: 'gemini', name: 'Gemini', detail: WORK_OFF, status: 'Not available', available: false },
      ],
    },
  ]
}

// The workbench can't read or change the Remote Control setting yet, so it says how to do it instead of showing a switch.
export const RC_PERSONAL = 'Set inside claude: run /remote-control in a session (or turn it on in /config) to reach it from the Claude app.'
export const RC_WORK = "On the work laptop, your org admin decides whether Remote Control is allowed."

export const NOTES: { title: string; body: string }[] = [
  { title: 'What switching does', body: 'Switching changes which account new sessions use and which models are offered. Session history from both identities stays visible in this spike.' },
  { title: 'Where work sessions run', body: 'A work session stays on the machine where it started, for example your work laptop on the office network. From home, only prompts and results travel, through Remote Control.' },
  { title: 'Always visible', body: 'The top bar shows Personal or Work on every screen, so you never wonder which account a session is running under.' },
]
