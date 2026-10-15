import { DASHES, searchQuery } from '../../import-export/titleKey/titleKey';

/** One rung of the **Search ladder**: what a TMDB search is sent. */
export interface SearchRung {
  query: string;
  year: number | null;
}

/** The first `:` or dash a subtitle follows, curly dashes included. */
const SUBTITLE_MARK = new RegExp(`:|${DASHES}`);

/**
 * The part of a title before its subtitle, as a **Search query** — or `null`
 * when there is no subtitle mark, or the part before it is one word.
 */
function beforeSubtitle(title: string): string | null {
  const mark = SUBTITLE_MARK.exec(title);
  if (mark === null) return null;
  const part = searchQuery(title.slice(0, mark.index));
  return part.split(' ').length >= 2 ? part : null;
}

/**
 * The **Search ladder**: a title and its year → the rungs a look-up climbs,
 * in order — the title with its year, then without it, then its **Search
 * query** without it, then the part before a `:` or `-` subtitle when that
 * part is two words or more, without it. A rung equal to one already listed
 * is dropped, so there are at most four and a plain title with no year is one.
 */
export function searchLadder(title: string, year: number | null): SearchRung[] {
  const subtitled = beforeSubtitle(title);
  const rungs: SearchRung[] = [
    { query: title, year },
    { query: title, year: null },
    { query: searchQuery(title), year: null },
    ...(subtitled === null ? [] : [{ query: subtitled, year: null }]),
  ];
  return rungs.filter(
    (rung, index) =>
      (index < 2 || rung.query !== '') &&
      rungs.findIndex(
        (each) => each.query === rung.query && each.year === rung.year
      ) === index
  );
}
