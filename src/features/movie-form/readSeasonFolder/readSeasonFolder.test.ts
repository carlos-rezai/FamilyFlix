import { describe, expect, it } from 'vitest';

import { readSeasonFolder } from './readSeasonFolder';
import {
  SEASON_FOLDER_CASES,
  type SeasonFolderCase,
} from '../../../../server/src/test-support/seasonFolderCases/seasonFolderCases';

/**
 * 58, Folder layout (issue #537): the **Season folder**'s name read on the
 * client, the server's `seasonOf` rule: `Season NN`, two digits or more, in
 * either case, and nothing else. One table shared with the drift guard; each
 * group is one rule, asserted whole, so a group fails until every name in it
 * reads right.
 */
describe('readSeasonFolder: Season NN only', () => {
  const readAll = (cases: readonly SeasonFolderCase[]) =>
    cases.map(([name]) => [name, readSeasonFolder(name)]);
  const expected = (cases: readonly SeasonFolderCase[]) =>
    cases.map(([name, season]) => [name, season]);

  it('reads Season NN, two digits or more, in either case', () => {
    const cases = SEASON_FOLDER_CASES.layout;
    expect(readAll(cases)).toEqual(expected(cases));
  });

  it('reads Season 00 as season 0', () => {
    const cases = SEASON_FOLDER_CASES.specials;
    expect(readAll(cases)).toEqual(expected(cases));
  });

  it('reads no wider spelling: Season 1, Seizoen, S01, Specials', () => {
    const cases = SEASON_FOLDER_CASES.wider;
    expect(readAll(cases)).toEqual(expected(cases));
  });

  it('reads no spelling followed by trailing text', () => {
    const cases = SEASON_FOLDER_CASES.trailing;
    expect(readAll(cases)).toEqual(expected(cases));
  });

  it('reads no release name holding a standalone S01', () => {
    const cases = SEASON_FOLDER_CASES.release;
    expect(readAll(cases)).toEqual(expected(cases));
  });

  it('refuses an episode tag such as S01E01', () => {
    const cases = SEASON_FOLDER_CASES.episodes;
    expect(readAll(cases)).toEqual(expected(cases));
  });

  it('reads a Title folder or any other name as no Season folder', () => {
    const cases = SEASON_FOLDER_CASES.others;
    expect(readAll(cases)).toEqual(expected(cases));
  });
});
