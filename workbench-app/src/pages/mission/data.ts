import type { Vendor } from '../../data/types'

/** Design sample data (from the owner's original board). Shown only while the live feed is offline or with ?sample=1. */
export interface Dual<T> {
  personal: T
  work: T
}

export interface SampleSession {
  id: string
  title: string
  lead: Vendor
  leadModel: Dual<string>
  agents: Vendor[]
  now: Dual<string>
  agoMs: number
  /** 0..1 */
  progress: number
  /** Minutes from "now" until the session finishes / since it started. */
  doneInMin: number
  startedMinAgo: number
  /** Sample only: the lead needs a decision from you in this many minutes. */
  decisionInMin?: number
}

export const WORKSPACE_NAME = 'Orbit'

export const SAMPLE_SESSIONS: SampleSession[] = [
  {
    id: 'importer-scan',
    title: 'Harden importer scan CloudDrive uploads',
    lead: 'claude',
    leadModel: { personal: 'Opus 5.5', work: 'Opus 5.5' },
    agents: ['claude', 'claude', 'claude', 'claude', 'codex', 'codex', 'gemini', 'gemini'],
    now: { personal: 'Codex is writing the refusal-case test while Gemini audits rsync depth.', work: 'Sonnet is writing the refusal-case test while Haiku audits rsync depth.' },
    agoMs: 8_000,
    progress: 0.68,
    doneInMin: 19,
    startedMinAgo: 25,
    decisionInMin: 7,
  },
  {
    id: 'links-rule',
    title: "Make --links never replace another batch's files",
    lead: 'claude',
    leadModel: { personal: 'Sonnet 5.5', work: 'Sonnet 5.5' },
    agents: ['claude', 'claude', 'codex'],
    now: { personal: 'Rewriting link_batch so it skips report PDFs that already exist.', work: 'Rewriting link_batch so it skips report PDFs that already exist.' },
    agoMs: 14_000,
    progress: 0.41,
    doneInMin: 47,
    startedMinAgo: 33,
  },
  {
    id: 'beta-export',
    title: 'Beta batch export and orbit scan',
    lead: 'codex',
    leadModel: { personal: '5-codex', work: 'Sonnet 5.5' },
    agents: ['codex', 'claude'],
    now: { personal: 'Running the export script against the beta batch data.', work: 'Running the export script against the beta batch data.' },
    agoMs: 3_000,
    progress: 0.87,
    doneInMin: 4,
    startedMinAgo: 38,
  },
  {
    id: 'inventory',
    title: 'Inventory bring-over',
    lead: 'gemini',
    leadModel: { personal: '2.5 Pro', work: 'Sonnet 5.5' },
    agents: ['gemini', 'gemini', 'claude', 'codex'],
    now: { personal: "Migrating the inventory CSVs. The next table waits on Beta export's batch_id.", work: "Migrating the inventory CSVs. The next table waits on Beta export's batch_id." },
    agoMs: 21_000,
    progress: 0.23,
    doneInMin: 97,
    startedMinAgo: 29,
  },
]

export type MsgKind = 'plan' | 'result' | 'question' | 'note'

/** A chip riding a hub link. `to` = towards the session (true) or towards the coordinator. */
export interface SampleChip {
  session: string
  text: string
  kind: MsgKind
  toSession: boolean
  /** Small in-flight dot on this link. */
  inFlight?: boolean
}

export const SAMPLE_CHIPS: SampleChip[] = [
  { session: 'importer-scan', text: 'Links rule overlaps', kind: 'note', toSession: true, inFlight: true },
  { session: 'importer-scan', text: 'plan: no-replace rule', kind: 'plan', toSession: false },
  { session: 'links-rule', text: 'plan: edit link_batch', kind: 'plan', toSession: false },
  { session: 'links-rule', text: 'share your rule', kind: 'note', toSession: true },
  { session: 'beta-export', text: 'result: batch_id added', kind: 'result', toSession: false, inFlight: true },
  { session: 'beta-export', text: 'Inventory uses batch_id', kind: 'note', toSession: true },
  { session: 'inventory', text: "use Beta export's batch_id", kind: 'note', toSession: true, inFlight: true },
  { session: 'inventory', text: 'keep old CSV columns?', kind: 'question', toSession: false },
]

/** Dashed links between sessions that build on each other (sample only). */
export const SAMPLE_BUILDS: { a: string; b: string; text: string; kind: MsgKind }[] = [
  { a: 'importer-scan', b: 'links-rule', text: "Importer scan builds on the Links rule session's rule", kind: 'note' },
  { a: 'beta-export', b: 'inventory', text: 'Beta export hands batch_id to Inventory', kind: 'result' },
]

export type FeedTag = 'NOTE' | 'HANDOFF' | 'QUESTION' | 'PLAN SYNC'

export interface FeedMessage {
  tag: FeedTag
  minAgo: number
  /** **double asterisks** mark file names / identifiers. */
  text: string
  route: string
}

export const SAMPLE_FEED: FeedMessage[] = [
  { tag: 'NOTE', minAgo: 2, text: "Importer scan and Links rule both edit **link_batch** in **clouddrive_sync.py**. Told both leads. Importer scan now builds on the Links rule session's no-replace rule.", route: 'Coordinator → Importer scan, Links rule' },
  { tag: 'HANDOFF', minAgo: 4, text: "Beta export added **batch_id** to the export schema. Passed it to Inventory's lead.", route: 'Beta export → Coordinator → Inventory' },
  { tag: 'QUESTION', minAgo: 7, text: 'Inventory asked whether to keep the old CSV columns. Forwarded to Beta export.', route: 'Inventory → Coordinator → Beta export' },
  { tag: 'NOTE', minAgo: 11, text: "Inventory's plan depends on the schema Beta export is changing. Inventory will wait for it.", route: 'Coordinator → Inventory' },
  { tag: 'PLAN SYNC', minAgo: 13, text: 'Collected all four plans. The only shared file is **clouddrive_sync.py**.', route: 'All leads → Coordinator' },
]

export const SAMPLE_COORDINATOR_MODEL = 'Haiku 5.5'

/** Other sample workspaces so the left list looks like the board. */
export const SAMPLE_OTHER_WORKSPACES: { name: string; state: 'running' | 'idle' | 'attention'; running?: number }[] = [
  { name: 'Network Stack', state: 'running', running: 1 },
  { name: 'Bus Monitor', state: 'idle' },
  { name: 'Docs Site', state: 'attention' },
]
