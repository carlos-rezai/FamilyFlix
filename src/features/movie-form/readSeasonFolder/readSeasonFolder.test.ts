import { describe, expect, it } from 'vitest';

import { readSeasonFolder } from './readSeasonFolder';

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
