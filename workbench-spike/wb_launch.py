"""wb_launch.py - start / list / stop / send for Workbench claude sessions (wb_pty_win.py wrappers).

  python wb_launch.py start <absolute-folder> [--name NAME] [--copy TASK]
  python wb_launch.py list
  python wb_launch.py stop <id-prefix-or-name>
  python wb_launch.py send <id-prefix-or-name> <text...>

Importable API: HERE, HOOKS, REGISTRY, start, sessions, find, stop, send.
Env overrides (tests): WB_HOOKS, WB_REGISTRY. Python 3.13, standard library only.
"""
import datetime
import glob
import json
import os
import re
import socket
import subprocess
import sys
import time
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import wb_mc  # noqa: E402

HOOKS = os.environ.get("WB_HOOKS") or os.path.join(HERE, "hooks.jsonl")
REGISTRY = os.environ.get("WB_REGISTRY") or os.path.join(HERE, "logs", "launched.jsonl")
WRAPPER = os.path.join(HERE, "wb_pty_win.py")
NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 _.-]{0,39}$")
CTRL_RE = re.compile(r"[\x00-\x1f\x7f-\x9f]")
ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]")
MAX_TEXT = 4000


def _check_name(name):
    if not isinstance(name, str) or not NAME_RE.match(name):
        raise ValueError("bad name: use 1-40 characters of letters, digits, space, _ . - (must start with a letter or digit)")
    return name


def _read_registry():
    out = {}
    try:
        with open(REGISTRY, encoding="utf-8") as f:
            for line in f:
                try:
                    d = json.loads(line)
                except ValueError:
                    continue
                if isinstance(d, dict) and d.get("session_id"):
                    out[d["session_id"]] = d
    except OSError:
        pass
    return out


def _append_registry(rec):
    os.makedirs(os.path.dirname(REGISTRY) or ".", exist_ok=True)
    with open(REGISTRY, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec) + "\n")


def _trust_note(t0):
    """Look at the newest wrapper output log written after t0 for a folder-trust prompt."""
    try:
        logs = [p for p in glob.glob(os.path.join(HERE, "logs", "out-*.log")) if os.path.getmtime(p) >= t0 - 1]
        if not logs:
            return None
        newest = max(logs, key=os.path.getmtime)
        with open(newest, "rb") as f:
            f.seek(0, 2)
            f.seek(max(0, f.tell() - 60000))
            text = ANSI_RE.sub(" ", f.read().decode("utf-8", "replace")).lower()
        text = re.sub(r"\s+", " ", text)
        if "trust" in text and ("folder" in text or "files" in text):
            return "needs folder trust: approve it once in the new window"
    except OSError:
        pass
    return None


def start(folder, name, extra_args=(), session_id=None, wait=30, _extra_rec=None):
    if not isinstance(folder, str) or not os.path.isabs(folder):
        raise ValueError("folder must be an absolute path")
    if not os.path.isdir(folder):
        raise ValueError("folder does not exist: " + folder)
    _check_name(name)
    extra_args = [str(a) for a in extra_args]
    if any(CTRL_RE.search(a) for a in extra_args):
        raise ValueError("extra args must not contain control characters")
    if session_id is None:
        session_id = str(uuid.uuid4())
    elif not re.fullmatch(r"[0-9a-fA-F-]{36}", str(session_id)):
        raise ValueError("session_id must be a UUID")
    if not os.path.isfile(WRAPPER):
        raise ValueError("wrapper missing: " + WRAPPER)
    t0 = time.time()
    p = subprocess.Popen(
        [sys.executable, WRAPPER, "claude", "--remote-control", name, "--session-id", session_id, *extra_args],
        cwd=folder, creationflags=getattr(subprocess, "CREATE_NEW_CONSOLE", 0))
    rec = {"session_id": session_id, "name": name, "folder": folder, "pid": p.pid,
           "started": datetime.datetime.now().isoformat(timespec="seconds"), "extra": extra_args}
    if _extra_rec:
        rec.update(_extra_rec)
    _append_registry(rec)
    res = {"session_id": session_id, "port": None, "pid": p.pid, "folder": folder, "name": name, "note": ""}
    deadline = t0 + max(0, wait)
    while True:
        for ev in wb_mc.read_events(HOOKS):
            if ev.get("session_id") == session_id and ev.get("hook_event_name") == "SessionStart":
                try:
                    res["port"] = int(ev.get("_wb_port"))
                except (TypeError, ValueError):
                    res["port"] = None
                if res["port"] is not None:
                    return res
        code = p.poll()
        if code is not None:
            res["note"] = "wrapper exited early (code %s); check claude is installed and logged in" % code
            return res
        if time.time() >= deadline:
            break
        time.sleep(0.5)
    res["note"] = _trust_note(t0) or "no SessionStart yet"
    return res


def sessions():
    """Online sessions, newest first, joined with the registry (name, folder)."""
    reg = _read_registry()
    out = []
    for s in wb_mc.live_state(HOOKS)["sessions"]:
        if not (s.get("online") or s.get("status") == "working"):
            continue
        r = reg.get(s["session_id"], {})
        d = dict(s)
        d["name"] = r.get("name")
        d["folder"] = r.get("folder") or s.get("cwd")
        out.append(d)
    return out


def find(prefix):
    if not isinstance(prefix, str) or not prefix.strip():
        raise ValueError("give a session id prefix (4+ characters) or a name")
    key = prefix.strip()
    low = key.lower()
    hits = {}
    for s in sessions():
        if (len(low) >= 4 and s["session_id"].lower().startswith(low)) or (s["name"] or "").lower() == low:
            hits[s["session_id"]] = s
    if len(hits) == 1:
        return next(iter(hits.values()))
    if not hits:
        if len(low) < 4 and not any((s["name"] or "").lower() == low for s in sessions()):
            raise ValueError("%r matches no live session (ids need 4+ characters; try `list`)" % key)
        raise ValueError("no live session matches %r (try `list`)" % key)
    raise ValueError("ambiguous %r, matches: %s" % (key, ", ".join(
        "%s (%s)" % (s["session_id"][:8], s["name"] or "-") for s in hits.values())))


def _to_port(port, payload):
    try:
        with socket.create_connection(("127.0.0.1", int(port)), timeout=3) as c:
            c.sendall(payload.encode("utf-8"))
    except (OSError, TypeError, ValueError) as e:
        raise ValueError("wrapper not reachable on port %s (%s)" % (port, e))


def stop(prefix):
    s = find(prefix)
    if s.get("port") is None:
        raise ValueError("session has no port")
    _to_port(s["port"], "\x04/exit")
    return s


def send(prefix, text):
    if not isinstance(text, str) or not text.strip():
        raise ValueError("nothing to send")
    if len(text) > MAX_TEXT:
        raise ValueError("text too long (%d > %d characters)" % (len(text), MAX_TEXT))
    if CTRL_RE.search(text):
        raise ValueError("text must not contain control characters")
    s = find(prefix)
    if s.get("port") is None:
        raise ValueError("session has no port")
    _to_port(s["port"], "\x04" + text)
    return s


# ---------------------------------------------------------------- CLI

def _one(s, n):
    return re.sub(r"\s+", " ", s or "").strip()[:n]


def _cli_start(args):
    folder = name = task = None
    i = 0
    while i < len(args):
        a = args[i]
        if a in ("--name", "--copy"):
            if i + 1 >= len(args):
                raise ValueError(a + " needs a value")
            if a == "--name":
                name = args[i + 1]
            else:
                task = args[i + 1]
            i += 2
        elif a.startswith("--") or folder is not None:
            raise ValueError("unexpected argument: " + a)
        else:
            folder = a
            i += 1
    if folder is None:
        raise ValueError("usage: start <absolute-folder> [--name NAME] [--copy TASK]")
    if not os.path.isabs(folder):
        raise ValueError("folder must be an absolute path")
    if not os.path.isdir(folder):
        raise ValueError("folder does not exist: " + folder)
    folder = os.path.normpath(folder)
    if name is None:
        base = os.path.basename(folder) or "session"
        base = re.sub(r"[^A-Za-z0-9 _.-]", "-", base).lstrip(" _.-") or "session"
        name = (base[:34].rstrip() + " " + datetime.datetime.now().strftime("%H%M"))
    _check_name(name)
    rec = None
    run_in = folder
    if task is not None:
        import wb_copy
        if not wb_copy.TASK_RE.match(task):
            raise ValueError("bad --copy task: letters, digits, _ and - only (max 64)")
        if not os.path.exists(os.path.join(folder, ".git")):
            raise ValueError("--copy needs a git repo (no .git in %s)" % folder)
        r = subprocess.run([sys.executable, os.path.join(HERE, "wb_copy.py"), "new", folder, task],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode != 0:
            raise ValueError("copy failed: " + _one(r.stderr or r.stdout, 200))
        repo = os.path.realpath(folder)
        run_in = str(wb_copy.root() / os.path.basename(repo) / task)
        rec = {"repo": repo, "task": task}
    res = start(run_in, name, _extra_rec=rec)
    if res["port"] is not None:
        return "started %s session %s port %d in %s" % (res["name"], res["session_id"][:8], res["port"], res["folder"])
    return "started %s session %s but no port: %s (folder %s)" % (res["name"], res["session_id"][:8], res["note"], res["folder"])


def _cli_list(args):
    ss = sessions()
    if not ss:
        return "no live sessions"
    return "\n".join("%s  %s  %s  port %s  %s  | last: %s" % (
        s["session_id"][:8], s["name"] or "-", s["status"], s["port"], s.get("cwd") or s["folder"],
        _one(s.get("last_prompt"), 60)) for s in ss)


def _cli_stop(args):
    if len(args) != 1:
        raise ValueError("usage: stop <id-prefix-or-name>")
    s = stop(args[0])
    return "stop sent to %s (%s)" % (s["session_id"][:8], s["name"] or "-")


def _cli_send(args):
    if len(args) < 2:
        raise ValueError("usage: send <id-prefix-or-name> <text...>")
    s = send(args[0], " ".join(args[1:]))
    return "sent to %s (%s)" % (s["session_id"][:8], s["name"] or "-")


def main(argv):
    for st in (sys.stdout, sys.stderr):
        try:
            st.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    cmds = {"start": _cli_start, "list": _cli_list, "stop": _cli_stop, "send": _cli_send}
    try:
        if len(argv) < 2 or argv[1] not in cmds:
            raise ValueError("usage: wb_launch.py start|list|stop|send ...")
        print(cmds[argv[1]](argv[2:]))
        return 0
    except (ValueError, OSError) as e:
        print("error: " + _one(str(e), 300))
        return 1
    except Exception as e:  # never a stack trace
        print("error: %s: %s" % (type(e).__name__, _one(str(e), 200)))
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
