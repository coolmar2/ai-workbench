import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { AgentMark } from '../../components/ui'
import type { Vendor } from '../../data/types'
import { dirKey, dirs, loadDir } from './api'
import { Codicon } from './chrome'
import { fileIconOf, parentOf } from './fileTypes'
import { useAnimating } from './playback/engine'

type Row =
  | { kind: 'entry'; path: string; name: string; dir: boolean; depth: number }
  | { kind: 'msg'; key: string; depth: number; text: string; error?: boolean; retry?: string }

const join = (dir: string, name: string) => (dir ? `${dir}/${name}` : name)


export function FileTree({
  root,
  expanded,
  active,
  marks,
  onToggle,
  onOpen,
}: {
  root: string
  expanded: string[]
  active: string | null
  marks: (path: string) => Vendor[]
  onToggle: (path: string, force?: boolean) => void
  onOpen: (path: string, pin: boolean) => void
}) {
  dirs.useVersion() // re-render when any directory listing changes
  const treeRef = useRef<HTMLDivElement>(null)
  const [sel, setSel] = useState<{ path: string; at: string | null } | null>(null)
  const selected = sel && sel.at === active ? sel.path : active
  const animating = useAnimating()
  // Files (and their folders) an agent edit is being played back in right now.
  const live = useMemo(() => {
    const out = new Map<string, Vendor>()
    for (const [k, v] of animating) {
      const [r, p] = k.split('\n')
      if (r !== root) continue
      const parts = p.split('/')
      for (let i = 1; i <= parts.length; i++) out.set(parts.slice(0, i).join('/'), v)
    }
    return out
  }, [animating, root])

  useEffect(() => {
    void loadDir(root, '')
    for (const p of expanded) void loadDir(root, p)
  }, [root, expanded])

  const rows = ((): Row[] => {
    const out: Row[] = []
    const open = new Set(expanded)
    const walk = (dir: string, depth: number) => {
      const d = dirs.get(dirKey(root, dir))
      if (!d || d.state === 'loading') {
        out.push({ kind: 'msg', key: `l:${dir}`, depth, text: 'Loading…' })
        return
      }
      if (d.state === 'error') {
        out.push({ kind: 'msg', key: `e:${dir}`, depth, text: d.message, error: true, retry: dir })
        return
      }
      if (!d.entries.length && dir) out.push({ kind: 'msg', key: `n:${dir}`, depth, text: 'Empty folder' })
      for (const e of d.entries) {
        const p = join(dir, e.name)
        const isDir = e.type === 'dir'
        out.push({ kind: 'entry', path: p, name: e.name, dir: isDir, depth })
        if (isDir && open.has(p)) walk(p, depth + 1)
      }
    }
    walk('', 0)
    return out
  })()

  useEffect(() => {
    treeRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const entries = rows.filter((r): r is Extract<Row, { kind: 'entry' }> => r.kind === 'entry')
  const openSet = new Set(expanded)

  const onKey = (e: KeyboardEvent) => {
    const i = entries.findIndex((r) => r.path === selected)
    const cur = entries[i]
    const pick = (r: (typeof entries)[number] | undefined) => {
      if (r) setSel({ path: r.path, at: active })
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        pick(entries[Math.min(entries.length - 1, i + 1)])
        break
      case 'ArrowUp':
        e.preventDefault()
        pick(entries[Math.max(0, i - 1)])
        break
      case 'Home':
        e.preventDefault()
        pick(entries[0])
        break
      case 'End':
        e.preventDefault()
        pick(entries[entries.length - 1])
        break
      case 'ArrowRight':
        if (cur?.dir) {
          e.preventDefault()
          if (!openSet.has(cur.path)) onToggle(cur.path, true)
          else pick(entries[i + 1])
        }
        break
      case 'ArrowLeft':
        if (cur) {
          e.preventDefault()
          if (cur.dir && openSet.has(cur.path)) onToggle(cur.path, false)
          else pick(entries.find((r) => r.path === parentOf(cur.path)))
        }
        break
      case 'Enter':
      case ' ':
        if (cur) {
          e.preventDefault()
          if (cur.dir) onToggle(cur.path)
          else onOpen(cur.path, e.key === 'Enter')
        }
        break
    }
  }

  return (
    <div ref={treeRef} className="vsc-tree" role="tree" aria-label="Files" tabIndex={0} onKeyDown={onKey}>
      {rows.map((r) => {
        if (r.kind === 'msg') {
          return (
            <div key={r.key} className="vsc-row" style={{ paddingLeft: r.depth * 8 + 16, color: r.error ? '#f48771' : '#9d9d9d', cursor: 'default' }}>
              {r.text}
              {r.retry !== undefined && (
                <button type="button" style={{ marginLeft: 8, color: '#4daafc' }} onClick={() => void loadDir(root, r.retry!, true)}>
                  Retry
                </button>
              )}
            </div>
          )
        }
        const isOpen = r.dir && openSet.has(r.path)
        const ic = r.dir ? { icon: isOpen ? 'folder-opened' : 'folder', color: '#c5c5c5' } : fileIconOf(r.name)
        const lv = live.get(r.path.toLowerCase())
        const m = lv ? [...new Set([...marks(r.path), lv])] : marks(r.path)
        return (
          <div
            key={r.path}
            role="treeitem"
            aria-level={r.depth + 1}
            aria-expanded={r.dir ? isOpen : undefined}
            aria-selected={selected === r.path}
            data-selected={selected === r.path}
            className="vsc-row"
            style={{ paddingLeft: r.depth * 8 }}
            onClick={() => {
              setSel({ path: r.path, at: active })
              treeRef.current?.focus({ preventScroll: true })
              if (r.dir) onToggle(r.path)
              else onOpen(r.path, false)
            }}
            onDoubleClick={() => !r.dir && onOpen(r.path, true)}
          >
            {Array.from({ length: r.depth }, (_, l) => (
              <span key={l} className="vsc-guide" style={{ left: l * 8 + 8 }} />
            ))}
            <span className="vsc-twistie">{r.dir && <Codicon name={isOpen ? 'chevron-down' : 'chevron-right'} />}</span>
            <span className="vsc-ficon">
              <Codicon name={ic.icon} style={{ color: ic.color }} />
            </span>
            <span className="vsc-row-label">{r.name}</span>
            {m.length > 0 && (
              <span className="vsc-row-marks" data-live={lv ? 'true' : undefined}>
                {m.slice(0, 3).map((v) => (
                  <AgentMark key={v} vendor={v} activity="editing" className={v === lv ? 'wbpb-pulse' : undefined} />
                ))}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
