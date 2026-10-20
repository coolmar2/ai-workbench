import type { Vendor } from '../../data/types'
import { cn } from '../../components/ui'
import { VENDOR_BG } from './style'

/** Thin progress bar. `value` null = not reported (empty track). */
export function Bar({ value, vendor, className, label }: { value: number | null; vendor: Vendor; className?: string; label: string }) {
  const pct = value == null ? 0 : Math.round(value * 100)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value == null ? undefined : pct}
      className={cn('h-1 overflow-hidden rounded-sm bg-fill-2', className)}
    >
      <div className={cn('h-full rounded-sm', VENDOR_BG[vendor])} style={{ width: `${pct}%` }} />
    </div>
  )
}
