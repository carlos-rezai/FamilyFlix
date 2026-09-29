// @vitest-environment node
//
// Issue #217 — the ordered shutdown. `orderedShutdown(world)` is the one
// function both the **Shell handshake**'s `shutdown` command and the
// standalone server's `SIGINT`/`SIGTERM` run. In order:
//
//   1. cancel the **Current run** — the importer's `cancel()` rolls back the
//      Movie folder in flight, so its promise is awaited;
//   2. cancel the **Current enrichment run**;
//   3. `closeAllConnections()`, **before** `close()`, so a playing film's
//      streaming response cannot hold the exit past the shell's 5 s;
//   4. close the database (the WAL checkpoint);
//   5. exit `0`.
//
// `shutdownOnSignals(target, shutdown)` is the standalone half: it hands both
// signals to the same function.
//
// The listener is real — a streaming response is only a streaming response
// on a real socket — and everything else is recorded.

import { EventEmitter } from 'node:events';
import { createServer, get, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  orderedShutdown,
  shutdownOnSignals,
  type ShutdownWorld,
} from './orderedShutdown';

const open: Server[] = [];

afterEach(() => {
  for (const server of open.splice(0)) {
    server.closeAllConnections();
    server.close();
  }
});

/** A real loopback listener; `stream` makes every response one that never ends. */
function listening(stream = false): Promise<Server> {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'video/mp4' });
    res.write('the first bytes of a film');
    if (!stream) res.end();
  });
  open.push(server);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/** Open a request and wait until its headers are in: a film is playing. */
function playing(server: Server): Promise<void> {
  const { port } = server.address() as AddressInfo;
  return new Promise((resolve, reject) => {
    const req = get({ host: '127.0.0.1', port, path: '/video' }, (res) => {
      res.on('error', () => undefined);
      res.resume();
      resolve();
    });
    req.on('error', (error) => {
      // The socket dropped by the shutdown is the point, not a failure.
      if ((error as NodeJS.ErrnoException).code !== 'ECONNRESET') {
        reject(error);
      }
    });
  });
}

/** A world over a real server whose every step writes to `log`. */
function worldOver(server: Server, log: string[]): ShutdownWorld {
  const closeAll = server.closeAllConnections.bind(server);
  const close = server.close.bind(server);
  vi.spyOn(server, 'closeAllConnections').mockImplementation(() => {
    log.push('closeAllConnections');
    closeAll();
  });
  vi.spyOn(server, 'close').mockImplementation((callback) => {
    log.push('close');
    return close(callback);
  });

  return {
    importer: {
      cancel: vi.fn(async () => {
        log.push('cancel import');
      }),
    },
    enrichment: {
      cancel: vi.fn(() => {
        log.push('cancel enrichment');
      }),
    },
    server,
    closeDatabase: vi.fn(() => {
      log.push('close database');
    }),
    exit: vi.fn((code: number) => {
      log.push(`exit ${code}`);
    }),
  };
}

describe('orderedShutdown', () => {
  it('cancels the import and the sync, drops connections before closing, closes the database, and exits 0 — in that order', async () => {
    const log: string[] = [];
    const server = await listening();

    await orderedShutdown(worldOver(server, log));

    expect(log).toEqual([
      'cancel import',
      'cancel enrichment',
      'closeAllConnections',
      'close',
      'close database',
      'exit 0',
    ]);
  });

  it('waits for the import’s rollback before closing the database', async () => {
    const log: string[] = [];
    const server = await listening();
    const world = worldOver(server, log);
    let rolledBack!: () => void;
    world.importer.cancel = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          rolledBack = () => {
            log.push('import rolled back');
            resolve();
          };
        })
    );

    const done = orderedShutdown(world);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(world.closeDatabase).not.toHaveBeenCalled();
    expect(world.exit).not.toHaveBeenCalled();

    rolledBack();
    await done;

    expect(log.indexOf('import rolled back')).toBeLessThan(
      log.indexOf('close database')
    );
    expect(world.exit).toHaveBeenCalledWith(0);
  });

  it('closes the listener so nothing new is accepted', async () => {
    const server = await listening();

    await orderedShutdown(worldOver(server, []));

    expect(server.listening).toBe(false);
  });

  it('is not delayed by an open streaming response', async () => {
    const log: string[] = [];
    const server = await listening(true);
    await playing(server);
    const world = worldOver(server, log);

    const started = Date.now();
    await orderedShutdown(world);

    expect(Date.now() - started).toBeLessThan(1_000);
    expect(world.closeDatabase).toHaveBeenCalledTimes(1);
    expect(world.exit).toHaveBeenCalledWith(0);
  });
});

describe('shutdownOnSignals', () => {
  it.each(['SIGINT', 'SIGTERM'] as const)(
    'runs the same shutdown on %s',
    (signal) => {
      const target = new EventEmitter();
      const shutdown = vi.fn(async () => undefined);

      shutdownOnSignals(target, shutdown);
      target.emit(signal);

      expect(shutdown).toHaveBeenCalledTimes(1);
    }
  );

  it('runs nothing until a signal arrives', () => {
    const target = new EventEmitter();
    const shutdown = vi.fn(async () => undefined);

    shutdownOnSignals(target, shutdown);

    expect(shutdown).not.toHaveBeenCalled();
  });
});
