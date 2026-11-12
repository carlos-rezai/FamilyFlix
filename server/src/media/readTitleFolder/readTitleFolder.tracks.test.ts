// @vitest-environment node
//
// 61, Export round trip, Phase 4 (issue #585): one track per language.
//
// A **Subtitles folder**, a film's or an episode's, reads one track per
// language, the first by name order; every further track of that language
// makes the language a `track` **Doubled place**, with the file read and the
// count. Tracks of different languages are all read and report nothing.
//
// Against real folders under `sandboxRoot`, as the reader's other suites.

import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  readTitleFolder,
  type DoubledPlace,
  type SubtitleFound,
} from './readTitleFolder';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A Title folder named `name` holding the files at the relative paths given. */
function titleFolder(name: string, files: string[]): string {
  const dir = join(sandboxRoot('familyflix-one-track-'), name);
  mkdirSync(dir, { recursive: true });
  for (const file of files) {
    const path = join(dir, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${file} bytes`);
  }
  return dir;
}

/** A film's scan, checked to be one. */
async function filmIn(dir: string) {
  const scan = await readTitleFolder(dir);
  expect(scan).toMatchObject({ kind: 'film' });
  return scan as Extract<typeof scan, { kind: 'film' }>;
}

/** A series' scan, checked to be one. */
async function seriesIn(dir: string) {
  const scan = await readTitleFolder(dir);
  expect(scan).toMatchObject({ kind: 'series' });
  return scan as Extract<typeof scan, { kind: 'series' }>;
}

/** Each track read, by its own name and language, in name order. */
const tracksRead = (subtitles: SubtitleFound[]) =>
  subtitles
    .map(({ path, language }) => ({ file: basename(path), language }))
    .sort((a, b) => a.file.localeCompare(b.file));

/** Each Doubled place with the file it read named by its own name. */
const named = (doubled: DoubledPlace[]) =>
  doubled.map((place) => ({ ...place, read: basename(place.read) }));

describe('readTitleFolder: one track per language', () => {
  it('reads the first of a film’s two Dutch tracks by name order and reports the language doubled', async () => {
    const dir = titleFolder('Heat (1995)', [
      'Heat.mkv',
      'Subtitles/Nederlands.srt',
      'Subtitles/Dutch.srt',
    ]);

    const scan = await filmIn(dir);

    expect(tracksRead(scan.subtitles)).toEqual([
      { file: 'Dutch.srt', language: 'Dutch' },
    ]);
    expect(named(scan.doubled)).toEqual([
      { place: 'track', language: 'Dutch', read: 'Dutch.srt', count: 2 },
    ]);
  });

  it('reads the first of an episode’s two Dutch tracks by name order and reports it on its season, naming the episode', async () => {
    const dir = titleFolder('Tidewater (2018)', [
      'Season 01/Tidewater.S01E01.mkv',
      'Season 01/Tidewater.S01E02.mkv',
      'Season 01/Subtitles/S01E01/Dutch.srt',
      'Season 01/Subtitles/S01E01/Nederlands.srt',
      'Season 01/Subtitles/S01E02/Dutch.srt',
    ]);

    const scan = await seriesIn(dir);

    const [season] = scan.seasons;
    expect(
      season.subtitles.map((track) => ({
        path: track.path.split(/[\\/]/).slice(-2).join('/'),
        language: track.language,
      }))
    ).toEqual(
      expect.arrayContaining([
        { path: 'S01E01/Dutch.srt', language: 'Dutch' },
        { path: 'S01E02/Dutch.srt', language: 'Dutch' },
      ])
    );
    expect(season.subtitles).toHaveLength(2);
    expect(named(season.doubled)).toEqual([
      {
        place: 'track',
        season: 1,
        episode: 1,
        language: 'Dutch',
        read: 'Dutch.srt',
        count: 2,
      },
    ]);
    expect(scan.doubled).toEqual([]);
  });

  it('reads every track of a different language beside a doubled one', async () => {
    const dir = titleFolder('Heat (1995)', [
      'Heat.mkv',
      'Subtitles/Nederlands.srt',
      'Subtitles/Dutch.srt',
      'Subtitles/English.srt',
      'Subtitles/fr.srt',
    ]);

    const scan = await filmIn(dir);

    expect(tracksRead(scan.subtitles)).toEqual([
      { file: 'Dutch.srt', language: 'Dutch' },
      { file: 'English.srt', language: 'English' },
      { file: 'fr.srt', language: 'French' },
    ]);
    expect(named(scan.doubled)).toEqual([
      { place: 'track', language: 'Dutch', read: 'Dutch.srt', count: 2 },
    ]);
  });

  it('reads every track of a different language in an episode’s folder beside a doubled one', async () => {
    const dir = titleFolder('Tidewater (2018)', [
      'Season 01/Tidewater.S01E01.mkv',
      'Season 01/Subtitles/S01E01/Dutch.srt',
      'Season 01/Subtitles/S01E01/Nederlands.srt',
      'Season 01/Subtitles/S01E01/English.srt',
    ]);

    const scan = await seriesIn(dir);

    const [season] = scan.seasons;
    expect(tracksRead(season.subtitles)).toEqual([
      { file: 'Dutch.srt', language: 'Dutch' },
      { file: 'English.srt', language: 'English' },
    ]);
    expect(named(season.doubled)).toEqual([
      {
        place: 'track',
        season: 1,
        episode: 1,
        language: 'Dutch',
        read: 'Dutch.srt',
        count: 2,
      },
    ]);
  });
});
