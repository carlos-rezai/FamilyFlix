// @vitest-environment node
//
// Issue #231 — FFmpeg on board. `npm run electron:ffmpeg` runs
// `fetchFfmpeg.mjs`: it downloads the archive the **FFmpeg pin** names,
// refuses it when its SHA-256 is not the pin's, and extracts only
// `ffmpeg.exe`, `ffprobe.exe` and the licence — as `LICENSE.txt` — beside a
// `README.txt` naming the build, its version and where its source is
// published. That directory is what the **Installer** ships to
// `resources\ffmpeg\`, so it holds those four files and nothing else — never
// `ffplay.exe`. When the extracted copy already matches the pin it skips
// everything, so a second run needs no network.
//
// The script is run with Node, by path and with no shell, over a pin and an
// output directory of the suite's own (`--pin`, `--outdir`), so it never
// touches `electron/.ffmpeg/` or the real pin. The archive is a stand-in laid
// out as gyan.dev's _release essentials_ zip is, served from the loopback.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));
const script = join(root, 'electron', 'scripts', 'fetchFfmpeg.mjs');

const VERSION = '7.1.1';
const BUILD = `ffmpeg-${VERSION}-essentials_build`;

const FFMPEG = Buffer.from('MZ the ffmpeg stand-in');
const FFPROBE = Buffer.from('MZ the ffprobe stand-in');
const LICENSE = Buffer.from('GNU GENERAL PUBLIC LICENSE\nVersion 3\n');

/** The stand-in archive's entries, laid out as gyan.dev's zip is. */
const ENTRIES: Array<[string, Buffer]> = [
  [`${BUILD}/LICENSE`, LICENSE],
  [`${BUILD}/README.txt`, Buffer.from('gyan.dev’s own readme')],
  [`${BUILD}/bin/ffmpeg.exe`, FFMPEG],
  [`${BUILD}/bin/ffplay.exe`, Buffer.from('MZ the ffplay stand-in')],
  [`${BUILD}/bin/ffprobe.exe`, FFPROBE],
  [`${BUILD}/doc/ffmpeg.html`, Buffer.from('<html></html>')],
  [`${BUILD}/presets/libvpx-720p.ffpreset`, Buffer.from('vb=1800k')],
];

/** A zip of stored (uncompressed) entries, written by hand. */
function storedZip(entries: Array<[string, Buffer]>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const [name, data] of entries) {
    const fileName = Buffer.from(name, 'utf8');
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(fileName.length, 26);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(fileName.length, 28);
    central.writeUInt32LE(offset, 42);

    locals.push(local, fileName, data);
    centrals.push(central, fileName);
    offset += local.length + fileName.length + data.length;
  }

  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, directory, end]);
}

const ARCHIVE = storedZip(ENTRIES);
const SHA256 = createHash('sha256').update(ARCHIVE).digest('hex');

interface Run {
  code: number;
  output: string;
}

/** Run the script with Node, by path and with no shell. */
function fetchFfmpeg(pin: string, outdir: string): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [script, '--pin', pin, '--outdir', outdir],
      { cwd: root, shell: false, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('error', reject);
    child.on('exit', (code) => resolve({ code: code ?? -1, output }));
  });
}

/** Serve the stand-in archive on the loopback, counting the requests. */
function serveArchive(): Promise<{
  server: Server;
  url: string;
  hits: () => number;
}> {
  let hits = 0;
  const server = createServer((_request, response) => {
    hits += 1;
    response.writeHead(200, {
      'content-type': 'application/zip',
      'content-length': ARCHIVE.length,
    });
    response.end(ARCHIVE);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        server,
        url: `http://127.0.0.1:${port}/ffmpeg-release-essentials.zip`,
        hits: () => hits,
      });
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

async function writePin(
  path: string,
  pin: { version: string; url: string; sha256: string }
): Promise<void> {
  await writeFile(path, JSON.stringify(pin, null, 2));
}

describe('electron:ffmpeg — the pinned archive, downloaded and extracted', () => {
  let sandbox: string;
  let outdir: string;
  let pin: string;
  let first: Run;
  let server: Server;
  let hits: () => number;

  beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), 'familyflix-fetch-ffmpeg-'));
    outdir = join(sandbox, '.ffmpeg');
    pin = join(sandbox, 'ffmpegPin.json');
    const served = await serveArchive();
    server = served.server;
    hits = served.hits;
    await writePin(pin, { version: VERSION, url: served.url, sha256: SHA256 });
    first = await fetchFfmpeg(pin, outdir);
  }, 60_000);

  afterAll(async () => {
    if (server.listening) await close(server);
    await rm(sandbox, { recursive: true, force: true });
  });

  it('runs to completion', () => {
    expect(first).toMatchObject({ code: 0 });
  });

  it('holds exactly ffmpeg.exe, ffprobe.exe, LICENSE.txt and README.txt — no ffplay.exe', async () => {
    const files = existsSync(outdir) ? (await readdir(outdir)).sort() : [];

    expect(files).toEqual([
      'LICENSE.txt',
      'README.txt',
      'ffmpeg.exe',
      'ffprobe.exe',
    ]);
  });

  it('extracts ffmpeg.exe and ffprobe.exe as the archive carries them', async () => {
    expect(await readFile(join(outdir, 'ffmpeg.exe'))).toEqual(FFMPEG);
    expect(await readFile(join(outdir, 'ffprobe.exe'))).toEqual(FFPROBE);
  });

  it('carries the build’s licence as LICENSE.txt', async () => {
    expect(await readFile(join(outdir, 'LICENSE.txt'))).toEqual(LICENSE);
  });

  it('writes a README.txt naming the build, its version and where its source is published', async () => {
    const readme = existsSync(join(outdir, 'README.txt'))
      ? await readFile(join(outdir, 'README.txt'), 'utf8')
      : '';

    expect(readme).toMatch(/gyan\.dev/);
    expect(readme).toContain(VERSION);
    expect(readme).toMatch(/source/i);
    expect(readme).toMatch(/https:\/\//);
  });

  it('skips the download when the extracted copy matches the pin, and works offline then', async () => {
    const downloads = hits();
    const before = await readFile(join(outdir, 'ffmpeg.exe'));
    await close(server);

    const second = await fetchFfmpeg(pin, outdir);

    expect(second).toMatchObject({ code: 0 });
    expect(downloads).toBe(1);
    expect(await readFile(join(outdir, 'ffmpeg.exe'))).toEqual(before);
    expect((await readdir(outdir)).sort()).toEqual([
      'LICENSE.txt',
      'README.txt',
      'ffmpeg.exe',
      'ffprobe.exe',
    ]);
  }, 60_000);
});

describe('electron:ffmpeg — a digest that is not the pin’s', () => {
  const WRONG = '0'.repeat(64);
  let sandbox: string;
  let outdir: string;
  let run: Run;
  let server: Server;

  beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), 'familyflix-fetch-ffmpeg-'));
    outdir = join(sandbox, '.ffmpeg');
    const pin = join(sandbox, 'ffmpegPin.json');
    const served = await serveArchive();
    server = served.server;
    await writePin(pin, { version: VERSION, url: served.url, sha256: WRONG });
    run = await fetchFfmpeg(pin, outdir);
  }, 60_000);

  afterAll(async () => {
    await close(server);
    await rm(sandbox, { recursive: true, force: true });
  });

  it('refuses the archive, naming both digests, and extracts nothing', () => {
    expect(run.code).not.toBe(0);
    expect(run.output).toContain(SHA256);
    expect(run.output).toContain(WRONG);
    expect(existsSync(join(outdir, 'ffmpeg.exe'))).toBe(false);
    expect(existsSync(join(outdir, 'ffprobe.exe'))).toBe(false);
  });
});
