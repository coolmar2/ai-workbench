"""Type text into a running wb_pty_win.py wrapper:  python wb_send.py [--port 47840] say hi"""
import socket, sys
args = sys.argv[1:]
port = 47840
if args[:1] == ["--port"]:
    port, args = int(args[1]), args[2:]
s = socket.create_connection(("127.0.0.1", port)); s.sendall(b"\x04" + " ".join(args).encode("utf-8")); s.close()
