import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import type { BusyPhase } from '@/types';
import { useBusyRow } from './useBusyRow';

/**
 * 69, Silent waits, refactor (issue #662): a **Busy row**'s press.
 *
 * A row remembers which press it is working on, to name it once its loader
 * is `shown`, and refuses a press while locked, as a **Busy button** does.
 * The phase is handed in by the hook that owns the row's request; the test
 * rerenders the hook with each phase in turn.
 */

const LABELS = { save: 'Saving…', skip: 'Skipping…' } as const;

/** The hook at `busy`, rerendered by `setBusy`. */
function renderRow(initial: BusyPhase) {
  const view = renderHook(
    ({ busy }: { busy: BusyPhase }) => useBusyRow(busy, LABELS),
    { initialProps: { busy: initial } }
  );
  return {
    ...view,
    setBusy: (busy: BusyPhase) => view.rerender({ busy }),
  };
}

describe('useBusyRow', () => {
  it('reports a press with its arguments while idle', () => {
    const { result } = renderRow('idle');
    const report = vi.fn();

    act(() => result.current.pressed('save', report)(7, 'seven'));

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith(7, 'seven');
  });

  it.each<BusyPhase>(['waiting', 'shown'])(
    'reports nothing while %s',
    (busy) => {
      const { result } = renderRow(busy);
      const report = vi.fn();

      act(() => result.current.pressed('save', report)(7));

      expect(report).not.toHaveBeenCalled();
    }
  );

  it('names nothing while idle or waiting, even after a press', () => {
    const { result, setBusy } = renderRow('idle');
    expect(result.current.label).toBeNull();

    act(() => result.current.pressed('skip', vi.fn())());
    expect(result.current.label).toBeNull();

    setBusy('waiting');
    expect(result.current.label).toBeNull();
  });

  it('names the recorded press once shown', () => {
    const { result, setBusy } = renderRow('idle');

    act(() => result.current.pressed('skip', vi.fn())());
    setBusy('waiting');
    setBusy('shown');

    expect(result.current.label).toBe('Skipping…');
  });

  it('names the latest press a row recorded', () => {
    const { result, setBusy } = renderRow('idle');

    act(() => result.current.pressed('skip', vi.fn())());
    act(() => result.current.pressed('save', vi.fn())());
    setBusy('shown');

    expect(result.current.label).toBe('Saving…');
  });

  it('names nothing once shown if no press was recorded', () => {
    const { result, setBusy } = renderRow('idle');

    setBusy('shown');

    expect(result.current.label).toBeNull();
  });

  it('does not record a press it refused', () => {
    const { result, setBusy } = renderRow('idle');

    act(() => result.current.pressed('skip', vi.fn())());
    setBusy('waiting');
    act(() => result.current.pressed('save', vi.fn())());
    setBusy('shown');

    expect(result.current.label).toBe('Skipping…');
  });
});
