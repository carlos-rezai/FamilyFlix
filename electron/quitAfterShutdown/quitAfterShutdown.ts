/** The part of Electron's `before-quit` event the gate uses. */
export interface QuitEvent {
  preventDefault(): void;
}

export interface QuitGateWorld {
  /** The server's **Ordered shutdown**, killing it at `ms`: `serverHandle`'s. */
  shutdown(ms: number): Promise<void>;
  /** How long the shutdown has before the server is killed. */
  ms: number;
  /** `app.quit`. */
  quit(): void;
}

/**
 * The quit gate: the `before-quit` listener that holds the app open until the
 * **Server process** has stopped. The first `before-quit` is prevented and
 * the shutdown run; every one while it runs is prevented too, and runs
 * nothing more; once the shutdown resolves — the server exited, or was killed
 * at the budget — `quit` is called, and the `before-quit` that one raises is
 * let through.
 */
export function quitAfterShutdown({
  shutdown,
  ms,
  quit,
}: QuitGateWorld): (event: QuitEvent) => void {
  let stopping = false;
  let stopped = false;

  return (event) => {
    if (stopped) return;
    event.preventDefault();
    if (stopping) return;
    stopping = true;
    void shutdown(ms).then(() => {
      stopped = true;
      quit();
    });
  };
}
