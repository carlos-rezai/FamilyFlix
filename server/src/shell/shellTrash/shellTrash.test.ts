// @vitest-environment node
//
// 47 — Manage library, Phase 6: "the Shell trash" (issue #412).
//
// The **Shell handshake** grows one exchange, the **Shell trash**: the server
// posts `{ type: 'trash', id, paths }` to main, and main answers
// `{ type: 'trashed', id, failed }` — `failed` the path the Recycle Bin would
// not take, else `null`. `createShellTrash(parentPort)` is the server's half,
// a `Trash` answering `trashed`, `failed` with its path, or `unavailable`. It
// matches answers to requests by id, so two requests in flight are each
// answered by their own; and with no parent port it is inert and answers
// `unavailable`, `shellHandshake`'s precedent — a standalone server still
// refuses a linked delete with the no-shell sentence.
//
// The parent port is faked: what the server posts is recorded, and a command
// from main is delivered to every listener as Electron delivers it, `{ data }`.

import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ServerMessage, ShellCommand } from '../../../../src/types/shell';
import type { TrashOutcome } from '../../media/createMedia/createMedia';
import {
  shellHandshake,
  type ShellParentPort,
} from '../shellHandshake/shellHandshake';
import { createShellTrash } from './shellTrash';

type TrashRequest = Extract<ServerMessage, { type: 'trash' }>;

function fakeParentPort() {
  const posted: ServerMessage[] = [];
  const listeners: ((event: { data: ShellCommand }) => void)[] = [];
  const port: ShellParentPort = {
    postMessage: (message: ServerMessage) => {
      posted.push(message);
    },
    on: (_event, listener) => {
      listeners.push(listener);
      return port;
    },
  };
  return {
    port,
    posted,
    /** Main's command, delivered to every listener. */
    send(command: ShellCommand) {
      for (const listener of listeners) {
        listener({ data: command });
      }
    },
    /** Every trash request posted so far. */
    requests(): TrashRequest[] {
      return posted.filter(
        (message): message is TrashRequest => message.type === 'trash'
      );
    },
  };
}

/** Whether a promise has settled by the end of this turn of the queue. */
async function settled(promise: Promise<unknown>): Promise<boolean> {
  let done = false;
  promise.then(
    () => {
      done = true;
    },
    () => {
      done = true;
    }
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  return done;
}

const PATHS = ['D:\\Movies\\Coco (2017)'];

describe('createShellTrash — over the parent port', () => {
  it('posts a trash request carrying an id and the paths', async () => {
    const parent = fakeParentPort();
    const trash = createShellTrash(parent.port);

    const answer = trash.trash(PATHS);

    expect(parent.requests()).toEqual([
      { type: 'trash', id: expect.any(String), paths: PATHS },
    ]);
    expect(await settled(answer)).toBe(false);
  });

  it('resolves trashed on the matching answer with nothing failed', async () => {
    const parent = fakeParentPort();
    const trash = createShellTrash(parent.port);
    const answer = trash.trash(PATHS);
    const [request] = parent.requests();

    parent.send({ type: 'trashed', id: request.id, failed: null });

    await expect(answer).resolves.toEqual({ kind: 'trashed' });
  });

  it('resolves failed carrying the path the Recycle Bin would not take', async () => {
    const parent = fakeParentPort();
    const trash = createShellTrash(parent.port);
    const paths = [
      'D:\\Shows\\Harbor.S01E01.mkv',
      'D:\\Shows\\Harbor.S01E02.mkv',
    ];
    const answer = trash.trash(paths);
    const [request] = parent.requests();

    parent.send({ type: 'trashed', id: request.id, failed: paths[1] });

    await expect(answer).resolves.toEqual({ kind: 'failed', path: paths[1] });
  });

  it('is not settled by an answer to some other id', async () => {
    const parent = fakeParentPort();
    const trash = createShellTrash(parent.port);
    const answer = trash.trash(PATHS);
    const [request] = parent.requests();

    parent.send({ type: 'trashed', id: `${request.id}-other`, failed: null });

    expect(await settled(answer)).toBe(false);
  });

  it('answers two requests in flight each by its own id, in the order main answers', async () => {
    const parent = fakeParentPort();
    const trash = createShellTrash(parent.port);
    const first = trash.trash(['D:\\Movies\\Coco (2017)']);
    const second = trash.trash(['D:\\Movies\\Heat (1995)']);
    const [one, two] = parent.requests();
    expect(one.id).not.toBe(two.id);

    parent.send({
      type: 'trashed',
      id: two.id,
      failed: 'D:\\Movies\\Heat (1995)',
    });

    await expect(second).resolves.toEqual({
      kind: 'failed',
      path: 'D:\\Movies\\Heat (1995)',
    });
    expect(await settled(first)).toBe(false);

    parent.send({ type: 'trashed', id: one.id, failed: null });

    await expect(first).resolves.toEqual({ kind: 'trashed' });
  });

  it('settles a request once, a repeated answer changing nothing', async () => {
    const parent = fakeParentPort();
    const trash = createShellTrash(parent.port);
    const answer = trash.trash(PATHS);
    const [request] = parent.requests();

    parent.send({ type: 'trashed', id: request.id, failed: null });
    parent.send({ type: 'trashed', id: request.id, failed: PATHS[0] });

    await expect(answer).resolves.toEqual({ kind: 'trashed' });
  });
});

describe('createShellTrash — without a parent port', () => {
  it('answers unavailable, asking nobody', async () => {
    const trash = createShellTrash(undefined);

    await expect(trash.trash(PATHS)).resolves.toEqual({
      kind: 'unavailable',
    } satisfies TrashOutcome);
  });
});

// A shutdown with a request in flight: main's `shutdown` command reaches the
// same port the Shell trash listens on, and the **Ordered shutdown** the
// handshake was handed still runs.

const open: Server[] = [];

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

function listening(): Promise<Server> {
  const server = createServer();
  open.push(server);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

describe('createShellTrash — a shutdown with a request in flight', () => {
  it('still runs the Ordered shutdown', async () => {
    const parent = fakeParentPort();
    const server = await listening();
    const shutdown = vi.fn(async () => undefined);
    await shellHandshake(parent.port, () => ({ server, shutdown }));
    const trash = createShellTrash(parent.port);
    void trash.trash(PATHS);

    expect(() => parent.send({ type: 'shutdown' })).not.toThrow();

    expect(shutdown).toHaveBeenCalledTimes(1);
  });
});
