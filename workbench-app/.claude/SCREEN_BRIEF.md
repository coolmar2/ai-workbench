# Common rules for every screen agent

App: C:\Users\omar\Downloads\workbench-app (Vite + React 19 + TS, plain CSS, React Router 7). Read
ARCHITECTURE.md and every file in src/components/, src/context/, src/data/types.ts, src/live/mission.ts,
src/styles/ first. Those are SHARED and owned by the lead: import them, NEVER edit them. If a shared
component is missing something, work around it locally in your folder and mention it in your report.

Design source: C:\Users\omar\Downloads\ai-workbench-brain-dump\design\<Board>.dc.html (read-only). It is a
custom canvas format: `<sc-for list="{{x}}" as="m">` = map, `<sc-if value="{{x}}">` = conditional,
`{{hole}}` = value from `renderVals()` in the `<script type="text/x-dc">` class at the bottom,
`this.state`/`this.setState` = local state. Port it to React faithfully: same layout, sizes, colours,
copy text, and behaviour (hover cards, click-to-pin, right-click menus, toggles, tabs, Work-mode
differences). The top bar in the board is replaced by the shared <TopBar/> (it already has the identity
switcher; do not port the board's own).

Rules:
- Only create/edit files inside your own folder src/pages/<screen>/ . Do not touch package.json, App.tsx
  or other screens. The page component file name and default export already exist as a placeholder.
- CSS: one <screen>.css in your folder, every class prefixed with your prefix. Use the CSS variables from
  src/styles/tokens.css instead of hex literals where a token exists. Inline style only for data-driven
  values (percentages, positions, vendor colours).
- Sample data: a typed src/pages/<screen>/data.ts using types from src/data/types.ts (add local types in
  that file when needed). No sample strings hard-coded in JSX beyond static labels/captions.
- Identity: `useIdentity()` from src/context/identity. Work = Claude only: use `<AgentMark vendor=...>`
  (it already maps to Claude in Work) and the board's Work-variant data; hide Codex/Gemini where the
  board hides them.
- Vendor marks: only the shared AgentMark / ModelTag / ProgressRing. AgentMark draws the real vendor logos; never inline a logo elsewhere.
- Accessibility basics: real <button>s for clickable things, aria-labels on icon-only buttons,
  hover cards also reachable by focus/click, no keyboard traps.
- Responsive: desktop must match the 1440x900 board. Below 700px wide (media query max-width: 699px):
  no horizontal page scroll, panels stack vertically, diagrams become stacked lists, text must not
  overlap. Between 700 and 1440 it may scroll or squeeze but must not overlap.
- The screen fills the space under the top bar: render `<TopBar .../>` then `<main className="app-screen ...">`.
  Inner regions scroll themselves (overflow:auto) instead of being cut off.
- Read-only build: no network calls except via useMissionFeed() (Mission screens only). Buttons with no
  backend yet may do nothing visible or set local state; never fake a server.
- When done run, from the app folder: `npx tsc -b` and `npx eslint src/pages/<screen>` and fix every
  error and warning in your files. Do not run `npm install`, do not start the dev server (the lead does
  browser checks). Do not git init or commit.
- Report in under 150 words: files created, what is interactive, what you could not port, anything you
  needed from shared components.
