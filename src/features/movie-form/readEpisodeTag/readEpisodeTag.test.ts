import { describe, expect, it } from 'vitest';

import { readEpisodeTag } from './readEpisodeTag';

/**
 * 29 — Add a series, Phase 3 (issue #263): the **Episode tag** read on the
 * client.
 *
 * The browser's mirror of the server's `episodeTag`, so a pick of episode
 * files can be put in order and prefilled before anything is sent: a filename
 * in, `{ season, number, title }` out, or `null` for a name that carries no
 * tag. The cases are `episodeTag`'s own suite's, case for case; that the two
 * functions agree is the drift guard's business, beside this file.
 */

describe('readEpisodeTag — the S01E03 shape', () => {
  it('reads the season and the number', () => {
    expect(
      readEpisodeTag('Harbor.and.Vine.S01E03.The.Night.Market.mp4')
    ).toMatchObject({ season: 1, number: 3 });
  });

  it('reads two-digit numbers', () => {
    expect(readEpisodeTag('Harbor.and.Vine.S12E24.Finale.mkv')).toMatchObject({
      season: 12,
      number: 24,
    });
  });

  it('reads the tag in lower case, unpadded', () => {
    expect(readEpisodeTag('harbor.and.vine.s1e3.the.storm.mkv')).toMatchObject({
      season: 1,
      number: 3,
    });
  });

  it('reads the tag in mixed case', () => {
    expect(readEpisodeTag('Harbor.and.Vine.s01E05.mkv')).toMatchObject({
      season: 1,
      number: 5,
    });
  });

  it('reads a multi-episode file by its first number', () => {
    expect(
      readEpisodeTag('Harbor.and.Vine.S01E01E02.Two.Part.Pilot.mkv')
    ).toEqual({ season: 1, number: 1, title: 'Two Part Pilot' });
  });
});

describe('readEpisodeTag — the 1x03 shape', () => {
  it('reads the season and the number', () => {
    expect(readEpisodeTag('Harbor and Vine 1x03 The Night Market.avi')).toEqual(
      { season: 1, number: 3, title: 'The Night Market' }
    );
  });

  it('reads the tag with an upper-case X', () => {
    expect(readEpisodeTag('Harbor.and.Vine.2X07.Low.Tide.mkv')).toMatchObject({
      season: 2,
      number: 7,
    });
  });
});

describe('readEpisodeTag — the title after the tag', () => {
  it('reads dots as spaces', () => {
    expect(
      readEpisodeTag('Harbor.and.Vine.S01E03.The.Night.Market.mp4')
    ).toEqual({ season: 1, number: 3, title: 'The Night Market' });
  });

  it('reads underscores as spaces', () => {
    expect(readEpisodeTag('Harbor_and_Vine_S01E02_Opening_Night.mkv')).toEqual({
      season: 1,
      number: 2,
      title: 'Opening Night',
    });
  });

  it('never carries the extension into the title', () => {
    expect(readEpisodeTag('Harbor.and.Vine.S01E01.Pilot.mp4')?.title).toBe(
      'Pilot'
    );
  });

  it.each([
    ['Harbor.and.Vine.S01E01.Pilot.1080p.mp4'],
    ['Harbor.and.Vine.S01E01.Pilot.720p.mkv'],
    ['Harbor.and.Vine.S01E01.Pilot.2160p.mkv'],
    ['Harbor.and.Vine.S01E01.Pilot.1080p.x264.mkv'],
    ['Harbor.and.Vine.S01E01.Pilot.x265.mkv'],
    ['Harbor.and.Vine.S01E01.Pilot.HEVC.mkv'],
    ['Harbor.and.Vine.S01E01.Pilot.BluRay.1080p.mkv'],
    ['Harbor.and.Vine.S01E01.Pilot.WEBRip.mkv'],
    ['Harbor.and.Vine.S01E01.Pilot.HDTV.x264.avi'],
    ['Harbor_and_Vine_S01E01_Pilot_1080p_x264.mkv'],
  ])('drops the quality tags from %s', (filename) => {
    expect(readEpisodeTag(filename)?.title).toBe('Pilot');
  });

  it('answers a null title when nothing follows the tag', () => {
    expect(readEpisodeTag('Harbor.and.Vine.S01E04.mkv')).toEqual({
      season: 1,
      number: 4,
      title: null,
    });
  });

  it('answers a null title when only quality tags follow the tag', () => {
    expect(readEpisodeTag('Harbor.and.Vine.S01E04.1080p.x264.mkv')).toEqual({
      season: 1,
      number: 4,
      title: null,
    });
  });
});

describe('readEpisodeTag — a name with no tag', () => {
  it.each([
    ['Die.Hard.1988.1080p.mp4'],
    ['Amelie.mp4'],
    ['Amelie (2001).mkv'],
    ['Blade Runner 2049.mkv'],
    ['The.Matrix.1999.1080p.BluRay.x264.mkv'],
    ['Season 01.mp4'],
  ])('answers null for %s', (filename) => {
    expect(readEpisodeTag(filename)).toBeNull();
  });
});
