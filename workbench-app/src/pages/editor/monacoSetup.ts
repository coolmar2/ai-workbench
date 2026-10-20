import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker?worker'
import CssWorker from 'monaco-editor/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker'
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker'

/** Local Monaco bundle (no CDN): workers come from Vite `?worker` imports. */
;(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorker(_id: string, label: string) {
    switch (label) {
      case 'json':
        return new JsonWorker()
      case 'css':
      case 'scss':
      case 'less':
        return new CssWorker()
      case 'html':
      case 'handlebars':
      case 'razor':
        return new HtmlWorker()
      case 'typescript':
      case 'javascript':
        return new TsWorker()
      default:
        return new EditorWorker()
    }
  },
}

loader.config({ monaco })

export const THEME = 'wb-dark-modern'

monaco.editor.defineTheme(THEME, {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#1f1f1f',
    'editor.foreground': '#cccccc',
    'editorLineNumber.foreground': '#6e7681',
    'editorLineNumber.activeForeground': '#cccccc',
    'editorCursor.foreground': '#aeafad',
    'editor.selectionBackground': '#264f78',
    'editor.inactiveSelectionBackground': '#3a3d41',
    'editor.selectionHighlightBackground': '#add6ff26',
    'editor.wordHighlightBackground': '#575757b8',
    'editor.findMatchBackground': '#9e6a03',
    'editor.findMatchHighlightBackground': '#ea5c0055',
    'editor.lineHighlightBackground': '#ffffff0a',
    'editor.lineHighlightBorder': '#00000000',
    'editorIndentGuide.background1': '#404040',
    'editorIndentGuide.activeBackground1': '#707070',
    'editorBracketMatch.background': '#0064001a',
    'editorBracketMatch.border': '#888888',
    'editorWhitespace.foreground': '#ffffff1a',
    'editorRuler.foreground': '#5a5a5a',
    'editorGutter.background': '#1f1f1f',
    'editorGutter.foldingControlForeground': '#c5c5c5',
    'editorWidget.background': '#202020',
    'editorWidget.border': '#454545',
    'editorHoverWidget.background': '#202020',
    'editorHoverWidget.border': '#454545',
    'editorSuggestWidget.background': '#202020',
    'editorSuggestWidget.border': '#454545',
    'editorStickyScroll.background': '#1f1f1f',
    'editorStickyScrollHover.background': '#2a2d2e',
    'minimap.background': '#1f1f1f',
    'minimapSlider.background': '#79797933',
    'minimapSlider.hoverBackground': '#64646459',
    'minimapSlider.activeBackground': '#bfbfbf33',
    'scrollbar.shadow': '#00000000',
    'scrollbarSlider.background': '#79797966',
    'scrollbarSlider.hoverBackground': '#646464b3',
    'scrollbarSlider.activeBackground': '#bfbfbf66',
    'focusBorder': '#0078d4',
    'input.background': '#313131',
    'input.border': '#3c3c3c',
    'list.hoverBackground': '#2a2d2e',
    'list.activeSelectionBackground': '#04395e',
    'menu.background': '#1f1f1f',
    'menu.border': '#454545',
  },
})

// Read-only viewer: the language services' squiggles (unresolved imports and the like) would only mislead.
try {
  const ts = monaco.typescript
  const off = { noSemanticValidation: true, noSyntaxValidation: true, noSuggestionDiagnostics: true }
  ts.typescriptDefaults.setDiagnosticsOptions(off)
  ts.javascriptDefaults.setDiagnosticsOptions(off)
  monaco.json.jsonDefaults.setDiagnosticsOptions({ validate: false })
  monaco.css.cssDefaults.setOptions({ validate: false })
} catch {
  /* optional */
}

export { monaco }
