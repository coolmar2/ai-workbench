# UI kit (`src/components/ui`)

Built to `design/POLISH_SPEC.md`. Import everything from the barrel: `import { Button, ListRow } from '../../components/ui'`.
Tokens live in `src/styles/tokens.css` and are exposed as Tailwind classes in `src/styles/index.css`.
The reference page is `src/pages/identity/IdentityPage.tsx`: copy its structure.

## Token classes (the only colours, sizes and shadows that exist)

| Need | Classes |
|---|---|
| Surfaces | `bg-sidebar` `bg-chrome` (page) `bg-card` `bg-elevated` (menus, hover on cards) |
| Text colour | `text-1` primary, `text-2` secondary, `text-3` tertiary, `text-4` quaternary (placeholders, decorative separators only; real content incl. times/counts is `text-3`) |
| Hairlines | `border-stroke-3` default, `border-stroke-2` panel edges, `stroke-1` strong, `stroke-4` faint; `divide-stroke-3` |
| Fills | `bg-fill-4` subtle, `bg-fill-3` hover, `bg-fill-2` selected/pressed, `bg-fill-1` strong |
| Brand / status | `claude codex gemini running coordinator personal work danger attention success info accent` as `text-*`, `bg-*`; tints `bg-claude/12` (max 12%) |
| Type | `text-hero` 20/28, `text-title` 15/20, `text-body` 13/18, `text-caption` 12/16, `text-meta` 11/14, `text-code` 12/18 (+ `font-mono`); `caps` = 11px uppercase label; `tabular-nums` |
| Radii | `rounded-sm` 4 (icon buttons, badges) `rounded-md` 6 (buttons, inputs, items) `rounded-lg` 8 (cards, menus) `rounded-composer` 12 |
| Elevation | `shadow-float` (menus, popovers, dialogs, toasts) `shadow-input` (inputs); cards are flat |
| Motion | `transition-colors-fast` (100ms colour/bg), `animate-pop-in` (menus), `animate-fade-in` (list items), `animate-pulse-soft` (running), `animate-shimmer` |
| Scroll | `fade-mask` (used by ScrollArea) |
| Focus | one ring: `:focus-visible` outline in base.css (`--ring`); fields use `shadow-focus` (= `--shadow-focus`). Never write your own ring. |

## Components (one line each)

- `cn(...classes)` - merge classes; later Tailwind classes win. Knows our tokens.
- `Button` `{variant: primary|secondary|ghost|danger, size: sm(24)|md(28), icon?, asChild?}` - every text button. One `primary` per screen.
- `IconButton` `{label (required, becomes tooltip + aria-label), icon, shortcut?, tooltipSide?, active?, size: sm|md(24)|lg(32)}` - every icon-only button.
- `Input` `{size: sm|md, icon?, trailing?}` / `Textarea` - text fields with inset shadow and focus ring; `aria-invalid` shows danger.
- `Badge` `{tone: neutral|outline|claude|codex|gemini|running|coordinator|personal|work|success|attention|danger|info, caps?}` - status words, counts, stat pills, identity tags.
- `StatusDot` `{status: running|idle|attention|done|error|ended|offline, decorative?}` - 6px dot; `toStatus(feedStatus, online)` maps feed strings; `statusLabel(s)`.
- `Kbd` `{children: "Ctrl K"}` or `{keys: ['Ctrl','K']}` - shortcut hints.
- `Tooltip` `{content, shortcut?, side?: top|bottom|right|left}` - discovery tooltips (200ms). `TooltipProvider` is mounted in App.
- `DropdownMenu*` (`Content`, `Item {icon?, shortcut?, danger?}`, `CheckboxItem`, `RadioGroup/RadioItem`, `Label`, `Separator`, `Sub*`) - click menus.
- `ContextMenu*` (`Trigger`, `Content`, `Item`, `Label`, `Separator`) - right-click menus (rename etc.), same look.
- `Tabs` / `TabsList {size?: md|sm}` / `TabsTrigger {icon?, count?}` / `TabsContent` - 32px underline tabs; `<TabsList size="sm">` = 28px, 11px caps meta style (no `!` overrides needed).
- `Dialog` / `DialogTrigger` / `DialogContent {title, description?, footer?, width?, hideTitle?}` / `DialogClose` - modal with blurred backdrop.
- `ConfirmDialog` `{open, onOpenChange, title, description?, confirmLabel?, danger?, onConfirm}` - confirm, opens focused on Confirm.
- `ScrollArea` `{orientation?: vertical|horizontal|both, fade?}` - every scroller; thin bar + fade masks (top/bottom for vertical, left/right for `horizontal`, all for `both`) so chip/tab strips fade instead of being cut. Vertical needs a bounded height (`flex-1`).
- `Panel` - flex column pane. `PanelHeader {title, icon?, count?, actions?, divider?}` - 32px caps header with actions right.
- `Card {interactive?}` - flat bg-card + hairline + 8px radius; `interactive` for clickable cards (session cards).
- `PageHeader {title, description?, meta?, actions?, hero?, as?: h1|h2|h3}` - title block at the top of page content (`actions` right-aligned; `as` for sub-sections).
- `Separator {vertical?}` - hairline divider.
- `ListRow` `{leading?, trailing?, selected?, depth?, dense?(22px), asChild?}` - every list/tree row; `asChild` with a `<Link>` child.
- `EmptyState` `{icon?, title, hint?, action?, compact?, error?}` - empty and error states (one line each).
- `Skeleton` (size with classes) / `SkeletonRows {rows}` / `Spinner` - loading states. Prefer skeletons for content.
- `Toaster` (mounted in App) + `toast('..')`, `toast.success/error(..)` - transient feedback, bottom-right.
- `Command*` / `CommandDialog {open, onOpenChange, placeholder}` - cmdk primitives; the app palette is `shell/CommandPalette`.
- `AgentMark` `{vendor, size: 10|14|18, respectIdentity?, activity?: editing|reading, label?}` - Claude circle / Codex square / Gemini triangle.
- `IdentityMark {identity}` - Personal dot / Work square.
- `ResizableSplit {orientation}` / `ResizablePane {id, defaultSize, minSize, maxSize, collapsible}` / `ResizeHandle {orientation?}` - multi-pane layouts (numbers = px, strings = %).
- `Switch` - on/off (pair with a `<label htmlFor>`).
- `SegmentedControl {value, onValueChange, options[{value,label,icon?}], label, size?, full?}` - one-of-few choices (identity, view modes).
- `Popover*` - click-opened floating panel (pickers). `HoverCard*` - hover preview (Editor edit highlights).
- `Disclosure {summary, caretOnHover?, size?: meta|body}` - collapsible rows (tool calls, collapsed by default).
- `useMediaQuery(query)` / `useElementWidth(ref)` - shared hooks (drop page-local copies). `shell/context` re-exports `useMediaQuery`.
- `Composer` `{value, onChange, onSubmit(text), placeholder?, label?, disabled?, disabledReason?, models?: {value,label,icon?}[], model?, onModelChange?, running?, onStop?, leftExtra?, rightExtra?, onAttach?, onHeightChange?(px incl. 12px gap), className?, maxWidthClass?}` - THE message box (floating, absolute bottom of a `relative` parent; 12px radius, auto-grow to 200px). Enter sends, Shift+Enter newline. `disabledReason` disables Send and shows the reason in its tooltip; `running` shows Stop. Attach button only when `onAttach` is given; model chip only when `models` is given.
- `Markdown {children: string, className?}` - safe renderer (paragraphs, bold, italic, inline code, fenced blocks, lists, headings as semibold body, http(s)/mailto links in a new tab). No HTML ever.
- `TranscriptUserBlock {text, time?}`, `TranscriptAssistantText {text}` (Markdown), `TranscriptThinkingRow {text?}`, `TranscriptToolRow {name, detail?, input: string[], output?: {text,tone?}[], dot?: muted|ok|running|error, lead?, children?}`, `TranscriptHandoffRow {target?, vendor?, input, output?, onOpenAgent?(name)}` - transcript rows; map `TranscriptRow` kinds onto them.
- `Sheet` / `SheetTrigger` / `SheetClose` / `SheetContent {title, hideTitle?, description?, side?: left|right (right), width? (class, default w-[min(420px,92vw)]), showClose?}` - side drawer on Radix Dialog: modal, focus trap, Esc closes only the top layer, scrim click closes.
- `Eta {eta (McEta|null|undefined), variant: inline|pill|detail, label?}` - honest ETA for a running turn/agent from the feed's `eta`: "~2 min left · 10:52" (inline), "~2m" (pill), big text + finish time + slim bar + elapsed + basis (detail). Low confidence shows a range with a "rough" tag, overrun is amber "Taking longer than usual", renders nothing without an estimate, counts down locally (never negative, "any moment" under 10 s), tooltip explains the basis. `etaView(eta, nowMs)`, `formatShort`, `formatDuration` are the pure helpers.
- `RelativeTime {t}` - ticking "now / 12m / 3h" for feed times; helpers `relativeTime(t, now)`, `parseFeedTime`, `useNow(ms)`.

Shell (in `src/components/shell`): `PageActions` (portal page buttons/chips into the top strip's right slot),
`ShellCrumbs {items}` (override the derived breadcrumb), `useShell()` (`openPalette`, `toggleSidebar`, `drawer`).
The shell owns `<main>`; a page returns a `div`/fragment that fills it (`flex-1 min-h-0`), never its own top bar.

## 10 rules for page agents

1. Use only the kit and token classes. No hex/rgb values, no new CSS files, no inline colour styles, no Tailwind default palette (it is removed on purpose).
2. Text is `text-1..4` on the alpha ladder; borders are hairlines (`border-stroke-3`, panel edges `stroke-2`). Never solid grey borders.
3. Brand colours only for marks, status dots, small accents, the focus ring and the one `primary` Button; tints max `/12`.
4. Type sizes only from the scale: body 13, caption 12, meta/tool rows 11, page title 15 semibold, hero 20. Ids, paths, ports and code use `font-mono text-code`. Every number, time and count gets `tabular-nums`.
5. 4px spacing grid; rows 28px (`ListRow`), tree rows 22px (`dense`); panel padding 12-16px; gaps 8/12/16/24.
6. Never the native `title` attribute: use `Tooltip` (IconButton already has one). Icons are lucide, 14px (16px in rails), stroke 1.5 is global.
7. Every interactive element needs hover, focus-visible and disabled states; build it from Button/IconButton/ListRow/menus, not raw `<div onClick>`.
8. Every scroller is a `ScrollArea`; every multi-pane page uses `ResizableSplit`; nothing may overflow at 1440, 1280, 1024, 768 or 375 widths (stack or collapse panes on narrow screens).
9. Live data always has three states: loading (`Skeleton`/`SkeletonRows`), empty and error (`EmptyState`, `error` for failures). Never invent data the feed lacks: say "not reported".
10. Transitions are colour/background only (`transition-colors-fast`), never `transition-all`; menus and panels 160ms, list items 180ms; respect reduced motion (global CSS + `MotionConfig` already do). Delete the page's old `.css` file when it is rebuilt.
