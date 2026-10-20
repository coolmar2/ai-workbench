import type { ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import type { McEta, Vendor } from '../../data/types'
import { Eta } from './Eta'
import { AgentMark } from './AgentMark'
import { Button } from './Button'
import { Disclosure } from './Controls'
import { Markdown } from './Markdown'
import { StatusDot } from './StatusDot'
import type { Status } from './status'
import { cn } from './cn'

export type ToolDot = 'muted' | 'ok' | 'running' | 'error'
export interface ToolOutput {
  text: string
  tone?: 'normal' | 'error' | 'muted' | 'ok'
}

const DOT: Record<ToolDot, Status> = { muted: 'idle', ok: 'done', running: 'running', error: 'error' }
const TONE = { normal: 'text-2', error: 'text-danger', muted: 'text-3', ok: 'text-success' } as const

function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('font-mono text-code break-words whitespace-pre-wrap', className)}>{children}</div>
}

/** The user's message: full-width tinted block (fill-3 + hairline), time below in meta text-3. */
export function TranscriptUserBlock({ text, time, className }: { text: string; time?: string; className?: string }) {
  return (
    <div className={cn('animate-fade-in rounded-lg border border-stroke-3 bg-fill-3 px-3 py-2', className)}>
      <p className="text-body whitespace-pre-wrap text-1">{text}</p>
      {time && <div className="mt-1 text-meta text-3 tabular-nums">{time}</div>}
    </div>
  )
}

/** Plain assistant text rendered as markdown. */
export function TranscriptAssistantText({ text, className }: { text: string; className?: string }) {
  return <Markdown className={cn('animate-fade-in px-1', className)}>{text}</Markdown>
}

/** Collapsible "Thinking" row. Without text it is a static, non-expandable label. */
export function TranscriptThinkingRow({ text, className }: { text?: string; className?: string }) {
  return text ? (
    <Disclosure className={cn('px-1', className)} summary={<span className="italic">Thinking</span>}>
      <p className="py-1 text-meta whitespace-pre-wrap text-3">{text}</p>
    </Disclosure>
  ) : (
    <div className={cn('flex min-h-5 items-center px-1 pl-5 text-meta text-3 italic', className)}>Thinking</div>
  )
}

export interface TranscriptToolRowProps {
  name: string
  /** Grey suffix after the name. */
  detail?: string
  /** Input lines; the first is previewed in the summary. */
  input: string[]
  output?: ToolOutput[]
  dot?: ToolDot
  className?: string
  /** Extra content inside the expanded body (e.g. a button). */
  children?: ReactNode
  /** Replaces the status dot in the summary (used by the handoff row). */
  lead?: ReactNode
  /** Right-aligned summary extra (e.g. an Eta pill). */
  trailing?: ReactNode
}

/** 11px Disclosure tool row; caret only on hover. Collapsed by default. */
export function TranscriptToolRow({ name, detail, input, output, dot, className, children, lead, trailing }: TranscriptToolRowProps) {
  return (
    <Disclosure
      className={cn('animate-fade-in px-1', className)}
      summary={
        <>
          {lead ?? (dot && <StatusDot status={DOT[dot]} decorative />)}
          <span className="shrink-0 font-medium text-2">{name}</span>
          {detail && <span className="shrink-0 text-3">{detail}</span>}
          <span className="min-w-0 flex-1 truncate font-mono text-3">{input[0] ?? ''}</span>
          {trailing}
        </>
      }
    >
      <div className="flex flex-col gap-1.5 py-1.5">
        <Mono className="text-2">{input.join('\n')}</Mono>
        {output?.map((o, i) => (
          <Mono key={i} className={TONE[o.tone ?? 'normal']}>
            {o.text}
          </Mono>
        ))}
        {children}
      </div>
    </Disclosure>
  )
}

export interface TranscriptHandoffRowProps {
  /** Receiving agent's display name. */
  target?: string
  vendor?: Vendor
  input: string[]
  output?: ToolOutput[]
  onOpenAgent?: (agentName: string) => void
  /** Running sub-agent's estimate; shown as a pill. */
  eta?: McEta | null
  className?: string
}

/** Sub-agent handoff: indented under a hairline, with the receiving agent's mark. */
export function TranscriptHandoffRow({ target, vendor = 'claude', input, output, onOpenAgent, eta, className }: TranscriptHandoffRowProps) {
  return (
    <TranscriptToolRow
      className={cn('ml-4 border-l border-stroke-3 pl-2', className)}
      lead={<AgentMark vendor={vendor} size={10} />}
      name="Handoff"
      trailing={eta ? <Eta eta={eta} variant="pill" /> : undefined}
      detail={target ? `to ${target}` : undefined}
      input={input}
      output={output}
    >
      {target && onOpenAgent && (
        <div>
          <Button variant="ghost" size="sm" icon={<ArrowUpRight />} onClick={() => onOpenAgent(target)}>
            View {target}
          </Button>
        </div>
      )}
    </TranscriptToolRow>
  )
}
