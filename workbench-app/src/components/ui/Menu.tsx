import type { ComponentProps, ReactNode } from 'react'
import { ContextMenu as CM, DropdownMenu as DM } from 'radix-ui'
import { Check, ChevronRight } from 'lucide-react'
import { Kbd } from './Kbd'
import { cn } from './cn'

/* Shared look for DropdownMenu and ContextMenu: elevated surface, 8px radius, shadow-float, 28px items. */
const content =
  'z-50 min-w-44 overflow-hidden rounded-lg bg-elevated p-1 text-body text-1 shadow-float data-[state=open]:animate-pop-in data-[state=closed]:animate-fade-out'
const item = [
  'relative flex h-7 cursor-default select-none items-center gap-2 rounded-md px-2 text-body text-1 outline-none',
  'data-[highlighted]:bg-fill-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
  '[&_svg]:size-3.5 [&_svg]:text-2',
]
const danger = 'text-danger [&_svg]:text-danger data-[highlighted]:bg-danger/12'

interface ItemExtras {
  icon?: ReactNode
  /** Shortcut text shown on the right, e.g. "Ctrl R". */
  shortcut?: string
  /** Destructive item (red). */
  danger?: boolean
}

function ItemInner({ icon, shortcut, children }: Omit<ItemExtras, 'danger'> & { children: ReactNode }) {
  return (
    <>
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut && <Kbd className="ml-4">{shortcut}</Kbd>}
    </>
  )
}

/* ---------------- DropdownMenu ---------------- */

export const DropdownMenu = DM.Root
export const DropdownMenuTrigger = DM.Trigger
export const DropdownMenuGroup = DM.Group
export const DropdownMenuSub = DM.Sub
export const DropdownMenuRadioGroup = DM.RadioGroup

export function DropdownMenuContent({ className, sideOffset = 4, align = 'start', ...rest }: ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content sideOffset={sideOffset} align={align} collisionPadding={8} className={cn(content, className)} {...rest} />
    </DM.Portal>
  )
}

export function DropdownMenuItem({ icon, shortcut, danger: isDanger, className, children, ...rest }: ComponentProps<typeof DM.Item> & ItemExtras) {
  return (
    <DM.Item className={cn(item, isDanger && danger, className)} {...rest}>
      <ItemInner icon={icon} shortcut={shortcut}>
        {children}
      </ItemInner>
    </DM.Item>
  )
}

export function DropdownMenuCheckboxItem({ className, children, ...rest }: ComponentProps<typeof DM.CheckboxItem>) {
  return (
    <DM.CheckboxItem className={cn(item, 'pl-7', className)} {...rest}>
      <DM.ItemIndicator className="absolute left-2 flex">
        <Check />
      </DM.ItemIndicator>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </DM.CheckboxItem>
  )
}

export function DropdownMenuRadioItem({ className, children, ...rest }: ComponentProps<typeof DM.RadioItem>) {
  return (
    <DM.RadioItem className={cn(item, 'pl-7', className)} {...rest}>
      <DM.ItemIndicator className="absolute left-2 flex">
        <Check />
      </DM.ItemIndicator>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </DM.RadioItem>
  )
}

export function DropdownMenuLabel({ className, ...rest }: ComponentProps<typeof DM.Label>) {
  return <DM.Label className={cn('caps px-2 pt-1.5 pb-1', className)} {...rest} />
}

export function DropdownMenuSeparator({ className, ...rest }: ComponentProps<typeof DM.Separator>) {
  return <DM.Separator className={cn('-mx-1 my-1 h-px bg-stroke-2', className)} {...rest} />
}

export function DropdownMenuSubTrigger({ icon, className, children, ...rest }: ComponentProps<typeof DM.SubTrigger> & { icon?: ReactNode }) {
  return (
    <DM.SubTrigger className={cn(item, 'data-[state=open]:bg-fill-2', className)} {...rest}>
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <ChevronRight className="ml-auto" />
    </DM.SubTrigger>
  )
}

export function DropdownMenuSubContent({ className, ...rest }: ComponentProps<typeof DM.SubContent>) {
  return (
    <DM.Portal>
      <DM.SubContent sideOffset={4} collisionPadding={8} className={cn(content, className)} {...rest} />
    </DM.Portal>
  )
}

/* ---------------- ContextMenu (right-click) ---------------- */

export const ContextMenu = CM.Root
export const ContextMenuTrigger = CM.Trigger
export const ContextMenuGroup = CM.Group

export function ContextMenuContent({ className, ...rest }: ComponentProps<typeof CM.Content>) {
  return (
    <CM.Portal>
      <CM.Content collisionPadding={8} className={cn(content, className)} {...rest} />
    </CM.Portal>
  )
}

export function ContextMenuItem({ icon, shortcut, danger: isDanger, className, children, ...rest }: ComponentProps<typeof CM.Item> & ItemExtras) {
  return (
    <CM.Item className={cn(item, isDanger && danger, className)} {...rest}>
      <ItemInner icon={icon} shortcut={shortcut}>
        {children}
      </ItemInner>
    </CM.Item>
  )
}

export function ContextMenuLabel({ className, ...rest }: ComponentProps<typeof CM.Label>) {
  return <CM.Label className={cn('caps px-2 pt-1.5 pb-1', className)} {...rest} />
}

export function ContextMenuSeparator({ className, ...rest }: ComponentProps<typeof CM.Separator>) {
  return <CM.Separator className={cn('-mx-1 my-1 h-px bg-stroke-2', className)} {...rest} />
}
