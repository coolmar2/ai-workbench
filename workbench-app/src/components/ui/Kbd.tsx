import type { ComponentProps } from 'react'
import { cn } from './cn'

/** Keyboard hint. Pass the combo as one string ("Ctrl K") or as keys={['Ctrl', 'K']}. */
export function Kbd({ keys, children, className, ...rest }: ComponentProps<'kbd'> & { keys?: string[] }) {
  const parts = keys ?? (typeof children === 'string' ? children.split(' ') : null)
  return (
    <kbd className={cn('inline-flex items-center gap-0.5 font-sans text-meta text-3', className)} {...rest}>
      {parts
        ? parts.map((k) => (
            <span
              key={k}
              className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm bg-fill-3 px-1 text-[10px] leading-none font-medium text-2 shadow-[inset_0_-1px_0_var(--stroke-2)]"
            >
              {k}
            </span>
          ))
        : children}
    </kbd>
  )
}
