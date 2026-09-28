import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import { makeEnrichmentRun } from '@/test-support/makeEnrichmentRun/makeEnrichmentRun';
import type { EnrichmentRun } from '@/types';
import { EnrichmentProgress } from './EnrichmentProgress';

/**
 * 23 — Enrichment refactor (issue #214), Group 4: the three steps have suites.
 *
 * The **Running step** driven through its props alone, its leaves moved down
 * from `EnrichmentFlow.library.test.tsx`: the headline, the elapsed clock, the
 * stat line, the determinate bar, the title in hand, the ETA, the Activity log
 * and _Stop_ with its line. The poll that refreshes the snapshot is the
 * organism's.
 */

const NOW = new Date('2026-09-27T10:01:00.000Z');

const RUNNING = makeEnrichmentRun({
  startedAt: '2026-09-27T10:00:00.000Z',
  total: 30,
  done: 3,
  enriched: 3,
  currentItem: 'Harbor Lights (1963)',
  log: [
    { text: 'Contacting api.themoviedb.org …', kind: 'info' },
    { text: '✓ Matched   The Lantern Keeper (2019)', kind: 'success' },
  ],
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function renderProgress(run: EnrichmentRun = RUNNING, onStop = vi.fn()) {
  render(
    <ThemeProvider theme={theme}>
      <EnrichmentProgress run={run} onStop={onStop} />
    </ThemeProvider>
  );
  return onStop;
}

describe('EnrichmentProgress', () => {
  it('shows the headline and the time elapsed since the start', () => {
    renderProgress();

    expect(screen.getByText('Fetching from TMDB…')).toBeDefined();
    expect(screen.getByText('Elapsed 1:00')).toBeDefined();
  });

  it('shows the stat line and the determinate bar', () => {
    renderProgress();

    expect(screen.getByText('3 of 30 looked up')).toBeDefined();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '10'
    );
  });

  it('shows the title in hand', () => {
    renderProgress();

    expect(screen.getByText('Harbor Lights (1963)')).toBeDefined();
  });

  it('shows the ETA once there is a pace to forecast from', () => {
    renderProgress();

    expect(screen.getByText(/^About \d+:\d\d left$/)).toBeDefined();
  });

  it('shows no ETA before there is', () => {
    renderProgress(makeEnrichmentRun({ total: 30, done: 0 }));

    expect(screen.queryByText(/left$/)).toBeNull();
  });

  it('shows the Activity log', () => {
    renderProgress();

    expect(
      screen.getByText('✓ Matched   The Lantern Keeper (2019)', {
        normalizer: (text) => text,
      })
    ).toBeDefined();
  });

  it('offers Stop, with the line that fetched details are kept', () => {
    const onStop = renderProgress();

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

    expect(onStop).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Anything already fetched is kept.')).toBeDefined();
  });
});
