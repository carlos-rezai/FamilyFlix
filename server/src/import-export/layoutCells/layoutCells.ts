import { dirname, basename, relative, sep } from 'node:path';

import { spellEpisodeTag } from '../../media/episodeTag/episodeTag';
import type {
  SeasonFolderScan,
  TitleFolderScan,
} from '../../media/readTitleFolder/readTitleFolder';
import { videoCell, type PathCells } from '../exportRows/exportRows';

/**
 * The **Library sheet**'s **Path cells** from the **Layout read** (log 59):
 * `reads` holds each recorded **Title folder** as `readTitleFolder` read it,
 * keyed by its **Folder key**, and every cell is relative to the folder
 * holding that Title folder, with forward slashes, so it starts with the
 * Title folder's own name wherever in the **Library folder** it lies. A cell
 * names what the folder holds at its **Layout place**, never what storage holds: a poster or
 * backdrop by its own name, a **Season poster**, a **Still** by its **Episode
 * tag**, every track of the place's `Subtitles/` by its own name. A **Frame
 * still**, a place the folder holds nothing in, and a folder with no read (or
 * one left out) are blank. `Video` names where the video lies, by
 * `exportRows`' own `videoCell`, for a folder that was read. Plans nothing.
 */
export function layoutCells(
  reads: ReadonlyMap<string, TitleFolderScan>
): PathCells {
  const readOf = (folder: string) => {
    const read = reads.get(folder);
    return read === undefined || read.kind === 'left-out' ? null : read;
  };
  /** `path` as a cell: relative to the folder holding `folder`'s read. */
  const cellIn = (folder: string, path: string): string =>
    relative(dirname(reads.get(folder)?.dir ?? ''), path)
      .split(sep)
      .join('/');
  const cellOrNull = (
    folder: string,
    path: string | null | undefined
  ): string | null => (path ? cellIn(folder, path) : null);
  const seasonOf = (
    folder: string,
    season: number
  ): SeasonFolderScan | null => {
    const read = readOf(folder);
    return read?.kind === 'series'
      ? (read.seasons.find((scan) => scan.number === season) ?? null)
      : null;
  };

  return {
    image: (place) => {
      switch (place.kind) {
        case 'poster':
        case 'backdrop':
          return cellOrNull(place.folder, readOf(place.folder)?.[place.kind]);
        case 'season-poster':
          return cellOrNull(
            place.folder,
            seasonOf(place.folder, place.season)?.poster
          );
        case 'still':
          return cellOrNull(
            place.folder,
            seasonOf(place.folder, place.season)?.stills[
              spellEpisodeTag(place.season, place.episode)
            ]
          );
      }
    },
    tracks: (place) => {
      if (!('season' in place)) {
        const read = readOf(place.folder);
        return read?.kind === 'film'
          ? read.subtitles.map((track) => cellIn(place.folder, track.path))
          : [];
      }
      const tag = spellEpisodeTag(place.season, place.episode);
      return (seasonOf(place.folder, place.season)?.subtitles ?? [])
        .filter((track) => basename(dirname(track.path)) === tag)
        .map((track) => cellIn(place.folder, track.path));
    },
    video: (place, storedPath) =>
      readOf(place.folder) === null ? null : videoCell(place, storedPath),
  };
}
