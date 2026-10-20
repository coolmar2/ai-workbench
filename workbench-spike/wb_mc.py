"""Spike step 3: "Mission control" - a tiny local web page showing Claude Code sessions and their sub-agents.

Reads the hooks.jsonl written by wb_hook.py (re-read on every /state request) and can forward typed text / raw keys
to each session's prompt-injection wrapper (wb_pty_win.py), which listens on its own port in 47840-47859,
and can start a new claude session (in a new console window) in a folder.

Run:  python -I wb_mc.py [--port 47832] [--hooks hooks.jsonl]
Open: http://127.0.0.1:47832/
Python 3.13, standard library only.
"""
import argparse
import bisect
import datetime
import json
import os
import pathlib
import re
import time
import hmac
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
PORT_MIN, PORT_MAX = 47840, 47859
KEYS = {"esc": "\x01\x1b", "1": "\x011", "2": "\x012", "3": "\x013"}


def trim(s, n):
    s = (s or "").strip()
    return s if len(s) <= n else s[: n - 1] + "…"


def read_events(path):
    """Parse the JSONL file, skipping lines that fail to parse."""
    out = []
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                try:
                    d = json.loads(line)
                except ValueError:
                    continue
                if isinstance(d, dict):
                    out.append(d)
    except OSError:
        pass
    return out


def read_meta(ev):
    """Sub-agent meta.json next to the session transcript; {} if missing or broken."""
    tp = ev.get("transcript_path") or ""
    if not tp or not ev.get("agent_id"):
        return {}
    base = tp[:-6] if tp.endswith(".jsonl") else tp
    p = os.path.join(base, "subagents", "agent-%s.meta.json" % ev["agent_id"])
    try:
        with open(p, encoding="utf-8") as f:
            m = json.load(f)
        return m if isinstance(m, dict) else {}
    except (OSError, ValueError):
        return {}


def _parse_hms(t):
    """'HH:MM:SS' -> datetime.time, or None."""
    try:
        h, m, s = (int(x) for x in str(t).split(":"))
        return datetime.time(h, m, s)
    except (ValueError, TypeError):
        return None


def _at(day, tm, delta_days=0):
    return (datetime.datetime.combine(day, tm) + datetime.timedelta(days=delta_days)).timestamp()


def resolve_epochs(pairs, mtime=None):
    """pairs: list of (ts or None, 't' string or None), one per event, in file order.
    Returns a list of epoch floats (None only if nothing at all is known). Events with _ts keep it. Older events
    (only 'HH:MM:SS') get the latest matching time not after the next event with a _ts (that handles midnight
    rollover by monotonic order); runs after the last _ts go forward from it; a file with no _ts at all is anchored
    on its mtime (the last event is assumed to be at or before it)."""
    n = len(pairs)
    res = [None] * n
    last = -1
    for i, (ts, _t) in enumerate(pairs):
        if isinstance(ts, (int, float)) and not isinstance(ts, bool):
            last = i
    if last >= 0:
        anchor = float(pairs[last][0])
        start = last
    else:
        anchor = float(mtime) if mtime is not None else time.time()
        start = n - 1
    for i in range(start, -1, -1):  # backward: each event is the latest HH:MM:SS not after the next one
        ts, t = pairs[i]
        if isinstance(ts, (int, float)) and not isinstance(ts, bool):
            res[i] = anchor = float(ts)
            continue
        tm = _parse_hms(t)
        if tm is None:
            res[i] = anchor
            continue
        day = datetime.datetime.fromtimestamp(anchor).date()
        c = _at(day, tm)
        k = 0
        while c > anchor and k < 400:
            k += 1
            c = _at(day, tm, -k)
        res[i] = anchor = c
    prev = anchor if last >= 0 else None
    if last >= 0:
        prev = float(pairs[last][0])
        for i in range(last + 1, n):  # forward after the last _ts
            tm = _parse_hms(pairs[i][1])
            if tm is None:
                res[i] = prev
                continue
            day = datetime.datetime.fromtimestamp(prev).date()
            c = _at(day, tm)
            k = 0
            while c < prev and k < 400:
                k += 1
                c = _at(day, tm, k)
            res[i] = prev = c
    return res


def assign_ts(events, mtime=None):
    return resolve_epochs([(e.get("_ts"), e.get("_t")) for e in events], mtime)


def fmt_dur(sec):
    sec = int(round(sec))
    if sec < 60:
        return "%ds" % sec
    if sec < 3600:
        return "%dm %02ds" % (sec // 60, sec % 60) if sec % 60 else "%dm" % (sec // 60)
    return "%dh %02dm" % (sec // 3600, sec % 3600 // 60)


def _median(xs):
    xs = sorted(xs)
    n = len(xs)
    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2


def _percentile(xs, q):
    xs = sorted(xs)
    if len(xs) == 1:
        return xs[0]
    k = (len(xs) - 1) * q
    lo = int(k)
    hi = min(lo + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * (k - lo)


def estimate(elapsed, history, default, label, todos=None, now=None):
    """Pure ETA helper. elapsed: seconds since start. history: durations (s) of comparable finished runs.
    default: baseline when there is no history. label: e.g. 'Explore runs'. todos: (done, total) or None."""
    now = time.time() if now is None else now
    elapsed = max(0.0, float(elapsed))
    history = [h for h in history if h and h > 0]
    n = len(history)
    med = _median(history) if n else None
    p90 = _percentile(history, 0.9) if n >= 5 else None
    base = med if n else float(default)
    progress = None
    est = None
    done = total = 0
    if todos and todos[1] > 0:
        done, total = todos
        progress = max(0.0, min(1.0, done / total))
        if done >= 1:
            est = elapsed * total / done
    if n:
        hist_basis = "%d past %s (median %s)" % (n, label, fmt_dur(med))
    else:
        hist_basis = "no history yet, guessing %s" % fmt_dur(default)
    if est is not None:
        conf = "medium"
        if done >= 3 and n >= 8 and abs(est - med) <= 0.5 * med:
            conf = "high"
        basis = "%d/%d todos done; %s" % (done, total, hist_basis)
    else:
        est = base
        conf = "low" if n < 5 else "medium"
        basis = hist_basis
        if n < 5 and elapsed >= base:
            est = max(base, elapsed * 1.5)  # past the baseline with no signal: keep a moving, honest guess
            conf = "low"
            basis = ("longer than past runs (median %s) — rough guess" % fmt_dur(med)) if n else                 "longer than the %s guess — rough guess" % fmt_dur(default)
    overrun = bool(p90 is not None and elapsed > p90)
    if overrun and not (progress is not None and done >= 1):
        left = None
        basis = "taking longer than usual (90%% finish in %s)" % fmt_dur(p90)
    else:
        left = max(5.0, est - elapsed)
    return {"seconds_left": None if left is None else int(round(left)),
            "finish_at": None if left is None else now + left,
            "elapsed": round(elapsed, 1), "progress": progress, "confidence": conf,
            "basis": basis, "overrun": overrun}


def _raise_floor(eta, floor, now):
    """A turn is never expected to end before its running agents do."""
    if eta and eta["seconds_left"] is not None and floor is not None and floor > eta["seconds_left"]:
        eta["seconds_left"] = int(floor)
        eta["finish_at"] = now + floor
    return eta


def _todo_counts(ev):
    todos = (ev.get("tool_input") or {}).get("todos")
    if not isinstance(todos, list) or not todos:
        return None
    done = sum(1 for t in todos if isinstance(t, dict) and t.get("status") == "completed")
    return (done, len(todos))


def _todo_list(ev):
    """Normalised TodoWrite list [{content, status, active_form}] or None."""
    todos = (ev.get("tool_input") or {}).get("todos")
    if not isinstance(todos, list) or not todos:
        return None
    out = []
    for t in todos:
        if not isinstance(t, dict):
            continue
        out.append({"content": str(t.get("content") or ""), "status": str(t.get("status") or "pending"),
                    "active_form": str(t.get("activeForm") or t.get("active_form") or "")})
    return out or None


def todo_step(todos):
    """1-based index of the in_progress (else first pending, else last) item; None without todos."""
    if not todos:
        return None
    idx = next((i for i, t in enumerate(todos) if t["status"] == "in_progress"), None)
    if idx is None:
        idx = next((i for i, t in enumerate(todos) if t["status"] == "pending"), len(todos) - 1)
    return {"index": idx + 1, "total": len(todos), "label": todos[idx]["content"]}


_META_CACHE = {}


def build_state(lines, now=None, mtime=None):
    """Turn parsed hook events (list of dicts) into {"sessions": [...]}, newest session first.
    Pure apart from reading sub-agent meta files. now/mtime exist for testability."""
    now = time.time() if now is None else now
    stamps = assign_ts(lines, mtime if mtime is not None else now)
    sessions = {}
    order = []  # session ids by last event (updated as we go)
    turns_done = []  # (cwd, duration) of every completed turn
    for ev, ts in zip(lines, stamps):
        sid = ev.get("session_id")
        if not sid:
            continue
        # events carry _ts (epoch) now and no _t; old ones only _t. The UI shows HH:MM:SS strings.
        tstr = ev.get("_t") or (time.strftime("%H:%M:%S", time.localtime(ts)) if ts else None)
        s = sessions.get(sid)
        if s is None:
            s = sessions[sid] = {
                "session_id": sid, "cwd": ev.get("cwd", ""), "started": tstr,
                "last_event_t": None, "status": "idle", "last_prompt": "", "last_reply": "",
                "current_tool": None, "event_count": 0, "port": None, "turn_started": None,
                "_open": {}, "_agents": {}, "_ev": ev, "_todos": None, "_tl": None,
            }
        order.append(sid)
        s["event_count"] += 1
        s["last_event_t"] = tstr
        if ev.get("cwd"):
            s["cwd"] = ev["cwd"]
        try:
            if ev.get("_wb_port"):
                s["port"] = int(ev["_wb_port"])
        except (TypeError, ValueError):
            pass
        name = ev.get("hook_event_name")
        aid = ev.get("agent_id")
        a = None
        if aid:
            a = s["_agents"].setdefault(aid, {
                "agent_id": aid, "agent_type": ev.get("agent_type") or "", "started_t": None,
                "stopped_t": None, "last_tool": None, "tool_count": 0, "result": "",
                "_started": False, "_ev": ev, "_start": None, "_stop": None, "_todos": None, "_tl": None})
            if ev.get("agent_type") and not a["agent_type"]:
                a["agent_type"] = ev["agent_type"]
        if name == "PreToolUse" and ev.get("tool_name") == "TodoWrite":
            tc = _todo_counts(ev)
            if tc:
                (a if a else s)["_todos"] = tc
            (a if a else s)["_tl"] = _todo_list(ev)
        if name == "SubagentStart" and a:
            a["_started"] = True
            a["started_t"] = tstr
            a["_start"] = ts
        elif name == "SubagentStop" and a:
            a["stopped_t"] = tstr or "?"
            a["_stop"] = ts
            if ev.get("last_assistant_message"):
                a["result"] = trim(ev["last_assistant_message"], 300)
        elif name == "PreToolUse" and a and ev.get("tool_name") == "SubagentHandback":
            # background agents return their report this way; their SubagentStop has no message
            a["result"] = trim((ev.get("tool_input") or {}).get("message"), 300)
        elif name == "PreToolUse" and a:
            a["last_tool"] = ev.get("tool_name")
            a["tool_count"] += 1
        if aid:
            continue  # sub-agent events never affect session status
        if name in ("UserPromptSubmit", "PreToolUse", "PostToolUse"):
            s["status"] = "working"
        elif name == "Notification":
            nt = ev.get("notification_type")
            if nt == "permission_prompt":
                s["status"] = "needs you"
            elif nt == "idle_prompt":
                s["status"] = "idle"
        elif name in ("Stop", "SessionStart"):
            s["status"] = "idle"
        elif name == "SessionEnd":
            s["status"] = "ended"
        if name == "UserPromptSubmit":
            p = ev.get("prompt") or ""
            if not p.lstrip().startswith("<"):  # "<agent-message …>" etc. are sub-agent results, not the user
                s["last_prompt"] = trim(p, 200)
                s["turn_started"] = ts  # an unfinished earlier turn (interrupted) is simply dropped
                s["_todos"] = None
                s["_no_hist"] = False
                s["_prev_start"] = None
            elif s["turn_started"] is None:
                # sub-agent result arrived after Stop: the session keeps working; continue the chain
                s["turn_started"] = s.get("_prev_start") if s.get("_prev_start") is not None else ts
                s["_no_hist"] = True
        elif name == "Stop":
            s["last_reply"] = trim(ev.get("last_assistant_message"), 300)
        elif name == "PreToolUse" and ev.get("tool_use_id"):
            s["_open"][ev["tool_use_id"]] = ev.get("tool_name")
        elif name == "PostToolUse":
            s["_open"].pop(ev.get("tool_use_id"), None)
        if name in ("Stop", "SessionEnd") and s["turn_started"] is not None:
            if name == "Stop" and ts is not None and ts >= s["turn_started"] and not s.get("_no_hist"):
                turns_done.append((s["cwd"], ts - s["turn_started"]))
            s["_prev_start"] = s["turn_started"] if name == "Stop" else None
            s["turn_started"] = None

    result = []
    seen = set()
    hist_agents = []  # (agent_type, model, duration) of every finished agent
    for sid in reversed(order):  # newest last-event first
        if sid in seen:
            continue
        seen.add(sid)
        s = sessions[sid]
        s["current_tool"] = list(s["_open"].values())[-1] if s["_open"] else None
        agents = []
        for a in s["_agents"].values():
            key = (a["_ev"].get("transcript_path"), a["agent_id"])
            meta = _META_CACHE.get(key)
            if meta is None:
                meta = read_meta(a["_ev"])
                if meta and a["stopped_t"]:
                    _META_CACHE[key] = meta
            if not a["_started"] and not meta:
                continue  # internal helper agent: hide
            ag = {
                "agent_id": a["agent_id"], "agent_type": a["agent_type"] or meta.get("agentType") or "",
                "description": meta.get("description") or a["agent_type"] or "",
                "parent_agent_id": meta.get("parentAgentId"),
                "model": meta.get("model"), "effort": meta.get("effort"),
                "started_t": a["started_t"], "stopped_t": a["stopped_t"],
                "state": "done" if a["stopped_t"] else "running",
                "last_tool": a["last_tool"], "tool_count": a["tool_count"], "result": a["result"],
                "eta": None, "todos": a["_tl"], "step": todo_step(a["_tl"]),
            }
            agents.append(ag)
            a["_out"] = ag
            if ag["state"] == "done" and a["_start"] is not None and a["_stop"] is not None and a["_stop"] > a["_start"]:
                hist_agents.append((ag["agent_type"], ag["model"], a["_stop"] - a["_start"]))
        if s["status"] == "idle" and any(a["state"] == "running" for a in agents):
            s["status"] = "agents running"  # main turn ended but background sub-agents still work
        s["_out_agents"] = agents
        result.append(s)

    # ETAs
    for s in result:
        left_max = None
        run_agents = []
        for a in s["_agents"].values():
            ag = a.get("_out")
            if ag is None or ag["state"] != "running" or a["_start"] is None:
                continue
            same = [d for t, m, d in hist_agents if t == ag["agent_type"]]
            lbl = "%s runs" % ag["agent_type"] if ag["agent_type"] else "agent runs"
            if not same:
                same = [d for t, m, d in hist_agents]
                lbl = "agent runs"
            elif ag["model"]:
                sm = [d for t, m, d in hist_agents if t == ag["agent_type"] and m == ag["model"]]
                if len(sm) >= 3:
                    same, lbl = sm, "%s runs on %s" % (ag["agent_type"], ag["model"])
            ag["eta"] = estimate(now - a["_start"], same, 120, lbl, a["_todos"], now)
            run_agents.append((a["_start"], ag["eta"]))
            sl = ag["eta"]["seconds_left"]
            if sl is not None and (left_max is None or sl > left_max):
                left_max = sl
        eta = None
        if s["status"] in ("working", "needs you", "agents running") and s["turn_started"] is not None:
            same = [d for c, d in turns_done if c == s["cwd"]]
            lbl = "turns in %s" % (os.path.basename(s["cwd"].rstrip("\\/")) or s["cwd"])
            if not same:
                same = [d for c, d in turns_done]
                lbl = "turns"
            eta = estimate(now - s["turn_started"], same, 90, lbl, s["_todos"], now)
            _raise_floor(eta, left_max, now)
        elif run_agents:
            top = max(run_agents, key=lambda x: -1 if x[1]["seconds_left"] is None else x[1]["seconds_left"])[1]
            eta = dict(top)
            eta["elapsed"] = round(now - min(t for t, _ in run_agents), 1)
            eta["progress"] = None
            eta["basis"] = "waiting on %d background agent%s; %s" % (len(run_agents), "" if len(run_agents) == 1 else "s", top["basis"])
        s["eta"] = eta
        s["todos"] = s["_tl"]
        s["step"] = todo_step(s["_tl"])
    out = []
    for s in result:
        out.append({k: v for k, v in s.items() if not k.startswith("_")} | {"agents": s["_out_agents"]})
    return {"sessions": out}


def port_alive(port):
    """True if something accepts a TCP connection on the port. Sends nothing (the wrapper ignores empty messages)."""
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.2):
            return True
    except OSError:
        return False


STOPPED = {}  # session_id -> event_count when we sent Esc; claude fires no hook on interrupt


def live_state(hooks):
    """build_state plus liveness: adds "online" per session and turns dead wrappers' status into "offline"."""
    try:
        mt = os.stat(hooks).st_mtime
    except OSError:
        mt = None
    st = build_state(read_events(hooks), mtime=mt)
    for s in st["sessions"]:
        if STOPPED.get(s["session_id"]) == s["event_count"] and s["status"] in ("working", "needs you"):
            s["status"] = "stopped"
    alive = {}  # port -> bool, each distinct port checked once
    owner = {}  # port -> session_id of the newest session using it (sessions are newest first)
    for s in st["sessions"]:
        p = s["port"]
        if p is None or s["status"] == "ended":
            continue
        owner.setdefault(p, s["session_id"])
        if p not in alive:
            alive[p] = port_alive(p)
    for s in st["sessions"]:
        p = s["port"]
        s["online"] = bool(p is not None and s["status"] != "ended" and alive.get(p) and owner.get(p) == s["session_id"])
        if s["status"] != "ended" and not s["online"]:  # includes sessions from old wrappers (no port)
            s["status"] = "offline"
        if s["status"] in ("ended", "offline", "stopped"):  # nothing is running any more
            s["eta"] = None
            s["turn_started"] = None
            for a in s["agents"]:
                a["eta"] = None
    return st


EDIT_TOOLS = ("Edit", "MultiEdit", "Write", "NotebookEdit")
EDIT_CAP = 200000  # characters per string
FS_MAX_READ = 1024 * 1024


def _cap(v, flag):
    v = "" if v is None else (v if isinstance(v, str) else str(v))
    if len(v) > EDIT_CAP:
        flag[0] = True
        return v[:EDIT_CAP]
    return v


ACT_OUT_CAP = 4096


def _act_summary(ev):
    tool = ev.get("tool_name") or ""
    ti = ev.get("tool_input")
    ti = ti if isinstance(ti, dict) else {}
    if tool == "Bash":
        cmd = str(ti.get("command") or "").strip()
        return trim(cmd.split("\n")[0], 200) if cmd else tool
    if tool in ("Read", "Edit", "MultiEdit", "Write", "NotebookEdit"):
        return str(ti.get("file_path") or ti.get("notebook_path") or tool)
    if tool in ("Grep", "Glob"):
        return str(ti.get("pattern") or tool)
    if tool == "Agent":
        return str(ti.get("description") or tool)
    return tool


def _text_of(v):
    if v is None:
        return ""
    if isinstance(v, str):
        return v
    if isinstance(v, list):
        return "\n".join(x for x in (_text_of(i) for i in v) if x)
    if isinstance(v, dict):
        for k in ("text", "content", "output", "stdout", "result", "message"):
            if v.get(k):
                return _text_of(v[k])
        try:
            return json.dumps(v, ensure_ascii=False)
        except (TypeError, ValueError):
            return str(v)
    return str(v)


def _act_result(tool, resp):
    """(output text, is_error) from a PostToolUse tool_response (dict or string)."""
    err = False
    if isinstance(resp, dict):
        if resp.get("is_error") or resp.get("isError") or resp.get("interrupted"):
            err = True
        for k in ("exit_code", "exitCode", "returncode"):
            if isinstance(resp.get(k), int) and not isinstance(resp.get(k), bool) and resp[k] != 0:
                err = True
        if tool == "Bash" and ("stdout" in resp or "stderr" in resp):
            parts = [_text_of(resp.get("stdout")), _text_of(resp.get("stderr"))]
            return "\n".join(p for p in parts if p), err
        if tool in ("Edit", "MultiEdit", "Write", "NotebookEdit") and not err:
            # the full response repeats the whole file and patch; a one-liner is what the output panel needs
            path = resp.get("filePath") or resp.get("file_path") or ""
            patch = resp.get("structuredPatch") or []
            added = sum(1 for h in patch if isinstance(h, dict) for l in h.get("lines", []) if str(l).startswith("+"))
            removed = sum(1 for h in patch if isinstance(h, dict) for l in h.get("lines", []) if str(l).startswith("-"))
            verb = "created" if resp.get("type") == "create" else "updated"
            return f"{verb} {path}" + (f" (+{added} -{removed})" if patch else ""), err
        if tool == "Read" and isinstance(resp.get("file"), dict) and not err:
            f = resp["file"]
            return f"read {f.get('numLines', '?')} lines of {f.get('filePath', '')}", err
        if tool == "Agent" and resp.get("status") == "async_launched":
            return f"started background agent: {resp.get('description', '')}", err
    return _text_of(resp), err


def activity(events, stamps, session, agent, limit=40):
    """Recent tool calls of the lead (agent == 'lead': events without agent_id) or one sub-agent, newest last."""
    items = {}
    order = []
    for ev, ts in zip(events, stamps):
        if ev.get("session_id") != session:
            continue
        name = ev.get("hook_event_name")
        if name not in ("PreToolUse", "PostToolUse"):
            continue
        if not ((not ev.get("agent_id")) if agent == "lead" else (ev.get("agent_id") == agent)):
            continue
        tool = ev.get("tool_name") or ""
        uid = ev.get("tool_use_id") or ""
        key = uid or "n%d" % len(order)
        it = items.get(key) if uid else None
        if it is None:
            it = items[key] = {"ts": ts, "tool": tool, "tool_use_id": uid, "state": "running",
                               "summary": _act_summary(ev), "output": None}
            order.append(key)
        if name == "PostToolUse":
            out, err = _act_result(tool, ev.get("tool_response"))
            it["state"] = "error" if err else "done"
            it["output"] = out[-ACT_OUT_CAP:]
    return {"items": [items[k] for k in order[-limit:]]}


def parse_edit(ev, seq):
    """One edit record (without ts) from a PreToolUse/PostToolUse event, or None if it is not an edit-type call."""
    name = ev.get("hook_event_name")
    tool = ev.get("tool_name")
    if name not in ("PreToolUse", "PostToolUse") or tool not in EDIT_TOOLS:
        return None
    ti = ev.get("tool_input")
    if not isinstance(ti, dict):
        ti = {}
    flag = [False]
    rec = {"seq": seq, "ts": None, "session_id": ev.get("session_id"), "agent_id": ev.get("agent_id") or None,
           "agent_type": ev.get("agent_type") or None, "phase": "pre" if name == "PreToolUse" else "post",
           "tool": tool, "tool_use_id": ev.get("tool_use_id") or "",
           "file_path": _cap(ti.get("file_path") or ti.get("notebook_path"), flag), "cwd": ev.get("cwd") or ""}
    if tool == "Edit":
        rec["changes"] = [{"old": _cap(ti.get("old_string"), flag), "new": _cap(ti.get("new_string"), flag),
                           "replace_all": bool(ti.get("replace_all"))}]
    elif tool == "MultiEdit":
        eds = ti.get("edits")
        rec["changes"] = [{"old": _cap(e.get("old_string"), flag), "new": _cap(e.get("new_string"), flag),
                           "replace_all": bool(e.get("replace_all"))} for e in (eds if isinstance(eds, list) else []) if isinstance(e, dict)]
    elif tool == "Write":
        rec["content"] = _cap(ti.get("content"), flag)
    else:  # NotebookEdit
        rec["changes"] = [{"old": "", "new": _cap(ti.get("new_source"), flag), "replace_all": False}]
    if flag[0]:
        rec["truncated"] = True
    return rec


class EditsFeed:
    """Incrementally parsed edit-type tool calls of a growing hooks file. Only new bytes are read on each call."""

    def __init__(self, path):
        self.path = path
        self.lock = threading.Lock()
        self._reset()

    def _reset(self):
        self.offset = 0
        self.lines = 0
        self.pairs = []  # (ts, t) per line, for epoch resolution
        self.edits = []
        self.seqs = []
        self.epochs = None
        self.mtime = None

    def _update(self):
        try:
            st = os.stat(self.path)
        except OSError:
            self._reset()
            return
        if st.st_size < self.offset:
            self._reset()
        if st.st_size == self.offset:
            return
        try:
            with open(self.path, "rb") as f:
                f.seek(self.offset)
                data = f.read(st.st_size - self.offset)
        except OSError:
            return
        end = data.rfind(b"\n")
        if end < 0:
            return  # only a partial line so far
        self.offset += end + 1
        for raw in data[:end].split(b"\n"):
            self.lines += 1
            try:
                d = json.loads(raw)
            except ValueError:
                d = None
            if not isinstance(d, dict):
                self.pairs.append((None, None))
                continue
            self.pairs.append((d.get("_ts"), d.get("_t")))
            rec = parse_edit(d, self.lines)
            if rec:
                self.edits.append(rec)
                self.seqs.append(self.lines)
        self.epochs = None
        self.mtime = st.st_mtime

    def query(self, since=0, session=None, limit=200):
        with self.lock:
            self._update()
            if self.epochs is None:
                self.epochs = resolve_epochs(self.pairs, self.mtime)
            out = []
            i = bisect.bisect_right(self.seqs, since)
            while i < len(self.edits) and len(out) < limit:
                e = self.edits[i]
                i += 1
                if session and e["session_id"] != session:
                    continue
                out.append(dict(e, ts=self.epochs[e["seq"] - 1]))
        return {"next": out[-1]["seq"] if out else since, "edits": out}


def workspaces(events, mtime=None):
    """Distinct session cwds, newest first: [{root, name, session_ids, last_ts}]."""
    stamps = assign_ts(events, mtime)
    ws = {}
    for ev, ts in zip(events, stamps):
        cwd, sid = ev.get("cwd"), ev.get("session_id")
        if not cwd or not isinstance(cwd, str) or not sid:
            continue
        w = ws.setdefault(os.path.normcase(os.path.normpath(cwd)), {"root": cwd, "session_ids": [], "last_ts": 0.0, "n": len(ws)})
        w["root"] = cwd
        if sid not in w["session_ids"]:
            w["session_ids"].append(sid)
        if ts is not None and ts > w["last_ts"]:
            w["last_ts"] = ts
    rows = sorted(ws.values(), key=lambda w: (-w["last_ts"], w["n"]))
    return [{"root": w["root"], "name": os.path.basename(w["root"].rstrip("\\/")) or w["root"],
             "session_ids": w["session_ids"], "last_ts": w["last_ts"]} for w in rows]


class FsError(Exception):
    def __init__(self, code, msg):
        Exception.__init__(self, msg)
        self.code, self.msg = code, msg


def _bad_name(p):
    q = p.rstrip(". ").lower()  # Windows ignores trailing dots/spaces
    return q == ".git" or re.fullmatch(r"git~\d+", q) is not None  # also the 8.3 short name


def _parts(s):
    return [p for p in re.split(r"[\\/]+", s) if p not in ("", ".")]


def _is_link(p):
    return os.path.islink(p) or os.path.isjunction(p)


def _check_parts(parts):
    for p in parts:
        if p == "..":
            raise FsError(403, "'..' not allowed")
        if ":" in p:
            raise FsError(403, "':' not allowed in a path")
        if _bad_name(p):
            raise FsError(403, ".git is off limits")
        if "\0" in p:
            raise FsError(400, "bad path")


def fs_resolve(roots, root, rel):
    """Validate root (must be, or be inside, a workspace root) and rel (inside root). Returns (real_root, real_target).
    roots: workspace root paths. Raises FsError."""
    if not isinstance(root, str) or not root or "\0" in root or not os.path.isabs(root):
        raise FsError(400, "root must be an absolute path")
    if not isinstance(rel, str) or "\0" in rel:
        raise FsError(400, "bad path")
    drive, tail = os.path.splitdrive(root)
    rparts = _parts(tail)
    _check_parts(rparts)
    relparts = _parts(rel)
    if rel and (os.path.isabs(rel) or os.path.splitdrive(rel)[0] or rel[0] in "\\/"):
        raise FsError(403, "path must be relative")
    _check_parts(relparts)
    cur = drive + os.sep
    for p in rparts:
        cur = os.path.join(cur, p)
        if _is_link(cur):
            raise FsError(403, "links are not followed")
    real_root = pathlib.Path(os.path.realpath(cur))
    if not any(real_root.is_relative_to(pathlib.Path(os.path.realpath(w))) for w in roots if isinstance(w, str) and os.path.isabs(w)):
        raise FsError(403, "root is not a workspace")
    if not real_root.is_dir():
        raise FsError(404, "root not found")
    cur = str(real_root)
    for p in relparts:
        cur = os.path.join(cur, p)
        if _is_link(cur):
            raise FsError(403, "links are not followed")
    real_t = pathlib.Path(os.path.realpath(cur))
    if not real_t.is_relative_to(real_root):
        raise FsError(403, "path escapes root")
    return real_root, real_t


def fs_list(roots, root, rel):
    real_root, t = fs_resolve(roots, root, rel)
    if not t.exists():
        raise FsError(404, "not found")
    if not t.is_dir():
        raise FsError(400, "not a directory")
    entries = []
    try:
        with os.scandir(t) as it:
            for e in it:
                if _bad_name(e.name):
                    continue
                try:
                    st = e.stat(follow_symlinks=False)
                    isdir = e.is_dir(follow_symlinks=False)
                except OSError:
                    continue
                entries.append({"name": e.name, "type": "dir" if isdir else "file", "size": 0 if isdir else st.st_size, "mtime": st.st_mtime})
    except OSError as ex:
        raise FsError(403, "cannot list: %s" % ex.strerror)
    entries.sort(key=lambda e: (e["type"] != "dir", e["name"].casefold()))
    return {"root": root, "path": "/".join(_parts(rel)), "entries": entries}


def fs_read(roots, root, rel):
    real_root, t = fs_resolve(roots, root, rel)
    if not _parts(rel):
        raise FsError(400, "not a file")
    try:
        st = t.stat()
    except OSError:
        raise FsError(404, "not found")
    if not t.is_file():
        raise FsError(404 if not t.exists() else 400, "not a file")
    if st.st_size > FS_MAX_READ:
        raise FsError(413, "file larger than 1 MB")
    try:
        with open(t, "rb") as f:
            data = f.read(FS_MAX_READ + 1)
    except OSError as ex:
        raise FsError(403, "cannot read: %s" % ex.strerror)
    if len(data) > FS_MAX_READ:
        raise FsError(413, "file larger than 1 MB")
    if b"\0" in data:
        raise FsError(415, "binary file")
    return {"path": "/".join(_parts(rel)), "size": st.st_size, "mtime": st.st_mtime, "encoding": "utf-8",
            "text": data.decode("utf-8", "replace")}


def caller_is_loopback(peer, xff):
    """Loopback-only gate: the socket peer must be loopback, and so must every address in X-Forwarded-For."""
    if not is_loopback(peer):
        return False
    if xff is None:
        return True
    ips = [x.strip() for x in xff.split(",")]
    return bool(ips) and all(is_loopback(x) for x in ips)


def start_session(folder):
    """Open a new console window running claude (via the wrapper) in folder."""
    p = subprocess.Popen([sys.executable, os.path.join(HERE, "wb_pty_win.py"), "claude"], cwd=folder,
                         creationflags=getattr(subprocess, "CREATE_NEW_CONSOLE", 0))
    return {"ok": True, "pid": p.pid}


def send_to_wrapper(text, port):
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=3) as c:
            if text[:1] not in ("\x01", "\x03"):
                text = "\x04" + text  # plain text must carry the \x04 marker, or the wrapper drops it
            c.sendall(text.encode("utf-8"))
        return {"ok": True}
    except OSError as e:
        return {"ok": False, "error": "wrapper not reachable on port %d (%s)" % (port, e)}


def stream_term(handler, wport):
    """Proxy the wrapper's output stream to the browser as Server-Sent Events (one JSON string per event)."""
    import codecs
    try:
        up = socket.create_connection(("127.0.0.1", wport), timeout=3)
        up.sendall(b"\x02")
    except OSError:
        return handler.reply(502, {"error": "wrapper not reachable"})
    up.settimeout(15)
    dec = codecs.getincrementaldecoder("utf-8")("replace")
    h = handler
    h.send_response(200)
    h.send_header("Content-Type", "text/event-stream; charset=utf-8")
    h.send_header("Cache-Control", "no-store")
    h.send_header("X-Accel-Buffering", "no")
    h.send_header("X-Frame-Options", "DENY")
    h.send_header("Content-Security-Policy", "frame-ancestors 'none'")
    h.end_headers()
    try:
        while True:
            try:
                b = up.recv(65536)
            except socket.timeout:
                h.wfile.write(b": ka\n\n"); h.wfile.flush()  # also detects a closed browser tab
                continue
            if not b:
                break
            t = dec.decode(b)
            if t:
                h.wfile.write(b"data: " + json.dumps(t).encode("ascii") + b"\n\n"); h.wfile.flush()
        h.wfile.write(b"event: end\ndata: 0\n\n"); h.wfile.flush()
    except OSError:
        pass
    finally:
        up.close()
    h.close_connection = True


PAGE = r"""<!doctype html><html><head><meta charset="utf-8"><title>Mission control</title>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css" integrity="sha384-LJcOxlx9IMbNXDqJ2axpfEQKkAYbFjJfhXexLfiRJhjDU81mzgkiQq8rkV0j6dVh" crossorigin="anonymous">
<script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js" integrity="sha384-/nfmYPUzWMS6v2atn8hbljz7NE0EI1iGx34lJaNzyVjWGDzMv+ciUZUeJpKA3Glc" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.js" integrity="sha384-AQLWHRKAgdTxkolJcLOELg4E9rE89CPE2xMy3tIRFn08NcGKPTsELdvKomqji+DL" crossorigin="anonymous"></script><style>
:root{--bg:#f6f7f9;--fg:#1c2128;--mut:#6a737d;--card:#fff;--bd:#d8dee4;--work:#1a7f37;--need:#bc4c00;--idle:#6a737d}
@media(prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--mut:#8b949e;--card:#161b22;--bd:#30363d;--work:#3fb950;--need:#f0883e;--idle:#8b949e}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif}
.bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.bar input{flex:1;min-width:200px;padding:6px 8px;background:var(--card);color:var(--fg);border:1px solid var(--bd);border-radius:6px}
button{padding:6px 14px;border-radius:6px;border:1px solid var(--bd);background:var(--card);color:var(--fg);cursor:pointer}
.note{color:var(--mut);font-size:12px;margin:4px 0 14px}
.card{background:var(--card);border:1px solid var(--bd);border-radius:8px;margin-bottom:12px}
.head{padding:10px 12px;cursor:pointer;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.body{padding:0 12px 10px}.mut{color:var(--mut)}.mono{font-family:ui-monospace,Consolas,monospace;font-size:12px}
.badge{padding:1px 8px;border-radius:10px;color:#fff;font-size:12px}
.working,.agents{background:var(--work)}.needs{background:var(--need)}.idle,.offline,.ended,.stopped{background:var(--idle)}
.ctl{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0}.ctl input{flex:1;min-width:200px;padding:6px 8px;background:var(--card);color:var(--fg);border:1px solid var(--bd);border-radius:6px}
.txt{margin:4px 0;white-space:pre-wrap}.agent{padding:3px 0;border-top:1px solid var(--bd)}
.arow{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.arow.done{cursor:pointer}
.spin{display:inline-block;width:10px;height:10px;border:2px solid var(--work);border-top-color:transparent;border-radius:50%;animation:r 1s linear infinite}
@keyframes r{to{transform:rotate(360deg)}}.res{margin:2px 0 4px 20px;color:var(--mut);white-space:pre-wrap}
.tbox{margin:8px 0}.term{height:360px;background:#000;border-radius:6px;padding:4px;overflow:hidden}
.tkeys{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.tkeys button{padding:6px 10px;min-width:44px}
@media(max-width:600px){
 body{padding:10px}.bar input,.ctl input{min-width:0;width:100%;flex:1 1 100%;font-size:16px;padding:10px}
 button{padding:10px 14px;min-height:40px}.head{gap:6px}.head .mono{word-break:break-all}.term{height:55vh}
 .agent{margin-left:0!important}.arow{gap:4px}
}
</style></head><body>
<div class="bar"><b>New session</b><input id="nf" placeholder="Absolute folder path"><button id="ns">Start</button><span id="nr" class="mut"></span></div>
<div class="note">Each session's wrapper listens on its own port (47840–47859)</div><div id="root"></div>
<script>
const open = {};  // key -> bool, survives refreshes
const root = document.getElementById('root');
function el(tag, cls, text){const e=document.createElement(tag); if(cls)e.className=cls; if(text!=null)e.textContent=text; return e;}
function range(a){return (a.started_t||'?')+'–'+(a.stopped_t||'…');}
function agentRows(agents, parent, depth, out){
  agents.filter(a=>(a.parent_agent_id||null)===parent).forEach(a=>{
    const w=el('div','agent'); w.style.marginLeft=(depth*18)+'px';
    const row=el('div','arow'+(a.state==='done'?' done':''));
    row.appendChild(a.state==='running'?el('span','spin'):el('span',null,'✓'));
    row.appendChild(el('b',null,a.description));
    row.appendChild(el('span','mut',a.agent_type+(a.model?' · '+a.model:'')+(a.effort?' '+a.effort:'')));
    row.appendChild(el('span','mut mono',(a.last_tool||'-')+' ×'+a.tool_count));
    row.appendChild(el('span','mut mono',range(a)));
    w.appendChild(row);
    const k='a:'+a.agent_id;
    if(a.state==='done'&&a.result&&open[k]) w.appendChild(el('div','res',a.result));
    if(a.state==='done') row.onclick=()=>{open[k]=!open[k];render(last);};
    out.appendChild(w); agentRows(agents,a.agent_id,depth+1,out);
  });
}
let last=null, lastTx='';
const ui={};  // session_id -> persistent controls (keeps typed text and result across re-renders)
const dead=s=>s.status==='ended'||s.status==='offline';
function post(path,obj){
  return fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)}).then(x=>x.json());
}
function controls(sid){
  if(ui[sid])return ui[sid];
  const u={port:null,term:null}, box=el('div','ctl');
  const t=el('input'); t.placeholder='Text to type into this claude (Enter sends)';
  const bs=el('button',null,'Send'), bx=el('button',null,'Stop');
  const ba=el('button',null,'Allow'), bd=el('button',null,'Deny'), r=el('span','mut'), nc=el('span','mut','not controllable');
  const run=async(p,ok)=>{
    try{const j=await post('/send',Object.assign({port:u.port},p)); r.textContent=j.ok?'sent':'failed: '+j.error; if(j.ok&&ok)ok();}
    catch(e){r.textContent='failed: '+e;}
  };
  const send=()=>{if(t.value.trim())run({text:t.value},()=>{t.value='';});};
  bs.onclick=send; t.onkeydown=e=>{if(e.key==='Enter')send();};
  bx.onclick=()=>run({keys:'esc'}); ba.onclick=()=>run({keys:'1'}); bd.onclick=()=>run({keys:'esc'});
  const bt=el('button',null,'Terminal'); bt.onclick=()=>toggleTerm(u,bt);
  [t,bs,bx,bt,ba,bd,r,nc].forEach(x=>box.appendChild(x));
  // the terminal lives in its own element that is re-attached (never rebuilt) on every render
  const tbox=el('div','tbox'), tdiv=el('div','term'), tk=el('div','tkeys');
  [['Esc','\x1b'],['Tab','\t'],['↑','\x1b[A'],['↓','\x1b[B'],['←','\x1b[D'],['→','\x1b[C'],['Enter','\r'],['Ctrl-C','\x03']].forEach(([n,k])=>{
    const b=el('button',null,n); b.onclick=()=>{termSend(u,k); if(u.term)u.term.focus();}; tk.appendChild(b);});
  tbox.appendChild(tdiv); tbox.appendChild(tk); tbox.style.display='none';
  Object.assign(u,{box,t,ba,bd,nc,bt,tbox,tdiv,live:[t,bs,bx]});
  return ui[sid]=u;
}
function termSend(u,data){  // keystrokes are chained so they reach claude in order
  u.q=(u.q||Promise.resolve()).then(()=>post('/send',{port:u.port,raw:data})).catch(()=>{});
}
function closeTerm(u){
  if(u.es){u.es.close();u.es=null;}
  if(u.ro){u.ro.disconnect();u.ro=null;}
  if(u.term){u.term.dispose();u.term=null;u.fit=null;}
  u.tdiv.replaceChildren(); u.tbox.style.display='none'; u.bt.textContent='Terminal'; u.termOn=false;
}
function toggleTerm(u,bt){
  if(u.termOn){closeTerm(u);return;}
  if(typeof Terminal==='undefined'||typeof FitAddon==='undefined'){alert('xterm.js did not load (no internet to cdn.jsdelivr.net?)');return;}
  u.termOn=true; bt.textContent='Hide terminal'; u.tbox.style.display='';
  const term=new Terminal({fontSize:13,cursorBlink:true,convertEol:false,scrollback:2000,fontFamily:'ui-monospace,Consolas,monospace'});
  const fit=new FitAddon.FitAddon(); term.loadAddon(fit); term.open(u.tdiv);
  u.term=term; u.fit=fit;
  const doFit=()=>{try{fit.fit();}catch(e){}};
  term.onData(d=>termSend(u,d));
  let rt=null;
  term.onResize(({cols,rows})=>{clearTimeout(rt);rt=setTimeout(()=>post('/send',{port:u.port,resize:[Math.max(10,cols),Math.max(10,rows)]}).catch(()=>{}),150);});
  u.ro=new ResizeObserver(doFit); u.ro.observe(u.tdiv);
  const connect=()=>{
  const es=new EventSource('/term?port='+u.port); u.es=es;
  es.onopen=()=>{term.reset();};  // every (re)connect replays the whole snapshot onto a clean screen
  es.onmessage=e=>term.write(JSON.parse(e.data));
  es.addEventListener('end',async()=>{
    es.close(); if(u.es===es)u.es=null;
    let on=false;
    try{const st=await (await fetch('/state')).json(); on=st.sessions.some(x=>x.online&&x.port===u.port);}catch(e){}
    if(on&&u.termOn&&u.term===term){setTimeout(()=>{if(u.termOn&&u.term===term&&!u.es)connect();},500);}  // viewer was dropped as too slow
    else term.write('\r\n[session ended]\r\n');
  });
  };
  connect();
  doFit(); term.focus();
}
function setControls(u,s){
  u.port=s.port;
  u.live.forEach(x=>{x.style.display=s.online?'':'none';});
  const need=s.online&&s.status==='needs you';
  u.ba.style.display=u.bd.style.display=need?'':'none';
  u.nc.style.display=s.online?'none':'';
  u.bt.style.display=s.online||u.termOn?'':'none';
  if(!s.online&&u.termOn&&!u.es)closeTerm(u);
}
function render(st){
  last=st;
  const ae=document.activeElement, keep=ae&&root.contains(ae)?ae:null;
  const ss=keep&&keep.selectionStart!=null?[keep.selectionStart,keep.selectionEnd]:null;
  const sessions=st.sessions.filter(s=>!dead(s)).concat(st.sessions.filter(dead));  // stable: live first, newest first
  if(!nf.dataset.dirty&&st.sessions.length&&document.activeElement!==nf)nf.value=st.sessions[0].cwd||'';
  root.replaceChildren();
  sessions.forEach((s,i)=>{
    const k='s:'+s.session_id; if(!(k in open)) open[k]=(i===0&&!dead(s));
    const c=el('div','card'), h=el('div','head');
    h.appendChild(el('b','mono',s.session_id.slice(0,8)));
    h.appendChild(el('span','badge '+s.status.split(' ')[0],s.status));
    h.appendChild(el('span','mut mono',s.cwd));
    h.appendChild(el('span','mut',(s.current_tool?'tool: '+s.current_tool+' · ':'')+'last '+(s.last_event_t||'?')+' · '+s.event_count+' events'));
    h.onclick=()=>{open[k]=!open[k];render(last);};
    c.appendChild(h);
    if(open[k]){
      const b=el('div','body');
      const u=controls(s.session_id); setControls(u,s); b.appendChild(u.box); b.appendChild(u.tbox);
      b.appendChild(el('div','txt','Prompt: '+(s.last_prompt||'-')));
      b.appendChild(el('div','txt','Reply: '+(s.last_reply||'-')));
      agentRows(s.agents,null,0,b);
      // agents whose parent is unknown still show up
      const ids=new Set(s.agents.map(a=>a.agent_id));
      const orphans=s.agents.filter(a=>a.parent_agent_id&&!ids.has(a.parent_agent_id));
      orphans.forEach(a=>agentRows([Object.assign({},a,{parent_agent_id:null})],null,0,b));
      c.appendChild(b);
    }
    root.appendChild(c);
  });
  if(keep&&document.body.contains(keep)){keep.focus(); if(ss)try{keep.setSelectionRange(ss[0],ss[1]);}catch(e){}}
}
async function poll(){
  try{const r=await fetch('/state'); const tx=await r.text(); if(tx!==lastTx){lastTx=tx; render(JSON.parse(tx));}}catch(e){}
  setTimeout(poll,1000);
}
const nf=document.getElementById('nf'), nr=document.getElementById('nr');
nf.oninput=()=>{nf.dataset.dirty='1';};
async function start(){
  try{const j=await post('/start',{folder:nf.value.trim()}); nr.textContent=j.ok?'started (pid '+j.pid+')':'failed: '+j.error;}
  catch(e){nr.textContent='failed: '+e;}
}
document.getElementById('ns').onclick=start;
nf.onkeydown=e=>{if(e.key==='Enter')start();};
poll();
</script></body></html>
"""


def is_loopback(addr):
    return addr in ("127.0.0.1", "::1", "::ffff:127.0.0.1")


def make_handler(port, hooks, extra_hosts=(), token=None):
    """extra_hosts: hostnames/IPs (no port) besides loopback that may appear in Host; they require the token."""
    local_hosts = {"127.0.0.1:%d" % port, "localhost:%d" % port}
    remote_hosts = {"%s:%d" % (h, port) for h in extra_hosts}
    allowed_hosts = local_hosts | remote_hosts
    allowed_origins = {"http://" + h for h in allowed_hosts}

    feed = EditsFeed(hooks)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def reply(self, code, body, ctype="application/json", extra=()):
            data = body if isinstance(body, bytes) else json.dumps(body).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", ctype + "; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Content-Security-Policy", "frame-ancestors 'none'")
            for k, v in extra:
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(data)

        def host_ok(self):
            return self.headers.get("Host") in allowed_hosts

        def cookie_token(self):
            for part in (self.headers.get("Cookie") or "").split(";"):
                k, _, v = part.strip().partition("=")
                if k == "wb_token":
                    return v
            return ""

        def authed(self):
            """Loopback with a loopback Host needs nothing; anything else needs the token cookie."""
            if is_loopback(self.client_address[0]) and self.headers.get("Host") in local_hosts:
                return True
            return bool(token) and hmac.compare_digest(self.cookie_token().encode(), token.encode())

        def do_GET(self):
            if not self.host_ok():
                return self.reply(403, {"error": "bad host"})
            path, _, query = self.path.partition("?")
            qs = urllib.parse.parse_qs(query)
            if not self.authed():
                tk = (qs.get("token") or [""])[0]
                if token and path == "/" and hmac.compare_digest(tk.encode(), token.encode()):
                    # first load from a phone: remember the token in a cookie and drop it from the URL
                    self.send_response(302)
                    self.send_header("Location", "/")
                    self.send_header("Set-Cookie", "wb_token=%s; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000" % token)
                    self.send_header("Content-Length", "0")
                    self.send_header("Cache-Control", "no-store")
                    self.send_header("X-Frame-Options", "DENY")
                    self.send_header("Content-Security-Policy", "frame-ancestors 'none'")
                    self.end_headers()
                    return
                return self.reply(401, {"error": "token required"})
            if path == "/":
                self.reply(200, PAGE.encode("utf-8"), "text/html")
            elif path == "/state":
                self.reply(200, live_state(hooks))
            elif path in ("/workspaces", "/edits", "/activity", "/fs/list", "/fs/read"):
                self.api_get(path, qs)
            elif path == "/term":
                try:
                    wport = int((qs.get("port") or [""])[0])
                except ValueError:
                    wport = 0
                if not PORT_MIN <= wport <= PORT_MAX:
                    return self.reply(400, {"error": "bad port"})
                if not [x for x in live_state(hooks)["sessions"] if x["online"] and x["port"] == wport]:
                    return self.reply(400, {"error": "no online session on that port"})
                stream_term(self, wport)
            else:
                self.reply(404, {"error": "not found"})

        def api_get(self, path, qs):
            """Read-only app API: /workspaces, /edits, /fs/list, /fs/read. Errors are JSON, never a stack trace."""
            def q(name, default=""):
                return (qs.get(name) or [default])[0]
            try:
                try:
                    mt = os.stat(hooks).st_mtime
                except OSError:
                    mt = None
                if path == "/workspaces":
                    return self.reply(200, {"workspaces": workspaces(read_events(hooks), mt)})
                if not caller_is_loopback(self.client_address[0], self.headers.get("X-Forwarded-For")):
                    return self.reply(403, {"error": "loopback only"})
                if path == "/edits":
                    try:
                        since = max(0, int(q("since", "0")))
                        limit = min(1000, max(1, int(q("limit", "200"))))
                    except ValueError:
                        return self.reply(400, {"error": "since and limit must be integers"})
                    return self.reply(200, feed.query(since, q("session") or None, limit))
                if path == "/activity":
                    try:
                        limit = min(200, max(1, int(q("limit", "40"))))
                    except ValueError:
                        return self.reply(400, {"error": "limit must be an integer"})
                    evs = read_events(hooks)
                    return self.reply(200, activity(evs, assign_ts(evs, mt), q("session"), q("agent", "lead") or "lead", limit))
                roots = [w["root"] for w in workspaces(read_events(hooks), mt)]
                fn = fs_list if path == "/fs/list" else fs_read
                return self.reply(200, fn(roots, q("root"), q("path")))
            except FsError as e:
                return self.reply(e.code, {"error": e.msg})
            except Exception:
                return self.reply(500, {"error": "internal error"})

        def do_POST(self):
            path = self.path.split("?")[0]
            if path not in ("/send", "/start"):
                return self.reply(404, {"ok": False, "error": "not found"})
            origin = self.headers.get("Origin")
            ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
            if not self.host_ok() or (origin is not None and origin not in allowed_origins):
                return self.reply(403, {"ok": False, "error": "forbidden host/origin"})
            if not self.authed():
                return self.reply(401, {"ok": False, "error": "token required"})
            if ctype != "application/json":
                return self.reply(415, {"ok": False, "error": "Content-Type must be application/json"})
            try:
                n = int(self.headers.get("Content-Length") or 0)
                if n < 0 or n > 100000:
                    return self.reply(413, {"ok": False, "error": "too large"})
                body = json.loads(self.rfile.read(n).decode("utf-8"))
                if not isinstance(body, dict):
                    raise ValueError
            except ValueError:
                return self.reply(400, {"ok": False, "error": "bad JSON"})
            if path == "/start":
                folder = body.get("folder")
                if not isinstance(folder, str) or not os.path.isabs(folder) or not os.path.isdir(folder):
                    return self.reply(400, {"ok": False, "error": "folder must be an absolute path to an existing directory"})
                try:
                    return self.reply(200, start_session(os.path.abspath(folder)))
                except OSError as e:
                    return self.reply(500, {"ok": False, "error": "could not start: %s" % e})
            wport = body.get("port")
            if type(wport) is not int or not PORT_MIN <= wport <= PORT_MAX:
                return self.reply(400, {"ok": False, "error": "bad port"})
            if "keys" in body:
                payload = KEYS.get(body["keys"]) if isinstance(body["keys"], str) else None
                if payload is None:
                    return self.reply(400, {"ok": False, "error": "unknown keys"})
            elif "raw" in body:
                raw = body["raw"]
                if not isinstance(raw, str) or not raw or len(raw) > 4096:
                    return self.reply(400, {"ok": False, "error": "raw must be 1-4096 chars"})
                payload = "\x01" + raw
            elif "resize" in body:
                rz = body["resize"]
                if (not isinstance(rz, list) or len(rz) != 2 or any(type(v) is not int or not 10 <= v <= 500 for v in rz)):
                    return self.reply(400, {"ok": False, "error": "resize must be [cols, rows], 10-500"})
                payload = "\x03%dx%d" % (rz[0], rz[1])
            else:
                payload = body.get("text")
                if not isinstance(payload, str) or not payload.strip():
                    return self.reply(400, {"ok": False, "error": "empty text"})
                if len(payload) > 10000:
                    return self.reply(400, {"ok": False, "error": "text over 10000 chars"})
                if payload[0] in "\x01\x02\x03\x04":
                    return self.reply(400, {"ok": False, "error": "bad text"})
            target = [x for x in live_state(hooks)["sessions"] if x["online"] and x["port"] == wport]
            if not target:
                return self.reply(400, {"ok": False, "error": "no online session on that port"})
            res = send_to_wrapper(payload, wport)
            if res["ok"] and body.get("keys") == "esc":
                STOPPED[target[0]["session_id"]] = target[0]["event_count"]
            self.reply(200, res)

    return Handler


def find_tailscale():
    exe = shutil.which("tailscale")
    if not exe:
        for d in (os.environ.get("ProgramFiles", r"C:\Program Files"), os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")):
            c = os.path.join(d, "Tailscale", "tailscale.exe")
            if os.path.exists(c):
                return c
    return exe


def tailscale_info():
    """(ipv4, [MagicDNS name]) from the local tailscale CLI, or raises RuntimeError with a plain message."""
    exe = find_tailscale()
    if not exe:
        raise RuntimeError("Tailscale is not installed (no tailscale.exe found). Install it and sign in, or use --bind <ip>.")
    try:
        ip = subprocess.run([exe, "ip", "-4"], capture_output=True, text=True, timeout=10).stdout.split()
        if not ip:
            raise RuntimeError("`tailscale ip -4` printed nothing - is Tailscale signed in and running?")
        names = []
        try:
            st = json.loads(subprocess.run([exe, "status", "--json"], capture_output=True, text=True, timeout=10).stdout)
            dns = (st.get("Self") or {}).get("DNSName") or ""
            if dns:
                names.append(dns.rstrip(".").lower())
        except (ValueError, OSError, subprocess.SubprocessError):
            pass
        return ip[0], names
    except (OSError, subprocess.SubprocessError) as e:
        raise RuntimeError("could not run tailscale: %s" % e)


def load_token(path):
    """Read the secret next to the script, or create it (random 32 bytes, urlsafe) the first time."""
    try:
        with open(path, encoding="ascii") as f:
            t = f.read().strip()
        if len(t) >= 40:
            return t
    except OSError:
        pass
    t = secrets.token_urlsafe(32)
    with open(path, "w", encoding="ascii") as f:
        f.write(t + "\n")
    return t


def main():
    ap = argparse.ArgumentParser(description="Mission control for Claude Code sessions")
    ap.add_argument("--port", type=int, default=47832)
    ap.add_argument("--hooks", default=os.path.join(HERE, "hooks.jsonl"))
    ap.add_argument("--listen", choices=["tailscale"], help="also listen on this machine's Tailscale IPv4 address (token required)")
    ap.add_argument("--bind", metavar="IP", help="also listen on this IPv4 address (token required)")
    a = ap.parse_args()
    ThreadingHTTPServer.allow_reuse_address = False  # on Windows reuse lets a 2nd copy silently share the port
    ThreadingHTTPServer.daemon_threads = True
    extra_ips, names, token = [], [], None
    if a.listen == "tailscale":
        try:
            ip, names = tailscale_info()
        except RuntimeError as e:
            sys.exit("Mission control: " + str(e))
        extra_ips.append(ip)
    if a.bind:
        extra_ips.append(a.bind)
    if extra_ips:
        token = load_token(os.path.join(HERE, "wb_mc.token"))
    handler = make_handler(a.port, a.hooks, extra_ips + names, token)
    servers = [ThreadingHTTPServer(("127.0.0.1", a.port), handler)]
    for ip in extra_ips:
        servers.append(ThreadingHTTPServer((ip, a.port), handler))
    print("Mission control: http://127.0.0.1:%d/" % a.port, flush=True)
    for h in (names[:1] or extra_ips):
        print("Phone URL:       http://%s:%d/?token=%s" % (h, a.port, token), flush=True)
    for sv in servers[1:]:
        threading.Thread(target=sv.serve_forever, daemon=True).start()
    try:
        servers[0].serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    sys.exit(main())
