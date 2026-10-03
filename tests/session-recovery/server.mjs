// Isolated local origin: never connects to Firebase or production data.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
const server = await createServer({ configFile: false, plugins: [react()],
  server: { host: '127.0.0.1', port: 4791, strictPort: true, watch: { ignored: ['**/dist/**'] } },
});
await server.listen(); console.log('Recovery E2E: http://127.0.0.1:4791/tests/session-recovery/');
