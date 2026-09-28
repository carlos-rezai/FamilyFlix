import { useState } from 'react';

import { Button } from '@/primitives';
import type { ConflictChoices, Decision } from '@/types';
import { CandidatePicker } from '../CandidatePicker/CandidatePicker';
import { FieldDiff } from '../FieldDiff/FieldDiff';
import {
  Card,
  Dot,
  Head,
  Path,
  Reason,
  SearchInput,
  SearchRow,
  SkipSlot,
  Text,
  Title,
} from './DecisionRow.styles';

export interface DecisionRowProps {
  decision: Decision;
  onSkip: () => void;
  onPick: (tmdbId: number) => void;
  onSearch: (query: string) => void;
  /** _Apply choices_ on a `conflict` row: the side chosen for each field. */
  onApply: (choices: ConflictChoices) => void;
}

/** The search box, prefilled, and _Search_ reporting the query as typed. */
function TitleSearch({
  initial,
  onSearch,
}: {
  initial: string;
  onSearch: (query: string) => void;
}) {
  const [query, setQuery] = useState(initial);
  return (
    <SearchRow>
      <SearchInput
        value={query}
        placeholder="Search TMDB by title and year"
        aria-label="Search TMDB by title and year"
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

/**
 * One **Decision row** of the review, from `feat.EnrichmentFlow.dc.html`: the
 * dot by kind, the title, the reason, the path when known, and _Skip_; then
 * one face — the candidate picker for `ambiguous`, the search box for
 * `missing`, the field diff for `conflict`, whose _Keep all mine_ is a Skip.
 * It draws a Decision and reports presses, nothing more.
 */
export function DecisionRow({
  decision,
  onSkip,
  onPick,
  onSearch,
  onApply,
}: DecisionRowProps) {
  const [searching, setSearching] = useState(false);

  return (
    <Card>
      <Head>
        <Dot $kind={decision.kind} />
        <Text>
          <Title>{decision.title}</Title>
          <Reason>{decision.reason}</Reason>
          {decision.path === null ? null : <Path>{decision.path}</Path>}
        </Text>
        <SkipSlot>
          <Button label="Skip" variant="ghost" size="md" onClick={onSkip} />
        </SkipSlot>
      </Head>

      {decision.kind === 'ambiguous' && !searching ? (
        <CandidatePicker
          candidates={decision.candidates}
          onPick={onPick}
          onSearchByTitle={() => setSearching(true)}
        />
      ) : null}

      {decision.kind === 'ambiguous' && searching ? (
        <TitleSearch initial={decision.title} onSearch={onSearch} />
      ) : null}

      {decision.kind === 'missing' ? (
        <TitleSearch initial={decision.query} onSearch={onSearch} />
      ) : null}

      {decision.kind === 'conflict' ? (
        <FieldDiff
          fields={decision.fields}
          onApply={onApply}
          onKeepAll={onSkip}
        />
      ) : null}
    </Card>
  );
}
