// `npm run electron:ffmpeg` — the **Default component** the **Installer**
// carries. Issue #231.
//
//   node electron/scripts/fetchFfmpeg.mjs [--pin <file>] [--outdir <dir>]
//
// Downloads the archive the **FFmpeg pin** (`electron/packaging/ffmpegPin.json`)
// names, refuses it through `verifyDigest` when its SHA-256 is not the pin's,
// and extracts only `ffmpeg.exe`, `ffprobe.exe` and the licence — as
// `LICENSE.txt` — into the gitignored `electron/.ffmpeg/`, beside a
// `README.txt` naming the build, its version and where its source is
// published. That directory is what the config ships to `resources\ffmpeg\`,
// so it holds those four files and nothing else.
//
// The README carries the pin's digest too, and that is the "already matches"
// mark: when the three binaries are there and the README names this pin, the
// run skips everything, so a second run needs no network.
//
// The zip is read by hand — the central directory, then each wanted entry
// stored or deflated — so the script needs no dependency.

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

import { verifyDigest } from './verifyDigest/verifyDigest.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));

/** `--name <value>` off the command line, else the fallback. */
function option(name, fallback) {
  const args = process.argv.slice(2);
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] ? resolve(args[at + 1]) : fallback;
}

const pinPath = option(
  'pin',
  join(root, 'electron', 'packaging', 'ffmpegPin.json')
);
const outdir = option('outdir', join(root, 'electron', '.ffmpeg'));

/** What the archive carries under its one top folder → the name shipped. */
const WANTED = [
  ['bin/ffmpeg.exe', 'ffmpeg.exe'],
  ['bin/ffprobe.exe', 'ffprobe.exe'],
  ['LICENSE', 'LICENSE.txt'],
];

function readme({ version, url, sha256 }) {
  return [
    'FFmpeg — the Default component of FamilyFlix',
    '',
    `Build:   gyan.dev release essentials, Windows x64`,
    `Version: ${version}`,
    `Archive: ${url}`,
    `SHA-256: ${sha256}`,
    '',
    'This is FFmpeg as built by gyan.dev (https://www.gyan.dev/ffmpeg/builds/),',
    'licensed under the GNU General Public License version 3 — see LICENSE.txt.',
    'Only ffmpeg.exe and ffprobe.exe are carried; the binaries are unmodified.',
    '',
    'Source: FFmpeg’s source is published at https://ffmpeg.org/download.html',
    `and https://git.ffmpeg.org/ffmpeg.git (tag n${version}); the build’s`,
    'configuration and the sources of the libraries it links are listed at',
    'https://www.gyan.dev/ffmpeg/builds/.',
    '',
  ].join('\r\n');
}

/** Whether the extracted copy already matches this pin. */
async function matchesPin(pin) {
  const files = ['ffmpeg.exe', 'ffprobe.exe', 'LICENSE.txt', 'README.txt'];
  if (!files.every((file) => existsSync(join(outdir, file)))) return false;
  const current = await readFile(join(outdir, 'README.txt'), 'utf8');
  return current === readme(pin);
}

/** The zip's entries, off its central directory. */
function entries(zip) {
  let end = -1;
  for (let at = zip.length - 22; at >= Math.max(0, zip.length - 65_557); at--) {
    if (zip.readUInt32LE(at) === 0x06054b50) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new Error('The FFmpeg archive is not a zip.');

  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const found = [];
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(at) !== 0x02014b50) {
      throw new Error('The FFmpeg archive’s central directory is damaged.');
    }
    const method = zip.readUInt16LE(at + 10);
    const compressedSize = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const extraLength = zip.readUInt16LE(at + 30);
    const commentLength = zip.readUInt16LE(at + 32);
    const localOffset = zip.readUInt32LE(at + 42);
    const name = zip.toString('utf8', at + 46, at + 46 + nameLength);
    found.push({ name, method, compressedSize, localOffset });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return found;
}

/** One entry's bytes, stored or deflated. */
function contents(zip, { name, method, compressedSize, localOffset }) {
  if (zip.readUInt32LE(localOffset) !== 0x04034b50) {
    throw new Error(`The FFmpeg archive’s entry ${name} is damaged.`);
  }
  const start =
    localOffset +
    30 +
    zip.readUInt16LE(localOffset + 26) +
    zip.readUInt16LE(localOffset + 28);
  const data = zip.subarray(start, start + compressedSize);
  if (method === 0) return data;
  if (method === 8) return inflateRawSync(data);
  throw new Error(`The FFmpeg archive’s entry ${name} uses method ${method}.`);
}

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Downloading ${url} answered ${response.status}.`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const pin = JSON.parse(await readFile(pinPath, 'utf8'));

  if (await matchesPin(pin)) {
    process.stdout.write(
      `FFmpeg ${pin.version} already matches the pin → ${outdir}\n`
    );
    return;
  }

  process.stdout.write(`Downloading FFmpeg ${pin.version} from ${pin.url}\n`);
  const zip = await download(pin.url);
  verifyDigest(createHash('sha256').update(zip).digest('hex'), pin.sha256);

  const all = entries(zip);
  const extracted = WANTED.map(([inner, shipped]) => {
    const entry = all.find(
      ({ name }) => name.slice(name.indexOf('/') + 1) === inner
    );
    if (!entry) throw new Error(`The FFmpeg archive carries no ${inner}.`);
    return [shipped, contents(zip, entry)];
  });

  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });
  for (const [shipped, data] of extracted) {
    await writeFile(join(outdir, shipped), data);
  }
  await writeFile(join(outdir, 'README.txt'), readme(pin));

  process.stdout.write(`FFmpeg ${pin.version} → ${outdir}\n`);
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
}
