import { VIDEO_QUALITIES, type VideoQuality } from '@/types';

/**
 * The minimums the Quality pill can ask for, best first: the **Quality
 * ladder** without SD, whose row would keep everything measured and only look
 * like a filter.
 *
 * Deliberately the pill's whole vocabulary rather than the ladder's, as
 * `RATING_CUTOFFS` is the rating's: the route is a general API over every
 * rung, but a client-side minimum the pill has no row for (a `?quality=sd`
 * that no row can write) would narrow the library behind a pill still saying
 * "All qualities".
 */
export const QUALITY_CUTOFFS: readonly VideoQuality[] = VIDEO_QUALITIES.filter(
  (rung) => rung !== 'SD'
);

/**
 * Reads a URL's `?quality=` as the minimum the library is filtered by, or
 * `undefined` for no minimum at all. A cut-off reads only as the pill writes
 * it, lowercased (`4k`, `1080p`); absent, empty, SD, another case or a value
 * off the ladder is no minimum.
 *
 * A util rather than a feature-local helper for `parseMinRating`'s reason:
 * the search feature draws the pill and the library feature builds the
 * request, each from the URL, and they must agree exactly.
 */
export function parseMinQuality(
  value: string | null
): VideoQuality | undefined {
  return QUALITY_CUTOFFS.find((rung) => rung.toLowerCase() === value);
}
