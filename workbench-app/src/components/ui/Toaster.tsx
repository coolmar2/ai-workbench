import { Toaster as Sonner } from 'sonner'

/**
 * Mount once at the root. Show toasts with `toast('Saved')`, `toast.success(..)`, `toast.error(..)`
 * imported from 'sonner' (or from the kit index). Bottom-right, elevated surface, shadow-float.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      theme="dark"
      gap={8}
      visibleToasts={4}
      offset={16}
      mobileOffset={12}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-[var(--width)] max-w-[calc(100vw-24px)] items-start gap-2 rounded-lg bg-elevated px-3 py-2.5 text-body text-1 shadow-float',
          title: 'font-medium text-1',
          description: 'mt-0.5 text-caption text-3',
          icon: 'mt-px flex size-4 items-center justify-center [&_svg]:size-3.5',
          success: '[&_[data-icon]]:text-success',
          error: '[&_[data-icon]]:text-danger',
          warning: '[&_[data-icon]]:text-running',
          info: '[&_[data-icon]]:text-info',
          actionButton: 'ml-auto h-6 shrink-0 rounded-md bg-fill-2 px-2 text-caption font-medium text-1 hover:bg-fill-1',
          cancelButton: 'h-6 shrink-0 rounded-md px-2 text-caption text-2 hover:bg-fill-3',
          closeButton: 'text-3 hover:text-1',
        },
      }}
    />
  )
}
