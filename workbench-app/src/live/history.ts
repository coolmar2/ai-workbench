import { useEffect, useState } from 'react'
import type { TranscriptRow } from '../data/types'

/**
 * Full conversation of a session from its Claude Code transcript (wb_mc GET /transcript, read-only, this
 * computer only). Used for imported (past) sessions, which have no live hook data. Re-polls every 15 s in
 * case the session is still being written somewhere else (e.g. open in the Claude desktop app).
 */
export interface TranscriptState {
  rows: TranscriptRow[]
  /** Rows in the whole conversation; `rows` holds the last 400. */
  total: number
  loading: boolean
  error: string | null
}

const POLL_MS = 15_000

export function useTranscript(sessionId: string | null): TranscriptState {
  const [st, setSt] = useState<TranscriptState>({ rows: [], total: 0, loading: !!sessionId, error: null })

  useEffect(() => {
    if (!sessionId) return
    let alive = true
    setSt({ rows: [], total: 0, loading: true, error: null })
    const load = async () => {
      try {
        const r = await fetch(`/api/mc/transcript?session=${encodeURIComponent(sessionId)}`, { headers: { Accept: 'application/json' } })
        const j = (await r.json().catch(() => null)) as { rows?: TranscriptRow[]; total?: number; error?: string } | null
        if (!alive) return
        if (!r.ok || !j) setSt((s) => ({ ...s, loading: false, error: j?.error ?? `HTTP ${r.status}` }))
        else setSt({ rows: j.rows ?? [], total: j.total ?? 0, loading: false, error: null })
      } catch (e) {
        if (alive) setSt((s) => ({ ...s, loading: false, error: (e as Error).message }))
      }
    }
    void load()
    const t = setInterval(load, POLL_MS)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [sessionId])

  return sessionId ? st : { rows: [], total: 0, loading: false, error: null }
}
