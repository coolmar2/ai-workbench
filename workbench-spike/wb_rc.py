"""Spike step 5: always-on Remote Control servers, one per project, with no git trace.

Uses Claude Code's own `claude remote-control` server (a program, not an agent): it stays up and you start
fresh sessions in it from the Claude mobile app or claude.ai/code. Its worktree mode is pointed at our
WorktreeCreate/WorktreeRemove hooks, so each new session gets a private copy (wb_copy.py) outside the repo
instead of a git worktree or branch. The server runs from a small launcher folder (rc/<name>) so no settings
file is ever written into the real repo.

  python wb_rc.py add <absolute repo path> [--name NAME]   create the launcher folder for a repo
  python wb_rc.py start <name|all>                         start the server(s) in the background
  python wb_rc.py stop <name|all>
  python wb_rc.py list
Hook entry points (called by claude, not by you): hook-create, hook-remove.
"""
import json, os, re, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
RC = HERE / "rc"
COPY_HOME = HERE / "rc-home"  # WB_HOME for wb_copy: copies live under rc-home/copies (a trusted folder)
NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$")
PY = "python " + (HERE / "wb_rc.py").as_posix()
HOOK = "python " + (HERE / "wb_hook.py").as_posix()
EVENTS = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "SubagentStart",
          "SubagentStop", "Notification", "Stop", "SessionEnd"]


def die(msg):
    print("error: " + msg, file=sys.stderr)
    sys.exit(1)


def write_json(p, obj):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, indent=2) + "\n", encoding="utf-8")


def session_settings():
    """Settings every spawned session gets inside its private copy (never applied to the repo: wb_copy skips .claude)."""
    return {
        "hooks": {e: [{"matcher": "*", "hooks": [{"type": "command", "command": f"{HOOK} {e}"}]}] for e in EVENTS},
        "attribution": {"commit": "", "pr": "", "sessionUrl": False},
        "permissions": {"deny": ["Bash(git commit:*)", "Bash(git push:*)", "Bash(git branch:*)",
                                 "Bash(git checkout -b:*)", "Bash(git switch -c:*)", "Bash(git worktree:*)",
                                 "Bash(gh pr:*)"]},
    }


def cmd_add(repo, name):
    r = Path(repo)
    if not r.is_absolute() or not (r / ".git").exists():
        die(f"not an absolute path to a git checkout: {repo}")
    name = name or r.name
    if not NAME_RE.match(name):
        die(f"bad name {name!r}: letters, digits, '_' and '-' only")
    d = RC / name
    write_json(d / "wb-rc.json", {"repo": str(r.resolve()), "name": name})
    write_json(d / ".claude" / "settings.local.json", {"hooks": {
        "WorktreeCreate": [{"hooks": [{"type": "command", "command": f"{PY} hook-create"}]}],
        "WorktreeRemove": [{"hooks": [{"type": "command", "command": f"{PY} hook-remove"}]}],
    }})
    print(f"added {name}: launcher {d} -> repo {r}")


def launchers(which):
    all_ = sorted(p.parent for p in RC.glob("*/wb-rc.json"))
    if which == "all":
        return all_
    sel = [p for p in all_ if p.name == which]
    if not sel:
        die(f"no launcher named {which!r} (have: {', '.join(p.name for p in all_) or 'none'})")
    return sel


def clean_env():
    # a server started from inside a Claude session must not inherit its markers or tokens
    return {k: v for k, v in os.environ.items()
            if not (k.upper().startswith("CLAUDE") and not k.upper().startswith("CLAUDE_CODE_USE_"))}


def running(d):
    pidf = d / "server.pid"
    if not pidf.exists():
        return None
    pid = pidf.read_text().strip()
    out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/NH"], capture_output=True, text=True).stdout
    return pid if pid in out else None


def cmd_start(which):
    for d in launchers(which):
        if running(d):
            print(f"{d.name}: already running (pid {running(d)})")
            continue
        log = open(d / "server.log", "ab")
        p = subprocess.Popen(["claude", "remote-control", "--spawn", "worktree", "--capacity", "5",
                              "--name", d.name, "--no-create-session-in-dir"],
                             cwd=d, env=clean_env(), stdout=log, stderr=log, stdin=subprocess.DEVNULL,
                             creationflags=subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP)
        (d / "server.pid").write_text(str(p.pid))
        print(f"{d.name}: started (pid {p.pid}), log {d / 'server.log'}")


def cmd_stop(which):
    for d in launchers(which):
        pid = running(d)
        if not pid:
            print(f"{d.name}: not running")
            continue
        subprocess.run(["taskkill", "/PID", pid, "/T", "/F"], capture_output=True)
        print(f"{d.name}: stopped")


def cmd_list():
    for d in launchers("all"):
        cfg = json.loads((d / "wb-rc.json").read_text(encoding="utf-8"))
        pid = running(d)
        print(f"{d.name:20} {'running pid ' + pid if pid else 'stopped':18} {cfg['repo']}")


def hook_log(msg):
    with open(RC / "hook.log", "a", encoding="utf-8") as f:
        f.write(msg + "\n")


def launcher_cfg(cwd):
    for d in [Path(cwd), *Path(cwd).parents]:
        if (d / "wb-rc.json").exists():
            return json.loads((d / "wb-rc.json").read_text(encoding="utf-8"))
    die(f"no wb-rc.json at or above {cwd}")


def wb_copy(*args):
    env = dict(os.environ, WB_HOME=str(COPY_HOME))
    return subprocess.run([sys.executable, "-I", str(HERE / "wb_copy.py"), *args],
                          capture_output=True, text=True, env=env)


def hook_create():
    ev = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    cfg = launcher_cfg(ev.get("cwd") or os.getcwd())
    task = re.sub(r"[^A-Za-z0-9_-]", "-", ev.get("name") or "")[:64].strip("-") or "session"
    r = wb_copy("new", cfg["repo"], task)
    if r.returncode:
        hook_log(f"create {task}: FAILED {r.stderr.strip()}")
        die(r.stderr.strip() or "wb_copy new failed")
    copy = COPY_HOME / "copies" / Path(cfg["repo"]).name / task
    write_json(copy / ".claude" / "settings.local.json", session_settings())
    hook_log(f"create {task}: {copy}")
    print(r.stdout, file=sys.stderr)
    print(copy)  # last stdout line = the path claude starts the session in


def hook_remove():
    ev = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    p = Path(ev.get("worktree_path") or "")
    if p.parent.parent != COPY_HOME / "copies":
        die(f"not one of our copies: {p}")
    repo = (p.parent / (p.name + ".repo")).read_text(encoding="utf-8").strip()
    os.environ["WB_HOME"] = str(COPY_HOME)
    sys.path.insert(0, str(HERE))
    import wb_copy as wc  # changes() ignores .claude etc., so our own session settings don't count as a change
    added, modified, deleted, _, _ = wc.changes(Path(repo), p.name)
    if not (added or modified or deleted):
        wb_copy("drop", repo, p.name)
        hook_log(f"remove {p.name}: no changes, dropped")
        return
    # keep it: the user reviews and applies it (python wb_copy.py diff/apply/drop <repo> <task>, WB_HOME=rc-home)
    hook_log(f"remove {p.name}: has changes, kept for review")
    die(f"kept {p}: it has changes; review with wb_copy diff/apply")


def main(a):
    if a[:1] == ["add"] and len(a) >= 2:
        cmd_add(a[1], a[a.index("--name") + 1] if "--name" in a else None)
    elif a[:1] in (["start"], ["stop"]) and len(a) == 2:
        (cmd_start if a[0] == "start" else cmd_stop)(a[1])
    elif a == ["list"]:
        cmd_list()
    elif a == ["hook-create"]:
        hook_create()
    elif a == ["hook-remove"]:
        hook_remove()
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
