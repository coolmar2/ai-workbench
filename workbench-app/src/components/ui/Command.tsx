import type { ComponentProps, ReactNode } from 'react'
import { Command as C } from 'cmdk'
import { Search } from 'lucide-react'
import { Dialog, DialogContent } from './Dialog'
import { Kbd } from './Kbd'
import { cn } from './cn'

/** cmdk root, styled. Use inside CommandDialog or inline (e.g. a picker popover). */
export function Command({ className, ...rest }: ComponentProps<typeof C>) {
  return <C className={cn('flex min-h-0 flex-col text-body text-1', className)} {...rest} />
}

export function CommandInput({ className, ...rest }: ComponentProps<typeof C.Input>) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-stroke-2 px-3">
      <Search className="size-3.5 text-3" />
      <C.Input className={cn('h-full min-w-0 flex-1 bg-transparent text-body text-1 outline-none placeholder:text-4', className)} {...rest} />
    </div>
  )
}

export function CommandList({ className, ...rest }: ComponentProps<typeof C.List>) {
  return (
    <C.List
      className={cn('max-h-[min(380px,55vh)] scroll-py-1 overflow-y-auto overscroll-contain p-1', className)}
      {...rest}
    />
  )
}

export function CommandEmpty({ className, ...rest }: ComponentProps<typeof C.Empty>) {
  return <C.Empty className={cn('py-8 text-center text-caption text-3', className)} {...rest} />
}

export function CommandGroup({ className, ...rest }: ComponentProps<typeof C.Group>) {
  return (
    <C.Group
      className={cn('[&_[cmdk-group-heading]]:caps [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1', className)}
      {...rest}
    />
  )
}

export function CommandSeparator({ className, ...rest }: ComponentProps<typeof C.Separator>) {
  return <C.Separator className={cn('-mx-1 my-1 h-px bg-stroke-2', className)} {...rest} />
}

export function CommandItem({
  icon,
  shortcut,
  hint,
  className,
  children,
  ...rest
}: ComponentProps<typeof C.Item> & { icon?: ReactNode; shortcut?: string; hint?: ReactNode }) {
  return (
    <C.Item
      className={cn(
        'flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-body text-2 outline-none',
        'data-[selected=true]:bg-fill-2 data-[selected=true]:text-1 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-40',
        '[&_svg]:size-3.5 [&_svg]:text-3',
        className,
      )}
      {...rest}
    >
      {icon && <span className="flex w-4 shrink-0 items-center justify-center">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 truncate text-meta text-4 tabular-nums">{hint}</span>}
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </C.Item>
  )
}

export interface CommandDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Accessible title (visually hidden). */
  title?: string
  placeholder?: string
  children: ReactNode
}

/** Command palette dialog: blurred backdrop, 560px wide, search input on top, footer key hints. */
export function CommandDialog({ open, onOpenChange, title = 'Command palette', placeholder = 'Type a command or search…', children }: CommandDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} hideTitle width="max-w-[560px]" className="top-[14vh]">
        <Command loop>
          <CommandInput placeholder={placeholder} autoFocus />
          <CommandList>{children}</CommandList>
          <div className="flex h-8 shrink-0 items-center gap-3 border-t border-stroke-3 px-3 text-meta text-4">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> to move
            </span>
            <span className="flex items-center gap-1">
              <Kbd>Enter</Kbd> to open
            </span>
            <span className="ml-auto flex items-center gap-1">
              <Kbd>Esc</Kbd> to close
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
