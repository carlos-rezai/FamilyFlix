import { basename, dirname } from 'node:path';

import { episodeTag, spellEpisodeTag } from '../../media/episodeTag/episodeTag';
import type {
  SeriesFolderScan,
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
  /** Its **Still**, absolute, by the tag it is numbered by, or `null`. */
  still: string | null;
}

/** One **Season folder** of a show: its number and its **Season poster**. */
export interface ShowSeason {
  number: number;
  poster: string | null;
}

/**
 * A series' **Title folder**, every episode found in it in season, then
 * episode order, and its art.
 */
export interface ShowScan {
  /** The Show folder itself, absolute. */
  dir: string;
  /** Its own name, which is what matching reads. */
  name: string;
  episodes: ShowEpisode[];
  /**
   * The videos no rule could number, and the second of two claiming one
   * number: **Unplaced**, absolute, in scan order. Never episodes.
   */
  unplaced: string[];
  /** The tracks whose tag folder numbers no placed episode, absolute. */
  straySubtitles: string[];
  /** The series' **Poster** and **Backdrop**, absolute, or `null`. */
  poster: string | null;
  backdrop: string | null;
  /** Each Season folder's number and poster, in number order. */
  seasons: ShowSeason[];
}

/** What {@link numberShow} reads of a series: all but its **Folder key**. */
export type NumberableSeries = Omit<SeriesFolderScan, 'kind' | 'key'>;

/**
 * The **Show folder** a folder of episode videos belongs to: a **Season
 * folder**'s parent, else the folder itself.
 */
export const showFolderOf = (dir: string): string =>
  seasonNumberOf(basename(dir)) === null ? dir : dirname(dir);

/**
 * Number one series' **Season folders** as they stand. An episode's season is
 * its folder's, which wins over the tag's; its number and title come off the
 * **Episode tag** (a multi-episode file's first number), or the **Episode
 * word** under the folder's season. Each episode takes the tracks of its own
 * `Subtitles/S01E01/` folder and the **Still** its number names; a track
 * whose folder numbers no placed episode is a stray. A video no rule
 * numbers, or a second one claiming a number already taken, is **Unplaced**.
 * The series' **Poster**, **Backdrop** and each **Season poster** travel
 * with it. The one numberer of a show: a **Folder scan** numbers each series'
 * Title folder by it, and a **Show folder read** numbers a picked folder by
 * it too, so the form and the scan never number a show apart.
 */
export function numberShow(series: NumberableSeries): ShowScan {
  const seasons = [...series.seasons].sort((a, b) => a.number - b.number);
  const show: ShowScan = {
    dir: series.dir,
    name: series.name,
    episodes: [],
    unplaced: [],
    straySubtitles: [],
    poster: series.poster,
    backdrop: series.backdrop,
    seasons: seasons.map(({ number, poster }) => ({ number, poster })),
  };
  /** The numbers the show has placed, as `season:episode`. */
  const numbers = new Set<string>();

  for (const season of seasons) {
    const folderSeason = season.number;
    /** This season's placed episodes, by their tag spelled `S01E01`. */
    const placed = new Map<string, ShowEpisode>();
    for (const video of season.videos) {
      // The season is the folder's, so the Episode word is read too.
      const tag = episodeTag(basename(video), folderSeason);
      if (tag === null) {
        show.unplaced.push(video);
        continue;
      }
      const number = `${folderSeason}:${tag.episode}`;
      if (numbers.has(number)) {
        show.unplaced.push(video);
        continue;
      }
      numbers.add(number);
      const spelled = spellEpisodeTag(folderSeason, tag.episode);
      const episode: ShowEpisode = {
        season: folderSeason,
        episode: tag.episode,
        title: tag.title,
        video,
        subtitles: [],
        still: season.stills[spelled] ?? null,
      };
      placed.set(spelled, episode);
      show.episodes.push(episode);
    }

    for (const subtitle of season.subtitles) {
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

  show.episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);
  return show;
}
