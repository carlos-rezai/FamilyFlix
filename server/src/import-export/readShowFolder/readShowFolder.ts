import { readdir } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';

import { readableFolder } from '../../media/readableFolder/readableFolder';
import {
  readLooseFiles,
  readSeasonFolder,
  type FolderScan,
  type SeasonFolderScan,
} from '../../media/readTitleFolder/readTitleFolder';
import { isSeasonFolder } from '../../media/seasonNumberOf/seasonNumberOf';
import type { StoredLibraryFolder } from '../../library';
import type { HeldTitle } from '../../library/holding/holding';
import {
  numberShow,
  showFolderOf,
  type ShowScan,
} from '../numberShow/numberShow';
import { heldByVideo } from '../heldByVideo/heldByVideo';
import { listedFolderOf } from '../listedFolderOf/listedFolderOf';
import { sourceFileOf } from '../placeFilmFolder/placeFilmFolder';
import { titleGuess } from '../titleKey/titleKey';
import type { ShowFolderEpisode, ShowFolderRead } from '@/types';

/** Why a picked folder was not read: it cannot be read, or holds no video. */
export type ShowFolderRefusal = 'unreadable' | 'empty';

/** What {@link readShowFolder} came to — the route words each refusal. */
export type ShowFolderAnswer =
  | { kind: 'read'; read: ShowFolderRead }
  | { kind: 'refused'; refusal: ShowFolderRefusal };

/**
 * What the caller knows of the library: the listed **Library folders**, and
 * the held series on record at a folder relative to one of them.
 */
export interface ShowFolderContext {
  folders: readonly StoredLibraryFolder[];
  /** The held series whose **Source folder** this is, `null` for none. */
  heldSeriesAt(folderId: string, sourceFolder: string): string | null;
  /** The **Held video** rule: the title playing a video, `null` for none. */
  titleHolding(folderId: string, videoPath: string): HeldTitle | null;
}

/**
 * The folders holding videos under a picked folder: the folder itself when
 * videos lie loose in it, then every folder beneath it holding a video, a
 * folder holding one not descended. A **Season folder** is read as the scan
 * reads it, its tracks from `Subtitles/S01E01/`.
 */
async function scansUnder(
  dir: string
): Promise<(FolderScan | SeasonFolderScan)[]> {
  const scans: (FolderScan | SeasonFolderScan)[] = [];
  const visit = async (at: string, root: boolean): Promise<void> => {
    const entries = await readdir(at, { withFileTypes: true });
    const scan = isSeasonFolder(basename(at))
      ? await readSeasonFolder(at)
      : await readLooseFiles(at);
    if (scan.videos.length > 0) {
      scans.push(scan);
      if (!root) {
        return;
      }
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          await visit(join(at, entry.name), false);
        } catch {
          // A folder under the pick that cannot be read is passed over.
        }
      }
    }
  };
  await visit(dir, true);
  return scans;
}

/**
 * The scans under a pick as shows and films: each **Season folder** numbered
 * with the others of its parent by `numberShow`, every other scan a film.
 */
function numberedShows(scans: (FolderScan | SeasonFolderScan)[]): {
  shows: ShowScan[];
  films: FolderScan[];
} {
  const seasonsOf = new Map<string, SeasonFolderScan[]>();
  const films: FolderScan[] = [];
  for (const scan of scans) {
    if ('number' in scan) {
      const parent = dirname(scan.dir);
      seasonsOf.set(parent, [...(seasonsOf.get(parent) ?? []), scan]);
    } else {
      films.push(scan);
    }
  }
  const shows = [...seasonsOf].map(([dir, seasons]) =>
    numberShow({
      dir,
      name: basename(dir),
      poster: null,
      backdrop: null,
      seasons,
    })
  );
  return { shows, films };
}

/**
 * Read one absolute folder picked on the series add as a **Show folder
 * read**: walked by `scansUnder`, numbered with `numberShow` (there is no
 * second numbering rule), so a **Season folder**'s number beats the
 * filename's, and each episode keeps the tracks of its `Subtitles/S01E01/`
 * folder. A folder read as a film, loose tagged videos included, answers its
 * videos as **Unplaced**. The **Title guess** is the importer's own rule on
 * the folder's name. A picked **Season folder** reads only its own videos but
 * stands for its Show folder (`showFolderOf`): titled by the show's name,
 * held-checked as the show, each path answered inside the show.
 *
 * Its `libraryFolderId` is the listed **Library folder** it lies inside, by
 * `listedFolderOf`, or `null`. A folder that is already a held series's
 * **Show folder** — the folder on record under that Library folder, as
 * `heldSeriesAt` answers — is still read, its `heldSeriesId` set to that
 * series's id; the form draws the refusal. So is a folder any one of whose
 * videos a held series plays, by the **Held video** rule (`titleHolding`): a
 * renamed show's folder reads as its series. A folder under no Library folder
 * has no folder on record, so it is never held.
 *
 * A folder that cannot be read is `unreadable`; one holding no video is
 * `empty`. Answered as a value, never a throw.
 */
export async function readShowFolder(
  dir: string,
  context: ShowFolderContext
): Promise<ShowFolderAnswer> {
  if ((await readableFolder(dir)) !== 'readable') {
    return { kind: 'refused', refusal: 'unreadable' };
  }
  let scans: (FolderScan | SeasonFolderScan)[];
  try {
    scans = await scansUnder(dir);
  } catch {
    return { kind: 'refused', refusal: 'unreadable' };
  }

  // A picked **Season folder** is read for its own videos, but titled,
  // held-checked and spelled by its Show folder.
  // The Show folder is each episode's Source folder, so a video's path
  // inside it is its **Source file**.
  const showFolder = showFolderOf(dir);
  const { shows, films } = numberedShows(scans);
  const episodes: ShowFolderEpisode[] = shows
    .flatMap((show) => show.episodes)
    .map((episode) => ({
      season: episode.season,
      number: episode.episode,
      title: episode.title,
      video: episode.video,
      relativePath: sourceFileOf(showFolder, episode.video),
      subtitles: episode.subtitles.map(({ path, language }) => ({
        path,
        language,
      })),
    }))
    .sort((a, b) => a.season - b.season || a.number - b.number);
  const unplaced = [
    ...shows.flatMap((show) => show.unplaced),
    ...films.flatMap((film) => film.videos),
  ];
  if (episodes.length === 0 && unplaced.length === 0) {
    return { kind: 'refused', refusal: 'empty' };
  }

  const listed = listedFolderOf(context.folders, dir);
  return {
    kind: 'read',
    read: {
      path: dir,
      titleGuess: titleGuess(basename(showFolder)),
      libraryFolderId: listed?.id ?? null,
      heldSeriesId:
        listed === null
          ? null
          : (context.heldSeriesAt(
              listed.id,
              relative(listed.path, showFolder)
            ) ??
            heldByVideo(
              context.titleHolding,
              listed,
              [...episodes.map((episode) => episode.video), ...unplaced],
              'series'
            )),
      episodes,
      unplaced: unplaced.map((video) => ({
        video,
        relativePath: sourceFileOf(showFolder, video),
      })),
      straySubtitles: shows.reduce(
        (count, show) => count + show.straySubtitles.length,
        0
      ),
    },
  };
}
