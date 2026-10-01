// Local test-only transport. Never included in the production entry point/build.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
const records = new Map();
const clients = new Map();
const server = await createServer({
  configFile: false, plugins: [react(), tailwindcss(), {
    name: 'audio-e2e', enforce: 'pre',
    resolveId(source, importer) {
      if (importer?.replaceAll('\\', '/').endsWith('/src/hooks/useAudioLibrarySync.ts') && source.endsWith('/AudioLibraryService')) return path.resolve('tests/audio-sync/transport.ts');
    },
    configureServer(vite) {
      vite.middlewares.use('/audio-e2e/events', (req, res) => {
        const key = new URL(req.url, 'http://localhost').searchParams.get('key');
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
        const peers = clients.get(key) || new Set(); clients.set(key, peers); peers.add(res);
        res.write(`data: ${JSON.stringify(records.get(key) || null)}\n\n`);
        req.on('close', () => peers.delete(res));
      });
      vite.middlewares.use('/audio-e2e/save', async (req, res) => {
        let raw = ''; for await (const chunk of req) raw += chunk;
        const { key, base, local } = JSON.parse(raw);
        const { mergeSounds } = await vite.ssrLoadModule('/src/utils/audioLibrary.ts');
        const sounds = records.has(key) ? mergeSounds(base, local, records.get(key)) : local;
        records.set(key, sounds);
        for (const peer of clients.get(key) || []) peer.write(`data: ${JSON.stringify(sounds)}\n\n`);
        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(sounds));
      });
    },
  }], server: { host: '127.0.0.1', port: 3012 },
  define: { 'import.meta.env.VITE_CUEBOOK_TENANT': JSON.stringify('xtv') },
});
await server.listen(); console.log('Audio E2E: http://127.0.0.1:3012/tests/audio-sync/');
