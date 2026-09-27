// @vitest-environment node
//
// 23 — Enrichment, Phase 8: "write back into the collection" (issue #211).
//
// `writeBack` is the two **Write targets** — the only code in the app that
// writes into the **Library root**:
//
// - `check(root, targets)` — `fs.access(root, W_OK)` for the targets switched
//   on, answering which may be written and the dry-run lines: _Will write
//   familyflix-metadata.csv to <root>_, or, for a root that cannot be written,
//   the one warning _Can't write to <root> — the sheet and posters will be
//   skipped_.
// - `poster(root, sourceFolder, stream)` — `poster.jpg` into the **Source
//   folder**, only when there is none. `sourceFolder` is relative to the root,
//   `null` when none is on record; a folder that is gone is not made.
// - `sheet(root, movies)` — `familyflix-metadata.csv`, the **Export file**'s
//   CSV (`writeSheet`), only when there is none.
//
// Each answers what it did as a value and a log line; none ever throws, and
// none ever replaces a file. Every test writes into a sandbox.

import { Readable } from 'node:stream';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { readSheet } from '../../import-export/readSheet/readSheet';
import { writeSheet } from '../../import-export/writeSheet/writeSheet';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { writeBack } from './writeBack';

const SHEET = 'familyflix-metadata.csv';

/** A Library root holding one Source folder, and the root's full path. */
function collection(): { root: string; folder: string } {
  const root = sandboxRoot('familyflix-writeback-');
  const folder = 'Lanternlight (2011)';
  mkdirSync(join(root, folder));
  writeFileSync(join(root, folder, 'Lanternlight.mkv'), 'video bytes');
  return { root, folder };
}

/** A root the process cannot write to: one that is not there. */
function unwritableRoot(): string {
  return join(sandboxRoot('familyflix-writeback-gone-'), 'not-there');
}

const image = (text = 'poster bytes from TMDB') =>
  Readable.from([Buffer.from(text)]);

/** A stream that fails partway, the way a dropped download does. */
function failingImage(): Readable {
  return new Readable({
    read() {
      this.push(Buffer.from('half a poster'));
      this.destroy(new Error('socket hang up'));
    },
  });
}

describe('writeBack.check — the permission check and its dry-run lines', () => {
  it('answers both targets writable for a root it can write to', async () => {
    const { root } = collection();

    const check = await writeBack.check(root, ['sheet', 'posters']);

    expect(check.writable).toEqual({ sheet: true, posters: true });
  });

  it('says it will write the sheet to the root', async () => {
    const { root } = collection();

    const check = await writeBack.check(root, ['sheet', 'posters']);

    expect(check.lines.map((line) => line.text)).toContain(
      `Will write ${SHEET} to ${root}`
    );
  });

  it('answers neither writable for a root it cannot write to', async () => {
    const root = unwritableRoot();

    const check = await writeBack.check(root, ['sheet', 'posters']);

    expect(check.writable).toEqual({ sheet: false, posters: false });
  });

  it('warns once that the sheet and posters will be skipped', async () => {
    const root = unwritableRoot();

    const check = await writeBack.check(root, ['sheet', 'posters']);

    expect(check.lines).toEqual([
      {
        text: `Can't write to ${root} — the sheet and posters will be skipped`,
        kind: 'warning',
      },
    ]);
  });

  it('answers a target switched off as not to be written, with no line for it', async () => {
    const { root } = collection();

    const check = await writeBack.check(root, ['posters']);

    expect(check.writable).toEqual({ sheet: false, posters: true });
    expect(check.lines.some((line) => line.text.includes(SHEET))).toBe(false);
  });

  it('writes nothing into the root while checking it', async () => {
    const { root, folder } = collection();

    await writeBack.check(root, ['sheet', 'posters']);

    expect(readdirSync(root)).toEqual([folder]);
    expect(readdirSync(join(root, folder))).toEqual(['Lanternlight.mkv']);
  });
});

describe('writeBack.poster — poster.jpg into a Source folder, only when absent', () => {
  it('adds poster.jpg with the bytes it is given', async () => {
    const { root, folder } = collection();

    const outcome = await writeBack.poster(root, folder, image());

    expect(outcome.kind).toBe('written');
    expect(readFileSync(join(root, folder, 'poster.jpg'), 'utf8')).toBe(
      'poster bytes from TMDB'
    );
  });

  it('leaves an existing poster.jpg byte-identical', async () => {
    const { root, folder } = collection();
    const ours = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    writeFileSync(join(root, folder, 'poster.jpg'), ours);

    const outcome = await writeBack.poster(root, folder, image());

    expect(outcome.kind).toBe('exists');
    expect(readFileSync(join(root, folder, 'poster.jpg')).equals(ours)).toBe(
      true
    );
  });

  it('logs an existing poster.jpg as left alone', async () => {
    const { root, folder } = collection();
    writeFileSync(join(root, folder, 'poster.jpg'), 'ours');

    const outcome = await writeBack.poster(root, folder, image());

    expect(outcome.line?.text).toContain('poster.jpg exists, left alone');
  });

  it('writes nothing for a title with no source folder on record', async () => {
    const { root, folder } = collection();

    const outcome = await writeBack.poster(root, null, image());

    expect(outcome.kind).toBe('no-folder');
    expect(readdirSync(root)).toEqual([folder]);
  });

  it('does not make a source folder that is gone', async () => {
    const { root, folder } = collection();

    const outcome = await writeBack.poster(root, 'Moved Away (1999)', image());

    expect(outcome.kind).toBe('no-folder');
    expect(existsSync(join(root, 'Moved Away (1999)'))).toBe(false);
    expect(readdirSync(root)).toEqual([folder]);
  });

  it('never throws on a failed download, and leaves no half a poster', async () => {
    const { root, folder } = collection();

    const outcome = await writeBack.poster(root, folder, failingImage());

    expect(outcome.kind).toBe('failed');
    expect(existsSync(join(root, folder, 'poster.jpg'))).toBe(false);
  });

  it('never throws for a root it cannot write to', async () => {
    const root = unwritableRoot();

    const outcome = await writeBack.poster(
      root,
      'Lanternlight (2011)',
      image()
    );

    expect(outcome.kind).not.toBe('written');
    expect(existsSync(root)).toBe(false);
  });
});

describe('writeBack.sheet — the Metadata sheet in the root, only when absent', () => {
  const films = [
    makeMovie({
      id: 'a',
      title: 'Harbor Lights',
      year: 1963,
      genres: [{ id: 'drama', name: 'Drama' }],
      director: 'Ines Ruiz',
    }),
    makeMovie({ id: 'b', title: 'Lanternlight', year: 2011 }),
  ];

  it('adds familyflix-metadata.csv to the root', async () => {
    const { root } = collection();

    const outcome = await writeBack.sheet(root, films);

    expect(outcome.kind).toBe('written');
    expect(existsSync(join(root, SHEET))).toBe(true);
  });

  it('reads back through Bulk import, one row per film in the order given', async () => {
    const { root } = collection();

    await writeBack.sheet(root, films);
    const rows = await readSheet(readFileSync(join(root, SHEET)), SHEET);

    expect(rows.map((row) => row.title)).toEqual([
      'Harbor Lights',
      'Lanternlight',
    ]);
    expect(rows[0]).toMatchObject({
      year: 1963,
      genres: ['Drama'],
      director: 'Ines Ruiz',
    });
  });

  it('is the Export file’s CSV to the byte', async () => {
    const { root } = collection();

    await writeBack.sheet(root, films);

    expect(
      readFileSync(join(root, SHEET)).equals(await writeSheet(films, 'csv'))
    ).toBe(true);
  });

  it('leaves an existing sheet byte-identical, logging it as left alone', async () => {
    const { root } = collection();
    const ours = Buffer.from('Title,Year\nOur own list,1999\n');
    writeFileSync(join(root, SHEET), ours);

    const outcome = await writeBack.sheet(root, films);

    expect(outcome.kind).toBe('exists');
    expect(outcome.line.text).toContain(`${SHEET} exists, left alone`);
    expect(readFileSync(join(root, SHEET)).equals(ours)).toBe(true);
  });

  it('never throws for a root it cannot write to, and makes no root', async () => {
    const root = unwritableRoot();

    const outcome = await writeBack.sheet(root, films);

    expect(outcome.kind).toBe('failed');
    expect(existsSync(root)).toBe(false);
  });

  it('writes nothing else into the root', async () => {
    const { root, folder } = collection();

    await writeBack.sheet(root, films);

    expect(readdirSync(root).sort()).toEqual([folder, SHEET].sort());
  });
});
