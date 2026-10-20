"""wb_copy.py - private working copies of a repo for agents. Stdlib only, never runs git.

  python wb_copy.py new   <repo> <task>   copy working tree to ~/.workbench/copies/<repo>/<task> (+ <task>.base, <task>.repo)
  python wb_copy.py diff  <repo> <task>   unified diff base -> copy
  python wb_copy.py apply <repo> <task>   write the copy's changes into <repo> as plain file edits
  python wb_copy.py drop  <repo> <task>   delete copy and base
Options: apply --dry-run. The copy has no .git; the real repo is only read (new) or edited (apply).

Safety rules: never touches .git (or aliases such as .GIT, .git., GIT~1, streams), never follows
symlinks/junctions, never writes outside the repo, never copies AI-tool traces (.claude/, .codex/, ...).
"""
import difflib, fnmatch, hashlib, os, re, shutil, sys
from pathlib import Path

ALWAYS_SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", ".mypy_cache",
                    ".pytest_cache", ".tox", "dist", "build", ".next", "target", ".gradle"}
# Never copied to the working copy and never applied to the repo (any depth).
DENY_DIRS = {".claude", ".codex", ".gemini", "__pycache__", "node_modules", ".venv"}
DENY_FILE_SUFFIXES = (".pyc",)
# Never applied if NEW in the copy (edits to an existing one are fine).
NEW_ONLY_DENY = {"claude.md", "claude.local.md", "agents.md"}
TASK_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")
SHORT_GIT_RE = re.compile(r"(?i)^git~\d+$")


def root():
    return Path(os.environ.get("WB_HOME") or Path.home() / ".workbench") / "copies"


def die(msg, code=1):
    print(msg, file=sys.stderr)
    sys.exit(code)


def check_task(task):
    if not TASK_RE.match(task or ""):
        die(f"invalid task name {task!r}: use letters, digits, '_' and '-' (max 64, must start with a letter or digit)")


def check_repo(repo):
    p = Path(repo)
    if not p.is_dir():
        die(f"not a directory: {repo}")
    p = p.resolve()
    if not (p / ".git").exists():
        die(f"not a git checkout (no .git directory or file): {p}")
    if not p.name:
        die(f"refusing to use a drive root as repo: {p}")
    return p


def paths(repo, task):
    base_dir = root() / repo.name
    return repo, base_dir / task, base_dir / (task + ".base"), base_dir / (task + ".repo")


def inside(child, parent):
    try:
        return Path(child).resolve().is_relative_to(Path(parent).resolve())
    except (OSError, ValueError):
        return False


def check_owner(repo, rf):
    """The copy must belong to this exact repo path (two repos can share a folder name)."""
    try:
        recorded = rf.read_text(encoding="utf-8").strip()
    except OSError:
        die(f"no {rf.name} record next to the copy: cannot tell which repo it belongs to; refusing")
    if os.path.normcase(recorded) != os.path.normcase(str(repo)):
        die(f"copy belongs to a different repo ({recorded}), not {repo}; refusing")


def is_link(p):
    """Symlink or (Windows) junction; never followed."""
    p = str(p)
    if os.path.islink(p):
        return True
    ij = getattr(os.path, "isjunction", None)
    if ij is not None:
        return ij(p)
    try:  # Python < 3.12: junction = reparse point that is a directory
        st = os.lstat(p)
        return bool(getattr(st, "st_file_attributes", 0) & 0x400) and os.path.isdir(p)
    except OSError:
        return False


def bad_part(name):
    """.git aliases: .GIT, '.git.', '.git ', GIT~1, and alternate data streams (':')."""
    return (name.lower().rstrip(". ") == ".git" or bool(SHORT_GIT_RE.match(name)) or ":" in name)


def gitignore_rules(repo):
    rules = []
    gi = repo / ".gitignore"
    if gi.is_file() and not is_link(gi):
        for line in gi.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if line and not line.startswith(("#", "!")):
                rules.append(line)
    return rules


def ignored(rel, is_dir, rules):
    """Simplified .gitignore: name globs, anchored paths, trailing-slash dir rules."""
    parts = rel.split("/")
    for r in rules:
        dir_only = r.endswith("/")
        pat = r.rstrip("/")
        anchored = pat.startswith("/") or "/" in pat
        pat = pat.lstrip("/")
        if anchored:
            cands = ["/".join(parts[:i + 1]) for i in range(len(parts))]
        else:
            cands = parts
        for i, c in enumerate(cands):
            last = i == len(cands) - 1
            if dir_only and last and not is_dir:
                continue
            if fnmatch.fnmatch(c, pat):
                return True
    return False


def walk(top, rules=(), skipped=None, links=None):
    """Yield relative posix paths of regular files under top.

    Same filter everywhere: .git aliases, links/junctions, the AI-trace denylist and the repo's
    .gitignore rules are skipped. Listed in `skipped` / `links` (lists of str) when given."""
    skipped = skipped if skipped is not None else []
    links = links if links is not None else []
    for dp, dns, fns in os.walk(top, followlinks=False):
        reld = Path(dp).relative_to(top).as_posix()
        reld = "" if reld == "." else reld
        keep = []
        for d in dns:
            rel = f"{reld}/{d}".lstrip("/")
            full = os.path.join(dp, d)
            if bad_part(d):
                skipped.append(rel + "/  (git alias)")
            elif is_link(full):
                links.append(rel + "/")
            elif d.lower() in DENY_DIRS:
                skipped.append(rel + "/  (AI/tool/cache directory)")
            elif d in ALWAYS_SKIP_DIRS or ignored(rel, True, rules):
                pass
            else:
                keep.append(d)
        dns[:] = keep
        for f in fns:
            rel = f"{reld}/{f}".lstrip("/")
            full = os.path.join(dp, f)
            if bad_part(f):
                skipped.append(rel + "  (git alias)")
            elif is_link(full):
                links.append(rel)
            elif f.lower().endswith(DENY_FILE_SUFFIXES):
                skipped.append(rel + "  (denylist)")
            elif ignored(rel, False, rules):
                pass
            else:
                yield rel


def digest(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()


def sdigest(p):
    """Like digest, but an unreadable (locked) file yields a value that never matches -> reported as conflict."""
    try:
        return digest(p)
    except OSError:
        return "unreadable:" + str(p)


def report_skipped(skipped, links):
    for s in sorted(set(skipped)):
        print("skipped: " + s)
    for l in sorted(set(links)):
        print("skipped link/junction (never followed): " + l)


def cmd_new(repo, task):
    repo, copy, base, rf = paths(repo, task)
    if copy.exists() or base.exists() or rf.exists():
        die(f"already exists: {copy} (drop it first)")
    if inside(root(), repo) or inside(repo, root()):
        die(f"copies folder {root()} and the repo {repo} must not contain each other")
    rf.parent.mkdir(parents=True, exist_ok=True)
    rf.write_text(str(repo), encoding="utf-8")
    skipped, links, n = [], [], 0
    for rel in walk(repo, gitignore_rules(repo), skipped, links):
        for dest in (copy, base):
            t = dest / rel
            t.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(repo / rel, t, follow_symlinks=False)
        n += 1
    copy.mkdir(parents=True, exist_ok=True)
    base.mkdir(parents=True, exist_ok=True)
    print(f"copied {n} files\ncopy: {copy}\nbase: {base}")
    report_skipped(skipped, links)


def changes(repo, task):
    """Return (added, modified, deleted, skipped, links), copy vs base, same filter on both sides."""
    repo, copy, base, rf = paths(repo, task)
    if not copy.is_dir() or not base.is_dir():
        die(f"no such copy: {copy}")
    rules = gitignore_rules(repo)
    skipped, links = [], []
    c = set(walk(copy, rules, skipped, links))
    b = set(walk(base, rules))
    added, kept_added = sorted(c - b), []
    for rel in added:
        if rel.rsplit("/", 1)[-1].lower() in NEW_ONLY_DENY:
            skipped.append(rel + "  (new AI-instruction file; not applied)")
        else:
            kept_added.append(rel)
    deleted = sorted(b - c)
    modified = sorted(p for p in c & b if digest(copy / p) != digest(base / p))
    return kept_added, modified, deleted, skipped, links


def read_lines(p):
    try:
        return Path(p).read_text(encoding="utf-8").splitlines(keepends=True)
    except UnicodeDecodeError:
        return None


def cmd_diff(repo, task):
    repo, copy, base, rf = paths(repo, task)
    check_owner(repo, rf)
    added, modified, deleted, skipped, links = changes(repo, task)
    for rel in sorted(added + modified + deleted):
        a = read_lines(base / rel) if rel not in added else []
        b = read_lines(copy / rel) if rel not in deleted else []
        if a is None or b is None:
            print(f"Binary file {rel} differs")
            continue
        sys.stdout.writelines(difflib.unified_diff(
            a, b, "a/" + rel if rel not in added else "/dev/null",
            "b/" + rel if rel not in deleted else "/dev/null"))
        if a and a[-1:] and not a[-1].endswith("\n") or b and not b[-1].endswith("\n"):
            print("\n\\ No newline at end of file")
    report_skipped(skipped, links)


def target_problem(repo, copy, rel, need_source):
    """Return a reason string if rel must not be written/deleted in the repo, else None."""
    parts = rel.split("/")
    for p in parts:
        if bad_part(p):
            return "git alias / stream in path"
        if p.lower() in DENY_DIRS:
            return "denylisted directory"
    if need_source:
        cur = copy
        for p in parts:
            cur = cur / p
            if os.path.lexists(cur) and is_link(cur):
                return "link/junction in the copy"
    cur = repo
    for p in parts:
        cur = cur / p
        if not os.path.lexists(cur):
            break
        if is_link(cur):
            return "link/junction in the repo"
    if not (repo / rel).resolve().is_relative_to(repo.resolve()):
        return "resolves outside the repo"
    return None


def cmd_apply(repo, task, dry=False):
    repo, copy, base, rf = paths(repo, task)
    check_owner(repo, rf)
    added, modified, deleted, skipped, links = changes(repo, task)
    report_skipped(skipped, links)
    if links:
        die("REFUSED: the copy contains links/junctions (listed above); remove them from the copy. Nothing applied.", 2)
    dl = {d.lower() for d in deleted}
    clash = [a for a in added if a.lower() in dl]
    if clash:
        print("REFUSED: case-only rename(s) detected; this tool does not apply them (writing then deleting "
              "would lose the file on a case-insensitive filesystem). Nothing applied. Rename in the repo by hand:")
        for a in clash:
            print("  " + a)
        sys.exit(2)
    bad = []
    for rel in added + modified + deleted:
        why = target_problem(repo, copy, rel, rel not in deleted)
        if why:
            bad.append(f"{rel} ({why})")
    if bad:
        print("REFUSED: unsafe path(s); nothing applied:")
        for b in bad:
            print("  " + b)
        sys.exit(2)
    # A file already equal to the copy counts as applied, so re-running after a partial failure is safe.
    conflicts = []
    for rel in modified:
        r = repo / rel
        if not r.is_file():
            conflicts.append(rel + " (missing in repo)")
        elif sdigest(r) not in (sdigest(base / rel), sdigest(copy / rel)):
            conflicts.append(rel)
    for rel in deleted:
        r = repo / rel
        if r.exists() and (not r.is_file() or sdigest(r) != sdigest(base / rel)):
            conflicts.append(rel)
    for rel in added:
        r = repo / rel
        if r.exists() and (not r.is_file() or sdigest(r) != sdigest(copy / rel)):
            conflicts.append(rel + " (already exists in repo with other content)")
    if conflicts:
        print("CONFLICT: repo changed since snapshot; nothing applied. Files:")
        for c in conflicts:
            print("  " + c)
        sys.exit(2)
    ops = [("A", r) for r in added] + [("M", r) for r in modified] + [("D", r) for r in deleted]
    for k, rel in ops:
        print(f"{k} {rel}")
    if dry:
        return
    done = []
    try:
        for k, rel in ops:
            t = repo / rel
            if k == "D":
                if t.exists():
                    t.unlink()
                if (base / rel).exists():
                    (base / rel).unlink()
            else:
                t.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(copy / rel, t, follow_symlinks=False)
                (base / rel).parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(copy / rel, base / rel, follow_symlinks=False)
            done.append((k, rel))
    except OSError as e:
        print(f"FAILED after {len(done)} of {len(ops)} change(s): {e}")
        print("written:")
        for k, rel in done:
            print(f"  {k} {rel}")
        print("not written:")
        for k, rel in ops[len(done):]:
            print(f"  {k} {rel}")
        print("The file that failed may be partly written. Re-running apply is safe: finished files are "
              "recognised and skipped, the rest are retried.")
        sys.exit(1)
    # base is kept in step with the repo, so a later apply only sends new edits
    print(f"applied {len(done)} change(s) to {repo} (uncommitted; commit as yourself)")


def rmtree_safe(p):
    """Delete a tree without ever following links; links themselves are removed, not their targets."""
    p = Path(p)
    if is_link(p):
        try:
            os.unlink(p)
        except OSError:
            os.rmdir(p)
        return
    if p.is_dir():
        for e in os.scandir(p):
            rmtree_safe(e.path)
        os.chmod(p, 0o700)
        os.rmdir(p)
    else:
        try:
            p.unlink()
        except PermissionError:
            os.chmod(p, 0o700)
            p.unlink()


def cmd_drop(repo, task):
    repo, copy, base, rf = paths(repo, task)
    if not (copy.exists() or base.exists() or rf.exists()):
        die(f"no such copy: {copy}")
    check_owner(repo, rf)
    r = root().resolve()
    for d in (copy, base, rf):
        if not inside(d.parent, r) or d.parent.resolve() == r:
            die(f"refusing to delete outside {r}: {d}")
    for d in (copy, base):
        if os.path.lexists(d):
            rmtree_safe(d)
    rf.unlink()
    print(f"dropped {copy}")


def main(argv):
    if len(argv) < 4 or argv[1] not in ("new", "diff", "apply", "drop"):
        sys.exit(__doc__)
    cmd, repo, task = argv[1:4]
    check_task(task)
    repo = check_repo(repo)
    if cmd == "apply":
        cmd_apply(repo, task, "--dry-run" in argv[4:])
    else:
        {"new": cmd_new, "diff": cmd_diff, "drop": cmd_drop}[cmd](repo, task)


if __name__ == "__main__":
    main(sys.argv)
