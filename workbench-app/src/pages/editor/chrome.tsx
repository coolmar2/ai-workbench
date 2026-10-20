import { useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import { Tooltip, cn } from '../../components/ui'

export function Codicon({ name, className, style }: { name: string; className?: string; style?: CSSProperties }) {
  return <span aria-hidden className={cn('codicon', `codicon-${name}`, className)} style={style} />
}

interface IconBtnProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: string
  label: string
  shortcut?: string
  pressed?: boolean
  side?: 'top' | 'bottom' | 'right' | 'left'
}

/** 22px VS Code action button with the kit tooltip. */
export function IconBtn({ icon, label, shortcut, pressed, side = 'bottom', className, ...rest }: IconBtnProps) {
  return (
    <Tooltip content={label} shortcut={shortcut} side={side}>
      <button type="button" aria-label={label} aria-pressed={pressed} className={cn('vsc-iconbtn', className)} {...rest}>
        <Codicon name={icon} />
      </button>
    </Tooltip>
  )
}

/** Wraps a plain element with the kit tooltip. */
export function Tip({ label, shortcut, side = 'bottom', children }: { label: string; shortcut?: string; side?: 'top' | 'bottom' | 'right' | 'left'; children: ReactNode }) {
  return (
    <Tooltip content={label} shortcut={shortcut} side={side}>
      {children}
    </Tooltip>
  )
}

/**
 * Drag handle between two areas. `size` is the current size of the area it resizes; `sign` -1 when that area is
 * on the far side (right / bottom), so dragging toward the centre grows it.
 */
export function Sash({
  orientation,
  size,
  min,
  max,
  sign = 1,
  onChange,
  label,
  onReset,
}: {
  orientation: 'v' | 'h'
  size: number
  min: number
  max: number
  sign?: 1 | -1
  onChange: (n: number) => void
  label: string
  onReset?: () => void
}) {
  const start = useRef({ pos: 0, size: 0 })
  const [active, setActive] = useState(false)
  const clamp = (n: number) => Math.round(Math.min(max, Math.max(min, n)))
  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={orientation === 'v' ? 'vertical' : 'horizontal'}
      aria-valuenow={size}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      className="vsc-sash"
      data-o={orientation}
      data-active={active}
      onDoubleClick={onReset}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = { pos: orientation === 'v' ? e.clientX : e.clientY, size }
        setActive(true)
      }}
      onPointerMove={(e) => {
        if (!active) return
        const cur = orientation === 'v' ? e.clientX : e.clientY
        onChange(clamp(start.current.size + sign * (cur - start.current.pos)))
      }}
      onPointerUp={() => setActive(false)}
      onPointerCancel={() => setActive(false)}
      onKeyDown={(e) => {
        const grow = orientation === 'v' ? 'ArrowRight' : 'ArrowDown'
        const shrink = orientation === 'v' ? 'ArrowLeft' : 'ArrowUp'
        if (e.key !== grow && e.key !== shrink) return
        e.preventDefault()
        onChange(clamp(size + sign * (e.key === grow ? 16 : -16)))
      }}
    />
  )
}

/** The Agents activity: three linked nodes. */
export function AgentsGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="5.5" r="2.5" />
      <circle cx="5.5" cy="18" r="2.5" />
      <circle cx="18.5" cy="18" r="2.5" />
      <path d="M10.7 7.7 6.8 15.8M13.3 7.7l3.9 8.1M8 18h8" />
    </svg>
  )
}
