import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { resizeTerm, sendRaw } from '../../live/actions'
import { cn } from '../ui'

type Status = 'connecting' | 'live' | 'ended' | 'error'

/**
 * The real terminal of a running session: output streams from wb_mc GET /term (SSE through the Vite proxy),
 * keystrokes and resizes go back through POST /send. Typing here is the same as typing in its console window.
 */
export function LiveTerminal({ port, className }: { port: number; className?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>('connecting')

  useEffect(() => {
    const el = host.current
    if (!el) return
    const term = new Terminal({
      cursorBlink: true,
      convertEol: false,
      fontFamily: 'Cascadia Mono, Consolas, monospace',
      fontSize: 13,
      scrollback: 5000,
      theme: { background: '#0f1115', foreground: '#e4e6eb' },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(el)

    // Keystrokes in order: one request at a time, batched while one is in flight.
    let pending = ''
    let busy = false
    const flush = async () => {
      if (busy || !pending) return
      busy = true
      while (pending) {
        const chunk = pending.slice(0, 4096)
        pending = pending.slice(chunk.length)
        await sendRaw(port, chunk)
      }
      busy = false
    }
    const typed = term.onData((d) => {
      pending += d
      void flush()
    })

    let rt: ReturnType<typeof setTimeout> | undefined
    const doFit = () => {
      try {
        fit.fit()
      } catch {
        return // not laid out yet
      }
      clearTimeout(rt)
      rt = setTimeout(() => void resizeTerm(port, term.cols, term.rows), 150)
    }
    const ro = new ResizeObserver(doFit)
    ro.observe(el)
    doFit()

    const es = new EventSource(`/api/mc/term?port=${port}`)
    es.onopen = () => setStatus('live')
    es.onmessage = (e) => {
      try {
        term.write(JSON.parse(e.data) as string)
      } catch {
        /* keep-alive or malformed chunk */
      }
    }
    es.addEventListener('end', () => {
      setStatus('ended')
      es.close()
    })
    es.onerror = () => {
      // EventSource retries by itself; show it while it does.
      setStatus((s) => (s === 'ended' ? s : 'error'))
    }
    term.focus()

    return () => {
      es.close()
      ro.disconnect()
      clearTimeout(rt)
      typed.dispose()
      term.dispose()
    }
  }, [port])

  return (
    <div className={cn('relative flex min-h-0 flex-col bg-[#0f1115]', className)}>
      {status !== 'live' && (
        <div className="absolute top-2 right-3 z-10 rounded-sm bg-fill-2 px-2 py-0.5 text-meta text-3">
          {status === 'connecting' ? 'Connecting…' : status === 'ended' ? 'Session ended' : 'Reconnecting…'}
        </div>
      )}
      <div ref={host} className="min-h-0 flex-1 p-2" />
    </div>
  )
}
