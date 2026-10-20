import { Codicon } from './chrome'
import { languageLabel, type CursorInfo } from './fileTypes'
import { setFollow, useFollow } from './playback/engine'
import { simEnabled, simNext } from './playback/simulate'

/** 22px VS Code status bar. */
export function StatusBar({
  info,
  encoding,
  errors,
  warnings,
  agentsRunning,
  sample,
  chatOpen,
  onProblems,
  onAgents,
  onChat,
  onPalette,
}: {
  info: CursorInfo | null
  encoding: string
  errors: number
  warnings: number
  agentsRunning: number
  sample: boolean
  chatOpen: boolean
  onProblems: () => void
  onAgents: () => void
  onChat: () => void
  onPalette: () => void
}) {
  const follow = useFollow()
  return (
    <footer className="vsc-status" aria-label="Status bar">
      <div className="vsc-status-group">
        <button type="button" className="vsc-sitem" data-remote="true" aria-label="Workbench" onClick={onPalette}>
          <Codicon name="remote" />
          <span className="vsc-hide-narrow">Workbench</span>
        </button>
        <span className="vsc-sitem">
          <Codicon name="git-branch" />
          <span className="vsc-hide-narrow">no git info</span>
        </span>
        <button type="button" className="vsc-sitem" aria-label={`${errors} errors, ${warnings} warnings`} onClick={onProblems}>
          <Codicon name="error" /> {errors}
          <Codicon name="warning" style={{ marginLeft: 4 }} /> {warnings}
        </button>
        {sample && (
          <span className="vsc-sitem" data-warn="true">
            Sample data
          </span>
        )}
      </div>
      <div className="vsc-status-group">
        {simEnabled && (
          <button type="button" className="vsc-sitem" aria-label="Simulate an agent edit (dev only)" onClick={() => void simNext()}>
            <Codicon name="play" />
            <span>Simulate edit</span>
          </button>
        )}
        <button type="button" className="vsc-sitem" aria-label="Follow agents" aria-pressed={follow} title="Open and show the files agents are editing" onClick={() => setFollow(!follow)}>
          <Codicon name={follow ? 'eye' : 'eye-closed'} />
          <span className="vsc-hide-narrow">{follow ? 'Following agents' : 'Not following'}</span>
        </button>
        {info && (
          <>
            <span className="vsc-sitem">
              Ln {info.ln}, Col {info.col}
            </span>
            <span className="vsc-sitem vsc-hide-narrow">{info.spaces ? `Spaces: ${info.tabSize}` : `Tab Size: ${info.tabSize}`}</span>
            <span className="vsc-sitem vsc-hide-narrow">{encoding.toUpperCase()}</span>
            <span className="vsc-sitem vsc-hide-narrow">{info.eol}</span>
            <span className="vsc-sitem vsc-hide-narrow">{languageLabel(info.lang)}</span>
          </>
        )}
        <button type="button" className="vsc-sitem" aria-label={`${agentsRunning} agents running`} onClick={onAgents}>
          <Codicon name="hubot" />
          <span>{agentsRunning}</span>
          <span className="vsc-hide-narrow">running</span>
        </button>
        <button type="button" className="vsc-sitem" aria-label="Toggle Chat" aria-pressed={chatOpen} onClick={onChat}>
          <Codicon name="comment-discussion" />
        </button>
      </div>
    </footer>
  )
}
