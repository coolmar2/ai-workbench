import { getEditorState } from '../store'
import { getModel } from './animate'
import { ingest, setSimSession, type EditEvent } from './engine'

/**
 * Dev-only playback test hook (import.meta.env.DEV and ?simulateEdits=1): feeds fake pre/post edits for the file that
 * is open in the editor through the real playback path. The disk is never read or written; reloading the page reverts.
 */
export const simEnabled = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('simulateEdits') === '1'

export type SimKind = 'edit' | 'multi' | 'write' | 'new' | 'disk' | 'pending' | 'denied'
const KINDS: SimKind[] = ['edit', 'multi', 'write', 'new']
/** 'disk' sends a real (non-simulated) post for the open file: the disk text replaces the simulated one. */
let n = 0
let next = 0
let pendingSim: EditEvent | null = null

/** Sends the withheld post of the last 'pending' simulation. */
export async function simPost(): Promise<string> {
  if (!pendingSim) return 'nothing pending'
  setSimSession(pendingSim.session_id, { status: 'running', events: 12 })
  await ingest({ ...pendingSim, phase: 'post', ts: Date.now() / 1000 })
  pendingSim = null
  return 'post sent'
}

const BLOCK = (c: string, tag: string) =>
  [`${c} --- simulated agent edit ${tag} (memory only, not on disk) ---`, `${c} Step 1 reads the input, step 2 validates it,`, `${c} step 3 writes the answer back to the caller.`, `${c} Typing speed adapts to the amount of text.`]

export async function simulate(kind: SimKind = 'edit'): Promise<string> {
  const st = getEditorState()
  const root = st.activeRoot
  const rel = root ? st.ws[root]?.active : null
  if (!root || !rel) return 'open a file first'
  const model = getModel(root, rel)
  if (!model) return 'the file is not loaded yet'
  const sample = root.startsWith('sample:')
  const toPath = (r: string) => (sample ? `${root}/${r}` : `${root}\\${r.replace(/\//g, '\\')}`)
  const c = /\.(py|sh|ya?ml|toml|rb)$/i.test(rel) ? '#' : '//'
  const text = model.getValue().replace(/\r\n/g, '\n')
  const rows = text.split('\n')
  const pick = (from: number) => {
    for (let i = Math.min(rows.length - 1, from); i < rows.length; i++) if (rows[i].trim().length > 6) return i
    for (let i = Math.min(rows.length - 1, from); i >= 0; i--) if (rows[i].trim().length > 6) return i
    return -1
  }
  if (kind === 'disk') {
    await ingest({ seq: 0, ts: Date.now() / 1000, session_id: 'sim', agent_id: null, agent_type: null, phase: 'post', tool: 'Edit', tool_use_id: `sim-disk-${++n}`, file_path: toPath(rel) })
    return 'reloaded from disk'
  }
  const ev: EditEvent = {
    seq: 0,
    ts: Date.now() / 1000,
    session_id: 'sim',
    agent_id: null,
    agent_type: null,
    phase: 'pre',
    tool: 'Edit',
    tool_use_id: `sim-${++n}`,
    file_path: toPath(rel),
    sim: true,
  }
  const indentOf = (s: string) => /^\s*/.exec(s)?.[0] ?? ''
  if (kind === 'pending' || kind === 'denied') {
    ev.session_id = `sim-${kind}`
    setSimSession(ev.session_id, { status: 'needs you', events: 10 })
  }
  if (kind === 'edit' || kind === 'multi' || kind === 'pending' || kind === 'denied') {
    const idx = [pick(Math.floor(rows.length * 0.4)), pick(Math.floor(rows.length * 0.75))].filter((v, i, a) => v >= 0 && a.indexOf(v) === i)
    if (!idx.length) return 'the file has no suitable line'
    const make = (i: number, tag: string) => {
      const ind = indentOf(rows[i])
      return { old: rows[i], new: [...BLOCK(c, tag).map((l) => ind + l), rows[i]].join('\n'), replace_all: false }
    }
    ev.tool = kind === 'multi' ? 'MultiEdit' : 'Edit'
    ev.changes = (kind === 'multi' ? idx : idx.slice(0, 1)).map((i, k) => make(i, `#${k + 1}`))
  } else if (kind === 'write') {
    const i = pick(Math.floor(rows.length * 0.5))
    if (i < 0) return 'the file has no suitable line'
    const ind = indentOf(rows[i])
    ev.tool = 'Write'
    ev.content = [...rows.slice(0, i), ...BLOCK(c, '(write)').map((l) => ind + l), ...rows.slice(i)].join('\n')
  } else {
    const name = `sim_new_file_${n}.py`
    ev.file_path = toPath(rel.includes('/') ? `${rel.slice(0, rel.lastIndexOf('/'))}/${name}` : name)
    ev.tool = 'Write'
    ev.sim = 'new'
    ev.content = ['"""Created by a simulated agent."""', '', 'def total(values):', '    """Sum the values, ignoring None."""', '    result = 0', '    for v in values:', '        if v is not None:', '            result += v', '    return result', '', '', 'if __name__ == "__main__":', '    print(total([1, 2, None, 4]))', ''].join('\n')
  }
  if (kind === 'pending' || kind === 'denied') {
    // pending: the post is withheld (window.__wbSim.post() sends it). denied: the session goes idle and never posts.
    pendingSim = ev
    await ingest(ev)
    if (kind === 'denied') setTimeout(() => setSimSession(ev.session_id, { status: 'idle', events: 11 }), 6000)
    return `simulated ${kind} (pre only)`
  }
  await ingest(ev)
  await ingest({ ...ev, phase: 'post', seq: ev.seq + 1, ts: Date.now() / 1000 })
  return `simulated ${ev.tool}`
}

export function simNext(): Promise<string> {
  return simulate(KINDS[next++ % KINDS.length])
}

declare global {
  interface Window {
    __wbSim?: { run: (kind?: SimKind) => Promise<string>; post: () => Promise<string> }
  }
}
