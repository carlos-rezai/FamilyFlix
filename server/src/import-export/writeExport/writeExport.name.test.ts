// @vitest-environment node
//
// 36 — Export name (issue #295).
//
// `writeExport(media, request, content)` names the **Export folder** and its
// sheet after `request.name` — the name the maintainer typed — and no longer
// reads the clock. It checks the destination first and the name second, so a
// destination refusal wins over a name refusal, and a refused name makes
// nothing at the destination. A taken name is still numbered `… (1)`, and
// nothing is trimmed off the name on its way to the disk.
//
// Over a sandbox and a real `createMedia`; asserted as the tree on disk and
// the outcome's value.

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { Movie, StartExport } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { writeExport } from './writeExport';

const ZEPHYR: Movie = makeMovie({ id: 'zephyr', title: 'Zephyr', year: 2020 });

const CONTENT = { movies: [ZEPHYR], series: [] };

interface Sandbox {
  media: Media;
  destination: string;
  dir: string;
}

/** An empty media root, and an empty destination beside it. */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-write-export-name-');
  const mediaPath = join(dir, 'media');
  const destination = join(dir, 'Movies');
  mkdirSync(mediaPath);
  mkdirSync(destination);
  return { media: createMedia(mediaPath), destination, dir };
}

const request = (
  destination: string,
  overrides: Partial<StartExport> = {}
): StartExport => ({
  format: 'csv',
  destination,
  images: false,
  subtitles: false,
  name: 'Heat (1995) – kopia',
  ...overrides,
});

describe('writeExport — the folder and the sheet take the requested name', () => {
  it('makes the folder under the requested name', async () => {
    const { media, destination } = sandbox();

    const outcome = await writeExport(media, request(destination), CONTENT);

    expect(outcome).toMatchObject({
      kind: 'written',
      folder: join(destination, 'Heat (1995) – kopia'),
    });
    expect(readdirSync(destination)).toEqual(['Heat (1995) – kopia']);
  });

  it('names both csv sheets after the requested name', async () => {
    const { media, destination } = sandbox();

    await writeExport(media, request(destination), CONTENT);

    expect(
      readdirSync(join(destination, 'Heat (1995) – kopia')).sort()
    ).toEqual(
      ['Heat (1995) – kopia-episodes.csv', 'Heat (1995) – kopia.csv'].sort()
    );
  });

  it('names the workbook after the requested name', async () => {
    const { media, destination } = sandbox();

    await writeExport(
      media,
      request(destination, { format: 'xlsx', name: 'Family films' }),
      CONTENT
    );

    expect(readdirSync(join(destination, 'Family films'))).toEqual([
      'Family films.xlsx',
    ]);
  });

  it('trims nothing off the name', async () => {
    const { media, destination } = sandbox();

    await writeExport(
      media,
      request(destination, { name: '  Family films' }),
      CONTENT
    );

    expect(readdirSync(destination)).toEqual(['  Family films']);
    expect(
      existsSync(join(destination, '  Family films', '  Family films.csv'))
    ).toBe(true);
  });
});

describe('writeExport — a taken requested name', () => {
  it('lands as name (1) beside the first', async () => {
    const { media, destination } = sandbox();
    mkdirSync(join(destination, 'Family films'));

    const outcome = await writeExport(
      media,
      request(destination, { name: 'Family films' }),
      CONTENT
    );

    expect(outcome).toMatchObject({
      kind: 'written',
      folder: join(destination, 'Family films (1)'),
    });
    expect(readdirSync(join(destination, 'Family films'))).toEqual([]);
    expect(readdirSync(join(destination, 'Family films (1)'))).toContain(
      'Family films.csv'
    );
  });
});

describe('writeExport — a refused name', () => {
  it.each([
    ['unnamed', ''],
    ['too-long', 'a'.repeat(201)],
    ['bad-character', 'a/b'],
    ['bad-ending', '..'],
    ['reserved', 'con.txt'],
  ])('is refused as %s', async (refusal, name) => {
    const { media, destination } = sandbox();

    const outcome = await writeExport(
      media,
      request(destination, { name }),
      CONTENT
    );

    expect(outcome).toEqual({ kind: 'refused', refusal });
  });

  it.each([
    ['an empty name', ''],
    ['a name with a slash', 'a/b'],
    ['a name with a backslash', 'a\b'],
    ['two dots', '..'],
    ['a reserved name', 'con.txt'],
  ])('makes nothing at the destination for %s', async (_, name) => {
    const { media, destination, dir } = sandbox();

    await writeExport(media, request(destination, { name }), CONTENT);

    expect(readdirSync(destination)).toEqual([]);
    expect(readdirSync(dir).sort()).toEqual(['Movies', 'media']);
  });
});

describe('writeExport — the destination is checked before the name', () => {
  it('answers the destination refusal over a name refusal, the name refusal once the destination is good', async () => {
    const { media, destination, dir } = sandbox();

    const relative = await writeExport(
      media,
      request('Movies', { name: 'a/b' }),
      CONTENT
    );
    const missing = await writeExport(
      media,
      request(join(dir, 'nowhere'), { name: '' }),
      CONTENT
    );
    const named = await writeExport(
      media,
      request(destination, { name: 'a/b' }),
      CONTENT
    );

    expect(relative).toEqual({ kind: 'refused', refusal: 'relative' });
    expect(missing).toEqual({ kind: 'refused', refusal: 'missing' });
    expect(named).toEqual({ kind: 'refused', refusal: 'bad-character' });
  });
});
