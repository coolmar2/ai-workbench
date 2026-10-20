import type { ReactNode } from 'react'
import { Tooltip as T } from 'radix-ui'
import { Kbd } from './Kbd'
import { cn } from './cn'

/** Mount once at the root. 200ms open delay, 300ms warm window (Hermes). */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <T.Provider delayDuration={200} skipDelayDuration={300}>
      {children}
    </T.Provider>
  )
}

export interface TooltipProps {
  /** Tooltip text. */
  content: ReactNode
  /** Optional shortcut shown as Kbd, e.g. "Ctrl K". */
  shortcut?: string
  /** Placement by role: controls "top" (default), toolbar buttons "bottom", list rows / rail icons "right". */
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  /** Disable without unmounting (e.g. label already visible). */
  disabled?: boolean
  /** The trigger: a single focusable element (Button, IconButton, link...). */
  children: ReactNode
}

/** Discovery tooltip. Never use the native `title` attribute. */
export function Tooltip({ content, shortcut, side = 'top', align = 'center', disabled, children }: TooltipProps) {
  if (disabled) return <>{children}</>
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            'z-50 flex max-w-72 items-center gap-2 rounded-sm bg-elevated px-2 py-1 text-caption text-1 shadow-float',
            'data-[state=closed]:animate-fade-out',
          )}
        >
          <span>{content}</span>
          {shortcut && <Kbd>{shortcut}</Kbd>}
        </T.Content>
      </T.Portal>
    </T.Root>
  )
}
