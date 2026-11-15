import type { StartExport, Subtitle } from '@/types';
import { spellEpisodeTag } from '../../media/episodeTag/episodeTag';
import {
  IMAGES_FOLDER,
  spellTrackName,
  STILLS_FOLDER,
  SUBTITLES_FOLDER,
} from '../../media/folderLayout/folderLayout';
import {
  basenameOf,
  safeName,
  type ImagePlace,
  type PathCells,
  type TracksPlace,
  videoCell,
} from '../exportRows/exportRows';

/**
 * One file of the **File plan**: a **Stored path**, and the relative,
 * forward-slash path it is written to inside the **Export folder**.
 */
export interface ExportFile {
  storedPath: string;
  path: string;
}

/** What travels beside the sheet: the two toggles of _Include_. */
export type ExportInclude = Pick<StartExport, 'images' | 'subtitles'>;

/** The Export's **File plan**: its **Path cells** and the files they planned. */
export interface FilePlan {
  cells: PathCells;
  files: ExportFile[];
}

/** A stored file's own extension, its dot included; `''` for none. */
function extensionOf(storedPath: string): string {
  const name = basenameOf(storedPath);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot) : '';
}

/** A title's tracks in track order. */
const inTrackOrder = (subtitles: readonly Subtitle[]): Subtitle[] =>
  [...subtitles].sort((a, b) => a.position - b.position);

/**
 * A place's **Season folder name** under its Title folder,
 * `Death Note/Season 1`: the one its season lies under, else `Season 01`.
 */
const seasonDir = (place: { folder: string; seasonFolder: string }): string =>
  `${place.folder}/${place.seasonFolder}`;

/** The folder an image place's file lies in, and its name before the extension. */
function imageTarget(place: ImagePlace): { dir: string; name: string } {
  switch (place.kind) {
    case 'poster':
    case 'backdrop':
      return { dir: `${place.folder}/${IMAGES_FOLDER}`, name: place.kind };
    case 'season-poster':
      return {
        dir: `${seasonDir(place)}/${IMAGES_FOLDER}`,
        name: 'poster',
      };
    case 'still':
      return {
        dir: `${seasonDir(place)}/${IMAGES_FOLDER}/${STILLS_FOLDER}`,
        name: spellEpisodeTag(place.season, place.episode),
      };
  }
}

/** The folder a track place's files lie in. */
function tracksDir(place: TracksPlace): string {
  return !('season' in place)
    ? `${place.folder}/${SUBTITLES_FOLDER}`
    : `${seasonDir(place)}/${SUBTITLES_FOLDER}/${spellEpisodeTag(place.season, place.episode)}`;
}

/**
 * The Export's **File plan** (log 59): the **Path cells** `exportRows` fills
 * its path cells from, each answer the **Layout place**'s path in the
 * **Folder layout** relative to the **Export folder**, and the files those
 * answers planned. The layout less the videos (log 58, Q19): art under each
 * **Title folder**'s or Season folder's `Images/`, Stills (Frame stills too)
 * under the Season folder's `Images/Stills/` by **Episode tag**, a film's
 * tracks under `Subtitles/` by language and an episode's under the Season
 * folder's `Subtitles/<tag>/`, a second of one language `(2)`. The **Season
 * folder name** is the one the place's season lies under (`Death
 * Note/Season 1`), the folder its Video cells name, else `Season 01`. A cell
 * is blank where nothing travels (no stored file, or its toggle off). `Video`
 * names where the video lies, by `exportRows`' own `videoCell`; no video is
 * planned.
 */
export function filePlan(include: ExportInclude): FilePlan {
  const files: ExportFile[] = [];
  const add = (storedPath: string, path: string): string => {
    files.push({ storedPath, path });
    return path;
  };

  const cells: PathCells = {
    image: (place, storedPath) => {
      if (!include.images || storedPath === null) {
        return null;
      }
      const { dir, name } = imageTarget(place);
      return add(storedPath, `${dir}/${name}${extensionOf(storedPath)}`);
    },
    tracks: (place, subtitles) => {
      if (!include.subtitles) {
        return [];
      }
      const dir = tracksDir(place);
      const seen = new Map<string, number>();
      return inTrackOrder(subtitles).map((subtitle) => {
        const language = safeName(subtitle.language);
        const count = (seen.get(language.toLowerCase()) ?? 0) + 1;
        seen.set(language.toLowerCase(), count);
        const name = spellTrackName(language, count);
        return add(
          subtitle.path,
          `${dir}/${name}${extensionOf(subtitle.path)}`
        );
      });
    },
    video: videoCell,
  };

  return { cells, files };
}
