import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { ImportProgress, type ImportProgressProps } from './ImportProgress';
import { theme } from '@/styles/theme';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';

/**
 * 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125).
 *
 * The **Running step**, from `feat.ImportFlow.dc.html`, at the width this
 * slice draws it: the headline, the stat line and the bar, each read off the
 * snapshot's phase, and _Cancel import_ in `danger`. The stepper, the current
 * item, elapsed, the ETA and the **Activity log** are the console slice's.
 *
 * Copy is the prototype's, verbatim — "Scanning your library…" / "Importing
 * movies…", "Found N movies so far" / "N of M imported" — with the thousands
 * separators the container's `toLocaleString()` puts in, because the real
 * library is a thousand rows and "1200 of 1200" is a number nobody reads.
 *
 * Phase 3: "the console" (issue #128) fills in the rest of the step: the
 * `Connect ✓ → Scan → Import` stepper; the current item in mono under the
 * bar — the folder while scanning, the title while importing, straight off
 * `currentItem`; "Elapsed m:ss" and, once more than 20 are done,
 * "· About m:ss left", both worked out from `startedAt` against the clock;
 * and the **Activity log** under its heading. The snapshot carries no clock,
 * so these tests set the system time and read what the step prints.
 */

function renderProgress(props: Partial<ImportProgressProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <ImportProgress
        run={makeImportRun()}
        onCancel={() => undefined}
        {...props}
      />
    </ThemeProvider>
  );
}

const bar = () => screen.getByRole('progressbar');
const cancelButton = () =>
  screen.getByRole('button', { name: 'Cancel import' });

describe('ImportProgress — while scanning', () => {
  it('says it is scanning', () => {
    renderProgress({ run: makeImportRun({ phase: 'scanning' }) });

    expect(screen.getByText('Scanning your library…')).toBeDefined();
    expect(screen.queryByText('Importing movies…')).toBeNull();
  });

  it('counts what the walk has found so far', () => {
    renderProgress({ run: makeImportRun({ phase: 'scanning', found: 12 }) });

    expect(screen.getByText('Found 12 movies so far')).toBeDefined();
  });

  it('counts with thousands separators', () => {
    renderProgress({
      run: makeImportRun({ phase: 'scanning', found: 1234 }),
    });

    expect(screen.getByText('Found 1,234 movies so far')).toBeDefined();
  });

  it('draws the bar indeterminate — the scan has no known total', () => {
    renderProgress({ run: makeImportRun({ phase: 'scanning', found: 12 }) });

    expect(bar().getAttribute('aria-valuenow')).toBeNull();
  });
});

describe('ImportProgress — while importing', () => {
  it('says it is importing', () => {
    renderProgress({
      run: makeImportRun({ phase: 'importing', total: 2, done: 0 }),
    });

    expect(screen.getByText('Importing movies…')).toBeDefined();
    expect(screen.queryByText('Scanning your library…')).toBeNull();
  });

  it('counts done of total', () => {
    renderProgress({
      run: makeImportRun({ phase: 'importing', total: 2, done: 1 }),
    });

    expect(screen.getByText('1 of 2 imported')).toBeDefined();
  });

  it('counts both numbers with thousands separators', () => {
    renderProgress({
      run: makeImportRun({ phase: 'importing', total: 1200, done: 1000 }),
    });

    expect(screen.getByText('1,000 of 1,200 imported')).toBeDefined();
  });

  it('draws the bar at done over total', () => {
    renderProgress({
      run: makeImportRun({ phase: 'importing', total: 1200, done: 350 }),
    });

    // 350 / 1200, rounded to the percent the bar exposes.
    expect(bar().getAttribute('aria-valuenow')).toBe('29');
  });

  it('draws the bar empty at the first copy and full at the last', () => {
    const { rerender } = renderProgress({
      run: makeImportRun({ phase: 'importing', total: 2, done: 0 }),
    });
    expect(bar().getAttribute('aria-valuenow')).toBe('0');

    rerender(
      <ThemeProvider theme={theme}>
        <ImportProgress
          run={makeImportRun({ phase: 'importing', total: 2, done: 2 })}
          onCancel={() => undefined}
        />
      </ThemeProvider>
    );

    expect(bar().getAttribute('aria-valuenow')).toBe('100');
  });
});

describe('ImportProgress — Cancel import', () => {
  it('offers Cancel import, drawn as the danger button', () => {
    renderProgress();

    // `danger` ink — #c97a6a, as jsdom reports it. Pressing it does nothing
    // yet: cancel is the next slice's, and a button that is drawn is the
    // prototype's surface whether or not it is wired.
    expect(getComputedStyle(cancelButton()).color).toBe('rgb(201, 122, 106)');
  });
});

describe('ImportProgress — the stepper', () => {
  it('ticks Connect and holds Scan active while scanning', () => {
    renderProgress({ run: makeImportRun({ phase: 'scanning' }) });

    expect(screen.getByText('Connect')).toBeTruthy();
    expect(screen.getByText('Scan')).toBeTruthy();
    expect(screen.getByText('Import')).toBeTruthy();
    expect(screen.getAllByText('✓')).toHaveLength(1);
    expect(
      (screen.getByText('Scan').parentElement as HTMLElement).getAttribute(
        'aria-current'
      )
    ).toBe('step');
  });

  it('ticks Scan too and holds Import active while importing', () => {
    renderProgress({
      run: makeImportRun({ phase: 'importing', total: 2, done: 1 }),
    });

    expect(screen.getAllByText('✓')).toHaveLength(2);
    expect(
      (screen.getByText('Import').parentElement as HTMLElement).getAttribute(
        'aria-current'
      )
    ).toBe('step');
  });
});

describe('ImportProgress — the current item', () => {
  it('shows the folder being scanned, in mono', () => {
    renderProgress({
      run: makeImportRun({
        phase: 'scanning',
        found: 3,
        currentItem: 'D:\\Movies\\Drama\\Amelie (2001)',
      }),
    });

    const item = screen.getByText('D:\\Movies\\Drama\\Amelie (2001)');
    expect(getComputedStyle(item).fontFamily).toContain('JetBrains Mono');
  });

  it('shows the title being imported, in mono', () => {
    renderProgress({
      run: makeImportRun({
        phase: 'importing',
        total: 2,
        done: 1,
        currentItem: 'Amélie',
      }),
    });

    const item = screen.getByText('Amélie');
    expect(getComputedStyle(item).fontFamily).toContain('JetBrains Mono');
  });
});

describe('ImportProgress — elapsed and the ETA', () => {
  const STARTED = '2026-09-13T10:00:00.000Z';

  /** Put the clock `seconds` after the run started. */
  const clockAt = (seconds: number) =>
    vi.setSystemTime(new Date(Date.parse(STARTED) + seconds * 1000));

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads Elapsed m:ss off the clock against startedAt', () => {
    clockAt(65);
    renderProgress({
      run: makeImportRun({ phase: 'scanning', startedAt: STARTED, found: 12 }),
    });

    expect(screen.getByText(/Elapsed 1:05/)).toBeTruthy();
  });

  it('gives no forecast while scanning', () => {
    clockAt(100);
    renderProgress({
      run: makeImportRun({ phase: 'scanning', startedAt: STARTED, found: 500 }),
    });

    expect(screen.getByText(/Elapsed 1:40/)).toBeTruthy();
    expect(screen.queryByText(/About .* left/)).toBeNull();
  });

  it('gives no forecast until more than 20 are done', () => {
    clockAt(100);
    renderProgress({
      run: makeImportRun({
        phase: 'importing',
        startedAt: STARTED,
        done: 20,
        total: 100,
      }),
    });

    expect(screen.getByText(/Elapsed 1:40/)).toBeTruthy();
    expect(screen.queryByText(/About .* left/)).toBeNull();
  });

  it('adds · About m:ss left beside elapsed once enough is done', () => {
    // 25 done in 100 s: 100 to go at 4 s each.
    clockAt(100);
    renderProgress({
      run: makeImportRun({
        phase: 'importing',
        startedAt: STARTED,
        done: 25,
        total: 125,
      }),
    });

    expect(screen.getByText(/Elapsed 1:40/)).toBeTruthy();
    expect(screen.getByText(/· About 6:40 left/)).toBeTruthy();
  });
});

describe('ImportProgress — the Activity log', () => {
  it('draws the log under its heading, every line the snapshot carries', () => {
    renderProgress({
      run: makeImportRun({
        phase: 'importing',
        total: 2,
        done: 1,
        log: [
          { text: 'Connecting to D:\\Movies …', kind: 'info' },
          { text: '✓ Imported  Die Hard', kind: 'success' },
        ],
      }),
    });

    expect(screen.getByText('Activity log')).toBeTruthy();
    const log = screen.getByRole('log');
    expect(within(log).getByText('Connecting to D:\\Movies …')).toBeTruthy();
    expect(within(log).getByText('✓ Imported  Die Hard')).toBeTruthy();
  });
});
