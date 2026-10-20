import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Editor from '@monaco-editor/react'
import type { editor as MonacoEditor, IDisposable } from 'monaco-editor'
import { Button } from '../../components/ui'
import { dirKey, fileCache, loadFile } from './api'
import { Codicon, IconBtn } from './chrome'
import { registerEditor, takeReveal, type CodeEditor } from './editorApi'
import { fileIconOf, languageOf, parentOf, type CursorInfo } from './fileTypes'
import { modelUri } from './modelUri'
import { monaco, THEME } from './monacoSetup'
import { isManaged, useFresh } from './playback/engine'
import { closeTab, pinTab, saveScroll, setActiveFile, type WsMeta, type WsState } from './store'

const OPTIONS: MonacoEditor.IStandaloneEditorConstructionOptions = {
  readOnly: true,
  domReadOnly: true,
  fontFamily: "'JetBrains Mono Variable', 'JetBrains Mono', Consolas, 'Courier New', monospace",
  fontSize: 13,
  lineHeight: 19,
  fontLigatures: true,
  minimap: { enabled: true, renderCharacters: false, maxColumn: 120 },
  lineNumbers: 'on',
  folding: true,
  showFoldingControls: 'mouseover',
  bracketPairColorization: { enabled: true },
  guides: { bracketPairs: true, indentation: true },
  smoothScrolling: true,
  cursorSmoothCaretAnimation: 'off',
  cursorBlinking: 'blink',
  renderWhitespace: 'none',
  renderLineHighlight: 'line',
  scrollBeyondLastLine: true,
  automaticLayout: true,
  padding: { top: 0, bottom: 0 },
  glyphMargin: false,
  lineDecorationsWidth: 10,
  lineNumbersMinChars: 4,
  stickyScroll: { enabled: true },
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: false,
  scrollbar: { verticalScrollbarSize: 14, horizontalScrollbarSize: 10, useShadows: false },
  fixedOverflowWidgets: true,
  contextmenu: true,
  wordWrap: 'off',
  tabSize: 4,
  renderValidationDecorations: 'off',
}

const COMPACT_OPTIONS: MonacoEditor.IStandaloneEditorConstructionOptions = { ...OPTIONS, minimap: { enabled: false }, stickyScroll: { enabled: false }, lineDecorationsWidth: 4, lineNumbersMinChars: 3 }
const restored = new Set<string>()

const SHORTCUTS: [string, string][] = [
  ['Show All Commands', 'Ctrl+Shift+P'],
  ['Go to File', 'Ctrl+P'],
  ['Toggle Panel', 'Ctrl+J'],
  ['Toggle Side Bar', 'Ctrl+B'],
  ['Toggle Chat', 'Ctrl+Alt+B'],
  ['Next Workspace', 'Ctrl+Tab'],
]

function Welcome({ name }: { name: string }) {
  return (
    <div className="vsc-welcome">
      <Codicon name="code" className="vsc-mark" style={{ fontSize: 96 }} />
      <div style={{ color: '#9d9d9d' }}>{name}</div>
      <dl className="vsc-welcome-keys">
        {SHORTCUTS.map(([label, key]) => (
          <div key={label} style={{ display: 'contents' }}>
            <dt>{label}</dt>
            <dd>
              {key.split('+').map((k, i) => (
                <span key={k}>
                  {i > 0 && ' '}
                  <kbd>{k}</kbd>
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** One workspace's editor group: tab bar, breadcrumbs and a Monaco instance (kept mounted while the workspace tab is hidden). */
export function EditorGroup({
  ws,
  w,
  visible,
  sample,
  compact,
  onInfo,
  onReveal,
  onMonacoReady,
}: {
  ws: WsMeta
  w: WsState
  visible: boolean
  sample: boolean
  /** Narrow layout: no minimap. */
  compact?: boolean
  onInfo: (root: string, info: CursorInfo | null, encoding: string) => void
  onReveal: (root: string, path: string) => void
  onMonacoReady?: () => void
}) {
  const active = w.active
  const file = fileCache.useValue(active ? dirKey(ws.root, active) : '')
  const [shown, setShown] = useState<{ path: string; text: string } | null>(null)
  const [edReady, setEdReady] = useState<CodeEditor | null>(null)
  const edRef = useRef<CodeEditor | null>(null)
  const activeRef = useRef<string | null>(active)
  const onInfoRef = useRef(onInfo)
  const visibleRef = useRef(visible)
  const encodingRef = useRef('utf-8')
  const disposables = useRef<IDisposable[]>([])
  const tabsRef = useRef<HTMLDivElement>(null)
  const fresh = useFresh()

  useEffect(() => {
    activeRef.current = active
    onInfoRef.current = onInfo
    visibleRef.current = visible
  })

  useEffect(() => {
    if (active) void loadFile(ws.root, active)
  }, [ws.root, active])

  if (file?.state === 'ready' && active && (shown?.path !== active || (shown.text !== file.text && !isManaged(ws.root, active)))) {
    setShown({ path: active, text: file.text })
  }
  useEffect(() => {
    if (file?.state === 'ready') encodingRef.current = file.encoding
  }, [file])

  // Release Monaco models of closed tabs.
  const tabKey = w.openTabs.map((t) => t.path).join('\n')
  useEffect(() => {
    const keep = new Set(tabKey.split('\n'))
    for (const m of monaco.editor.getModels()) {
      const prefix = monaco.Uri.parse(modelUri(ws.root, '')).toString()
      const u = m.uri.toString()
      if (!u.startsWith(prefix)) continue
      const rel = decodeURIComponent(u.slice(prefix.length))
      if (!keep.has(rel) && rel !== activeRef.current) m.dispose()
    }
  }, [tabKey, ws.root])

  const report = () => {
    const ed = edRef.current
    const model = ed?.getModel()
    const pos = ed?.getPosition()
    if (!ed || !model || !pos || !activeRef.current || !visibleRef.current) return
    const o = model.getOptions()
    onInfoRef.current(
      ws.root,
      { ln: pos.lineNumber, col: pos.column, eol: model.getEOL() === '\r\n' ? 'CRLF' : 'LF', tabSize: o.tabSize, spaces: o.insertSpaces, lang: model.getLanguageId() },
      encodingRef.current,
    )
  }

  const onMount = (ed: CodeEditor) => {
    edRef.current = ed
    setEdReady(ed)
    const unreg = registerEditor(ws.root, ed)
    disposables.current = [
      { dispose: unreg },
      ed.onDidChangeCursorPosition(report),
      ed.onDidChangeModel(report),
      ed.onDidChangeModelContent(report),
      ed.onDidScrollChange((e) => {
        const p = activeRef.current
        if (e.scrollTopChanged && p) saveScroll(ws.root, p, e.scrollTop)
      }),
    ]
    void document.fonts?.load("13px 'JetBrains Mono Variable'").then(() => monaco.editor.remeasureFonts())
    onMonacoReady?.()
  }
  useEffect(
    () => () => {
      disposables.current.forEach((d) => d.dispose())
      disposables.current = []
    },
    [],
  )

  // After a file is on screen: restore its scroll position once per session, reveal a requested line, report the status bar info.
  const shownPath = shown?.path
  const scrollSaved = shownPath ? w.scroll[shownPath] : undefined
  useEffect(() => {
    const ed = edReady
    if (!ed || !shownPath || shownPath !== active) return
    const k = modelUri(ws.root, shownPath)
    if (!restored.has(k)) {
      restored.add(k)
      if (scrollSaved) ed.setScrollTop(scrollSaved)
    }
    const r = takeReveal(ws.root, shownPath)
    if (r) {
      ed.revealLineInCenter(r.line)
      ed.setPosition({ lineNumber: r.line, column: r.column })
    }
    report()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run when the shown file changes, not on every scroll save
  }, [edReady, shownPath, active, visible, ws.root])

  useEffect(() => {
    if (!active) onInfo(ws.root, null, 'utf-8')
  }, [active, ws.root, onInfo])

  useEffect(() => {
    tabsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [active, w.openTabs.length])

  const names = useMemo(() => {
    const count = new Map<string, number>()
    for (const t of w.openTabs) {
      const n = t.path.split('/').pop() ?? t.path
      count.set(n, (count.get(n) ?? 0) + 1)
    }
    return count
  }, [w.openTabs])

  const crumbs = active ? active.split('/') : []
  const lang = shown ? languageOf(shown.path) : 'plaintext'

  let msg: ReactNode = null
  if (active && (!file || file.state === 'loading')) msg = <span>Loading…</span>
  else if (file?.state === 'error') {
    const big = file.status === 413
    const bin = file.status === 415
    msg = (
      <>
        <strong>{big ? 'The file is too large to display' : bin ? 'The file is not displayed because it is binary' : 'Cannot open this file'}</strong>
        <span>{big ? 'Files over 1 MB are not sent to the editor.' : bin ? 'It contains data that is not text.' : file.message}</span>
        {!big && !bin && (
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => active && void loadFile(ws.root, active, true)}>
            Retry
          </Button>
        )}
      </>
    )
  }

  return (
    <div className="vsc-group" style={{ display: visible ? undefined : 'none' }} aria-hidden={!visible}>
      <div className="vsc-tabs">
        <div
          ref={tabsRef}
          role="tablist"
          aria-label={`Open files in ${ws.name}`}
          className="vsc-tabs-scroll"
          onWheel={(e) => {
            if (e.deltaY && !e.deltaX) e.currentTarget.scrollLeft += e.deltaY
          }}
        >
          {w.openTabs.map((t) => {
            const name = t.path.split('/').pop() ?? t.path
            const ic = fileIconOf(name)
            const dup = (names.get(name) ?? 0) > 1
            return (
              <div
                key={t.path}
                role="tab"
                tabIndex={0}
                aria-selected={t.path === active}
                data-preview={t.preview}
                className="vsc-tab"
                onClick={() => setActiveFile(ws.root, t.path)}
                onDoubleClick={() => pinTab(ws.root, t.path)}
                onMouseDown={(e) => e.button === 1 && e.preventDefault()}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault()
                    closeTab(ws.root, t.path)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setActiveFile(ws.root, t.path)
                  }
                }}
              >
                <Codicon name={ic.icon} style={{ color: ic.color, marginRight: 6, fontSize: 16 }} />
                <span className="vsc-tab-label">{name}</span>
                {fresh.has(dirKey(ws.root, t.path)) && <span className="wbpb-new">(new)</span>}
                {dup && <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.6 }}>{parentOf(t.path)}</span>}
                <IconBtn
                  icon="close"
                  label={`Close ${name}`}
                  shortcut="Ctrl W"
                  className="vsc-tab-close"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(ws.root, t.path)
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>

      {active && (
        <div className="vsc-crumbs" aria-label="Breadcrumbs">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1
            const path = crumbs.slice(0, i + 1).join('/')
            const ic = last ? fileIconOf(c) : null
            return (
              <span key={path} style={{ display: 'inline-flex', alignItems: 'center' }}>
                {i > 0 && <Codicon name="chevron-right" />}
                <button type="button" className="vsc-crumb" data-last={last} onClick={() => onReveal(ws.root, path)}>
                  {ic && <Codicon name={ic.icon} style={{ color: ic.color, marginRight: 4 }} />}
                  {c}
                </button>
              </span>
            )
          })}
        </div>
      )}

      <div className="vsc-editor">
        {shown && (
          <div className="vsc-editor-fill">
            <Editor
              height="100%"
              width="100%"
              theme={THEME}
              path={modelUri(ws.root, shown.path)}
              language={lang}
              value={shown.text}
              options={compact ? COMPACT_OPTIONS : OPTIONS}
              keepCurrentModel
              loading={null}
              onMount={onMount}
            />
          </div>
        )}
        {!active && <Welcome name={sample ? `${ws.name} (sample data)` : ws.name} />}
        {active && msg && <div className="vsc-overlay-msg">{msg}</div>}
      </div>
    </div>
  )
}
