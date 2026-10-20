"""Run once after moving the project to another folder or PC:  python setup_paths.py

The hook settings must name wb_hook.py / wb_rc.py by absolute path (claude runs hook commands from the
session's folder). This rewrites every absolute path in those settings files to the folder this script
now lives in, and the launcher configs to wherever the referenced repos now sit next to it.
"""
import json, re
from pathlib import Path

HERE = Path(__file__).resolve().parent          # .../workbench-spike
PARENT = HERE.parent                            # folder that holds workbench-spike, wb-test-repo, ...
FILES = [HERE / "wb_settings.json", HERE / ".claude" / "settings.local.json",
         *HERE.glob("rc/*/.claude/settings.local.json")]
# any absolute "<drive>:/.../workbench-spike/" inside a hook command
SPIKE_RE = re.compile(r"[A-Za-z]:[/\\][^\"']*?workbench-spike(?=[/\\])")


def fix_settings(p):
    text = p.read_text(encoding="utf-8")
    new = SPIKE_RE.sub(HERE.as_posix(), text)
    if new != text:
        p.write_text(new, encoding="utf-8")
        print(f"updated {p.relative_to(PARENT)}")


def fix_launcher(p):
    cfg = json.loads(p.read_text(encoding="utf-8"))
    old = Path(cfg["repo"])
    moved = PARENT / old.name
    if not old.exists() and moved.exists():
        cfg["repo"] = str(moved)
        p.write_text(json.dumps(cfg, indent=2) + "\n", encoding="utf-8")
        print(f"updated {p.relative_to(PARENT)} -> {moved}")
    elif not old.exists():
        print(f"warning: {p.relative_to(PARENT)} points at {old}, which doesn't exist here; run wb_rc.py add again")


for f in FILES:
    if f.exists():
        fix_settings(f)
for f in HERE.glob("rc/*/wb-rc.json"):
    fix_launcher(f)
print(f"paths now point at {HERE}")
