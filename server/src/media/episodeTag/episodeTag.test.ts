// @vitest-environment node
//
// 22 — Series (TV), Phase 1: "a Season-folder show imports as one series"
// (issue #189).
//
// The **Episode tag**, pure: a filename in, `{ season, episode, title }` out,
// or `null` for a name that carries no tag. Two shapes are read — `S01E03`
// and `1x03` — in either case. The title is whatever follows the tag, with
// dots and underscores read as spaces and the quality tags a release name
// carries (`1080p`, `x264`, `BluRay`, …) dropped; nothing left is `null`.
// A film's name — a year, a resolution — is not a tag.
//
// Beside `fileKinds` in the media domain, because what a file is called is
// the scanner's line, and prior art is that suite's table style.

import { describe, expect, it } from 'vitest';

import { episodeTag } from './episodeTag';

describe('episodeTag — the S01E03 shape', () => {
  it('reads the season and the episode', () => {
    expect(
      episodeTag('Harbor.and.Vine.S01E03.The.Night.Market.mp4')
    ).toMatchObject({ season: 1, episode: 3 });
  });

  it('reads two-digit numbers', () => {
    expect(episodeTag('Harbor.and.Vine.S12E24.Finale.mkv')).toMatchObject({
      season: 12,
      episode: 24,
    });
  });

  it('reads the tag in lower case', () => {
    expect(episodeTag('harbor.and.vine.s02e10.the.storm.mkv')).toMatchObject({
      season: 2,
      episode: 10,
    });
  });

  it('reads the tag in mixed case', () => {
    expect(episodeTag('Harbor.and.Vine.s01E05.mkv')).toMatchObject({
      season: 1,
      episode: 5,
    });
  });
});

describe('episodeTag — the 1x03 shape', () => {
  it('reads the season and the episode', () => {
    expect(episodeTag('Harbor and Vine 1x03 The Night Market.avi')).toEqual({
      season: 1,
      episode: 3,
      title: 'The Night Market',
    });
  });

  it('reads the tag with an upper-case X', () => {
    expect(episodeTag('Harbor.and.Vine.2X07.Low.Tide.mkv')).toMatchObject({
      season: 2,
      episode: 7,
    });
  });
});

describe('episodeTag — the title after the tag', () => {
  it('reads dots as spaces', () => {
    expect(episodeTag('Harbor.and.Vine.S01E03.The.Night.Market.mp4')).toEqual({
      season: 1,
      episode: 3,
      title: 'The Night Market',
    });
  });

  it('reads underscores as spaces', () => {
    expect(episodeTag('Harbor_and_Vine_S01E02_Opening_Night.mkv')).toEqual({
      season: 1,
      episode: 2,
      title: 'Opening Night',
    });
  });

  it('never carries the extension into the title', () => {
    expect(episodeTag('Harbor.and.Vine.S01E01.Pilot.mp4')?.title).toBe('Pilot');
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
    expect(episodeTag(filename)?.title).toBe('Pilot');
  });

  it('answers a null title when nothing follows the tag', () => {
    expect(episodeTag('Harbor.and.Vine.S01E04.mkv')).toEqual({
      season: 1,
      episode: 4,
      title: null,
    });
  });

  it('answers a null title when only quality tags follow the tag', () => {
    expect(episodeTag('Harbor.and.Vine.S01E04.1080p.x264.mkv')).toEqual({
      season: 1,
      episode: 4,
      title: null,
    });
  });
});

describe('episodeTag — a name with no tag', () => {
  it.each([
    ['Die.Hard.1988.1080p.mp4'],
    ['Amelie.mp4'],
    ['Amelie (2001).mkv'],
    ['Blade Runner 2049.mkv'],
    ['The.Matrix.1999.1080p.BluRay.x264.mkv'],
    ['Season 01.mp4'],
  ])('answers null for %s', (filename) => {
    expect(episodeTag(filename)).toBeNull();
  });
});
