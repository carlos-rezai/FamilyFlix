import { basename, dirname } from 'node:path';

import { episodeTag } from '../../media/episodeTag/episodeTag';
import type { MovieFolderScan } from '../../media/scanMovieFolder/scanMovieFolder';

/** One episode video of a show, numbered. */
export interface ShowEpisode {
  season: number;
  episode: number;
  title: string | null;
  /** The video, absolute, where the scan found it. */
  video: string;
}

/**
 * A **Show folder**: the parent of one or more **Season folders**, and every
 * episode found under them in season, then episode order.
 */
export interface ShowScan {
  /** The Show folder itself, absolute. */
  dir: string;
  /** Its own name, which is what matching reads. */
  name: string;
  episodes: ShowEpisode[];
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

/**
 * Group the **Source folders** the walk answered: one named as a **Season
 * folder** belongs to its parent, the **Show folder**, and every episode video
 * in it is numbered — the season off the folder's name, which wins over the
 * tag's, and the episode and title off the **Episode tag**. A video with no
 * tag has no number to take, and is left out. Every other scan is a film and
 * passes through by identity, in the order it came.
 */
export function groupShows(scans: MovieFolderScan[]): GroupedScans {
  const shows = new Map<string, ShowScan>();
  const films: MovieFolderScan[] = [];

  for (const scan of scans) {
    const season = seasonOf(scan.name);
    if (season === null) {
      films.push(scan);
      continue;
    }

    const dir = dirname(scan.dir);
    let show = shows.get(dir);
    if (show === undefined) {
      show = { dir, name: basename(dir), episodes: [] };
      shows.set(dir, show);
    }
    for (const video of scan.videos) {
      const tag = episodeTag(basename(video));
      if (tag !== null) {
        show.episodes.push({
          season,
          episode: tag.episode,
          title: tag.title,
          video,
        });
      }
    }
  }

  for (const show of shows.values()) {
    show.episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);
  }
  return { shows: [...shows.values()], films };
}
