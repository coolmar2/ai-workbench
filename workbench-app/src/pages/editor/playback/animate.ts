import type { editor as MonacoEditor, IPosition } from 'monaco-editor'
import type { Vendor } from '../../../data/types'
import { getEditorOf } from '../editorApi'
import { modelUri } from '../modelUri'
import { monaco } from '../monacoSetup'

/**
 * Monaco side of live edit playback: finds the change in a model, highlights the old text, deletes it and types the
 * new text in chunks, with a collaborative-style caret and fading changed-line marks. Only touches the model in memory.
 */

export interface AnimChange {
  old: string
  new: string
  replaceAll?: boolean
}

export interface AnimJob {
  root: string
  rel: string
  vendor: Vendor
  label: string
  tool: 'edit' | 'write'
  changes?: AnimChange[]
  content?: string
  /** Set skip to true to finish whatever is left at once (page is going away). */
  ctl: { skip: boolean }
  /** Keep the changed lines marked pending; the result carries the Hold to settle them. */
  hold?: boolean
}

export interface AnimResult {
  /** The model was found and changed by the animation. */
  animated: boolean
  /** The animation did not finish (old text missing, model edited from outside). */
  incomplete: boolean
  firstLine?: number
  plus: number
  minus: number
  hold?: Hold
}

class Abort extends Error {}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const countLines = (s: string) => (s ? s.replace(/\r/g, '').split('\n').length : 0)
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function getModel(root: string, rel: string) {
  return monaco.editor.getModel(monaco.Uri.parse(modelUri(root, rel)))
}

async function waitModel(root: string, rel: string, ms: number) {
  const t0 = Date.now()
  for (;;) {
    const m = getModel(root, rel)
    if (m && !m.isDisposed()) return m
    if (Date.now() - t0 > ms) return null
    await sleep(40)
  }
}

/** [start, endInCur, endInNext] of the part that differs; never splits a CRLF pair. */
function middle(cur: string, next: string, snapLines = false): [number, number, number] {
  const max = Math.min(cur.length, next.length)
  let p = 0
  while (p < max && cur.charCodeAt(p) === next.charCodeAt(p)) p++
  let s = 0
  while (s < max - p && cur.charCodeAt(cur.length - 1 - s) === next.charCodeAt(next.length - 1 - s)) s++
  if (p > 0 && cur[p - 1] === '\r') p--
  if (s > 0 && cur[cur.length - s] === '\n' && cur[cur.length - s - 1] === '\r') s--
  if (snapLines) {
    while (p > 0 && cur[p - 1] !== '\n') p--
    // the kept suffix must start at a line start
    while (s > 0 && cur[cur.length - s - 1] !== '\n') s--
    if (cur.length - s < p || next.length - s < p) s = 0
  }
  return [p, cur.length - s, next.length - s]
}

/** Replace the differing middle of the model with `text`, keeping cursor and scroll (disk is the truth). */
export function patchModel(model: MonacoEditor.ITextModel, text: string) {
  const next = text.replace(/\r?\n/g, model.getEOL())
  const cur = model.getValue()
  const [p, ce, ne] = middle(cur, next)
  if (p === ce && p === ne) return
  model.applyEdits([{ range: monaco.Range.fromPositions(model.getPositionAt(p), model.getPositionAt(ce)), text: next.slice(p, ne) }])
}

/* ---------- caret + marks ---------- */

let widgetSeq = 0
const CARET_LINGER_MS = 1500

class Presence {
  private node = document.createElement('div')
  private id = `wbpb.caret.${++widgetSeq}`
  private pos: IPosition = { lineNumber: 1, column: 1 }
  private ed: MonacoEditor.IStandaloneCodeEditor | null = null
  private widget: MonacoEditor.IContentWidget
  constructor(
    private root: string,
    private model: MonacoEditor.ITextModel,
    vendor: Vendor,
    label: string,
  ) {
    this.node.className = `wbpb-caret wbpb-c-${vendor}`
    const bar = document.createElement('span')
    bar.className = 'wbpb-bar'
    const tag = document.createElement('span')
    tag.className = 'wbpb-tag'
    tag.textContent = label
    this.node.append(bar, tag)
    this.widget = {
      getId: () => this.id,
      getDomNode: () => this.node,
      getPosition: () => ({ position: this.pos, preference: [monaco.editor.ContentWidgetPositionPreference.EXACT] }),
    }
  }
  update(pos: IPosition) {
    this.pos = pos
    const ed = getEditorOf(this.root)
    const here = ed && ed.getModel() === this.model ? ed : null
    if (this.ed && this.ed !== here) this.detach()
    if (here) {
      if (!this.ed) {
        here.addContentWidget(this.widget)
        this.ed = here
        this.node.classList.remove('wbpb-out')
      } else here.layoutContentWidget(this.widget)
    }
  }
  reveal(line: number) {
    const ed = getEditorOf(this.root)
    if (ed && ed.getModel() === this.model) ed.revealLineInCenterIfOutsideViewport(line, monaco.editor.ScrollType.Immediate)
  }
  private detach() {
    try {
      this.ed?.removeContentWidget(this.widget)
    } catch {
      /* editor gone */
    }
    this.ed = null
  }
  end() {
    this.node.classList.add('wbpb-out')
    setTimeout(() => this.detach(), CARET_LINGER_MS)
  }
}

/** Changed-line tint + gutter bar that steps down in opacity and is gone after about 8 s. While pending: dashed bar + label. */
class LineMark {
  private ids: string[] = []
  private range: [number, number] | null = null
  private pend: string | null = null
  constructor(
    private model: MonacoEditor.ITextModel,
    private vendor: Vendor,
  ) {}
  private put(r: [number, number] | null, level: number) {
    if (this.model.isDisposed()) return
    const old = this.ids
    this.ids = []
    if (!r) {
      this.model.deltaDecorations(old, [])
      return
    }
    const c = `wbpb-c-${this.vendor} wbpb-f${level}`
    const p = this.pend !== null ? ' wbpb-pend' : ''
    const decos: MonacoEditor.IModelDeltaDecoration[] = [
      {
        range: new monaco.Range(r[0], 1, r[1], 1),
        options: { isWholeLine: true, className: `wbpb-line ${c}${p}`, linesDecorationsClassName: `wbpb-gut ${c}${p}` },
      },
    ]
    if (this.pend) {
      const col = this.model.getLineMaxColumn(Math.min(r[1], this.model.getLineCount()))
      const ln = Math.min(r[1], this.model.getLineCount())
      decos.push({ range: new monaco.Range(ln, col, ln, col), options: { after: { content: `\u00a0\u00a0${this.pend}`, inlineClassName: 'wbpb-await' } } })
    }
    this.ids = this.model.deltaDecorations(old, decos)
  }
  set(from: number, to: number) {
    this.range = [from, to]
    this.put(this.range, 0)
  }
  /** null = not pending; '' = pending bar without label; text = pending with label. */
  setPending(text: string | null) {
    this.pend = text
    if (this.range) this.put(this.range, 0)
  }
  discard() {
    this.pend = null
    this.put(null, 0)
    this.range = null
  }
  fade() {
    ;[2000, 4000, 6000].forEach((ms, i) => setTimeout(() => this.range && this.put(this.range, i + 1), ms))
    setTimeout(() => {
      this.put(null, 0)
      this.range = null
    }, 8000)
  }
}

/** Marks kept pending after a pre edit has been typed, until its post arrives (or the edit is dropped). */
export interface Hold {
  setLabel: (text: string) => void
  /** post arrived: remove the pending marks, then the normal fade */
  settle: () => void
  /** edit was not applied: remove all marks at once */
  discard: () => void
}

/* ---------- the animation ---------- */

class Run {
  ver: number
  firstLine: number | undefined
  plus = 0
  minus = 0
  incomplete = false
  private marks: LineMark[] = []
  private presence: Presence
  private reduce = reducedMotion()
  constructor(
    private model: MonacoEditor.ITextModel,
    private job: AnimJob,
  ) {
    this.ver = model.getVersionId()
    this.presence = new Presence(job.root, model, job.vendor, job.label)
  }
  private instant() {
    return this.reduce || this.job.ctl.skip
  }
  private check() {
    if (this.model.isDisposed() || this.model.getVersionId() !== this.ver) throw new Abort()
  }
  private apply(start: number, end: number, text: string) {
    const m = this.model
    m.applyEdits([{ range: monaco.Range.fromPositions(m.getPositionAt(start), m.getPositionAt(end)), text, forceMoveMarkers: true }])
    this.ver = m.getVersionId()
  }
  private norm(s: string) {
    return s.replace(/\r?\n/g, this.model.getEOL())
  }

  /** Replace [start, start+oldLen) with `text`: highlight, delete, type. */
  private async step(start: number, oldLen: number, text: string) {
    const m = this.model
    this.check()
    const sp = m.getPositionAt(start)
    this.firstLine ??= sp.lineNumber
    const mark = new LineMark(m, this.job.vendor)
    this.marks.push(mark)
    this.minus += countLines(m.getValue().slice(start, start + oldLen))
    this.plus += countLines(text)
    this.presence.update(sp)
    this.presence.reveal(sp.lineNumber)
    if (oldLen > 0) {
      const ep = m.getPositionAt(start + oldLen)
      if (!this.instant()) {
        const ids = m.deltaDecorations([], [{ range: monaco.Range.fromPositions(sp, ep), options: { className: 'wbpb-old', inlineClassName: 'wbpb-old-text' } }])
        try {
          await sleep(250)
        } finally {
          if (!m.isDisposed()) m.deltaDecorations(ids, [])
        }
        this.check()
      }
      this.apply(start, start + oldLen, '')
    }
    await this.type(start, text, mark)
    mark.set(sp.lineNumber, Math.max(sp.lineNumber, m.getPositionAt(start + text.length).lineNumber))
  }

  private async type(start: number, text: string, mark: LineMark) {
    const m = this.model
    if (!text) return
    // Very large text: type the first 60 lines, insert the rest at once.
    let cut = text.length
    let nl = 0
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10 && ++nl === 60) {
        cut = i + 1
        break
      }
    }
    const vis = text.slice(0, cut)
    const total = vis.length
    const cps = Math.min(400, Math.max(60, total / 2))
    const dur = Math.min(4, Math.max(0.6, total / cps))
    const rate = total / dur
    const t0 = performance.now()
    const startLine = m.getPositionAt(start).lineNumber
    let done = 0
    while (done < total) {
      let n = this.instant() ? total : Math.min(total, Math.max(done + 1, Math.floor((rate * (performance.now() - t0)) / 1000)))
      if (n < total && vis[n - 1] === '\r') n++
      this.check()
      this.apply(start + done, start + done, vis.slice(done, n))
      done = n
      const pos = m.getPositionAt(start + done)
      mark.set(startLine, pos.lineNumber)
      this.presence.update(pos)
      this.presence.reveal(pos.lineNumber)
      if (done < total) await sleep(24)
    }
    if (cut < text.length) {
      this.check()
      this.apply(start + done, start + done, text.slice(cut))
      const pos = m.getPositionAt(start + text.length)
      mark.set(startLine, pos.lineNumber)
      this.presence.update(pos)
    }
  }

  async edit(c: AnimChange): Promise<boolean> {
    const oldN = this.norm(c.old)
    const newN = this.norm(c.new)
    if (!oldN) return false
    const text = this.model.getValue()
    const first = text.indexOf(oldN)
    if (first < 0) return false
    const at = [first]
    if (c.replaceAll) for (let i = text.indexOf(oldN, first + oldN.length); i >= 0; i = text.indexOf(oldN, i + oldN.length)) at.push(i)
    await this.step(first, oldN.length, newN)
    const delta = newN.length - oldN.length
    for (let k = 1; k < at.length; k++) {
      this.check()
      const s = at[k] + delta * k
      const mark = new LineMark(this.model, this.job.vendor)
      this.marks.push(mark)
      this.apply(s, s + oldN.length, newN)
      mark.set(this.model.getPositionAt(s).lineNumber, this.model.getPositionAt(s + newN.length).lineNumber)
      this.plus += countLines(newN)
      this.minus += countLines(oldN)
    }
    return true
  }

  async write(content: string) {
    const cur = this.model.getValue()
    const next = this.norm(content)
    if (cur === next) return
    if (!cur) return this.step(0, 0, next)
    const [p, ce, ne] = middle(cur, next, true)
    await this.step(p, ce - p, next.slice(p, ne))
  }

  finish(hold: boolean): Hold | undefined {
    this.presence.end()
    if (!hold) {
      this.marks.forEach((m) => m.fade())
      return undefined
    }
    const marks = this.marks
    let done = false
    const setLabel = (text: string) => {
      if (!done) marks.forEach((m, i) => m.setPending(i === marks.length - 1 ? text : ''))
    }
    setLabel('applying…')
    return {
      setLabel,
      settle: () => {
        if (done) return
        done = true
        marks.forEach((m) => {
          m.setPending(null)
          m.fade()
        })
      },
      discard: () => {
        done = true
        marks.forEach((m) => m.discard())
      },
    }
  }
}

export async function runAnimation(job: AnimJob): Promise<AnimResult> {
  const model = await waitModel(job.root, job.rel, 2500)
  if (!model) return { animated: false, incomplete: false, plus: 0, minus: 0 }
  const run = new Run(model, job)
  let touched = false
  try {
    if (job.tool === 'write') {
      await run.write(job.content ?? '')
      touched = true
    } else {
      for (const c of job.changes ?? []) {
        if (!(await run.edit(c))) {
          run.incomplete = true
          break
        }
        touched = true
      }
    }
  } catch (e) {
    if (!(e instanceof Abort)) throw e
    run.incomplete = true
    touched = true
  }
  const hold = run.finish(!!job.hold && touched)
  return { hold, animated: touched, incomplete: run.incomplete, firstLine: run.firstLine, plus: run.plus, minus: run.minus }
}
