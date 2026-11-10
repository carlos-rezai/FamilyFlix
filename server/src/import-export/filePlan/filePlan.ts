import type { Subtitle } from '@/types';
import { spellEpisodeTag } from '../../media/episodeTag/episodeTag';
import {
  IMAGES_FOLDER,
  spellTrackName,
  STILLS_FOLDER,
  SUBTITLES_FOLDER,
} from '../../media/folderLayout/folderLayout';
import { spellSeasonFolder } from '../../media/seasonNumberOf/seasonNumberOf';
import {
  basenameOf,
  safeName,
  type ExportFile,
  type ExportInclude,
  type ImagePlace,
  type PathCells,
  type TracksPlace,
  videoCell,
} from '../exportRows/exportRows';

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

/** A Season folder under its Title folder, `Heat (1995)/Season 01`. */
const seasonDir = (folder: string, season: number): string =>
  `${folder}/${spellSeasonFolder(season)}`;

/** The folder an image place's file lies in, and its name before the extension. */
function imageTarget(place: ImagePlace): { dir: string; name: string } {
  switch (place.kind) {
    case 'poster':
    case 'backdrop':
      return { dir: `${place.folder}/${IMAGES_FOLDER}`, name: place.kind };
    case 'season-poster':
      return {
        dir: `${seasonDir(place.folder, place.season)}/${IMAGES_FOLDER}`,
        name: 'poster',
      };
    case 'still':
      return {
        dir: `${seasonDir(place.folder, place.season)}/${IMAGES_FOLDER}/${STILLS_FOLDER}`,
        name: spellEpisodeTag(place.season, place.episode),
      };
  }
}

/** The folder a track place's files lie in. */
function tracksDir(place: TracksPlace): string {
  return place.season === undefined || place.episode === undefined
    ? `${place.folder}/${SUBTITLES_FOLDER}`
    : `${seasonDir(place.folder, place.season)}/${SUBTITLES_FOLDER}/${spellEpisodeTag(place.season, place.episode)}`;
}

/**
 * The Export's **File plan** (log 59): the **Path cells** `exportRows` fills
 * its path cells from, each answer the **Layout place**'s path in the
 * **Folder layout** relative to the **Export folder**, and the files those answers planned.
 * The layout less the videos (log 58, Q19): art under each **Title folder**'s
 * or Season folder's `Images/`, Stills (Frame stills too) under
 * `Season NN/Images/Stills/` by **Episode tag**, a film's tracks under
 * `Subtitles/` by language and an episode's under `Season NN/Subtitles/<tag>/`,
 * a second of one language `(2)`. A cell is blank where nothing travels (no
 * stored file, or its toggle off). `Video` names where the video lies, a
 * film's one loose video or an episode's **Source file**, case kept, the
 * spelled Season folder only for one with none; no video is planned.
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
