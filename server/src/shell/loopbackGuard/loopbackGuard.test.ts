// @vitest-environment node
//
// Issue #222 — the **Loopback guard**. Only the machine itself can talk to the
// server, and only through FamilyFlix's own origin: the guard, mounted in front
// of everything, answers `403` when `Host` is not a **Trusted host** (a
// DNS-rebinding name included), or when an `Origin` is present and is not a
// trusted one. The trusted hosts are `127.0.0.1:<bound>`, `localhost:<bound>`
// and whatever `FAMILYFLIX_TRUSTED_HOSTS` lists — `localhost:4200`, Vite's,
// when the variable is unset, and nothing when it is empty. The bound port
// reaches the guard after `listen`. A request with no `Origin` from a trusted
// `Host` passes, which is what keeps `<video>`, `<img>` and the Vite proxy
// working.
//
// The issue says "through supertest"; the repo has no supertest, so these
// drive a real listening server with `node:http`, which — unlike `fetch` —
// lets a test spell its own `Host`, the route suites' way.

import { request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';

import { loopbackGuard } from './loopbackGuard';

/** The port the guard is told the server bound — the **Shell port**. */
const BOUND = 41720;

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

/**
 * An app with the guard in front of a read and a write, the guard told the
 * bound port the way `main.ts` tells it after `listen`.
 */
function guardedApp(trustedHosts: string | undefined) {
  const guard = loopbackGuard(trustedHosts);
  guard.bind(BOUND);
  const app = express();
  app.use(guard);
  app.get('/api/ping', (_req, res) => {
    res.json({ ok: true });
  });
  app.post('/api/movies/1/favorite', (_req, res) => {
    res.status(204).end();
  });
  return app;
}

/**
 * One request to the app on an ephemeral loopback port, carrying the `Host`
 * and `Origin` given — as a browser, or a rebinding page, would spell them.
 */
async function send(
  app: express.Express,
  {
    method = 'GET',
    path = '/api/ping',
    host,
    origin,
  }: { method?: string; path?: string; host: string; origin?: string }
): Promise<number> {
  const server = app.listen(0, '127.0.0.1');
  open.push(server);
  await new Promise<void>((resolve) =>
    server.once('listening', () => resolve())
  );
  const { port } = server.address() as AddressInfo;
  const headers: Record<string, string> = { Host: host };
  if (origin !== undefined) headers.Origin = origin;
  return new Promise<number>((resolve, reject) => {
    const req = httpRequest(
      { host: '127.0.0.1', port, method, path, headers },
      (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode ?? 0));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('loopbackGuard — the Host', () => {
  it('lets a request from the bound port on 127.0.0.1 through', async () => {
    const app = guardedApp(undefined);

    expect(await send(app, { host: `127.0.0.1:${BOUND}` })).toBe(200);
  });

  it('lets the localhost spelling of the bound port through', async () => {
    const app = guardedApp(undefined);

    expect(await send(app, { host: `localhost:${BOUND}` })).toBe(200);
  });

  it('answers 403 to a foreign Host', async () => {
    const app = guardedApp(undefined);

    expect(await send(app, { host: 'example.com' })).toBe(403);
  });

  it('answers 403 to a DNS-rebinding name pointed at the loopback', async () => {
    const app = guardedApp(undefined);

    expect(await send(app, { host: `attacker.example:${BOUND}` })).toBe(403);
  });

  it('answers 403 to the loopback on a port the server did not bind', async () => {
    const app = guardedApp(undefined);

    expect(await send(app, { host: '127.0.0.1:9999' })).toBe(403);
  });

  it('answers 403 to a write from a foreign Host as well as a read', async () => {
    const app = guardedApp(undefined);

    expect(
      await send(app, {
        method: 'POST',
        path: '/api/movies/1/favorite',
        host: 'attacker.example',
      })
    ).toBe(403);
  });
});

describe('loopbackGuard — the Origin', () => {
  it('answers 403 to a foreign Origin on a trusted Host', async () => {
    const app = guardedApp(undefined);

    expect(
      await send(app, {
        method: 'POST',
        path: '/api/movies/1/favorite',
        host: `127.0.0.1:${BOUND}`,
        origin: 'https://attacker.example',
      })
    ).toBe(403);
  });

  it('lets a trusted Origin through', async () => {
    const app = guardedApp(undefined);

    expect(
      await send(app, {
        method: 'POST',
        path: '/api/movies/1/favorite',
        host: `127.0.0.1:${BOUND}`,
        origin: `http://127.0.0.1:${BOUND}`,
      })
    ).toBe(204);
  });

  it('lets the localhost spelling of the bound origin through', async () => {
    const app = guardedApp(undefined);

    expect(
      await send(app, {
        method: 'POST',
        path: '/api/movies/1/favorite',
        host: `localhost:${BOUND}`,
        origin: `http://localhost:${BOUND}`,
      })
    ).toBe(204);
  });

  it('lets a request with no Origin from a trusted Host through', async () => {
    const app = guardedApp(undefined);

    expect(
      await send(app, {
        method: 'POST',
        path: '/api/movies/1/favorite',
        host: `127.0.0.1:${BOUND}`,
      })
    ).toBe(204);
  });
});

describe('loopbackGuard — FAMILYFLIX_TRUSTED_HOSTS', () => {
  it("trusts Vite's localhost:4200 when the variable is unset", async () => {
    const app = guardedApp(undefined);

    expect(
      await send(app, {
        method: 'POST',
        path: '/api/movies/1/favorite',
        host: 'localhost:4200',
        origin: 'http://localhost:4200',
      })
    ).toBe(204);
  });

  it('trusts every host the list names, comma-separated', async () => {
    const app = guardedApp('localhost:5173,studio.local:8080');

    expect(await send(app, { host: 'localhost:5173' })).toBe(200);
    expect(
      await send(app, {
        host: 'studio.local:8080',
        origin: 'http://studio.local:8080',
      })
    ).toBe(200);
  });

  it('no longer trusts localhost:4200 when the list names others', async () => {
    const app = guardedApp('localhost:5173');

    expect(await send(app, { host: 'localhost:4200' })).toBe(403);
  });

  it('trusts only the bound port when the list is empty', async () => {
    const app = guardedApp('');

    expect(await send(app, { host: 'localhost:4200' })).toBe(403);
    expect(
      await send(app, {
        host: `127.0.0.1:${BOUND}`,
        origin: 'http://localhost:4200',
      })
    ).toBe(403);
    expect(await send(app, { host: `127.0.0.1:${BOUND}` })).toBe(200);
    expect(await send(app, { host: `localhost:${BOUND}` })).toBe(200);
  });
});
