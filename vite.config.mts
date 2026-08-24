/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: './node_modules/.vite/familyflix',
  server: {
    port: 4200,
    host: 'localhost',
    // The frontend calls the API on relative paths (`/api/home`), because the
    // packaged Electron app serves both from one origin. In dev they are two
    // processes, so proxy `/api` to the Express server to keep those paths —
    // and the frontend's fetch code — identical in both environments.
    proxy: {
      '/api': `http://localhost:${process.env.PORT ?? 3001}`,
    },
  },
  preview: {
    port: 4300,
    host: 'localhost',
  },
  plugins: [react(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  // Uncomment this if you are using workers.
  // worker: {
  //   plugins: () => [ nxViteTsPaths() ],
  // },
  build: {
    outDir: './dist/familyflix',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: 'familyflix',
    watch: false,
    globals: true,
    environment: 'jsdom',
    // Vitest's 5000ms default is tuned for unit tests. This suite renders real
    // component trees through jsdom and styled-components, and does it under 43
    // parallel workers, where the heaviest integration tests — a whole genre of
    // poster cards, uncapped — measure in seconds rather than milliseconds and
    // get slower the busier the machine is. State the margin rather than
    // inheriting a default that has nothing to do with this kind of test.
    testTimeout: 20000,
    include: [
      '{src,server,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './coverage/familyflix',
      provider: 'v8' as const,
    },
  },
}));
