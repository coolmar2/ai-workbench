import { useEffect, useRef } from 'react'
import { useMissionFeed, vendorOfModel } from '../../../live/mission'
import { clearBadge, startPlayback } from './engine'
import { simEnabled, simPost, simulate } from './simulate'
import './playback.css'

/** Mounted once by the Editor page: runs the /edits poller and the playback engine while the page is open. */
export function PlaybackHost({ roots, activeRoot }: { roots: string[]; activeRoot: string | null }) {
  const feed = useMissionFeed()
  const live = useRef({ roots, activeRoot, state: feed.state })
  useEffect(() => {
    live.current = { roots, activeRoot, state: feed.state }
  })

  useEffect(
    () =>
      startPlayback({
        roots: () => live.current.roots,
        activeRoot: () => live.current.activeRoot,
        session: (id) => {
          const s = live.current.state?.sessions.find((x) => x.session_id === id)
          return s ? { status: s.status, events: s.event_count } : null
        },
        vendorOf: (ev) => {
          const s = live.current.state?.sessions.find((x) => x.session_id === ev.session_id)
          const ag = ev.agent_id ? s?.agents.find((a) => a.agent_id === ev.agent_id) : null
          return ag ? vendorOfModel(ag.model) : 'claude'
        },
      }),
    [],
  )

  useEffect(() => {
    if (activeRoot) clearBadge(activeRoot)
  }, [activeRoot])

  useEffect(() => {
    if (!simEnabled) return
    window.__wbSim = { run: (k) => simulate(k), post: () => simPost() }
    return () => {
      delete window.__wbSim
    }
  }, [])

  return null
}
