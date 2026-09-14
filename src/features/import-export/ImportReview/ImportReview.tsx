import { Button } from '@/primitives';
import type { ImportRun } from '@/types';
import { ProblemRow } from '../ProblemRow/ProblemRow';
import { StatTile } from '../StatTile/StatTile';
import {
  Actions,
  AllDone,
  AllDoneHeading,
  AllDoneLine,
  List,
  ListHeading,
  Tiles,
} from './ImportReview.styles';

export interface ImportReviewProps {
  /** The **Current run**, in review. */
  run: ImportRun;
  /** _Skip_ was pressed on the **Problem** with this id. */
  onSkip: (id: string) => void;
  onFinish: () => void;
}

/**
 * The **Review step**, from `feat.ImportFlow.dc.html`: two stat tiles —
 * `matched confidently and imported` and `need your attention` — over the
 * **Needs attention** list, one row per **Problem**; the `✓ All done` card
 * once the list is empty; and _Finish — go to library_ either way, because
 * the films that matched are already in the library.
 *
 * The step draws the run it is handed and reports a press — _Skip_ names the
 * problem's id — and never removes a row itself: the **Run hook** does, and
 * the next `run` shows it.
 */
export function ImportReview({ run, onSkip, onFinish }: ImportReviewProps) {
  return (
    <>
      <Tiles>
        <StatTile
          value={run.matched}
          tone="watched"
          label={
            <>
              matched confidently
              <br />
              and imported
            </>
          }
        />
        <StatTile
          value={run.problems.length}
          tone="accent"
          label={
            <>
              need your
              <br />
              attention
            </>
          }
        />
      </Tiles>

      {run.problems.length > 0 ? (
        <>
          <ListHeading>Needs attention</ListHeading>
          <List>
            {run.problems.map((problem) => (
              <ProblemRow
                key={problem.id}
                problem={problem}
                onSkip={() => onSkip(problem.id)}
              />
            ))}
          </List>
        </>
      ) : (
        <AllDone>
          <AllDoneHeading>✓ All done</AllDoneHeading>
          <AllDoneLine>Every flagged movie has been handled.</AllDoneLine>
        </AllDone>
      )}

      <Actions>
        <Button label="Finish — go to library" onClick={onFinish} />
      </Actions>
    </>
  );
}
