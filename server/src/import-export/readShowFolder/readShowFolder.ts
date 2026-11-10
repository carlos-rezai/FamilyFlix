import { basename, relative } from 'node:path';

import { readableFolder } from '../../media/readableFolder/readableFolder';
import {
  readLooseFiles,
  readSeasonFolder,
  readSeasonFolders,
  type SeasonFolderScan,
} from '../../media/readTitleFolder/readTitleFolder';
import { isSeasonFolder } from '../../media/seasonNumberOf/seasonNumberOf';
import type { StoredLibraryFolder } from '../../library';
import type { HeldTitle } from '../../library/holding/holding';
import {
  numberShow,
  showFolderOf,
  type ShowScan,
} from '../numberShow/numberShow';
import { heldByVideo } from '../heldByVideo/heldByVideo';
import { listedFolderOf } from '../listedFolderOf/listedFolderOf';
import { sourceFileOf } from '../placeFilmFolder/placeFilmFolder';
import { titleGuess } from '../titleKey/titleKey';
import type { ShowFolderEpisode, ShowFolderRead } from '@/types';

/** Why a picked folder was not read: it cannot be read, or holds no video. */
export type ShowFolderRefusal = 'unreadable' | 'empty';

/** What {@link readShowFolder} came to — the route words each refusal. */
export type ShowFolderAnswer =
  | { kind: 'read'; read: ShowFolderRead }
  | { kind: 'refused'; refusal: ShowFolderRefusal };

/**
 * What the caller knows of the library: the listed **Library folders**, and
 * the held series on record at a folder relative to one of them.
 */
export interface ShowFolderContext {
  folders: readonly StoredLibraryFolder[];
  /** The held series whose **Source folder** this is, `null` for none. */
  heldSeriesAt(folderId: string, sourceFolder: string): string | null;
  /** The **Held video** rule: the title playing a video, `null` for none. */
  titleHolding(folderId: string, videoPath: string): HeldTitle | null;
}

/** What a pick holds: its numbered show, or its loose videos. */
interface PickedFolder {
  show: ShowScan | null;
  loose: string[];
}

/**
 * What a pick holds: a picked **Season folder** its own season, numbered as
 * its show; a folder of loose videos those videos, not descended; any other
 * folder its Season folders by `readSeasonFolders`, numbered by `numberShow`,
 * the scan's own rules. Throws when the folder cannot be read.
 */
async function showUnder(
  dir: string,
  showFolder: string
): Promise<PickedFolder> {
  const number = (seasons: SeasonFolderScan[]): ShowScan =>
    numberShow({
      dir: showFolder,
      name: basename(showFolder),
      poster: null,
      backdrop: null,
      seasons,
    });
  if (isSeasonFolder(basename(dir))) {
    return { show: number([await readSeasonFolder(dir)]), loose: [] };
  }
  const { videos } = await readLooseFiles(dir);
  if (videos.length > 0) {
    return { show: null, loose: videos };
  }
  return { show: number(await readSeasonFolders(dir)), loose: [] };
}

/**
 * Read one absolute folder picked on the series add as a **Show folder
 * read**: read by `readSeasonFolders`, numbered with `numberShow` (there is
 * no second numbering rule), so a **Season folder**'s number beats the
 * filename's, and each episode keeps the tracks of its `Subtitles/S01E01/`
 * folder. A folder of loose videos, tagged ones included, answers them as
 * **Unplaced**, its subfolders not read. The **Title guess** is the importer's own rule on
 * the folder's name. A picked **Season folder** reads only its own videos but
 * stands for its Show folder (`showFolderOf`): titled by the show's name,
 * held-checked as the show, each path answered inside the show.
 *
 * Its `libraryFolderId` is the listed **Library folder** it lies inside, by
 * `listedFolderOf`, or `null`. A folder that is already a held series's
 * **Show folder** (the folder on record under that Library folder, as
 * `heldSeriesAt` answers) is still read, its `heldSeriesId` set to that
 * series's id; the form draws the refusal. So is a folder any one of whose
 * videos a held series plays, by the **Held video** rule (`titleHolding`): a
 * renamed show's folder reads as its series. A folder under no Library folder
 * has no folder on record, so it is never held.
 *
 * A folder that cannot be read is `unreadable`; one holding no video is
 * `empty`. Answered as a value, never a throw.
 */
export async function readShowFolder(
  dir: string,
  context: ShowFolderContext
): Promise<ShowFolderAnswer> {
  if ((await readableFolder(dir)) !== 'readable') {
    return { kind: 'refused', refusal: 'unreadable' };
  }
  // A picked **Season folder** is read for its own videos, but titled,
  // held-checked and spelled by its Show folder.
  // The Show folder is each episode's Source folder, so a video's path
  // inside it is its **Source file**.
  const showFolder = showFolderOf(dir);
  let read: PickedFolder;
  try {
    read = await showUnder(dir, showFolder);
  } catch {
    return { kind: 'refused', refusal: 'unreadable' };
  }
  const episodes: ShowFolderEpisode[] = (read.show?.episodes ?? [])
    .map((episode) => ({
      season: episode.season,
      number: episode.episode,
      title: episode.title,
      video: episode.video,
      relativePath: sourceFileOf(showFolder, episode.video),
      subtitles: episode.subtitles.map(({ path, language }) => ({
        path,
        language,
      })),
    }))
    .sort((a, b) => a.season - b.season || a.number - b.number);
  const unplaced = [...(read.show?.unplaced ?? []), ...read.loose];
  if (episodes.length === 0 && unplaced.length === 0) {
    return { kind: 'refused', refusal: 'empty' };
  }

  const listed = listedFolderOf(context.folders, dir);
  return {
    kind: 'read',
    read: {
      path: dir,
      titleGuess: titleGuess(basename(showFolder)),
      libraryFolderId: listed?.id ?? null,
      heldSeriesId:
        listed === null
          ? null
          : (context.heldSeriesAt(
              listed.id,
              relative(listed.path, showFolder)
            ) ??
            heldByVideo(
              context.titleHolding,
              listed,
              [...episodes.map((episode) => episode.video), ...unplaced],
              'series'
            )),
      episodes,
      unplaced: unplaced.map((video) => ({
        video,
        relativePath: sourceFileOf(showFolder, video),
      })),
      straySubtitles: read.show?.straySubtitles.length ?? 0,
    },
  };
}
