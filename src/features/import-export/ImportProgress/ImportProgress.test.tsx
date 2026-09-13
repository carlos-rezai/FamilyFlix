import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
