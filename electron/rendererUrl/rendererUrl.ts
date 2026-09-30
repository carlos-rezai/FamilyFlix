import type { ShellMode } from '../shellMode/shellMode';

/** Where Vite serves the renderer under `electron:dev`, with HMR. */
const VITE_DEV_URL = 'http://localhost:4200/';

/**
 * Where the one window points: Vite's dev server in `'dev'`, so HMR works in
 * the window, and otherwise the server's own origin on the loopback address
 * it bound — **One origin**, so every relative call site stays as it is.
 */
export function rendererUrl(mode: ShellMode, port: number): string {
  return mode === 'dev' ? VITE_DEV_URL : `http://127.0.0.1:${port}/`;
}
