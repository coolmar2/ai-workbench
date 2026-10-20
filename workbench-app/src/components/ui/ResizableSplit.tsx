import type { ComponentProps } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { cn } from './cn'

/**
 * Resizable panes (react-resizable-panels v4).
 *   <ResizableSplit orientation="horizontal">
 *     <ResizablePane id="explorer" defaultSize={240} minSize={180} maxSize={400} />
 *     <ResizeHandle />
 *     <ResizablePane id="code" minSize="30" />
 *   </ResizableSplit>
 * Numbers are pixels, strings without unit are percentages.
 */
export function ResizableSplit({ className, ...rest }: ComponentProps<typeof Group>) {
  return <Group className={cn('h-full min-h-0 w-full min-w-0', className)} {...rest} />
}

export function ResizablePane({ className, ...rest }: ComponentProps<typeof Panel>) {
  return <Panel className={cn('flex min-h-0 min-w-0 flex-col', className)} {...rest} />
}

/**
 * 1px hairline handle with an 8px invisible hit area; highlights on hover and while dragging.
 * Pass `orientation="vertical"` when it sits in a vertical (stacked) ResizableSplit.
 */
export function ResizeHandle({
  className,
  orientation = 'horizontal',
  ...rest
}: ComponentProps<typeof Separator> & { orientation?: 'horizontal' | 'vertical' }) {
  return (
    <Separator
      className={cn(
        'relative shrink-0 bg-stroke-2 outline-none transition-colors-fast before:absolute before:content-[""]',
        orientation === 'horizontal' ? 'w-px before:inset-y-0 before:-right-1 before:-left-1' : 'h-px before:inset-x-0 before:-top-1 before:-bottom-1',
        'data-[separator=hover]:bg-[var(--ring)] data-[separator=active]:bg-accent focus-visible:bg-accent',
        className,
      )}
      {...rest}
    />
  )
}
