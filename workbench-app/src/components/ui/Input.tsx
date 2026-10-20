import type { ComponentProps, ReactNode } from 'react'
import { cn } from './cn'

const field = [
  'w-full min-w-0 rounded-md bg-fill-4 text-body text-1 shadow-input placeholder:text-4',
  'shadow-[var(--shadow-input),inset_0_0_0_1px_var(--stroke-2)] transition-colors-fast',
  'hover:shadow-[var(--shadow-input),inset_0_0_0_1px_var(--stroke-1)]',
  'focus-visible:outline-none focus-visible:shadow-focus',
  'disabled:cursor-not-allowed disabled:opacity-40',
  'aria-invalid:shadow-[var(--shadow-input),inset_0_0_0_1px_var(--danger)]',
]

export type InputProps = Omit<ComponentProps<'input'>, 'size'> & {
  /** Icon inside the field on the left (lucide, 14px). */
  icon?: ReactNode
  /** Element inside the field on the right (Kbd, IconButton...). */
  trailing?: ReactNode
  size?: 'sm' | 'md'
}

/** Text input: 28px (md) or 24px (sm), 6px radius, inset shadow, focus ring. */
export function Input({ className, icon, trailing, size = 'md', ...rest }: InputProps) {
  const h = size === 'sm' ? 'h-6 text-caption' : 'h-7'
  if (!icon && !trailing) return <input className={cn(field, h, 'px-2.5', className)} {...rest} />
  return (
    <div className={cn('relative flex w-full items-center', className)}>
      {icon && <span className="pointer-events-none absolute left-2 flex text-3 [&_svg]:size-3.5">{icon}</span>}
      <input className={cn(field, h, icon ? 'pl-7' : 'pl-2.5', trailing ? 'pr-8' : 'pr-2.5')} {...rest} />
      {trailing && <span className="absolute right-1.5 flex items-center">{trailing}</span>}
    </div>
  )
}

/** Multi-line input with the same look. */
export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={cn(field, 'min-h-16 resize-y px-2.5 py-1.5', className)} {...rest} />
}
