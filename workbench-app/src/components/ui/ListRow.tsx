import { cloneElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from 'react'
import { cn } from './cn'

export type ListRowProps = Omit<ComponentProps<'button'>, 'prefix'> & {
  /** Leading element: icon (lucide 14px), StatusDot or AgentMark. */
  leading?: ReactNode
  /** Trailing meta: time, count, Kbd (text-meta, tabular). */
  trailing?: ReactNode
  /** Selected: fill-2 + 2px accent bar on the left. */
  selected?: boolean
  /** Left indent in 12px steps (tree nesting). */
  depth?: number
  /** 28px (default, lists) or 22px (file tree). */
  dense?: boolean
  /**
   * Render the single child element (e.g. a router <Link to="..">Label</Link>) as the row.
   * The child's own children become the label.
   */
  asChild?: boolean
  /** Colour class for the selected bar (default bg-accent). */
  barClassName?: string
}

type ChildProps = { className?: string; style?: object; children?: ReactNode }

/** One row of a list: 28px, hover fill-3, selected fill-2 with a 2px accent bar. */
export function ListRow({
  leading,
  trailing,
  selected,
  depth = 0,
  dense,
  asChild,
  barClassName,
  className,
  children,
  style,
  type,
  ...rest
}: ListRowProps) {
  const cls = cn(
    'group/row relative flex w-full min-w-0 items-center gap-2 rounded-md pr-2 text-left text-body text-2 transition-colors-fast',
    'hover:bg-fill-3 hover:text-1 focus-visible:outline-offset-[-2px]',
    'disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40',
    '[&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-3 hover:[&_svg]:text-2',
    dense ? 'h-[22px]' : 'h-7',
    selected && 'bg-fill-2 text-1 hover:bg-fill-2',
    className,
  )
  const pad = { paddingLeft: 8 + depth * 12, ...style }
  const body = (label: ReactNode) => (
    <>
      {selected && <span aria-hidden className={cn('absolute top-1 bottom-1 left-0 w-0.5 rounded-full bg-accent', barClassName)} />}
      {leading && <span className="flex shrink-0 items-center justify-center">{leading}</span>}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing && <span className="flex shrink-0 items-center gap-1 text-meta text-3 tabular-nums">{trailing}</span>}
    </>
  )
  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<ChildProps>
    return cloneElement(child, {
      ...(rest as object),
      'aria-current': selected ? 'page' : undefined,
      className: cn(cls, child.props.className),
      style: { ...pad, ...child.props.style },
      children: body(child.props.children),
    } as ChildProps)
  }
  return (
    <button type={type ?? 'button'} aria-current={selected || undefined} className={cls} style={pad} {...rest}>
      {body(children)}
    </button>
  )
}
