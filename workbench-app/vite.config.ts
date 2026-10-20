import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// wb_mc.py (Mission control spike) only accepts Host 127.0.0.1:47832 / localhost:47832,
// so the proxy rewrites Host via changeOrigin. The server listens on the LAN (0.0.0.0), and the rewritten
// Host would let any device there drive claude through wb_mc, so ONLY GET /state is proxied; everything
// else (/send, /start, /term) is refused here.
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
      '^/api/mc/(state|edits|activity|workspaces|fs/list|fs/read)(\\?.*)?$': {
        xfwd: true,
        // WB_MC_TARGET lets you point at another port (e.g. a dead one to test the sample fallback).
        target: process.env.WB_MC_TARGET || 'http://127.0.0.1:47832',
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
    },
  },
})
