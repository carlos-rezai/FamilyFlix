// @vitest-environment node
//
// 59, Rebuild whole, Phase 1 (issue #548): a scanned series brings its art.
//
// `numberShow`, pure over one series as `readTitleFolder` reads it: it numbers
// the series' **Season folders** as they stand, the episode and the title off
// the **Episode tag** (or the **Episode word**), the folder's season winning
// over the tag's. Each episode takes the tracks of its own `Subtitles/S01E01/`
// folder; a track whose folder numbers no placed episode is a stray; a video
// no rule numbers, or the second to claim a number, is **Unplaced**. It
// carries the series' **Poster** and **Backdrop**, each Season folder's
// **Season poster** and each episode's **Still** by its tag.
//
// The tests `groupShows` held (issue #189, #309, #448, #536), moved here with
// the unit that replaces it: a series reaches the importer whole, so there
// are no films to pass through and no Season folders to group.
//
// Table tests: a scan is built by name under a fixed root, and nothing
// touches the disk.

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { numberShow, showFolderOf } from './numberShow';
import { detectSubtitleLanguage } from '../../media/detectSubtitleLanguage/detectSubtitleLanguage';
import type {
  SeasonFolderScan,
  SeriesFolderScan,
} from '../../media/readTitleFolder/readTitleFolder';
import { seasonNumberOf } from '../../media/seasonNumberOf/seasonNumberOf';

const ROOT = join('/', 'library');
const SHOW = 'Harbor & Vine (2021)';
const SHOW_DIR = join(ROOT, SHOW);

interface SeasonArt {
  poster?: string;
  /** Each Still's name in `Images/Stills/`, by the tag it carries. */
  stills?: Record<string, string>;
}

/**
 * A Season folder named `name` under the show, holding `videos` and
 * `subtitles` at paths relative to it, each track with the language its name
 * says, its poster and Stills at their place in `Images/`, as the real read
 * answers them.
 */
function season(
  name: string,
  videos: string[],
  subtitles: string[] = [],
  art: SeasonArt = {}
): SeasonFolderScan {
  const dir = join(SHOW_DIR, name);
  const images = join(dir, 'Images');
  return {
    dir,
    name,
    number: seasonNumberOf(name) as number,
    videos: videos.map((video) => join(dir, video)),
    subtitles: subtitles.map((file) => ({
      path: join(dir, file),
      language: detectSubtitleLanguage(file),
    })),
    poster: art.poster === undefined ? null : join(images, art.poster),
    stills: Object.fromEntries(
      Object.entries(art.stills ?? {}).map(([tag, file]) => [
        tag,
        join(images, 'Stills', file),
      ])
    ),
  };
}

/** The series holding `seasons`, in number order, and its own art. */
function series(
  seasons: SeasonFolderScan[],
  art: { poster?: string; backdrop?: string } = {}
): SeriesFolderScan {
  const images = join(SHOW_DIR, 'Images');
  return {
    kind: 'series',
    dir: SHOW_DIR,
    name: SHOW,
    key: { name: SHOW, title: 'Harbor & Vine', year: 2021 },
    poster: art.poster === undefined ? null : join(images, art.poster),
    backdrop: art.backdrop === undefined ? null : join(images, art.backdrop),
    seasons,
  };
}

describe('numberShow: the show itself', () => {
  it('answers the Title folder and its name', () => {
    const show = numberShow(
      series([season('Season 01', ['Harbor.and.Vine.S01E01.Pilot.mp4'])])
    );

    expect(show).toMatchObject({ dir: SHOW_DIR, name: SHOW });
  });

  it('numbers every episode in the Season folder, with the title off its tag', () => {
    const first = season('Season 01', [
      'Harbor.and.Vine.S01E01.Pilot.1080p.mp4',
      'Harbor.and.Vine.S01E02.The.Night.Market.1080p.mp4',
    ]);

    const show = numberShow(series([first]));

    expect(show.episodes).toEqual([
      {
        season: 1,
        episode: 1,
        title: 'Pilot',
        video: first.videos[0],
        subtitles: [],
        still: null,
      },
      {
        season: 1,
        episode: 2,
        title: 'The Night Market',
        video: first.videos[1],
        subtitles: [],
        still: null,
      },
    ]);
  });

  it('numbers two Season folders into one show, in season then episode order', () => {
    const show = numberShow(
      series([
        season('Season 01', ['Harbor.and.Vine.S01E01.Pilot.mp4']),
        season('Season 02', [
          'Harbor.and.Vine.S02E02.Low.Tide.mp4',
          'Harbor.and.Vine.S02E01.mp4',
        ]),
      ])
    );

    expect(
      show.episodes.map((episode) => [episode.season, episode.episode])
    ).toEqual([
      [1, 1],
      [2, 1],
      [2, 2],
    ]);
  });

  it('numbers a Season 00 folder’s episodes in season 0, the specials', () => {
    const show = numberShow(
      series([season('Season 00', ['Harbor.and.Vine.S00E01.Christmas.mkv'])])
    );

    expect(show.episodes).toMatchObject([
      { season: 0, episode: 1, title: 'Christmas' },
    ]);
  });

  it('lets the Season folder’s number win over the tag’s', () => {
    const show = numberShow(
      series([season('Season 03', ['Harbor.and.Vine.S01E05.Misfiled.mp4'])])
    );

    expect(show.episodes[0]).toMatchObject({ season: 3, episode: 5 });
  });

  it('gives a multi-episode file its first number, under the folder’s season', () => {
    const show = numberShow(
      series([
        season('Season 02', ['Harbor.and.Vine.S01E05E06.Double.Shift.mp4']),
      ])
    );

    expect(show.episodes[0]).toMatchObject({ season: 2, episode: 5 });
  });

  it('answers no episodes for a series with no Season folder holding a video', () => {
    const show = numberShow(series([season('Season 01', [])]));

    expect(show.episodes).toEqual([]);
    expect(show.unplaced).toEqual([]);
    expect(show.straySubtitles).toEqual([]);
  });
});

/**
 * Each episode's tracks lie in its own `Subtitles/S01E01/` folder inside the
 * Season folder: a track lands on the episode its folder's tag numbers, and a
 * track whose folder numbers no placed episode is a stray.
 */
describe('numberShow: episode tracks by their S01E01 folder', () => {
  it('gives each episode the tracks of its own tag folder, each with its language', () => {
    const first = season(
      'Season 01',
      ['Harbor.and.Vine.S01E01.Pilot.mp4', 'Harbor.and.Vine.S01E02.mp4'],
      [
        join('Subtitles', 'S01E01', 'anything.en.srt'),
        join('Subtitles', 'S01E01', 'anything.pt.srt'),
        join('Subtitles', 'S01E02', 'other name.srt'),
      ]
    );

    const show = numberShow(series([first]));

    const tracks = join(first.dir, 'Subtitles');
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
    const first = season(
      'Season 01',
      ['Harbor.and.Vine.S01E01.mp4'],
      [join('Subtitles', 'S01E01', 'one.en.srt')]
    );
    const second = season(
      'Season 02',
      ['Harbor.and.Vine.S02E01.mp4'],
      [join('Subtitles', 'S02E01', 'two.en.srt')]
    );

    const show = numberShow(series([first, second]));

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
    const first = season(
      'Season 01',
      ['Harbor.and.Vine.S01E01.Pilot.mp4'],
      [join('Subtitles', 'S01E09', 'lost.en.srt')]
    );

    const show = numberShow(series([first]));

    expect(show.episodes[0].subtitles).toEqual([]);
    expect(show.straySubtitles).toEqual([
      join(first.dir, 'Subtitles', 'S01E09', 'lost.en.srt'),
    ]);
  });
});

describe('numberShow: unplaced videos', () => {
  it('lists a video with no tag in a Season folder as unplaced, not as an episode', () => {
    const first = season('Season 01', [
      'Harbor.and.Vine.S01E01.Pilot.mp4',
      'Behind the Scenes.mp4',
    ]);

    const show = numberShow(series([first]));

    expect(show.episodes.map((episode) => episode.video)).toEqual([
      first.videos[0],
    ]);
    expect(show.unplaced).toEqual([first.videos[1]]);
  });

  it('places the first file to claim a number and lists the second as unplaced', () => {
    const first = season('Season 01', [
      'Harbor.and.Vine.S01E02.Storm.Copy.mp4',
      'Harbor.and.Vine.S01E02.mp4',
    ]);

    const show = numberShow(series([first]));

    expect(show.episodes.map((episode) => episode.video)).toEqual([
      first.videos[0],
    ]);
    expect(show.unplaced).toEqual([first.videos[1]]);
  });

  it('counts a number as taken where the folder decides the season', () => {
    const first = season('Season 01', [
      'Harbor.and.Vine.S01E01.Pilot.mp4',
      'Harbor.and.Vine.S03E01.Pilot.Again.mp4',
    ]);

    const show = numberShow(series([first]));

    expect(show.episodes.map((episode) => episode.video)).toEqual([
      first.videos[0],
    ]);
    expect(show.unplaced).toEqual([first.videos[1]]);
  });

  it('keeps a show whose every video is unplaced, with no episodes', () => {
    const first = season('Season 01', [
      'Opening Night.mp4',
      'The Long Goodbye.mp4',
    ]);

    const show = numberShow(series([first]));

    expect(show.episodes).toEqual([]);
    expect(show.unplaced).toEqual(first.videos);
  });

  it('lists nothing unplaced for a show whose every video has its number', () => {
    const show = numberShow(
      series([season('Season 01', ['Harbor.and.Vine.S01E01.Pilot.mp4'])])
    );

    expect(show.unplaced).toEqual([]);
  });
});

/**
 * The **Episode word** (`Episode 12`, `Ep 12`, `Ep.12`, `E12`, `Aflevering
 * 12`, `Afl. 12`) numbers a video inside a **Season folder**, under the
 * folder's season.
 */
describe('numberShow: the Episode word', () => {
  it.each([
    ['Episode 12.mkv'],
    ['Ep 12.mkv'],
    ['Ep.12.mkv'],
    ['E12.mkv'],
    ['Aflevering 12.mkv'],
    ['Afl. 12.mkv'],
  ])('numbers %s inside a Season folder, under the folder’s season', (file) => {
    const second = season('Season 02', [file]);

    const show = numberShow(series([second]));

    expect(show.episodes).toMatchObject([
      { season: 2, episode: 12, video: second.videos[0] },
    ]);
    expect(show.unplaced).toEqual([]);
  });

  it('reads the title after the word', () => {
    const show = numberShow(
      series([season('Season 01', ['Episode 03 - The Night Market.mkv'])])
    );

    expect(show.episodes[0]).toMatchObject({
      season: 1,
      episode: 3,
      title: 'The Night Market',
    });
  });
});

/**
 * The art a series' Title folder holds travels with its numbering: the
 * series' Poster and Backdrop, each Season folder's Season poster in number
 * order, and each episode's Still by the tag its file carries.
 */
describe('numberShow: the series carries its art', () => {
  it('carries the series’ poster and backdrop', () => {
    const show = numberShow(
      series([season('Season 01', ['Harbor.and.Vine.S01E01.Pilot.mp4'])], {
        poster: 'harbor-poster.jpg',
        backdrop: 'backdrop.jpg',
      })
    );

    expect(show.poster).toBe(join(SHOW_DIR, 'Images', 'harbor-poster.jpg'));
    expect(show.backdrop).toBe(join(SHOW_DIR, 'Images', 'backdrop.jpg'));
  });

  it('carries no poster and no backdrop for a series whose Images/ holds none', () => {
    const show = numberShow(
      series([season('Season 01', ['Harbor.and.Vine.S01E01.Pilot.mp4'])])
    );

    expect(show.poster).toBeNull();
    expect(show.backdrop).toBeNull();
  });

  it('carries each Season folder’s number and poster, in number order', () => {
    const first = season(
      'Season 01',
      ['Harbor.and.Vine.S01E01.Pilot.mp4'],
      [],
      { poster: 'poster.jpg' }
    );
    const second = season('Season 02', ['Harbor.and.Vine.S02E01.mp4']);
    const third = season('Season 03', [], [], { poster: 'season-poster.png' });

    const show = numberShow(series([first, second, third]));

    expect(show.seasons).toEqual([
      { number: 1, poster: join(first.dir, 'Images', 'poster.jpg') },
      { number: 2, poster: null },
      { number: 3, poster: join(third.dir, 'Images', 'season-poster.png') },
    ]);
  });

  it('gives each episode the Still its tag names, and none where no Still carries it', () => {
    const first = season(
      'Season 01',
      ['Harbor.and.Vine.S01E01.Pilot.mp4', 'Harbor.and.Vine.S01E02.mp4'],
      [],
      { stills: { S01E01: 'S01E01.jpg' } }
    );

    const show = numberShow(series([first]));

    expect(show.episodes.map((episode) => episode.still)).toEqual([
      join(first.dir, 'Images', 'Stills', 'S01E01.jpg'),
      null,
    ]);
  });

  it('lands a Still on the right season when two Season folders share an episode number', () => {
    const first = season('Season 01', ['Harbor.and.Vine.S01E01.mp4'], [], {
      stills: { S01E01: 'Harbor S01E01 frame.jpg' },
    });
    const second = season('Season 02', ['Harbor.and.Vine.S02E01.mp4'], [], {
      stills: { S02E01: 'S02E01.png' },
    });

    const show = numberShow(series([first, second]));

    expect(
      show.episodes.map((episode) => [episode.season, episode.still])
    ).toEqual([
      [1, join(first.dir, 'Images', 'Stills', 'Harbor S01E01 frame.jpg')],
      [2, join(second.dir, 'Images', 'Stills', 'S02E01.png')],
    ]);
  });

  it('gives an unplaced video no Still, even with one lying in Stills/', () => {
    const first = season(
      'Season 01',
      ['Harbor.and.Vine.S01E01.mp4', 'Behind the Scenes.mp4'],
      [],
      { stills: { S01E01: 'S01E01.jpg', S01E07: 'S01E07.jpg' } }
    );

    const show = numberShow(series([first]));

    expect(show.episodes).toHaveLength(1);
    expect(show.episodes[0].still).toBe(
      join(first.dir, 'Images', 'Stills', 'S01E01.jpg')
    );
    expect(show.unplaced).toEqual([first.videos[1]]);
  });
});

describe('showFolderOf', () => {
  it('answers a Season folder’s parent, the Title folder', () => {
    expect(showFolderOf(join(SHOW_DIR, 'Season 01'))).toBe(SHOW_DIR);
  });

  it.each([['Season 1'], ['S01'], ['Specials']])(
    'answers a folder named %s itself, no Season folder',
    (name) => {
      const dir = join(SHOW_DIR, name);

      expect(showFolderOf(dir)).toBe(dir);
    }
  );
});
