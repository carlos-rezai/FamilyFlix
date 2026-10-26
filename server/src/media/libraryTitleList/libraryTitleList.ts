import { dirname, join, resolve } from 'node:path';

import type {
  LibraryStorage,
  StoredLibraryMovie,
  StoredLibrarySeries,
} from '../../library';
import { linkedFiles } from '../linkedFiles/linkedFiles';
import { readableFolder } from '../readableFolder/readableFolder';
import type { LibraryTitles } from '@/types';

/** The **Manage library page**'s read: its titles, each Linked files a kind. */
export interface LibraryTitleList {
  titles: LibraryTitles;
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
  /** Every other held title's linked videos, a video it shares included. */
  const othersOf = (id: string) =>
    [...linked].flatMap(([other, videos]) => (other === id ? [] : videos));

  function placed(
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
      others: othersOf(title.id),
    });
    return {
      id: title.id,
      title: title.title,
      year: title.year,
      path: titlePath({
        managed,
        linked: answer !== null,
        sourceFolder,
        sourceFile,
        videos,
      }),
      linkedFiles: answer,
      originalPath: answer === null ? sourceFolder : null,
      details: title.details,
    };
  }

  const titles: LibraryTitles = {
    movies: movies.map((movie) => ({
      kind: 'movie' as const,
      ...placed(movie, movie.linkedVideos.length > 0, movie.sourceFile),
      files: movie.files,
    })),
    series: series.map((show) => ({
      kind: 'series' as const,
      ...placed(
        show,
        show.episodes > 0 && show.linkedVideos.length === show.episodes,
        null
      ),
      endYear: show.endYear,
      seasons: show.seasons,
      episodes: show.episodes,
    })),
  };
  return { titles };
}

/**
 * A **Library title**'s `path`, the one the dialogs print, in the rule's
 * order: a copied title's Media folder; a linked **Collection folder** film's
 * video; a linked title's Source folder; a linked title with no Source
 * folder, its first video's folder — else, with none, its Media folder.
 */
function titlePath({
  managed,
  linked,
  sourceFolder,
  sourceFile,
  videos,
}: {
  managed: string;
  linked: boolean;
  sourceFolder: string | null;
  sourceFile: string | null;
  videos: readonly string[];
}): string {
  if (!linked) {
    return managed;
  }
  if (sourceFolder !== null && sourceFile !== null) {
    return join(sourceFolder, sourceFile);
  }
  if (sourceFolder !== null) {
    return sourceFolder;
  }
  return videos[0] === undefined ? managed : dirname(videos[0]);
}
