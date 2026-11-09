import type { LibraryStorage } from '../../library';
import type { Media } from '../../media/createMedia/createMedia';
import { readableFolder } from '../../media/readableFolder/readableFolder';
import {
  fillLayout,
  type HeldTitleFiles,
  type LayoutFillOutcome,
} from '../fillLayout/fillLayout';

/** What the **Layout fill** reads the library through and copies out of. */
export interface LayoutFillDeps {
  storage: Pick<
    LibraryStorage,
    | 'titleSource'
    | 'libraryFolders'
    | 'getMovie'
    | 'getSeriesDetail'
    | 'stillSourcesOf'
  >;
  media: Media;
}

/** The **Layout fill** a save runs. */
export interface LayoutFill {
  /** Fill one title's **Title folder** from what the library holds of it. */
  fill(titleId: string): Promise<LayoutFillOutcome>;
}

const NOTHING: LayoutFillOutcome = { written: [], lines: [] };

/**
 * The **Layout fill** a save runs: a title, film or series, read from the
 * library and its held files written into its **Title folder** through
 * {@link fillLayout}. Only for a title with a **Source folder** in a listed,
 * reachable **Library folder**: any other gets none, nothing written and no
 * line.
 */
export function createLayoutFill({
  storage,
  media,
}: LayoutFillDeps): LayoutFill {
  /** Every file the library holds of a title, under its Source folder. */
  function heldFiles(titleId: string, folder: string): HeldTitleFiles | null {
    const movie = storage.getMovie(titleId);
    if (movie !== null) {
      return {
        folder,
        poster: movie.posterPath,
        backdrop: movie.backdropPath,
        subtitles: movie.subtitles.map(({ language, path }) => ({
          language,
          path,
        })),
        seasons: [],
      };
    }
    const detail = storage.getSeriesDetail(titleId);
    if (detail === null) {
      return null;
    }
    const stillSources = storage.stillSourcesOf(titleId);
    return {
      folder,
      poster: detail.series.posterPath,
      backdrop: detail.series.backdropPath,
      subtitles: [],
      seasons: detail.seasons.map((season) => ({
        number: season.number,
        poster: season.posterPath,
        episodes: season.episodes.map((episode) => ({
          number: episode.number,
          still: episode.stillPath,
          stillSource: stillSources.get(episode.id) ?? null,
          subtitles: episode.subtitles.map(({ language, path }) => ({
            language,
            path,
          })),
        })),
      })),
    };
  }

  return {
    async fill(titleId) {
      const source = storage.titleSource(titleId);
      if (source === null) {
        return NOTHING;
      }
      const root = storage
        .libraryFolders()
        .find((listed) => listed.id === source.folderId)?.path;
      if (root === undefined || (await readableFolder(root)) !== 'readable') {
        return NOTHING;
      }
      const held = heldFiles(titleId, source.sourceFolder);
      return held === null ? NOTHING : fillLayout(media, root, held);
    },
  };
}
