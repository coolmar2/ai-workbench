import { createContext, useContext } from 'react'
import type { editor as MonacoEditor } from 'monaco-editor'
import { openFile as storeOpenFile } from './store'

/**
 * Seam for features that drive the editor from outside (live edit playback, "open the file an agent is
 * editing"). Obtain it with useEditorApi() inside the Editor page tree.
 */
export type CodeEditor = MonacoEditor.IStandaloneCodeEditor

export interface OpenFileOptions {
  /** Single-click style (italic tab, replaced by the next one). Default true; false pins the tab. */
  preview?: boolean
  /** Reveal this 1-based line once the file is shown. */
  line?: number
  column?: number
}

export interface EditorApi {
  /** Root of the workspace tab that is showing now (null before any is open). */
  root: string | null
  /** The Monaco editor of a workspace (default: the current one); null until that workspace was visited. */
  getEditor: (root?: string) => CodeEditor | null
  /** Open (and activate) a file; opens the workspace tab first when needed. `path` is relative to `root`, with "/" separators. */
  openFile: (root: string, path: string, opts?: OpenFileOptions) => void
  /** The monaco namespace, null until the editor chunk has loaded. */
  monaco: typeof import('monaco-editor') | null
}

const editors = new Map<string, CodeEditor>()
const reveals = new Map<string, { line: number; column: number }>()
const revealKey = (root: string, path: string) => `${root}\n${path}`

export function registerEditor(root: string, ed: CodeEditor): () => void {
  editors.set(root, ed)
  return () => {
    if (editors.get(root) === ed) editors.delete(root)
  }
}

export function getEditorOf(root: string): CodeEditor | null {
  return editors.get(root) ?? null
}

/** Position to scroll to once the file is on screen (consumed once). */
export function takeReveal(root: string, path: string) {
  const k = revealKey(root, path)
  const r = reveals.get(k)
  reveals.delete(k)
  return r
}

export function openFileIn(root: string, path: string, opts: OpenFileOptions = {}) {
  if (opts.line) reveals.set(revealKey(root, path), { line: opts.line, column: opts.column ?? 1 })
  storeOpenFile(root, path, { preview: opts.preview })
}

export const EditorApiContext = createContext<EditorApi | null>(null)

export function useEditorApi(): EditorApi {
  const v = useContext(EditorApiContext)
  if (!v) throw new Error('useEditorApi outside the Editor page')
  return v
}
