/** The part of Electron's `UtilityProcess` waiting out an exit uses. */
export interface ExitingChild {
  once(event: 'exit', listener: (code: number) => void): unknown;
  kill(): boolean;
}

/**
 * Wait for `child` to exit, resolving when it does; at `ms` kill it and
 * resolve anyway, so quitting never hangs on a server that will not stop.
 */
export function awaitExitOrKill(
  child: ExitingChild,
  ms: number
): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      child.kill();
      resolve();
    }, ms);

    child.once('exit', () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    });
  });
}
