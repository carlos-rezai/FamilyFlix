import { Button, ProgressBar } from '@/primitives';
import type { ImportRun } from '@/types';
import { Actions, Headline, Running, StatLine } from './ImportProgress.styles';

/** The bar's height on this screen — the prototype's own 10. */
const BAR_HEIGHT = 10;

export interface ImportProgressProps {
  /** The **Current run**, at the phase the step is drawn for. */
  run: ImportRun;
  onCancel: () => void;
}

/** `done` over `total` as the percent the bar exposes — nought before there is a total. */
const percentOf = ({ done, total }: ImportRun): number =>
  total === 0 ? 0 : Math.round((done / total) * 100);

/**
 * The **Running step**, from `feat.ImportFlow.dc.html`, at the width this
 * slice draws it: the headline, the stat line and the bar, each read off the
 * snapshot's phase, and _Cancel import_ in `danger`. The stepper, the current
 * item, elapsed, the ETA and the **Activity log** are the console slice's.
 *
 * The copy is the prototype's verbatim, with the thousands separators its
 * `toLocaleString()` puts in: the real library is a thousand rows, and
 * "1200 of 1200" is a number nobody reads. The bar is indeterminate while
 * scanning — the walk has no known total — and `done / total` while importing.
 *
 * Cancel is drawn and does nothing yet: cancel is the next slice's, and a
 * button that is drawn is the prototype's surface whether or not it is wired.
 */
export function ImportProgress({ run, onCancel }: ImportProgressProps) {
  const scanning = run.phase === 'scanning';

  return (
    <Running>
      <Headline>
        {scanning ? 'Scanning your library…' : 'Importing movies…'}
      </Headline>
      <StatLine>
        {scanning
          ? `Found ${run.found.toLocaleString('en-US')} movies so far`
          : `${run.done.toLocaleString('en-US')} of ${run.total.toLocaleString('en-US')} imported`}
      </StatLine>

      <ProgressBar
        percent={percentOf(run)}
        indeterminate={scanning}
        height={BAR_HEIGHT}
      />

      <Actions>
        <Button label="Cancel import" variant="danger" onClick={onCancel} />
      </Actions>
    </Running>
  );
}
