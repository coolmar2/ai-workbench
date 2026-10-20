import type { ComponentProps, ReactNode } from 'react'
import { cn } from './cn'

/** A pane region: flex column that fills its parent. Use inside ResizablePane or a layout cell. */
export function Panel({ className, ...rest }: ComponentProps<'section'>) {
  return <section className={cn('flex min-h-0 min-w-0 flex-col', className)} {...rest} />
}

export interface PanelHeaderProps extends Omit<ComponentProps<'header'>, 'title'> {
  /** 11px uppercase, tracking 0.06em, text-3. */
  title: ReactNode
  /** Optional icon before the title (lucide). */
  icon?: ReactNode
  /** Count after the title (tabular). */
  count?: number
  /** Right-aligned actions (IconButtons). */
  actions?: ReactNode
  /** Draw the bottom hairline (default true). */
  divider?: boolean
}

/** 32px panel header: caps title on the left, actions on the right. */
export function PanelHeader({ title, icon, count, actions, divider = true, className, ...rest }: PanelHeaderProps) {
  return (
    <header
      className={cn('flex h-8 shrink-0 items-center gap-2 px-3', divider && 'border-b border-stroke-3', className)}
      {...rest}
    >
      {icon && <span className="flex text-3 [&_svg]:size-3.5">{icon}</span>}
      <h2 className="caps min-w-0 truncate">{title}</h2>
      {count !== undefined && <span className="text-meta text-3 tabular-nums">{count}</span>}
      {actions && <div className="ml-auto flex items-center gap-0.5">{actions}</div>}
    </header>
  )
}

/** Flat card: bg-card, hairline, 8px radius. `interactive` adds hover + focus for clickable cards. */
export function Card({ className, interactive, ...rest }: ComponentProps<'div'> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-stroke-3 bg-card',
        interactive && 'cursor-pointer transition-colors-fast hover:border-stroke-1 hover:bg-elevated',
        className,
      )}
      {...rest}
    />
  )
}

export interface PageHeaderProps extends Omit<ComponentProps<'header'>, 'title'> {
  /** 15px/20px semibold page title (use `hero` for the rare 20px heading). */
  title: ReactNode
  description?: ReactNode
  /** Small elements right after the title (Badge, StatusDot...). */
  meta?: ReactNode
  /** Right-aligned actions. */
  actions?: ReactNode
  hero?: boolean
  /** Heading element (default h1; use h2/h3 for sub-sections). */
  as?: 'h1' | 'h2' | 'h3'
}

/** Title block at the top of a page's content. */
export function PageHeader({ title, description, meta, actions, hero, as: H = 'h1', className, ...rest }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-start gap-x-4 gap-y-3', className)} {...rest}>
      <div className="min-w-0 flex-1 basis-80">
        <div className="flex flex-wrap items-center gap-2">
          <H className={cn('font-semibold text-1', hero ? 'text-hero' : 'text-title')}>{title}</H>
          {meta}
        </div>
        {description && <p className="mt-1 max-w-[68ch] text-body text-3">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Hairline divider. */
export function Separator({ className, vertical, ...rest }: ComponentProps<'div'> & { vertical?: boolean }) {
  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      className={cn('shrink-0 bg-stroke-3', vertical ? 'h-full w-px' : 'h-px w-full', className)}
      {...rest}
    />
  )
}
