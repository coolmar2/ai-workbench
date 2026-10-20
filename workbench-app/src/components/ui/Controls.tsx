import type { ComponentProps, ReactNode } from 'react'
import { Collapsible, HoverCard as HC, Popover as P, Switch as S, ToggleGroup } from 'radix-ui'
import { ChevronRight } from 'lucide-react'
import { cn } from './cn'

/* ---------------- Switch ---------------- */

/** On/off switch (28x16). Always pair with a visible label or aria-label. */
export function Switch({ className, ...rest }: ComponentProps<typeof S.Root>) {
  return (
    <S.Root
      className={cn(
        'relative inline-flex h-4 w-7 shrink-0 items-center rounded-full bg-fill-1 p-0.5 transition-colors-fast',
        'hover:bg-[var(--stroke-1)] data-[state=checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      <S.Thumb className="block size-3 rounded-full bg-ink shadow-[0_1px_2px_rgb(0_0_0/0.4)] transition-transform duration-100 ease-out data-[state=checked]:translate-x-3" />
    </S.Root>
  )
}

/* ---------------- SegmentedControl ---------------- */

export interface SegmentOption<V extends string> {
  value: V
  label: ReactNode
  icon?: ReactNode
  /** Accessible label when `label` is not plain text. */
  ariaLabel?: string
  disabled?: boolean
}

export interface SegmentedControlProps<V extends string> {
  value: V
  onValueChange: (v: V) => void
  options: SegmentOption<V>[]
  /** Accessible name of the group. */
  label: string
  size?: 'sm' | 'md'
  /** Stretch segments to fill the width. */
  full?: boolean
  className?: string
}

/** Single-choice segmented control (e.g. Personal | Work, Conversation | Agent cloud). Radix ToggleGroup. */
export function SegmentedControl<V extends string>({ value, onValueChange, options, label, size = 'md', full, className }: SegmentedControlProps<V>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as V)}
      aria-label={label}
      className={cn('inline-flex items-center gap-0.5 rounded-md bg-fill-4 p-0.5 shadow-[inset_0_0_0_1px_var(--stroke-3)]', full && 'flex w-full', className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          aria-label={o.ariaLabel}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-[4px] px-2 font-medium whitespace-nowrap text-3 transition-colors-fast',
            'hover:text-1 data-[state=on]:bg-fill-1 data-[state=on]:text-1 data-[state=on]:shadow-[0_1px_2px_rgb(0_0_0/0.3)]',
            'disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5',
            size === 'sm' ? 'h-5 text-meta' : 'h-6 text-caption',
            full && 'flex-1',
          )}
        >
          {o.icon}
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}

/* ---------------- Popover & HoverCard ---------------- */

const floating = 'z-50 rounded-lg bg-elevated text-body text-1 shadow-float outline-none data-[state=open]:animate-pop-in data-[state=closed]:animate-fade-out'

export const Popover = P.Root
export const PopoverTrigger = P.Trigger
export const PopoverClose = P.Close

/** Click-opened floating panel (pickers, small forms). */
export function PopoverContent({ className, sideOffset = 6, align = 'start', ...rest }: ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content sideOffset={sideOffset} align={align} collisionPadding={8} className={cn(floating, 'p-3', className)} {...rest} />
    </P.Portal>
  )
}

export const HoverCard = HC.Root
export const HoverCardTrigger = HC.Trigger

/** Hover-opened rich preview (Editor edit highlights, agent previews). Default 300ms open delay. */
export function HoverCardContent({ className, sideOffset = 6, ...rest }: ComponentProps<typeof HC.Content>) {
  return (
    <HC.Portal>
      <HC.Content sideOffset={sideOffset} collisionPadding={8} className={cn(floating, 'w-72 p-3', className)} {...rest} />
    </HC.Portal>
  )
}

/* ---------------- Disclosure ---------------- */

export interface DisclosureProps extends Omit<ComponentProps<typeof Collapsible.Root>, 'title'> {
  /** The always-visible summary row. */
  summary: ReactNode
  /** Caret only on hover/focus/open (Hermes tool rows). Default true. */
  caretOnHover?: boolean
  /** 11px tool-row size (default) or 13px body size. */
  size?: 'meta' | 'body'
  contentClassName?: string
}

/** Collapsible row with a caret: tool calls, nested details. Collapsed by default. */
export function Disclosure({ summary, caretOnHover = true, size = 'meta', className, contentClassName, children, ...rest }: DisclosureProps) {
  return (
    <Collapsible.Root className={cn('group/disc', className)} {...rest}>
      <Collapsible.Trigger
        className={cn(
          'flex w-full min-w-0 items-center gap-1 rounded-sm text-left text-3 transition-colors-fast hover:text-1',
          size === 'meta' ? 'min-h-5 text-meta' : 'min-h-6 text-body',
        )}
      >
        <ChevronRight
          className={cn(
            'size-3 shrink-0 transition-transform duration-100 group-data-[state=open]/disc:rotate-90',
            caretOnHover && 'opacity-0 group-hover/disc:opacity-100 group-focus-within/disc:opacity-100 group-data-[state=open]/disc:opacity-100',
          )}
        />
        <span className="flex min-w-0 flex-1 items-center gap-1.5">{summary}</span>
      </Collapsible.Trigger>
      <Collapsible.Content className={cn('pl-4', contentClassName)}>{children}</Collapsible.Content>
    </Collapsible.Root>
  )
}
