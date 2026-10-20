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

/** Raw keystrokes into the session's terminal (what you type in the in-app terminal). 1-4096 chars. */
export function sendRaw(port: number, raw: string): Promise<ActionResult> {
  return post('send', { port, raw })
}

/** Named key: 'esc' interrupts claude (Pause); '1'/'2'/'3' answer a numbered prompt. */
export function sendKeys(port: number, keys: 'esc' | '1' | '2' | '3'): Promise<ActionResult> {
  return post('send', { port, keys })
}

/** Resize the session's pseudo-terminal (10-500 each way). */
export function resizeTerm(port: number, cols: number, rows: number): Promise<ActionResult> {
  const c = (n: number) => Math.max(10, Math.min(500, Math.round(n)))
  return post('send', { port, resize: [c(cols), c(rows)] })
}

/** Open a new console window running claude (through the wrapper) in `folder` (absolute path). */
export function startSession(folder: string): Promise<ActionResult> {
  return post('start', { folder })
}
