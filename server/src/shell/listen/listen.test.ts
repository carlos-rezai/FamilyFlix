// @vitest-environment node
//
// Issue #216 — the window over the server. The listen step binds the server to
// `127.0.0.1` and nothing else, standalone included: the library is never
// reachable from another machine on the family's network. Vite's dev proxy
// follows it onto the same address, so `npm run dev` still reaches the API.
//
// A taken port still throws standalone — the ephemeral fallback belongs to the
// shell and to a later slice.

import { createServer, request, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ServerMessage } from '../../../../src/types/shell';
import { shellHandshake } from '../shellHandshake/shellHandshake';
import { listen } from './listen';

const open: Server[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    open
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve()))
      )
  );
});

function appAnsweringPing() {
  const app = express();
  app.get('/api/ping', (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

function get(port: number, path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    request({ host: '127.0.0.1', port, path }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    })
      .on('error', reject)
      .end();
  });
}

describe('listen', () => {
  it('binds 127.0.0.1 only', async () => {
    const server = await listen(appAnsweringPing(), 0);
    open.push(server);

    expect((server.address() as AddressInfo).address).toBe('127.0.0.1');
  });

  it('answers on the loopback address at the port it bound', async () => {
    const server = await listen(appAnsweringPing(), 0);
    open.push(server);

    await expect(
      get((server.address() as AddressInfo).port, '/api/ping')
    ).resolves.toBe(200);
  });

  it('rejects when the port is taken', async () => {
    const taken = createServer();
    open.push(taken);
    await new Promise<void>((resolve) =>
      taken.listen(0, '127.0.0.1', () => resolve())
    );
    const port = (taken.address() as AddressInfo).port;

    await expect(listen(appAnsweringPing(), port)).rejects.toThrow(
      /EADDRINUSE/
    );
  });
});

// Issue #220 — the installed shape. Under the **Desktop shell** the server
// listens on the **Shell port**, and a taken one falls back to an ephemeral
// port, which `ready` reports. Standalone, a taken port still throws.

async function takenPort(): Promise<number> {
  const taken = createServer();
  open.push(taken);
  await new Promise<void>((resolve) =>
    taken.listen(0, '127.0.0.1', () => resolve())
  );
  return (taken.address() as AddressInfo).port;
}

describe('listen — under the shell', () => {
  it('binds the port it was given when that port is free', async () => {
    const free = await takenPort();
    await new Promise<void>((resolve) => open.pop()?.close(() => resolve()));

    const server = await listen(appAnsweringPing(), free, { underShell: true });
    open.push(server);

    expect((server.address() as AddressInfo).port).toBe(free);
  });

  it('falls back to an ephemeral port on 127.0.0.1 when the port is taken', async () => {
    const port = await takenPort();

    const server = await listen(appAnsweringPing(), port, { underShell: true });
    open.push(server);
    const bound = server.address() as AddressInfo;

    expect(bound.address).toBe('127.0.0.1');
    expect(bound.port).not.toBe(port);
    expect(bound.port).toBeGreaterThan(0);
    await expect(get(bound.port, '/api/ping')).resolves.toBe(200);
  });

  it('has `ready` carry the port it actually bound after the fallback', async () => {
    const port = await takenPort();
    const posted: ServerMessage[] = [];
    const parentPort = {
      postMessage: (message: ServerMessage) => {
        posted.push(message);
      },
      on: vi.fn(),
    };

    const { server } = await shellHandshake(parentPort, async () => ({
      server: await listen(appAnsweringPing(), port, { underShell: true }),
      shutdown: async () => undefined,
    }));
    open.push(server);

    const bound = (server.address() as AddressInfo).port;
    expect(bound).not.toBe(port);
    expect(posted).toEqual([{ type: 'ready', port: bound }]);
  });
});

describe('listen — standalone', () => {
  it('still throws on a taken port when not under the shell', async () => {
    const port = await takenPort();

    await expect(
      listen(appAnsweringPing(), port, { underShell: false })
    ).rejects.toThrow(/EADDRINUSE/);
  });
});

describe('Vite’s dev proxy', () => {
  it('targets the server on 127.0.0.1:3001', async () => {
    vi.stubEnv('PORT', undefined);
    const { default: configFor } = await import('../../../../vite.config.mjs');
    const config = configFor({ command: 'serve', mode: 'development' });

    expect(config.server?.proxy?.['/api']).toBe('http://127.0.0.1:3001');
  });
});
