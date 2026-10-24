import { posix } from 'node:path';

import type { LibraryStorage } from '../..';
import type { LeftOutVideo } from '../leftOut';

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

  return storage.listEpisodes(id).flatMap((episode) => {
    if (episode.videoFolderId !== null) {
      return [
        { folderId: episode.videoFolderId, videoPath: episode.videoPath },
      ];
    }
    const copied =
      episode.sourceFile === null ? null : fromSource(episode.sourceFile);
    return copied === null ? [] : [copied];
  });
}
