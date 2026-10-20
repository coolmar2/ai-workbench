import { AgentMark } from '../../../components/ui'
import { useEditorApi } from '../editorApi'
import { modelUri } from '../modelUri'
import { useActivity, type ActivityItem } from './engine'

const PHASE: Record<ActivityItem['phase'], string> = { pending: 'pending', applied: 'applied', 'no-result': 'no result', 'not-applied': 'not applied' }
const hms = (ms: number) => new Date(ms).toTimeString().slice(0, 8)

/** AGENT EDITS panel tab: recent edits agents made (newest first); a click jumps to the file and line. */
export function AgentEditsView({ root }: { root: string }) {
  const all = useActivity()
  const api = useEditorApi()
  const rows = all.filter((i) => i.root === root || i.root === null).slice().reverse()

  const jump = (it: ActivityItem) => {
    if (!it.root || !it.rel) return
    const line = it.line ?? undefined
    api.openFile(it.root, it.rel, { preview: true, line })
    if (!line) return
    // The file may already be on screen, where the reveal request would not be picked up.
    setTimeout(() => {
      const ed = api.getEditor(it.root!)
      if (ed?.getModel()?.uri.toString() === api.monaco?.Uri.parse(modelUri(it.root!, it.rel!)).toString()) {
        ed!.revealLineInCenter(line)
        ed!.setPosition({ lineNumber: line, column: 1 })
      }
    }, 0)
  }

  if (!rows.length) return <div className="vsc-empty">No agent edits yet. Edits agents make in this workspace show up here as they happen.</div>
  return (
    <div className="wbpb-list" role="list" aria-label="Recent agent edits">
      {rows.map((it) => {
        const name = it.file.split('/').pop() ?? it.file
        const dir = it.file.slice(0, it.file.length - name.length).replace(/\/$/, '')
        const clickable = !!it.root && !!it.rel
        return (
          <div
            key={it.id}
            role="listitem"
            className="wbpb-item"
            data-clickable={clickable}
            tabIndex={clickable ? 0 : undefined}
            onClick={() => jump(it)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                jump(it)
              }
            }}
          >
            <span className="vsc-prow-dim vsc-mono">{hms(it.ts)}</span>
            <span className="wbpb-agent">
              <AgentMark vendor={it.vendor} size={10} label="" activity={it.phase === 'pending' ? 'editing' : undefined} />
              <span>{it.agent}</span>
            </span>
            <span className="wbpb-file" title={it.file}>
              {name}
              {dir && <span className="vsc-prow-dim"> {dir}</span>}
            </span>
            <span className="vsc-mono">
              <span className="wbpb-plus">+{it.plus}</span> <span className="wbpb-minus">−{it.minus}</span>
            </span>
            <span className="wbpb-phase" data-phase={it.phase}>
              {it.phase === 'pending' && it.awaiting ? 'awaiting approval' : PHASE[it.phase]}
            </span>
          </div>
        )
      })}
    </div>
  )
}
