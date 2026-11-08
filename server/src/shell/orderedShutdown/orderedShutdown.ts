import type { Server } from 'node:http';

/** Everything the **Ordered shutdown** stops, in the order it stops them. */
export interface ShutdownWorld {
  /** The **Current run**; its `cancel()` rolls back the folder in flight. */
  importer: { cancel(): Promise<void> };
  /** The **Current enrichment run**. */
  enrichment: { cancel(): void };
  /** The **Library sheet writer**; its `flush()` writes every pending sheet. */
  librarySheet: { flush(): Promise<void> };
  server: Pick<Server, 'closeAllConnections' | 'close'>;
  /** Close the database, checkpointing the WAL. */
  closeDatabase: () => void;
  exit: (code: number) => void;
}

/**
 * The **Ordered shutdown**: cancel the import (awaiting its rollback) and the
 * sync, drop every connection before closing the listener — so an open
 * streaming response cannot hold the exit — flush the Library sheet while the
 * library is still open, close the database, exit `0`.
 * The one function both main's `shutdown` command and the standalone server's
 * signals run.
 */
export async function orderedShutdown(world: ShutdownWorld): Promise<void> {
  await world.importer.cancel();
  world.enrichment.cancel();
  world.server.closeAllConnections();
  await new Promise<void>((resolve) => {
    world.server.close(() => resolve());
  });
  await world.librarySheet.flush();
  world.closeDatabase();
  world.exit(0);
}

/** The part of `process` a signal handler registers on. */
export interface SignalTarget {
  on(event: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
}

/** The standalone server's half: both signals run the same shutdown. */
export function shutdownOnSignals(
  target: SignalTarget,
  shutdown: () => Promise<void>
): void {
  const run = () => {
    void shutdown();
  };
  target.on('SIGINT', run);
  target.on('SIGTERM', run);
}
