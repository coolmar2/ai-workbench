# AI Workbench — handoff (2026-10-19)

Read this first, then `ai-workbench-brain-dump/BRAIN_DUMP.md` (the original requirements, research and
Cowork design boards). This file covers everything built and decided after that, on Omar's work laptop,
so a new session can continue on the home PC.

## 1. Who and what
Omar (electrical engineer; Windows; Claude Max) wants one personal app for all his AI work, wrapped
around the official CLIs (Claude now; Codex/Gemini later), reachable from his phone. Hard rules:
- **No AI trace in his git history**: agents never branch, commit, push, add worktrees or trailers.
- Never touch global settings, `~/.claude`, logins or tokens; project-local files only.
- Vendor marks are the real Claude / Codex / Gemini logos (changed 2026-10-19 at Omar's request; they were
  circle/square/triangle stand-ins before). SVGs live in `workbench-app/src/assets/vendors/` (from LobeHub's
  MIT icon set) and are drawn only through `AgentMark`.
- His working style (from his global CLAUDE.md): cheap models write (Sonnet/Haiku subagents, tight
  briefs), Opus only reviews; every non-trivial change reviewed before reporting; CodeRabbit review when
  the folder is a git repo; report facts and say clearly what failed.

## 2. What exists (folders in this package)
```
workbench-spike/      backend + plumbing (Python 3.13 stdlib + pywinpty)
workbench-app/        front end (Vite 8 + React 19 + TS 6 + Tailwind 4 + Radix + Monaco)
ai-workbench-brain-dump/  original brain dump, Cowork design boards (design/*.dc.html), research
wb-test-repo/         throwaway git repo used to prove "no git trace"
hermes-check.md       Hermes Agent verdict: not the base (its Claude OAuth use is what Anthropic's terms forbid)
```

### workbench-spike (backend)
| File | What it does | Status |
|---|---|---|
| `wb_pty_win.py` | Runs `claude` in a pseudo-terminal (pywinpty). Binds the first free 127.0.0.1 port 47840–47859. Protocol: `\x04text` = type + Enter (0.6 s pause so claude doesn't swallow Enter as part of a paste); `\x01keys` raw keys; `\x02` stream output; `\x03CxR` resize; empty = liveness ping. Passes `--settings wb_settings.json` and env `WB_PORT`; strips inherited `CLAUDE*` env (else transcripts turn off). One writer thread, locked pty writes. Refuses a `claude` found in the current folder. | Works; Remote Control works through it |
| `wb_send.py` | `python wb_send.py --port 47840 "text"` | Works |
| `wb_hook.py` + `wb_settings.json` (+ `.claude/settings.local.json`) | Logs every hook event (SessionStart, UserPromptSubmit, Pre/PostToolUse, SubagentStart/Stop, Notification, Stop, SessionEnd) to `hooks.jsonl` with `_t`, `_ts` (epoch), `_wb_port`. | Works. **Paths inside are absolute (C:/Users/omar/Downloads/workbench-spike/...) — fix on a new machine.** |
| `wb_mc.py` | Mission control backend on 127.0.0.1:47832. `/state` (sessions, agents, ETA, todos/step, liveness), `/edits` (edit feed for live playback), `/activity` (recent tool calls + one-line outputs), `/workspaces`, `/fs/list`, `/fs/read` (read-only, workspace-contained, no .git, no links), `/send`, `/start`, `/term` (SSE). `/fs`, `/edits`, `/activity` are loopback-only (checks X-Forwarded-For). Optional `--listen tailscale` / `--bind` with a token cookie. Has its own old embedded HTML page (superseded by workbench-app). | Works; tests in the work session's scratchpad (not shipped) |
| `wb_copy.py` | Private agent copies outside the repo (`new/diff/apply/drop`), conflict detection, never touches `.git`, skips AI files (.claude, CLAUDE.md if new, …), refuses links/junctions, validates names. | Proven on wb-test-repo: git log/branch/remote/.git unchanged |
| `wb_launch.py` | Start a wrapper session in a folder with Remote Control on: `start <folder> --name N [--copy TASK]`, `list`, `send`, `stop`. | Works |
| `wb_rc.py` | Always-on **official** `claude remote-control` server per project, run from a launcher folder `rc/<name>` (so nothing is written into the repo); its WorktreeCreate/WorktreeRemove hooks make private copies (wb_copy) instead of git worktrees. `add <repo> --name N`, `start/stop/list`. | Server starts and hooks tested by hand; **a phone-started session was never tested** |
| `hooks.jsonl` | Event history; ETAs learn from it. | Keep it |

Decision on the "always-on supervisor": a self-respawning supervisor agent was blocked by Claude Code's
safety check ("Create Unsafe Agents"). Chosen instead: the official `claude remote-control` server
(`wb_rc.py`) — Anthropic's own program stays up; you start fresh sessions from the phone; no context
rotation problem.

### workbench-app (front end)
Run: `npm install` then `npm run dev` (port 5190, host 0.0.0.0; Vite proxies only GET
`/api/mc/(state|edits|activity|workspaces|fs/list|fs/read)` to wb_mc with xfwd).
- Design system: Hermes-style tokens (`src/styles/tokens.css`), kit in `src/components/ui` (README there),
  spec in `design/POLISH_SPEC.md`, research `design/POLISH_RESEARCH.md`, backend contract
  `design/API_CONTRACT.md`, target screenshots Omar loves in `design/target/`.
- Shell: top bar with Agent | Editor | Mission control tabs, Personal/Work switch, Ctrl+K/P palette.
- **Mission control** (`/mission`): coordinator hub with session cards (progress, "Done about…", verdict
  chips), coordinator feed. `?sample=1` = full sample board. Live coordinator does not exist yet.
- **Session** (`/mission/session/:id`, `/cloud`): summary strip (progress, estimated finish, "Should you
  stay?"), IN/OUT transcript, agent plan with per-step ETAs, live output, agent cloud with progress rings.
- **Editor** (`/editor`): VS Code Dark Modern clone on Monaco, workspace TABS (Omar's request), real files
  via /fs, **live playback of agent edits** (types the edit in the agent's colour as it lands; "awaiting
  approval" until written; reverts if denied). `?simulateEdits=1` = dev simulation. Read-only.
- **Agent** (`/agent`), **Identity** (`/identity`): sample data.
- Shared rules: `src/live/verdict.ts` (one "Should you stay?" rule), ETA component `Eta` in the kit.

## 3. Proven vs not
Proven: PTY wrapper + Remote Control both ways; hooks carry agent ids and parents (`meta.json`
`parentAgentId`); multi-session wrapper ports; Mission control live; private copies with zero git trace;
ETA from history + TodoWrite progress; live edit playback with a real session.
Not yet: phone test of `wb_rc.py`; Tailscale phone access to the app; sending prompts from the app UI
(composers are disabled with a tooltip); real coordinator; lead model (feed doesn't carry it); Codex /
Gemini; two identities (Personal/Work) on one machine; CodeRabbit (neither folder is a git repo).

## 4. Setup on a new PC
**Required software** (the scripts and hook commands call `python` and `claude` by name, so both must be
real executables on PATH — the Microsoft Store `python` stub does not count):
- **Python 3.13** (3.12+ works; the work PC runs 3.13 from the Microsoft Store). Packages: `pywinpty`
  only (`python -m pip install --user pywinpty`); everything else is the standard library.
- **Claude Code CLI** (standalone `claude` on PATH, logged in once interactively). The desktop app's
  Code tab alone is not enough: the wrapper, `wb_launch.py` and `wb_rc.py` start `claude` themselves.
  Install with Anthropic's official installer (see code.claude.com docs), then run `claude` once.
- **Node** 24+ / npm 11 (for workbench-app). Git (for wb-test-repo / wb_copy tests).
- **Tailscale** only for phone/LAN access (optional).

**Secrets:** none are needed or included. No `.env`, API keys or tokens exist in this project; the
optional `wb_mc.token` (phone access) is generated on first use and was left out on purpose.

**Steps**
1. Unpack anywhere, keeping the folders side by side (e.g. `...\ai-workbench\workbench-spike`,
   `...\ai-workbench\workbench-app`, `...\ai-workbench\wb-test-repo`).
2. `cd workbench-spike` → `python setup_paths.py` — rewrites the absolute hook paths in
   `wb_settings.json`, `.claude/settings.local.json`, `rc/*/.claude/settings.local.json` and
   `rc/*/wb-rc.json` to the new location. Re-run it after any move.
3. `python -m pip install --user pywinpty`; `cd ..\workbench-app` → `npm install`.
4. Backend: `cd workbench-spike` → `python wb_mc.py`. App: `cd workbench-app` → `npm run dev`
   → http://localhost:5190.
5. Start a session: `python wb_launch.py start <absolute folder> --name "x"` (or
   `python wb_pty_win.py claude` from the project folder). Trust each project folder once in claude.
6. Not shipped: the work laptop's test scripts (they lived in a temp scratchpad), `node_modules`,
   `dist`, `logs/`, `rc-home/` (private copies), screen logs.

## 5. Suggested next steps
1. Phone-test `wb_rc.py` (start a session in its environment from the Claude app; check the private copy).
2. Wire sending from the app (composers → wb_mc `/send`, loopback-only, with confirmation).
3. A real coordinator (reads plans/diffs across sessions in a workspace, posts NOTE/HANDOFF/QUESTION).
4. Put both folders in a git repo of their own (personal), so CodeRabbit can review.
5. Editor chat panel → real session transcript.
