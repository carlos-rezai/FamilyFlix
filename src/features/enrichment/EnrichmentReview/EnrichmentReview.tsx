import type { ConflictChoices, EnrichmentRun } from '@/types';
import { Button } from '@/primitives';
import { DecisionRow } from '../DecisionRow/DecisionRow';
import {
  Actions,
  AllDone,
  Decisions,
  AllDoneHeading,
  AllDoneLine,
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
  onPick: (id: string, tmdbId: number) => void;
  onSearch: (id: string, query: string) => void;
  onApply: (id: string, choices: ConflictChoices) => void;
}

/**
 * The **Review step**: the two stat tiles, and — with nothing left to decide
 * — _All done_ over where it was saved, else one **Decision row** per
 * Decision; then Finish and _Sync again_.
 */
export function EnrichmentReview({
  run,
  finishLabel,
  onFinish,
  onAgain,
  onSkip,
  onPick,
  onSearch,
  onApply,
}: EnrichmentReviewProps) {
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
          <AllDoneLine>Saved to your library.</AllDoneLine>
        </AllDone>
      ) : (
        <Decisions>
          {run.decisions.map((decision) => (
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
