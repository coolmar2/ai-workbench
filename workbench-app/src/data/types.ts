// Shared domain types. Screen-specific sample data lives next to each page
// (src/pages/<screen>/data.ts) and uses these types.

export type Vendor = 'claude' | 'codex' | 'gemini'

export type AgentStatus = 'running' | 'waiting' | 'done' | 'idle' | 'error' | 'offline' | 'ended' | 'reading' | 'editing'

/** One row of a Claude Code-style transcript (Session conversation, Editor AI panel). */
export type TranscriptRow =
  | { kind: 'user'; time: string; text: string }
  | { kind: 'thinking'; text?: string }
  | { kind: 'text'; text: string }
  | {
      kind: 'tool'
      name: string // "Bash", "Read", "SubagentHandoff"...
      detail?: string // grey suffix after the name, e.g. "to test-writer"
      input: string[]
      output?: { text: string; tone?: 'normal' | 'error' | 'muted' | 'ok' }[]
      dot?: 'muted' | 'ok' | 'running' | 'error'
      eta?: McEta | null
    }
  | { kind: 'ask'; label?: string; text: string; actions: string[] }

export type MessageType = 'task' | 'result' | 'question' | 'note'

export interface AgentMessage {
  time: string
  route: string
  type: MessageType
  text: string
}

// ---- Live Mission control feed (wb_mc.py GET /state) ----

/** Estimate for a running session turn or agent (GET /state `eta`). null/missing = nothing running or no estimate. */
export interface McEta {
  /** Seconds left at poll time; null when overrunning or unknown. */
  seconds_left: number | null
  /** Epoch seconds; null when seconds_left is null. */
  finish_at: number | null
  /** Seconds since the turn/agent started, at poll time. */
  elapsed: number
  /** 0..1 from the latest TodoWrite, or null. */
  progress: number | null
  confidence: 'low' | 'medium' | 'high'
  /** Human-readable, e.g. "12 past Explore runs (median 2m 10s)". */
  basis: string
  /** True when elapsed passed the p90 of comparable runs. */
  overrun: boolean
  /** Client-side: Date.now() when this payload arrived (stamped by the poller), so elapsed can tick between polls. */
  received?: number
}

export interface McAgent {
  agent_id: string
  agent_type: string | null
  description: string | null
  parent_agent_id: string | null
  model: string | null
  effort: string | null
  state: string // 'running' | 'done' | ...
  last_tool: string | null
  tool_count: number
  started_t: string | null
  stopped_t: string | null
  result: string | null
  eta?: McEta | null
}

export interface McSession {
  session_id: string
  cwd: string
  started?: string | null
  last_event_t?: string | null
  status: string // 'running' | 'idle' | 'ended' | 'offline' | ...
  port: number | null
  online: boolean
  last_prompt: string
  last_reply: string
  current_tool: string | null
  event_count: number
  agents: McAgent[]
  /** Epoch seconds of the current turn's UserPromptSubmit, or null. */
  turn_started?: number | null
  eta?: McEta | null
  /** Session title (Claude Code's custom or AI title), when known. */
  title?: string | null
  /** A past Claude Code session read from its transcript (not seen by the hooks): no live data, can be resumed. */
  imported?: boolean
  /** Imported only: lead model id from the transcript, prompt count, and where it ran ('cli', 'claude-desktop', ...). */
  model?: string | null
  prompts?: number
  entrypoint?: string | null
}

export interface McState {
  sessions: McSession[]
}
