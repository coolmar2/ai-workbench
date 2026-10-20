import type { TranscriptRow, Vendor } from '../../data/types'

/** Sample data for the Editor screen (design board Main.dc.html). Vendors resolve through the identity at render time. */

export interface WsTab { name: string; active?: boolean; dots: Vendor[] }
export const wsTabs: WsTab[] = [
  { name: 'Orbit', active: true, dots: ['claude', 'codex', 'gemini'] },
  { name: 'Network Stack', dots: ['gemini'] },
  { name: 'Bus Monitor', dots: [] },
  { name: 'Docs Site', dots: ['claude'] },
]

export interface FileMark { vendor: Vendor; editing: boolean }
export interface FileRow { name: string; depth: 1 | 2; glyph: string; badge?: string; active?: boolean; marks: FileMark[] }
const m = (vendor: Vendor, editing: boolean): FileMark => ({ vendor, editing })
export const files: FileRow[] = [
  { name: '__pycache__', depth: 1, glyph: '›', marks: [] },
  { name: '.claude', depth: 1, glyph: '›', marks: [] },
  { name: 'inventory', depth: 1, glyph: '›', marks: [m('claude', true)] },
  { name: 'orbit-web', depth: 1, glyph: '⌄', marks: [m('codex', true), m('gemini', false), m('claude', false)] },
  { name: 'clouddrive_sync.py', depth: 2, glyph: '', badge: 'M', active: true, marks: [m('codex', true), m('claude', false)] },
  { name: 'upload_run.py', depth: 2, glyph: '', marks: [m('gemini', false)] },
  { name: 'upload_client.py', depth: 2, glyph: '', marks: [] },
  { name: 'label-printer', depth: 1, glyph: '›', marks: [] },
  { name: 'importer-viewer', depth: 1, glyph: '›', marks: [m('claude', false)] },
  { name: 'tests', depth: 1, glyph: '⌄', marks: [m('codex', true)] },
  { name: 'test_clouddrive.py', depth: 2, glyph: '', badge: 'M', marks: [m('codex', true)] },
  { name: 'CLAUDE.md', depth: 1, glyph: '', marks: [] },
]

export interface Worktree { name: string; vendor?: Vendor; neutral?: boolean; who: { personal: string; work: string }; stat: string }
export const worktrees: Worktree[] = [
  { name: 'main', neutral: true, who: { personal: 'Your checkout on fixes-dev, your commits only', work: 'Your checkout on fixes-dev, your commits only' }, stat: '2 changed' },
  { name: 'copy/link-batch-fix', vendor: 'codex', who: { personal: 'Codex edits a private copy, outside git', work: 'Sonnet edits a private copy, outside git' }, stat: '+12 −3' },
  { name: 'copy/rsync-audit', vendor: 'gemini', who: { personal: 'Gemini reads here, read-only audit', work: 'Haiku reads here, read-only audit' }, stat: 'no edits' },
]
export const worktreeCaption =
  'Each agent works in a private copy kept outside your repo, so parallel work never collides. No branches, commits or files are added to your git history. Accepted edits land in your checkout as ordinary uncommitted changes, and you commit them yourself.'

export interface FileTab { name: string; modified?: boolean; active?: boolean }
export const fileTabs: FileTab[] = [
  { name: 'clouddrive_sync.py', modified: true, active: true },
  { name: 'test_clouddrive.py', modified: true },
  { name: 'CLAUDE.md' },
]
export const breadcrumb = 'Orbit › orbit-web › clouddrive_sync.py › link_batch'

export type Tok = 'kw' | 'str' | 'fn' | 'p'
export type Seg = [text: string, kind?: Tok]
export const FIRST_LINE = 112
export const HOT_FROM = 6
export const HOT_TO = 8
export const codeRows: Seg[][] = [
  [['def ', 'kw'], ['link_batch', 'fn'], ['(batch, drive, require_dev='], ['True', 'kw'], ['):']],
  [['    '], ["\"\"\"Link a batch folder without replacing another batch's files.\"\"\"", 'str']],
  [['    target = '], ['find_batch_folder', 'fn'], ['(drive, batch.name)']],
  [['    '], ['if ', 'kw'], ['target '], ['is None', 'kw'], [':']],
  [['        '], ['return ', 'kw'], ['create_batch_folder', 'fn'], ['(drive, batch)']],
  [],
  [['    '], ['if ', 'kw'], ['require_dev '], ['and ', 'kw'], ['target.owner != batch.owner:']],
  [['        log.'], ['warning', 'fn'], ['('], ['"folder already there: %s"', 'str'], [', '], ['ascii', 'fn'], ['(target.name))']],
  [['        '], ['return ', 'kw'], ['Refused', 'fn'], ['('], ['"resolve by hand"', 'str'], [')']],
  [],
  [['    existing = {f.name '], ['for ', 'kw'], ['f '], ['in ', 'kw'], ['target.children}']],
  [['    '], ['for ', 'kw'], ['report '], ['in ', 'kw'], ['batch.reports:']],
  [['        '], ['if ', 'kw'], ['report.name '], ['in ', 'kw'], ['existing:']],
  [['            log.'], ['info', 'fn'], ['('], ['"skip %s (exists)"', 'str'], [', '], ['ascii', 'fn'], ['(report.name))']],
  [['            '], ['continue', 'kw']],
  [['        '], ['upload', 'fn'], ['(drive, target, report)']],
  [],
  [['    '], ['write_clouddrive_json', 'fn'], ['(batch, target)']],
  [['    '], ['return ', 'kw'], ['Linked', 'fn'], ['(target)']],
]

/** Hover card text: plain string, mono code run, or bold run. */
export type Rich = string | { code: string } | { b: string }
export const tip = {
  vendor: 'codex' as Vendor,
  name: 'link-batch-fix',
  model: { personal: 'Codex 5-codex', work: 'Claude Sonnet 5.5' },
  status: 'editing now',
  meta: 'Importer scan session · started 10:31 PM · last change 10:38 PM',
  does: 'Adds a guard to link_batch. When require_dev is on and the folder it found belongs to a different batch, it logs a warning and returns Refused("resolve by hand") instead of uploading into that folder.',
  diff: [
    '+ if require_dev and target.owner != batch.owner:',
    '+     log.warning("folder already there: %s", ...)',
    '+     return Refused("resolve by hand")',
  ],
  steps: [
    { head: 'Find the folder.', body: [{ code: 'find_batch_folder' }, ' looks up a CloudDrive folder named after the batch. If none exists it creates one and stops. That path was already safe.'] as Rich[] },
    { head: 'Check who owns it.', body: ['The new ', { code: 'if' }, ' compares ', { code: 'target.owner' }, ' (who created the folder) with ', { code: 'batch.owner' }, ' (who is running this batch). Same name, different owner means two batches are colliding on one folder.'] as Rich[] },
    { head: 'Refuse instead of guessing.', body: ['It logs a warning and returns ', { code: 'Refused("resolve by hand")' }, '. Nothing is uploaded, so no files get replaced. A person decides what happens next.'] as Rich[] },
    { head: 'The flag.', body: [{ code: 'require_dev' }, ' defaults to True. A caller that really wants to merge folders can pass False and skip the check.'] as Rich[] },
  ],
  conceptTitle: 'Concept to remember: guard clauses',
  concept: [
    ['A ', { b: 'guard clause' }, ' checks the unsafe case first and leaves early. The normal path below it stays flat and easy to read, and the safety rule is easy to find.'] as Rich[],
    ['How to spot one: an ', { code: 'if' }, ' near the top of a function that ends in ', { code: 'return' }, ' or an error. Here it is the ', { code: 'return Refused(...)' }, ' inside the new ', { code: 'if' }, '.'] as Rich[],
  ],
  why: "Your request: --links must never replace another batch's files. This is the case where the folder name matches but the owner does not.",
  affects: '4 callers do not handle Refused yet (found by caller-map). test-writer is adding the refusal test. The Links rule session is waiting to reuse this rule.',
  tutorModel: 'Haiku 5.5',
  chips: ['Why return instead of raise?', 'What does ascii() do here?', 'Show me a similar example'],
  note: "A separate small agent answers, seeing only this edit and its file. The lead is not interrupted and your lead's context stays small. Not committed. Lives in wt/link-batch-fix.",
}

export type BottomTab = 'workers' | 'terminal' | 'problems' | 'git'
export const bottomTabs: { value: BottomTab; label: string }[] = [
  { value: 'workers', label: 'WORKERS' },
  { value: 'terminal', label: 'TERMINAL' },
  { value: 'problems', label: 'PROBLEMS' },
  { value: 'git', label: 'GIT' },
]
export const captions: Record<BottomTab, string> = {
  workers: 'One column per agent. Each works in a private copy outside your repo. Resume opens its real session.',
  terminal: 'Your own shell in this workspace. Agent commands show under Workers.',
  problems: '1 error, 2 warnings, 1 note, from tests, linters and agents',
  git: 'Agents never commit, branch or push. Their edits arrive as uncommitted changes. Commits carry your name only, with no AI trailers.',
}

export type LineTone = 'white' | 'ok' | 'muted'
export interface Worker { model: string; vendor: Vendor; role: string; status: 'done' | 'running'; lines: { t: string; tone: LineTone }[] }
const w = (t: string): { t: string; tone: LineTone } => ({ t, tone: 'white' })
const g = (t: string): { t: string; tone: LineTone } => ({ t, tone: 'ok' })
const p = (t: string): { t: string; tone: LineTone } => ({ t, tone: 'muted' })
const testRunner: Worker = { model: 'Sonnet 5.5', vendor: 'claude', role: 'test-runner', status: 'done', lines: [w('$ pytest tests -q'), g('all tests passed'), p('waiting for the next change')] }
const editLines = [w('> editing clouddrive_sync.py'), g('+ if require_dev and target.owner != batch.owner:'), g('+     return Refused("resolve by hand")'), p('> next: test for the refusal case')]
const auditLines = [w('> reading orbit-web, importer-viewer'), w('> listing every rsync call site'), p('> drafting findings for the lead')]
export const workersPersonal: Worker[] = [
  testRunner,
  { model: '5-codex', vendor: 'codex', role: 'link-batch-fix', status: 'running', lines: editLines },
  { model: '2.5 Pro', vendor: 'gemini', role: 'rsync-depth-audit', status: 'running', lines: auditLines },
]
export const workersWork: Worker[] = [
  testRunner,
  { model: 'Sonnet 5.5', vendor: 'claude', role: 'link-batch-fix', status: 'running', lines: editLines },
  { model: 'Haiku 5.5', vendor: 'claude', role: 'rsync-depth-audit', status: 'running', lines: auditLines },
]
export const resumeLabel: Record<Vendor, string> = { claude: 'Resume in Claude Code', codex: 'Resume in Codex CLI', gemini: 'Resume in Gemini CLI' }

export const terminalLines: { t: string; tone: 'white' | 'muted' | 'warn' | 'dim' }[] = [
  { t: 'orbit@dev:~/Orbit$ git status -sb', tone: 'white' },
  { t: '## fixes-dev...origin/fixes-dev', tone: 'muted' },
  { t: ' M orbit-web/clouddrive_sync.py', tone: 'warn' },
  { t: ' M tests/test_clouddrive.py', tone: 'warn' },
  { t: 'orbit@dev:~/Orbit$ git branch -a', tone: 'white' },
  { t: '* fixes-dev', tone: 'muted' },
  { t: '  main', tone: 'muted' },
  { t: '(agent copies live in ~/.workbench, outside the repo)', tone: 'dim' },
  { t: 'orbit@dev:~/Orbit$ ▍', tone: 'white' },
]

export interface Problem { sev: 'e' | 'w' | 'i'; msg: string; where: string; src: string; vendor?: Vendor }
export const problems: Problem[] = [
  { sev: 'e', msg: 'test_link_batch_refuses_same_name: expected "resolve by hand"', where: 'tests/test_clouddrive.py:64', src: 'pytest, run by test-runner', vendor: 'claude' },
  { sev: 'w', msg: 'link_batch can return Refused, 4 callers do not handle it', where: 'clouddrive_sync.py:118', src: 'caller-map', vendor: 'claude' },
  { sev: 'w', msg: 'Line too long (104 > 100)', where: 'clouddrive_sync.py:120', src: 'ruff' },
  { sev: 'i', msg: 'rsync call has no --ignore-existing', where: 'upload_run.py:42', src: 'rsync-depth-audit', vendor: 'gemini' },
]

export const gitChanges = [
  { file: 'clouddrive_sync.py', stat: '+12 −3', who: 'link-batch-fix' },
  { file: 'test_clouddrive.py', stat: '+9 −1', who: 'test-writer' },
]

export interface SessionDef { key: string; name: string; title: string; model: string; vendor: Vendor; pct: number; eta: string }
export const sdefsAll: SessionDef[] = [
  { key: 's1', name: 'Importer scan', title: 'Harden importer scan CloudDrive uploads', model: 'Opus 5.5', vendor: 'claude', pct: 68, eta: '10:52 PM' },
  { key: 's2', name: 'Links rule', title: "Make --links never replace another batch's files", model: 'Sonnet 5.5', vendor: 'claude', pct: 41, eta: '11:20 PM' },
  { key: 's3', name: 'Beta export', title: 'Beta batch export and orbit scan', model: '5-codex', vendor: 'codex', pct: 87, eta: '10:41 PM' },
  { key: 's4', name: 'Inventory', title: 'Inventory bring-over', model: '2.5 Pro', vendor: 'gemini', pct: 23, eta: '12:10 AM' },
]

const handoff = (to: string, msg: string): TranscriptRow => ({ kind: 'tool', name: 'SubagentHandoff', detail: `to ${to}`, dot: 'ok', input: [`{ "message": "${msg}" }`], output: [{ text: '{"success":true}' }] })
const think: TranscriptRow = { kind: 'thinking' }
const s1User: TranscriptRow = { kind: 'user', time: '9:29 PM', text: "Harden the importer scan so --links never replaces another batch's files. Tell me before you commit anything." }
const s1Tail: TranscriptRow[] = [
  { kind: 'tool', name: 'Bash', input: ['pytest tests/test_clouddrive.py -q'], output: [{ text: '...........................F', tone: 'error' }, { text: '1 failed, 27 passed in 3.9s', tone: 'muted' }] },
  think,
  { kind: 'text', text: 'link-batch-fix is editing link_batch. One test fails on the old message, test-writer is fixing it. Nothing is committed.' },
  { kind: 'ask', text: 'Give link_batch the same no-replace rule as require_dev?', actions: ['Apply', 'Leave for now'] },
]
/** Transcript per session key. Session s1 differs between Personal and Work (board's s1p / s1w). */
export const transcripts: Record<string, { personal: TranscriptRow[]; work: TranscriptRow[] }> = {
  s1: {
    personal: [s1User, think, { kind: 'text', text: 'Splitting this three ways: Codex edits, Gemini audits rsync, Sonnet runs the tests.' }, handoff('link-batch-fix', 'Add the no-replace rule to link_batch'), ...s1Tail],
    work: [s1User, think, { kind: 'text', text: 'Splitting this three ways: Sonnet edits, Haiku audits rsync, Sonnet runs the tests.' }, handoff('link-batch-fix', 'Add the no-replace rule to link_batch'), ...s1Tail],
  },
}
const same = (rows: TranscriptRow[]) => ({ personal: rows, work: rows })
transcripts.s2 = same([
  { kind: 'user', time: '9:41 PM', text: "Make --links never replace another batch's files. Split it up however makes sense." },
  think,
  { kind: 'text', text: 'Reading how --links picks its destination before changing anything.' },
  { kind: 'tool', name: 'Bash', input: ['grep -rn "links" orbit-web | head -4'], output: [{ text: 'orbit-web/clouddrive_sync.py:118: def link_batch(' }, { text: 'orbit-web/upload_run.py:42: --links' }, { text: '2 files, 1 shared with Importer scan', tone: 'muted' }] },
  { kind: 'text', text: 'Coordinator: Importer scan is editing link_batch too. Build on its no-replace rule instead of writing a second one.' },
  { kind: 'text', text: 'Holding my edit until Importer scan lands its change, about 7 min. Then I reuse its rule for --links.' },
])
transcripts.s3 = same([
  { kind: 'user', time: '9:12 PM', text: 'Export the beta batch reports and run the orbit scan on the new set.' },
  think,
  { kind: 'tool', name: 'Bash', input: ['python upload_run.py --batch beta --dry-run'], output: [{ text: '42 reports ready, 0 conflicts', tone: 'ok' }] },
  handoff('scan-runner', 'Run the orbit scan on the 42 exported reports'),
  { kind: 'text', text: 'Scan is running on 42 reports. 87% done, should finish about 10:41 PM. Nothing else needs you.' },
])
transcripts.s4 = same([
  { kind: 'user', time: '10:20 PM', text: 'Bring the inventory sheets over into the new layout.' },
  think,
  { kind: 'tool', name: 'Bash', input: ['ls inventory | wc -l'], output: [{ text: '118', tone: 'ok' }] },
  handoff('sheet-mapper', 'Map the first 30 sheets to the new column layout'),
  { kind: 'text', text: 'Mapping in batches of 30. This is the slowest session, about 97 min left, safe to leave.' },
])

export const status = { branch: 'fixes-dev*', agents: '3 agents running', pos: 'Ln 118, Col 5 · Spaces 4 · UTF-8', workAccount: 'Acme Corp, Claude Enterprise' }
