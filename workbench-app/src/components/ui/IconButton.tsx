import type { ComponentProps, ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Tooltip, type TooltipProps } from './Tooltip'
import { cn } from './cn'

const iconButton = cva(
  [
    'inline-flex shrink-0 items-center justify-center rounded-sm text-2 transition-colors-fast',
    'hover:bg-fill-3 hover:text-1 active:bg-fill-2 disabled:pointer-events-none disabled:opacity-40',
    'data-[active=true]:bg-fill-2 data-[active=true]:text-1 aria-expanded:bg-fill-2 aria-expanded:text-1',
  ],
  {
    variants: {
      size: {
        sm: 'size-5 [&_svg]:size-3',
        md: 'size-6 [&_svg]:size-3.5',
        lg: 'size-8 [&_svg]:size-4',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export type IconButtonProps = Omit<ComponentProps<'button'>, 'children'> &
  VariantProps<typeof iconButton> & {
    /** Required: used for the tooltip and aria-label. */
    label: string
    /** Lucide icon element, e.g. <Plus />. strokeWidth 1.5 is applied by CSS. */
    icon: ReactNode
    shortcut?: string
    tooltipSide?: TooltipProps['side']
    /** Pressed / open state (fill-2). */
    active?: boolean
  }

/** 24px icon-only button. Always has a tooltip (the label). */
export function IconButton({ label, icon, shortcut, tooltipSide, active, size, className, type, ...rest }: IconButtonProps) {
  return (
    <Tooltip content={label} shortcut={shortcut} side={tooltipSide}>
      <button
        type={type ?? 'button'}
        aria-label={label}
        data-active={active || undefined}
        className={cn(iconButton({ size }), className)}
        {...rest}
      >
        {icon}
      </button>
    </Tooltip>
  )
}
