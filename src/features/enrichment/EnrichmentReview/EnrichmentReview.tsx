import type { EnrichmentRun } from '@/types';
import { Button } from '@/primitives';
import {
  Actions,
  AllDone,
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
}

/**
 * The **Review step**: the two stat tiles, and — with nothing left to decide
 * — _All done_ over where it was saved; then Finish and _Sync again_.
 */
export function EnrichmentReview({
  run,
  finishLabel,
  onFinish,
  onAgain,
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
      ) : null}

      <Actions>
        <Button label={finishLabel} variant="primary" onClick={onFinish} />
        <Button label="Sync again" variant="ghost" onClick={onAgain} />
      </Actions>
    </Stack>
  );
}
