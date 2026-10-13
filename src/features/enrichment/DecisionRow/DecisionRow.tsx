import { useState } from 'react';

import { FieldDiff, type FieldDiffSide } from '@/components';
import { Button } from '@/primitives';
import type { ConflictChoices, ConflictField, Decision } from '@/types';
import { CandidatePicker } from '../CandidatePicker/CandidatePicker';
import { TitleSearch } from '../TitleSearch/TitleSearch';
import {
  Card,
  Dot,
  Head,
  Path,
  Reason,
  SkipSlot,
  Text,
  Title,
} from './DecisionRow.styles';

/** The diff's `'theirs'` read back as the Sync's own `'tmdb'`. */
const tmdbChoices = (
  choices: Partial<Record<ConflictField, FieldDiffSide>>
): ConflictChoices =>
  Object.fromEntries(
    Object.entries(choices).map(([field, side]) => [
      field,
      side === 'theirs' ? 'tmdb' : 'mine',
    ])
  );

export interface DecisionRowProps {
  decision: Decision;
  onSkip: () => void;
  onPick: (tmdbId: number) => void;
  onSearch: (query: string) => void;
  /** _Apply choices_ on a `conflict` row: the side chosen for each field. */
  onApply: (choices: ConflictChoices) => void;
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
        <FieldDiff<ConflictField>
          rows={decision.fields.map(({ field, label, mine, tmdb }) => ({
            key: field,
            label,
            mine,
            theirs: tmdb,
          }))}
          theirsLabel="TMDB"
          onApply={(choices) => onApply(tmdbChoices(choices))}
          onKeepAll={onSkip}
        />
      ) : null}
    </Card>
  );
}
