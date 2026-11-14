import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { LibraryQuery } from '@/types';
import { parseLibraryQuery, toLibraryQueryParams } from '@/utils';

export interface SettledLibraryQuery {
  /**
   * The **Settled query** written back out the way the URL spells it: the
   * **Load key** a browse body hands `useBrowseLoad`.
   */
  settled: string;
  /** The **Settled query** itself, one identity for as long as `settled` holds. */
  query: LibraryQuery;
}

/**
 * The URL's **Library query**, settled, for the four **Library tab** bodies.
 *
 * It is written back out the way the URL spells it first: the shared parser's
 * answer, so a stale, hand-edited or hostile URL is made safe here by exactly
 * the rules the header's pills read it by. Reducing it to that canonical
 * string is what decides when a body reloads: only the parts a body reads are
 * in it, at their settled values, so a scroll offset arriving, an empty
 * `?genre=`, or a sort spelled at the default it was already in all leave the
 * string alone and reload nothing.
 *
 * The query is read back from that canonical form, so an unchanged string
 * keeps one identity for the load. It yields what the URL says because the
 * two functions are inverses, a property their own test asserts.
 */
export function useSettledLibraryQuery(): SettledLibraryQuery {
  const [searchParams] = useSearchParams();
  const settled = toLibraryQueryParams(
    parseLibraryQuery(searchParams)
  ).toString();
  const query = useMemo(
    () => parseLibraryQuery(new URLSearchParams(settled)),
    [settled]
  );
  return { settled, query };
}
