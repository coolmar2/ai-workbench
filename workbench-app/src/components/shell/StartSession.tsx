import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { FolderOpen, Play } from 'lucide-react'
import { Button, Dialog, DialogContent, Input, ListRow, toast } from '../ui'
import { useMissionFeed } from '../../live/mission'
import { startSession } from '../../live/actions'

export interface StartedInfo {
  folder: string
  /** ms epoch when /start answered; the session shows up in /state once claude fires SessionStart. */
  at: number
}

interface StartSessionValue {
  /** Open the dialog, optionally prefilled; onStarted runs after wb_mc started claude. */
  open: (folder?: string, onStarted?: (info: StartedInfo) => void) => void
}

const Ctx = createContext<StartSessionValue | null>(null)

/** Normalise for comparing folders: backslashes, no trailing slash, lower case (Windows). */
// eslint-disable-next-line react-refresh/only-export-components
export function sameFolder(a: string, b: string) {
  const n = (s: string) => s.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()
  return n(a) === n(b)
}

/**
 * "Start a session" for the whole app: one dialog asking for an absolute folder, with folders of past
 * sessions as suggestions. POST /start opens claude (through the terminal wrapper) in a new console window.
 */
export function StartSessionProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false)
  const [folder, setFolder] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const after = useRef<((i: StartedInfo) => void) | undefined>(undefined)
  const feed = useMissionFeed()

  const recent = useMemo(() => {
    const seen: string[] = []
    for (const s of feed.state?.sessions ?? []) if (s.cwd && !seen.some((x) => sameFolder(x, s.cwd))) seen.push(s.cwd)
    return seen.slice(0, 6)
  }, [feed.state])

  const open = useCallback((f?: string, onStarted?: (i: StartedInfo) => void) => {
    setFolder(f ?? '')
    setError(null)
    after.current = onStarted
    setOpen(true)
  }, [])

  const start = async () => {
    const f = folder.trim().replace(/^"(.*)"$/, '$1')
    if (!/^[a-zA-Z]:[\\/]/.test(f) && !f.startsWith('\\\\')) {
      setError('Use a full path, like C:\\Users\\you\\projects\\my-app')
      return
    }
    setBusy(true)
    setError(null)
    const r = await startSession(f)
    setBusy(false)
    if (!r.ok) {
      setError(r.error ?? 'Could not start')
      return
    }
    setOpen(false)
    toast.success('Started claude', { description: `${f}\nIt opens in its own terminal window and shows up here once it starts.` })
    after.current?.({ folder: f, at: Date.now() })
  }

  const value = useMemo(() => ({ open }), [open])
  return (
    <Ctx.Provider value={value}>
      {children}
      <Dialog open={isOpen} onOpenChange={setOpen}>
        <DialogContent
          title="Start a session"
          description="claude starts in this folder, in its own terminal window. You can watch and type to it from here."
          footer={
            <Button icon={<Play />} disabled={busy || !folder.trim()} onClick={start}>
              {busy ? 'Starting…' : 'Start session'}
            </Button>
          }
        >
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              void start()
            }}
          >
            <Input
              autoFocus
              aria-label="Folder"
              placeholder="C:\Users\you\projects\my-app"
              icon={<FolderOpen />}
              value={folder}
              onChange={(e) => setFolder(e.currentTarget.value)}
            />
            {error && <p className="text-caption text-danger">{error}</p>}
            {recent.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-meta text-3">Recent folders</span>
                {recent.map((r) => (
                  <ListRow key={r} leading={<FolderOpen />} onClick={() => setFolder(r)} className="text-caption">
                    {r}
                  </ListRow>
                ))}
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStartSession(): StartSessionValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStartSession outside StartSessionProvider')
  return v
}
