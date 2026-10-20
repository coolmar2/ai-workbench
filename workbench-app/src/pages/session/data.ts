import type { AgentMessage, McEta, TranscriptRow, Vendor } from '../../data/types'

// ---------- view-model shared by sample and live mode ----------

export interface GNode {
  id: string
  name: string
  vendor: Vendor
  /** Model text as shown for Personal; Work uses workModel when set. */
  model: string
  workModel?: string
  /** 0..100, or null when the node has no progress (coordinator, live running). */
  pct: number | null
  /** Text inside the ring. */
  ringText: string
  ringFont?: number
  kind: 'lead' | 'coord' | 'outside' | 'worker' | 'helper'
  /** Ring top-left and size on the canvas. */
  x: number
  y: number
  size: number
  label: 'inside' | 'right' | 'below'
  /** Indent level for the phone list. */
  depth: number
  parent: string | null
  pulse?: boolean
  dashed?: string
  ringBg?: string
  /** Live estimate for this agent (or the whole turn for the lead). */
  eta?: McEta | null
}

export interface GEdge {
  from: string
  to: string
  style: 'tree' | 'coord' | 'outside'
}
export interface GChip {
  x: number
  y: number
  text: string
  type: AgentMessage['type']
}
export interface GDot {
  x: number
  y: number
  type: AgentMessage['type']
}

export interface PlanStep {
  state: 'done' | 'now' | 'todo'
  text: string
  time: string
}
export interface OutLine {
  tone: 'normal' | 'ok' | 'error' | 'muted' | 'coord' | 'running'
  text: string
}

export interface Detail {
  id: string
  name: string
  vendor: Vendor
  model: string
  workModel?: string
  state: string
  subtitle: string
  /** Big figure on the progress row ("62%"), or a text like "Not reported". */
  bigText: string
  progressNote: string
  updated: string
  pct: number | null
  plan: PlanStep[] | null
  planEmpty?: string
  planRight?: string
  outputTitle: string
  outputRight?: string
  output: OutLine[]
  /** Live estimate; the panel shows the detail variant when present. */
  eta?: McEta | null
}

export interface Msg {
  time: string
  from: string
  to: string
  route: string
  type: AgentMessage['type']
  text: string
}

export interface SampleSession {
  id: string
  name: string
  title: string
  leadModel: string
  pct: number
  stepLabel: string
  stepText: string
  finish: string
  finishIn: string
  finishRange: string
  verdict: string
  verdictNote: string
  history: string
  elapsed: string
}

// ---------- sample graph (Session.dc.html) ----------

const N = (n: Omit<GNode, 'depth' | 'parent'> & { depth?: number; parent?: string | null }): GNode => ({ depth: 0, parent: null, ...n })

export const SAMPLE_NODES: GNode[] = [
  N({ id: 'lead', name: 'Lead', vendor: 'claude', model: 'Opus 5.5', pct: 68, ringText: '68%', kind: 'lead', x: 395, y: 12, size: 100, label: 'inside' }),
  N({ id: 'coordinator', name: 'Orbit coordinator', vendor: 'claude', model: 'Haiku 5.5', pct: null, ringText: 'Coord', ringFont: 11, kind: 'coord', x: 78, y: 30, size: 64, label: 'below', depth: 1, parent: 'lead', dashed: 'var(--coord)', ringBg: 'var(--ss-coord-bg)' }),
  N({ id: 'links-rule', name: 'Links no-replace', vendor: 'claude', model: 'Sonnet 5.5', pct: null, ringText: 'Links', ringFont: 11, kind: 'outside', x: 868, y: 30, size: 64, label: 'below', depth: 1, parent: 'lead', dashed: 'var(--claude)' }),
  N({ id: 'test-runner', name: 'test-runner', vendor: 'claude', model: 'Sonnet 5.5', pct: 100, ringText: '✓', ringFont: 18, kind: 'worker', x: 62, y: 212, size: 76, label: 'right', depth: 1, parent: 'lead' }),
  N({ id: 'link-batch-fix', name: 'link-batch-fix', vendor: 'codex', model: '5-codex', workModel: 'Sonnet 5.5', pct: 62, ringText: '62%', ringFont: 15, kind: 'worker', x: 292, y: 212, size: 76, label: 'right', depth: 1, parent: 'lead' }),
  N({ id: 'rsync-depth-audit', name: 'rsync-depth-audit', vendor: 'gemini', model: '2.5 Pro', workModel: 'Haiku 5.5', pct: 45, ringText: '45%', ringFont: 15, kind: 'worker', x: 522, y: 212, size: 76, label: 'right', depth: 1, parent: 'lead' }),
  N({ id: 'guard-review', name: 'guard-review', vendor: 'claude', model: 'Opus 5.5', pct: 0, ringText: 'wait', ringFont: 12, kind: 'worker', x: 752, y: 212, size: 76, label: 'right', depth: 1, parent: 'lead' }),
  N({ id: 'test-writer', name: 'test-writer', vendor: 'codex', model: '5-codex', workModel: 'Sonnet 5.5', pct: 30, ringText: '30%', ringFont: 12, kind: 'helper', x: 220, y: 362, size: 60, label: 'below', depth: 2, parent: 'link-batch-fix' }),
  N({ id: 'caller-map', name: 'caller-map', vendor: 'claude', model: 'Haiku 5.5', pct: 100, ringText: '✓', ringFont: 15, kind: 'helper', x: 380, y: 362, size: 60, label: 'below', depth: 2, parent: 'link-batch-fix' }),
  N({ id: 'file-reader', name: 'file-reader', vendor: 'gemini', model: '2.5 Pro', workModel: 'Haiku 5.5', pct: 70, ringText: '70%', ringFont: 12, kind: 'helper', x: 530, y: 362, size: 60, label: 'below', depth: 2, parent: 'rsync-depth-audit' }),
]

export const SAMPLE_EDGES: GEdge[] = [
  { from: 'lead', to: 'coordinator', style: 'coord' },
  { from: 'lead', to: 'links-rule', style: 'outside' },
  { from: 'lead', to: 'test-runner', style: 'tree' },
  { from: 'lead', to: 'link-batch-fix', style: 'tree' },
  { from: 'lead', to: 'rsync-depth-audit', style: 'tree' },
  { from: 'lead', to: 'guard-review', style: 'tree' },
  { from: 'link-batch-fix', to: 'test-writer', style: 'tree' },
  { from: 'link-batch-fix', to: 'caller-map', style: 'tree' },
  { from: 'rsync-depth-audit', to: 'file-reader', style: 'tree' },
]

export const SAMPLE_CHIPS: GChip[] = [
  { x: 268, y: 34, text: '→ overlap: clouddrive_sync.py', type: 'note' },
  { x: 268, y: 90, text: '← ack: building on Links rule', type: 'result' },
  { x: 700, y: 34, text: '← result: no-replace rule', type: 'result' },
  { x: 700, y: 90, text: '→ same signature?', type: 'question' },
  { x: 255, y: 165, text: '↗ result: tests passed', type: 'result' },
  { x: 404, y: 130, text: '↗ rename message?', type: 'question' },
  { x: 509, y: 167, text: '↖ 2 call sites found', type: 'result' },
  { x: 652, y: 175, text: '↘ wait for verdict', type: 'task' },
  { x: 280, y: 338, text: '↙ refusal-case test', type: 'task' },
  { x: 360, y: 304, text: '↖ 4 callers found', type: 'result' },
  { x: 560, y: 321, text: '↓ read importer-viewer', type: 'task' },
]
export const SAMPLE_DOTS: GDot[] = [
  { x: 349, y: 62, type: 'note' },
  { x: 562, y: 62, type: 'result' },
  { x: 410, y: 118, type: 'question' },
  { x: 480, y: 118, type: 'result' },
]
export const SAMPLE_CANVAS = { w: 1020, h: 470 }

// ---------- sample details per node ----------

const P = (state: PlanStep['state'], text: string, time: string): PlanStep => ({ state, text, time })
const O = (tone: OutLine['tone'], text: string): OutLine => ({ tone, text })

const LEAD_PLAN = [
  P('done', 'Read link_batch and its callers', '3 min'),
  P('done', 'Hand work to the worker agents', '4 min'),
  P('done', 'Collect the no-replace rule from the Links lead', '2 min'),
  P('now', 'Write the refusal-case test', 'about 4 min left'),
  P('todo', 'Run the full test suite', 'about 3 min'),
  P('todo', 'Ask you about link_batch, then summarize', 'about 7 min'),
]

const PYTEST = [
  O('normal', '$ pytest tests/test_clouddrive.py -q'),
  O('ok', '...........................'),
  O('error', 'F'),
  O('error', 'FAILED test_link_batch_refuses_same_name'),
  O('error', 'E  expected "resolve by hand"'),
  O('error', 'E  got "folder already there"'),
  O('muted', '1 failed, 27 passed in 3.9s'),
  O('muted', ' '),
  O('coord', '> test-writer: update the expected message'),
  O('coord', '> editing tests/test_clouddrive.py'),
  O('muted', ' '),
  O('normal', '$ pytest tests/test_clouddrive.py -q'),
  O('ok', '........................▍'),
]

interface NodeInfo {
  state: string
  subtitle: string
  bigText: string
  progressNote: string
  updated: string
  plan: PlanStep[]
  planRight?: string
  outputTitle: string
  outputRight?: string
  output: OutLine[]
}

const INFO: Record<string, NodeInfo> = {
  lead: {
    state: 'running',
    subtitle: 'reports to you · select another agent in the graph to switch',
    bigText: '68%',
    progressNote: 'Done about 10:52 PM, in 19 min',
    updated: 'updated 8 s ago',
    plan: LEAD_PLAN,
    planRight: '6 steps',
    outputTitle: 'LIVE OUTPUT',
    outputRight: 'waiting on test-writer',
    output: [
      O('normal', '$ lead: split the work'),
      O('coord', '> link-batch-fix: add the no-replace rule'),
      O('coord', '> caller-map: list every caller'),
      O('coord', '> test-writer: cover the refusal case'),
      O('muted', ' '),
      O('ok', 'caller-map: 4 callers found, none pass require_dev'),
      O('error', 'FAILED test_link_batch_refuses_same_name'),
      O('muted', 'Nothing is committed.'),
    ],
  },
  coordinator: {
    state: 'waiting',
    subtitle: 'outside this session · notes the lead on overlaps',
    bigText: 'No plan',
    progressNote: 'Coordinators do not report progress',
    updated: 'last note 10:30 PM',
    plan: [P('done', 'Compare file ownership across sessions', '2 min'), P('done', 'Warn the lead about clouddrive_sync.py', '1 min'), P('todo', 'Watch for new overlaps', 'ongoing')],
    planRight: '3 steps',
    outputTitle: 'LAST NOTE',
    outputRight: 'sent 10:30 PM',
    output: [O('coord', '> Overlap: Links rule also edits clouddrive_sync.py'), O('muted', 'Both sessions touch upload_file().'), O('muted', 'Suggest: let the Links rule land first.')],
  },
  'links-rule': {
    state: 'done',
    subtitle: 'outside this session · Links rule lead, reports to its own session',
    bigText: 'Finished',
    progressNote: 'Shared the no-replace rule at 10:29 PM',
    updated: 'updated 3 min ago',
    plan: [P('done', 'Write the no-replace rule', '6 min'), P('done', 'Share it with the Importer scan lead', '1 min'), P('done', 'Acknowledge the overlap note', '1 min')],
    planRight: '3 steps',
    outputTitle: 'LAST OUTPUT',
    outputRight: 'finished',
    output: [O('normal', '$ git diff --stat'), O('ok', ' links_rule.py | 14 ++++++'), O('muted', ' 1 file changed, 14 insertions(+)'), O('ok', 'rule shared')],
  },
  'test-runner': {
    state: 'done',
    subtitle: 'reports to Lead',
    bigText: '100%',
    progressNote: 'Finished at 10:34 PM',
    updated: 'updated 2 min ago',
    plan: [P('done', 'Run the existing suite', '2 min'), P('done', 'Report failures to the lead', '1 min')],
    planRight: '2 steps',
    outputTitle: 'LAST OUTPUT',
    outputRight: 'finished',
    output: [O('normal', '$ pytest -q'), O('ok', '.........................'), O('muted', '25 passed in 3.1s')],
  },
  'link-batch-fix': {
    state: 'running',
    subtitle: 'reports to Lead · select another agent in the graph to switch',
    bigText: '62%',
    progressNote: 'Done about 10:41 PM, in 8 min',
    updated: 'updated 3 s ago',
    plan: [
      P('done', 'Read link_batch and its callers', '3 min'),
      P('done', 'Add the no-replace rule', '5 min'),
      P('now', 'Write the refusal-case test', 'about 4 min left'),
      P('todo', 'Run the full test suite', 'about 3 min'),
      P('todo', 'Hand the diff to the lead', 'about 1 min'),
    ],
    planRight: '5 steps',
    outputTitle: 'LIVE OUTPUT',
    outputRight: 'script running 14 s',
    output: PYTEST,
  },
  'rsync-depth-audit': {
    state: 'running',
    subtitle: 'reports to Lead',
    bigText: '45%',
    progressNote: 'Done about 10:49 PM, in 16 min',
    updated: 'updated 5 s ago',
    plan: [P('done', 'List rsync calls in the importer', '2 min'), P('now', 'Check each call for --max-depth', 'about 6 min left'), P('todo', 'Write the audit table', 'about 4 min')],
    planRight: '3 steps',
    outputTitle: 'LIVE OUTPUT',
    outputRight: 'reading files',
    output: [O('normal', '$ grep -rn "rsync" importer/'), O('muted', 'importer/sync.py:42'), O('muted', 'importer/sync.py:88'), O('coord', '> file-reader: read importer-viewer'), O('ok', 'file-reader: 2 call sites found')],
  },
  'guard-review': {
    state: 'waiting',
    subtitle: 'reports to Lead · waiting for the lead verdict',
    bigText: 'Waiting',
    progressNote: 'Starts after the lead decides on link_batch',
    updated: 'idle since 10:31 PM',
    plan: [P('todo', 'Review the no-replace diff', 'about 3 min'), P('todo', 'Check refusal messages read well', 'about 2 min')],
    planRight: '2 steps',
    outputTitle: 'OUTPUT',
    outputRight: 'not started',
    output: [O('muted', 'Waiting for verdict from Lead.')],
  },
  'test-writer': {
    state: 'running',
    subtitle: 'reports to link-batch-fix',
    bigText: '30%',
    progressNote: 'Done about 10:40 PM, in 7 min',
    updated: 'updated 4 s ago',
    plan: [P('done', 'Read the failing test', '1 min'), P('now', 'Update the expected message', 'about 2 min left'), P('todo', 'Re-run the file', 'about 1 min')],
    planRight: '3 steps',
    outputTitle: 'LIVE OUTPUT',
    outputRight: 'editing',
    output: [O('coord', '> editing tests/test_clouddrive.py'), O('normal', '-    assert "resolve by hand" in msg'), O('ok', '+    assert "folder already there" in msg')],
  },
  'caller-map': {
    state: 'done',
    subtitle: 'reports to link-batch-fix',
    bigText: '100%',
    progressNote: 'Finished at 10:32 PM',
    updated: 'updated 1 min ago',
    plan: [P('done', 'Search the repo for link_batch', '1 min'), P('done', 'Check whether callers pass require_dev', '1 min')],
    planRight: '2 steps',
    outputTitle: 'LAST OUTPUT',
    outputRight: 'finished',
    output: [O('normal', '$ grep -rn "link_batch(" .'), O('muted', '4 matches'), O('ok', 'none pass require_dev')],
  },
  'file-reader': {
    state: 'running',
    subtitle: 'reports to rsync-depth-audit',
    bigText: '70%',
    progressNote: 'Done about 10:38 PM, in 5 min',
    updated: 'updated 2 s ago',
    plan: [P('done', 'Open importer-viewer', '1 min'), P('now', 'Note every rsync flag', 'about 2 min left'), P('todo', 'Report to rsync-depth-audit', 'about 1 min')],
    planRight: '3 steps',
    outputTitle: 'LIVE OUTPUT',
    outputRight: 'reading',
    output: [O('normal', '$ cat importer-viewer/sync.py'), O('muted', '--archive --max-depth=2'), O('ok', '2 call sites found')],
  },
}

export function sampleDetails(): Record<string, Detail> {
  const out: Record<string, Detail> = {}
  for (const n of SAMPLE_NODES) {
    const i = INFO[n.id]
    out[n.id] = {
      id: n.id,
      name: n.name,
      vendor: n.vendor,
      model: n.model,
      workModel: n.workModel,
      state: i.state,
      subtitle: i.subtitle,
      bigText: i.bigText,
      progressNote: i.progressNote,
      updated: i.updated,
      pct: n.id === 'coordinator' || n.id === 'links-rule' ? null : n.pct,
      plan: i.plan,
      planRight: i.planRight,
      outputTitle: i.outputTitle,
      outputRight: i.outputRight,
      output: i.output,
    }
  }
  return out
}

// ---------- sample message log ----------

const NAME: Record<string, string> = {
  lead: 'Lead',
  coordinator: 'Coordinator',
  'links-rule': 'Links rule lead',
}
const nm = (id: string) => NAME[id] ?? id
const M = (time: string, from: string, to: string, type: Msg['type'], text: string): Msg => ({ time, from, to, route: `${nm(from)} → ${nm(to)}`, type, text })

export const SAMPLE_MESSAGES: Msg[] = [
  M('10:34 PM', 'test-runner', 'lead', 'result', 'Existing suite passed, 25 tests'),
  M('10:32 PM', 'link-batch-fix', 'lead', 'question', 'Rename the Refused message?'),
  M('10:32 PM', 'caller-map', 'link-batch-fix', 'result', '4 callers found, none pass require_dev'),
  M('10:31 PM', 'link-batch-fix', 'test-writer', 'task', 'Write the refusal-case test'),
  M('10:31 PM', 'lead', 'guard-review', 'task', 'Wait for my verdict on link_batch'),
  M('10:30 PM', 'coordinator', 'lead', 'note', 'Overlap: Links rule also edits clouddrive_sync.py'),
  M('10:30 PM', 'file-reader', 'rsync-depth-audit', 'result', '2 call sites found'),
  M('10:29 PM', 'links-rule', 'lead', 'result', 'Shared the no-replace rule'),
]

// ---------- sample sessions ----------

const BASE: SampleSession = {
  id: 'importer-scan',
  name: 'Importer scan',
  title: 'Harden importer scan CloudDrive uploads',
  leadModel: 'Opus 5.5',
  pct: 68,
  stepLabel: 'Step 4 of 6',
  stepText: 'Write the refusal-case test',
  finish: '10:52 PM',
  finishIn: 'in 19 min',
  finishRange: 'Likely between 10:46 and 11:04 PM',
  verdict: 'Stay about 7 min',
  verdictNote: 'At about 10:40 PM the lead needs your decision on link_batch. After that, you can leave it.',
  history: 'Estimate history: 10:58 → 10:55 → 10:57 → 10:52',
  elapsed: '56m',
}

const VARIANTS: Record<string, Partial<SampleSession>> = {
  'links-rule': { id: 'links-rule', name: 'Links rule', title: 'Share the no-replace rule across importers', pct: 85, stepLabel: 'Step 5 of 6', stepText: 'Run the full test suite', finish: '10:44 PM', finishIn: 'in 11 min', finishRange: 'Likely between 10:41 and 10:50 PM', verdict: 'You can leave', verdictNote: 'No decision needed from you before it finishes.', history: 'Estimate history: 10:48 → 10:46 → 10:44', elapsed: '41m' },
  'beta-export': { id: 'beta-export', name: 'Beta export', title: 'Fix the Beta CSV export column order', pct: 34, stepLabel: 'Step 2 of 6', stepText: 'Add the column map', finish: '11:20 PM', finishIn: 'in 47 min', finishRange: 'Likely between 11:08 and 11:40 PM', verdict: 'Stay about 12 min', verdictNote: 'The lead will ask which column order to keep. After that, you can leave it.', history: 'Estimate history: 11:35 → 11:28 → 11:20', elapsed: '19m' },
  inventory: { id: 'inventory', name: 'Inventory', title: 'Reconcile parts inventory with the BOM', pct: 12, stepLabel: 'Step 1 of 5', stepText: 'Read the inventory sheets', finish: '12:05 AM', finishIn: 'in 1 h 32 min', finishRange: 'Likely between 11:40 PM and 12:30 AM', verdict: 'You can leave', verdictNote: 'No decision is expected in the first hour.', history: 'Estimate history: 12:20 AM → 12:05 AM', elapsed: '6m' },
}

export function sampleSession(id: string | undefined): SampleSession {
  return { ...BASE, ...(id ? VARIANTS[id] : undefined) }
}

// ---------- sample conversation ----------

export function sampleRows(isWork: boolean): TranscriptRow[] {
  const who = isWork
    ? { user: 'Use Sonnet for the code and Haiku to read callers.', plan: 'Sonnet edits, Haiku maps callers, test-writer covers the refusal case.' }
    : { user: 'Use Codex for the code and Haiku to read callers.', plan: 'Codex edits, Haiku maps callers, test-writer covers the refusal case.' }
  return [
    { kind: 'user', time: '9:29 PM', text: `Harden the importer scan so --links never replaces another batch's files. Tell me before you commit anything. ${who.user}` },
    { kind: 'thinking' },
    { kind: 'text', text: `Reading link_batch and its callers, then splitting the work: ${who.plan}` },
    {
      kind: 'tool',
      name: 'Bash',
      input: ['pytest tests/test_clouddrive.py -q'],
      output: [
        { text: '...........................F', tone: 'error' },
        { text: 'FAILED test_link_batch_refuses_same_name', tone: 'error' },
        { text: '1 failed, 27 passed in 3.9s', tone: 'muted' },
      ],
    },
    {
      kind: 'tool',
      name: 'SubagentHandoff',
      detail: 'to test-writer',
      dot: 'ok',
      input: ['{ "message": "Update the expected text in test_link_batch_refuses_same_name to resolve by hand" }'],
      output: [{ text: '{"success":true,"message":"Task delivered to test-writer"}' }],
    },
    { kind: 'thinking' },
    { kind: 'text', text: 'One test fails on the old message text. test-writer is fixing it now, then the full suite runs. Nothing is committed.' },
    { kind: 'ask', text: 'Give link_batch the same no-replace rule as require_dev?', actions: ['Apply', 'Leave for now'] },
  ]
}
