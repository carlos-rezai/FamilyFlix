import { LogConsole } from '@/components';
import { Button, ProgressBar } from '@/primitives';
import type { ImportRun } from '@/types';
import { importView } from '../importView/importView';
import { PhaseStepper } from '../PhaseStepper/PhaseStepper';
import {
  Actions,
  CurrentItem,
  Headline,
  LogHeading,
  Running,
  StatLine,
  Timing,
  UnderBar,
} from './ImportProgress.styles';

/** The bar's height on this screen — the prototype's own 10. */
const BAR_HEIGHT = 10;

/** The console's height on this screen — the prototype's own 220. */
const LOG_HEIGHT = 220;

export interface ImportProgressProps {
  /** The **Current run**, at the phase the step is drawn for. */
  run: ImportRun;
  onCancel: () => void;
}

/**
 * The **Running step**, from `feat.ImportFlow.dc.html`: the `Connect ✓ →
 * Scan → Import` stepper; the headline, the stat line and the bar, each read
 * off the snapshot's phase; the current item in mono under the bar — the
 * folder while scanning, the title while importing, straight off
 * `currentItem`; "Elapsed m:ss" and, once more than 20 are done, "· About
 * m:ss left"; the **Activity log** under its heading; and _Cancel import_ in
 * `danger`.
 *
 * Everything the step prints is `importView`'s: the snapshot carries no clock,
 * so elapsed and the ETA are worked out here against `new Date()` at render,
 * and the poll that refreshes the snapshot every 500 ms is what keeps them
 * moving.
 */
export function ImportProgress({ run, onCancel }: ImportProgressProps) {
  const view = importView(run, new Date());

  return (
    <Running>
      <PhaseStepper phase={run.phase} />

      <Headline>{view.headline}</Headline>
      <StatLine>{view.statLine}</StatLine>

      <ProgressBar
        percent={view.percent}
        indeterminate={view.indeterminate}
        height={BAR_HEIGHT}
      />

      <UnderBar>
        <CurrentItem>{run.currentItem}</CurrentItem>
        <Timing>
          {view.elapsed}
          {view.eta === null ? null : ` · ${view.eta}`}
        </Timing>
      </UnderBar>

      <LogHeading>Activity log</LogHeading>
      <LogConsole lines={run.log} height={LOG_HEIGHT} />

      <Actions>
        <Button label="Cancel import" variant="danger" onClick={onCancel} />
      </Actions>
    </Running>
  );
}
