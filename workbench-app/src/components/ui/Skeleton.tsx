import type { ComponentProps } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from './cn'

/** Shimmer placeholder. Size it with classes: <Skeleton className="h-3 w-24" />. */
export function Skeleton({ className, ...rest }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      className={cn(
        'rounded-sm bg-fill-4 bg-[linear-gradient(90deg,transparent_0%,var(--fill-3)_50%,transparent_100%)] bg-[length:200%_100%] animate-shimmer',
        className,
      )}
      {...rest}
    />
  )
}

/** A few skeleton list rows (28px), e.g. while a live list loads. */
export function SkeletonRows({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-7 items-center gap-2 px-2">
          <Skeleton className="size-1.5 rounded-full" />
          <Skeleton className="h-2.5 flex-1" style={{ maxWidth: `${72 - i * 13}%` }} />
          <Skeleton className="h-2.5 w-6" />
        </div>
      ))}
    </div>
  )
}

/** Inline spinner for buttons / short waits (prefer Skeleton for content). */
export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return <Loader2 role="status" aria-label={label} className={cn('size-3.5 animate-spin text-3', className)} />
}
