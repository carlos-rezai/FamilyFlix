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
  /** `path` as a cell: relative to the folder holding `read`'s folder. */
  const cellIn = (read: TitleFolderScan, path: string): string =>
    relative(dirname(read.dir), path).split(sep).join('/');
  const cellOrNull = (
    read: TitleFolderScan | null,
    path: string | null | undefined
  ): string | null => (read !== null && path ? cellIn(read, path) : null);
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
      const read = readOf(place.folder);
      switch (place.kind) {
        case 'poster':
        case 'backdrop':
          return cellOrNull(read, read?.[place.kind]);
        case 'season-poster':
          return cellOrNull(read, seasonOf(place.folder, place.season)?.poster);
        case 'still':
          return cellOrNull(
            read,
            seasonOf(place.folder, place.season)?.stills[
              spellEpisodeTag(place.season, place.episode)
            ]
          );
      }
    },
    tracks: (place) => {
      const read = readOf(place.folder);
      if (read === null) {
        return [];
      }
      if (!('season' in place)) {
        return read.kind === 'film'
          ? read.subtitles.map((track) => cellIn(read, track.path))
          : [];
      }
      const tag = spellEpisodeTag(place.season, place.episode);
      return (seasonOf(place.folder, place.season)?.subtitles ?? [])
        .filter((track) => basename(dirname(track.path)) === tag)
        .map((track) => cellIn(read, track.path));
    },
    video: (place, storedPath) =>
      readOf(place.folder) === null ? null : videoCell(place, storedPath),
  };
}
