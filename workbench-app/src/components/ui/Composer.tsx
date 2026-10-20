import { useCallback, useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowUp, ChevronDown, Paperclip, Square } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from './Menu'
import { IconButton } from './IconButton'
import { Tooltip } from './Tooltip'
import { cn } from './cn'

export interface ComposerModel {
  value: string
  label: string
  /** Optional mark shown before the label (AgentMark...). */
  icon?: ReactNode
}

export interface ComposerProps {
  value: string
  onChange: (v: string) => void
  /** Called on Enter (not Shift+Enter) or Send, with trimmed non-empty text and no disabledReason. */
  onSubmit: (text: string) => void
  placeholder?: string
  /** Accessible label of the textarea. */
  label?: string
  disabled?: boolean
  /** When set, Send is disabled and its tooltip shows this reason. */
  disabledReason?: string
  /** Model chip options; omit to hide the chip. */
  models?: ComposerModel[]
  model?: string
  onModelChange?: (value: string) => void
  /** Shows a Stop button next to Send. */
  running?: boolean
  onStop?: () => void
  /** Extra toolbar content, left (after the model chip) and right (before Stop/Send). */
  leftExtra?: ReactNode
  rightExtra?: ReactNode
  /** Attach button handler; omit to hide the button. */
  onAttach?: () => void
  /** Measured outer height in px (including the 12px bottom gap) so a scroller can reserve room. */
  onHeightChange?: (h: number) => void
  /** Positioning wrapper class. Default: floats at the bottom of a `relative` parent. */
  className?: string
  /** Max width of the box (default max-w-[760px]). */
  maxWidthClass?: string
}

const MAX_H = 200

/**
 * The one message box for the app: floating 12px-radius box, auto-grow textarea (max 200px),
 * toolbar with attach + model chip on the left and actions on the right. Enter sends, Shift+Enter newline.
 * Place it inside a `relative` container; reserve room with `onHeightChange`.
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  placeholder = 'Message the lead agent',
  label = 'Message',
  disabled,
  disabledReason,
  models,
  model,
  onModelChange,
  running,
  onStop,
  leftExtra,
  rightExtra,
  onAttach,
  onHeightChange,
  className,
  maxWidthClass = 'max-w-[760px]',
}: ComposerProps) {
  const root = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const id = useId()

  useEffect(() => {
    const el = root.current
    if (!el || !onHeightChange) return
    const ro = new ResizeObserver(() => onHeightChange(el.offsetHeight + 12))
    ro.observe(el)
    return () => ro.disconnect()
  }, [onHeightChange])

  useEffect(() => {
    const a = area.current
    if (!a) return
    a.style.height = 'auto'
    a.style.height = `${Math.min(a.scrollHeight, MAX_H)}px`
    a.style.overflowY = a.scrollHeight > MAX_H ? 'auto' : 'hidden'
  }, [value])

  const blocked = !!disabled || !!disabledReason
  const canSend = !blocked && value.trim().length > 0
  const submit = useCallback(() => {
    if (canSend) onSubmit(value.trim())
  }, [canSend, onSubmit, value])

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  const current = models?.find((m) => m.value === model)

  return (
    <div className={cn('pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-3', className)}>
      <div
        ref={root}
        className={cn(
          'pointer-events-auto mx-auto w-full rounded-composer bg-elevated shadow-float transition-colors-fast',
          'focus-within:shadow-[var(--shadow-float),inset_0_0_0_1px_var(--ring)]',
          maxWidthClass,
        )}
      >
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <textarea
          id={id}
          ref={area}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          style={{ maxHeight: MAX_H }}
          className="block w-full resize-none bg-transparent px-3 pt-3 pb-1 text-body text-1 outline-none placeholder:text-4 disabled:opacity-60"
        />
        <div className="flex items-center gap-1 px-2 pb-2">
          {onAttach && <IconButton label="Attach file" icon={<Paperclip />} onClick={onAttach} disabled={disabled} />}
          {models && models.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Model: ${current?.label ?? 'none'}`}
                  className="inline-flex h-6 max-w-48 items-center gap-1.5 rounded-sm px-1.5 text-meta text-2 transition-colors-fast hover:bg-fill-3 hover:text-1 aria-expanded:bg-fill-2 aria-expanded:text-1 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3"
                >
                  {current?.icon}
                  <span className="truncate">{current?.label ?? 'Model'}</span>
                  <ChevronDown />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start">
                <DropdownMenuRadioGroup value={model} onValueChange={(v) => onModelChange?.(v)}>
                  {models.map((m) => (
                    <DropdownMenuRadioItem key={m.value} value={m.value}>
                      {m.icon}
                      {m.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {leftExtra}
          <div className="ml-auto flex items-center gap-1">
            {rightExtra}
            {running && <IconButton label="Stop" icon={<Square />} onClick={onStop} disabled={!onStop} />}
            <Tooltip content={disabledReason ?? 'Send'} shortcut={disabledReason ? undefined : 'Enter'} side="top">
              {/* the span keeps the tooltip working while the button is disabled */}
              <span tabIndex={disabledReason ? 0 : -1} className="inline-flex rounded-md">
                <button
                  type="button"
                  aria-label="Send"
                  onClick={submit}
                  disabled={!canSend}
                  className="inline-flex size-6 items-center justify-center rounded-md bg-accent text-on-accent transition-colors-fast hover:opacity-90 disabled:bg-fill-2 disabled:text-3 disabled:opacity-100 [&_svg]:size-3.5"
                >
                  <ArrowUp />
                </button>
              </span>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  )
}
