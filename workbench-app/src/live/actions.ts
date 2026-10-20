/**
 * Actions on wb_mc.py through the Vite proxy (POST /api/mc/send and /api/mc/start).
 * The proxy only lets these through from this computer and this app's origin; see vite.config.ts.
 * Both resolve to { ok, error? } and never throw.
 */

export interface ActionResult {
  ok: boolean
  error?: string
  /** /start only: pid of the new wrapper process. */
  pid?: number
}

async function post(path: string, body: unknown): Promise<ActionResult> {
  try {
    const r = await fetch(`/api/mc/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
    const j = (await r.json().catch(() => null)) as ActionResult | null
    if (j && typeof j.ok === 'boolean') return j
    return { ok: false, error: `HTTP ${r.status}` }
  } catch (e) {
    return { ok: false, error: `wb_mc.py not reachable (${(e as Error).message})` }
  }
}

/** Type `text` into the claude session behind wrapper `port` and press Enter. */
export function sendPrompt(port: number, text: string): Promise<ActionResult> {
  return post('send', { port, text })
}

/** Open a new console window running claude (through the wrapper) in `folder` (absolute path). */
export function startSession(folder: string): Promise<ActionResult> {
  return post('start', { folder })
}
