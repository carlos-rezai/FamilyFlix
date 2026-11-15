import { dirname, join, resolve } from 'node:path';

import type {
  LibraryStorage,
  StoredLibraryMovie,
  StoredLibrarySeries,
} from '../../library';
import { linkedFiles } from '../linkedFiles/linkedFiles';
import { readableFolder } from '../readableFolder/readableFolder';
import type { LibraryTitles } from '@/types';

/**
 * The **Manage library page**'s read: the stored facts made absolute — a
 * linked title's Source folder (a Collection folder film's video), else its
 * Media folder; a copied title's original in a Library folder — and each
 * title's **Linked files** off `media/linkedFiles`, every Library folder's
 * reach read afresh, once per folder. Answers the titles, A to Z, and never
 * throws.
 */
export async function libraryTitleList(
  storage: LibraryStorage,
  mediaPath: string
): Promise<LibraryTitles> {
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
  const holders = videoHolders(linked);
  /**
   * The other held titles' videos `linkedFiles` weighs for this title: those
   * it links too, and one lying in its Source folder if any does. Read off
   * the index, so the list grows with the videos, not titles times videos.
   */
  const othersOf = (id: string, sourceFolder: string | null) => {
    const shared = (linked.get(id) ?? []).filter((video) =>
      [...(holders.byPath.get(video) ?? [])].some((other) => other !== id)
    );
    const inFolder =
      sourceFolder === null
        ? undefined
        : holders.byFolder
            .get(normal(sourceFolder))
            ?.find((held) => held.id !== id)?.video;
    return inFolder === undefined ? shared : [...shared, inFolder];
  };

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
      others: othersOf(title.id, sourceFolder),
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

  return {
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
}

/**
 * A path as `folderOverlap` compares it: resolved, and case-folded on
 * Windows.
 */
function normal(path: string): string {
  const resolved = resolve(path);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

/**
 * Every held title's linked videos, indexed once: by the exact path, the
 * titles linking it; by each folder a video lies in (the video's own path
 * and every ancestor, compared as `folderOverlap` compares), the videos
 * there and whose they are.
 */
function videoHolders(linked: ReadonlyMap<string, readonly string[]>) {
  const byPath = new Map<string, Set<string>>();
  const byFolder = new Map<string, { id: string; video: string }[]>();
  for (const [id, videos] of linked) {
    for (const video of videos) {
      byPath.set(video, (byPath.get(video) ?? new Set()).add(id));
      let folder = normal(video);
      for (;;) {
        const held = byFolder.get(folder) ?? [];
        held.push({ id, video });
        byFolder.set(folder, held);
        const parent = dirname(folder);
        if (parent === folder) break;
        folder = parent;
      }
    }
  }
  return { byPath, byFolder };
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
