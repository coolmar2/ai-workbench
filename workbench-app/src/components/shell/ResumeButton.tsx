import { useState } from 'react'
import { History } from 'lucide-react'
import { Button, toast } from '../ui'
import { resumeSession } from '../../live/actions'
import type { McSession } from '../../data/types'

/**
 * "Resume" for a past session: runs `claude --resume <id>` in its folder through the terminal wrapper (new
 * console window). Once claude starts, the session is live again and can be typed to from the app.
 */
export function ResumeButton({ session, size = 'md' }: { session: McSession; size?: 'sm' | 'md' }) {
  const [busy, setBusy] = useState(false)
  const resume = async () => {
    setBusy(true)
    const r = await resumeSession(session.cwd, session.session_id)
    setBusy(false)
    if (r.ok) toast.success('Resuming the session', { description: 'claude opens in its own terminal window and goes live here once it starts.' })
    else toast.error(`Could not resume: ${r.error ?? 'unknown error'}`)
  }
  return (
    <Button size={size} variant="primary" icon={<History />} disabled={busy} onClick={() => void resume()}>
      {busy ? 'Resuming…' : 'Resume'}
    </Button>
  )
}
