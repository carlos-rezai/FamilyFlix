import { fileURLToPath } from 'node:url';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { openDatabase, type SqliteDatabase } from '..';
import { createSeriesReader } from '../../library/series/read/read';
import { createSeriesWrite } from '../../library/series/write/write';
import { createSeriesWatch } from '../../library/series/watch/watch';
import { createSeriesCuration } from '../../library/series/curation/curation';
import { FIXTURE_VIDEO } from '../../test-support/fixtureVideo/fixtureVideo';
import type { NewSeries } from '@/types';

/**
 * Development scaffolding: mock **Series** for looking at the Series tab, the
 * Series page and the Season page with something on them.
 *
 * The movie seed retired with bulk import (#127), and the series fixture the
 * importer's suites run over is two shows of two unwatched episodes — enough to
 * prove an import, too little to look at. Nothing but the player writes a
 * resume position, so no import can fill Continue Watching either. This writes
 * a small library through the series' own storage units instead, covering
 * every state the three screens draw.
 *
 * It is a dev tool, not shipping code — which is why it may borrow the one real
 * film from `test-support/`. `npm run db:seed-series`.
 */

/**
 * The reserved video-path prefix that marks an episode — and so its series —
 * as the seed's. A series has no path of its own, so it belongs to the seed
 * when its episodes do; a series imported or added any other way stores its
 * episodes elsewhere and can never be reached by the delete pass.
 */
export const SEED_SERIES_PREFIX = '__seed__/series/';

/** What one run did, for the caller and for the stdout report. */
export interface SeriesSeedReport {
  /** Seed series found from a previous run and removed before rewriting. */
  removed: number;
  /** Series written by this run — always the full set. */
  series: number;
  /** Episodes written by this run. */
  episodes: number;
}

/** One season of a mock series, its episodes numbered from 1 in order. */
export interface SeedSeason {
  /** One entry per episode; `null` for an episode with no title. */
  titles: (string | null)[];
  /** Every episode's runtime; omitted for a season whose runtimes are unknown. */
  runtimeMinutes?: number;
  /** The first episode's air date; the rest follow a week apart. */
  firstAired?: string;
  /** How many episodes, from the first, the household has watched. */
  watched?: number;
  /** One episode left part-way — what Continue Watching shows. */
  resume?: { episode: number; seconds: number; lastWatchedAt: string };
}

export interface SeedSeries extends NewSeries {
  /** The folder its episodes live under, below the prefix. */
  slug: string;
  favorite?: boolean;
  seasons: SeedSeason[];
}

/**
 * The mock library. Chosen so every state the Series screens draw is on one:
 *
 * - **Continue Watching** holds four, stamped apart so their order is fixed —
 *   one of them on a show's very last episode, so Up next has nothing to name.
 * - **SeasonCard** shows the badge (_The Lighthouse Keepers_ S1–S2, _Deep
 *   Field_), the bar ("3 of 6 watched") and the untouched card.
 * - **Resume** follows `nextEpisodeOf` both ways: a part-watched episode, and
 *   _Paper Moon Club_'s first unwatched one after a finished season.
 * - The **Year range** reads ongoing, ended, and a single year; two favorites;
 *   one unrated; and _Home Videos_, with no genres, synopsis, credits, titles,
 *   air dates or runtimes — the pages' emptiest possible series.
 */
export const SEED_SERIES: SeedSeries[] = [
  {
    slug: 'the-lighthouse-keepers',
    title: 'The Lighthouse Keepers',
    year: 2019,
    endYear: 2023,
    synopsis:
      'Four seasons on a rock in the North Atlantic, where the last family ' +
      'still keeping a manned light learns that the automation crew arriving ' +
      'in spring will be the last boat they ever need.',
    creator: 'Marit Solberg',
    cast: ['Anders Holt', 'Ruth Achebe', 'Finn Carrow', 'Ilse Brandt'],
    rating: 9,
    genres: ['Drama', 'Family'],
    favorite: true,
    seasons: [
      {
        titles: [
          'First Light',
          'The Supply Boat',
          'Fog Signal',
          'Ninety Steps',
          'Winter Log',
          'Relief',
        ],
        runtimeMinutes: 52,
        firstAired: '2019-10-06',
        watched: 6,
      },
      {
        titles: [
          'Return',
          'The Inspector',
          'Salt',
          'A Letter from Bergen',
          'Storm Glass',
          'Lamp Room',
        ],
        runtimeMinutes: 51,
        firstAired: '2020-10-04',
        watched: 6,
      },
      {
        titles: [
          'Spring Tide',
          'The Engineer',
          'Two Keepers',
          'What the Gulls Know',
          'Blackout',
          'The Last Watch',
        ],
        runtimeMinutes: 54,
        firstAired: '2021-10-03',
        watched: 3,
        resume: {
          episode: 4,
          seconds: 1260,
          lastWatchedAt: '2026-09-24T20:15:00.000Z',
        },
      },
      {
        titles: [
          'Automation',
          'The Boat Home',
          'Inventory',
          'Keepers',
          'Dark Rock',
          'Light',
        ],
        runtimeMinutes: 55,
        firstAired: '2023-01-08',
      },
    ],
  },
  {
    slug: 'copper-street-bakery',
    title: 'Copper Street Bakery',
    year: 2021,
    synopsis:
      'A widowed baker, her two grown sons and one very opinionated sourdough ' +
      'starter keep a corner shop open against a coffee chain across the road.',
    creator: 'Deb Okafor',
    cast: ['Janet Mayhew', 'Rory Mayhew', 'Kit Sandoval'],
    rating: 7,
    genres: ['Comedy', 'Family'],
    favorite: true,
    seasons: [
      {
        titles: [
          'Proof',
          'The Rye Incident',
          'Knead to Know',
          'Crumbs',
          'Open Late',
          'The Critic',
          'Wedding Cake',
          'Closing Time',
        ],
        runtimeMinutes: 24,
        firstAired: '2021-03-12',
        watched: 2,
        resume: {
          episode: 3,
          seconds: 540,
          lastWatchedAt: '2026-09-25T18:40:00.000Z',
        },
      },
      {
        titles: [
          'New Ovens',
          'Gluten',
          'The Franchise',
          'Bake Sale',
          'Two Starters',
          'Snowed In',
          'Health Inspector',
          'Anniversary',
        ],
        runtimeMinutes: 23,
        firstAired: '2022-03-11',
      },
    ],
  },
  {
    slug: 'deep-field',
    title: 'Deep Field',
    year: 2022,
    endYear: 2022,
    synopsis:
      'A night-shift astronomer notices one star in a survey image that was ' +
      'not there the night before, and cannot find anyone willing to look.',
    creator: 'Priya Lalwani',
    cast: ['Noor Haddad', 'Stellan Voss'],
    rating: 8,
    genres: ['Sci-Fi', 'Thriller'],
    seasons: [
      {
        titles: [
          'Exposure',
          'Parallax',
          'Redshift',
          'Occultation',
          'Transit',
          'First Light',
        ],
        runtimeMinutes: 47,
        firstAired: '2022-05-20',
        watched: 6,
      },
    ],
  },
  {
    slug: 'night-ferry',
    title: 'Night Ferry',
    year: 2017,
    endYear: 2020,
    synopsis:
      'Every crossing of the last ferry out of Kirkwall carries one passenger ' +
      'who should not be on it, and a purser who has started keeping a list.',
    creator: 'Callum Reid',
    cast: ['Eilidh Munro', 'Tobias Grant', 'Sana Mirza'],
    rating: 8,
    genres: ['Crime', 'Thriller'],
    seasons: [
      {
        titles: ['Manifest', 'Cabin 12', 'Car Deck', 'Tide Table', 'Landfall'],
        runtimeMinutes: 58,
        firstAired: '2017-09-03',
      },
      {
        titles: ['Crossing', 'The Purser', 'Stowaway', 'Lifeboat', 'Harbour'],
        runtimeMinutes: 57,
        firstAired: '2018-09-02',
      },
      {
        titles: ['Weather', 'Rerouted', 'Aground', 'Search', 'Last Sailing'],
        runtimeMinutes: 59,
        firstAired: '2020-01-12',
      },
    ],
  },
  {
    slug: 'wild-coasts',
    title: 'Wild Coasts',
    year: 2020,
    synopsis:
      'Five coastlines, a year on each, filmed from the tide line out: the ' +
      'animals that live between the water and the land, and how little room ' +
      'they have left.',
    creator: 'Hanne Lindqvist',
    rating: 9,
    genres: ['Documentary'],
    seasons: [
      {
        titles: [
          'Skeleton Coast',
          'The Wadden Sea',
          'Patagonia',
          'The Great Barrier',
          'Svalbard',
        ],
        runtimeMinutes: 50,
        firstAired: '2020-11-01',
        resume: {
          episode: 2,
          seconds: 1800,
          lastWatchedAt: '2026-09-20T19:05:00.000Z',
        },
      },
    ],
  },
  {
    slug: 'paper-moon-club',
    title: 'Paper Moon Club',
    year: 2016,
    endYear: 2018,
    synopsis:
      'Four kids and a cardboard rocket reach a different moon every ' +
      'Saturday, and are always home in time for dinner.',
    creator: 'Yuki Tanabe',
    cast: ['Mila Sørensen', 'Theo Blake', 'Ada Nwosu', 'Leo Park'],
    rating: 7,
    genres: ['Animation', 'Family', 'Adventure'],
    seasons: [
      {
        titles: [
          'Blast Off',
          'The Jelly Moon',
          'Moon of Socks',
          'Upside Down Moon',
          'The Quiet Moon',
          'Moon with a Door',
          'Lost Rocket',
          'Map of Moons',
          'Rainy Moon',
          'Home Again',
        ],
        runtimeMinutes: 22,
        firstAired: '2016-02-06',
        watched: 10,
      },
      {
        titles: [
          'Bigger Rocket',
          'The Moon That Sings',
          'Grandma Comes Too',
          'Moon Market',
          'Stuck',
          'Moon of Mirrors',
          'The Crater Club',
          'Moonquake',
          'Far Side',
          'Goodnight Moons',
        ],
        runtimeMinutes: 22,
        firstAired: '2017-02-04',
      },
    ],
  },
  {
    slug: 'the-long-table',
    title: 'The Long Table',
    year: 2024,
    endYear: 2024,
    synopsis:
      'Four Sunday dinners, one family, and the seating plan nobody is ' +
      'allowed to change.',
    creator: 'Lucía Ferrer',
    cast: ['Carmen Ortiz', 'Joel Abara'],
    genres: ['Romance', 'Comedy'],
    seasons: [
      {
        titles: ['The Seating Plan', 'Seconds', 'Dessert', 'Washing Up'],
        runtimeMinutes: 34,
        firstAired: '2024-04-07',
        watched: 3,
        resume: {
          episode: 4,
          seconds: 1500,
          lastWatchedAt: '2026-09-17T21:30:00.000Z',
        },
      },
    ],
  },
  {
    slug: 'home-videos',
    title: 'Home Videos',
    seasons: [{ titles: [null, null, null] }],
  },
];

/** `2019-10-06` plus `weeks` weeks, as the same ISO date. */
function airDateAfter(first: string, weeks: number): string {
  const date = new Date(`${first}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

function episodeVideoPath(
  slug: string,
  season: number,
  number: number
): string {
  const tag = `s${String(season).padStart(2, '0')}e${String(number).padStart(2, '0')}`;
  return `${SEED_SERIES_PREFIX}${slug}/${slug}-${tag}.mp4`;
}

/**
 * Replace the seed's series in `db` — and the files behind them under
 * `mediaPath` — with {@link SEED_SERIES}, leaving every other series alone.
 *
 * Idempotent the movie seed's way: the delete pass is scoped to the reserved
 * prefix in the database and to the directory of the same name on disk, so a
 * second run converges rather than doubling, and an edit to the set followed by
 * a run lands the edit. Deleting a series row takes its episodes, genres and
 * subtitles with it by cascade.
 *
 * Takes the raw handle because the library's storage has no series delete, and
 * a dev tool is no reason to give it one; every write goes through the series'
 * own units all the same.
 */
export function seedSeries(
  db: SqliteDatabase,
  mediaPath: string
): SeriesSeedReport {
  const previous = db
    .prepare(
      'SELECT DISTINCT series_id AS id FROM episodes WHERE instr(video_path, ?) = 1'
    )
    .all(SEED_SERIES_PREFIX) as { id: string }[];
  const deleteSeries = db.prepare('DELETE FROM series WHERE id = ?');
  for (const { id } of previous) {
    deleteSeries.run(id);
  }
  rmSync(join(mediaPath, SEED_SERIES_PREFIX), { recursive: true, force: true });

  const reader = createSeriesReader(db);
  const write = createSeriesWrite(db, reader);
  const watch = createSeriesWatch(db);
  const curation = createSeriesCuration(db);
  // The watch writes stamp "now"; the fixture's own stamps fix the order
  // Continue Watching draws in.
  const stampWatched = db.prepare(
    'UPDATE episodes SET last_watched_at = ? WHERE id = ?'
  );

  let episodes = 0;
  for (const { slug, favorite, seasons, ...input } of SEED_SERIES) {
    const series = write.addSeries(input);
    if (favorite) {
      curation.setSeriesFavorite(series.id, true);
    }

    for (const [index, season] of seasons.entries()) {
      const seasonNumber = index + 1;
      for (const [at, title] of season.titles.entries()) {
        const number = at + 1;
        const videoPath = episodeVideoPath(slug, seasonNumber, number);
        const episode = write.addEpisode(series.id, {
          season: seasonNumber,
          number,
          videoPath,
          title: title ?? undefined,
          airDate: season.firstAired && airDateAfter(season.firstAired, at),
          runtimeMinutes: season.runtimeMinutes,
        });
        episodes += 1;

        const file = join(mediaPath, videoPath);
        mkdirSync(dirname(file), { recursive: true });
        copyFileSync(FIXTURE_VIDEO, file);

        if (number <= (season.watched ?? 0)) {
          watch.setEpisodeWatched(episode.id, true);
        } else if (season.resume?.episode === number) {
          watch.setEpisodeResumePosition(episode.id, season.resume.seconds);
          stampWatched.run(season.resume.lastWatchedAt, episode.id);
        }
      }
    }
  }

  return { removed: previous.length, series: SEED_SERIES.length, episodes };
}

/** `server/src/main.ts`'s defaults, so the seed writes where the server reads. */
const DEFAULT_DB_PATH = './familyflix.db';
const DEFAULT_MEDIA_PATH = './media';

/** Open the library, seed it, report through `console.info`, close. */
export function runSeriesSeed(
  dbPath: string = process.env.FAMILYFLIX_DB_PATH ?? DEFAULT_DB_PATH,
  mediaPath: string = process.env.FAMILYFLIX_MEDIA_PATH ?? DEFAULT_MEDIA_PATH
): SeriesSeedReport {
  const db = openDatabase(dbPath);

  try {
    const report = db.transaction(() => seedSeries(db, mediaPath))();
    console.info(
      `Seeded ${report.series} series (${report.episodes} episodes) into ` +
        `${dbPath}, with their video files under ${mediaPath} (removed ` +
        `${report.removed} from a previous run).`
    );
    return report;
  } finally {
    db.close();
  }
}

/** Run only as the entrypoint, never on import — the test imports this. */
const isEntrypoint =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isEntrypoint) {
  runSeriesSeed();
}
