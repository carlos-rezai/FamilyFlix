// @vitest-environment node
//
// Issue #231 — FFmpeg on board. `npm run electron:ffmpeg` runs
// `fetchFfmpeg.mjs`: it downloads the archive the **FFmpeg pin** names,
// refuses it when its SHA-256 is not the pin's, and extracts only `ffmpeg`,
// `ffprobe` and the licence — as `LICENSE.txt` — beside a `README.txt` naming
// the build, its version and where its source is published. That directory is
// what each **Platform build** ships to `resources/ffmpeg/`, so it holds those
// four files and nothing else, never `ffplay`. When the extracted copy already
// matches the pin it skips everything, so a second run needs no network.
//
// Issue #514 — the Linux FFmpeg. The pin is keyed by platform, and the script
// takes `process.platform`'s entry: on Windows gyan.dev's essentials zip
// (`ffmpeg.exe`, `ffprobe.exe`), on Linux BtbN's linux64 GPL tar.xz (`ffmpeg`,
// `ffprobe`, written executable) read by the system `tar`. The pin written
// here carries the other platform's entry as a decoy no fetch could satisfy,
// so a run that chose it fails. The tar.xz stand-in is made with the system
// `tar` too, so that half runs on Linux only.
//
// The script is run with Node, by path and with no shell, over a pin and an
// output directory of the suite's own (`--pin`, `--outdir`), so it never
// touches `electron/.ffmpeg/` or the real pin. The archive is a stand-in laid
// out as the real one is, served from the loopback.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));
const script = join(root, 'electron', 'scripts', 'fetchFfmpeg.mjs');

const onWindows = process.platform === 'win32';
const onLinux = process.platform === 'linux';

const VERSION = '7.1.1';

const FFMPEG = Buffer.from('the ffmpeg stand-in');
const FFPROBE = Buffer.from('the ffprobe stand-in');
const LICENSE = Buffer.from('GNU GENERAL PUBLIC LICENSE\nVersion 3\n');

interface Fixture {
  /** The pin key the running platform reads. */
  key: 'win32' | 'linux';
  /** The other platform's key, written as a decoy. */
  decoy: 'win32' | 'linux';
  /** The archive's own file name, served at the pin's URL. */
  fileName: string;
  /** The names shipped: the two binaries, then all four sorted. */
  ffmpeg: string;
  ffprobe: string;
  shipped: string[];
  /** What the README's build line names. */
  build: RegExp;
}

const WINDOWS: Fixture = {
  key: 'win32',
  decoy: 'linux',
  fileName: 'ffmpeg-release-essentials.zip',
  ffmpeg: 'ffmpeg.exe',
  ffprobe: 'ffprobe.exe',
  shipped: ['LICENSE.txt', 'README.txt', 'ffmpeg.exe', 'ffprobe.exe'],
  build: /gyan\.dev/,
};

const LINUX: Fixture = {
  key: 'linux',
  decoy: 'win32',
  fileName: 'ffmpeg-n9.0-latest-linux64-gpl-9.0.tar.xz',
  ffmpeg: 'ffmpeg',
  ffprobe: 'ffprobe',
  shipped: ['LICENSE.txt', 'README.txt', 'ffmpeg', 'ffprobe'],
  build: /BtbN/,
};

const FIXTURE = onWindows ? WINDOWS : LINUX;

/** gyan.dev's zip layout: one top folder, `bin/*.exe`, a bare `LICENSE`. */
const ZIP_TOP = `ffmpeg-${VERSION}-essentials_build`;
const ZIP_ENTRIES: Array<[string, Buffer]> = [
  [`${ZIP_TOP}/LICENSE`, LICENSE],
  [`${ZIP_TOP}/README.txt`, Buffer.from('gyan.dev’s own readme')],
  [`${ZIP_TOP}/bin/ffmpeg.exe`, FFMPEG],
  [`${ZIP_TOP}/bin/ffplay.exe`, Buffer.from('the ffplay stand-in')],
  [`${ZIP_TOP}/bin/ffprobe.exe`, FFPROBE],
  [`${ZIP_TOP}/doc/ffmpeg.html`, Buffer.from('<html></html>')],
  [`${ZIP_TOP}/presets/libvpx-720p.ffpreset`, Buffer.from('vb=1800k')],
];

/** BtbN's tar.xz layout: one top folder, extensionless `bin/*`, `LICENSE.txt`. */
const TAR_TOP = 'ffmpeg-n9.0-latest-linux64-gpl-9.0';
const TAR_ENTRIES: Array<[string, Buffer]> = [
  ['LICENSE.txt', LICENSE],
  ['bin/ffmpeg', FFMPEG],
  ['bin/ffplay', Buffer.from('the ffplay stand-in')],
  ['bin/ffprobe', FFPROBE],
  ['doc/ffmpeg.html', Buffer.from('<html></html>')],
  ['man/man1/ffmpeg.1', Buffer.from('.TH FFMPEG 1')],
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

/** Run a program by path with no shell, resolving its exit code. */
function run(
  program: string,
  args: string[]
): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, {
      cwd: root,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('error', reject);
    child.on('exit', (code) => resolve({ code: code ?? -1, output }));
  });
}

/** A tar.xz laid out as BtbN's, made with the system `tar` (Linux only). */
async function xzTarball(
  sandbox: string,
  entries: Array<[string, Buffer]>
): Promise<Buffer> {
  const staging = join(sandbox, 'staging');
  for (const [name, data] of entries) {
    const path = join(staging, TAR_TOP, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data, { mode: 0o644 });
  }
  const tarball = join(sandbox, LINUX.fileName);
  const made = await run('tar', ['-cJf', tarball, '-C', staging, TAR_TOP]);
  if (made.code !== 0) throw new Error(`tar failed: ${made.output}`);
  const bytes = await readFile(tarball);
  await rm(staging, { recursive: true, force: true });
  await rm(tarball, { force: true });
  return bytes;
}

/** The running platform's stand-in archive. */
function standIn(sandbox: string): Promise<Buffer> {
  return onWindows
    ? Promise.resolve(storedZip(ZIP_ENTRIES))
    : xzTarball(sandbox, TAR_ENTRIES);
}

const sha256 = (bytes: Buffer): string =>
  createHash('sha256').update(bytes).digest('hex');

interface Run {
  code: number;
  output: string;
}

/** Run the script with Node, by path and with no shell. */
function fetchFfmpeg(pin: string, outdir: string): Promise<Run> {
  return run(process.execPath, [script, '--pin', pin, '--outdir', outdir]);
}

/** Serve an archive (or a status) on the loopback, counting the requests. */
function serve(
  archive: Buffer,
  status = 200
): Promise<{ server: Server; url: string; hits: () => number }> {
  let hits = 0;
  const server = createServer((_request, response) => {
    hits += 1;
    if (status !== 200) {
      response.writeHead(status);
      response.end();
      return;
    }
    response.writeHead(200, {
      'content-type': 'application/octet-stream',
      'content-length': archive.length,
    });
    response.end(archive);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        server,
        url: `http://127.0.0.1:${port}/${FIXTURE.fileName}`,
        hits: () => hits,
      });
    });
  });
}

/** The last line the script wrote: its refusal, when it refuses. */
const lastLine = (output: string): string =>
  output.trim().split(/\r?\n/).at(-1) ?? '';

function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

/**
 * A keyed pin: the running platform's entry as given, the other platform's a
 * decoy whose URL answers nothing and whose digest matches nothing.
 */
async function writePin(
  path: string,
  entry: { version: string; url: string; sha256: string }
): Promise<void> {
  const decoy = {
    version: '0.0.0',
    url: 'http://127.0.0.1:9/no-such-archive',
    sha256: 'f'.repeat(64),
  };
  await writeFile(
    path,
    JSON.stringify({ [FIXTURE.key]: entry, [FIXTURE.decoy]: decoy }, null, 2)
  );
}

const supported = onWindows || onLinux;

describe.runIf(supported)(
  'electron:ffmpeg — the platform’s pinned archive, downloaded and extracted',
  () => {
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
      const archive = await standIn(sandbox);
      const served = await serve(archive);
      server = served.server;
      hits = served.hits;
      await writePin(pin, {
        version: VERSION,
        url: served.url,
        sha256: sha256(archive),
      });
      first = await fetchFfmpeg(pin, outdir);
    }, 60_000);

    afterAll(async () => {
      if (server.listening) await close(server);
      await rm(sandbox, { recursive: true, force: true });
    });

    it('runs to completion', () => {
      expect(first).toMatchObject({ code: 0 });
    });

    it('holds exactly ffmpeg, ffprobe, LICENSE.txt and README.txt — no ffplay', async () => {
      const files = existsSync(outdir) ? (await readdir(outdir)).sort() : [];

      expect(files).toEqual(FIXTURE.shipped);
    });

    it('extracts ffmpeg and ffprobe as the archive carries them', async () => {
      expect(await readFile(join(outdir, FIXTURE.ffmpeg))).toEqual(FFMPEG);
      expect(await readFile(join(outdir, FIXTURE.ffprobe))).toEqual(FFPROBE);
    });

    it.runIf(onLinux)('writes ffmpeg and ffprobe executable', async () => {
      for (const binary of [FIXTURE.ffmpeg, FIXTURE.ffprobe]) {
        const { mode } = await stat(join(outdir, binary));
        expect(mode & 0o111).toBe(0o111);
      }
    });

    it('carries the build’s licence as LICENSE.txt', async () => {
      expect(await readFile(join(outdir, 'LICENSE.txt'))).toEqual(LICENSE);
    });

    it('writes a README.txt naming the build, its version, the archive, the digest and where its source is', async () => {
      const readme = existsSync(join(outdir, 'README.txt'))
        ? await readFile(join(outdir, 'README.txt'), 'utf8')
        : '';
      const entry = JSON.parse(await readFile(pin, 'utf8'))[FIXTURE.key] as {
        url: string;
        sha256: string;
      };

      expect(readme).toMatch(FIXTURE.build);
      expect(readme).toContain(VERSION);
      expect(readme).toContain(entry.url);
      expect(readme).toContain(entry.sha256);
      expect(readme).toMatch(/source/i);
      expect(readme).toMatch(/https:\/\//);
    });

    it('skips the download when the README names the pin, and works offline then', async () => {
      const downloads = hits();
      const before = await readFile(join(outdir, FIXTURE.ffmpeg));
      await close(server);

      const second = await fetchFfmpeg(pin, outdir);

      expect(second).toMatchObject({ code: 0 });
      expect(downloads).toBe(1);
      expect(await readFile(join(outdir, FIXTURE.ffmpeg))).toEqual(before);
      expect((await readdir(outdir)).sort()).toEqual(FIXTURE.shipped);
    }, 60_000);
  }
);

describe.runIf(supported)(
  'electron:ffmpeg — a digest that is not the pin’s',
  () => {
    const WRONG = '0'.repeat(64);
    let sandbox: string;
    let outdir: string;
    let digest: string;
    let result: Run;
    let server: Server;

    beforeAll(async () => {
      sandbox = await mkdtemp(join(tmpdir(), 'familyflix-fetch-ffmpeg-'));
      outdir = join(sandbox, '.ffmpeg');
      const pin = join(sandbox, 'ffmpegPin.json');
      const archive = await standIn(sandbox);
      digest = sha256(archive);
      const served = await serve(archive);
      server = served.server;
      await writePin(pin, { version: VERSION, url: served.url, sha256: WRONG });
      result = await fetchFfmpeg(pin, outdir);
    }, 60_000);

    afterAll(async () => {
      await close(server);
      await rm(sandbox, { recursive: true, force: true });
    });

    it('refuses the archive, naming both digests, and extracts nothing', () => {
      expect(result.code).not.toBe(0);
      expect(result.output).toContain(digest);
      expect(result.output).toContain(WRONG);
      expect(existsSync(join(outdir, FIXTURE.ffmpeg))).toBe(false);
      expect(existsSync(join(outdir, FIXTURE.ffprobe))).toBe(false);
    });
  }
);

describe.runIf(supported)('electron:ffmpeg — a URL it cannot reach', () => {
  let sandbox: string;

  beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), 'familyflix-fetch-ffmpeg-'));
  });

  afterAll(async () => {
    await rm(sandbox, { recursive: true, force: true });
  });

  it('exits non-zero with a sentence naming the URL when nothing answers', async () => {
    const outdir = join(sandbox, 'refused', '.ffmpeg');
    const pin = join(sandbox, 'refused.json');
    const served = await serve(Buffer.alloc(0));
    await close(served.server);
    await writePin(pin, {
      version: VERSION,
      url: served.url,
      sha256: '0'.repeat(64),
    });

    const result = await fetchFfmpeg(pin, outdir);

    expect(result.code).not.toBe(0);
    expect(lastLine(result.output)).toContain(served.url);
    expect(lastLine(result.output)).toMatch(/^[A-Z].*\.$/);
    expect(existsSync(join(outdir, FIXTURE.ffmpeg))).toBe(false);
  }, 60_000);

  it('exits non-zero with a sentence naming the URL when the archive has vanished', async () => {
    const outdir = join(sandbox, 'vanished', '.ffmpeg');
    const pin = join(sandbox, 'vanished.json');
    const served = await serve(Buffer.alloc(0), 404);
    try {
      await writePin(pin, {
        version: VERSION,
        url: served.url,
        sha256: '0'.repeat(64),
      });

      const result = await fetchFfmpeg(pin, outdir);

      expect(result.code).not.toBe(0);
      expect(lastLine(result.output)).toContain(served.url);
      expect(lastLine(result.output)).toMatch(/^[A-Z].*\.$/);
      expect(existsSync(join(outdir, FIXTURE.ffmpeg))).toBe(false);
    } finally {
      await close(served.server);
    }
  }, 60_000);
});
