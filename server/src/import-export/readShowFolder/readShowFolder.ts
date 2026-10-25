import { readdir } from 'node:fs/promises';
import { basename, relative } from 'node:path';

import { isVideoFilename } from '../../media/fileKinds/fileKinds';
import { readableFolder } from '../../media/readableFolder/readableFolder';
import {
  scanMovieFolder,
  type MovieFolderScan,
} from '../../media/scanMovieFolder/scanMovieFolder';
import { walkLibraryFolder } from '../../media/walkLibraryFolder/walkLibraryFolder';
import type { StoredLibraryFolder } from '../../library';
import type { HeldTitle } from '../../library/holding/holding';
import { groupShows, showFolderOf } from '../groupShows/groupShows';
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
 * The **Source folders** under a picked folder: the folder itself when
 * videos lie loose in it — `walkLibraryFolder` treats its root as a shelf —
 * then every one the walk finds beneath it.
 */
async function scansUnder(dir: string): Promise<MovieFolderScan[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const loose = entries.some(
    (entry) => entry.isFile() && isVideoFilename(entry.name)
  );
  const own = loose ? [await scanMovieFolder(dir)] : [];
  return [...own, ...(await walkLibraryFolder(dir))];
}

/**
 * Read one absolute folder picked on the series add as a **Show folder
 * read**: walked with `walkLibraryFolder`, grouped with `groupShows` — there
 * is no second numbering rule — so a **Season folder**'s number beats the
 * filename's, loose tagged videos are numbered off their tags, and each
 * episode keeps its stem-matched subtitles. A folder read as a film answers
 * its videos as **Unplaced**. The **Title guess** is the importer's own rule
 * on the folder's name. A picked **Season folder** reads only its own videos
 * but stands for its Show folder (`showFolderOf`): titled by the show's
 * name, held-checked as the show, each path answered inside the show.
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
  let scans: MovieFolderScan[];
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
  const { shows, films } = groupShows(scans);
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
      unplaced,
      unplacedRelative: unplaced.map((video) =>
        sourceFileOf(showFolder, video)
      ),
      straySubtitles: shows.reduce(
        (count, show) => count + show.straySubtitles.length,
        0
      ),
    },
  };
}
