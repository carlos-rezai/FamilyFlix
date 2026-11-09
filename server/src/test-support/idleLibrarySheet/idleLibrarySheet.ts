import type { LibrarySheet } from '../../import-export/createLibrarySheet/createLibrarySheet';

/**
 * A **Library sheet writer** that writes nothing: every touch, hold and
 * release is let go, and a flush settles at once. For the suites that compose
 * the importer or the shutdown for something else and must still hand it a
 * Library sheet, without the real one's timer.
 */
export function idleLibrarySheet(): LibrarySheet {
  return {
    touch: () => undefined,
    flush: () => Promise.resolve(),
    hold: () => undefined,
    release: () => undefined,
  };
}
