import { basename, dirname } from 'node:path';

import { episodeTag, spellEpisodeTag } from '../../media/episodeTag/episodeTag';
import type {
  FolderScan,
  SubtitleFound,
} from '../../media/readTitleFolder/readTitleFolder';
import { seasonNumberOf } from '../../media/seasonNumberOf/seasonNumberOf';

/** One episode video of a show, numbered. */
export interface ShowEpisode {
  season: number;
  episode: number;
  title: string | null;
  /** The video, absolute, where the scan found it. */
  video: string;
  /** The tracks of its own `Subtitles/S01E01/` folder, in scan order. */
  subtitles: SubtitleFound[];
}

/**
 * A series' **Title folder**, the parent of one or more **Season folders**,
 * and every episode found in it in season,
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
  /** The tracks whose tag folder numbers no placed episode, absolute. */
  straySubtitles: string[];
}

/** What {@link groupShows} answers: the shows, and every other scan as a film. */
export interface GroupedScans<T extends FolderScan = FolderScan> {
  shows: ShowScan[];
  films: T[];
}

/**
 * The **Show folder** a folder of episode videos belongs to: a **Season
 * folder**'s parent, else the folder itself.
 */
export const showFolderOf = (dir: string): string =>
  seasonNumberOf(basename(dir)) === null ? dir : dirname(dir);

/**
 * Group the **Source folders** the walk answered into shows and films.
 *
 * A scan named as a **Season folder** belongs to its parent, the series'
 * **Title folder**, and its season is the folder's, which wins over the tag's.
 * The episode number and title come off the **Episode tag** (a multi-episode
 * file's first number), or the **Episode word** under the folder's season.
 * Each episode takes the tracks of its own `Subtitles/S01E01/` folder; a
 * track whose folder numbers no placed episode is a stray. A video no rule
 * numbers, or a second one claiming a number already taken in the show, is
 * **Unplaced**. Every other scan, a folder of loose tagged videos included,
 * is a film and passes through by identity, in the order it came.
 */
export function groupShows<T extends FolderScan>(scans: T[]): GroupedScans<T> {
  const shows = new Map<string, ShowScan>();
  const films: T[] = [];
  /** The numbers each show has placed, as `season:episode`. */
  const taken = new Map<ShowScan, Set<string>>();

  for (const scan of scans) {
    const folderSeason = seasonNumberOf(scan.name);
    if (folderSeason === null) {
      films.push(scan);
      continue;
    }

    const dir = dirname(scan.dir);
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

    /** This scan's placed episodes, by their tag spelled `S01E01`. */
    const placed = new Map<string, ShowEpisode>();
    for (const video of scan.videos) {
      // The season is the folder's, so the Episode word is read too.
      const tag = episodeTag(basename(video), folderSeason);
      const season = folderSeason;
      const number = `${season}:${tag?.episode}`;
      if (tag === null || numbers.has(number)) {
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
      placed.set(spellEpisodeTag(season, tag.episode), episode);
      show.episodes.push(episode);
    }

    for (const subtitle of scan.subtitles) {
      const folder = episodeTag(basename(dirname(subtitle.path)));
      const episode =
        folder === null
          ? undefined
          : placed.get(spellEpisodeTag(folder.season, folder.episode));
      if (episode === undefined) {
        show.straySubtitles.push(subtitle.path);
      } else {
        episode.subtitles.push(subtitle);
      }
    }
  }

  for (const show of shows.values()) {
    show.episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);
  }
  return { shows: [...shows.values()], films };
}
