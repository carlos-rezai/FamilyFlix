import { LoadMessage } from '@/components';
import { Button } from '@/primitives';

export interface RetryableFailureProps {
  /** What failed, in the screen's own words. */
  title: string;
  /** What went wrong, in the screen's own words. */
  body: string;
  /** Run the load again. */
  onRetry: () => void;
}

/**
 * What a browse screen shows when its load failed: the failure said plainly, and
 * one way to try again.
 *
 * A failure must read as a failure — an empty grid in its place would claim the
 * shelf holds nothing, which is a different and wrong thing to say — and every
 * failed load in this feature offers the same single affordance. That the way
 * back is a Retry, that it is labelled "Retry", and that it is a secondary
 * button, are decided here once rather than per screen.
 *
 * The two strings stay at the call site, because what failed is the screen's own
 * to name: a library and one genre are different things to have failed to load.
 */
export function RetryableFailure({
  title,
  body,
  onRetry,
}: RetryableFailureProps) {
  return (
    <LoadMessage
      title={title}
      body={body}
      action={<Button label="Retry" variant="secondary" onClick={onRetry} />}
    />
  );
}
