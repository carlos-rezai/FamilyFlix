import { PillTabs } from '@/components';
import { useLibraryTab } from '@/hooks/useLibraryTab/useLibraryTab';
import { useQueryParamWriter } from '@/hooks/useQueryParamWriter/useQueryParamWriter';
import { libraryTabOptions } from '@/utils';

/**
 * The Movies / Series switch — the **Pill tabs**, first in the library
 * header's start slot. `tab` is written through the query-param writer as a
 * `replace` and omitted at `movies`; a switch clears the search in the same
 * write and keeps genre, rating and sort.
 */
export function LibraryTabs() {
  const current = useLibraryTab();
  const setParam = useQueryParamWriter();

  return (
    <PillTabs
      label="Library"
      options={libraryTabOptions()}
      value={current}
      onChange={(tab) => setParam('tab', tab, 'movies', ['q'])}
    />
  );
}
