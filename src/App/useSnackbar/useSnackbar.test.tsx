import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { useEffect, useState, type ReactNode } from 'react';

import {
  useSnackbar,
  type SnackbarNotice,
} from '@/App/useSnackbar/useSnackbar';
import { SnackbarProvider } from '@/App/SnackbarProvider/SnackbarProvider';
import { theme } from '@/styles/theme';

/**
 * 18 — Snackbar system, Phase 2: "the tracer bullet" (issue #161), the hook
 * alone.
 *
 * `useSnackbar()` answers `{ notify, dismiss }`. Outside a provider it throws,
 * naming itself — the `useGenreMovies` precedent: the provider is mounted in
 * `App`, so a consumer out there is a wiring mistake, and a no-op would hide
 * it. Under the provider, `notify` answers the `number` id a notice can be
 * retracted by, successive calls answer different ids, and both functions keep
 * their identity across renders — the property the once-per-launch Update
 * offer rests on.
 */
const NOTICE: SnackbarNotice = {
  variant: 'success',
  message: 'Saved.',
};

/** The hook's answer, captured off the last render of a consumer under it. */
let api: ReturnType<typeof useSnackbar>;

function Consumer() {
  api = useSnackbar();
  return null;
}

/**
 * A consumer that re-renders on demand and runs one effect against `notify`,
 * so the number of times the effect fires is the number of identities `notify`
 * has had.
 */
function EffectCounter({ onNotifyChange }: { onNotifyChange: () => void }) {
  const { notify } = useSnackbar();
  const [renders, setRenders] = useState(0);

  useEffect(() => {
    onNotifyChange();
  }, [notify, onNotifyChange]);

  return (
    <button type="button" onClick={() => setRenders((n) => n + 1)}>
      render again ({renders})
    </button>
  );
}

function renderUnderProvider(ui: ReactNode) {
  return render(
    <ThemeProvider theme={theme}>
      <SnackbarProvider>{ui}</SnackbarProvider>
    </ThemeProvider>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useSnackbar — outside a provider', () => {
  it('throws, and the message names the hook', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    expect(() => render(<Consumer />)).toThrow(/useSnackbar/);

    consoleError.mockRestore();
  });
});

describe('useSnackbar — under the provider', () => {
  it('answers a number id from notify, and successive calls answer different ids', () => {
    vi.useFakeTimers();
    renderUnderProvider(<Consumer />);

    let first = 0;
    let second = 0;
    act(() => {
      first = api.notify(NOTICE);
    });
    act(() => {
      second = api.notify(NOTICE);
    });

    expect(typeof first).toBe('number');
    expect(typeof second).toBe('number');
    expect(second).not.toBe(first);
  });

  it('keeps notify and dismiss at the same identity across renders', () => {
    vi.useFakeTimers();
    renderUnderProvider(<Consumer />);
    const before = { notify: api.notify, dismiss: api.dismiss };

    // A notice raised is a state change in the provider, so a re-render of
    // everything under it — the identity must hold through it.
    act(() => {
      api.notify(NOTICE);
    });

    expect(api.notify).toBe(before.notify);
    expect(api.dismiss).toBe(before.dismiss);
  });

  it('fires an effect depending on notify once, however often the consumer renders', () => {
    vi.useFakeTimers();
    const onNotifyChange = vi.fn();
    renderUnderProvider(<EffectCounter onNotifyChange={onNotifyChange} />);

    fireEvent.click(screen.getByRole('button', { name: /render again/ }));
    fireEvent.click(screen.getByRole('button', { name: /render again/ }));
    fireEvent.click(screen.getByRole('button', { name: /render again/ }));

    expect(
      screen.getByRole('button', { name: 'render again (3)' })
    ).toBeDefined();
    expect(onNotifyChange).toHaveBeenCalledTimes(1);
  });
});
