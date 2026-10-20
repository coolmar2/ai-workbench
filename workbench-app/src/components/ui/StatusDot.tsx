import { cn } from './cn'
import { statusLabel, type Status } from './status'

const STYLE: Record<Status, string> = {
  running: 'bg-running animate-pulse-soft',
  idle: 'bg-[var(--text-4)]',
  attention: 'bg-attention',
  done: 'bg-success',
  error: 'bg-danger',
  ended: 'shadow-[inset_0_0_0_1px_var(--text-4)]',
  offline: 'shadow-[inset_0_0_0_1px_var(--text-4)]',
}

/**
 * 6px status dot. running = amber with a soft 1.6s pulse, idle = text-4, needs you = orange,
 * ended/offline = hollow ring. Labelled for screen readers unless `decorative`.
 */
export function StatusDot({ status, className, decorative }: { status: Status; className?: string; decorative?: boolean }) {
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : statusLabel(status)}
      aria-hidden={decorative || undefined}
      className={cn('inline-block size-1.5 shrink-0 rounded-full', STYLE[status], className)}
    />
  )
}
