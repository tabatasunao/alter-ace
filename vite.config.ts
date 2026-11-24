import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const dataDir = fileURLToPath(new URL('./public/data', import.meta.url));

/**
 * Dev-only: when a tuning file in public/data changes, tell the page so it can
 * reload the data without a rebuild.
 */
function dataHotReload(): Plugin {
  return {
    name: 'alter:data-hot-reload',
    apply: 'serve',
    configureServer(server) {
      server.watcher.add(dataDir);
      server.watcher.on('change', (file) => {
        const rel = path.relative(dataDir, file);
        if (rel.startsWith('..') || path.isAbsolute(rel) || !rel.endsWith('.json')) return;
        server.ws.send({ type: 'custom', event: 'alter:data-changed', data: { file: rel } });
      });
    },
  };
}

export default defineConfig({
  // Relative base so the build works from any sub-path of a web server (such as GitHub Pages).
  base: './',
  plugins: [dataHotReload()],
  server: { port: 5173 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
