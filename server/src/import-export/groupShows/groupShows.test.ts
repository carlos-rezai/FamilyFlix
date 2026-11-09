// @vitest-environment node
//
// 22 — Series (TV), Phase 1: "a Season-folder show imports as one series"
// (issue #189); narrowed by 58, Folder layout, Phase 3: "one series in the
// layout" (issue #536).
//
// `groupShows`, pure over the scans the walk already answers: a scan named as
// a **Season folder**, `Season NN` and nothing else, belongs to its parent,
// the series' **Title folder**, and every episode video in it is numbered: the
// season from the folder's name, the episode and the title from the **Episode
// tag**. Every other scan is a film and passes through exactly as it came, by
// identity and in order. The loose-show branch is retired: a folder of loose
// tagged videos is no show. Each episode takes the tracks of its own
// `Subtitles/S01E01/` folder.
//
// Table tests in the style of `matchRows`: a scan is built by name under a
// fixed root, and nothing touches the disk.

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { groupShows, showFolderOf } from './groupShows';
import { detectSubtitleLanguage } from '../../media/detectSubtitleLanguage/detectSubtitleLanguage';
import type { FilmScan } from '../../media/readTitleFolder/readTitleFolder';
import { seasonNumberOf } from '../../media/seasonNumberOf/seasonNumberOf';

const ROOT = join('/', 'library');

/**
 * A scan of the folder at `segments` under the root, holding `videos` and
 * `subtitles` at paths relative to it, each subtitle with the language its
 * name says, as the real scan reads it.
 */
function scan(
  segments: string[],
  videos: string[],
  subtitles: string[] = []
): FilmScan {
  const dir = join(ROOT, ...segments);
  return {
    dir,
    name: segments[segments.length - 1],
    videos: videos.map((video) => join(dir, video)),
    poster: null,
    backdrop: null,
    subtitles: subtitles.map((file) => ({
      path: join(dir, file),
      language: detectSubtitleLanguage(file),
    })),
  };
}

describe('groupShows — Season folders under their Title folder', () => {
  it.each([['Season 01'], ['season 01'], ['SEASON 01']])(
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
        subtitles: [],
      },
      {
        season: 1,
        episode: 2,
        title: 'The Night Market',
        video: season.videos[1],
        subtitles: [],
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

  it('numbers a Season 00 folder’s episodes in season 0, the specials', () => {
    const specials = scan(
      ['Harbor & Vine (2021)', 'Season 00'],
      ['Harbor.and.Vine.S00E01.Christmas.mkv']
    );

    const { shows, films } = groupShows([specials]);

    expect(films).toEqual([]);
    expect(shows[0]).toMatchObject({
      name: 'Harbor & Vine (2021)',
      episodes: [{ season: 0, episode: 1, title: 'Christmas' }],
    });
  });

  it('lets the Season folder’s number win over the tag’s', () => {
    const season = scan(
      ['Harbor & Vine (2021)', 'Season 03'],
      ['Harbor.and.Vine.S01E05.Misfiled.mp4']
    );

    const [show] = groupShows([season]).shows;

    expect(show.episodes[0]).toMatchObject({ season: 3, episode: 5 });
  });

  it('gives a multi-episode file its first number, under the folder’s season', () => {
    const season = scan(
      ['Harbor & Vine (2021)', 'Season 02'],
      ['Harbor.and.Vine.S01E05E06.Double.Shift.mp4']
    );

    const [show] = groupShows([season]).shows;

    expect(show.episodes[0]).toMatchObject({ season: 2, episode: 5 });
  });

  it('keeps two shows with Season folders of the same name apart', () => {
    const harbor = scan(
      ['Harbor & Vine (2021)', 'Season 01'],
      ['Harbor.and.Vine.S01E01.Pilot.mp4']
    );
    const keepers = scan(
      ['Lighthouse Keepers (2019)', 'Season 01'],
      ['Lighthouse.Keepers.S01E01.First.Light.mp4']
    );

    const { shows } = groupShows([harbor, keepers]);

    expect(shows.map((show) => show.name)).toEqual([
      'Harbor & Vine (2021)',
      'Lighthouse Keepers (2019)',
    ]);
    expect(shows[1].dir).toBe(join(ROOT, 'Lighthouse Keepers (2019)'));
  });
});

describe('groupShows — only Season NN is a Season folder', () => {
  it.each([
    ['Season 1'],
    ['Seizoen 1'],
    ['Seizoen 01'],
    ['S01'],
    ['Specials'],
    ['Season 01 (2008)'],
    ['Release.Show.S01.1080p.WEB-DL'],
  ])('passes a scan named %s through as a film, not a show', (name) => {
    const folder = scan(
      ['Harbor & Vine (2021)', name],
      ['Harbor.and.Vine.S01E01.Pilot.mp4']
    );

    const { shows, films } = groupShows([folder]);

    expect(shows).toEqual([]);
    expect(films).toEqual([folder]);
  });
});

describe('groupShows — every other scan is a film', () => {
  it('passes a film through by identity', () => {
    const dieHard = scan(['Die Hard (1988)'], ['Die.Hard.1988.1080p.mp4']);

    const { shows, films } = groupShows([dieHard]);

    expect(shows).toEqual([]);
    expect(films).toHaveLength(1);
    expect(films[0]).toBe(dieHard);
  });

  it('passes the films through in the order they came, beside a show', () => {
    const dieHard = scan(['Die Hard (1988)'], ['Die.Hard.1988.1080p.mp4']);
    const season = scan(
      ['Harbor & Vine (2021)', 'Season 01'],
      ['Harbor.and.Vine.S01E01.Pilot.mp4']
    );
    const amelie = scan(['Amelie (2001)'], ['Amelie.mp4']);

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
    ['E12 (2014)'],
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

/**
 * The loose-show branch, retired: a Title folder whose own videos carry an
 * **Episode tag** is no show. It passes through as a film, its second video
 * the film's _more than one video_ Problem, never a series.
 */
describe('groupShows — loose tagged videos are no show', () => {
  it('passes a folder of loose tagged videos through as a film', () => {
    const loose = scan(
      ['Lighthouse Keepers (2019)'],
      [
        'Lighthouse.Keepers.S01E01.First.Light.mp4',
        'Lighthouse.Keepers.S01E02.The.Storm.mp4',
      ]
    );

    const { shows, films } = groupShows([loose]);

    expect(shows).toEqual([]);
    expect(films).toEqual([loose]);
  });

  it('passes a loose tagged video through as a film beside a Season-folder show', () => {
    const loose = scan(
      ['Lighthouse Keepers (2019)'],
      ['Lighthouse.Keepers.S01E01.First.Light.mp4']
    );
    const season = scan(
      ['Harbor & Vine (2021)', 'Season 01'],
      ['Harbor.and.Vine.S01E01.Pilot.mp4']
    );

    const { shows, films } = groupShows([loose, season]);

    expect(shows.map((show) => show.name)).toEqual(['Harbor & Vine (2021)']);
    expect(films).toEqual([loose]);
  });
});

/**
 * Each episode's tracks lie in its own `Subtitles/S01E01/` folder inside the
 * Season folder: a track lands on the episode its folder's tag numbers, and a
 * track whose folder numbers no placed episode is a stray.
 */
describe('groupShows — episode tracks by their S01E01 folder', () => {
  it('gives each episode the tracks of its own tag folder, each with its language', () => {
    const season = scan(
      ['Harbor & Vine (2021)', 'Season 01'],
      ['Harbor.and.Vine.S01E01.Pilot.mp4', 'Harbor.and.Vine.S01E02.mp4'],
      [
        join('Subtitles', 'S01E01', 'anything.en.srt'),
        join('Subtitles', 'S01E01', 'anything.pt.srt'),
        join('Subtitles', 'S01E02', 'other name.srt'),
      ]
    );

    const [show] = groupShows([season]).shows;

    const tracks = join(season.dir, 'Subtitles');
    expect(show.episodes[0].subtitles).toEqual([
      { path: join(tracks, 'S01E01', 'anything.en.srt'), language: 'English' },
      {
        path: join(tracks, 'S01E01', 'anything.pt.srt'),
        language: 'Portuguese',
      },
    ]);
    expect(show.episodes[1].subtitles).toEqual([
      { path: join(tracks, 'S01E02', 'other name.srt'), language: 'English' },
    ]);
    expect(show.straySubtitles).toEqual([]);
  });

  it('lands tracks on the right season when two Season folders share a tag number', () => {
    const first = scan(
      ['Harbor & Vine (2021)', 'Season 01'],
      ['Harbor.and.Vine.S01E01.mp4'],
      [join('Subtitles', 'S01E01', 'one.en.srt')]
    );
    const second = scan(
      ['Harbor & Vine (2021)', 'Season 02'],
      ['Harbor.and.Vine.S02E01.mp4'],
      [join('Subtitles', 'S02E01', 'two.en.srt')]
    );

    const [show] = groupShows([first, second]).shows;

    expect(
      show.episodes.map((episode) => [
        episode.season,
        episode.subtitles.map((track) => track.path),
      ])
    ).toEqual([
      [1, [join(first.dir, 'Subtitles', 'S01E01', 'one.en.srt')]],
      [2, [join(second.dir, 'Subtitles', 'S02E01', 'two.en.srt')]],
    ]);
  });

  it('lists a track whose folder numbers no placed episode as a stray', () => {
    const season = scan(
      ['Harbor & Vine (2021)', 'Season 01'],
      ['Harbor.and.Vine.S01E01.Pilot.mp4'],
      [join('Subtitles', 'S01E09', 'lost.en.srt')]
    );

    const [show] = groupShows([season]).shows;

    expect(show.episodes[0].subtitles).toEqual([]);
    expect(show.straySubtitles).toEqual([
      join(season.dir, 'Subtitles', 'S01E09', 'lost.en.srt'),
    ]);
  });
});

describe('groupShows — unplaced videos', () => {
  it('lists a video with no tag in a Season folder as unplaced, not as an episode', () => {
    const season = scan(
      ['Harbor & Vine (2021)', 'Season 01'],
      ['Harbor.and.Vine.S01E01.Pilot.mp4', 'Behind the Scenes.mp4']
    );

    const [show] = groupShows([season]).shows;

    expect(show.episodes.map((episode) => episode.video)).toEqual([
      season.videos[0],
    ]);
    expect(show.unplaced).toEqual([season.videos[1]]);
  });

  it('places the first file to claim a number and lists the second as unplaced', () => {
    const season = scan(
      ['Harbor & Vine (2021)', 'Season 01'],
      ['Harbor.and.Vine.S01E02.Storm.Copy.mp4', 'Harbor.and.Vine.S01E02.mp4']
    );

    const [show] = groupShows([season]).shows;

    expect(show.episodes.map((episode) => episode.video)).toEqual([
      season.videos[0],
    ]);
    expect(show.unplaced).toEqual([season.videos[1]]);
  });

  it('counts a number as taken where the folder decides the season', () => {
    const season = scan(
      ['Harbor & Vine (2021)', 'Season 01'],
      [
        'Harbor.and.Vine.S01E01.Pilot.mp4',
        'Harbor.and.Vine.S03E01.Pilot.Again.mp4',
      ]
    );

    const [show] = groupShows([season]).shows;

    expect(show.episodes.map((episode) => episode.video)).toEqual([
      season.videos[0],
    ]);
    expect(show.unplaced).toEqual([season.videos[1]]);
  });

  it('keeps a show whose every video is unplaced, with no episodes', () => {
    const season = scan(
      ['Harbor & Vine (2021)', 'Season 01'],
      ['Opening Night.mp4', 'The Long Goodbye.mp4']
    );

    const { shows, films } = groupShows([season]);

    expect(films).toEqual([]);
    expect(shows).toHaveLength(1);
    expect(shows[0].episodes).toEqual([]);
    expect(shows[0].unplaced).toEqual(season.videos);
  });

  it('lists nothing unplaced for a show whose every video has its number', () => {
    const season = scan(
      ['Harbor & Vine (2021)', 'Season 01'],
      ['Harbor.and.Vine.S01E01.Pilot.mp4']
    );

    const [show] = groupShows([season]).shows;

    expect(show.unplaced).toEqual([]);
  });
});

// 38 — Title editing, Phase 6: "the Episode word" (issue #309), and 51,
// Library audit, Phase 5 (issue #448): the Dutch word.
//
// The **Episode word** — `Episode 12`, `Ep 12`, `Ep.12`, `E12`, `Aflevering
// 12`, `Afl. 12` — numbers a video inside a **Season folder**, under the
// folder's season.

describe('groupShows — the Episode word', () => {
  it.each([
    ['Episode 12.mkv'],
    ['Ep 12.mkv'],
    ['Ep.12.mkv'],
    ['E12.mkv'],
    ['Aflevering 12.mkv'],
    ['Afl. 12.mkv'],
  ])('numbers %s inside a Season folder, under the folder’s season', (file) => {
    const season = scan(['Harbor & Vine (2021)', 'Season 02'], [file]);

    const [show] = groupShows([season]).shows;

    expect(show.episodes).toMatchObject([
      { season: 2, episode: 12, video: season.videos[0] },
    ]);
    expect(show.unplaced).toEqual([]);
  });

  it('reads the title after the word', () => {
    const season = scan(
      ['Harbor & Vine (2021)', 'Season 01'],
      ['Episode 03 - The Night Market.mkv']
    );

    const [show] = groupShows([season]).shows;

    expect(show.episodes[0]).toMatchObject({
      season: 1,
      episode: 3,
      title: 'The Night Market',
    });
  });

  it('never groups a folder of Episode-word files alone as a show', () => {
    const folder = scan(
      ['Lighthouse Keepers (2019)'],
      ['Episode 01.mkv', 'Episode 02.mkv']
    );

    const { shows, films } = groupShows([folder]);

    expect(shows).toEqual([]);
    expect(films).toEqual([folder]);
  });
});

/**
 * 58, Folder layout (issue #536): `seasonNumberOf`, the reading a group
 * reads, takes `Season NN` only, two digits or more, case folded, `Season 00`
 * the specials. The wider rule of log 51 is retired.
 */
describe('seasonNumberOf: Season NN only', () => {
  it.each([
    ['Season 01', 1],
    ['season 01', 1],
    ['SEASON 02', 2],
    ['Season 12', 12],
    ['Season 100', 100],
    ['Season 00', 0],
    ['season 00', 0],
  ])('reads %s as season %s', (name, season) => {
    expect(seasonNumberOf(name)).toBe(season);
  });

  it.each([
    ['Season 1'],
    ['Season 0'],
    ['Season01'],
    ['Seizoen 1'],
    ['Seizoen 01'],
    ['S01'],
    ['s01'],
    ['Specials'],
    ['Season 01 (2008)'],
    ['Season 02 - The Return'],
    ['Release.Show.S01.1080p.WEB-DL'],
    ['S01E01'],
    ['Seasons of Love (2005)'],
    ['Season'],
    ['Extras'],
  ])('reads %s as no Season folder', (name) => {
    expect(seasonNumberOf(name)).toBeNull();
  });
});

describe('showFolderOf', () => {
  it('answers a Season folder’s parent, the Title folder', () => {
    expect(showFolderOf(join(ROOT, 'Harbor & Vine (2021)', 'Season 01'))).toBe(
      join(ROOT, 'Harbor & Vine (2021)')
    );
  });

  it.each([['Season 1'], ['S01'], ['Specials']])(
    'answers a folder named %s itself, no Season folder',
    (name) => {
      const dir = join(ROOT, 'Harbor & Vine (2021)', name);

      expect(showFolderOf(dir)).toBe(dir);
    }
  );
});
