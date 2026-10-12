import { basename, extname } from 'node:path';

import type { MovieFolderScan } from '../../media/scanMovieFolder/scanMovieFolder';
import { videoOf } from '../groupShows/groupShows';
import { titleKey } from '../titleKey/titleKey';

/**
 * The words that make a video a film's extra rather than a film of its own:
 * `Heat.1995.sample.mkv`, `Heat - Behind the Scenes.mkv`. Read after the
 * separators are spaces, so `Deleted.Scenes` is `deleted scenes`.
 */
const EXTRAS =
  /\b(?:sample|trailer|extras?|featurettes?|behind the scenes|deleted scenes)\b/gi;

/** The separators a filename uses for spaces, the **Title key**'s own. */
const SEPARATORS = /[._-]+/g;

/** A file's name without its extension, its case kept. */
const stemOf = (path: string): string => basename(path, extname(path));

/** The title a video names, with any extras word dropped; `''` for none. */
const titleOfVideo = (video: string): string =>
  titleKey(stemOf(video).replace(SEPARATORS, ' ').replace(EXTRAS, ' '));

/**
 * Whether a **Source folder** is a **Collection folder**: its videos name two
 * or more different titles once each extras word is dropped. A film beside
 * its sample or trailer names one.
 */
const isCollection = (scan: MovieFolderScan): boolean =>
  new Set(scan.videos.map(titleOfVideo).filter((key) => key !== '')).size >= 2;

/** One video of a Collection folder as a film scan of its own. */
const filmOf = (scan: MovieFolderScan, video: string): MovieFolderScan => ({
  dir: scan.dir,
  name: stemOf(video),
  videos: [video],
  poster: null,
  backdrop: null,
  subtitles: scan.subtitles.filter(
    (track) => videoOf(track.path, scan.videos) === video
  ),
  collection: true,
});

/**
 * Split each **Collection folder** among the films `groupShows` passed
 * through into one film scan per video — named off the video's stem, holding
 * the subtitles whose names begin with it, with no poster or backdrop, since
 * the folder's art is the collection's — and marked `collection`. Every other
 * scan passes through by identity; order is kept.
 */
export function splitCollections(films: MovieFolderScan[]): MovieFolderScan[] {
  return films.flatMap((scan) =>
    scan.videos.length > 1 && isCollection(scan)
      ? scan.videos.map((video) => filmOf(scan, video))
      : [scan]
  );
}
