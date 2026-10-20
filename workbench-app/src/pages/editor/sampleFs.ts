import type { Vendor } from '../../data/types'
import { codeRows, files, problems as sampleProblems, wsTabs } from './data'

/**
 * Sample workspaces for when /api/mc/workspaces does not answer. Roots look like "sample:Orbit".
 * Only the Orbit workspace has the design board's tree; the others get a tiny one.
 */
export const SAMPLE_PREFIX = 'sample:'
export const isSampleRoot = (root: string) => root.startsWith(SAMPLE_PREFIX)

export interface SampleEntry {
  name: string
  type: 'dir' | 'file'
  size: number
  mtime: number
}

export const sampleWorkspaces = wsTabs.map((t, i) => ({
  root: SAMPLE_PREFIX + t.name,
  name: t.name,
  last_ts: Date.now() / 1000 - i * 3600,
  dots: t.dots,
}))

const pyText = codeRows.map((r) => r.map((s) => s[0]).join('')).join('\n') + '\n'
const header = 'import logging\n\nlog = logging.getLogger(__name__)\n\n\n'

const ORBIT: Record<string, string | null> = {
  '__pycache__': null,
  '.claude': null,
  'inventory': null,
  'orbit-web': null,
  'orbit-web/clouddrive_sync.py': header + pyText,
  'orbit-web/upload_run.py': '"""Upload a batch to CloudDrive."""\nimport argparse\n\n\ndef main():\n    p = argparse.ArgumentParser()\n    p.add_argument("--links", action="store_true")\n    p.parse_args()\n\n\nif __name__ == "__main__":\n    main()\n',
  'orbit-web/upload_client.py': 'class UploadClient:\n    """Thin wrapper around the CloudDrive REST API."""\n\n    def __init__(self, site):\n        self.site = site\n',
  'label-printer': null,
  'importer-viewer': null,
  'tests': null,
  'tests/test_clouddrive.py': 'from orbit_web.clouddrive_sync import link_batch\n\n\ndef test_link_batch_refuses_same_name():\n    assert link_batch(None, None).message == "resolve by hand"\n',
  'CLAUDE.md': '# Orbit\n\nImporter scan, CloudDrive sync and the report exporter.\n\n- Agents work in private copies outside the repo.\n- Nothing is committed without asking.\n',
}

const OTHER: Record<string, string | null> = {
  'src': null,
  'src/main.py': 'def main():\n    print("hello")\n',
  'README.md': '# Sample workspace\n\nThis workspace only exists as sample data.\n',
}

function tree(root: string) {
  return root === SAMPLE_PREFIX + 'Orbit' ? ORBIT : OTHER
}

export function sampleList(root: string, path: string): SampleEntry[] {
  const t = tree(root)
  const prefix = path ? path + '/' : ''
  const out: SampleEntry[] = []
  for (const [p, text] of Object.entries(t)) {
    if (!p.startsWith(prefix)) continue
    const rest = p.slice(prefix.length)
    if (!rest || rest.includes('/')) continue
    out.push({ name: rest, type: text === null ? 'dir' : 'file', size: text?.length ?? 0, mtime: Date.now() / 1000 })
  }
  return out.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))
}

export function sampleRead(root: string, path: string): string | null {
  const v = tree(root)[path]
  return typeof v === 'string' ? v : null
}

/** Which vendors "recently edited" each file in the sample tree (from the design board's agent dots). */
export function sampleMarks(root: string): Record<string, Vendor[]> {
  if (root !== SAMPLE_PREFIX + 'Orbit') return {}
  const out: Record<string, Vendor[]> = {}
  const dirs: string[] = []
  for (const f of files) {
    if (f.depth === 1) {
      dirs.push(f.name)
      if (f.marks.length) out[f.name] = f.marks.map((m) => m.vendor)
    } else if (f.marks.length) {
      out[`${dirs[dirs.length - 1]}/${f.name}`] = f.marks.map((m) => m.vendor)
    }
  }
  return out
}

export const sampleProblemList = sampleProblems
