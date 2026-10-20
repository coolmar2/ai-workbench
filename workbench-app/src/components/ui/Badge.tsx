import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './cn'

const badge = cva(
  'inline-flex h-[18px] shrink-0 items-center gap-1 whitespace-nowrap rounded-sm px-1.5 text-meta font-medium tabular-nums [&_svg]:size-3',
  {
    variants: {
      tone: {
        neutral: 'bg-fill-3 text-2',
        outline: 'text-3 shadow-[inset_0_0_0_1px_var(--stroke-1)]',
        claude: 'bg-claude/12 text-claude',
        codex: 'bg-codex/12 text-codex',
        gemini: 'bg-gemini/12 text-gemini',
        running: 'bg-running/12 text-running',
        coordinator: 'bg-coordinator/12 text-coordinator',
        personal: 'bg-personal/12 text-personal',
        work: 'bg-work/12 text-work',
        success: 'bg-success/12 text-success',
        attention: 'bg-attention/12 text-attention',
        danger: 'bg-danger/12 text-danger',
        info: 'bg-info/12 text-info',
      },
      caps: { true: 'uppercase tracking-caps', false: '' },
    },
    defaultVariants: { tone: 'neutral', caps: false },
  },
)

export type BadgeTone = NonNullable<VariantProps<typeof badge>['tone']>
export type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badge>

/** Small label / pill: status words, counts, identity tags, stat pills. Tinted at 12% max. */
export function Badge({ className, tone, caps, ...rest }: BadgeProps) {
  return <span className={cn(badge({ tone, caps }), className)} {...rest} />
}
