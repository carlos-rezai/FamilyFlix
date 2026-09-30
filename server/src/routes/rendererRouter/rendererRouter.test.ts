// @vitest-environment node
//
// Issue #220 — the installed shape. When `FAMILYFLIX_RENDERER_PATH` is set the
// server mounts `rendererRouter`: it serves the built renderer's files under
// the CSP and answers `index.html` for any GET outside `/api`, so a reload on
// a deep route stays there (**One origin**). `/api` is never shadowed — an
// unknown `/api` path is still the API's own 404 — and when the variable is
// unset nothing is mounted at all.
//
// Issue #226 — the rule is about the renderer's policy, not every CSP: it is
// sent on the renderer and never on `/api`. Express's own not-found page keeps
// its own `default-src 'none'`, and nothing is patched onto the response.

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express, { type Express } from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { mountRenderer, RENDERER_CSP } from './rendererRouter';

/** The CSP exactly as the plan's *Architectural decisions* spell it. */
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob: https://image.tmdb.org; media-src 'self' blob:; " +
  "font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'";

const INDEX = '<!doctype html><title>FamilyFlix</title><div id="root"></div>';
const SCRIPT = 'console.info("renderer");';

let renderer: string;

beforeEach(async () => {
  renderer = await mkdtemp(join(tmpdir(), 'familyflix-renderer-'));
  await writeFile(join(renderer, 'index.html'), INDEX);
  await mkdir(join(renderer, 'assets'));
  await writeFile(join(renderer, 'assets', 'index-abc123.js'), SCRIPT);
});

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
  await rm(renderer, { recursive: true, force: true });
});

interface Answer {
  status: number;
  headers: Headers;
  text: string;
}

/** A client over the app on an ephemeral loopback port, the route suites' way. */
function request(app: Express) {
  const server = app.listen(0, '127.0.0.1');
  open.push(server);
  const ready = new Promise<void>((resolve) =>
    server.once('listening', () => resolve())
  );
  return {
    async get(path: string): Promise<Answer> {
      await ready;
      const { port } = server.address() as AddressInfo;
      const res = await fetch(`http://127.0.0.1:${port}${path}`);
      return {
        status: res.status,
        headers: res.headers,
        text: await res.text(),
      };
    },
  };
}

/** A stand-in for the API: one route, and no catch-all of its own. */
function apiRouter() {
  const router = express.Router();
  router.get('/ping', (_req, res) => {
    res.json({ ok: true });
  });
  return router;
}

/** The server's composition: the API first, then the renderer. */
function serverWith(rendererPath: string | undefined): Express {
  const app = express();
  app.use('/api', apiRouter());
  mountRenderer(app, rendererPath);
  return app;
}

describe('RENDERER_CSP', () => {
  it('is the plan’s policy, TMDB’s image host included', () => {
    expect(RENDERER_CSP).toBe(CSP);
  });
});

describe('rendererRouter — mounted', () => {
  it('serves a static file from the built renderer', async () => {
    const res = await request(serverWith(renderer)).get(
      '/assets/index-abc123.js'
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/javascript/);
    expect(res.text).toBe(SCRIPT);
  });

  it('answers the root with index.html', async () => {
    const res = await request(serverWith(renderer)).get('/');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(res.text).toBe(INDEX);
  });

  it('answers a deep route with index.html, so a reload stays there', async () => {
    const res = await request(serverWith(renderer)).get('/series/3/season/2');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(res.text).toBe(INDEX);
  });

  it('sends the CSP on the renderer', async () => {
    const client = request(serverWith(renderer));

    const root = await client.get('/');
    const deep = await client.get('/series/3/season/2');

    expect(root.headers.get('content-security-policy')).toBe(CSP);
    expect(deep.headers.get('content-security-policy')).toBe(CSP);
  });

  it('never sends the renderer’s policy on /api', async () => {
    const client = request(serverWith(renderer));

    const known = await client.get('/api/ping');
    const unknown = await client.get('/api/no-such-thing');

    expect(known.status).toBe(200);
    expect(known.headers.get('content-security-policy')).not.toBe(CSP);
    expect(unknown.headers.get('content-security-policy')).not.toBe(CSP);
  });

  it('never shadows an /api route', async () => {
    const res = await request(serverWith(renderer)).get('/api/ping');

    expect(JSON.parse(res.text)).toEqual({ ok: true });
  });

  it('leaves an unknown /api path the API’s own 404, not index.html', async () => {
    const res = await request(serverWith(renderer)).get('/api/no-such-thing');

    expect(res.status).toBe(404);
    expect(res.text).not.toBe(INDEX);
    expect(res.headers.get('content-security-policy')).not.toBe(CSP);
  });

  it('does not shadow /api even when mounted ahead of it', async () => {
    const app = express();
    mountRenderer(app, renderer);
    app.use('/api', apiRouter());
    const client = request(app);

    const known = await client.get('/api/ping');
    const unknown = await client.get('/api/no-such-thing');

    expect(JSON.parse(known.text)).toEqual({ ok: true });
    expect(known.headers.get('content-security-policy')).not.toBe(CSP);
    expect(unknown.status).toBe(404);
    expect(unknown.text).not.toBe(INDEX);
  });
});

describe('rendererRouter — FAMILYFLIX_RENDERER_PATH unset', () => {
  it('mounts nothing: the root and a deep route are 404s', async () => {
    const client = request(serverWith(undefined));

    const root = await client.get('/');
    const deep = await client.get('/series/3/season/2');

    expect(root.status).toBe(404);
    expect(deep.status).toBe(404);
  });

  it('mounts nothing: the app’s middleware stack is the API’s alone', () => {
    const apiAlone = express();
    apiAlone.use('/api', apiRouter());

    expect(serverWith(undefined).router.stack).toHaveLength(
      apiAlone.router.stack.length
    );
  });

  it('sends the renderer’s policy nowhere', async () => {
    const client = request(serverWith(undefined));

    const root = await client.get('/');
    const deep = await client.get('/series/3/season/2');
    const api = await client.get('/api/ping');

    for (const res of [root, deep, api]) {
      expect(res.headers.get('content-security-policy')).not.toBe(CSP);
    }
  });

  it('leaves the API answering as before', async () => {
    const res = await request(serverWith(undefined)).get('/api/ping');

    expect(JSON.parse(res.text)).toEqual({ ok: true });
  });
});
