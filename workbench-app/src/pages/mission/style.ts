import type { Vendor } from '../../data/types'
import type { WsState } from './model'

export const VENDOR_BG: Record<Vendor, string> = { claude: 'bg-claude', codex: 'bg-codex', gemini: 'bg-gemini' }
export const VENDOR_TEXT: Record<Vendor, string> = { claude: 'text-claude', codex: 'text-codex', gemini: 'text-gemini' }

export function wsStateText(state: WsState, running: number): string {
  return state === 'attention' ? 'needs you' : state === 'running' ? `${running} running` : 'idle'
}

export const WS_STATE_CLASS: Record<WsState, string> = {
  attention: 'text-attention',
  running: 'text-running',
  idle: 'text-3',
}
