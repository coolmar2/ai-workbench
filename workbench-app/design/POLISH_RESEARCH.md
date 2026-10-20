# UI polish research: Hermes Desktop and Devin

Status: Hermes facts are read from source (apps/desktop in github.com/NousResearch/hermes-agent, main). Devin visuals are NOT verified; docs.devin.ai gave only functional text. Lines marked (U) are unverified or my inference.

## 1. Hermes desktop stack (apps/desktop/package.json)
- Electron 40.10 + Vite 8.2 + React 19.2 + TypeScript 6; React Compiler plugin; vitest and Playwright (incl. visual snapshots).
- Styling: Tailwind 4.3.3 (@tailwindcss/vite, @tailwindcss/typography), CSS variables in src/styles.css, `@theme inline`. class-variance-authority, clsx, tailwind-merge. shadcn-style (components.json present).
- Components: `radix-ui` 1.6.7 (single package), `cmdk` (palette), react-arborist (file tree), @dnd-kit, @tanstack/react-virtual, @assistant-ui/react (chat thread), streamdown + shiki (markdown/code), use-stick-to-bottom, CodeMirror 6, xterm, mermaid, d3-force (graphs), driver.js (tours), nanostores state.
- Icons: Tabler (@tabler/icons-react, via src/lib/icons.ts) plus VS Code codicons and lucide-react 0.577.
- Fonts: system UI stack for sans (Segoe UI, -apple-system, SF Pro Text); JetBrains Mono (bundled woff2, 400/700/italic) for mono; "Collapse" Bold for the wordmark only.
- Animation: `motion` 12.42 + CSS keyframes (tw-shimmer for shimmer text).
- Docs: apps/desktop/DESIGN.md is a written design system; worth reading in full.

## 2. Tokens (apps/desktop/src/styles.css)
Key idea: everything derives from one base colour plus alpha. Fills, text and strokes are `color-mix(in srgb, base N%, transparent)`, so they work on any surface.
- Text: primary 94%, secondary 74%, tertiary 54%, quaternary 36% of --ui-base. Transcript scaffold text 64%, meta 44%.
- Strokes (base alpha, plus an accent mix): primary 10%, secondary 7%, tertiary 5% (default hairline), quaternary 3%. Sidebar edge 7.5% light, 12% dark. Overlay hairline `--stroke-nous` = currentColor 3%.
- Fills: quinary 3%, quaternary 4%, tertiary 5%, secondary 7%, primary 10% (+ accent 3-16%). Row hover 3% + 4% accent, row active 5% + 8% accent, control hover 4% + 6%.
- Dark neutrals: chrome #0d0d0e, sidebar #0a0a0b, card #161618. Surface mix: chrome 74%, card 38%, elevated 46% over theme seeds (dark seed values are set by theme JS in src/themes; exact values (U)).
- Accent: light #0053fd. Status: red #cf2d56 (dark #e75e78), orange #db704b, yellow #c08532, green #1f8a65 (dark #55a583), cyan #4c7f8c, purple #9e94d5. Diff add/remove bg = colour at 12%.
- Radius: base 0.75rem, scalar 0.2, so the scale is tiny (xs 0.025rem .. 2xl 0.3rem, computed). Icon buttons 4px, tooltips 0.25rem, composer 0.75rem, text buttons square.
- Type: transcript text 0.8125rem (13px) / 1.125rem line; tool rows 0.6875rem (11px); captions 0.75rem / 1rem. Chat text scale default 110%. Base line-height 1.5.
- Spacing: turn gap 0.375rem, block gap 0.75rem, paragraph gap 0.7rem, tool row gap 0.375rem, file-tree row 1.375rem (22px), composer control 1.5rem (primary 1.625rem), composer input 1.625rem to 9.375rem max, status-stack nesting step 0.25rem.
- Shadows: xs `0 1px 2px` black 5%; sm = 1px ring at 6% fg + `0 2px 8px` 4% black; md = 1px ring 8% + larger blur layers (truncated in my read); lg adds `inset 0 1px 0` white 28% top highlight; --shadow-nous four stacked layers (7/6/6/0%) for floating panels; composer shadow = xs. Inputs: `inset 0 1px 1px` black 10% (light) / 38% (dark).
- Focus: --dt-ring = stroke-primary (soft); composer ring is foreground-based, strength 1 (light) / 1.3 (dark); animated "arc-border" gradient (2px, 2.23s) on composer while busy.
- Motion: row hover 100ms ease-out; chat surface 75ms; scaffold fade 120ms; code card 180ms; input border 200ms; big reveal 420ms cubic-bezier(0.22,1,0.36,1) in, 160ms cubic-bezier(0.32,0.72,0,1) out; tooltip 200ms open delay (300ms warm window), 100ms fade-out, no entrance animation; titlebar shortcut hints after 400ms; no `transition-all` on hot paths; reduced motion respected.
- z-index ladder as named variables (modal 130 .. crash 1500).

## 3. Layout patterns
- Shell: custom titlebar (24px controls, 13.9px icons), sidebar --sidebar-width 14.8125rem (237px), chat min width 28rem, sash resizers with hover highlight (accent 18% border, 6% fill). Optional window translucency (tint 29%).
- Sidebar: flat `ListRow` rows, flush-left, single hairline dividers only when needed; inline padding 1rem.
- Transcript: rows rather than heavy bubbles (user bubble = subtle tinted fill + tertiary hairline, text indent 0.75rem), sticky human message at top, scroll-fade masks top/bottom, stick-to-bottom, last-message clearance = composer height + 2rem. Tool calls are 11px collapsed disclosure rows with a caret that appears on hover; code cards stream in with glow; shiki highlighting; unfocused panes dim to 62-72% opacity and desaturate 20%.
- Composer: floating, rounded, measured height drives layout; directive chips with 500ms hover grace.
- Menus/popovers share menu.ts: shadow-md + stroke-secondary. Tooltips only for discovery, never native `title`; placements by role (control above, toolbar below, row right). ConfirmDialog opens focused on Confirm, blurred backdrop. cmdk palette. EmptyState / PanelEmpty components. Destructive red only for real failures.

## 4. Fifteen implementable details
1. One ink colour; text/fill/stroke are alpha steps (94/74/54/36% text).
2. Hairlines at 5% (default) and 7-12% (panel edges); never solid grey borders.
3. Four-step fill ladder (3/4/5/7%) for hover, active, selected.
4. Hover 100ms ease-out on colour/background only; never transition-all.
5. Small radii (4-6px controls), 12px composer; consistent per role.
6. 13px transcript, 11px tool rows, 22px tree rows, 18px line height: dense but airy.
7. Shadows = 1px ring + soft blur, with a top inset highlight on floating panels.
8. Inset shadow on inputs (`inset 0 1px 1px` black 38%); borderless search with underline on focus.
9. Tooltips: 200ms delay, 300ms warm window, fade-out only, include kbd hints.
10. Shortcut hints revealed after 400ms Ctrl hold.
11. Scroll-fade masks at scroller edges instead of a hard cut.
12. Tool-call rows collapsed by default, caret on hover.
13. Animated gradient arc border on composer while the agent runs; shimmer text for "thinking".
14. Unfocused panes dim; focus visible without borders.
15. Optimistic UI with visible rollback; focus-gated polling; background events never steal focus; Esc closes only the topmost layer.
Also tabular numerals for counts/costs (my addition (U), not seen in source).

## 5. Devin UI (UNVERIFIED, docs only)
docs.devin.ai/get-started/devin-intro confirms only: conversational session UI; a workspace with Shell, IDE (embedded editor) and Browser; reachable from the sidebar or by clicking a progress step in the session. No colours, radii or spacing found. Patterns worth borrowing (U): session list in left sidebar with status dots, chat left + tabbed workspace right, a clickable step timeline that jumps the workspace to the matching tool.

## 6. Recommended foundation (versions verified via `npm view`, 2026-10-16)
- tailwindcss 4.3.3, @tailwindcss/vite 4.3.3
- radix-ui 1.8.1 (single package; Hermes pins 1.6.7)
- lucide-react 1.58.0 (Hermes: 0.577.0; or @tabler/icons-react 3.44.0)
- motion 14.3.0 (Hermes: 12.42.2)
- cmdk 1.1.1, sonner 2.0.8 (toasts), vaul 1.1.2 (optional)
- react-resizable-panels 4.14.5, @tanstack/react-virtual 3.14.21
- class-variance-authority 0.7.1, clsx 2.1.1, tailwind-merge 3.7.0
- @fontsource-variable/inter 5.3.0, @fontsource-variable/jetbrains-mono 5.3.0
Motion 14 and lucide 1.x are newer than Hermes pins; check changelogs, or pin Hermes' versions for a proven combo.

### Starter dark tokens (Hermes alpha-ladder approach, our brand marks)
```css
:root {
  color-scheme: dark;
  --base: #f4f4f5;                        /* ink; text/stroke/fill derive from it */
  --bg-sidebar: #0a0a0b;
  --bg-chrome:  #0d0d0e;
  --bg-card:    #161618;
  --bg-elevated:#1b1b1e;
  --text-1: color-mix(in srgb, var(--base) 94%, transparent);
  --text-2: color-mix(in srgb, var(--base) 74%, transparent);
  --text-3: color-mix(in srgb, var(--base) 54%, transparent);
  --text-4: color-mix(in srgb, var(--base) 36%, transparent);
  --stroke-1: color-mix(in srgb, var(--base) 10%, transparent);
  --stroke-2: color-mix(in srgb, var(--base) 7%, transparent);
  --stroke-3: color-mix(in srgb, var(--base) 5%, transparent);  /* default hairline */
  --fill-1: color-mix(in srgb, var(--base) 10%, transparent);
  --fill-2: color-mix(in srgb, var(--base) 7%, transparent);
  --fill-3: color-mix(in srgb, var(--base) 5%, transparent);    /* row hover */
  --fill-4: color-mix(in srgb, var(--base) 3%, transparent);
  --claude: #e08a62; --codex: #4ec9a0; --gemini: #6aa5ff;
  --running: #e7b84a; --coordinator: #c9a0ff;
  --personal: #6fcf8e; --work: #d9b44a;
  --danger: #e75e78;
  --accent: var(--claude);
  --ring: color-mix(in srgb, var(--accent) 45%, transparent);
  --radius-sm: 4px; --radius-md: 6px; --radius-lg: 10px; --radius-composer: 12px;
  --font-sans: "Inter Variable", "Segoe UI", system-ui, sans-serif;
  --font-mono: "JetBrains Mono Variable", "Cascadia Code", monospace;
  --text-body: 13px; --lh-body: 18px; --text-tool: 11px; --text-caption: 12px;
  --row-h: 22px; --sidebar-w: 237px;
  --shadow-float: 0 0 0 1px var(--stroke-2), 0 4px 16px rgb(0 0 0 / .35), inset 0 1px 0 rgb(255 255 255 / .06);
  --shadow-input: inset 0 1px 1px rgb(0 0 0 / .38);
  --ease-out: cubic-bezier(.22,1,.36,1);
  --dur-fast: 100ms; --dur-med: 180ms;
}
```
Use brand marks for status dots, tab accents and agent-tree nodes only; keep surfaces neutral. Check contrast of --text-4 before using it for body text (U).
