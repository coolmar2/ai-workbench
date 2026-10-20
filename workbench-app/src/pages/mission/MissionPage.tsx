import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Folder, MessageSquare, PanelLeft, Plus, Radio, WifiOff } from 'lucide-react'
import { useIdentity } from '../../context/identity'
import { PageActions } from '../../components/shell/PageActions'
import { Badge, Button, EmptyState, IconButton, ScrollArea, Sheet, SheetContent, Skeleton, useMediaQuery } from '../../components/ui'
import { useMissionFeed } from '../../live/mission'
import { useStartSession } from '../../components/shell/StartSession'
import { CoordinatorPanel } from './CoordinatorPanel'
import { Hub, MoreList, type CoordinatorInfo } from './Hub'
import { WorkspaceRail } from './Rail'
import { clock12, liveWorkspaces, sampleWorkspaces, summarize, type Workspace } from './model'

export default function MissionPage() {
  const feed = useMissionFeed()
  const { isWork } = useIdentity()
  const startSession = useStartSession()
  // `?sample=1` forces the design sample data even when the feed answers (screenshots, demos).
  const FORCE_SAMPLE = useSearchParams()[0].has('sample')
  const [t0] = useState(() => Date.now())
  const [sel, setSel] = useState<string | null>(null)
  const [railOpen, setRailOpen] = useState(false)
  const [feedOpen, setFeedOpen] = useState(false)

  const smallVp = useMediaQuery('(max-width: 799px)')
  // Below 1280px the coordinator panel moves into a drawer so the cards get the room.
  const midVp = useMediaQuery('(max-width: 1279px)')

  // Keep the last good data when the feed drops (stale); sample data only when it never answered.
  const live = !!feed.state && !FORCE_SAMPLE
  const stale = live && feed.stale
  const sessionCount = feed.state?.sessions.length ?? 0
  const workspaces = useMemo<Workspace[]>(
    () => (live && feed.state ? liveWorkspaces(feed.state.sessions, feed.lastOk ?? t0) : sampleWorkspaces(isWork, t0)),
    [live, feed.state, feed.lastOk, isWork, t0],
  )
  const sample = !live

  let chipText = 'Sample data'
  let chipTone: 'success' | 'outline' = 'outline'
  let ChipIcon = WifiOff
  if (stale) chipText = 'Stale'
  else if (live) {
    ChipIcon = Radio
    chipText = sessionCount > 0 ? 'Live' : 'No sessions yet'
    if (sessionCount > 0) chipTone = 'success'
  }

  const actions = (
    <PageActions>
      <Badge tone={chipTone}>
        <ChipIcon aria-hidden className="size-3" />
        {chipText}
      </Badge>
    </PageActions>
  )

  if (!feed.checked) {
    return (
      <div role="status" aria-label="Loading sessions" className="flex min-h-0 flex-1">
        {actions}
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Skeleton className="h-10 w-full rounded-lg" />
          <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[196px] rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const ws = workspaces.find((w) => w.name === sel) ?? workspaces[0]
  if (!ws) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {actions}
        <EmptyState
          icon={<Radio />}
          title="No sessions yet"
          hint="The feed is up. Sessions appear here as soon as one starts."
          action={
            <Button icon={<Plus />} onClick={() => startSession.open()}>
              New session
            </Button>
          }
        />
      </div>
    )
  }

  const all = [...ws.sessions, ...ws.ended]
  const sum = summarize(ws.sessions)
  const info: CoordinatorInfo | null = sample ? { model: 'Haiku 5.5', watching: ws.sessions.length, lastNote: '2 min ago' } : null

  const rail = (close?: () => void) => (
    <WorkspaceRail
      workspaces={workspaces}
      selected={ws.name}
      onSelect={(n) => setSel(n)}
      onNewWorkspace={() => startSession.open()}
      onNavigate={close}
      className="h-full"
    />
  )
  const panel = <CoordinatorPanel workspace={ws.name} sample={sample} t0={t0} className="h-full" />

  const summary =
    sum.allDone != null || sum.needs != null ? (
      <p className="text-caption text-2 tabular-nums">
        {sum.allDone != null && (
          <>
            All done about <b className="font-semibold text-1">{clock12(sum.allDone)}</b>
          </>
        )}
        {sum.allDone != null && sum.needs != null && ' · '}
        {sum.needs != null && (
          <>
            {sum.allDone != null ? 'first one needs you ' : 'Needs you '}
            {sum.needs === 'now' ? (
              <b className="font-semibold text-attention">now</b>
            ) : (
              <>
                at <b className="font-semibold text-attention">{clock12(sum.needs)}</b>
              </>
            )}
          </>
        )}
      </p>
    ) : null

  return (
    <div className="flex min-h-0 flex-1">
      {actions}
      {!smallVp && <div className="w-[220px] shrink-0 border-r border-stroke-2">{rail()}</div>}

      <div className="flex min-w-0 flex-1 flex-col bg-chrome">
        <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-stroke-2 px-4 py-2.5 min-[800px]:px-6">
          {smallVp && <IconButton label="Workspaces" icon={<PanelLeft />} onClick={() => setRailOpen(true)} />}
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="truncate text-title font-semibold text-1">{ws.name}</h1>
            <span className="truncate text-caption text-3 tabular-nums">
              {ws.placeholder ? 'sample workspace' : 'workspace folder'} · {all.length} {all.length === 1 ? 'session' : 'sessions'}
            </span>
          </div>
          <div className="min-w-0 flex-1 text-right min-[1100px]:text-center">{summary}</div>
          {midVp && <IconButton label="Coordinator feed" icon={<MessageSquare />} onClick={() => setFeedOpen(true)} />}
          <NewSessionButton ws={ws} live={live} size="md" variant="primary" />
        </header>

        <ScrollArea className="min-h-0 flex-1">
          {stale && (
            <EmptyState
              compact
              error
              icon={<WifiOff />}
              title="Feed offline"
              hint="wb_mc.py is not answering. Showing the last data it sent; it may be out of date."
              className="m-4 rounded-lg border border-stroke-3"
            />
          )}
          {!live && !FORCE_SAMPLE && (
            <EmptyState
              compact
              error
              icon={<WifiOff />}
              title="Feed offline"
              hint="wb_mc.py is not answering. Showing design sample data until it is back."
              className="m-4 rounded-lg border border-stroke-3"
            />
          )}
          {ws.sessions.length > 0 ? (
            <Hub sessions={ws.sessions} info={info} sample={sample} list={smallVp} />
          ) : ws.ended.length === 0 ? (
            <EmptyState
              icon={<Folder />}
              title={ws.placeholder ? 'Sample workspace, no sessions to show' : 'No running sessions'}
              hint={ws.placeholder ? 'Only the first sample workspace has sessions.' : 'Sessions appear here as soon as one starts.'}
              action={<NewSessionButton ws={ws} live={live} />}
            />
          ) : (
            <EmptyState icon={<Folder />} title="Nothing running here" hint="Only ended sessions, listed below." />
          )}
          {ws.ended.length > 0 && (
            <div className="px-4 pb-4 min-[800px]:px-6">
              <MoreList sessions={ws.ended} label={`${ws.ended.length} ended ${ws.ended.length === 1 ? 'session' : 'sessions'}`} />
            </div>
          )}
        </ScrollArea>
      </div>

      {!midVp && <div className="w-[300px] shrink-0 border-l border-stroke-2">{panel}</div>}

      <Sheet open={railOpen && smallVp} onOpenChange={setRailOpen}>
        <SheetContent side="left" title="Workspaces" hideTitle width="w-[min(280px,88vw)]">
          {rail(() => setRailOpen(false))}
        </SheetContent>
      </Sheet>
      <Sheet open={feedOpen && midVp} onOpenChange={setFeedOpen}>
        <SheetContent side="right" title="Coordinator" hideTitle width="w-[min(340px,92vw)]">
          {panel}
        </SheetContent>
      </Sheet>
    </div>
  )
}

/**
 * "New session in <workspace>": opens the app's Start-session dialog, prefilled with the workspace folder
 * for a live workspace (sample workspaces have no real folder, so it opens empty).
 */
function NewSessionButton({ ws, live, size, variant }: { ws: Workspace; live: boolean; size?: 'md'; variant?: 'primary' }) {
  const { open } = useStartSession()
  return (
    <Button size={size} variant={variant} icon={<Plus />} onClick={() => open(live && ws.path ? ws.path : undefined)}>
      New session in {ws.name}
    </Button>
  )
}
