import type { Media } from '../../media/createMedia/createMedia';
import type { NewSubtitle, StoredVideo } from '@/types';

/** One episode of a series add, as far as its files go. */
export interface FoundEpisode {
  season: number;
  /** The picked video, once landed — absent for a **Found file** row. */
  video?: string;
  /** A Found file row's absolute video path. */
  videoPath?: string;
  /** A Found file row's absolute subtitle paths, each with its language. */
  storedSubtitles?: readonly NewSubtitle[];
}

/** One episode's files, where they now lie. */
export interface CopiedEpisode {
  video: StoredVideo;
  tracks: NewSubtitle[];
}

/**
 * Each episode of a series add placed on disk, in order: a **Placed video**
 * kept where it lies; a found video copied with `Media.copyIn` into its season
 * folder under the **Series folder** `folder` — copied, never moved, so the
 * picked folder is left as it was; a picked one's **Stored path**, through
 * `stored`; and its found subtitles copied beside it. Rejects on the first
 * copy that breaks — the caller takes the folder back.
 */
export async function copyFoundEpisodes(
  media: Media,
  folder: string | null,
  episodes: readonly FoundEpisode[],
  placed: readonly (StoredVideo | null)[],
  stored: (path: string) => string
): Promise<CopiedEpisode[]> {
  const copied: CopiedEpisode[] = [];
  for (const [index, episode] of episodes.entries()) {
    const season =
      folder === null ? null : media.seasonFolder(folder, episode.season);
    const copy = (path: string): Promise<string> => {
      if (season === null) {
        throw new Error('No Series folder to copy into');
      }
      return media.copyIn(season, path);
    };
    const video: StoredVideo = placed[index] ?? {
      videoPath:
        episode.video === undefined
          ? await copy(episode.videoPath ?? '')
          : stored(episode.video),
      videoFolderId: null,
    };
    const tracks: NewSubtitle[] = [];
    for (const track of episode.storedSubtitles ?? []) {
      tracks.push({ path: await copy(track.path), language: track.language });
    }
    copied.push({ video, tracks });
  }
  return copied;
}
