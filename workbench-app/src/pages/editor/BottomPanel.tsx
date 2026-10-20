import { useEffect, useRef } from 'react'
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
        {tab === 'terminal' && (
          <div className="vsc-term">
            <div style={{ color: '#9d9d9d' }}>The terminal is not available in this read-only editor. Commands agents run appear under Agents.</div>
            <div>
              <span style={{ color: '#2ea043' }}>{ws.name}</span> $ <span style={{ background: '#aeafad', color: 'transparent' }}>_</span>
            </div>
          </div>
        )}
        {tab === 'agents' && <AgentsList root={ws.root} sample={sample} />}
        {tab === 'edits' && <AgentEditsView root={ws.root} />}
      </div>
    </div>
  )
}
