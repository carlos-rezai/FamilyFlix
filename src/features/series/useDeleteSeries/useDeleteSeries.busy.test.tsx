import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { useDeleteSeries } from './useDeleteSeries';
import {
  noContentResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';

/**
 * 53 — Loading states, Phase 6 (issue #488): `deleting` is a **Busy phase**
 * on the **Loader timing**, `waiting` from the press and `shown` once the
 * delete has run 300ms, and back to `idle` only after the 500ms hold. A
 * failed delete raises `failed`, which the next confirm clears.
 */

const { respond } = heldFetch();

afterEach(() => {
  vi.useRealTimers();
});

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/', '/series/harbor']} initialIndex={1}>
      {children}
    </MemoryRouter>
  );
}

describe('useDeleteSeries — on the Loader timing', () => {
  it('is idle and unfailed before a press', () => {
    const { result } = renderHook(() => useDeleteSeries('harbor'), { wrapper });

    expect(result.current.deleting).toBe('idle');
    expect(result.current.failed).toBe(false);
  });

  it('is waiting at once, shown at 300ms, and idle after a failure’s hold, failed', async () => {
    const { result } = renderHook(() => useDeleteSeries('harbor'), { wrapper });
    vi.useFakeTimers();

    act(() => {
      void result.current.deleteSeries().catch(() => undefined);
    });
    expect(result.current.deleting).toBe('waiting');

    await advanceClock(299);
    expect(result.current.deleting).toBe('waiting');
    await advanceClock(1);
    expect(result.current.deleting).toBe('shown');

    await respond(serverErrorResponse());
    await advanceClock(499);
    expect(result.current.deleting).toBe('shown');
    expect(result.current.failed).toBe(false);

    await advanceClock(1);
    expect(result.current.deleting).toBe('idle');
    expect(result.current.failed).toBe(true);
  });

  it('clears failed on the next confirm, before it is answered', async () => {
    const { result } = renderHook(() => useDeleteSeries('harbor'), { wrapper });
    vi.useFakeTimers();

    act(() => {
      void result.current.deleteSeries().catch(() => undefined);
    });
    await respond(serverErrorResponse());
    await advanceClock(0);
    expect(result.current.failed).toBe(true);

    act(() => {
      void result.current.deleteSeries().catch(() => undefined);
    });
    expect(result.current.failed).toBe(false);
    expect(result.current.deleting).toBe('waiting');

    await respond(noContentResponse());
    await advanceClock(0);
  });
});
