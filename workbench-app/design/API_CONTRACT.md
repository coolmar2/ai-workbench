# Backend contract: wb_mc.py ⇄ workbench app (all GET, read-only)

Backend: C:\Users\omar\Downloads\workbench-spike\wb_mc.py on http://127.0.0.1:47832.
App reaches it through the Vite proxy as `/api/mc/<path>` (prefix stripped). The proxy forwards only
the GET paths below and sends `X-Forwarded-For` (xfwd), so the backend can tell LAN callers apart.

Hook events now carry `_ts` (epoch seconds, float). Older events only have `_t` ("HH:MM:SS", local,
no date): treat them as the date of their neighbours / today; never crash on missing `_ts`.

## GET /state  (existing, extended)
Every session and every agent gets an `eta` object (null when nothing is running):
```json
"eta": {
  "seconds_left": 95,            // null when overrunning or unknown
  "finish_at": 1792272170.0,     // epoch, null when seconds_left is null
  "elapsed": 41.2,               // seconds since this turn/agent started
  "progress": 0.43,              // 0..1 or null (from the latest TodoWrite: done/total)
  "confidence": "low",           // "low" | "medium" | "high"
  "basis": "12 past Explore runs (median 2m 10s)",   // human-readable, always present
  "overrun": false               // true when elapsed > p90 of comparable runs
}
```
Sessions also get `turn_started` (epoch of the current turn's UserPromptSubmit or null).
Algorithm (backend):
- Comparable history: agents → completed agents with the same agent_type (and same model when that
  gives ≥3 samples), else all completed agents; session turns → completed turns
  (UserPromptSubmit → Stop) of the same cwd, else all turns. Durations from `_ts`.
- Baseline = median duration; no history → 120 s for agents, 90 s for turns, confidence low.
- Progress signal: latest TodoWrite tool_input (todos with status pending/in_progress/completed) by
  that agent (or the main session for turns). With ≥1 completed: estimate = elapsed × total / done.
- Final estimate: progress estimate when available (confidence medium; high when ≥3 done and ≥8
  history samples agree within 50%), else baseline (confidence low <5 samples, medium ≥5).
- seconds_left = max(5, estimate − elapsed). If elapsed > p90 of history (≥5 samples) and no progress
  signal: overrun = true, seconds_left = null, basis "taking longer than usual (90% finish in 3m)".
- A session turn's seconds_left is never less than the max seconds_left of its running agents.

Sessions and agents also get `todos` (null if never set) = the latest TodoWrite list by that
session's main thread / that agent, plus `step`:
```json
"todos": [{"content": "Write the refusal-case test", "status": "in_progress", "active_form": "Writing …"}],
"step": {"index": 4, "total": 6, "label": "Write the refusal-case test"}   // index 1-based of the in_progress (or next pending) item; null if no todos
```
Per-step time hints are computed in the app (eta spread over the remaining steps); no backend field.

## GET /activity?session=<id>&agent=<id or "lead">&limit=40   (loopback-only, like /edits)
Recent tool calls of the lead (main thread) or one sub-agent, newest last:
```json
{"items": [{"ts": 1792…, "tool": "Bash", "tool_use_id": "…", "state": "running"|"done"|"error",
            "summary": "pytest tests/test_clouddrive.py -q",      // Bash command / file path / pattern / description
            "output": "…"}]}                                       // PostToolUse tool_response text (stdout+stderr for Bash), last 4 kB, null while running
```

## GET /edits?since=<seq>&session=<id optional>&limit=200
Edit-type tool calls from hooks.jsonl, oldest first, `seq` = line number (stable while the file only
grows). Response `{"next": <last seq>, "edits": [...]}`; each edit:
```json
{"seq": 812, "ts": 1792272080.1, "session_id": "…", "agent_id": "…"|null, "agent_type": "Explore"|null,
 "phase": "pre"|"post", "tool": "Edit"|"MultiEdit"|"Write"|"NotebookEdit", "tool_use_id": "…",
 "file_path": "C:\\…\\x.py", "cwd": "C:\\…",
 "changes": [{"old": "…", "new": "…", "replace_all": false}],   // Edit/MultiEdit
 "content": "…"}                                                 // Write (full file), else absent
```
`pre` arrives the moment claude commits to the edit (before it is applied); `post` after it is on
disk. Strings are capped at 200 kB per edit (flag `"truncated": true`).

## GET /workspaces
`{"workspaces": [{"root": "C:\\…\\repo", "name": "repo", "session_ids": ["…"], "last_ts": …}]}`
= distinct session cwds from the feed, newest first.

## GET /fs/list?root=<abs>&path=<rel, default "">  ·  GET /fs/read?root=<abs>&path=<rel>
Read-only file access, ONLY for roots that are a workspace from /workspaces (or inside one).
- path must resolve inside root (no `..`, no links/junctions out, no drive changes); skip `.git`
  (never list or read anything under it); hide nothing else.
- list → `{"root","path","entries":[{"name","type":"dir"|"file","size","mtime"}]}` sorted dirs first.
- read → `{"path","size","mtime","encoding":"utf-8","text"}`; refuse binary (NUL bytes) and files
  > 1 MB with 413/415 JSON errors.
- /fs/* and /edits are loopback-only: a caller whose X-Forwarded-For (or socket address when called
  directly) is not 127.0.0.1/::1 gets 403. /state and /workspaces stay as they are.
- 404 JSON for missing files; never a stack trace.
