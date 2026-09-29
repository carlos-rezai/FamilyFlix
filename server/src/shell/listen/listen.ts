import type { Server } from 'node:http';
import type { Express } from 'express';

/**
 * The address the server binds, standalone and under the **Desktop shell**
 * alike: the loopback, so the library is never reachable from another machine
 * on the family's network.
 */
export const LOOPBACK = '127.0.0.1';

/**
 * Listen on `LOOPBACK:port`, resolving with the server once it is bound and
 * rejecting with the listen error (`EADDRINUSE` for a taken port) otherwise.
 */
export function listen(app: Express, port: number): Promise<Server> {
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
