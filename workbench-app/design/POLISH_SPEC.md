# Polish spec (decided) — every agent builds to this

Reference: Hermes desktop (see POLISH_RESEARCH.md). Goal: quiet, dense, precise, near-black UI where the
content is the colour. Nothing should look like a mockup: no placeholder boxes, no ad-hoc colours, no
native `title` tooltips, no layout that only works at 1440x900.

## Foundation (exact versions)
tailwindcss 4.3.3 + @tailwindcss/vite 4.3.3 · radix-ui 1.6.7 · lucide-react 0.577.0 · motion 12.42.2 ·
cmdk 1.1.1 · sonner 2.0.8 · react-resizable-panels 4.14.5 · class-variance-authority 0.7.1 · clsx 2.1.1 ·
tailwind-merge 3.7.0 · @fontsource-variable/inter 5.3.0 · @fontsource-variable/jetbrains-mono 5.3.0.
Tokens live in `src/styles/tokens.css` (the starter set in POLISH_RESEARCH.md §6, extended) and are exposed
to Tailwind via `@theme inline`. Components use Tailwind classes that reference tokens only.
Old per-page CSS files are deleted as each page is rebuilt.

## Visual rules
- Surfaces: sidebar #0a0a0b, chrome #0d0d0e, cards #161618, elevated #1b1b1e. One ink colour; text,
  strokes and fills are alpha steps of it (text 94/74/54/36%, strokes 10/7/5/3%, fills 10/7/5/3%).
- Borders are hairlines (stroke-3 default, stroke-2 for panel edges). Never solid grey borders.
- Brand colours (Claude #e08a62, Codex #4ec9a0, Gemini #6aa5ff, running #e7b84a, coordinator #c9a0ff,
  Personal #6fcf8e, Work #d9b44a, danger #e75e78) only for marks, status dots, small accents, focus ring,
  the one primary button. Never as large fills; tinted backgrounds max 12% alpha.
- Type: Inter Variable 13px/18px body, 12px captions, 11px meta/tool rows, 15px/20px semibold page
  titles, 20px/28px semibold for the rare hero heading. JetBrains Mono 12px for code, ids, paths, ports.
  `font-variant-numeric: tabular-nums` on every number, time and count.
- Spacing on a 4px grid. Rows 28px (lists), 22px (file tree). Panel padding 12–16px. Gaps 8/12/16/24.
- Radii: 4px icon buttons/badges, 6px buttons/inputs/menu items, 8px cards/menus, 12px composer.
- Elevation: menus/popovers/dialogs use --shadow-float (1px ring + soft blur + top inset highlight).
  Inputs use --shadow-input. Cards are flat (hairline only).
- Icons: lucide-react, 14px (16px in the nav rail), strokeWidth 1.5, colour text-2, text-1 on hover.
- Motion: colour/background transitions 100ms ease-out (never `transition-all`); panels/menus 160ms
  fade+2px slide (motion); list items appearing: 180ms fade; respect prefers-reduced-motion.
- Status dots: 6px; running = amber with a soft 1.6s pulse; idle = text-4; needs you = danger-ish
  orange #db704b; ended/offline = hollow ring.
- Scrollers get thin scrollbars (6px, fill-1 thumb) and top/bottom fade masks.

## Kit (src/components/ui) — build once, use everywhere
Button (variants: primary, secondary, ghost, danger; sizes sm 24px, md 28px), IconButton (24px,
tooltip required), Input/Textarea (shadow-input, 6px radius, focus ring), Badge, StatusDot, Kbd,
Tooltip (Radix, 200ms delay, placement by role, may include Kbd), DropdownMenu + ContextMenu (Radix,
shadow-float, 28px items with icon + label + shortcut), Tabs (underline style, 32px), Dialog
(blurred backdrop), ScrollArea (fade masks), Panel/PanelHeader (title 11px uppercase tracking 0.06em
text-3, actions on the right), ListRow (28px, hover fill-3, selected fill-2 + 2px accent bar on the
left), EmptyState (icon, one line title, one line hint, optional action), Skeleton (shimmer),
Toaster (sonner, bottom-right), CommandPalette (cmdk, Ctrl+K: navigate pages, switch identity,
jump to session), AgentMark (Claude circle / Codex rounded square / Gemini triangle, sizes 10/14/18),
ResizableSplit (react-resizable-panels with a 1px hairline handle that highlights on hover).

## App shell (replaces the old top nav bar)
- Left sidebar 237px (collapsible to a 48px icon rail; collapsed automatically under 900px, a drawer
  under 700px): app wordmark "Workbench" at top; primary nav rows (Agent, Editor, Mission control) with
  icons and Kbd hints on hover; a "Workspaces" section listing workspaces with nested live sessions
  (status dot + name + relative time), "+ New session"; footer with the identity switcher
  (Personal | Work segmented control showing the account line) and a settings/identity link.
- Top strip 40px inside the main area: breadcrumb (Workspace › Session), page actions on the right,
  a search button that opens the command palette (shows "Ctrl K").
- Main content in resizable panes where the page has more than one.

## Pages (behaviour from the original design boards stays; only the look and structure change)
- Mission control: workspace header (name, path, live/sample chip, counts as tabular numbers); session
  cards in a responsive grid (not hand-placed around a hub) with status, lead model mark, current tool,
  last prompt (2 lines, clamp), agents count and a mini agent tree; the coordinator is a slim card at
  the top. Clicking a card opens the session. Live data from /api/mc/state as today.
- Session: two panes — transcript (Hermes-style rows: user message as subtle tinted block, assistant
  text plain, tool calls as 11px collapsed disclosure rows with caret on hover, sub-agent handoffs as
  indented rows with the agent mark) and a right panel (selected agent: header, Plan and output /
  Messages tabs). Summary strip becomes a compact row of stat pills. Conversation | Agent cloud as Tabs.
  Floating composer at the bottom (12px radius, measured height, toolbar with model chip, attach, stop).
- Agent cloud: proper graph on a dotted-grid canvas with pan/zoom (CSS transform is fine), nodes as
  cards with AgentMark + name + model + state, curved SVG edges (stroke-2, running edges animated
  dash), message chips on edges. Auto-layout from parent_agent_id (simple tree layout), not hand-placed.
- Editor: three resizable panes (Explorer 240px | code | AI panel 380px) + bottom panel (Workers,
  Terminal, Problems, Git as Tabs). Code view with line numbers, JetBrains Mono 12px, edit highlights
  as 12% tinted rows with a 2px left bar; hover card = Radix HoverCard with shadow-float. File tree
  22px rows with lucide file/folder icons and the tiny agent dots.
- Agent: centered chat column (max 760px) like Claude/Hermes; sessions list lives in the sidebar;
  workers/accounts as a compact right rail that collapses.
- Identity: two account cards side by side (stack on mobile), segmented active state, the Remote
  Control row as a proper Switch.

## Quality bar (checked by the reviewer)
No overflow or overlap at 1440, 1280, 1024, 768, 375 widths. Every interactive element has hover,
focus-visible and disabled states. Keyboard: Tab order sane, Esc closes the top layer, Ctrl+K works.
Empty, loading (skeleton) and error states exist for live data. No console errors. `npm run build`
and `npm run lint` clean.
