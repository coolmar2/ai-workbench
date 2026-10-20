import { createContext, useContext, type ComponentProps, type ReactNode } from 'react'
import { Tabs as T } from 'radix-ui'
import { cn } from './cn'

/** Underline tabs, 32px tall. <Tabs value onValueChange><TabsList><TabsTrigger value/></TabsList><TabsContent value/></Tabs> */
export function Tabs({ className, ...rest }: ComponentProps<typeof T.Root>) {
  return <T.Root className={cn('flex min-h-0 flex-col', className)} {...rest} />
}

type TabsSize = 'md' | 'sm'
const SizeCtx = createContext<TabsSize>('md')

/** `size="sm"`: 28px tall, 11px caps meta style (dense strips, bottom panels). Default md = 32px / 13px. */
export function TabsList({ className, size = 'md', ...rest }: ComponentProps<typeof T.List> & { size?: TabsSize }) {
  return (
    <SizeCtx.Provider value={size}>
      <T.List
        className={cn(
          'flex shrink-0 items-stretch overflow-x-auto border-b border-stroke-3 px-3 [scrollbar-width:none]',
          size === 'sm' ? 'h-7 gap-3' : 'h-8 gap-4',
          className,
        )}
        {...rest}
      />
    </SizeCtx.Provider>
  )
}

export function TabsTrigger({
  className,
  icon,
  count,
  children,
  ...rest
}: ComponentProps<typeof T.Trigger> & { icon?: ReactNode; count?: number }) {
  const size = useContext(SizeCtx)
  return (
    <T.Trigger
      className={cn(
        'relative -mb-px inline-flex shrink-0 items-center gap-1.5 border-b border-transparent whitespace-nowrap text-3 transition-colors-fast',
        size === 'sm' ? 'text-meta font-medium tracking-[0.06em] uppercase' : 'text-body',
        'hover:text-2 data-[state=active]:border-[var(--text-1)] data-[state=active]:text-1',
        'disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-offset-[-2px] [&_svg]:size-3.5',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
      {count !== undefined && <span className="text-meta text-3 tabular-nums">{count}</span>}
    </T.Trigger>
  )
}

export function TabsContent({ className, ...rest }: ComponentProps<typeof T.Content>) {
  return <T.Content className={cn('min-h-0 flex-1 outline-none data-[state=inactive]:hidden', className)} {...rest} />
}
