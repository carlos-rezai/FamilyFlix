/**
 * Converts a movie's runtime from the minutes it is stored in to the seconds
 * every playback figure is measured in — or to `null` when the runtime is not
 * actually known.
 *
 * This exists to hold one rule in one place: **a runtime that is `null` or
 * non-positive is unknown.** A movie can reach the library without one (an
 * import that never learned it, a row typed by hand), and both callers of this
 * rule then have to answer the same question before they can do arithmetic:
 * the continue mapper, deciding whether the resume label can say "of 1:55" at
 * all, and the progress helper, deciding whether it can compute a real percent
 * or must fall back to its nominal sliver. They previously encoded it
 * separately and in opposite polarity — one asking "is it known", the other
 * "is it unknown" — which is two chances to disagree about the same movie.
 *
 * A fractional runtime is converted as given rather than rounded: callers
 * divide by this, so what to do about precision is theirs to decide.
 */
export function toRuntimeSeconds(runtimeMinutes: number | null): number | null {
  if (runtimeMinutes === null || runtimeMinutes <= 0) {
    return null;
  }
  return runtimeMinutes * 60;
}
