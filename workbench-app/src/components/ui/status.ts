/** Display statuses shared by StatusDot, Badge tones and pages. */
export type Status = 'running' | 'idle' | 'attention' | 'done' | 'error' | 'ended' | 'offline'

const LABEL: Record<Status, string> = {
  running: 'Running',
  idle: 'Idle',
  attention: 'Needs you',
  done: 'Done',
  error: 'Error',
  ended: 'Ended',
  offline: 'Offline',
}

/** Map any feed status string ("agents running", "waiting", "ended"...) to a Status. */
export function toStatus(s: string | null | undefined, online = true): Status {
  switch ((s || '').toLowerCase()) {
    case 'running':
    case 'agents running':
    case 'editing':
    case 'reading':
      return 'running'
    case 'waiting':
    case 'needs you':
    case 'question':
    case 'attention':
      return 'attention'
    case 'done':
    case 'ok':
      return 'done'
    case 'error':
    case 'failed':
      return 'error'
    case 'ended':
      return 'ended'
    case 'offline':
      return 'offline'
    default:
      return online ? 'idle' : 'offline'
  }
}

export function statusLabel(s: Status): string {
  return LABEL[s]
}
