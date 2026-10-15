import { useState } from 'react';

import type { ConflictChoices, Decision, EnrichmentRun } from '@/types';
import { PillTabs } from '@/components';
import { Button } from '@/primitives';
import { DecisionRow } from '../DecisionRow/DecisionRow';
import {
  decisionKindFilter,
  writtenSummary,
} from '../enrichmentView/enrichmentView';
import {
  Actions,
  AllDone,
  Decisions,
  AllDoneHeading,
  AllDoneLine,
  BulkActions,
  FilterRow,
  FilterScroll,
  Stack,
  Tile,
  TileLabel,
  TileValue,
  Tiles,
} from './EnrichmentReview.styles';

export interface EnrichmentReviewProps {
  run: EnrichmentRun;
  /** Finish's label — _Back to the movie_ for one film, else _Done_. */
  finishLabel: string;
  onFinish: () => void;
  onAgain: () => void;
  onSkip: (id: string) => void;
  /**
   * _Skip all_ was pressed beside a chosen kind, with the id of every Decision
   * of that kind, in the run's order.
   */
  onSkipMany: (ids: string[]) => void;
  onPick: (id: string, tmdbId: number) => void;
  onSearch: (id: string, query: string) => void;
  onApply: (id: string, choices: ConflictChoices) => void;
}

/**
 * The **Review step**: the two stat tiles, and — with nothing left to decide
 * — _All done_ over where it was saved, else one **Decision row** per
 * Decision; then Finish and _Sync again_.
 *
 * Over two kinds or more, the **Kind filter** sits above the rows and lets
 * one kind through — filtered, never grouped; screen state, falling back to
 * _All_ once its kind empties. A chosen kind draws _Skip all_ at the row's
 * end, reporting the shown ids at once, no confirm; the step takes nothing
 * off itself — the run hook does, and the next `run` shows it.
 */
export function EnrichmentReview({
  run,
  finishLabel,
  onFinish,
  onAgain,
  onSkip,
  onSkipMany,
  onPick,
  onSearch,
  onApply,
}: EnrichmentReviewProps) {
  const [chosen, setChosen] = useState<Decision['kind'] | 'all'>('all');
  const filter = decisionKindFilter(run.decisions, chosen);
  const shown =
    filter.value === 'all'
      ? run.decisions
      : run.decisions.filter((decision) => decision.kind === filter.value);

  return (
    <Stack>
      <Tiles>
        <Tile>
          <TileValue $accent>{run.enriched}</TileValue>
          <TileLabel>movies enriched</TileLabel>
        </Tile>
        <Tile>
          <TileValue $accent={false}>{run.decisions.length}</TileValue>
          <TileLabel>need your decision</TileLabel>
        </Tile>
      </Tiles>

      {run.decisions.length === 0 ? (
        <AllDone>
          <AllDoneHeading>All done</AllDoneHeading>
          <AllDoneLine>{writtenSummary(run.written)}</AllDoneLine>
        </AllDone>
      ) : (
        <Decisions>
          {filter.options.length > 0 && (
            <FilterRow>
              <FilterScroll>
                <PillTabs
                  label="Decision kinds"
                  options={filter.options}
                  value={filter.value}
                  onChange={setChosen}
                />
              </FilterScroll>
              <BulkActions>
                {filter.value !== 'all' && (
                  <Button
                    label="Skip all"
                    variant="ghost"
                    size="md"
                    onClick={() =>
                      onSkipMany(shown.map((decision) => decision.id))
                    }
                  />
                )}
              </BulkActions>
            </FilterRow>
          )}
          {shown.map((decision) => (
            // Keyed by its face too, so a search's answer draws afresh.
            <DecisionRow
              key={`${decision.id}:${decision.kind}:${decision.query}`}
              decision={decision}
              onSkip={() => onSkip(decision.id)}
              onPick={(tmdbId) => onPick(decision.id, tmdbId)}
              onSearch={(query) => onSearch(decision.id, query)}
              onApply={(choices) => onApply(decision.id, choices)}
            />
          ))}
        </Decisions>
      )}

      <Actions>
        <Button label={finishLabel} variant="primary" onClick={onFinish} />
        <Button label="Sync again" variant="ghost" onClick={onAgain} />
      </Actions>
    </Stack>
  );
}
