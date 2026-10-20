import { Fragment, type ReactNode } from 'react'
import { cn } from './cn'

/* Tiny safe markdown: paragraphs, **bold**, *italic*, `code`, fenced blocks, - / 1. lists, links, headings.
   Everything is built as React nodes (no dangerouslySetInnerHTML); only http(s)/mailto links are linked. */

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*)|(\*[^*\s][^*\n]*?\*)|(\[[^\]\n]+\]\([^()\s]*(?:\([^()\s]*\)[^()\s]*)*\))|(https?:\/\/[^\s<>)]+)/g

function safeHref(u: string): string | null {
  return /^(https?:|mailto:)/i.test(u) ? u : null
}

function renderInline(text: string, keyBase = 'i'): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let n = 0
  for (const m of text.matchAll(INLINE)) {
    const idx = m.index ?? 0
    if (idx > last) out.push(text.slice(last, idx))
    const k = `${keyBase}${n++}`
    const tok = m[0]
    if (m[1]) {
      out.push(
        <code key={k} className="rounded-sm bg-fill-3 px-1 py-px font-mono text-code break-words">
          {tok.slice(1, -1)}
        </code>,
      )
    } else if (m[2]) {
      out.push(
        <strong key={k} className="font-semibold">
          {renderInline(tok.slice(2, -2), k)}
        </strong>,
      )
    } else if (m[3]) {
      out.push(<em key={k}>{renderInline(tok.slice(1, -1), k)}</em>)
    } else if (m[4]) {
      const mm = /^\[([^\]]+)\]\((.+)\)$/.exec(tok)!
      const href = safeHref(mm[2])
      out.push(href ? <MdLink key={k} href={href}>{mm[1]}</MdLink> : <Fragment key={k}>{mm[1]}</Fragment>)
    } else {
      const trail = /[.,;:!?]+$/.exec(tok)?.[0] ?? ''
      const url = trail ? tok.slice(0, -trail.length) : tok
      out.push(<MdLink key={k} href={url}>{url}</MdLink>)
      if (trail) out.push(trail)
    }
    last = idx + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function MdLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-accent underline-offset-2 hover:underline">
      {children}
    </a>
  )
}

type Block =
  | { t: 'p'; text: string }
  | { t: 'h'; text: string }
  | { t: 'code'; text: string; lang: string }
  | { t: 'ul' | 'ol'; items: string[] }

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) blocks.push({ t: 'p', text: para.join('\n') })
    para = []
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fence = /^\s*```(.*)$/.exec(line)
    if (fence) {
      flush()
      const buf: string[] = []
      i++
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) buf.push(lines[i++])
      blocks.push({ t: 'code', text: buf.join('\n'), lang: fence[1].trim() })
      continue
    }
    if (!line.trim()) {
      flush()
      continue
    }
    const h = /^#{1,6}\s+(.*)$/.exec(line)
    if (h) {
      flush()
      blocks.push({ t: 'h', text: h[1] })
      continue
    }
    const li = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(line)
    if (li) {
      flush()
      const kind = /\d/.test(li[1]) ? 'ol' : 'ul'
      const last = blocks[blocks.length - 1]
      if (last && last.t === kind) last.items.push(li[2])
      else blocks.push({ t: kind, items: [li[2]] })
      continue
    }
    para.push(line)
  }
  flush()
  return blocks
}

export interface MarkdownProps {
  children: string
  className?: string
}

/** Safe markdown for assistant text. Body 13px; headings are semibold body size. */
export function Markdown({ children, className }: MarkdownProps) {
  const blocks = parseBlocks(children)
  return (
    <div className={cn('flex min-w-0 flex-col gap-2 text-body text-1 break-words', className)}>
      {blocks.map((b, i) => {
        const k = `b${i}`
        switch (b.t) {
          case 'p':
            return (
              <p key={k} className="whitespace-pre-wrap">
                {renderInline(b.text, k)}
              </p>
            )
          case 'h':
            return (
              <p key={k} className="font-semibold">
                {renderInline(b.text, k)}
              </p>
            )
          case 'code':
            return (
              <pre key={k} className="overflow-x-auto rounded-md border border-stroke-3 bg-card px-3 py-2 font-mono text-code text-2">
                <code>{b.text}</code>
              </pre>
            )
          case 'ul':
          case 'ol': {
            const L = b.t
            return (
              <L key={k} className={cn('flex flex-col gap-1 pl-5', L === 'ul' ? 'list-disc' : 'list-decimal')}>
                {b.items.map((it, j) => (
                  <li key={j} className="pl-0.5 marker:text-3">
                    {renderInline(it, `${k}-${j}`)}
                  </li>
                ))}
              </L>
            )
          }
        }
      })}
    </div>
  )
}
