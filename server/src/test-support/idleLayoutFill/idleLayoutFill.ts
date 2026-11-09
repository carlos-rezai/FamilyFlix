import type { LayoutFill } from '../../import-export/createLayoutFill/createLayoutFill';

/**
 * A **Layout fill** that writes nothing: every title answers no file written
 * and no line. For the suites that compose the importer for something else
 * and must still hand it a Layout fill, leaving their Library folders as the
 * fixture left them.
 */
export function idleLayoutFill(): LayoutFill {
  return {
    fill: () => Promise.resolve({ written: [], lines: [] }),
  };
}
