import type { Vendor } from '../../data/types'

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

export const CARDS: IdentityCard[] = [
  {
    id: 'personal',
    badge: 'PERSONAL',
    title: 'Omar Mostafa, personal',
    subtitle: 'Your own Claude Max plan. Claude Code signed in with your account.',
    accounts: [
      { vendor: 'claude', name: 'Claude', detail: 'Opus 5.5, Sonnet 5.5, Haiku 5.5 · Claude Code login', status: 'Signed in', available: true },
      { vendor: 'codex', name: 'Codex', detail: 'ChatGPT account sign-in · Codex CLI', status: 'Signed in', available: true },
      { vendor: 'gemini', name: 'Gemini', detail: 'Google account sign-in', status: 'Signed in', available: true },
    ],
  },
  {
    id: 'work',
    badge: 'WORK',
    managed: 'Managed by your organization',
    title: 'Acme Corp, Claude Enterprise',
    subtitle: "Your organization's seat. Claude Code signed in through Acme single sign-on.",
    accounts: [
      { vendor: 'claude', name: 'Claude', detail: 'Opus 5.5, Sonnet 5.5, Haiku 5.5, as your org allows', status: 'Signed in', available: true },
      { vendor: 'codex', name: 'Codex', detail: "Off in this identity. Work runs on the org's Claude subscription only.", status: 'Not available', available: false },
      { vendor: 'gemini', name: 'Gemini', detail: "Off in this identity. Work runs on the org's Claude subscription only.", status: 'Not available', available: false },
    ],
  },
]

export const PERSONAL_RC = 'On, your setting'
export const PERSONAL_RC_OFF = 'Off, your setting. Personal sessions stay on this machine.'
export const WORK_RC_NOTE = "The switch previews your org admin's setting. You can't change it yourself."
export const RC_ON = 'Enabled by your org admin. You can reach work sessions from other devices.'
export const RC_OFF = "Turned off by your org admin. Work sessions can't be reached from other devices."

export const NOTES: { title: string; body: string }[] = [
  { title: 'What switching does', body: 'Switching changes which account new sessions use and which models are offered. Session history from both identities stays visible in this spike.' },
  { title: 'Where work sessions run', body: 'A work session stays on the machine where it started, for example your work laptop on the office network. From home, only prompts and results travel, through Remote Control.' },
  { title: 'Always visible', body: 'The sidebar footer shows Personal or Work on every screen, so you never wonder which account a session is running under.' },
]
