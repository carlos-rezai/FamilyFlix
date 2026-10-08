import { useSearchParams } from 'react-router-dom';

import { PillTabs } from '@/components';
import { useQueryParamWriter } from '@/features/search/useQueryParamWriter/useQueryParamWriter';

const TABS = [
  { value: 'movies', label: 'Movies' },
  { value: 'series', label: 'Series' },
] as const;

/**
 * The Movies / Series switch — the **Pill tabs**, first in the library
 * header's start slot. `tab` is written through the query-param writer as a
 * `replace` and omitted at `movies`; a switch clears the search in the same
 * write and keeps genre, rating and sort.
 */
export function LibraryTabs() {
  const [searchParams] = useSearchParams();
  const current = searchParams.get('tab') === 'series' ? 'series' : 'movies';
  const setParam = useQueryParamWriter();

  return (
    <PillTabs
      label="Library"
      options={TABS}
      value={current}
      onChange={(tab) => setParam('tab', tab, 'movies', ['q'])}
    />
  );
}
