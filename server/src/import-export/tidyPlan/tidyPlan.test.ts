// @vitest-environment node
//
// 57 — Tidy into folders, Phase 2: "a scan lists loose films" (issue #525).
//
// `tidyPlan(path, read, kept)`, pure: a root's `readLooseVideos` read in, its
// **Tidy plan** out. Each loose film is a `film` **Tidy** into its **Tidy
// folder name**, `titleWithYear(titleGuess(stem), yearInName(stem))` through
// `safeFilename`; a name the root already holds, file or folder, case folded,
// keeps the video where it is with the clash sentence; a video `kept` answers
// true for (a **Held video** or a **Left-out video**) is in neither list. Two
// videos with one folder name are both offered. Episodes are planned in a
// later phase. The read is spelled here by name, as the root lists it.

import { describe, expect, it } from 'vitest';

import { tidyPlan } from './tidyPlan';
import { safeFilename } from '../../media/safeFilename/safeFilename';

const ROOT = 'E:\\Movies';

interface ReadFile {
  video: string;
  companions: string[];
  tag: null;
}

/** A loose film as `readLooseVideos` reads it. */
const film = (video: string, companions: string[] = []): ReadFile => ({
  video,
  companions,
  tag: null,
});

/** A root's read: its loose films, and every entry it holds. */
const read = (loose: ReadFile[], others: string[] = []) => ({
  loose,
  names: [
    ...loose.flatMap((file) => [file.video, ...file.companions]),
    ...others,
  ],
});

/** Nothing held, nothing left out. */
const nothingKept = () => false;

describe('tidyPlan — a loose film', () => {
  it('answers the root it was read from', () => {
    expect(tidyPlan(ROOT, read([]), nothingKept).path).toBe(ROOT);
  });

  it('plans a film tidy into the folder named off a release-noise stem', () => {
    const plan = tidyPlan(
      ROOT,
      read([film('Apex.2026.1080p.mkv', ['Apex.2026.1080p.en.srt'])]),
      nothingKept
    );

    expect(plan.tidies).toEqual([
      {
        id: 'apex.2026.1080p.mkv',
        kind: 'film',
        folder: 'Apex (2026)',
        videos: ['Apex.2026.1080p.mkv'],
        companions: ['Apex.2026.1080p.en.srt'],
      },
    ]);
    expect(plan.kept).toEqual([]);
  });

  it('names a stem with no year by its title alone', () => {
    const plan = tidyPlan(ROOT, read([film('Northwind.mp4')]), nothingKept);

    expect(plan.tidies.map((tidy) => tidy.folder)).toEqual(['Northwind']);
  });

  it('makes the folder name safe, a separator in the title never reaching it', () => {
    const plan = tidyPlan(
      ROOT,
      read([film('AC/DC Live (2010).mkv')]),
      nothingKept
    );

    expect(plan.tidies.map((tidy) => tidy.folder)).toEqual([
      safeFilename('AC/DC Live (2010)'),
    ]);
  });
});

describe('tidyPlan — a name already there', () => {
  const CLASH = 'A folder called “Apex (2026)” is already here.';

  it('keeps a video whose folder name a folder in the root already has, with the clash sentence', () => {
    const plan = tidyPlan(
      ROOT,
      read(
        [film('Apex.2026.1080p.mkv', ['Apex.2026.1080p.en.srt'])],
        ['Apex (2026)']
      ),
      nothingKept
    );

    expect(plan.tidies).toEqual([]);
    expect(plan.kept).toHaveLength(1);
    expect(plan.kept[0].files).toContain('Apex.2026.1080p.mkv');
    expect(plan.kept[0].reason).toBe(CLASH);
  });

  it('keeps it for a file of that name too', () => {
    const plan = tidyPlan(
      ROOT,
      read([film('Apex (2026).mkv')], ['Apex (2026)']),
      nothingKept
    );

    expect(plan.tidies).toEqual([]);
    expect(plan.kept.map((kept) => kept.reason)).toEqual([CLASH]);
  });

  it('folds case when it looks for the name', () => {
    const plan = tidyPlan(
      ROOT,
      read([film('Apex.2026.1080p.mkv')], ['APEX (2026)']),
      nothingKept
    );

    expect(plan.tidies).toEqual([]);
    expect(plan.kept.map((kept) => kept.reason)).toEqual([CLASH]);
  });
});

describe('tidyPlan — held and left-out videos', () => {
  it('leaves a video kept answers for out of both lists', () => {
    const plan = tidyPlan(
      ROOT,
      read([film('Heat (1995).mkv'), film('Apex (2026).mkv')], ['Heat (1995)']),
      (video) => video === 'Heat (1995).mkv'
    );

    expect(plan.tidies.map((tidy) => tidy.videos)).toEqual([
      ['Apex (2026).mkv'],
    ]);
    expect(plan.kept).toEqual([]);
  });
});

describe('tidyPlan — two videos, one folder name', () => {
  it('offers both, each a tidy of its own', () => {
    const plan = tidyPlan(
      ROOT,
      read([film('Northwind.mkv'), film('Northwind.mp4')]),
      nothingKept
    );

    expect(plan.tidies.map((tidy) => [tidy.folder, tidy.videos])).toEqual([
      ['Northwind', ['Northwind.mkv']],
      ['Northwind', ['Northwind.mp4']],
    ]);
    expect(new Set(plan.tidies.map((tidy) => tidy.id)).size).toBe(2);
    expect(plan.kept).toEqual([]);
  });
});
