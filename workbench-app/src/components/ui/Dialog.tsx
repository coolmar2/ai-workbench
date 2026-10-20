import type { ComponentProps, ReactNode } from 'react'
import { Dialog as D } from 'radix-ui'
import { X } from 'lucide-react'
import { Button } from './Button'
import { IconButton } from './IconButton'
import { cn } from './cn'

export const Dialog = D.Root
export const DialogTrigger = D.Trigger
export const DialogClose = D.Close

const overlay = 'fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-overlay-in data-[state=closed]:animate-fade-out'

export interface DialogContentProps extends Omit<ComponentProps<typeof D.Content>, 'title'> {
  /** Required for accessibility; shown as the 15px header title. */
  title: ReactNode
  /** Hide the title visually (still announced), e.g. for the command palette. */
  hideTitle?: boolean
  description?: ReactNode
  /** Footer buttons, right-aligned. */
  footer?: ReactNode
  /** Width class, default max-w-[440px]. */
  width?: string
  showClose?: boolean
}

/** Centered dialog with blurred backdrop, shadow-float, 8px radius. Esc closes. */
export function DialogContent({ title, hideTitle, description, footer, width, showClose = true, className, children, ...rest }: DialogContentProps) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content
        {...(description ? {} : { 'aria-describedby': undefined })}
        className={cn(
          'fixed top-[16vh] left-1/2 z-50 flex max-h-[72vh] w-[calc(100vw-32px)] -translate-x-1/2 flex-col overflow-hidden rounded-lg bg-elevated text-1 shadow-float outline-none',
          'data-[state=open]:animate-pop-in data-[state=closed]:animate-fade-out',
          width ?? 'max-w-[440px]',
          className,
        )}
        {...rest}
      >
        {hideTitle ? (
          <D.Title className="sr-only">{title}</D.Title>
        ) : (
          <div className="flex items-start gap-3 px-4 pt-4 pb-2">
            <div className="min-w-0 flex-1">
              <D.Title className="text-title font-semibold text-1">{title}</D.Title>
              {description && <D.Description className="mt-1 text-body text-3">{description}</D.Description>}
            </div>
            {showClose && (
              <D.Close asChild>
                <IconButton label="Close" icon={<X />} className="-mt-0.5 -mr-1" />
              </D.Close>
            )}
          </div>
        )}
        {hideTitle && description && <D.Description className="sr-only">{description}</D.Description>}
        {children && <div className={cn('min-h-0 flex-1 overflow-auto', !hideTitle && 'px-4 pb-4')}>{children}</div>}
        {footer && <div className="flex justify-end gap-2 border-t border-stroke-3 px-4 py-3">{footer}</div>}
      </D.Content>
    </D.Portal>
  )
}

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
}

/** Confirm dialog; opens focused on the confirm button (Hermes). */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, onConfirm }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={title}
        description={description}
        showClose={false}
        footer={
          <>
            <D.Close asChild>
              <Button variant="ghost">{cancelLabel}</Button>
            </D.Close>
            <Button
              autoFocus
              variant={danger ? 'danger' : 'primary'}
              onClick={() => {
                onConfirm()
                onOpenChange(false)
              }}
            >
              {confirmLabel}
            </Button>
          </>
        }
      />
    </Dialog>
  )
}
