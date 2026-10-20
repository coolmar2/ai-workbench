import { useRef, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { AgentMark, Disclosure, cn, useElementWidth } from '../../components/ui'
import { SAMPLE_BUILDS, SAMPLE_CHIPS, type MsgKind } from './data'
import { HubCard } from './HubCard'
import { Bar } from './parts'
import { clock12, type HubSession } from './model'

const CARD_H = 196
const PAD = 16
const HUB = 150
const MAX_SLOTS = 8

export interface CoordinatorInfo {
  model: string
  watching: number
  lastNote: string
}

const KIND_BORDER: Record<MsgKind, string> = {
  plan: 'border-stroke-1',
  result: 'border-success/60',
  question: 'border-danger/60',
  note: 'border-coordinator/60',
}
const KIND_DOT: Record<MsgKind, string> = {
  plan: 'bg-[var(--text-2)]',
  result: 'bg-success',
  question: 'bg-danger',
  note: 'bg-coordinator',
}
const KIND_STROKE: Record<MsgKind, string> = {
  plan: 'stroke-stroke-1',
  result: 'stroke-success',
  question: 'stroke-danger',
  note: 'stroke-coordinator',
}

interface Slot {
  s: HubSession
  x: number
  y: number
  w: number
  /** Where the link leaves the card. */
  ax: number
  ay: number
  side: 'l' | 'r'
}

function layout(list: HubSession[], W: number): { slots: Slot[]; H: number; mode: 'corners' | 'sides'; cw: number } {
  const n = list.length
  if (n <= 4) {
    const cw = Math.min(380, Math.floor((W - PAD * 3) / 2))
    const H = 2 * CARD_H + 2 * PAD + 380
    const pos = [
      { x: PAD, y: PAD, side: 'l' as const, bottom: true },
      { x: W - PAD - cw, y: PAD, side: 'r' as const, bottom: true },
      { x: PAD, y: H - PAD - CARD_H, side: 'l' as const, bottom: false },
      { x: W - PAD - cw, y: H - PAD - CARD_H, side: 'r' as const, bottom: false },
    ]
    return {
      mode: 'corners',
      cw,
      H,
      slots: list.map((s, i) => {
        const p = pos[i]
        const ax = p.side === 'l' ? p.x + cw * 0.8 : p.x + cw * 0.2
        return { s, x: p.x, y: p.y, w: cw, ax, ay: p.bottom ? p.y + CARD_H : p.y, side: p.side }
      }),
    }
  }
  const rows = Math.ceil(n / 2)
  const cw = Math.min(380, Math.floor((W - HUB - PAD * 4) / 2))
  const gap = 12
  const H = rows * CARD_H + (rows + 1) * gap + PAD
  return {
    mode: 'sides',
    cw,
    H,
    slots: list.map((s, i) => {
      const side = i % 2 === 0 ? ('l' as const) : ('r' as const)
      const row = Math.floor(i / 2)
      const y = gap + row * (CARD_H + gap)
      const x = side === 'l' ? PAD : W - PAD - cw
      return { s, x, y, w: cw, ax: side === 'l' ? x + cw : x, ay: y + CARD_H / 2, side }
    }),
  }
}

/** Point at fraction t from the card anchor towards the hub centre (straight or gently curved link). */
function pointAt(a: { x: number; y: number }, c: { x: number; y: number }, curved: boolean, t: number) {
  if (!curved) return { x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t }
  // quadratic bezier with control point (c.x, a.y)
  const q = { x: c.x, y: a.y }
  const u = 1 - t
  return { x: u * u * a.x + 2 * u * t * q.x + t * t * c.x, y: u * u * a.y + 2 * u * t * q.y + t * t * c.y }
}

/** Chip box (approximate: text width is estimated) for a chip sitting beside link point `pt`. */
function chipBox(pt: { x: number; y: number }, side: 'l' | 'r', text: string) {
  const w = text.length * 6.4 + 34
  const h = 22
  const x0 = side === 'l' ? pt.x - 8 - w : pt.x + 8
  return { x0, x1: x0 + w, y0: pt.y - h / 2, y1: pt.y + h / 2 }
}

/** Distance from the point (cx, cy) to the nearest edge of a box (0 when inside). */
function distToBox(b: { x0: number; x1: number; y0: number; y1: number }, cx: number, cy: number) {
  const dx = Math.max(b.x0 - cx, 0, cx - b.x1)
  const dy = Math.max(b.y0 - cy, 0, cy - b.y1)
  return Math.hypot(dx, dy)
}

type Box = { x0: number; x1: number; y0: number; y1: number }
const hits = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0

/**
 * Chip position along the link at about t: moved towards the card until it clears the coordinator circle
 * (HUB/2 + 8) and the legend box, trying the other side of the link when the preferred side hits the legend.
 */
function chipPoint(a: { x: number; y: number }, c: { x: number; y: number }, curved: boolean, t: number, side: 'l' | 'r', text: string, avoid: Box[]) {
  const other = side === 'l' ? 'r' : 'l'
  for (let i = 0; i < 60; i++) {
    // 0, -0.02, +0.02, -0.04, ... (towards the card first)
    const tt = t + (i % 2 === 1 ? -1 : 1) * Math.ceil(i / 2) * 0.02
    if (tt < 0.04 || tt > 0.75) continue
    const pt = pointAt(a, c, curved, tt)
    for (const sd of [side, other] as const) {
      const box = chipBox(pt, sd, text)
      if (distToBox(box, c.x, c.y) >= HUB / 2 + 8 && !avoid.some((o) => hits(box, o))) {
        avoid.push(box)
        return { pt, side: sd }
      }
    }
  }
  return { pt: pointAt(a, c, curved, t), side }
}

const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗']
function arrow(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const a = Math.atan2(to.y - from.y, to.x - from.x)
  return ARROWS[(Math.round(a / (Math.PI / 4)) + 8) % 8]
}

export function MoreList({ sessions, label }: { sessions: HubSession[]; label: string }) {
  if (sessions.length === 0) return null
  return (
    <Disclosure size="body" caretOnHover={false} summary={<span className="tabular-nums">{label}</span>}>
      <ul className="flex flex-col py-1">
        {sessions.map((s) => (
          <li key={s.id}>
            <Link
              to={`/mission/session/${s.id}`}
              className="flex h-7 items-center gap-2 rounded-md px-2 text-caption text-2 transition-colors-fast hover:bg-fill-3 hover:text-1"
            >
              <AgentMark vendor={s.lead} size={10} label="" />
              <span className="min-w-0 flex-1 truncate">{s.title}</span>
              <Bar value={s.progress} vendor={s.lead} label={`${s.title} progress`} className="w-16" />
              <span className="w-[72px] shrink-0 text-right text-meta text-3 tabular-nums">
                {s.finishAt != null && s.status === 'running' ? clock12(s.finishAt) : s.statusText}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Disclosure>
  )
}

function HubCircle({ info, running, style }: { info: CoordinatorInfo | null; running: number; style?: CSSProperties }) {
  return (
    <div
      style={style}
      className="absolute flex items-center justify-center rounded-full border-2 border-coordinator bg-card text-center"
    >
      <span aria-hidden className="absolute inset-0 rounded-full bg-coordinator/12" />
      <div className="relative flex flex-col items-center gap-0.5 px-3">
        <span className="text-body font-semibold text-1">Coordinator</span>
        {info ? (
          <>
            <span className="flex items-center gap-1.5 text-meta text-claude">
              <AgentMark vendor="claude" size={10} label="" />
              {info.model}
            </span>
            <span className="text-meta text-3 tabular-nums">
              watching {info.watching} {info.watching === 1 ? 'session' : 'sessions'}
            </span>
            <span className="text-meta text-coordinator">last note {info.lastNote}</span>
          </>
        ) : (
          <>
            <span className="text-meta text-3">Not running yet</span>
            <span className="text-meta text-3 tabular-nums">
              would watch {running} {running === 1 ? 'session' : 'sessions'}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

function Legend({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1 text-meta text-3', className)}>
      <span className="mb-0.5">Dashed = sessions building on each other</span>
      {(
        [
          ['plan', 'plan', 'bg-[var(--text-2)]'],
          ['result', 'result', 'bg-success'],
          ['question', 'question', 'bg-danger'],
          ['note', 'coordinator note', 'bg-coordinator'],
        ] as const
      ).map(([k, label, dot]) => (
        <span key={k} className="flex items-center gap-1.5">
          <span aria-hidden className={cn('size-1.5 rounded-[1px]', dot)} />
          {label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="size-1.5 rounded-full bg-coordinator shadow-[0_0_0_3px_color-mix(in_srgb,var(--coordinator)_25%,transparent)]" />
        message in flight
      </span>
    </div>
  )
}

export interface HubProps {
  sessions: HubSession[]
  info: CoordinatorInfo | null
  sample: boolean
  /** Narrow screens: vertical list instead of the canvas. */
  list: boolean
}

/** The hub: coordinator in the centre, session cards around it, linked with hairlines. */
export function Hub({ sessions, info, sample, list }: HubProps) {
  const ref = useRef<HTMLDivElement>(null)
  const W = useElementWidth(ref)
  const shown = sessions.slice(0, MAX_SLOTS)
  const more = sessions.slice(MAX_SLOTS)
  const running = sessions.length

  if (list) {
    return (
      <div ref={ref} className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3 rounded-lg border border-coordinator/40 bg-card px-3 py-2">
          <span className="size-2 shrink-0 rounded-full bg-coordinator" aria-hidden />
          <span className="text-body font-semibold text-1">Coordinator</span>
          <span className="truncate text-caption text-3 tabular-nums">
            {info ? `${info.model} · watching ${info.watching} ${info.watching === 1 ? 'session' : 'sessions'}` : `Not running yet · would watch ${running}`}
          </span>
        </div>
        {sessions.map((s) => (
          <HubCard key={s.id} s={s} />
        ))}
      </div>
    )
  }

  const L = W > 0 ? layout(shown, W) : null
  const cx = W / 2
  const cy = L ? L.H / 2 : 0
  const curved = L?.mode === 'sides'
  // Legend (corners mode, sample): bottom-left of the canvas, above the bottom-left card.
  const placed: Box[] = []
  if (L && sample && L.mode === 'corners')
    placed.push({ x0: PAD - 4, x1: PAD + 154, y0: L.H - PAD - CARD_H - 12 - 124, y1: L.H - PAD - CARD_H - 8 })

  return (
    <div className="flex flex-col">
      {L && L.mode === 'sides' && sample && <Legend className="flex-row flex-wrap gap-x-4 px-4 pt-3" />}
      <div ref={ref} className="relative w-full" style={{ height: L ? L.H : 0 }}>
        {L && (
          <>
            <svg width={W} height={L.H} className="pointer-events-none absolute inset-0 overflow-visible fill-none" aria-hidden>
              {L.slots.map((p) => {
                const d = curved ? `M ${p.ax} ${p.ay} Q ${cx} ${p.ay} ${cx} ${cy}` : `M ${p.ax} ${p.ay} L ${cx} ${cy}`
                return <path key={p.s.id} d={d} strokeWidth={1.25} strokeLinecap="round" className="stroke-stroke-1" />
              })}
              {sample &&
                SAMPLE_BUILDS.map((b) => {
                  const A = L.slots.find((p) => p.s.id === b.a)
                  const B = L.slots.find((p) => p.s.id === b.b)
                  if (!A || !B || A.y !== B.y) return null
                  const left = A.x < B.x ? A : B
                  const right = A.x < B.x ? B : A
                  const x1 = left.x + left.w
                  const x2 = right.x
                  if (x2 - x1 < 60) return null
                  const y = left.y + CARD_H / 2
                  return <path key={b.a + b.b} d={`M ${x1} ${y} L ${x2} ${y}`} strokeWidth={1.25} strokeDasharray="4 4" className={KIND_STROKE[b.kind]} />
                })}
            </svg>

            <HubCircle
              info={info}
              running={running}
              style={{ left: cx - HUB / 2, top: cy - HUB / 2, width: HUB, height: HUB }}
            />

            {L.slots.map((p) => (
              <HubCard key={p.s.id} s={p.s} style={{ position: 'absolute', left: p.x, top: p.y, width: p.w, height: CARD_H }} />
            ))}

            {sample &&
              L.slots.flatMap((p) => {
                const a = { x: p.ax, y: p.ay }
                const c = { x: cx, y: cy }
                return SAMPLE_CHIPS.filter((ch) => ch.session === p.s.id).flatMap((ch, ci) => {
                  const t = ci === 0 ? 0.22 : 0.48
                  const { pt, side } = chipPoint(a, c, curved, t, p.side, `${ch.text} →`, placed)
                  // arrow shows the direction of travel: towards the session when toSession
                  const dir = ch.toSession ? arrow(c, a) : arrow(a, c)
                  const out = [
                    <span
                      key={p.s.id + ch.text}
                      style={{ left: pt.x + (side === 'l' ? -8 : 8), top: pt.y }}
                      className={cn(
                        'absolute -translate-y-1/2 rounded-full',
                        side === 'l' ? '-translate-x-full' : 'translate-x-0',
                        'rounded-full border bg-chrome px-2 py-0.5 text-meta whitespace-nowrap text-1',
                        KIND_BORDER[ch.kind],
                      )}
                    >
                      {dir} {ch.text}
                    </span>,
                  ]
                  if (ch.inFlight) {
                    const dot = pointAt(a, c, curved, ci === 0 ? 0.35 : 0.62)
                    out.push(
                      <span
                        key={p.s.id + ch.text + 'dot'}
                        aria-hidden
                        style={{ left: dot.x, top: dot.y }}
                        className={cn(
                          'absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_3px_color-mix(in_srgb,var(--text-1)_10%,transparent)]',
                          KIND_DOT[ch.kind],
                        )}
                      />,
                    )
                  }
                  return out
                })
              })}

            {sample &&
              SAMPLE_BUILDS.map((b) => {
                const A = L.slots.find((p) => p.s.id === b.a)
                const B = L.slots.find((p) => p.s.id === b.b)
                if (!A || !B || A.y !== B.y) return null
                const left = A.x < B.x ? A : B
                const right = A.x < B.x ? B : A
                const gap = right.x - (left.x + left.w)
                if (gap < 60) return null
                return (
                  <span
                    key={b.a + b.b}
                    style={{ left: left.x + left.w + gap / 2, top: left.y + CARD_H / 2, width: Math.min(96, gap - 8) }}
                    className={cn(
                      'absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-chrome px-1.5 py-1 text-center text-meta text-1',
                      KIND_BORDER[b.kind],
                    )}
                  >
                    {b.text}
                  </span>
                )
              })}

            {sample && L.mode === 'corners' && (
              <div style={{ left: PAD, bottom: PAD + CARD_H + 12 }} className="absolute w-[150px]">
                <Legend />
              </div>
            )}
          </>
        )}
      </div>
      {more.length > 0 && (
        <div className="px-4 pb-3">
          <MoreList sessions={more} label={`+${more.length} more ${more.length === 1 ? 'session' : 'sessions'}`} />
        </div>
      )}
    </div>
  )
}
