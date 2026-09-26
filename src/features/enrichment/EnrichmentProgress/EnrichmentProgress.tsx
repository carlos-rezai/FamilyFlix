import type { EnrichmentRun } from '@/types';
import { LogConsole } from '@/components';
import { ProgressBar } from '@/primitives';
import {
  Card,
  CurrentItem,
  Headline,
  LogSlot,
  StatLine,
} from './EnrichmentProgress.styles';

export interface EnrichmentProgressProps {
  run: EnrichmentRun;
}

/**
 * The **Running step**, bare: the headline, how many were looked up, the
 * determinate bar — the count is known up front — the title in hand, and the
 * log.
 */
export function EnrichmentProgress({ run }: EnrichmentProgressProps) {
  const percent = run.total > 0 ? Math.round((run.done / run.total) * 100) : 0;
  return (
    <Card>
      <Headline>Fetching from TMDB…</Headline>
      <StatLine>
        {run.done.toLocaleString()} of {run.total.toLocaleString()} looked up
      </StatLine>
      <ProgressBar percent={percent} />
      <CurrentItem>{run.currentItem ?? ''}</CurrentItem>
      <LogSlot>
        <LogConsole lines={run.log} height={260} />
      </LogSlot>
    </Card>
  );
}
