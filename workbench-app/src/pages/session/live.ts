import type { McAgent, McSession, TranscriptRow } from '../../data/types'
import { leadModelOf as sharedLeadModel } from '../../live/verdict'
import { agentName, buildAgentTree, modelLabel, vendorOfModel, type AgentNode } from '../../live/mission'
import type { Detail, GEdge, GNode, Msg, OutLine } from './data'
import { pctOf, planOf, plannedOf, type ActivityItem } from './plan'

const SLOT = 150
const MAX_PER_ROW = 8
const ROW_H = 150
const LEAD = 96
const RING = 64

export interface LiveGraph {
  nodes: GNode[]
  edges: GEdge[]
  canvas: { w: number; h: number }
}


/** The lead's model label, or "Model not reported". Never guessed from sub-agents (shared rule in live/verdict). */
export function leadModelLabel(s: McSession): string {
  const m = sharedLeadModel(s as McSession & { model?: string | null })
  return m ? modelLabel(m) : 'Model not reported'
}

/** Lead at top centre, the agent tree laid out level by level (wrapping at MAX_PER_ROW per row). */
export function liveGraph(s: McSession): LiveGraph {
  const roots = buildAgentTree(s.agents)
  // Flatten depth-first so siblings stay together, then group by depth.
  const byDepth = new Map<number, AgentNode[]>()
  const walk = (n: AgentNode) => {
    const list = byDepth.get(n.depth) ?? []
    list.push(n)
    byDepth.set(n.depth, list)
    n.children.forEach(walk)
  }
  roots.forEach(walk)
  const depths = [...byDepth.keys()].sort((a, b) => a - b)
  const lines: AgentNode[][] = []
  depths.forEach((d) => {
    const list = byDepth.get(d) ?? []
    for (let i = 0; i < list.length; i += MAX_PER_ROW) lines.push(list.slice(i, i + MAX_PER_ROW))
  })
  const widest = lines.reduce((m, l) => Math.max(m, l.length), 0)
  const w = Math.max(600, widest * SLOT)
  const h = 70 + Math.max(1, lines.length) * ROW_H + 40

  const parentOf = new Map<string, string>()
  const mark = (n: AgentNode, p: string) => {
    parentOf.set(n.agent.agent_id, p)
    n.children.forEach((c) => mark(c, n.agent.agent_id))
  }
  roots.forEach((r) => mark(r, 'lead'))

  const nodes: GNode[] = [
    { id: 'lead', name: 'Lead', vendor: 'claude', model: leadModelLabel(s), pct: pctOf(plannedOf(s)), ringText: pctOf(plannedOf(s)) === null ? '' : `${pctOf(plannedOf(s))}%`, ringFont: 18, kind: 'lead', x: w / 2 - LEAD / 2, y: 28, size: LEAD, label: 'inside', depth: 0, parent: null, pulse: s.status === 'running', eta: s.eta },
  ]
  const edges: GEdge[] = []
  lines.forEach((line, li) => {
    const cy = 70 + (li + 1) * ROW_H - 20
    line.forEach((n, i) => {
      const a = n.agent
      const vendor = vendorOfModel(a.model)
      const done = a.state === 'done'
      const cx = (w / line.length) * (i + 0.5)
      const parent = parentOf.get(a.agent_id) ?? 'lead'
      nodes.push({
        id: a.agent_id,
        name: agentName(a),
        vendor,
        model: modelLabel(a.model),
        pct: done ? 100 : pctOf(plannedOf(a)),
        ringText: done ? '✓' : pctOf(plannedOf(a)) === null ? '…' : `${pctOf(plannedOf(a))}%`,
        ringFont: done ? 18 : 14,
        kind: n.depth > 1 ? 'helper' : 'worker',
        x: cx - RING / 2,
        y: cy - RING / 2,
        size: RING,
        label: 'below',
        depth: n.depth,
        parent,
        pulse: !done,
        eta: done ? null : a.eta,
      })
      edges.push({ from: parent, to: a.agent_id, style: 'tree' })
    })
  })
  return { nodes, edges, canvas: { w, h } }
}

const lines = (t: string | null | undefined, tone: OutLine['tone'] = 'normal'): OutLine[] =>
  (t || '')
    .split(/\r?\n/)
    .slice(0, 60)
    .map((text) => ({ tone, text }))

export function liveDetails(s: McSession, now: number): Record<string, Detail> {
  const out: Record<string, Detail> = {}
  out.lead = {
    id: 'lead',
    name: 'Lead',
    vendor: 'claude',
    model: leadModelLabel(s),
    state: s.status,
    subtitle: 'reports to you · select another agent in the graph to switch',
    bigText: pctOf(plannedOf(s)) === null ? 'Not reported' : `${pctOf(plannedOf(s))}%`,
    progressNote: s.eta ? 'Whole turn, including its agents' : 'No progress or ETA in the hook events',
    eta: s.eta,
    updated: `${s.event_count} events · last ${s.last_event_t || '?'}`,
    pct: pctOf(plannedOf(s)),
    plan: planOf(plannedOf(s), now),
    planRight: plannedOf(s).todos?.length ? `${plannedOf(s).todos?.length} steps` : undefined,
    planEmpty: 'No plan reported',
    outputTitle: 'LAST REPLY',
    outputRight: s.current_tool ? `running ${s.current_tool}` : undefined,
    output: s.last_reply ? lines(s.last_reply) : [{ tone: 'muted', text: 'No reply yet' }],
  }
  s.agents.forEach((a) => {
    const vendor = vendorOfModel(a.model)
    const done = a.state === 'done'
    out[a.agent_id] = {
      id: a.agent_id,
      name: agentName(a),
      vendor,
      model: modelLabel(a.model),
      state: a.state,
      subtitle: `reports to ${a.parent_agent_id ? 'its parent agent' : 'Lead'} · select another agent in the graph to switch`,
      bigText: done ? '100%' : pctOf(plannedOf(a)) === null ? 'Running' : `${pctOf(plannedOf(a))}%`,
      eta: done ? null : a.eta,
      progressNote: `Started ${a.started_t || '?'}${a.stopped_t ? `, stopped ${a.stopped_t}` : ', not stopped yet'}`,
      updated: `${a.tool_count} tool calls · last tool ${a.last_tool || 'none'}`,
      pct: done ? 100 : pctOf(plannedOf(a)),
      plan: planOf(plannedOf(a), now),
      planRight: plannedOf(a).todos?.length ? `${plannedOf(a).todos?.length} steps` : undefined,
      planEmpty: 'No plan reported',
      outputTitle: 'RESULT',
      outputRight: done ? 'finished' : 'still working',
      output: a.result ? lines(a.result) : [{ tone: 'muted', text: done ? 'No result text' : 'No result yet' }],
    }
  })
  return out
}

const clip = (t: string, n = 200) => {
  const x = t.trim().replace(/\s+/g, ' ')
  return x.length > n ? x.slice(0, n - 1) + '…' : x
}

export function liveMessages(s: McSession): Msg[] {
  const msgs: Msg[] = []
  const byId = new Map(s.agents.map((a) => [a.agent_id, a]))
  s.agents.forEach((a: McAgent) => {
    const name = agentName(a)
    const parent = a.parent_agent_id ? byId.get(a.parent_agent_id) : undefined
    const pid = parent ? parent.agent_id : 'lead'
    const pname = parent ? agentName(parent) : 'Lead'
    if (a.started_t) msgs.push({ time: a.started_t, from: pid, to: a.agent_id, route: `${pname} → ${name}`, type: 'task', text: clip(a.description || a.agent_type || 'Task started') })
    if (a.stopped_t) msgs.push({ time: a.stopped_t, from: a.agent_id, to: pid, route: `${name} → ${pname}`, type: 'result', text: clip(a.result || 'Finished with no result text') })
  })
  return msgs.sort((x, y) => y.time.localeCompare(x.time))
}

const toolRow = (it: ActivityItem): TranscriptRow => ({
  kind: 'tool',
  name: it.tool,
  input: [it.summary || it.tool],
  dot: it.state === 'running' ? 'running' : it.state === 'error' ? 'error' : 'ok',
  output: it.output ? [{ text: it.output.trimEnd(), tone: it.state === 'error' ? 'error' : 'normal' }] : undefined,
})

/** The conversation: last prompt, the lead's recent tool calls (activity feed), its sub-agent handoffs, then its last reply. */
export function liveRows(s: McSession, activity: ActivityItem[] | null): TranscriptRow[] {
  const rows: TranscriptRow[] = []
  if (s.last_prompt) rows.push({ kind: 'user', time: s.turn_started ? new Date(s.turn_started * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : s.last_event_t || '', text: s.last_prompt })
  if (activity && activity.length) activity.forEach((it) => rows.push(toolRow(it)))
  else if (s.current_tool) rows.push({ kind: 'tool', name: s.current_tool, input: [`${s.current_tool} is running`], dot: 'running' })
  const seen = new Set<string>()
  const norm = (t: string | undefined | null) => (t || '').trim().replace(/\s+/g, ' ').toLowerCase()
  ;(activity ?? []).forEach((it) => {
    if (it.tool !== 'Agent' && it.tool !== 'Task') return
    if (it.tool_use_id) seen.add(it.tool_use_id)
    if (it.summary) seen.add(norm(it.summary))
  })
  s.agents.forEach((a) => {
    const d = norm(a.description)
    const aid = (a as McAgent & { tool_use_id?: string }).tool_use_id
    if ((aid && seen.has(aid)) || (d && seen.has(d))) return
    const done = a.state === 'done'
    rows.push({
      kind: 'tool',
      eta: done ? null : a.eta,
      name: 'SubagentHandoff',
      detail: `to ${agentName(a)}`,
      dot: done ? 'ok' : 'running',
      input: [a.description || a.agent_type || 'Subagent task'],
      output: [{ text: a.result ? clip(a.result, 300) : a.state, tone: a.result ? 'normal' : 'muted' }],
    })
  })
  if (s.last_reply) rows.push({ kind: 'text', text: s.last_reply })
  if (!rows.length) rows.push({ kind: 'text', text: 'No conversation events yet' })
  return rows
}
