export interface ReloadWorld {
  /** `webContents.reload`. */
  reload(): void;
  /** Whether the window is gone: closed, or destroyed. */
  isGone(): boolean;
}

/**
 * The `render-process-gone` listener: a crashed renderer is reloaded once,
 * and a second crash is left as it is (Q26). A window that is already gone is
 * left alone, and does not use up the one reload.
 */
export function reloadOnce({ reload, isGone }: ReloadWorld): () => void {
  let reloaded = false;

  return () => {
    if (reloaded || isGone()) return;
    reloaded = true;
    reload();
  };
}
