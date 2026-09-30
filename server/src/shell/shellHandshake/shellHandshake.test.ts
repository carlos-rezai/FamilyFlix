// @vitest-environment node
//
// Issue #216 — the window over the server. `shellHandshake` is the server's
// half of the **Shell handshake**: it runs the startup it is handed (open the
// library, listen) and tells the **Desktop shell** how it went — `ready` with
// the port the listener actually bound, or `fatal` with the message when
// opening the library or listening throws.
//
// Without `process.parentPort` there is no shell to tell, so it is inert:
// `npm run dev:server` starts, or crashes, exactly as it did before.
//
// Issue #226 — the startup answers a `Started`, the server and its shutdown
// together, and the handshake answers the same one.

import { createServer, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ServerMessage, ShellCommand } from '../../../../src/types/shell';
import {
  shellHandshake,
  type ShellParentPort,
  type Started,
} from './shellHandshake';

const open: Server[] = [];

/** A real listener on an ephemeral loopback port, closed after the test. */
function listening(): Promise<Server> {
  const server = createServer();
  open.push(server);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/** A startup's answer over `server`, with a shutdown that does nothing. */
function started(
  server: Server,
  shutdown: () => Promise<void> = async () => undefined
): Started {
  return { server, shutdown };
}

function fakeParentPort() {
  const posted: ServerMessage[] = [];
  const port: ShellParentPort = {
    postMessage: (message: ServerMessage) => {
      posted.push(message);
    },
    on: vi.fn(),
  };
  return { port, posted };
}

afterEach(async () => {
  await Promise.all(
    open
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve()))
      )
  );
});

describe('shellHandshake — without a parent port', () => {
  it('runs the startup and hands back its server', async () => {
    const answer = started(await listening());

    await expect(shellHandshake(undefined, () => answer)).resolves.toBe(answer);
  });

  it('lets a startup failure through as it always did', async () => {
    await expect(
      shellHandshake(undefined, () => {
        throw new Error('SQLITE_CANTOPEN: unable to open');
      })
    ).rejects.toThrow('SQLITE_CANTOPEN: unable to open');
  });
});

describe('shellHandshake — under a parent port', () => {
  it('posts ready with the port the listener bound', async () => {
    const { port, posted } = fakeParentPort();
    const server = await listening();
    const bound = (server.address() as AddressInfo).port;

    await shellHandshake(port, () => started(server));

    expect(posted).toEqual([{ type: 'ready', port: bound }]);
  });

  it('waits for an asynchronous startup before posting ready', async () => {
    const { port, posted } = fakeParentPort();

    const { server } = await shellHandshake(port, async () =>
      started(await listening())
    );

    expect(posted).toEqual([
      { type: 'ready', port: (server.address() as AddressInfo).port },
    ]);
  });

  it('posts fatal with the message when opening the library throws', async () => {
    const { port, posted } = fakeParentPort();

    await shellHandshake(port, () => {
      throw new Error('SQLITE_CANTOPEN: unable to open');
    }).catch(() => undefined);

    expect(posted).toEqual([
      { type: 'fatal', message: 'SQLITE_CANTOPEN: unable to open' },
    ]);
  });

  it('posts fatal with the message when listening throws', async () => {
    const { port, posted } = fakeParentPort();

    await shellHandshake(port, () =>
      Promise.reject(new Error('listen EADDRINUSE: 127.0.0.1:3001'))
    ).catch(() => undefined);

    expect(posted).toEqual([
      { type: 'fatal', message: 'listen EADDRINUSE: 127.0.0.1:3001' },
    ]);
  });

  it('never posts ready after a fatal', async () => {
    const { port, posted } = fakeParentPort();

    await shellHandshake(port, () => {
      throw new Error('boom');
    }).catch(() => undefined);

    expect(posted.some((message) => message.type === 'ready')).toBe(false);
  });
});

// Issue #217 — the ordered shutdown. Under a parent port, main's `shutdown`
// command runs the **Ordered shutdown** the handshake is handed — the same
// function the standalone server's signal handlers run.

/** A parent port that keeps main's side: the listener it registered. */
function commandingParentPort() {
  let heard: ((event: { data: ShellCommand }) => void) | undefined;
  const port: ShellParentPort = {
    postMessage: vi.fn(),
    on: (_event, listener) => {
      heard = listener;
    },
  };
  const send = (command: ShellCommand) => {
    if (!heard) throw new Error('the handshake is not listening for commands');
    heard({ data: command });
  };
  return { port, send };
}

describe('shellHandshake — the shutdown command', () => {
  it('runs the ordered shutdown when main sends shutdown, and not before', async () => {
    const { port, send } = commandingParentPort();
    const shutdown = vi.fn(async () => undefined);
    const server = await listening();

    await shellHandshake(port, () => started(server, shutdown));
    expect(shutdown).not.toHaveBeenCalled();

    send({ type: 'shutdown' });

    expect(shutdown).toHaveBeenCalledTimes(1);
  });
});
