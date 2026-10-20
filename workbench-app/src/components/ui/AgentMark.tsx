import { cn } from './cn'
import type { Vendor } from '../../data/types'
import { useIdentity } from '../../context/identity'
// Brand marks from LobeHub's icon set (@lobehub/icons-static-svg, MIT). The logos are their owners' trademarks.
import claudeLogo from '../../assets/vendors/claude.svg'
import codexLogo from '../../assets/vendors/codex.svg'
import geminiLogo from '../../assets/vendors/gemini.svg'

const NAME: Record<Vendor, string> = { claude: 'Claude', codex: 'Codex', gemini: 'Gemini' }
const LOGO: Record<Vendor, string> = { claude: claudeLogo, codex: codexLogo, gemini: geminiLogo }
const SIZE = { 10: 'size-2.5', 14: 'size-3.5', 18: 'size-[18px]' } as const

export interface AgentMarkProps {
  vendor: Vendor
  /** 10 (inline / rows), 14 (cards, headers), 18 (hero / graph nodes). */
  size?: 10 | 14 | 18
  /** Work identity shows Claude everywhere; set false where the real vendor must show (Identity page). */
  respectIdentity?: boolean
  /** editing = soft pulse, reading = dimmed. */
  activity?: 'editing' | 'reading'
  /** Accessible name; defaults to the vendor name. Pass "" to make it decorative. */
  label?: string
  className?: string
}

/** Vendor logo: Claude, Codex or Gemini. */
export function AgentMark({ vendor, size = 10, respectIdentity = true, activity, label, className }: AgentMarkProps) {
  const { vendorFor } = useIdentity()
  const v = respectIdentity ? vendorFor(vendor) : vendor
  const name = label ?? NAME[v]
  return (
    <img
      src={LOGO[v]}
      alt={name}
      aria-hidden={name ? undefined : true}
      draggable={false}
      className={cn(
        'inline-block shrink-0 select-none object-contain',
        SIZE[size],
        activity === 'editing' && 'animate-pulse',
        activity === 'reading' && 'opacity-55',
        className,
      )}
    />
  )
}

/** Personal (green dot) / Work (amber square) identity mark. */
export function IdentityMark({ identity, className }: { identity: 'personal' | 'work'; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-[7px] shrink-0', identity === 'personal' ? 'rounded-full bg-personal' : 'rounded-[2px] bg-work', className)}
    />
  )
}
