import { useSearchParams } from 'react-router-dom';

import { useQueryParamWriter } from '@/features/search/useQueryParamWriter/useQueryParamWriter';
import { Tab, Track } from './LibraryTabs.styles';

type LibraryTab = 'movies' | 'series';

const TABS: readonly { tab: LibraryTab; label: string }[] = [
  { tab: 'movies', label: 'Movies' },
  { tab: 'series', label: 'Series' },
];

/**
 * The Movies / Series switch — the prototype's pill track, first in the
 * library header's start slot. `tab` is written through the query-param writer
 * as a `replace` and omitted at `movies`; a switch clears the search in the
 * same write and keeps genre, rating and sort.
 */
export function LibraryTabs() {
  const [searchParams] = useSearchParams();
  const current: LibraryTab =
    searchParams.get('tab') === 'series' ? 'series' : 'movies';
  const setParam = useQueryParamWriter();

  return (
    <Track role="group" aria-label="Library">
      {TABS.map(({ tab, label }) => (
        <Tab
          key={tab}
          type="button"
          $active={tab === current}
          aria-pressed={tab === current}
          onClick={() => setParam('tab', tab, 'movies', ['q'])}
        >
          {label}
        </Tab>
      ))}
    </Track>
  );
}
