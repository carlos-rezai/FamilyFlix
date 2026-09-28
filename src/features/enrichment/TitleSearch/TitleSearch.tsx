import { useState } from 'react';

import { Button } from '@/primitives';
import { SearchInput, SearchRow } from './TitleSearch.styles';

export interface TitleSearchProps {
  /** The box's prefill: the title, or what TMDB was last asked. */
  initial: string;
  /** _Search_ or Enter, with the query as typed. */
  onSearch: (query: string) => void;
}

const PLACEHOLDER = 'Search TMDB by title and year';

/**
 * The review's search box, from `feat.EnrichmentFlow.dc.html`: the 44px input,
 * prefilled, and _Search_ as a secondary button — a `missing` **Decision**'s
 * face, and an `ambiguous` one's after _Search by title_. It holds what is
 * typed and reports it on _Search_ or Enter.
 */
export function TitleSearch({ initial, onSearch }: TitleSearchProps) {
  const [query, setQuery] = useState(initial);
  return (
    <SearchRow>
      <SearchInput
        value={query}
        placeholder={PLACEHOLDER}
        aria-label={PLACEHOLDER}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSearch(query);
        }}
      />
      <Button
        label="Search"
        variant="secondary"
        size="md"
        onClick={() => onSearch(query)}
      />
    </SearchRow>
  );
}
