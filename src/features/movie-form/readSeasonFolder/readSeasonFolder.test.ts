import { describe, expect, it } from 'vitest';

import { readSeasonFolder } from './readSeasonFolder';
import {
  SEASON_FOLDER_CASES,
  type SeasonFolderCase,
} from '../../../../server/src/test-support/seasonFolderCases/seasonFolderCases';

/**
 * The **Season folder**'s name read on the client, the server's `seasonOf`
 * rule: `Season 01`, `Season 1` or `S01`, either case, and nothing else.
 */
describe('readSeasonFolder', () => {
  it.each([
    ['Season 01', 1],
    ['Season 1', 1],
    ['season 12', 12],
    ['Season02', 2],
    ['S01', 1],
    ['s3', 3],
    ['  Season 4  ', 4],
  ])('reads %s as season %s', (name, season) => {
    expect(readSeasonFolder(name)).toBe(season);
  });

  it.each(['Disc 2', 'Extras', 'Season', 'The Night Ferry 2', 'Series 2'])(
    'reads %s as no Season folder',
    (name) => {
      expect(readSeasonFolder(name)).toBeNull();
    }
  );
});

/**
 * 51 — Library audit (issue #447): the wider rule, one table shared with the
 * server's `seasonOf` and the drift guard. Each group is one rule, asserted
 * whole, so a group fails until every name in it reads right.
 */
describe('readSeasonFolder — the wider Season folder rule', () => {
  const readAll = (cases: readonly SeasonFolderCase[]) =>
    cases.map(([name]) => [name, readSeasonFolder(name)]);
  const expected = (cases: readonly SeasonFolderCase[]) =>
    cases.map(([name, season]) => [name, season]);

  it('reads every spelling, Season, Seizoen and S, in either case', () => {
    const cases = SEASON_FOLDER_CASES.spellings;
    expect(readAll(cases)).toEqual(expected(cases));
  });

  it('reads a spelling with trailing text, never the year as the number', () => {
    const cases = SEASON_FOLDER_CASES.trailing;
    expect(readAll(cases)).toEqual(expected(cases));
  });

  it('reads a release name holding a standalone S01', () => {
    const cases = SEASON_FOLDER_CASES.release;
    expect(readAll(cases)).toEqual(expected(cases));
  });

  it('refuses an episode tag such as S01E01', () => {
    const cases = SEASON_FOLDER_CASES.episodes;
    expect(readAll(cases)).toEqual(expected(cases));
  });

  it('reads Specials and Season 0 as season 0', () => {
    const cases = SEASON_FOLDER_CASES.specials;
    expect(readAll(cases)).toEqual(expected(cases));
  });

  it('reads a film folder as no Season folder', () => {
    const cases = SEASON_FOLDER_CASES.others;
    expect(readAll(cases)).toEqual(expected(cases));
  });
});
