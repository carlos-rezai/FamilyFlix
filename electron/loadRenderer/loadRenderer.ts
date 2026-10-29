/** How long to wait before asking Vite again while it is still starting. */
export const RENDERER_RETRY_MS = 500;

/** The part of Electron's `BrowserWindow` loading the renderer uses. */
export interface RendererTarget {
  loadURL(url: string): Promise<unknown>;
  /** Forget every page before this one: the **Start-up splash** above all. */
  clearHistory(): void;
  isDestroyed(): boolean;
}

/**
 * Load the renderer into the window, asking again every 500 ms while the load
 * rejects — under `electron:dev` the window can be up before Vite is (Q15) —
 * and stopping once it resolves or the window is destroyed. A destroyed
 * window is never asked, since Electron throws on it.
 *
 * The app loads over the **Start-up splash** in the same window, so a load
 * that resolves clears the history: going back from the app's first page
 * would otherwise land on a splash that never leaves (#501).
 */
export function loadRenderer(target: RendererTarget, url: string): void {
  if (target.isDestroyed()) return;
  target.loadURL(url).then(
    () => {
      if (!target.isDestroyed()) target.clearHistory();
    },
    () => {
      setTimeout(() => loadRenderer(target, url), RENDERER_RETRY_MS);
    }
  );
}
