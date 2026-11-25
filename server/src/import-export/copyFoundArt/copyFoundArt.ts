import type { Media } from '../../media/createMedia/createMedia';
import type { TitleArt } from '../../media/readTitleFolder/readTitleFolder';

/** One season's **Season poster**, by season: absolute when found, stored once copied. */
export interface SeasonPosterPath {
  season: number;
  path: string;
}

/**
 * A title's found **Poster** and **Backdrop**, absolute, `null` for none, and
 * a show's found **Season posters**, none when absent.
 */
export interface FoundArt extends TitleArt {
  seasonPosters?: SeasonPosterPath[];
}

/**
 * A title's found art once copied: each file's **Stored path**, or `null`,
 * and each Season poster's by season.
 */
export interface CopiedArt extends TitleArt {
  seasonPosters: SeasonPosterPath[];
}

/** Nothing copied: no Poster, no Backdrop, no Season poster. */
export const NO_COPIED_ART: Readonly<CopiedArt> = {
  poster: null,
  backdrop: null,
  seasonPosters: [],
};

/**
 * A title's found **Poster** and **Backdrop** copied with `Media.copyIn` into
 * the **Media folder** `folder`'s root, and each found **Season poster** into
 * its `season-NN/` (`media.seasonFolder`), copied, never moved, so the picked
 * folder is left as it was. Rejects on the first copy that breaks; the caller
 * takes the folder back.
 */
export async function copyFoundArt(
  media: Media,
  folder: string,
  art: FoundArt
): Promise<CopiedArt> {
  const copy = (path: string | null): Promise<string | null> =>
    path === null ? Promise.resolve(null) : media.copyIn(folder, path);
  const poster = await copy(art.poster);
  const backdrop = await copy(art.backdrop);
  const seasonPosters: SeasonPosterPath[] = [];
  for (const { season, path } of art.seasonPosters ?? []) {
    seasonPosters.push({
      season,
      path: await media.copyIn(media.seasonFolder(folder, season), path),
    });
  }
  return { poster, backdrop, seasonPosters };
}
