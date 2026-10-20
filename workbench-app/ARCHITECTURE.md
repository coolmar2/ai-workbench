# Workbench app: architecture (v0.1)

First front end for the AI workbench, ported from the six Cowork design boards in
`../ai-workbench-brain-dump/design/` (see BRAIN_DUMP.md section 9). Vite + React 19 + TypeScript,
plain CSS, React Router 7. No UI framework. Exact versions are pinned in `package.json`.

Run: `npm run dev` → http://127.0.0.1:5190

## Routes

| Route | Board | Data |
|---|---|---|
| `/editor` | Main.dc.html | sample |
| `/agent` | Agent.dc.html | sample |
| `/mission` | Mission.dc.html (workspace view) | **live** from wb_mc.py, sample fallback |
| `/mission/session/:id` | Session.dc.html (opens on Conversation) | **live** if `:id` is a live session_id, else sample |
| `/mission/session/:id/cloud` | Cloud.dc.html (same screen, opens on Agent cloud) | same as above |
| `/identity` | Identity.dc.html | sample (accounts are not read) |

`/` redirects to `/editor`.

## Layout

```
src/
  main.tsx            BrowserRouter + IdentityProvider
  App.tsx             routes
  styles/tokens.css   palette + fonts as CSS variables (one source of truth)
  styles/base.css     reset, focus ring, app frame, keyframes (agentPulse)
  context/identity.tsx  Personal | Work, app-wide, persisted in localStorage ('wb.identity')
  data/types.ts       shared types: Vendor, TranscriptRow, AgentMessage, McState/McSession/McAgent
  live/mission.ts     useMissionFeed() poller + pure mapping helpers
  components/         shared UI (owned by the lead, screens import, never edit)
    TopBar.tsx        nav, identity switch, Manage link, search, phone indicator, FeedChip
    marks.tsx         AgentMark (real vendor logos from src/assets/vendors), ModelTag, IdentityMark,
                      StatusBadge, ProgressRing
    vendor.ts         VENDOR_COLOR / VENDOR_NAME / useVendor (Work maps every vendor to Claude)
    Transcript.tsx    Claude Code-style rows: user, thinking, text, tool IN/OUT, lead-asks
    Composer.tsx      prompt box (compact or 112px tall), ComposerChip
    menus.tsx         ContextMenu, RenameableName (right-click rename), Segmented, TabStrip
    shared.css        styles for all of the above (prefix wb-)
  pages/<screen>/     one folder per screen: <Screen>Page.tsx, <screen>.css, data.ts (typed sample data)
```

Screens use their own CSS class prefix (`ed-`, `ag-`, `mc-`, `ss-`, `id-`) so their files never collide.

## Identity

`useIdentity()` gives `identity`, `isWork`, `setIdentity`, `vendors` and `vendorFor(v)`. Work mode is
Claude only: marks resolve Codex/Gemini to Claude (the boards' `col()`), Codex/Gemini chips and
accounts are hidden, and sample data swaps to the Claude-only variants each board defines.

## Live data (Mission control)

`useMissionFeed()` polls `GET /api/mc/state` every 1 s through the Vite dev proxy
(`/api/mc` → `http://127.0.0.1:47832`, `changeOrigin` so wb_mc.py's Host check passes). One shared
poller per page; it stops when nothing is subscribed. Read-only: the app never POSTs.

- `live: false` (spike down, error, bad payload) → screens show their design sample data and a
  visible "sample data" chip in the top bar. The last good payload is kept but not shown as live.
- Sessions → Mission cards (`sortSessions`, `sessionTitle`, `workspaceName`), grouped by cwd.
- `agents[]` → Agent cloud and the right panel; `parent_agent_id` builds the tree
  (`buildAgentTree`; null/unknown parent hangs off the lead). `vendorOfModel` picks the mark.
- Fields the feed does not have (progress %, ETA, "should you stay", plans, coordinator) are shown
  as "not reported yet" for live sessions, never invented.

## Responsive

Boards are 1440x900. Below 700 px: the top bar wraps and hides search; side panels stack under the
main column; the Editor's explorer and AI panel become toggled drawers; diagrams (Mission hub,
Agent cloud) switch to stacked lists.

## Not in v0.1

No PTY/terminal, no sending prompts, no Codex/Gemini integration, no real search, no accounts.
The composer only queues text locally.
