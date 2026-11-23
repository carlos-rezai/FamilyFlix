import type { LibraryStorage } from '../../library';
import type { Media } from '../createMedia/createMedia';

/** What the **Art sweep** reads the held art through, and fits it with. */
export interface ArtSweepDeps {
  storage: Pick<LibraryStorage, 'heldArt'>;
  media: Pick<Media, 'fitStored'>;
}

/** The **Art sweep**: one background pass over the held art. */
export interface ArtSweep {
  /**
   * Fit every held picture over its box, one at a time; resolves when it
   * ends.
   */
  start(): Promise<void>;
  /** End the run after the picture in hand, fitting no more. */
  stop(): Promise<void>;
}

/** Hand the event loop a turn, so a waiting request is served. */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * The **Art sweep**, the **Quality sweep**'s twin: every picture
 * `storage.heldArt()` names, handed one at a time to `media.fitStored`, which
 * fits only one over its **Art box** and leaves the rest as they are. Between
 * two it yields to the event loop, so a request waits behind at most one fit.
 *
 * No column, flag or migration: a fitted picture is within its box, so a
 * later start asks nothing of it, and one left as it was (no component, a
 * failed fit, a file held open) is asked again on the next start. It never
 * throws, and it downloads nothing.
 */
export function createArtSweep({ storage, media }: ArtSweepDeps): ArtSweep {
  let stopped = false;
  let running: Promise<void> | null = null;

  const run = async (): Promise<void> => {
    for (const storedPath of storage.heldArt()) {
      await yieldToEventLoop();
      if (stopped) {
        return;
      }
      try {
        await media.fitStored(storedPath);
      } catch {
        // One picture that will not fit is passed over, never the whole run.
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
