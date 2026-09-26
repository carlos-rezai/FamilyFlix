import type { EnrichmentRun } from '@/types';
import { LogConsole } from '@/components';
import { Button, ProgressBar } from '@/primitives';
import { enrichmentView } from '../enrichmentView/enrichmentView';
import {
  Card,
  CurrentItem,
  Elapsed,
  Eta,
  Headline,
  HeadRow,
  ItemRow,
  KeptLine,
  LogSlot,
  StatLine,
  StopRow,
} from './EnrichmentProgress.styles';

export interface EnrichmentProgressProps {
  run: EnrichmentRun;
  /** _Stop_: every row already written stays. */
  onStop: () => void;
}

/**
 * The **Running step**, from `feat.EnrichmentFlow.dc.html`: the headline with
 * elapsed beside it, how many were looked up, the determinate bar — the count
 * is known up front — the title in hand with the ETA, the log, and _Stop_
 * with the line that what was fetched is kept. Everything printed is
 * `enrichmentView`'s; the poll that refreshes the snapshot every 500 ms is
 * what keeps the clock moving.
 */
export function EnrichmentProgress({ run, onStop }: EnrichmentProgressProps) {
  const view = enrichmentView(run, new Date());
  return (
    <Card>
      <HeadRow>
        <Headline>{view.headline}</Headline>
        <Elapsed>{view.elapsed}</Elapsed>
      </HeadRow>
      <StatLine>{view.statLine}</StatLine>
      <ProgressBar percent={view.percent} />
      <ItemRow>
        <CurrentItem>{run.currentItem ?? ''}</CurrentItem>
        {view.eta === null ? null : <Eta>{view.eta}</Eta>}
      </ItemRow>
      <LogSlot>
        <LogConsole lines={run.log} height={260} />
      </LogSlot>
      <StopRow>
        <Button label="Stop" variant="secondary" onClick={onStop} />
        <KeptLine>Anything already fetched is kept.</KeptLine>
      </StopRow>
    </Card>
  );
}
