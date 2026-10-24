// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { readEpisodeTag } from './readEpisodeTag';
import { readSeasonFolder } from '../readSeasonFolder/readSeasonFolder';
import { episodeTag } from '../../../../server/src/media/episodeTag/episodeTag';
import { seasonOf } from '../../../../server/src/import-export/groupShows/groupShows';
import { ALL_SEASON_FOLDER_CASES } from '../../../../server/src/test-support/seasonFolderCases/seasonFolderCases';

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

/**
 * 38 — Title editing, Phase 6 (issue #309): the **Episode word**'s cases. The
 * word is read only under a season the caller already knows, so each case is
 * a filename and the season passed with it — `undefined` where none is known,
 * which both readers must answer alike too.
 */
const SHARED_EPISODE_WORDS: readonly (readonly [string, number | undefined])[] =
  [
    ['Episode 12.mkv', 1],
    ['Ep 12.mkv', 1],
    ['Ep.12.mkv', 1],
    ['E12.mkv', 1],
    ['episode 12.mkv', 2],
    ['EP 12.mkv', 3],
    ['Episode 003.mkv', 1],
    ['Harbor.and.Vine.Episode.12.mkv', 1],
    ['Harbor and Vine - Ep 12.mkv', 1],
    ['Episode 12 - The Storm.1080p.mkv', 1],
    ['Harbor.and.Vine.S01E03.mkv', 2],
    ['Epic.mkv', 1],
    ['Eden.mkv', 1],
    ['Season 01.mp4', 1],
    ['Episode 12.mkv', undefined],
    ['Ep 12.mkv', undefined],
    ['Ep.12.mkv', undefined],
    ['E12.mkv', undefined],
  ];

/**
 * 38 — Title editing (issue #311): the **Season folder**'s cases. The server's
 * `seasonOf` groups a scan into shows; the client's `readSeasonFolder` seeds
 * the **Numbering guess** off the same folder name.
 */
const SHARED_SEASON_FOLDERS: readonly string[] = [
  'Season 01',
  'Season 1',
  'season 12',
  'Season02',
  'S01',
  's3',
  'Season 00',
  '  Season 4  ',
  'Disc 2',
  'Extras',
  'Season',
  'Series 2',
  'The Night Ferry 2',
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

  it.each(SHARED_EPISODE_WORDS.map(([name, season]) => [name, season]))(
    '%s under season %s',
    (filename, season) => {
      const server = episodeTag(filename, season);
      const client = readEpisodeTag(filename, season);

      expect(client).toEqual(
        server === null
          ? null
          : {
              season: server.season,
              number: server.episode,
              title: server.title,
            }
      );
    }
  );

  it('numbers the word where the season is known, so agreement is not two nulls', () => {
    expect(episodeTag('Ep 12.mkv', 1)).toMatchObject({
      season: 1,
      episode: 12,
    });
    expect(readEpisodeTag('Ep 12.mkv', 1)).toMatchObject({
      season: 1,
      number: 12,
    });
  });
});

describe('the Season folder — client and server agree', () => {
  it.each(SHARED_SEASON_FOLDERS.map((name) => [name]))('%s', (name) => {
    expect(readSeasonFolder(name)).toBe(seasonOf(name));
  });

  /**
   * 51 — Library audit (issue #447): the wider rule's one table, the same
   * the two units' table tests read. Agreement is asserted on the table's own
   * answer too, so two readings both wrong the same way still fail.
   */
  it.each(ALL_SEASON_FOLDER_CASES.map(([name, season]) => [name, season]))(
    '%s reads as season %s on both sides',
    (name, season) => {
      expect({
        server: seasonOf(name),
        client: readSeasonFolder(name),
      }).toEqual({ server: season, client: season });
    }
  );
});
