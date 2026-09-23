// @vitest-environment node
//
// 22 — Series (TV), Phase 1: "a Season-folder show imports as one series"
// (issue #189).
//
// `groupShows`, pure over the scans the walk already answers: a **Source
// folder** named as a **Season folder** — `Season 01`, `Season 1`, `S01` —
// belongs to its parent, the **Show folder**, and every episode video in it is
// numbered: the season from the folder's name, the episode and the title from
// the **Episode tag**. Every other scan is a film and passes through exactly
// as it came, by identity and in order — which is what keeps the movie import
// untouched. `walkLibraryRoot` is not asked to change: the Season folder is
// the Source folder it already yields, because that is where the videos are.
//
// Table tests in the style of `matchRows`: a scan is built by name under a
// fixed root, and nothing touches the disk.

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { groupShows } from './groupShows';
import type { MovieFolderScan } from '../../media/scanMovieFolder/scanMovieFolder';

const ROOT = join('/', 'library');

/** A scan of the folder at `segments` under the root, holding `videos`. */
function scan(segments: string[], videos: string[]): MovieFolderScan {
  const dir = join(ROOT, ...segments);
  return {
    dir,
    name: segments[segments.length - 1],
    videos: videos.map((video) => join(dir, video)),
    poster: null,
    backdrop: null,
    subtitles: [],
  };
}

describe('groupShows — Season folders under their Show folder', () => {
  it.each([['Season 01'], ['Season 1'], ['S01']])(
    'reads %s as a Season folder and its parent as the show',
    (seasonName) => {
      const season = scan(
        ['Harbor & Vine (2021)', seasonName],
        ['Harbor.and.Vine.S01E01.Pilot.mp4']
      );

      const { shows, films } = groupShows([season]);

      expect(films).toEqual([]);
      expect(shows).toHaveLength(1);
      expect(shows[0]).toMatchObject({
        dir: join(ROOT, 'Harbor & Vine (2021)'),
        name: 'Harbor & Vine (2021)',
      });
    }
  );

  it('numbers every episode in the Season folder, with the title off its tag', () => {
    const season = scan(
      ['Harbor & Vine (2021)', 'Season 01'],
      [
        'Harbor.and.Vine.S01E01.Pilot.1080p.mp4',
        'Harbor.and.Vine.S01E02.The.Night.Market.1080p.mp4',
      ]
    );

    const [show] = groupShows([season]).shows;

    expect(show.episodes).toEqual([
      {
        season: 1,
        episode: 1,
        title: 'Pilot',
        video: season.videos[0],
      },
      {
        season: 1,
        episode: 2,
        title: 'The Night Market',
        video: season.videos[1],
      },
    ]);
  });

  it('puts two Season folders of one parent into one show, in season then episode order', () => {
    const second = scan(
      ['Harbor & Vine (2021)', 'Season 02'],
      ['Harbor.and.Vine.S02E02.Low.Tide.mp4', 'Harbor.and.Vine.S02E01.mp4']
    );
    const first = scan(
      ['Harbor & Vine (2021)', 'Season 01'],
      ['Harbor.and.Vine.S01E01.Pilot.mp4']
    );

    const { shows } = groupShows([second, first]);

    expect(shows).toHaveLength(1);
    expect(
      shows[0].episodes.map((episode) => [episode.season, episode.episode])
    ).toEqual([
      [1, 1],
      [2, 1],
      [2, 2],
    ]);
  });

  it('lets the Season folder’s number win over the tag’s', () => {
    const season = scan(
      ['Harbor & Vine (2021)', 'Season 03'],
      ['Harbor.and.Vine.S01E05.Misfiled.mp4']
    );

    const [show] = groupShows([season]).shows;

    expect(show.episodes[0]).toMatchObject({ season: 3, episode: 5 });
  });

  it('keeps two shows with Season folders of the same name apart', () => {
    const harbor = scan(
      ['Harbor & Vine (2021)', 'Season 01'],
      ['Harbor.and.Vine.S01E01.Pilot.mp4']
    );
    const keepers = scan(
      ['TV', 'Lighthouse Keepers', 'Season 01'],
      ['Lighthouse.Keepers.S01E01.First.Light.mp4']
    );

    const { shows } = groupShows([harbor, keepers]);

    expect(shows.map((show) => show.name)).toEqual([
      'Harbor & Vine (2021)',
      'Lighthouse Keepers',
    ]);
    expect(shows[1].dir).toBe(join(ROOT, 'TV', 'Lighthouse Keepers'));
  });
});

describe('groupShows — every other scan is a film', () => {
  it('passes a film through by identity', () => {
    const dieHard = scan(['Die.Hard.1988.1080p'], ['Die.Hard.1988.1080p.mp4']);

    const { shows, films } = groupShows([dieHard]);

    expect(shows).toEqual([]);
    expect(films).toHaveLength(1);
    expect(films[0]).toBe(dieHard);
  });

  it('passes the films through in the order they came, beside a show', () => {
    const dieHard = scan(['Die.Hard.1988.1080p'], ['Die.Hard.1988.1080p.mp4']);
    const season = scan(
      ['Harbor & Vine (2021)', 'Season 01'],
      ['Harbor.and.Vine.S01E01.Pilot.mp4']
    );
    const amelie = scan(['Drama', 'Amelie (2001)'], ['Amelie.mp4']);

    const { shows, films } = groupShows([dieHard, season, amelie]);

    expect(shows).toHaveLength(1);
    expect(films).toHaveLength(2);
    expect(films[0]).toBe(dieHard);
    expect(films[1]).toBe(amelie);
  });

  it.each([
    ['Seasons Greetings (1990)'],
    ['The Four Seasons (1981)'],
    ['S1m0ne (2002)'],
    ['Summer (2019)'],
  ])('reads %s as a film, not a Season folder', (name) => {
    const film = scan([name], ['film.mp4']);

    const { shows, films } = groupShows([film]);

    expect(shows).toEqual([]);
    expect(films).toEqual([film]);
  });

  it('answers nothing for no scans', () => {
    expect(groupShows([])).toEqual({ shows: [], films: [] });
  });
});
