"""Spike step 2: append every hook event Claude Code sends to hooks.jsonl (next to this file)."""
import sys, json, time, os
raw = sys.stdin.buffer.read().decode("utf-8", "replace")  # Claude sends UTF-8; the console default (cp1252) garbles non-ASCII
try: ev = json.loads(raw)
except Exception: ev = {"unparsed": raw[:2000]}
ev["_t"] = time.strftime("%H:%M:%S")
ev["_ts"] = round(time.time(), 3)  # epoch seconds: durations and ETAs need a real date, _t alone has none
ev["_argv"] = sys.argv[1:]
ev["_wb_port"] = os.environ.get("WB_PORT")  # set by wb_pty_win.py: which wrapper this session runs in
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "hooks.jsonl"), "a", encoding="utf-8") as f:
    f.write(json.dumps(ev) + "\n")
