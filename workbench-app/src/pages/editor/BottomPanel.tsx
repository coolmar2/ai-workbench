import { useEffect, useRef, useState } from 'react'
import { LiveTerminal } from '../../components/terminal/LiveTerminal'
import { useStartSession } from '../../components/shell/StartSession'
import { sessionTitle } from '../../live/mission'
import { useWsAgents, useOutputLog } from './api'
import { AgentsList } from './AgentsList'
import { Codicon, IconBtn } from './chrome'
import { AgentEditsView } from './playback/AgentEditsView'
import { useActivity } from './playback/engine'
import { sampleProblemList } from './sampleFs'
import { problemCount } from './problems'
import { setPanelTab, type PanelTab, type WsMeta } from './store'

const TABS: { id: PanelTab; label: string }[] = [
  { id: 'problems', label: 'Problems' },
  { id: 'output', label: 'Output' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'agents', label: 'Agents' },
  { id: 'edits', label: 'Agent Edits' },
]

const SEV = {
  e: { icon: 'error', color: '#f85149' },
  w: { icon: 'warning', color: '#cca700' },
  i: { icon: 'info', color: '#3794ff' },
} as const

function OutputView() {
  const lines = useOutputLog()
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [lines.length])
  return (
    <div className="vsc-term">
      {lines.length === 0 ? <span style={{ color: '#9d9d9d' }}>No output yet.</span> : lines.map((l, i) => <div key={i}>{l}</div>)}
      <div ref={end} />
    </div>
  )
}

/** Terminal tab: the real terminal of a running session of this workspace. */
function TerminalView({ root, name }: { root: string; name: string }) {
  const { agents } = useWsAgents(root)
  const { open } = useStartSession()
  const [pick, setPick] = useState<string | null>(null)
  const list = agents.sessions.filter((s) => s.online && s.port != null)
  const cur = list.find((s) => s.session_id === pick) ?? list[0]
  if (!cur || cur.port == null) {
    return (
      <div className="vsc-empty">
        <div>No running session in this folder</div>
        <button type="button" className="vsc-btn" style={{ marginTop: 8 }} onClick={() => open(root)}>Start a session</button>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }} aria-label={`Terminal of ${name}`}>
      {list.length > 1 && (
        <select aria-label="Session" value={cur.session_id} onChange={(e) => setPick(e.target.value)} style={{ alignSelf: 'flex-start', margin: '2px 8px' }}>
          {list.map((s) => <option key={s.session_id} value={s.session_id}>{sessionTitle(s)}</option>)}
        </select>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <LiveTerminal key={cur.port} port={cur.port} />
      </div>
    </div>
  )
}

/** Bottom panel: PROBLEMS · OUTPUT · TERMINAL · AGENTS. */
export function BottomPanel({ ws, tab, sample, onClose }: { ws: WsMeta; tab: PanelTab; sample: boolean; onClose: () => void }) {
  const { agents } = useWsAgents(ws.root)
  const counts = problemCount(sample, ws.root)
  const agentCount = sample ? 2 : agents.running
  const pending = useActivity().filter((i) => i.phase === 'pending' && i.root === ws.root).length
  const badge: Partial<Record<PanelTab, number>> = { problems: counts.total, agents: agentCount, edits: pending }

  return (
    <div className="vsc-panel" style={{ flex: 1, minHeight: 0 }} aria-label="Panel">
      <div className="vsc-panel-head">
        <div className="vsc-ptabs vsc-noscroll" role="tablist" aria-label="Panel views">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" className="vsc-ptab" aria-selected={tab === t.id} onClick={() => setPanelTab(ws.root, t.id)}>
              {t.label}
              {!!badge[t.id] && <span className="vsc-pcount">{badge[t.id]}</span>}
            </button>
          ))}
        </div>
        <IconBtn icon="close" label="Close Panel" shortcut="Ctrl J" onClick={onClose} />
      </div>
      <div className="vsc-pbody" role="tabpanel">
        {tab === 'problems' &&
          (counts.total === 0 ? (
            <div className="vsc-empty">No problems have been detected in the workspace.</div>
          ) : (
            sampleProblemList.map((p, i) => (
              <div key={i} className="vsc-prow">
                <Codicon name={SEV[p.sev].icon} style={{ color: SEV[p.sev].color }} />
                <span>{p.msg}</span>
                <span className="vsc-prow-dim">{p.src}</span>
                <span className="vsc-prow-dim vsc-mono">{p.where}</span>
              </div>
            ))
          ))}
        {tab === 'output' && <OutputView />}
        {tab === 'terminal' &&
          (sample ? (
            <div className="vsc-term">
              <div style={{ color: '#9d9d9d' }}>The terminal is not available in sample workspaces. Open a real folder to use it.</div>
              <div>
                <span style={{ color: '#2ea043' }}>{ws.name}</span> $ <span style={{ background: '#aeafad', color: 'transparent' }}>_</span>
              </div>
            </div>
          ) : (
            <TerminalView root={ws.root} name={ws.name} />
          ))}
        {tab === 'agents' && <AgentsList root={ws.root} sample={sample} />}
        {tab === 'edits' && <AgentEditsView root={ws.root} />}
      </div>
    </div>
  )
}
