import { describe, it, expect } from 'vitest';

import { numberFoundRows } from './formValues';

/**
 * 48 — Add a show folder, Phase 4 (issue #420): `numberFoundRows`, the
 * **Numbering guess** lifted out of `seriesResolveRows` so the **Series
 * Resolve** and the **Show folder pick** number found videos by one rule.
 *
 * Given found videos in name order, the folder they were found under and the
 * `(season, number)` pairs already taken, it answers each video's guess: the
 * season from the folder (a **Season folder**'s number, season 1 at the
 * **Show folder**'s root or under any other folder), the episode from the
 * **Episode word**, else the next free number in that season. A pair taken
 * already — a held series's, or a numbered row's — is never guessed, so the
 * pick's Unplaced rows continue after its numbered ones.
 *
 * These are the Series Resolve's own numbering cases
 * (`MovieForm.seriesResolve.test.tsx`), asked of the extracted rule directly.
 */

const SHOW = 'E:\\Series\\The Night Ferry';

const DEPARTURE = `${SHOW}\\Season 2\\eps2.0_departure.mov`;
const FOG_HORN = `${SHOW}\\Season 2\\eps2.1_fog_horn.mov`;
const PURSER = `${SHOW}\\Season 2\\the_purser Episode 2.mov`;
const LANDFALL = `${SHOW}\\landfall.mov`;

/** The guesses as `[path, season, number]`. */
const numbered = (
  videos: string[],
  taken: { season: number; number: number }[] = []
) =>
  numberFoundRows(videos, SHOW, taken).map((guess) => [
    guess.path,
    guess.season,
    guess.number,
  ]);

describe('numberFoundRows — the Series Resolve’s cases', () => {
  it('takes the folder’s season, the Episode word, else the next free number', () => {
    expect(numbered([DEPARTURE, FOG_HORN, PURSER, LANDFALL])).toEqual([
      // Season 2's folder; no word, so the first free number.
      [DEPARTURE, 2, 1],
      // No word either; 2 is the purser's by its word, so 3.
      [FOG_HORN, 2, 3],
      // `Episode 2`, the Episode word, under the folder's season.
      [PURSER, 2, 2],
      // At the Show folder's root: season 1, its first free number.
      [LANDFALL, 1, 1],
    ]);
  });

  it('guesses season 1 under a folder that is not a Season folder', () => {
    const disc = `${SHOW}\\Disc 2\\the_boarding.mov`;

    expect(numbered([disc])).toEqual([[disc, 1, 1]]);
  });

  it('guesses season 0 under a Season 0 folder', () => {
    const special = `${SHOW}\\Season 0\\christmas_special.mov`;

    expect(numbered([special])).toEqual([[special, 0, 1]]);
  });

  it('numbers after the pairs a held series takes', () => {
    const bonusA = `${SHOW}\\Season 1\\bonus_a.mov`;
    const bonusB = `${SHOW}\\Season 1\\bonus_b.mov`;

    expect(
      numbered(
        [bonusA, bonusB],
        [
          { season: 1, number: 1 },
          { season: 1, number: 2 },
        ]
      )
    ).toEqual([
      [bonusA, 1, 3],
      [bonusB, 1, 4],
    ]);
  });

  it('leaves a taken Episode word to the next free number', () => {
    const second = `${SHOW}\\the_crossing Episode 2.mov`;

    expect(numbered([second], [{ season: 1, number: 2 }])).toEqual([
      [second, 1, 1],
    ]);
  });
});

describe('numberFoundRows — continuing after numbered rows', () => {
  it('numbers Unplaced videos after the episodes a Show folder read numbered', () => {
    const bonus = `${SHOW}\\Season 1\\bonus.mov`;
    const loose = `${SHOW}\\loose.mov`;
    const finale = `${SHOW}\\Season 2\\finale.mov`;

    expect(
      numbered(
        [bonus, loose, finale],
        [
          { season: 1, number: 1 },
          { season: 1, number: 2 },
          { season: 2, number: 1 },
        ]
      )
    ).toEqual([
      [bonus, 1, 3],
      [loose, 1, 4],
      [finale, 2, 2],
    ]);
  });

  it('answers the Episode word’s title, and none without one', () => {
    const tagged = `${SHOW}\\Season 1\\The.Night.Ferry.S01E05.Fog.mkv`;
    const untagged = `${SHOW}\\Season 1\\bonus.mov`;

    const [fog, bonus] = numberFoundRows([tagged, untagged], SHOW, []);

    expect(fog).toMatchObject({ season: 1, number: 5, title: 'Fog' });
    expect(bonus.title).toBeNull();
  });
});
