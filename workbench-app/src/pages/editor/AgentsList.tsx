import { Fragment } from 'react'
import type { McAgent } from '../../data/types'
import { AgentMark, Eta, cn } from '../../components/ui'
import { useIdentity } from '../../context/identity'
import { sessionTitle, vendorOfModel, isRunning } from '../../live/mission'
import { agentLabel, useWsAgents } from './api'
import { workersPersonal, workersWork } from './data'

const stateOf = (s: string) => (s === 'running' ? 'running' : s === 'error' ? 'error' : 'done')

function Row({ depth, vendor, label, state, tool, eta, compact }: { depth: 0 | 1; vendor: 'claude' | 'codex' | 'gemini'; label: string; state: string; tool?: string | null; eta?: McAgent['eta']; compact?: boolean }) {
  return (
    <div className="vsc-agent" data-depth={depth} role="row">
      <span aria-hidden>
        <AgentMark vendor={vendor} activity={state === 'running' ? 'editing' : undefined} label="" />
      </span>
      <span style={{ color: depth === 0 ? '#e7e7e7' : undefined }}>{label}</span>
      {!compact && <span className="vsc-state" data-s={stateOf(state)}>{state}</span>}
      {!compact && <span className="vsc-mono vsc-prow-dim">{tool ?? ''}</span>}
      <span className="vsc-eta">{state === 'running' ? (eta ? <Eta eta={eta} /> : <span>eta pending</span>) : null}</span>
      {compact && (
        <span className="vsc-agent-sub">
          {state}
          {tool ? ` · ${tool}` : ''}
        </span>
      )}
    </div>
  )
}

/** Live agents of one workspace (sessions with their sub-agents) from /api/mc/state. `compact` is the narrow side bar variant. */
export function AgentsList({ root, sample, compact }: { root: string; sample: boolean; compact?: boolean }) {
  const { agents, live } = useWsAgents(root)
  const { isWork } = useIdentity()

  if (sample) {
    const w = isWork ? workersWork : workersPersonal
    return (
      <div role="table" aria-label="Agents" className={cn(compact && 'vsc-compact')}>
        {w.map((x) => (
          <Row key={x.role} depth={0} vendor={x.vendor} label={x.role} state={x.status} tool={x.lines[0]?.t.replace(/^[>$]\s*/, '')} eta={null} compact={compact} />
        ))}
      </div>
    )
  }
  if (!live && agents.sessions.length === 0) return <div className="vsc-empty">The agent feed is offline, so running agents are not shown.</div>
  if (agents.sessions.length === 0) return <div className="vsc-empty">No sessions have run in this workspace.</div>

  return (
    <div role="table" aria-label="Agents" className={cn(compact && 'vsc-compact')}>
      {agents.sessions.map((s) => {
        const sorted = [...s.agents].sort((a, b) => Number(b.state === 'running') - Number(a.state === 'running')).slice(0, 40)
        return (
          <Fragment key={s.session_id}>
            <Row depth={0} vendor="claude" label={sessionTitle(s)} state={isRunning(s) ? 'running' : s.status} tool={s.current_tool} eta={s.eta} compact={compact} />
            {sorted.map((a) => (
              <Row key={a.agent_id} depth={1} vendor={vendorOfModel(a.model)} label={agentLabel(a)} state={a.state} tool={a.last_tool} eta={a.eta} compact={compact} />
            ))}
          </Fragment>
        )
      })}
    </div>
  )
}
