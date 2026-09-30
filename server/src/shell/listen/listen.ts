import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';

/**
 * The address the server binds, standalone and under the **Desktop shell**
 * alike: the loopback, so the library is never reachable from another machine
 * on the family's network.
 */
export const LOOPBACK = '127.0.0.1';

export interface ListenOptions {
  /**
   * Under the **Desktop shell**, a taken **Shell port** falls back to an
   * ephemeral one, which the **Shell handshake**'s `ready` then reports.
   * Standalone, a taken port throws.
   */
  underShell?: boolean;
}

function bind(app: Express, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, LOOPBACK);
    const failed = (error: Error) => reject(error);

    server.once('error', failed);
    server.once('listening', () => {
      server.off('error', failed);
      resolve(server);
    });
  });
}

function isAddressInUse(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as NodeJS.ErrnoException).code === 'EADDRINUSE'
  );
}

/**
 * The port a listening server actually bound — under the shell, maybe the
 * ephemeral fallback rather than the one it was asked for. The one reading of
 * it: the **Loopback guard** is bound to it and `ready` reports it.
 */
export function boundPort(server: Server): number {
  return (server.address() as AddressInfo).port;
}

/**
 * Listen on `LOOPBACK:port`, resolving with the server once it is bound and
 * rejecting with the listen error (`EADDRINUSE` for a taken port) otherwise —
 * except under the shell, where a taken port is retried on port `0`.
 */
export async function listen(
  app: Express,
  port: number,
  { underShell = false }: ListenOptions = {}
): Promise<Server> {
  try {
    return await bind(app, port);
  } catch (error) {
    if (!underShell || !isAddressInUse(error)) throw error;
    return bind(app, 0);
  }
}
