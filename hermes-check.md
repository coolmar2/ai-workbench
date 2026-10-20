# Hermes Agent check (2026-10-16, read-only)

## 1. Subscription login per vendor

| Vendor | How Hermes does it | Vendor terms |
|---|---|---|
| Anthropic | `auth_type="api_key"` in `hermes_cli/auth.py`; env `CLAUDE_CODE_OAUTH_TOKEN` is "NOT an API key" and routed down the OAuth path. [Providers docs](https://hermes-agent.nousresearch.com/docs/integrations/providers): "browser OAuth via `hermes model`", and it **borrows Claude Code's stored login** if no Hermes grant exists (`auth.adopt_external_logins: false` turns that off). Docs say it works only on Max **with purchased extra usage credits**, not the base allowance. | **Not allowed.** [Claude Code legal page](https://code.claude.com/docs/en/legal-and-compliance): OAuth is for ordinary use of Claude Code and native apps; third parties may not route requests through consumer plan credentials (per search summary; page not fully read). Press: enforcement since Feb–Apr 2026 ([Gigazine](https://gigazine.net/gsc_news/en/20260220-anthropic-third-party-block)). Hermes's own use of the token = the prohibited pattern. |
| OpenAI/Codex | `openai-codex`, `oauth_external` in `PROVIDER_REGISTRY`; ChatGPT device-code or PKCE OAuth, stored in `~/.hermes/auth.json`; can import `~/.codex/auth.json`. No Codex CLI needed. | Ambiguous, tolerated. No explicit OpenAI ban found; generic "automated use" language only. Sources are secondary ([Zylos](https://zylos.ai/research/2026-07-13-subscription-auth-boundaries-official-cli-agent-automation)). UNVERIFIED against OpenAI's live terms. |
| Google/Gemini | API key only. Docs: "no way to sign in to Hermes with a consumer Gemini subscription." Vertex uses ADC/service account. | N/A for subscription. Google reportedly forbids piggybacking on Gemini CLI OAuth (secondary quote; UNVERIFIED). |

Other OAuth providers in registry: nous, xai-oauth, qwen-oauth, minimax-oauth. `hermes proxy`: official docs describe only Nous Portal as an adapter; passthrough of `/v1/chat/completions`, `/embeddings`, `/models`, no tools ([docs](https://hermes-agent.nousresearch.com/docs/user-guide/features/subscription-proxy)). A third-party guide claims Claude/ChatGPT work via proxy: UNVERIFIED, contradicts official docs.

Only subprocess-style provider found: `copilot-acp` (spawns `copilot --acp --stdio`, uses the CLI's own login). No equivalent for claude/codex/gemini found in the provider table.

## 2. Can Hermes drive the official `claude` CLI?

Partly, not as a provider. Hermes is an ACP **server** ([ACP docs](https://hermes-agent.nousresearch.com/docs/user-guide/features/acp)), not an ACP client. Search results show a bundled skill `skills/autonomous-ai-agents/claude-code/SKILL.md` ("Delegate coding to Claude Code CLI"), i.e. Hermes's terminal tool runs `claude` under the user's own login; plus third-party bridges (`hermes-claude-bridge`, runs `claude -p`). I did not read the SKILL.md itself: UNVERIFIED in detail. This route (unmodified binary, user's login) matches Anthropic's allowed pattern, unlike Hermes's own token use.

## 3. Desktop plugin API

[Desktop Plugin SDK](https://hermes-agent.nousresearch.com/docs/developer-guide/desktop-plugin-sdk): single ESM `$HERMES_HOME/desktop-plugins/<id>/plugin.js`, hot-reloaded, no build; imports limited to `@hermes/plugin-sdk`, `react`, `react/jsx-runtime`. `register(ctx)` can add panes (main/left/right/top/bottom), full routes + sidebar nav, status/title bar items, settings page, session rows, ⌘K, keybinds. `ctx`: `rest()` to `/api/plugins/<id>`, `socket()`, `onEvent()`, `storage`, `os.*`; `host.sessions`, `host.request` (JSON-RPC), `SandboxedFrame` (opaque-origin iframe).

- Local JSONL file: no documented filesystem read or arbitrary `fetch` to localhost. Workable indirect route: a Python backend (`plugin_api.py` in the unified package) reads the JSONL and serves it via `ctx.rest`/`ctx.socket`; or embed a local server page in `SandboxedFrame`. Both UNVERIFIED (last ~16k chars of the SDK page unread; no test run).
- Desktop plugin is Hermes Desktop only; it would not give a phone-reachable view by itself.

## 4. Verdict

- **Base: no.** Rule (1) fails for Claude (Hermes's token use is the prohibited pattern) and Gemini (no subscription login); Codex only works in a grey area.
- **Optional worker: possible**, only for Hermes running `claude` as an unmodified CLI under Omar's own login, with Hermes's Anthropic OAuth and `adopt_external_logins` turned off.
- **Reference only** for the rest: the plugin SDK/pane model and Kanban/session ideas are worth studying; Mission control is better built in the PTY app.
