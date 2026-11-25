import { basename, dirname } from 'node:path';

import { readTitleFolder } from '../../media/readTitleFolder/readTitleFolder';
import { isSeasonFolder } from '../../media/seasonNumberOf/seasonNumberOf';
import type { FilmFolderRead } from '@/types';

const EMPTY: FilmFolderRead = { poster: null, backdrop: null, subtitles: [] };

/**
 * The **Film folder read** of one absolute video picked on the movie add:
 * `readTitleFolder(dirname(video))`, its **Poster**, **Backdrop** and tracks
 * when that reads as a `film` whose videos include the picked one (a folder
 * of two videos still answers them). A series, a left-out folder or one that
 * cannot be read answers all empty, and so does a video in a **Season
 * folder**, whose art and tracks are a season's, never a film's. Answered as a value, never a throw.
 */
export async function readFilmFolder(video: string): Promise<FilmFolderRead> {
  if (isSeasonFolder(basename(dirname(video)))) {
    return EMPTY;
  }
  try {
    const scan = await readTitleFolder(dirname(video));
    if (scan.kind !== 'film' || !scan.videos.includes(video)) {
      return EMPTY;
    }
    return {
      poster: scan.poster,
      backdrop: scan.backdrop,
      subtitles: scan.subtitles.map(({ path, language }) => ({
        path,
        language,
      })),
    };
  } catch {
    return EMPTY;
  }
}
