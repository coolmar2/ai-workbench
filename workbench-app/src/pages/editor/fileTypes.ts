const EXT_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  json: 'json', jsonc: 'json', webmanifest: 'json',
  py: 'python', pyw: 'python', md: 'markdown', markdown: 'markdown',
  css: 'css', scss: 'scss', less: 'less', html: 'html', htm: 'html', xml: 'xml', svg: 'xml',
  yml: 'yaml', yaml: 'yaml', sh: 'shell', bash: 'shell', zsh: 'shell',
  ps1: 'powershell', psm1: 'powershell', bat: 'bat', cmd: 'bat',
  java: 'java', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp', cs: 'csharp',
  go: 'go', rs: 'rust', rb: 'ruby', php: 'php', sql: 'sql', toml: 'ini', ini: 'ini', cfg: 'ini',
  txt: 'plaintext', log: 'plaintext', lua: 'lua', swift: 'swift', kt: 'kotlin', r: 'r',
}

const NAME_LANG: Record<string, string> = { dockerfile: 'dockerfile', makefile: 'plaintext', '.gitignore': 'plaintext', '.env': 'ini' }

export function languageOf(path: string): string {
  const name = (path.split('/').pop() ?? path).toLowerCase()
  if (NAME_LANG[name]) return NAME_LANG[name]
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? (EXT_LANG[name.slice(dot + 1)] ?? 'plaintext') : 'plaintext'
}

const LABEL: Record<string, string> = {
  typescript: 'TypeScript', javascript: 'JavaScript', json: 'JSON', python: 'Python', markdown: 'Markdown',
  css: 'CSS', scss: 'SCSS', less: 'Less', html: 'HTML', xml: 'XML', yaml: 'YAML', shell: 'Shell Script',
  powershell: 'PowerShell', bat: 'Batch', java: 'Java', c: 'C', cpp: 'C++', csharp: 'C#', go: 'Go',
  rust: 'Rust', ruby: 'Ruby', php: 'PHP', sql: 'SQL', ini: 'Properties', plaintext: 'Plain Text',
  dockerfile: 'Dockerfile', lua: 'Lua', swift: 'Swift', kotlin: 'Kotlin', r: 'R',
}

export const languageLabel = (lang: string) => LABEL[lang] ?? lang

export interface FileIcon {
  /** codicon name without the "codicon-" prefix */
  icon: string
  color: string
}

const BY_LANG: Record<string, FileIcon> = {
  typescript: { icon: 'file-code', color: '#519aba' },
  javascript: { icon: 'file-code', color: '#cbcb41' },
  json: { icon: 'json', color: '#cbcb41' },
  python: { icon: 'file-code', color: '#6aa4d8' },
  markdown: { icon: 'markdown', color: '#519aba' },
  css: { icon: 'file-code', color: '#519aba' },
  scss: { icon: 'file-code', color: '#f55385' },
  html: { icon: 'file-code', color: '#e37933' },
  xml: { icon: 'file-code', color: '#e37933' },
  yaml: { icon: 'settings-gear', color: '#a074c4' },
  shell: { icon: 'terminal', color: '#89e051' },
  powershell: { icon: 'terminal-powershell', color: '#519aba' },
  bat: { icon: 'terminal', color: '#89e051' },
  ini: { icon: 'settings-gear', color: '#9d9d9d' },
  sql: { icon: 'database', color: '#dad8d8' },
  plaintext: { icon: 'file', color: '#9d9d9d' },
}

export function fileIconOf(name: string): FileIcon {
  const lower = name.toLowerCase()
  if (/\.(png|jpe?g|gif|webp|ico|bmp|svg)$/.test(lower)) return { icon: 'file-media', color: '#a074c4' }
  if (/\.(zip|gz|tgz|7z|rar|tar)$/.test(lower)) return { icon: 'file-zip', color: '#9d9d9d' }
  if (lower.endsWith('.pdf')) return { icon: 'file-pdf', color: '#e75e78' }
  if (/\.lock$|lock\.json$/.test(lower)) return { icon: 'lock', color: '#9d9d9d' }
  if (lower.startsWith('.git') || lower.startsWith('.env')) return { icon: 'settings-gear', color: '#9d9d9d' }
  return BY_LANG[languageOf(name)] ?? { icon: 'file-code', color: '#9d9d9d' }
}
export const parentOf = (path: string) => path.split('/').slice(0, -1).join('/')

/** What the status bar shows for the file under the cursor. */
export interface CursorInfo {
  ln: number
  col: number
  eol: 'LF' | 'CRLF'
  tabSize: number
  spaces: boolean
  lang: string
}
