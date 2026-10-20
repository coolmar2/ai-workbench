import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Maximize, Minus, Plus } from 'lucide-react'
import { AgentMark, EmptyState, IconButton, cn } from '../../components/ui'
import type { GChip, GDot, GEdge, GNode, Msg } from './data'

interface Props {
  nodes: GNode[]
  edges: GEdge[]
  /** Fixed chips/dots (sample mode). Without them, chips are derived from `messages` at the link midpoints. */
  chips?: GChip[]
  dots?: GDot[]
  messages: Msg[]
  selected: string
  onSelect: (id: string) => void
  modelOf: (n: GNode) => string
  stateOf: (id: string) => string
  emptyNote?: string
  /** Space reserved at the bottom for the composer. */
  bottomInset?: number
}

const PAD = 20
const LABEL_W = 150
const LABEL_H = 40
const LABEL_R = 130
const MIN_K = 0.25
const MAX_K = 2

const CHIP_TONE: Record<Msg['type'], string> = {
  task: 'border-info/50',
  result: 'border-success/50',
  question: 'border-attention/60',
  note: 'border-coordinator/50',
}
const DOT_TONE: Record<Msg['type'], string> = { task: 'bg-info', result: 'bg-success', question: 'bg-attention', note: 'bg-coordinator' }
const RING: Record<string, string> = { claude: '[stroke:var(--claude)]', codex: '[stroke:var(--codex)]', gemini: '[stroke:var(--gemini)]' }
const clip = (t: string, n = 30) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)

function Ring({ n, state, selected }: { n: GNode; state: string; selected: boolean }) {
  const sw = n.kind === 'lead' ? 7 : n.size >= 64 ? 6 : 5
  const r = (n.size - sw) / 2
  const c = 2 * Math.PI * r
  const dashed = n.kind === 'coord' || n.kind === 'outside'
  const done = !dashed && (state === 'done' || n.pct === 100)
  const running = !dashed && state === 'running'
  const waiting = !dashed && n.kind !== 'lead' && !done && !running
  const pct = done ? 100 : n.pct !== null && !dashed ? n.pct : 0
  const cx = n.size / 2 + 6
  const text = dashed ? n.ringText : done ? '✓' : waiting ? 'wait' : n.ringText
  return (
    <svg width={n.size + 12} height={n.size + 12} className="-m-1.5 block overflow-visible" aria-hidden>
      {selected && <circle cx={cx} cy={cx} r={r + sw / 2 + 3} fill="none" strokeWidth={1.5} className="[stroke:var(--text-2)]" />}
      <circle
        cx={cx}
        cy={cx}
        r={r}
        strokeWidth={dashed ? 1.5 : sw}
        strokeDasharray={dashed ? '4 4' : undefined}
        className={cn(dashed ? (n.dashed?.includes('coord') ? '[stroke:var(--coordinator)] fill-chrome' : '[stroke:var(--claude)] fill-chrome') : 'fill-chrome [stroke:var(--fill-1)]')}
      />
      {!dashed && pct > 0 && (
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${(Math.min(100, pct) / 100) * c} ${c}`}
          transform={`rotate(-90 ${cx} ${cx})`}
          className={RING[n.vendor]}
        />
      )}
      {n.kind === 'lead' ? (
        <>
          <text x={cx} y={cx - n.size * 0.2} textAnchor="middle" className="fill-[var(--text-3)] text-[10px]">
            Lead
          </text>
          <text x={cx} y={cx + 7} textAnchor="middle" className="fill-[var(--text-1)] text-[22px] font-semibold tabular-nums">
            {text}
          </text>
          <text x={cx} y={cx + n.size * 0.27} textAnchor="middle" className="fill-[var(--text-3)] text-[10px]">
            {clip(n.model, 13)}
          </text>
        </>
      ) : (
        <text
          x={cx}
          y={cx}
          dy="0.35em"
          textAnchor="middle"
          style={{ fontSize: dashed ? 11 : done ? Math.round(n.size * 0.32) : (n.ringFont ?? 13) }}
          className={cn('font-semibold tabular-nums', waiting || dashed ? 'fill-[var(--text-3)]' : 'fill-[var(--text-1)]')}
        >
          {text}
        </text>
      )}
    </svg>
  )
}

/** Mission-control agent cloud: dashed outside nodes, a progress ring per agent, links with message chips. Pan and zoom. */
export function AgentCloud({ nodes, edges, chips, dots, messages, selected, onSelect, modelOf, stateOf, emptyNote, bottomInset = 0 }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null)
  const touched = useRef(false)

  const box = useMemo(() => {
    if (!nodes.length) return { ox: 0, oy: 0, w: 0, h: 0 }
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    nodes.forEach((n) => {
      const cx = n.x + n.size / 2
      const right = n.label === 'right'
      x0 = Math.min(x0, n.kind === 'lead' ? n.x : right ? n.x : cx - LABEL_W / 2)
      x1 = Math.max(x1, n.kind === 'lead' ? n.x + n.size : right ? n.x + n.size + 8 + LABEL_R : cx + LABEL_W / 2)
      y0 = Math.min(y0, n.y)
      y1 = Math.max(y1, n.y + n.size + (n.kind === 'lead' || right ? 0 : LABEL_H))
    })
    return { ox: PAD - x0, oy: PAD - y0 + 18, w: x1 - x0 + PAD * 2, h: y1 - y0 + PAD * 2 + 18 }
  }, [nodes])
  const cw = box.w
  const ch = box.h
  const count = nodes.length
  const live = !chips

  const fit = useCallback(() => {
    const el = host.current
    if (!el || !count) return
    const availH = Math.max(120, el.clientHeight - bottomInset)
    const k = Math.min(1, Math.max(0.5, Math.min(el.clientWidth / cw, availH / ch)))
    setView({ k, x: (el.clientWidth - cw * k) / 2, y: Math.max(8, (availH - ch * k) / 2) })
  }, [cw, ch, count, bottomInset])

  useEffect(() => {
    touched.current = false
    fit()
  }, [fit])

  useEffect(() => {
    const el = host.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      if (!touched.current) fit()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit])

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    const el = host.current
    if (!el) return
    touched.current = true
    setView((v) => {
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor))
      const px = cx ?? el.clientWidth / 2
      const py = cy ?? el.clientHeight / 2
      return { k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k }
    })
  }, [])

  const pan = useCallback((dx: number, dy: number) => {
    touched.current = true
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
  }, [])

  useEffect(() => {
    const el = host.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect()
        zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top)
      } else {
        const m = e.deltaMode === 1 ? 16 : 1
        touched.current = true
        setView((v) => ({ ...v, x: v.x - e.deltaX * m, y: v.y - e.deltaY * m }))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey || e.altKey) return
    const STEP = 48
    let handled = true
    if (e.key === '+' || e.key === '=') zoomAt(1.25)
    else if (e.key === '-' || e.key === '_') zoomAt(0.8)
    else if (e.key === 'ArrowLeft') pan(STEP, 0)
    else if (e.key === 'ArrowRight') pan(-STEP, 0)
    else if (e.key === 'ArrowUp') pan(0, STEP)
    else if (e.key === 'ArrowDown') pan(0, -STEP)
    else handled = false
    if (handled) e.preventDefault()
  }

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const center = useCallback((n: GNode) => ({ x: n.x + box.ox + n.size / 2, y: n.y + box.oy + n.size / 2 }), [box])

  const lines = useMemo(
    () =>
      edges.flatMap((e) => {
        const a = byId.get(e.from)
        const b = byId.get(e.to)
        if (!a || !b) return []
        const msg = messages.find((m) => (m.from === e.from && m.to === e.to) || (m.from === e.to && m.to === e.from))
        return [{ key: `${e.from}-${e.to}`, from: e.from, style: e.style, p: center(a), q: center(b), msg }]
      }),
    [edges, byId, center, messages],
  )

  const shownChips = useMemo(() => {
    if (chips) return chips.map((c, i) => ({ key: `c${i}`, x: c.x + box.ox, y: c.y + box.oy, text: c.text, type: c.type }))
    // Live: offset siblings along their edge (alternating, further out for non-lead sources so they clear the name labels) so chips near the lead do not overlap.
    const nth = new Map<string, number>()
    return lines.flatMap((l) => {
      if (!l.msg) return []
      const from = l.from
      const i = nth.get(from) ?? 0
      nth.set(from, i + 1)
      const t = from === 'lead' ? (i % 2 === 0 ? 0.4 : 0.62) : i % 2 === 0 ? 0.62 : 0.78
      return [{ key: `m-${l.key}`, x: l.p.x + (l.q.x - l.p.x) * t, y: l.p.y + (l.q.y - l.p.y) * t, text: `${l.msg.type === 'task' ? '→' : '←'} ${l.msg.type}: ${l.msg.text}`, type: l.msg.type }]
    })
  }, [chips, box, lines])
  const shownDots = useMemo(() => {
    // "In flight" dots are sample-only: the live feed cannot tell a message is in transit.
    return dots ? dots.map((d, i) => ({ key: `d${i}`, x: d.x + box.ox, y: d.y + box.oy, type: d.type })) : []
  }, [dots, box])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={host}
        role="group"
        tabIndex={0}
        aria-label="Agent cloud canvas. Drag or scroll to pan, Ctrl or Cmd plus scroll to zoom. Arrow keys pan, plus and minus zoom."
        onKeyDown={onKeyDown}
        className={cn('relative min-h-0 flex-1 touch-none overflow-hidden focus-visible:outline-offset-[-2px]', dragging ? 'cursor-grabbing' : 'cursor-grab')}
        style={{
          backgroundImage: 'radial-gradient(circle, var(--stroke-2) 1px, transparent 1px)',
          backgroundSize: `${20 * view.k}px ${20 * view.k}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y }
          setDragging(true)
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (!d) return
          touched.current = true
          setView((v) => ({ ...v, x: d.vx + e.clientX - d.px, y: d.vy + e.clientY - d.py }))
        }}
        onPointerUp={() => {
          drag.current = null
          setDragging(false)
        }}
        onPointerCancel={() => {
          drag.current = null
          setDragging(false)
        }}
      >
        <div className="caps pointer-events-none absolute top-3 left-4 z-10">Agents in this session</div>
        <div className="absolute top-0 left-0 origin-top-left" style={{ width: cw, height: ch, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          <svg className="pointer-events-none absolute inset-0" width={cw} height={ch} aria-hidden>
            {lines.map((l) => (
              <line
                key={l.key}
                x1={l.p.x}
                y1={l.p.y}
                x2={l.q.x}
                y2={l.q.y}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeDasharray={l.style === 'tree' ? undefined : '6 5'}
                className={l.style === 'coord' ? '[stroke:var(--coordinator)]' : l.style === 'outside' ? '[stroke:var(--claude)]' : '[stroke:var(--text-4)]'}
              />
            ))}
          </svg>
          {nodes.map((n) => {
            const sel = selected === n.id
            const left = n.x + box.ox
            const top = n.y + box.oy
            const side = n.label === 'right'
            const w = n.kind === 'lead' ? n.size : side ? n.size + 8 + LABEL_R : LABEL_W
            return (
              <button
                key={n.id}
                type="button"
                aria-pressed={sel}
                aria-label={`${n.name}, ${modelOf(n)}, ${stateOf(n.id)}${n.pct !== null ? `, ${n.pct}%` : ''}`}
                onClick={() => onSelect(n.id)}
                className={cn('absolute flex rounded-lg', side ? 'flex-row items-center gap-2 text-left' : 'flex-col items-center gap-1 text-center')}
                style={{ left: n.kind === 'lead' || side ? left : left + n.size / 2 - w / 2, top, width: w }}
              >
                <Ring n={n} state={stateOf(n.id)} selected={sel} />
                {n.kind !== 'lead' && (
                  <span className={cn('flex min-w-0 flex-col', side ? 'flex-1 items-start' : 'w-full items-center')}>
                    <span className="max-w-full truncate text-caption font-semibold text-1">{n.name}</span>
                    <span className="flex max-w-full items-center gap-1 text-meta text-3">
                      <AgentMark vendor={n.vendor} size={10} />
                      <span className="truncate">{modelOf(n)}</span>
                    </span>
                  </span>
                )}
              </button>
            )
          })}
          {shownDots.map((d) => (
            <span key={d.key} aria-hidden className={cn('pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full', DOT_TONE[d.type])} style={{ left: d.x, top: d.y }} />
          ))}
          {shownChips.map((c) => (
            <div
              key={c.key}
              className={cn('pointer-events-none absolute max-w-[200px] -translate-x-1/2 -translate-y-1/2 truncate rounded-full border bg-chrome px-2 py-0.5 text-meta whitespace-nowrap text-2', CHIP_TONE[c.type])}
              style={{ left: c.x, top: c.y }}
            >
              {clip(c.text)}
            </div>
          ))}
        </div>
        {emptyNote && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
            <EmptyState compact title={emptyNote} />
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute right-3 hidden flex-wrap sm:flex items-center justify-end gap-x-3 gap-y-1 text-meta text-3" style={{ bottom: bottomInset + 8 }}>
        <span>Ring = progress</span>
        <span className="inline-flex items-center gap-1"><i className="size-2 rounded-[2px] bg-info" />task</span>
        <span className="inline-flex items-center gap-1"><i className="size-2 rounded-[2px] bg-success" />result</span>
        {!live && <span className="inline-flex items-center gap-1"><i className="size-2 rounded-[2px] bg-attention" />question</span>}
        {!live && <span className="inline-flex items-center gap-1"><i className="size-2 rounded-[2px] bg-coordinator" />coordinator note</span>}
        {!live && <span className="inline-flex items-center gap-1"><i className="size-2 rounded-full bg-fill-1" />message in flight</span>}
      </div>
      <div className="absolute top-2 right-3 flex gap-0.5 rounded-lg border border-stroke-2 bg-elevated p-0.5 shadow-float">
        <IconButton label="Zoom in" icon={<Plus />} tooltipSide="bottom" onClick={() => zoomAt(1.25)} disabled={view.k >= MAX_K} />
        <IconButton label="Zoom out" icon={<Minus />} tooltipSide="bottom" onClick={() => zoomAt(0.8)} disabled={view.k <= MIN_K} />
        <IconButton
          label="Fit to view"
          icon={<Maximize />}
          tooltipSide="bottom"
          onClick={() => {
            touched.current = false
            fit()
          }}
        />
      </div>
    </div>
  )
}
