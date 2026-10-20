import { useCallback, useEffect, useRef, type ComponentProps } from 'react'
import { cn } from './cn'

export type ScrollAreaProps = ComponentProps<'div'> & {
  /** Scroll direction. Default vertical. */
  orientation?: 'vertical' | 'horizontal' | 'both'
  /** Show the top/bottom fade masks (default true). */
  fade?: boolean
}

/**
 * Native scroller with thin scrollbars and 20px fade masks (top/bottom, or left/right for horizontal) that appear only when there is
 * content beyond that edge. Give it a bounded height (flex-1 min-h-0, or h-*).
 */
export function ScrollArea({ orientation = 'vertical', fade = true, className, children, onScroll, ref, ...rest }: ScrollAreaProps) {
  const inner = useRef<HTMLDivElement | null>(null)

  const update = useCallback(() => {
    const el = inner.current
    if (!el || !fade) return
    const top = el.scrollTop > 1
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1
    el.toggleAttribute('data-fade-top', top)
    el.toggleAttribute('data-fade-bottom', bottom)
    el.toggleAttribute('data-fade-left', el.scrollLeft > 1)
    el.toggleAttribute('data-fade-right', el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [fade])

  useEffect(() => {
    const el = inner.current
    if (!el) return
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    const mo = new MutationObserver(update)
    mo.observe(el, { childList: true, subtree: true })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [update])

  return (
    <div
      ref={(node) => {
        inner.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      onScroll={(e) => {
        update()
        onScroll?.(e)
      }}
      className={cn(
        'min-h-0 min-w-0',
        orientation === 'vertical' && 'overflow-x-hidden overflow-y-auto',
        orientation === 'horizontal' && 'overflow-x-auto overflow-y-hidden',
        orientation === 'both' && 'overflow-auto',
        fade && 'fade-mask',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
