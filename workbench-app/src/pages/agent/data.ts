import type { Vendor } from '../../data/types'

export interface AgPlanRow { vendor: Vendor; model: string; task: string; why: string }
export interface AgLiveRow { vendor: Vendor; model: string; status: 'running' | 'done'; task: string; depth: string }
export interface AgAccount { vendor: Vendor; name: string; how: string }

export const SESSION_LINK = '/mission/session/importer-scan'
export const CHAT_TITLE = 'Harden importer scan CloudDrive uploads'
export const CHAT_WORKSPACE = 'Orbit workspace'
export const LEAD_LABEL = 'Lead · Opus 5.5'

export const USER_PROMPT = "Harden the importer scan so --links never replaces another batch's files. Run the tests as you go, and tell me before you commit anything."


export const PLAN: AgPlanRow[] = [
  { vendor: 'codex', model: 'gpt-5-codex', task: 'Add the no-replace rule to link_batch', why: 'Well-specified edit' },
  { vendor: 'gemini', model: '2.5 Pro', task: 'Audit rsync depth and filesystem flags', why: 'Large read across the repo' },
  { vendor: 'claude', model: 'Sonnet 5.5', task: 'Run the test suite after each change', why: 'Verification' },
  { vendor: 'claude', model: 'Opus 5.5 (lead)', task: 'Review each diff before anything is committed', why: 'Judgment call' },
]
export const PLAN_WORK: AgPlanRow[] = [
  { vendor: 'claude', model: 'Sonnet 5.5', task: 'Add the no-replace rule to link_batch', why: 'Well-specified edit' },
  { vendor: 'claude', model: 'Haiku 5.5', task: 'Audit rsync depth and filesystem flags', why: 'Cheap read across the repo' },
  { vendor: 'claude', model: 'Sonnet 5.5', task: 'Run the test suite after each change', why: 'Verification' },
  { vendor: 'claude', model: 'Opus 5.5 (lead)', task: 'Review each diff before anything is committed', why: 'Judgment call' },
]

export const LIVE: AgLiveRow[] = [
  { vendor: 'codex', model: 'gpt-5-codex', status: 'running', task: 'Editing clouddrive_sync.py', depth: 'Spawned 1 helper: test-writer (Codex)' },
  { vendor: 'gemini', model: '2.5 Pro', status: 'running', task: 'Auditing rsync call sites', depth: 'No helpers' },
  { vendor: 'claude', model: 'Sonnet 5.5', status: 'done', task: 'Test run finished', depth: 'No helpers' },
]
export const LIVE_WORK: AgLiveRow[] = [
  { vendor: 'claude', model: 'Sonnet 5.5', status: 'running', task: 'Editing clouddrive_sync.py', depth: 'Spawned 1 helper: test-writer (Sonnet)' },
  { vendor: 'claude', model: 'Haiku 5.5', status: 'running', task: 'Auditing rsync call sites', depth: 'No helpers' },
  { vendor: 'claude', model: 'Sonnet 5.5', status: 'done', task: 'Test run finished', depth: 'No helpers' },
]

export const ACCOUNTS: AgAccount[] = [
  { vendor: 'claude', name: 'Claude Code', how: 'Signed in with your account' },
  { vendor: 'codex', name: 'Codex CLI', how: 'Signed in with your account' },
  { vendor: 'gemini', name: 'Gemini CLI', how: 'Signed in with your account' },
]
export const ACCOUNTS_WORK: AgAccount[] = [{ vendor: 'claude', name: 'Claude Code', how: 'Signed in · Acme Corp, Claude Enterprise' }]

export interface ToolCall { name: string; summary: string; output: string }
export const TOOL_CALLS: ToolCall[] = [
  { name: 'Grep', summary: 'link_batch in importer/', output: 'importer/clouddrive_sync.py:84  def link_batch(batch, target)\nimporter/scan.py:41  link_batch(batch, dest)' },
  { name: 'Read', summary: 'importer/clouddrive_sync.py', output: '212 lines. require_dev() refuses to replace an existing folder; link_batch() has no such rule.' },
]
export const MODELS = ['Opus 5.5', 'Sonnet 5.5', 'Haiku 5.5'] as const
export const SUGGESTIONS = [
  'Harden the importer scan so --links never replaces files',
  'Audit rsync depth and filesystem flags',
  'Summarise what changed in the last session',
  'Plan a refactor of link_batch',
]
export const DECISION_TEXT = 'A same-named folder is already on Projects-Orbit, and a later --links run could overwrite it. Give link_batch the same no-replace rule as require_dev?'
