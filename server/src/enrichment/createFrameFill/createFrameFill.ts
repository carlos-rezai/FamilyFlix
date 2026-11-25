import type { LibraryStorage } from '../../library';
import type { Media } from '../../media/createMedia/createMedia';
import type { Playback } from '../../playback/createPlayback/createPlayback';
import { lateReserve } from '../lateReserve/lateReserve';
import { takeFrameStill } from '../takeFrameStill/takeFrameStill';

export interface FrameFillDeps {
  storage: Pick<
    LibraryStorage,
    | 'getSeriesDetail'
    | 'stillSourcesOf'
    | 'enrichEpisode'
    | 'mediaFolderOf'
    | 'recordMediaFolder'
  >;
  media: Media;
  playback: Pick<Playback, 'frame'>;
}

/**
 * The **Frame fill**: the background pass a series add or edit starts after
 * it answers, giving each **Episode** with no **Still** a **Frame still**.
 */
export interface FrameFill {
  /**
   * Fill one series, queued behind any fill in flight; a series already
   * waiting is filled once. Resolves when its turn is done; never rejects.
   */
  fill(seriesId: string): Promise<void>;
}

export function createFrameFill({
  storage,
  media,
  playback,
}: FrameFillDeps): FrameFill {
  /** The tail of the queue: the last fill's turn. */
  let tail: Promise<void> = Promise.resolve();
  /** The series waiting for their turn, each with that turn's promise. */
  const waiting = new Map<string, Promise<void>>();
  /** No take is ever stopped: the fill runs to its end. */
  const signal = new AbortController().signal;

  /** Whether the series is gone or the episode now holds a Still. */
  const unwanted = (seriesId: string, episodeId: string): boolean =>
    storage.getSeriesDetail(seriesId) === null ||
    storage.stillSourcesOf(seriesId).has(episodeId);

  async function run(seriesId: string): Promise<void> {
    const detail = storage.getSeriesDetail(seriesId);
    if (detail === null) return;
    const sources = storage.stillSourcesOf(seriesId);
    const stillLess = detail.seasons
      .flatMap((season) => season.episodes)
      .filter((each) => each.stillPath === null && !sources.has(each.id))
      .sort((a, b) => a.season - b.season || a.number - b.number);

    const folder = lateReserve({ storage, media }, 'series', detail.series);
    for (const episode of stillLess) {
      if (unwanted(seriesId, episode.id)) continue;
      const taken = await takeFrameStill(
        { playback, media },
        episode,
        () => {
          // Read again just before writing: a Still that landed wins.
          if (unwanted(seriesId, episode.id))
            throw new Error('the Still is no longer wanted');
          return folder();
        },
        signal
      );
      if (taken.kind !== 'stored') continue;
      if (unwanted(seriesId, episode.id)) {
        media.removeFile(taken.stored);
        continue;
      }
      storage.enrichEpisode(episode.id, {
        stillPath: taken.stored,
        stillSource: 'frame',
      });
    }
  }

  return {
    fill(seriesId) {
      const queued = waiting.get(seriesId);
      if (queued !== undefined) return queued;
      const turn = tail.then(() => {
        waiting.delete(seriesId);
        return run(seriesId).catch(() => undefined);
      });
      waiting.set(seriesId, turn);
      tail = turn;
      return turn;
    },
  };
}
