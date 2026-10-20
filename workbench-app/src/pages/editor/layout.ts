import type { Vendor } from '../../data/types'

/** Static class maps so Tailwind can see every class. */
export const VENDOR_BG: Record<Vendor, string> = { claude: 'bg-claude', codex: 'bg-codex', gemini: 'bg-gemini' }
export const VENDOR_TINT: Record<Vendor, string> = { claude: 'bg-claude/12', codex: 'bg-codex/12', gemini: 'bg-gemini/12' }
