import { CommandDialog, CommandEmpty, CommandGroup, CommandItem } from '../../components/ui'
import type { Workspace } from './api'
import { Codicon } from './chrome'
import { fileIconOf } from './fileTypes'
import {
  activateWorkspace,
  closeAllTabs,
  closeTab,
  closeWorkspace,
  collapseAll,
  openFile,
  openWorkspace,
  type EditorState,
  type SideView,
} from './store'

/** Ctrl+Shift+P: editor commands, workspace switching and Go to File (the shell's Ctrl+K palette stays for navigation). */
export function EditorCommands({
  open,
  onOpenChange,
  state,
  candidates,
  files,
  actions,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  state: EditorState
  candidates: Workspace[]
  files: string[]
  actions: {
    togglePanel: () => void
    toggleSide: () => void
    toggleChat: () => void
    addWorkspace: () => void
    pickView: (v: SideView) => void
  }
}) {
  const root = state.activeRoot
  const active = root ? state.ws[root]?.active : null
  const run = (fn: () => void) => () => {
    onOpenChange(false)
    // Let the dialog release focus first so the editor/tree can take it.
    setTimeout(fn, 0)
  }
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Editor commands" placeholder="Type a command, workspace or file name">
      <CommandEmpty>No matching commands.</CommandEmpty>
      <CommandGroup heading="View">
        <CommandItem value="toggle panel" icon={<Codicon name="layout-panel" />} shortcut="Ctrl J" onSelect={run(actions.togglePanel)}>
          View: Toggle Panel
        </CommandItem>
        <CommandItem value="toggle side bar" icon={<Codicon name="layout-sidebar-left" />} shortcut="Ctrl B" onSelect={run(actions.toggleSide)}>
          View: Toggle Side Bar
        </CommandItem>
        <CommandItem value="toggle chat secondary side bar" icon={<Codicon name="layout-sidebar-right" />} shortcut="Ctrl Alt B" onSelect={run(actions.toggleChat)}>
          View: Toggle Chat (Secondary Side Bar)
        </CommandItem>
        <CommandItem value="show explorer" icon={<Codicon name="files" />} shortcut="Ctrl Shift E" onSelect={run(() => actions.pickView('explorer'))}>
          View: Show Explorer
        </CommandItem>
        <CommandItem value="show search" icon={<Codicon name="search" />} shortcut="Ctrl Shift F" onSelect={run(() => actions.pickView('search'))}>
          View: Show Search
        </CommandItem>
        <CommandItem value="show source control" icon={<Codicon name="source-control" />} shortcut="Ctrl Shift G" onSelect={run(() => actions.pickView('scm'))}>
          View: Show Source Control
        </CommandItem>
        <CommandItem value="show agents" icon={<Codicon name="hubot" />} onSelect={run(() => actions.pickView('agents'))}>
          View: Show Agents
        </CommandItem>
        {root && (
          <CommandItem value="collapse folders explorer" icon={<Codicon name="collapse-all" />} onSelect={run(() => collapseAll(root))}>
            Explorer: Collapse Folders
          </CommandItem>
        )}
      </CommandGroup>
      <CommandGroup heading="File">
        {root && active && (
          <CommandItem value="close editor tab" icon={<Codicon name="close" />} shortcut="Ctrl W" onSelect={run(() => closeTab(root, active))}>
            View: Close Editor
          </CommandItem>
        )}
        {root && (
          <CommandItem value="close all editors" icon={<Codicon name="close-all" />} onSelect={run(() => closeAllTabs(root))}>
            View: Close All Editors
          </CommandItem>
        )}
      </CommandGroup>
      <CommandGroup heading="Workspaces">
        {state.tabs.map((t, i) => (
          <CommandItem key={t.root} value={`switch workspace ${t.name} ${t.root}`} icon={<Codicon name="folder" />} hint={i < 9 ? `tab ${i + 1}` : undefined} onSelect={run(() => activateWorkspace(t.root))}>
            Switch Workspace: {t.name}
          </CommandItem>
        ))}
        {candidates.map((c) => (
          <CommandItem key={c.root} value={`open workspace ${c.name} ${c.root}`} icon={<Codicon name="folder-opened" />} onSelect={run(() => openWorkspace(c))}>
            Open Workspace: {c.name}
          </CommandItem>
        ))}
        <CommandItem value="open workspace choose" icon={<Codicon name="add" />} shortcut="Ctrl Shift O" onSelect={run(actions.addWorkspace)}>
          Workspace: Open Workspace…
        </CommandItem>
        {root && (
          <CommandItem value="close workspace tab" icon={<Codicon name="close" />} onSelect={run(() => closeWorkspace(root))}>
            Workspace: Close This Workspace Tab
          </CommandItem>
        )}
      </CommandGroup>
      {root && files.length > 0 && (
        <CommandGroup heading="Go to File">
          {files.map((f) => {
            const name = f.split('/').pop() ?? f
            const ic = fileIconOf(name)
            return (
              <CommandItem
                key={f}
                value={`file ${f}`}
                icon={<Codicon name={ic.icon} style={{ color: ic.color }} />}
                hint={f.includes('/') ? f.split('/').slice(0, -1).join('/') : undefined}
                onSelect={run(() => openFile(root, f, { preview: false }))}
              >
                {name}
              </CommandItem>
            )
          })}
        </CommandGroup>
      )}
    </CommandDialog>
  )
}
