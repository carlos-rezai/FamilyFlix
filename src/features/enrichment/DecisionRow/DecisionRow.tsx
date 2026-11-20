import { useState } from 'react';

import { FieldDiff, type FieldDiffSide } from '@/components';
import { useBusyRow } from '@/hooks/useBusyRow/useBusyRow';
import { Button, LogoLoader } from '@/primitives';
import { BUSY_ROW_LOADER_SIZE } from '@/styles/busyRow';
import type {
  BusyPhase,
  ConflictChoices,
  ConflictField,
  Decision,
} from '@/types';
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

/** The presses a row is timed across, and what its loader reads for each. */
type Press = 'pick' | 'apply' | 'skip' | 'search';
const PRESS_LABELS: Record<Press, string> = {
  pick: 'Saving match…',
  apply: 'Updating details…',
  skip: 'Skipping…',
  search: 'Searching TMDB…',
};

export interface DecisionRowProps {
  decision: Decision;
  /**
   * The row's phase on the **Loader timing**, handed by the review: from
   * `waiting` it is locked, once `shown` its loader stands in the dot's slot.
   */
  busy?: BusyPhase;
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
 *
 * A **Busy row**: from `waiting` its root is `inert` and `aria-busy`, every
 * control keeping its own face; once `shown` it dims, and an 18px inline
 * **Logo loader** naming its press stands in the kind dot's slot.
 */
export function DecisionRow({
  decision,
  busy = 'idle',
  onSkip,
  onPick,
  onSearch,
  onApply,
}: DecisionRowProps) {
  const [searching, setSearching] = useState(false);
  const { pressed, label: pressLabel } = useBusyRow(busy, PRESS_LABELS);
  const skip = pressed('skip', onSkip);
  const search = pressed('search', onSearch);

  return (
    <Card $busy={busy}>
      <Head>
        {pressLabel !== null ? (
          <LogoLoader size={BUSY_ROW_LOADER_SIZE} inline label={pressLabel} />
        ) : (
          <Dot $kind={decision.kind} />
        )}
        <Text>
          <Title>{decision.title}</Title>
          <Reason>{decision.reason}</Reason>
          {decision.path === null ? null : <Path>{decision.path}</Path>}
        </Text>
        <SkipSlot>
          <Button label="Skip" variant="ghost" size="md" onClick={skip} />
        </SkipSlot>
      </Head>

      {decision.kind === 'ambiguous' && !searching ? (
        <CandidatePicker
          candidates={decision.candidates}
          onPick={pressed('pick', onPick)}
          onSearchByTitle={() => setSearching(true)}
        />
      ) : null}

      {decision.kind === 'ambiguous' && searching ? (
        <TitleSearch initial={decision.title} onSearch={search} />
      ) : null}

      {decision.kind === 'missing' ? (
        <TitleSearch initial={decision.query} onSearch={search} />
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
          onApply={pressed('apply', (choices) => onApply(tmdbChoices(choices)))}
          onKeepAll={skip}
        />
      ) : null}
    </Card>
  );
}
