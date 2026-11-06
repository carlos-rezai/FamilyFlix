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
// videos with one folder name are both offered. Episodes are planned below,
// in Phase 5's suites. The read is spelled here by name, as the root lists it.

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

// 57, Phase 5: "loose shows" (issue #528). Tagged videos group by the **Title
// key** of the text before the tag into one `show` **Tidy**, named by
// `titleGuess` of that text through `safeFilename`; episodes stay flat.
// Episodes with nothing before the tag are kept where they are.

interface TaggedFile {
  video: string;
  companions: string[];
  tag: { season: number; episode: number; title: string | null };
}

/** A loose episode as `readLooseVideos` reads it, its tag spelled out. */
const episode = (
  video: string,
  season: number,
  number: number,
  companions: string[] = []
): TaggedFile => ({
  video,
  companions,
  tag: { season, episode: number, title: null },
});

/** A root's read over films and episodes alike. */
const mixed = (loose: (ReadFile | TaggedFile)[], others: string[] = []) => ({
  loose,
  names: [
    ...loose.flatMap((file) => [file.video, ...file.companions]),
    ...others,
  ],
});

describe('tidyPlan — a tagged video', () => {
  it('is never planned as a film', () => {
    const plan = tidyPlan(
      ROOT,
      mixed([episode('Breaking.Bad.S01E01.mp4', 1, 1)]),
      nothingKept
    );

    expect(plan.tidies.map((tidy) => tidy.kind)).toEqual(['show']);
    expect(plan.tidies.some((tidy) => tidy.kind === 'film')).toBe(false);
  });

  it('beside a film, only the film is a film tidy', () => {
    const plan = tidyPlan(
      ROOT,
      mixed([
        film('Apex.2026.1080p.mp4'),
        episode('Breaking.Bad.S01E01.mp4', 1, 1),
      ]),
      nothingKept
    );

    expect(plan.tidies.map((tidy) => [tidy.kind, tidy.videos])).toEqual([
      ['film', ['Apex.2026.1080p.mp4']],
      ['show', ['Breaking.Bad.S01E01.mp4']],
    ]);
  });
});

describe('tidyPlan — a loose show', () => {
  it('groups the episodes sharing a Title key into one show tidy, named from the text before the tag', () => {
    const plan = tidyPlan(
      ROOT,
      mixed([
        episode('Breaking.Bad.S01E01.mp4', 1, 1, [
          'Breaking.Bad.S01E01.en.srt',
        ]),
        episode('breaking bad - S01E02.mp4', 1, 2),
      ]),
      nothingKept
    );

    expect(plan.tidies).toEqual([
      {
        id: 'breaking.bad.s01e01.mp4',
        kind: 'show',
        folder: 'Breaking Bad',
        videos: ['Breaking.Bad.S01E01.mp4', 'breaking bad - S01E02.mp4'],
        companions: ['Breaking.Bad.S01E01.en.srt'],
      },
    ]);
    expect(plan.kept).toEqual([]);
  });

  it('makes two shows of two Title keys', () => {
    const plan = tidyPlan(
      ROOT,
      mixed([
        episode('Breaking.Bad.S01E01.mp4', 1, 1),
        episode('Tidewater.S02E05.mp4', 2, 5),
        episode('Breaking.Bad.S01E02.mp4', 1, 2),
      ]),
      nothingKept
    );

    expect(plan.tidies.map((tidy) => [tidy.folder, tidy.videos])).toEqual([
      ['Breaking Bad', ['Breaking.Bad.S01E01.mp4', 'Breaking.Bad.S01E02.mp4']],
      ['Tidewater', ['Tidewater.S02E05.mp4']],
    ]);
  });

  it('drops release noise and a year from the show folder name', () => {
    const plan = tidyPlan(
      ROOT,
      mixed([episode('Tidewater.2018.S01E01.1080p.mp4', 1, 1)]),
      nothingKept
    );

    expect(plan.tidies.map((tidy) => tidy.folder)).toEqual(['Tidewater']);
  });

  it('makes the show folder name safe', () => {
    const plan = tidyPlan(
      ROOT,
      mixed([episode('AC/DC Tales S01E01.mp4', 1, 1)]),
      nothingKept
    );

    expect(plan.tidies.map((tidy) => tidy.folder)).toEqual([
      safeFilename('AC/DC Tales'),
    ]);
  });
});

describe('tidyPlan — untitled episodes', () => {
  it('keeps an episode with nothing before the tag where it is', () => {
    const plan = tidyPlan(
      ROOT,
      mixed([
        episode('S01E03.mp4', 1, 3, ['S01E03.en.srt']),
        episode('1x04.mp4', 1, 4),
        episode('Breaking.Bad.S01E01.mp4', 1, 1),
      ]),
      nothingKept
    );

    expect(plan.tidies.map((tidy) => tidy.videos)).toEqual([
      ['Breaking.Bad.S01E01.mp4'],
    ]);
    expect(plan.kept.flatMap((kept) => kept.files).sort()).toEqual(
      ['1x04.mp4', 'S01E03.en.srt', 'S01E03.mp4'].sort()
    );
    for (const kept of plan.kept) {
      expect(kept.folder).toBeUndefined();
    }
  });
});
