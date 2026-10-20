import type { ComponentProps, ReactNode } from 'react'
import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './cn'

const button = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium select-none',
    'transition-colors-fast disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40',
    '[&_svg]:size-3.5 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        /** The one primary action on a screen. */
        primary: 'bg-accent text-on-accent hover:brightness-110 active:brightness-95',
        /** Default for most actions. */
        secondary: 'bg-fill-2 text-1 shadow-[inset_0_0_0_1px_var(--stroke-2)] hover:bg-fill-1 active:bg-fill-2',
        /** Toolbars, low-emphasis actions. */
        ghost: 'text-2 hover:bg-fill-3 hover:text-1 active:bg-fill-2',
        /** Destructive. Only for real destruction. */
        danger: 'bg-danger/12 text-danger shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--danger)_25%,transparent)] hover:bg-danger/20',
      },
      size: {
        sm: 'h-6 px-2 text-caption',
        md: 'h-7 px-2.5 text-body',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof button> & {
    /** Render the child element (e.g. a router <Link>) with button styles. */
    asChild?: boolean
    /** Lucide icon before the label. */
    icon?: ReactNode
  }

export function Button({ className, variant, size, asChild, icon, children, type, ...rest }: ButtonProps) {
  if (asChild) {
    return (
      <Slot.Root className={cn(button({ variant, size }), className)} {...rest}>
        {children}
      </Slot.Root>
    )
  }
  return (
    <button type={type ?? 'button'} className={cn(button({ variant, size }), className)} {...rest}>
      {icon}
      {children}
    </button>
  )
}
