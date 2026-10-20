import type { ReactNode } from 'react'
import { cn } from './cn'

export interface EmptyStateProps {
  /** Lucide icon element (rendered 16px, text-3). */
  icon?: ReactNode
  /** One line. */
  title: ReactNode
  /** One line hint, text-3. */
  hint?: ReactNode
  /** Optional action (a Button). */
  action?: ReactNode
  /** Smaller variant for sidebars / narrow panels. */
  compact?: boolean
  /** Error tone: icon in danger colour. Use for failed loads. */
  error?: boolean
  className?: string
}

/** Empty / error placeholder for a list, panel or page. Never a grey box. */
export function EmptyState({ icon, title, hint, action, compact, error, className }: EmptyStateProps) {
  return (
    <div
      role={error ? 'alert' : undefined}
      className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-1 px-3 py-4' : 'gap-1.5 px-6 py-10', className)}
    >
      {icon && (
        <span
          className={cn(
            'mb-1 flex items-center justify-center rounded-lg [&_svg]:size-4',
            compact ? 'size-7' : 'size-9 bg-fill-4 shadow-[inset_0_0_0_1px_var(--stroke-3)]',
            error ? 'text-danger' : 'text-3',
          )}
        >
          {icon}
        </span>
      )}
      <p className={cn('font-medium text-2', compact ? 'text-caption' : 'text-body')}>{title}</p>
      {hint && <p className={cn('max-w-[48ch] text-3', compact ? 'text-meta' : 'text-caption')}>{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
