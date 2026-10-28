import { act } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * Moves a faked clock on by `ms` under `act`, and lets every promise it frees
 * settle, so a state set by a timer due inside `ms` has rendered by the time
 * it resolves. The **Loader timing**'s suites walk their 300ms and 500ms on
 * it; seventeen of them had written it letter for letter.
 *
 * The caller fakes the clock (`vi.useFakeTimers()`) and restores it.
 */
export async function advanceClock(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
