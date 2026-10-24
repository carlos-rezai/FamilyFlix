import { posix } from 'node:path';

import type { LibraryStorage } from '../..';
import type { LeftOutVideo } from '../leftOut';
import type { Episode } from '@/types';

type Reads = Pick<LibraryStorage, 'getMovie' | 'listEpisodes' | 'titleSource'>;

const forward = (path: string): string => path.replace(/\\/g, '/');

/**
 * The **Left-out videos** a keep-files Delete of one title records, read
 * before its rows go: each **Linked video**, and for a copied video its
 * **Source folder**'s **Source file** where its Library folder is known (a
 * film's own Source file, else its video's name). `[]` for an id not held.
 */
export function titleVideos(
  storage: Reads,
  kind: 'movie' | 'series',
  id: string
): LeftOutVideo[] {
  const source = storage.titleSource(id);
  const fromSource = (file: string): LeftOutVideo | null =>
    source === null
      ? null
      : {
          folderId: source.folderId,
          videoPath: posix.join(forward(source.sourceFolder), forward(file)),
        };

  if (kind === 'movie') {
    const movie = storage.getMovie(id);
    if (movie === null) {
      return [];
    }
    if (movie.videoFolderId !== null) {
      return [{ folderId: movie.videoFolderId, videoPath: movie.videoPath }];
    }
    const copied = fromSource(
      source?.sourceFile ?? posix.basename(forward(movie.videoPath))
    );
    return copied === null ? [] : [copied];
  }

  return episodeVideos(storage, id, storage.listEpisodes(id));
}

/**
 * The **Left-out videos** of some of one series' episodes, read before their
 * rows go, as {@link titleVideos} reads a whole series': each **Linked
 * video** as it lies, a copied one as its **Source folder**'s **Source
 * file** where that is known.
 */
export function episodeVideos(
  storage: Pick<LibraryStorage, 'titleSource'>,
  seriesId: string,
  episodes: readonly Episode[]
): LeftOutVideo[] {
  const source = storage.titleSource(seriesId);
  return episodes.flatMap((episode) => {
    if (episode.videoFolderId !== null) {
      return [
        { folderId: episode.videoFolderId, videoPath: episode.videoPath },
      ];
    }
    return source === null || episode.sourceFile === null
      ? []
      : [
          {
            folderId: source.folderId,
            videoPath: posix.join(
              forward(source.sourceFolder),
              forward(episode.sourceFile)
            ),
          },
        ];
  });
}
