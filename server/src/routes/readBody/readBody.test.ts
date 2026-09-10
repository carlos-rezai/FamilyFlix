// @vitest-environment node
//
// 11 — Movie form refactor (issue #109), Group 2: the body reader gets a folder
// and a test.
//
// `readBody` is the one place in the app that reads a request body itself
// rather than through `express.json()`, and until now it was reachable only
// through `POST /api/movies` and `PATCH /api/movies/:id` — where what it does
// is entangled with what those two routes then decide.
//
// It is driven here the way `routes.test.ts` drives the router: a real listener
// on an ephemeral port, a real `fetch`, and a body built by the platform's own
// `FormData`. Nothing is stubbed, because what is being asserted is what
// `busboy` actually does with a body a browser actually sends — a fake parser
// would agree with a broken reader as readily as with this one.
//
// **The middle block is the one that matters.** `busboy` never reaches `close`
// while a part nobody listens to is still pending, so a body carrying a part
// this reader's caller does not want must still be drained. A hung request is a
// worse answer than a failed one, and the failure mode is a browser tab that
// waits forever rather than an error anybody sees.

import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import { readBody, type OnFilePart } from './readBody';

const servers: Server[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

/**
 * What one request to a listener that does nothing but `readBody` came back
 * with: the fields it parsed, or the fact that it rejected.
 */
interface Read {
  status: number;
  fields?: Record<string, string[]>;
  error?: string;
}

/**
 * A listener whose only route reads its body with `readBody` and echoes the
 * fields back, handing every file part to `onFile`.
 *
 * The echo is the seam. `readBody` answers a promise, and a promise is not
 * something a `fetch` can see — so the one route here turns it into the two
 * observable outcomes the real handlers turn it into: a body, or a refusal.
 */
function readerAt(onFile: OnFilePart): string {
  const app = express();
  app.post('/read', (req, res) => {
    readBody(req, onFile).then(
      (fields) => res.json({ fields }),
      (error: unknown) => res.status(400).json({ error: String(error) })
    );
  });

  const server = app.listen(0);
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

/** Post `parts` in the order given, and answer what the listener said. */
async function post(
  baseUrl: string,
  parts: [name: string, value: string | File][]
): Promise<Read> {
  const body = new FormData();
  for (const [name, value] of parts) {
    body.append(name, value);
  }
  const response = await fetch(`${baseUrl}/read`, { method: 'POST', body });
  const payload = (await response.json()) as {
    fields?: Record<string, string[]>;
    error?: string;
  };
  return { status: response.status, ...payload };
}

/** A file part carrying `bytes`, the way a picker hands one to `FormData`. */
function filePart(filename: string, bytes = 'the bytes'): File {
  return new File([bytes], filename, { type: 'application/octet-stream' });
}

/** An `onFile` that drains every part and remembers what it was shown. */
function draining(): {
  onFile: OnFilePart;
  seen: [name: string, filename: string][];
  before: Record<string, string[]>[];
} {
  const seen: [name: string, filename: string][] = [];
  const before: Record<string, string[]>[] = [];
  const onFile: OnFilePart = async (name, filename, part, fields) => {
    seen.push([name, filename]);
    // A snapshot: `readBody` hands over the live record it is filling, and a
    // reference would go on growing as the rest of the body arrived.
    before.push(structuredClone(fields));
    part.resume();
  };
  return { onFile, seen, before };
}

describe('readBody — the fields', () => {
  it('answers every field by name', async () => {
    const { onFile } = draining();
    const read = await post(readerAt(onFile), [
      ['title', 'The Lantern Keeper'],
      ['year', '2019'],
    ]);

    expect(read.status).toBe(200);
    expect(read.fields).toEqual({
      title: ['The Lantern Keeper'],
      year: ['2019'],
    });
  });

  // What makes the genre chips and the cast a list at all: a set has always
  // travelled as one part per entry under one name.
  it('keeps every value of a repeated name, in the order the parts arrived', async () => {
    const { onFile } = draining();
    const read = await post(readerAt(onFile), [
      ['genre', 'Drama'],
      ['genre', 'Romance'],
      ['genre', 'Thriller'],
    ]);

    expect(read.fields?.genre).toEqual(['Drama', 'Romance', 'Thriller']);
  });

  it('answers no fields at all for a body carrying none', async () => {
    const { onFile } = draining();
    const read = await post(readerAt(onFile), []);

    expect(read.status).toBe(200);
    expect(read.fields).toEqual({});
  });

  it('keeps an empty value rather than dropping the field', async () => {
    const { onFile } = draining();
    const read = await post(readerAt(onFile), [['director', '']]);

    expect(read.fields).toEqual({ director: [''] });
  });
});

describe('readBody — the file parts', () => {
  it('hands every file part over as it arrives', async () => {
    const { onFile, seen } = draining();
    await post(readerAt(onFile), [
      ['video', filePart('lantern.mp4')],
      ['poster', filePart('poster.png')],
    ]);

    expect(seen).toEqual([
      ['video', 'lantern.mp4'],
      ['poster', 'poster.png'],
    ]);
  });

  // The awkward half of the contract, deliberately not hidden: `busboy` will
  // not reach the fields after a file until that file has been consumed, so a
  // route that needs the title to decide where the bytes go can only be shown
  // the title if it had already arrived.
  it('shows a part only the fields that arrived before it', async () => {
    const { onFile, before } = draining();
    await post(readerAt(onFile), [
      ['title', 'The Lantern Keeper'],
      ['video', filePart('lantern.mp4')],
      ['year', '2019'],
    ]);

    expect(before).toHaveLength(1);
    expect(before[0]).toEqual({ title: ['The Lantern Keeper'] });
  });

  it('answers the fields that arrived after a part as well', async () => {
    const { onFile } = draining();
    const read = await post(readerAt(onFile), [
      ['video', filePart('lantern.mp4')],
      ['year', '2019'],
    ]);

    expect(read.fields).toEqual({ year: ['2019'] });
  });

  it('answers only once every part it handed over has been dealt with', async () => {
    let landed = false;
    const onFile: OnFilePart = async (_name, _filename, part) => {
      part.resume();
      await new Promise((resolve) => setTimeout(resolve, 20));
      landed = true;
    };

    const read = await post(readerAt(onFile), [
      ['video', filePart('lantern.mp4')],
    ]);

    expect(read.status).toBe(200);
    // A row written before its bytes were on disk would point at a file that is
    // not there yet.
    expect(landed).toBe(true);
  });

  // The one that would hang. A part nobody consumes leaves `busboy` short of
  // `close` forever.
  it('finishes even when its caller drains a part instead of reading it', async () => {
    const onFile: OnFilePart = async (_name, _filename, part) => {
      part.resume();
    };

    const read = await post(readerAt(onFile), [
      ['poster', filePart('poster.html')],
      ['title', 'The Lantern Keeper'],
    ]);

    expect(read.status).toBe(200);
    expect(read.fields).toEqual({ title: ['The Lantern Keeper'] });
  });

  it('finishes when its caller throws over a part, rather than leaving it pending', async () => {
    const onFile: OnFilePart = () => Promise.reject(new Error('not a poster'));

    const read = await post(readerAt(onFile), [
      ['poster', filePart('poster.html')],
    ]);

    // The refusal reaches the caller, and it reaches it at all — which is the
    // assertion: a part left unconsumed would never resolve either way.
    expect(read.status).toBe(400);
    expect(read.error).toContain('not a poster');
  });
});

describe('readBody — a body it cannot read', () => {
  it('rejects a body that is not multipart at all', async () => {
    const { onFile } = draining();
    const baseUrl = readerAt(onFile);

    const response = await fetch(`${baseUrl}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'The Lantern Keeper' }),
    });

    expect(response.status).toBe(400);
  });

  it('rejects a body whose content type says nothing about a boundary', async () => {
    const { onFile } = draining();
    const baseUrl = readerAt(onFile);

    const response = await fetch(`${baseUrl}/read`, {
      method: 'POST',
      body: 'the bytes',
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    expect(response.status).toBe(400);
  });
});
