import { readdir } from 'node:fs/promises';
import { basename } from 'node:path';

import { isVideoFilename } from '../../media/fileKinds/fileKinds';
import { readableFolder } from '../../media/readableFolder/readableFolder';
import {
  scanMovieFolder,
  type MovieFolderScan,
} from '../../media/scanMovieFolder/scanMovieFolder';
import { walkLibraryFolder } from '../../media/walkLibraryFolder/walkLibraryFolder';
import { groupShows } from '../groupShows/groupShows';
import { titleGuess } from '../titleKey/titleKey';
import type { ShowFolderEpisode, ShowFolderRead } from '@/types';

/** Why a picked folder was not read: it cannot be read, or holds no video. */
export type ShowFolderRefusal = 'unreadable' | 'empty';

/** What {@link readShowFolder} came to — the route words each refusal. */
export type ShowFolderAnswer =
  | { kind: 'read'; read: ShowFolderRead }
  | { kind: 'refused'; refusal: ShowFolderRefusal };

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
 * on the folder's name.
 *
 * A folder that cannot be read is `unreadable`; one holding no video is
 * `empty`. Answered as a value, never a throw.
 */
export async function readShowFolder(dir: string): Promise<ShowFolderAnswer> {
  if ((await readableFolder(dir)) !== 'readable') {
    return { kind: 'refused', refusal: 'unreadable' };
  }
  let scans: MovieFolderScan[];
  try {
    scans = await scansUnder(dir);
  } catch {
    return { kind: 'refused', refusal: 'unreadable' };
  }

  const { shows, films } = groupShows(scans);
  const episodes: ShowFolderEpisode[] = shows
    .flatMap((show) => show.episodes)
    .map((episode) => ({
      season: episode.season,
      number: episode.episode,
      title: episode.title,
      video: episode.video,
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

  return {
    kind: 'read',
    read: {
      path: dir,
      titleGuess: titleGuess(basename(dir)),
      libraryFolderId: null,
      heldSeriesId: null,
      episodes,
      unplaced,
      straySubtitles: shows.reduce(
        (count, show) => count + show.straySubtitles.length,
        0
      ),
    },
  };
}
