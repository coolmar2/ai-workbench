import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const MC_TARGET = process.env.WB_MC_TARGET || 'http://127.0.0.1:47832'

// The app's own origins. POSTs from any other page (another site open in the same browser) are refused.
const APP_ORIGINS = new Set(['http://localhost:5190', 'http://127.0.0.1:5190'])
const isLoopback = (a?: string) => a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1'

// wb_mc.py (Mission control spike) only accepts Host 127.0.0.1:47832 / localhost:47832,
// so the proxy rewrites Host via changeOrigin. The server listens on the LAN (0.0.0.0), and the rewritten
// Host makes every proxied call look local to wb_mc, so:
//  - read endpoints are GET-only;
//  - POST /send and /start (they type into / start claude) are proxied only for a caller on this machine
//    whose Origin is this app, with a JSON body. Anything else is refused here, before wb_mc sees it.
//  - /term is not proxied.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Vendor code in a few stable chunks so no chunk crosses the 500 kB warning.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
            { name: 'radix', test: /node_modules[\\/](@radix-ui|radix-ui|cmdk|@floating-ui)[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5190,
    strictPort: true,
    proxy: {
      // GET-only read endpoints (see design/API_CONTRACT.md). xfwd lets wb_mc refuse /fs and /edits to LAN callers.
      '^/api/mc/(state|edits|activity|workspaces|fs/list|fs/read|accounts)(\\?.*)?$': {
        xfwd: true,
        // WB_MC_TARGET lets you point at another port (e.g. a dead one to test the sample fallback).
        target: MC_TARGET,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/mc/, ''),
        bypass: (req, res) => {
          if (req.method !== 'GET' && res) {
            res.statusCode = 405
            res.end('read-only')
            return false
          }
        },
      },
      // Actions: type a prompt into a running session, or start a new one. Local, same-origin JSON POSTs only.
      '^/api/mc/(send|start)$': {
        target: MC_TARGET,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/mc/, ''),
        configure: (proxy) => {
          // wb_mc only accepts its own Origin; this one was checked in bypass, so drop it before forwarding.
          proxy.on('proxyReq', (pr) => pr.removeHeader('origin'))
        },
        bypass: (req, res) => {
          if (!res) return
          const refuse = (code: number, error: string) => {
            res.statusCode = code
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error }))
            return false as const
          }
          if (req.method !== 'POST') return refuse(405, 'POST only')
          if (!isLoopback(req.socket.remoteAddress)) return refuse(403, 'only from this computer')
          if (!APP_ORIGINS.has(req.headers.origin ?? '')) return refuse(403, 'bad origin')
          if ((req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase() !== 'application/json')
            return refuse(415, 'Content-Type must be application/json')
        },
      },
    },
  },
})
