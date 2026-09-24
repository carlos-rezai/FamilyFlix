import { basename, dirname, extname } from 'node:path';

import { episodeTag } from '../../media/episodeTag/episodeTag';
import type {
  MovieFolderScan,
  SubtitleFound,
} from '../../media/scanMovieFolder/scanMovieFolder';

/** One episode video of a show, numbered. */
export interface ShowEpisode {
  season: number;
  episode: number;
  title: string | null;
  /** The video, absolute, where the scan found it. */
  video: string;
  /** The subtitles whose names begin with the video's stem, in scan order. */
  subtitles: SubtitleFound[];
}

/**
 * A **Show folder** — the parent of one or more **Season folders**, or a
 * folder of loose tagged videos — and every episode found in it in season,
 * then episode order.
 */
export interface ShowScan {
  /** The Show folder itself, absolute. */
  dir: string;
  /** Its own name, which is what matching reads. */
  name: string;
  episodes: ShowEpisode[];
  /**
   * The videos no rule could number, and the second of two claiming one
   * number — **Unplaced**, absolute, in scan order. Never episodes.
   */
  unplaced: string[];
  /** The subtitles whose names begin with no video's stem, absolute. */
  straySubtitles: string[];
}

/** What {@link groupShows} answers: the shows, and every other scan as a film. */
export interface GroupedScans {
  shows: ShowScan[];
  films: MovieFolderScan[];
}

/** `Season 01`, `Season 1`, `S01` — a Season folder's name, and its number. */
const SEASON_FOLDER = /^(?:season\s*(\d{1,3})|s(\d{1,3}))$/i;

/** The season a folder's name says, or `null` for a name that is not one. */
const seasonOf = (name: string): number | null => {
  const found = SEASON_FOLDER.exec(name.trim());
  return found === null ? null : Number(found[1] ?? found[2]);
};

/** A file's name without its extension, lower-cased for the stem rule. */
const stemOf = (path: string): string => {
  const name = basename(path);
  return name.slice(0, name.length - extname(name).length).toLowerCase();
};

/**
 * The video a subtitle belongs to: the one whose stem its name begins with —
 * the longest such stem, so `Pilot.Extended.srt` goes to `Pilot.Extended`
 * rather than to `Pilot` — or `null` for a subtitle beginning with none.
 */
const videoOf = (subtitle: string, videos: string[]): string | null => {
  const name = basename(subtitle).toLowerCase();
  let best: string | null = null;
  for (const video of videos) {
    const stem = stemOf(video);
    if (
      name.startsWith(stem) &&
      (best === null || stem.length > stemOf(best).length)
    ) {
      best = video;
    }
  }
  return best;
};

/**
 * Group the **Source folders** the walk answered into shows and films.
 *
 * A scan named as a **Season folder** belongs to its parent, the **Show
 * folder**, and its season is the folder's, which wins over the tag's. A scan
 * whose own videos carry an **Episode tag** is itself a Show folder, its
 * seasons off the tags. Either way the episode number and title come off the
 * tag — a multi-episode file's first number — and each episode takes the
 * subtitles beside it whose names begin with its video's stem; a subtitle
 * beginning with no stem is a stray. A video with no tag, or a second one
 * claiming a number already taken in the show, is **Unplaced**. Every other
 * scan is a film and passes through by identity, in the order it came.
 */
export function groupShows(scans: MovieFolderScan[]): GroupedScans {
  const shows = new Map<string, ShowScan>();
  const films: MovieFolderScan[] = [];
  /** The numbers each show has placed, as `season:episode`. */
  const taken = new Map<ShowScan, Set<string>>();

  for (const scan of scans) {
    const folderSeason = seasonOf(scan.name);
    const loose =
      folderSeason === null &&
      scan.videos.some((video) => episodeTag(basename(video)) !== null);
    if (folderSeason === null && !loose) {
      films.push(scan);
      continue;
    }

    const dir = loose ? scan.dir : dirname(scan.dir);
    let show = shows.get(dir);
    if (show === undefined) {
      show = {
        dir,
        name: basename(dir),
        episodes: [],
        unplaced: [],
        straySubtitles: [],
      };
      shows.set(dir, show);
      taken.set(show, new Set());
    }
    const numbers = taken.get(show) as Set<string>;

    const placed = new Map<string, ShowEpisode>();
    for (const video of scan.videos) {
      const tag = episodeTag(basename(video));
      const season = folderSeason ?? tag?.season ?? null;
      const number = `${season}:${tag?.episode}`;
      if (tag === null || season === null || numbers.has(number)) {
        show.unplaced.push(video);
        continue;
      }
      numbers.add(number);
      const episode: ShowEpisode = {
        season,
        episode: tag.episode,
        title: tag.title,
        video,
        subtitles: [],
      };
      placed.set(video, episode);
      show.episodes.push(episode);
    }

    for (const subtitle of scan.subtitles) {
      const video = videoOf(subtitle.path, scan.videos);
      if (video === null) {
        show.straySubtitles.push(subtitle.path);
      } else {
        // A subtitle of an unplaced video goes nowhere: its video is already
        // a Problem, and the file comes in with it once it is renamed.
        placed.get(video)?.subtitles.push(subtitle);
      }
    }
  }

  for (const show of shows.values()) {
    show.episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);
  }
  return { shows: [...shows.values()], films };
}
