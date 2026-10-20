import type { ComponentProps, ReactNode } from 'react'
import { Dialog as D } from 'radix-ui'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'
import { cn } from './cn'

/* Side drawer on Radix Dialog: modal (aria-modal), focus trap, Esc closes only the topmost layer, scrim click closes. */
export const Sheet = D.Root
export const SheetTrigger = D.Trigger
export const SheetClose = D.Close

export interface SheetContentProps extends Omit<ComponentProps<typeof D.Content>, 'title'> {
  /** Required for accessibility; shown in the 40px header. */
  title: ReactNode
  hideTitle?: boolean
  description?: ReactNode
  /** Which edge it slides from. Default right. */
  side?: 'left' | 'right'
  /** Width class, default w-[min(420px,92vw)]. */
  width?: string
  showClose?: boolean
}

export function SheetContent({ title, hideTitle, description, side = 'right', width, showClose = true, className, children, ...rest }: SheetContentProps) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-overlay-in data-[state=closed]:animate-fade-out" />
      <D.Content
        {...(description ? {} : { 'aria-describedby': undefined })}
        className={cn(
          'fixed inset-y-0 z-50 flex flex-col bg-sidebar text-1 shadow-float outline-none',
          side === 'left' ? 'left-0 border-r border-stroke-2 data-[state=open]:animate-drawer-in' : 'right-0 border-l border-stroke-2 data-[state=open]:animate-drawer-in-right',
          'data-[state=closed]:animate-fade-out',
          width ?? 'w-[min(420px,92vw)]',
          className,
        )}
        {...rest}
      >
        {hideTitle ? (
          <D.Title className="sr-only">{title}</D.Title>
        ) : (
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-stroke-3 px-3">
            <D.Title className="min-w-0 flex-1 truncate text-title font-semibold text-1">{title}</D.Title>
            {showClose && (
              <D.Close asChild>
                <IconButton label="Close" icon={<X />} />
              </D.Close>
            )}
          </div>
        )}
        {description && <D.Description className={hideTitle ? 'sr-only' : 'px-3 pt-2 text-body text-3'}>{description}</D.Description>}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </D.Content>
    </D.Portal>
  )
}
