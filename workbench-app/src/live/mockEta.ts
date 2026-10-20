import type { McAgent, McEta, McSession, McState } from '../data/types'

/**
 * Dev-only fixture for `?mockEta=1` (see mission.ts): one session per ETA case, times derived from a fixed
 * page-load epoch so the elapsed / countdown values really tick between polls.
 */
const T0 = Date.now()
const CWD = 'C:\\Users\\omar\\Downloads\\workbench-demo'

type Conf = McEta['confidence']

function eta(nowMs: number, startedMs: number, total: number, conf: Conf, basis: string, progress: number | null = null): McEta {
  const elapsed = (nowMs - startedMs) / 1000
  const left = Math.max(5, total - elapsed)
  return { seconds_left: left, finish_at: nowMs / 1000 + left, elapsed, progress, confidence: conf, basis, overrun: false }
}

function overrun(nowMs: number, startedMs: number, basis: string): McEta {
  return { seconds_left: null, finish_at: null, elapsed: (nowMs - startedMs) / 1000, progress: null, confidence: 'medium', basis, overrun: true }
}

function hms(ms: number): string {
  const d = new Date(ms)
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':')
}

function agent(id: string, type: string, desc: string, model: string, parent: string | null, startedMs: number, e: McEta | null, state = 'running'): McAgent {
  return {
    agent_id: id,
    agent_type: type,
    description: desc,
    parent_agent_id: parent,
    model,
    effort: 'medium',
    state,
    last_tool: 'Read',
    tool_count: 7,
    started_t: hms(startedMs),
    stopped_t: state === 'done' ? hms(startedMs + 30_000) : null,
    result: state === 'done' ? 'Found 3 call sites.' : null,
    eta: e,
  }
}

function session(id: string, prompt: string, startedMs: number, status: string, e: McEta | null, agents: McAgent[]): McSession {
  return {
    session_id: id,
    cwd: CWD,
    started: hms(startedMs),
    last_event_t: hms(Date.now() - 2000),
    status,
    port: null,
    online: status !== 'ended',
    last_prompt: prompt,
    last_reply: '',
    current_tool: status === 'idle' || status === 'ended' ? null : 'Bash',
    event_count: 42,
    agents,
    turn_started: status === 'idle' || status === 'ended' ? null : startedMs / 1000,
    eta: e,
  }
}

export function mockEtaState(nowMs: number): McState {
  const s = (secAgo: number) => T0 - secAgo * 1000
  return {
    sessions: [
      session('mock-high-0000-0000', 'Refactor the importer scan and add tests (high confidence)', s(41), 'agents running',
        eta(nowMs, s(41), 136, 'high', '12 past Explore runs (median 2m 10s)', 0.43), [
          agent('mock-a1', 'Explore', 'Map the scan call sites', 'claude-haiku-5-5', null, s(41), eta(nowMs, s(41), 130, 'high', '12 past Explore runs (median 2m 10s)')),
          agent('mock-a2', 'test-writer', 'Write refusal-case tests', 'claude-sonnet-5-5', 'mock-a1', s(20), eta(nowMs, s(20), 400, 'medium', '6 past test-writer runs (median 6m 40s)', 0.25)),
          agent('mock-a3', 'Explore', 'Check the docs', 'claude-haiku-5-5', null, s(100), null, 'done'),
        ]),
      session('mock-medium-000-0000', 'Migrate the inventory CSVs (medium confidence)', s(200), 'running',
        eta(nowMs, s(200), 560, 'medium', '7 past turns in this folder (median 9m 20s)'), []),
      session('mock-low-00000-0000', 'Draft a release note from the changelog (low confidence)', s(30), 'agents running',
        eta(nowMs, s(30), 210, 'low', 'no comparable runs yet, using a default of 90 s'), [
          agent('mock-b1', 'general-purpose', 'Summarise the changelog', 'claude-sonnet-5-5', null, s(30), eta(nowMs, s(30), 120, 'low', 'no comparable runs yet, using a default of 120 s')),
        ]),
      session('mock-overrun-0000-0000', 'Chase the flaky export test (taking long)', s(520), 'agents running',
        overrun(nowMs, s(520), 'taking longer than usual (90% finish in 3m)'), [
          agent('mock-c1', 'debugger', 'Reproduce the flake', 'claude-opus-5-5', null, s(480), overrun(nowMs, s(480), 'taking longer than usual (90% finish in 3m)')),
        ]),
      session('mock-noeta-0000-0000', 'Running with no estimate yet', s(8), 'running', null, [
        agent('mock-d1', 'Explore', 'Look around', 'claude-haiku-5-5', null, s(8), null),
      ]),
      session('mock-idle-00000-0000', 'Idle session, nothing running', s(900), 'idle', null, []),
    ],
  }
}
