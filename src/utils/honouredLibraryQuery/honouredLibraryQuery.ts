import type { LibraryQuery } from '@/types';

/**
 * The **Library query** as the browse honours it under _Show video quality_:
 * the whole query while the toggle is on, and without its `minQuality` while
 * it is off, every other field untouched.
 *
 * `?quality=` is read past, never rewritten: `parseLibraryQuery` still reads
 * it whatever the toggle, and the URL keeps it, so turning the toggle back on
 * asks for the filter again.
 *
 * A util rather than a feature helper for `parseMinRating`'s reason: the
 * search feature draws the pills from the query and the library feature
 * builds the browse request from it, independently, and they must agree.
 */
export function honouredLibraryQuery(
  query: LibraryQuery,
  qualityTags: boolean
): LibraryQuery {
  if (qualityTags || query.minQuality === undefined) {
    return query;
  }
  const honoured = { ...query };
  delete honoured.minQuality;
  return honoured;
}
