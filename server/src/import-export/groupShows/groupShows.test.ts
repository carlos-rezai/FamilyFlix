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
import { detectSubtitleLanguage } from '../../media/detectSubtitleLanguage/detectSubtitleLanguage';
import type { MovieFolderScan } from '../../media/scanMovieFolder/scanMovieFolder';

const ROOT = join('/', 'library');

/**
 * A scan of the folder at `segments` under the root, holding `videos` and
 * `subtitles` — each subtitle with the language its name says, as the real
 * scan reads it.
 */
function scan(
  segments: string[],
  videos: string[],
  subtitles: string[] = []
): MovieFolderScan {
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

// 22 — Series (TV), Phase 7: "loose episodes, subtitles and the unplaced
// problem" (issue #197).
//
// The scanner's second shape: a **Source folder** whose own videos carry an
// **Episode tag** is itself a **Show folder**, its seasons off the tags. An
// episode's subtitles are the ones whose names begin with its video's stem; a
// subtitle beginning with no stem is a stray, for a **Warning line**. A video
// no rule can number, or a second one claiming a number already taken, is
// **Unplaced** — listed on the show, never an episode.

describe('groupShows — loose episodes', () => {
  it('reads a folder of tagged videos as a show of its own', () => {
    const loose = scan(
      ['Lighthouse Keepers (2019)'],
      [
        'Lighthouse.Keepers.S01E01.First.Light.mp4',
        'Lighthouse.Keepers.S01E02.The.Storm.mp4',
      ]
    );

    const { shows, films } = groupShows([loose]);

    expect(films).toEqual([]);
    expect(shows).toHaveLength(1);
    expect(shows[0]).toMatchObject({
      dir: join(ROOT, 'Lighthouse Keepers (2019)'),
      name: 'Lighthouse Keepers (2019)',
    });
  });

  it('numbers loose episodes off their tags, the season included, in order', () => {
    const loose = scan(
      ['Lighthouse Keepers (2019)'],
      [
        'Lighthouse.Keepers.S02E01.Spring.Tide.mp4',
        'Lighthouse Keepers 1x02 The Storm.mp4',
        'Lighthouse.Keepers.S01E01.First.Light.mp4',
      ]
    );

    const [show] = groupShows([loose]).shows;

    expect(
      show.episodes.map((episode) => [
        episode.season,
        episode.episode,
        episode.title,
        episode.video,
      ])
    ).toEqual([
      [1, 1, 'First Light', loose.videos[2]],
      [1, 2, 'The Storm', loose.videos[1]],
      [2, 1, 'Spring Tide', loose.videos[0]],
    ]);
  });

  it('gives a multi-episode file its first number', () => {
    const loose = scan(
      ['Lighthouse Keepers (2019)'],
      ['Lighthouse.Keepers.S01E03E04.The.Long.Night.mp4']
    );

    const [show] = groupShows([loose]).shows;

    expect(show.episodes).toHaveLength(1);
    expect(show.episodes[0]).toMatchObject({ season: 1, episode: 3 });
  });

  it('gives a multi-episode file in a Season folder its first number, under the folder’s season', () => {
    const season = scan(
      ['Harbor & Vine (2021)', 'Season 02'],
      ['Harbor.and.Vine.S01E05E06.Double.Shift.mp4']
    );

    const [show] = groupShows([season]).shows;

    expect(show.episodes[0]).toMatchObject({ season: 2, episode: 5 });
  });

  it('keeps a loose show and a Season-folder show apart', () => {
    const loose = scan(
      ['Lighthouse Keepers (2019)'],
      ['Lighthouse.Keepers.S01E01.First.Light.mp4']
    );
    const season = scan(
      ['Harbor & Vine (2021)', 'Season 01'],
      ['Harbor.and.Vine.S01E01.Pilot.mp4']
    );

    const { shows } = groupShows([loose, season]);

    expect(shows.map((show) => show.name).sort()).toEqual([
      'Harbor & Vine (2021)',
      'Lighthouse Keepers (2019)',
    ]);
  });
});

describe('groupShows — episode subtitles', () => {
  it('gives each episode the subtitles whose names begin with its video’s stem, each with its language', () => {
    const loose = scan(
      ['Lighthouse Keepers (2019)'],
      [
        'Lighthouse.Keepers.S01E01.First.Light.mp4',
        'Lighthouse.Keepers.S01E02.The.Storm.mp4',
      ],
      [
        'Lighthouse.Keepers.S01E01.First.Light.en.srt',
        'Lighthouse.Keepers.S01E01.First.Light.pt.srt',
        'Lighthouse.Keepers.S01E02.The.Storm.srt',
      ]
    );

    const [show] = groupShows([loose]).shows;

    expect(show.episodes[0].subtitles).toEqual([
      {
        path: join(loose.dir, 'Lighthouse.Keepers.S01E01.First.Light.en.srt'),
        language: 'English',
      },
      {
        path: join(loose.dir, 'Lighthouse.Keepers.S01E01.First.Light.pt.srt'),
        language: 'Portuguese',
      },
    ]);
    expect(show.episodes[1].subtitles).toEqual([
      {
        path: join(loose.dir, 'Lighthouse.Keepers.S01E02.The.Storm.srt'),
        language: 'English',
      },
    ]);
  });

  it('attaches subtitles by stem inside a Season folder too', () => {
    const season = scan(
      ['Harbor & Vine (2021)', 'Season 01'],
      ['Harbor.and.Vine.S01E01.Pilot.mp4'],
      ['Harbor.and.Vine.S01E01.Pilot.es.srt']
    );

    const [show] = groupShows([season]).shows;

    expect(show.episodes[0].subtitles).toEqual([
      {
        path: join(season.dir, 'Harbor.and.Vine.S01E01.Pilot.es.srt'),
        language: 'Spanish',
      },
    ]);
  });

  it('lists a subtitle that begins with no stem as a stray, on no episode', () => {
    const loose = scan(
      ['Lighthouse Keepers (2019)'],
      ['Lighthouse.Keepers.S01E01.First.Light.mp4'],
      ['Commentary.en.srt']
    );

    const [show] = groupShows([loose]).shows;

    expect(show.episodes[0].subtitles).toEqual([]);
    expect(show.straySubtitles).toEqual([join(loose.dir, 'Commentary.en.srt')]);
  });

  it('lists no strays when every subtitle has its episode', () => {
    const loose = scan(
      ['Lighthouse Keepers (2019)'],
      ['Lighthouse.Keepers.S01E01.First.Light.mp4'],
      ['Lighthouse.Keepers.S01E01.First.Light.srt']
    );

    const [show] = groupShows([loose]).shows;

    expect(show.straySubtitles).toEqual([]);
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

  it('lists a video with no tag beside loose episodes as unplaced', () => {
    const loose = scan(
      ['Lighthouse Keepers (2019)'],
      ['Lighthouse.Keepers.S01E01.First.Light.mp4', 'Trailer.mp4']
    );

    const [show] = groupShows([loose]).shows;

    expect(show.episodes).toHaveLength(1);
    expect(show.unplaced).toEqual([loose.videos[1]]);
  });

  it('places the first file to claim a number and lists the second as unplaced', () => {
    const loose = scan(
      ['Lighthouse Keepers (2019)'],
      [
        'Lighthouse.Keepers.S01E02.Storm.Copy.mp4',
        'Lighthouse.Keepers.S01E02.The.Storm.mp4',
      ]
    );

    const [show] = groupShows([loose]).shows;

    expect(show.episodes.map((episode) => episode.video)).toEqual([
      loose.videos[0],
    ]);
    expect(show.unplaced).toEqual([loose.videos[1]]);
  });

  it('counts a number as taken across Season folders, where the folder decides the season', () => {
    const first = scan(
      ['Harbor & Vine (2021)', 'Season 01'],
      ['Harbor.and.Vine.S01E01.Pilot.mp4']
    );
    const misfiled = scan(
      ['Harbor & Vine (2021)', 'S01'],
      ['Harbor.and.Vine.S03E01.Pilot.Again.mp4']
    );

    const [show] = groupShows([first, misfiled]).shows;

    expect(show.episodes.map((episode) => episode.video)).toEqual([
      first.videos[0],
    ]);
    expect(show.unplaced).toEqual([misfiled.videos[0]]);
  });

  it('keeps a show whose every video is unplaced, with no episodes', () => {
    const season = scan(
      ['Harbor & Vine (2021)', 'Season 01'],
      ['Episode One.mp4', 'Episode Two.mp4']
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

describe('groupShows — films pass through the loose rule unchanged', () => {
  it('passes a film holding a trailer beside its video through by identity', () => {
    const film = scan(
      ['Die.Hard.1988.1080p'],
      ['Die.Hard.1988.1080p.mp4', 'trailer.mp4'],
      ['Die.Hard.1988.1080p.en.srt']
    );

    const { shows, films } = groupShows([film]);

    expect(shows).toEqual([]);
    expect(films).toHaveLength(1);
    expect(films[0]).toBe(film);
  });

  it('passes films through by identity and in order beside a loose show', () => {
    const dieHard = scan(['Die.Hard.1988.1080p'], ['Die.Hard.1988.1080p.mp4']);
    const loose = scan(
      ['Lighthouse Keepers (2019)'],
      ['Lighthouse.Keepers.S01E01.First.Light.mp4']
    );
    const amelie = scan(['Drama', 'Amelie (2001)'], ['Amelie.mp4']);

    const { shows, films } = groupShows([dieHard, loose, amelie]);

    expect(shows).toHaveLength(1);
    expect(films).toHaveLength(2);
    expect(films[0]).toBe(dieHard);
    expect(films[1]).toBe(amelie);
  });

  it.each([['Blade Runner 2049 (2017)'], ['1917 (2019)'], ['Se7en (1995)']])(
    'reads %s, whose videos carry no tag, as a film',
    (name) => {
      const film = scan([name], [`${name}.mp4`]);

      const { shows, films } = groupShows([film]);

      expect(shows).toEqual([]);
      expect(films).toEqual([film]);
    }
  );
});
