"""Spike step 1+4 (Windows): run interactive claude inside a pseudo-terminal.
Setup once:   pip install pywinpty
Run:          python wb_pty_win.py claude      (from the project folder claude should work in)
- shows the program's screen and passes your keys through
- logs everything it prints to logs/out-<port>.log next to this script
- listens on the first free port in 47840-47859; other programs can type into it:
    python wb_send.py --port 47840 "say hi"
  Messages: \x04<text> = type text + Enter (plain text without \x04 is dropped); \x01<keys> = raw keys, no Enter
  (e.g. \x01\x1b = Esc); \x02 = output stream; \x03<cols>x<rows> = resize.
- tells claude's hooks its port (env WB_PORT) and, for claude, loads wb_settings.json
  (the hook config) with --settings, so Mission control sees sessions in any folder.
Runs the normal claude binary. Touches no tokens, logins or global settings."""
import sys, os, socket, threading, shutil, msvcrt, time, queue
from winpty import PtyProcess

HERE = os.path.dirname(os.path.abspath(__file__))
PORTS = range(47840, 47860)

srv = socket.socket()
for port in PORTS:  # one port per wrapper, so several sessions can run side by side
    try:
        srv.bind(("127.0.0.1", port)); break
    except OSError:
        continue
else:
    sys.exit("[wb] no free port in 47840-47859 - too many wrappers running?")
srv.listen(4)

cmd = sys.argv[1:] or ["claude"]
# on Windows, which() looks in the current folder first: a planted claude.bat/.exe there must never run
os.environ["NoDefaultCurrentDirectoryInExePath"] = "1"
exe = shutil.which(cmd[0])
if not exe or not os.path.isabs(exe):
    sys.exit("[wb] cannot find %r on PATH (resolved to %r) - refusing to start" % (cmd[0], exe))
_cwd = os.path.normcase(os.path.realpath(os.getcwd()))
_dir = os.path.normcase(os.path.realpath(os.path.dirname(exe)))
if _dir == _cwd:  # (a subfolder is allowed: claude may live under the home folder the user starts in)
    sys.exit("[wb] %r is in the current folder (%s) - refusing to run a program planted in the project" % (exe, os.getcwd()))
args = cmd[1:]
settings = os.path.join(HERE, "wb_settings.json")
if os.path.splitext(os.path.basename(exe))[0].lower() == "claude" and os.path.exists(settings):
    args = ["--settings", settings] + args
# a wrapper started from inside a Claude session inherits its markers (e.g. CLAUDE_CODE_CHILD_SESSION), which make
# the new claude switch transcripts off, and its tokens (the parent session's, not the user's login); drop them all,
# keeping only provider switches (CLAUDE_CODE_USE_*) and CLAUDE_CONFIG_DIR (which login to use: Personal/Work).
# The new claude signs in from its own stored login.
def inherited_marker(k):
    k = k.upper()
    return k.startswith("CLAUDE") and not (k.startswith("CLAUDE_CODE_USE_") or k == "CLAUDE_CONFIG_DIR")
env = {k: v for k, v in os.environ.items() if not inherited_marker(k)}
env["WB_PORT"] = str(port)
cols, rows = shutil.get_terminal_size()
proc = PtyProcess.spawn([exe] + args, env=env, dimensions=(rows, cols))
os.makedirs(os.path.join(HERE, "logs"), exist_ok=True)
log = open(os.path.join(HERE, "logs", "out-%d.log" % port), "ab", buffering=0)
out = sys.stdout
sys.stderr.write("[wb] port %d\r\n" % port)

KEYS = {"H": "\x1b[A", "P": "\x1b[B", "M": "\x1b[C", "K": "\x1b[D",
        "G": "\x1b[H", "O": "\x1b[F", "S": "\x1b[3~", "I": "\x1b[5~", "Q": "\x1b[6~"}

BUF_MAX = 256 * 1024
buf = bytearray()
viewers = set()  # queue.Queue per streaming viewer; each has a writer thread
vlock = threading.Lock()
wlock = threading.Lock()  # every write to the pty goes through this, so keystrokes never interleave

def pty_write(t):
    with wlock:
        proc.write(t)

def broadcast(b):
    with vlock:
        buf.extend(b)
        if len(buf) > BUF_MAX:
            del buf[:len(buf) - BUF_MAX]
            while buf and (buf[0] & 0xC0) == 0x80:  # don't start in the middle of a UTF-8 character
                del buf[0]
        for q in list(viewers):
            try:
                q.put_nowait(b)
            except queue.Full:  # viewer too slow: drop it, claude's output must never wait
                viewers.discard(q)
                try:
                    q.get_nowait()
                except queue.Empty:
                    pass
                q.put_nowait(None)

def pump_output():
    while proc.isalive():
        try:
            s = proc.read(65536)
        except EOFError:
            break
        b = s.encode("utf-8", "replace")
        log.write(b)
        broadcast(b)
        out.write(s); out.flush()

def stream_to(c):
    q = queue.Queue(maxsize=512)
    with vlock:
        snapshot = bytes(buf)
        viewers.add(q)
    c.settimeout(10)
    try:
        if snapshot:
            c.sendall(snapshot)
        while True:
            b = q.get()
            if b is None:
                break
            c.sendall(b)
    except OSError:
        pass
    finally:
        with vlock:
            viewers.discard(q)
        try:
            c.close()
        except OSError:
            pass

def pump_keys():
    while proc.isalive():
        ch = msvcrt.getwch()
        if ch in ("\x00", "\xe0"):
            pty_write(KEYS.get(msvcrt.getwch(), ""))
        else:
            pty_write(ch)

# Non-stream messages: one short-lived reader thread per connection (a slow sender can't block accepting), each with a
# sequence number taken in accept order; ONE writer thread applies the messages strictly in that order.
inbox = {}  # seq -> message bytes, or None (stream / unreadable / dropped)
icond = threading.Condition()

def finish(seq, data):
    with icond:
        inbox[seq] = data
        icond.notify_all()

def read_conn(c, seq):
    c.settimeout(5)  # a stuck sender only delays later messages by this long
    data = None
    try:
        first = c.recv(65536)
        if first.startswith(b"\x02"):
            finish(seq, None)
            c.settimeout(None)
            return stream_to(c)
        data = first
        while chunk := c.recv(65536):  # read until the sender closes, so long messages arrive whole
            data += chunk
    except OSError:
        data = None
    try:
        c.close()
    except OSError:
        pass
    finish(seq, data)

def apply(data):
    msg = data.decode("utf-8", "replace")
    if msg.startswith("\x01"):  # raw keys, no Enter
        pty_write(msg[1:])
    elif msg.startswith("\x03"):  # resize: "\x03<cols>x<rows>"
        try:
            cl, rw = msg[1:].strip().split("x")
            with wlock:
                proc.setwinsize(int(rw), int(cl))
        except (ValueError, OSError):
            pass
    elif msg.startswith("\x04"):  # typed text + Enter; anything else (e.g. a browser's HTTP request) is dropped
        msg = msg[1:].rstrip("\r\n")
        if msg:
            pty_write(msg)
            time.sleep(0.6)  # claude treats a fast burst as a paste and swallows an Enter sent with it
            pty_write("\r")

def writer():
    nxt = 0
    while True:
        with icond:
            while nxt not in inbox:
                icond.wait()
            data = inbox.pop(nxt)
        nxt += 1
        if data:  # empty = liveness check from Mission control
            try:
                apply(data)
            except Exception:
                pass

def listen():
    seq = 0
    while True:
        c, _ = srv.accept()
        threading.Thread(target=read_conn, args=(c, seq), daemon=True).start()
        seq += 1

for f in (pump_keys, writer, listen):
    threading.Thread(target=f, daemon=True).start()
pump_output()
