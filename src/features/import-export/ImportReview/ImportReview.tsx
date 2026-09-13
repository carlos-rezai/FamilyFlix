import { Button } from '@/primitives';
import type { ImportRun } from '@/types';
import {
  Actions,
  AllDone,
  AllDoneHeading,
  AllDoneLine,
} from './ImportReview.styles';

export interface ImportReviewProps {
  /** The **Current run**, in review. */
  run: ImportRun;
  onFinish: () => void;
}

/**
 * The **Review step**, from `feat.ImportFlow.dc.html`, at the width this
 * slice draws it: the run has no **Problems** to list yet — a row the matcher
 * cannot settle is neither imported nor shown until the review slice — so
 * what the step shows is the `✓ All done` card and _Finish — go to library_.
 * The two tiles and the **Needs attention** list arrive with the problems,
 * which is when `run` starts being read here.
 */
export function ImportReview({ onFinish }: ImportReviewProps) {
  return (
    <>
      <AllDone>
        <AllDoneHeading>✓ All done</AllDoneHeading>
        <AllDoneLine>Every flagged movie has been handled.</AllDoneLine>
      </AllDone>

      <Actions>
        <Button label="Finish — go to library" onClick={onFinish} />
      </Actions>
    </>
  );
}
