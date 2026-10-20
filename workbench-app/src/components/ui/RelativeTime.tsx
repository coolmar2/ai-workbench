import { cn } from './cn'
import { relativeTime, useNow } from './time'

/** Ticking compact relative time ("now", "12m", "3h") with the absolute value for screen readers. */
export function RelativeTime({ t, className }: { t: string | number | null | undefined; className?: string }) {
  const now = useNow()
  const rel = relativeTime(t, now)
  if (!rel) return null
  return (
    <time className={cn('text-meta text-3 tabular-nums', className)} dateTime={typeof t === 'string' ? t : undefined} aria-label={`${rel === 'now' ? 'just now' : rel + ' ago'}`}>
      {rel}
    </time>
  )
}
