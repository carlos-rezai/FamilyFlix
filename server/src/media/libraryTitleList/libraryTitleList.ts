import { dirname, join, resolve } from 'node:path';

import type {
  LibraryStorage,
  StoredLibraryMovie,
  StoredLibrarySeries,
} from '../../library';
import {
  linkedFiles,
  type LinkedFilesAnswer,
} from '../linkedFiles/linkedFiles';
import { readableFolder } from '../readableFolder/readableFolder';
import type { LibraryTitles } from '@/types';

/** The **Manage library page**'s read, and each title's Linked files beside it. */
export interface LibraryTitleList {
  titles: LibraryTitles;
  /**
   * One title's **Linked files** as the list reads them now — the kind and
   * the absolute paths a delete trashes — or `null` for a copied title.
   */
  linkedFilesOf(kind: 'movie' | 'series', id: string): LinkedFilesAnswer | null;
}

/**
 * The **Manage library page**'s read: the stored facts made absolute — a
 * linked title's Source folder (a Collection folder film's video), else its
 * Media folder; a copied title's original in a Library folder — and each
 * title's **Linked files** off `media/linkedFiles`, every Library folder's
 * reach read afresh, once per folder. Answers a value and never throws.
 */
export async function libraryTitleList(
  storage: LibraryStorage,
  mediaPath: string
): Promise<LibraryTitleList> {
  const { titles, linked } = await readLibraryTitles(storage, mediaPath);
  return {
    titles,
    linkedFilesOf: (kind, id) => linked.get(`${kind}:${id}`) ?? null,
  };
}

/** The list read, with each title's Linked files' paths beside it by kind and id. */
async function readLibraryTitles(
  storage: LibraryStorage,
  mediaPath: string
): Promise<{
  titles: LibraryTitles;
  linked: Map<string, LinkedFilesAnswer | null>;
}> {
  const answers = new Map<string, LinkedFilesAnswer | null>();
  const folders = new Map(
    await Promise.all(
      storage.libraryFolders().map(
        async (folder) =>
          [
            folder.id,
            {
              path: folder.path,
              reachable: (await readableFolder(folder.path)) === 'readable',
            },
          ] as const
      )
    )
  );
  const { movies, series } = storage.libraryTitles();

  const videosOf = (title: StoredLibraryMovie | StoredLibrarySeries) =>
    title.linkedVideos.flatMap(({ folderId, videoPath }) => {
      const folder = folders.get(folderId);
      return folder === undefined ? [] : [join(folder.path, videoPath)];
    });
  const linked = new Map<string, string[]>(
    [...movies, ...series].map((title) => [title.id, videosOf(title)])
  );
  const allVideos = [...linked.values()].flat();

  function placed(
    kind: 'movie' | 'series',
    title: StoredLibraryMovie | StoredLibrarySeries,
    allLinked: boolean,
    sourceFile: string | null
  ) {
    const videos = linked.get(title.id) ?? [];
    const folderId =
      title.libraryFolderId ?? title.linkedVideos[0]?.folderId ?? null;
    const libraryFolder =
      folderId === null ? null : (folders.get(folderId) ?? null);
    const sourceFolder =
      libraryFolder === null || title.sourceFolder === null
        ? null
        : join(libraryFolder.path, title.sourceFolder);
    const managed = resolve(mediaPath, title.mediaFolder ?? '');
    const answer = linkedFiles({
      videos,
      allLinked,
      sourceFolder,
      libraryFolder,
      others: allVideos.filter((video) => !videos.includes(video)),
    });
    answers.set(`${kind}:${title.id}`, answer);
    const linkedPath =
      sourceFolder === null
        ? videos[0] === undefined
          ? managed
          : dirname(videos[0])
        : sourceFile === null
          ? sourceFolder
          : join(sourceFolder, sourceFile);
    return {
      id: title.id,
      title: title.title,
      year: title.year,
      path: answer === null ? managed : linkedPath,
      linkedFiles: answer?.kind ?? null,
      originalPath: answer === null ? sourceFolder : null,
      details: title.details,
    };
  }

  const titles: LibraryTitles = {
    movies: movies.map((movie) => ({
      kind: 'movie' as const,
      ...placed(
        'movie',
        movie,
        movie.linkedVideos.length > 0,
        movie.sourceFile
      ),
      files: movie.files,
    })),
    series: series.map((show) => ({
      kind: 'series' as const,
      ...placed(
        'series',
        show,
        show.episodes > 0 && show.linkedVideos.length === show.episodes,
        null
      ),
      endYear: show.endYear,
      seasons: show.seasons,
      episodes: show.episodes,
    })),
  };
  return { titles, linked: answers };
}
