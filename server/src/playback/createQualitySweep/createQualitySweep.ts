import type { LibraryStorage } from '../../library';
import type { Playback } from '../createPlayback/createPlayback';

/** What the **Quality sweep** reads and writes through, and measures with. */
export interface QualitySweepDeps {
  storage: Pick<LibraryStorage, 'unmeasuredVideos' | 'recordVideoQuality'>;
  playback: Pick<Playback, 'videoFile' | 'measure'>;
}

/** The **Quality sweep**: one background pass over the unmeasured videos. */
export interface QualitySweep {
  /** Measure every unmeasured video, one at a time; resolves when it ends. */
  start(): Promise<void>;
  /** End the run after the file in hand, writing nothing more. */
  stop(): Promise<void>;
}

/** Hand the event loop a turn, so a waiting request is served. */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * The **Quality sweep**: every held movie and episode with no **Video
 * quality**, movies first A to Z, then episodes, measured one file at a time
 * and written through `recordVideoQuality`, that one column alone.
 *
 * A row with no file, or whose video is `missing` or `unreachable`, is passed
 * over; a row the probe could not read stays `NULL`, so the next start asks
 * it again. Between two files it yields to the event loop, so a request
 * waits behind at most one probe.
 *
 * It never throws: a failure on one row costs that row its quality and
 * nothing else.
 */
export function createQualitySweep({
  storage,
  playback,
}: QualitySweepDeps): QualitySweep {
  let stopped = false;
  let running: Promise<void> | null = null;

  const run = async (): Promise<void> => {
    for (const video of storage.unmeasuredVideos()) {
      await yieldToEventLoop();
      if (stopped) {
        return;
      }
      if (video.videoPath === '') {
        continue;
      }
      try {
        const found = playback.videoFile(video);
        if (found.kind !== 'file') {
          continue;
        }
        const { quality } = playback.measure(found.file);
        if (stopped) {
          return;
        }
        if (quality !== null) {
          storage.recordVideoQuality(video.kind, video.id, quality);
        }
      } catch {
        // One unreadable row is passed over, never the whole run.
      }
    }
  };

  return {
    start() {
      running ??= run().finally(() => {
        running = null;
      });
      return running;
    },
    async stop() {
      stopped = true;
      await running;
    },
  };
}
