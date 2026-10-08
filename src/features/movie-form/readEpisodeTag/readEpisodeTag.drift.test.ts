// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { readEpisodeTag } from './readEpisodeTag';
import { episodeTag } from '../../../../server/src/media/episodeTag/episodeTag';

/**
 * 29 — Add a series, Phase 3 (issue #263): the drift guard.
 *
 * The **Episode tag** is read on two sides — the server's `episodeTag`, which
 * the importer and the series route read, and the client's `readEpisodeTag`,
 * which orders and prefills a pick before anything is sent. They stay two
 * functions, so this one table is what holds them together: every name in it
 * is read by both, and both must say the same thing about it.
 */
const SHARED_FILENAMES: readonly string[] = [
  'Harbor.and.Vine.S01E03.The.Night.Market.mp4',
  'Harbor.and.Vine.S12E24.Finale.mkv',
  'harbor.and.vine.s02e10.the.storm.mkv',
  'harbor.and.vine.s1e3.the.storm.mkv',
  'Harbor.and.Vine.s01E05.mkv',
  'Harbor.and.Vine.S01E01E02.Two.Part.Pilot.mkv',
  'Harbor.and.Vine.S01E01-E02.mkv',
  'Harbor and Vine 1x03 The Night Market.avi',
  'Harbor.and.Vine.2X07.Low.Tide.mkv',
  'Harbor_and_Vine_S01E02_Opening_Night.mkv',
  'Harbor.and.Vine.S01E01.Pilot.1080p.mp4',
  'Harbor.and.Vine.S01E01.Pilot.BluRay.1080p.mkv',
  'Harbor.and.Vine.S01E01.Pilot.HDTV.x264.avi',
  'Harbor_and_Vine_S01E01_Pilot_1080p_x264.mkv',
  'Harbor.and.Vine.S01E04.mkv',
  'Harbor.and.Vine.S01E04.1080p.x264.mkv',
  'Harbor.and.Vine.S01E120.mkv',
  'S01E03.mkv',
  '1x03.mp4',
  'Die.Hard.1988.1080p.mp4',
  'Amelie.mp4',
  'Amelie (2001).mkv',
  'Blade Runner 2049.mkv',
  'The.Matrix.1999.1080p.BluRay.x264.mkv',
  'Season 01.mp4',
];

describe('the Episode tag — client and server agree', () => {
  it.each(SHARED_FILENAMES.map((name) => [name]))('%s', (filename) => {
    const server = episodeTag(filename);
    const client = readEpisodeTag(filename);

    expect(client).toEqual(
      server === null
        ? null
        : { season: server.season, number: server.episode, title: server.title }
    );
  });
});
