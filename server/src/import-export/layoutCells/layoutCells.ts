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
 * keyed by the folder's own name, and every cell is relative to `root`, the
 * **Library folder**, with forward slashes. A cell names what the folder
 * holds at its **Layout place**, never what storage holds: a poster or backdrop by its own name, a
 * **Season poster**, a **Still** by its **Episode tag**, every track of the
 * place's `Subtitles/` by its own name. A **Frame still**, a place the folder
 * holds nothing in, and a folder with no read (or one left out) are blank.
 * `Video` names where the video lies, as the **File plan** does, for a folder
 * that was read. Plans nothing.
 */
export function layoutCells(
  reads: ReadonlyMap<string, TitleFolderScan>,
  root: string
): PathCells {
  const cell = (path: string): string =>
    relative(root, path).split(sep).join('/');
  const cellOrNull = (path: string | null | undefined): string | null =>
    path ? cell(path) : null;

  const readOf = (folder: string) => {
    const read = reads.get(folder);
    return read === undefined || read.kind === 'left-out' ? null : read;
  };
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
          return cellOrNull(readOf(place.folder)?.[place.kind]);
        case 'season-poster':
          return cellOrNull(seasonOf(place.folder, place.season)?.poster);
        case 'still':
          return cellOrNull(
            seasonOf(place.folder, place.season)?.stills[
              spellEpisodeTag(place.season, place.episode)
            ]
          );
      }
    },
    tracks: (place) => {
      if (place.season === undefined || place.episode === undefined) {
        const read = readOf(place.folder);
        return read?.kind === 'film'
          ? read.subtitles.map((track) => cell(track.path))
          : [];
      }
      const tag = spellEpisodeTag(place.season, place.episode);
      return (seasonOf(place.folder, place.season)?.subtitles ?? [])
        .filter((track) => basename(dirname(track.path)) === tag)
        .map((track) => cell(track.path));
    },
    video: (place, storedPath) =>
      readOf(place.folder) === null ? null : videoCell(place, storedPath),
  };
}
