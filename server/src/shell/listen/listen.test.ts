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

describe('Vite’s dev proxy', () => {
  it('targets the server on 127.0.0.1:3001', async () => {
    vi.stubEnv('PORT', undefined);
    const { default: configFor } = await import('../../../../vite.config.mjs');
    const config = configFor({ command: 'serve', mode: 'development' });

    expect(config.server?.proxy?.['/api']).toBe('http://127.0.0.1:3001');
  });
});
