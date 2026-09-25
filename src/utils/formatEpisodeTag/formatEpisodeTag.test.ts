import { describe, expect, it } from 'vitest';

import { formatEpisodeTag } from './formatEpisodeTag';

describe('formatEpisodeTag', () => {
  it('spells a season and a number as S02E04', () => {
    expect(formatEpisodeTag({ season: 2, number: 4 })).toBe('S02E04');
  });

  it('spells a season alone as S02', () => {
    expect(formatEpisodeTag({ season: 2 })).toBe('S02');
  });

  it('spells a number alone as E04', () => {
    expect(formatEpisodeTag({ number: 4 })).toBe('E04');
  });

  it('keeps two-digit numbers as they are', () => {
    expect(formatEpisodeTag({ season: 12, number: 24 })).toBe('S12E24');
  });

  it('keeps a number past two digits whole', () => {
    expect(formatEpisodeTag({ season: 1, number: 120 })).toBe('S01E120');
  });

  it('takes an episode whole, reading only its season and number', () => {
    const episode = { id: 'e1', season: 3, number: 7, title: 'Low Tide' };

    expect(formatEpisodeTag(episode)).toBe('S03E07');
  });

  it('spells nothing for no parts', () => {
    expect(formatEpisodeTag({})).toBe('');
  });
});
