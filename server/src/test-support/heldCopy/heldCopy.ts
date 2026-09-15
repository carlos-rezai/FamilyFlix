import type { Media } from '../../media/createMedia/createMedia';

/**
 * A `Media` whose first copy — or the first of the file named, when one is —
 * waits until the test lets it go, and says when it has got there: the one
 * way to have a **Bulk import** run reliably mid-copy for as long as an
 * assertion needs, whether it is cancel, a second start or a poll that is
 * being asked about.
 *
 * Two suites wrote this before it moved here — the importer's and the route's
 * — and they differed in the one thing that matters: the importer's forwarded
 * every argument, so the cancel signal reached the real copy, and the route's
 * called `real.copyIn(folder, source)` and dropped it. This one forwards
 * everything, so a test that holds a copy and then cancels is holding the
 * copy the signal will abort.
 *
 * A test double's neighbour rather than backend logic — nothing that ships
 * imports it.
 */
export function heldCopy(filename = ''): {
  /** Wraps the real `Media` the domain is composed over. */
  seam: (real: Media) => Media;
  /** Resolves once the held copy has been asked for and is waiting. */
  reached: Promise<void>;
  /** Lets the held copy go on to the real one. */
  release: () => void;
} {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrive: () => void = () => undefined;
  const reached = new Promise<void>((resolve) => {
    arrive = resolve;
  });
  let held = false;
  return {
    reached,
    release: () => release(),
    seam: (real) => ({
      ...real,
      copyIn: async (...args) => {
        if (!held && args[1].endsWith(filename)) {
          held = true;
          arrive();
          await gate;
        }
        return real.copyIn(...args);
      },
    }),
  };
}
