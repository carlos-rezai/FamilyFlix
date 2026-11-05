// `npm run electron:ffmpeg` — the **Default component** the **Installer**
// carries. Issues #231 and #514.
//
//   node electron/scripts/fetchFfmpeg.mjs [--pin <file>] [--outdir <dir>]
//
// Reads `process.platform`'s entry of the **FFmpeg pin**
// (`electron/packaging/ffmpegPin.json`) and the **FFmpeg target**
// (`ffmpegTarget`) for what its archive looks like; any platform but Windows
// and Linux is refused. Downloads the archive, refuses it through
// `verifyDigest` when its SHA-256 is not the pin's, and extracts only
// `ffmpeg`, `ffprobe` and the licence, as `LICENSE.txt`, into the gitignored
// `electron/.ffmpeg/`, beside a `README.txt` naming the build, its version,
// the archive, the digest and where its source is published. That directory
// is what the config ships, so it holds those four files and nothing else.
// The binaries are written executable.
//
// The README is the "already matches" mark: when the shipped files are there
// and the README names this pin, the run skips everything, so a second run
// needs no network.
//
// A zip (Windows) is read by hand, by `zipEntries`; a tar.xz (Linux) by the
// system `tar`, spawned without a shell and only on Linux. So the script
// needs no dependency.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ffmpegTarget } from './ffmpegTarget/ffmpegTarget.ts';
import { verifyDigest } from './verifyDigest/verifyDigest.ts';
import { entryBytes, zipEntries } from './zipEntries/zipEntries.ts';

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

function readme(target, { version, url, sha256 }) {
  const binaries = target.wanted
    .filter(({ executable }) => executable)
    .map(({ shipped }) => shipped)
    .join(' and ');
  return [
    'FFmpeg — the Default component of FamilyFlix',
    '',
    `Build:   ${target.build}`,
    `Version: ${version}`,
    `Archive: ${url}`,
    `SHA-256: ${sha256}`,
    '',
    `This is FFmpeg as built by ${target.builder} (${target.home}),`,
    'licensed under the GNU General Public License version 3 — see LICENSE.txt.',
    `Only ${binaries} are carried; the binaries are unmodified.`,
    '',
    'Source: FFmpeg’s source is published at https://ffmpeg.org/download.html',
    `and https://git.ffmpeg.org/ffmpeg.git (tag n${version}); the build’s`,
    'configuration and the sources of the libraries it links are listed at',
    `${target.home}.`,
    '',
  ].join('\r\n');
}

/** Whether the extracted copy already matches this pin. */
async function matchesPin(target, pin) {
  const files = [...target.wanted.map(({ shipped }) => shipped), 'README.txt'];
  if (!files.every((file) => existsSync(join(outdir, file)))) return false;
  const current = await readFile(join(outdir, 'README.txt'), 'utf8');
  return current === readme(target, pin);
}

async function download(url) {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Downloading ${url} failed (${reason}).`);
  }
  if (!response.ok) {
    throw new Error(`Downloading ${url} answered ${response.status}.`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/** Each wanted entry with its bytes, out of a zip, through `zipEntries`. */
function fromZip(target, zip) {
  const all = zipEntries(zip);
  return target.wanted.map((wanted) => {
    const { inner } = wanted;
    const entry = all.find(
      ({ name }) => name.slice(name.indexOf('/') + 1) === inner
    );
    if (!entry) throw new Error(`The FFmpeg archive carries no ${inner}.`);
    return { ...wanted, data: entryBytes(zip, entry) };
  });
}

/** Run the system `tar` with no shell, rejecting on a non-zero exit. */
function tar(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('tar', args, {
      shell: false,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let errors = '';
    child.stderr.on('data', (chunk) => (errors += chunk.toString()));
    child.on('error', (error) =>
      reject(new Error(`The system tar could not run (${error.message}).`))
    );
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`The system tar exited ${code}: ${errors.trim()}.`))
    );
  });
}

/** Each wanted entry with its bytes, out of a tar.xz, through the system `tar`. */
async function fromTarXz(target, archive) {
  if (process.platform !== 'linux') {
    throw new Error('A tar.xz FFmpeg archive is extracted on Linux only.');
  }
  const scratch = await mkdtemp(join(tmpdir(), 'familyflix-ffmpeg-'));
  try {
    const file = join(scratch, 'ffmpeg.tar.xz');
    const into = join(scratch, 'extracted');
    await writeFile(file, archive);
    await mkdir(into);
    await tar(['-xJf', file, '-C', into]);
    const tops = await readdir(into);
    if (tops.length !== 1) {
      throw new Error('The FFmpeg archive does not hold one top folder.');
    }
    const top = join(into, tops[0]);
    const extracted = [];
    for (const wanted of target.wanted) {
      const path = join(top, ...wanted.inner.split('/'));
      if (!existsSync(path)) {
        throw new Error(`The FFmpeg archive carries no ${wanted.inner}.`);
      }
      extracted.push({ ...wanted, data: await readFile(path) });
    }
    return extracted;
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

async function main() {
  const target = ffmpegTarget(process.platform);
  const pins = JSON.parse(await readFile(pinPath, 'utf8'));
  const pin = pins[process.platform];
  if (!pin) {
    throw new Error(`The FFmpeg pin holds no entry for ${process.platform}.`);
  }

  if (await matchesPin(target, pin)) {
    process.stdout.write(
      `FFmpeg ${pin.version} already matches the pin → ${outdir}\n`
    );
    return;
  }

  process.stdout.write(`Downloading FFmpeg ${pin.version} from ${pin.url}\n`);
  const archive = await download(pin.url);
  verifyDigest(createHash('sha256').update(archive).digest('hex'), pin.sha256);

  const extracted =
    target.archive === 'zip'
      ? fromZip(target, archive)
      : await fromTarXz(target, archive);

  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });
  for (const { shipped, executable, data } of extracted) {
    const mode = executable ? 0o755 : 0o644;
    await writeFile(join(outdir, shipped), data, { mode });
  }
  await writeFile(join(outdir, 'README.txt'), readme(target, pin));

  process.stdout.write(`FFmpeg ${pin.version} → ${outdir}\n`);
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
}
