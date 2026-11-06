import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { ImportReview } from './ImportReview';
import type { ImportRun, LogLine } from '@/types';
import { theme } from '@/styles/theme';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';

/**
 * The **Review step** keeps the run's **Activity log**. A Link run places no
 * video bytes, so it can reach review inside one poll, and the Running step
 * that drew the log is never seen; the log is then here, on a closed
 * **Accordion** — _Activity log_ and its line count — between the tiles and
 * the list, opening onto the Running step's own `LogConsole`. A run with no
 * lines draws none.
 */

const LINES: LogLine[] = [
  { text: 'Scanning   D:\\Movies', kind: 'scan' },
  { text: '✓ Linked     Heat', kind: 'success' },
  { text: '⚠ Heat: no subtitle track found', kind: 'warning' },
];

const inReview = (overrides: Partial<ImportRun> = {}) =>
  makeImportRun({
    phase: 'review',
    matched: 1,
    log: LINES,
    problems: [
      {
        id: 'p1',
        kind: 'no-row',
        title: 'Ironwood',
        reason: "Folder isn't in the spreadsheet.",
      },
    ],
    ...overrides,
  });

function renderReview(run: ImportRun) {
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <ImportReview
          run={run}
          onSkip={() => undefined}
          onApply={() => undefined}
          onPick={() => undefined}
          onImportAs={() => undefined}
          onSkipMany={() => undefined}
          onImportManyAsGuessed={() => undefined}
          finishLabel="Finish and go to library"
          onFinish={() => undefined}
        />
      </ThemeProvider>
    </MemoryRouter>
  );
}

const logToggle = () => screen.getByRole('button', { name: /Activity log/ });

describe('ImportReview — the Activity log', () => {
  it('draws it closed, with the count of its lines', () => {
    renderReview(inReview());

    expect(logToggle().getAttribute('aria-expanded')).toBe('false');
    expect(within(logToggle()).getByText('3')).toBeTruthy();
    expect(screen.queryByRole('log')).toBeNull();
  });

  it('opens onto every line the run carries', () => {
    renderReview(inReview());

    fireEvent.click(logToggle());

    const log = screen.getByRole('log');
    for (const line of LINES) {
      // Exact, padding and all: the console keeps the column.
      expect(
        within(log).getByText(line.text, { normalizer: (text) => text })
      ).toBeTruthy();
    }
    fireEvent.click(logToggle());
    expect(screen.queryByRole('log')).toBeNull();
  });

  it('sits between the tiles and the Needs attention list', () => {
    renderReview(inReview());

    expect(comesBefore(screen.getByText(/need your/), logToggle())).toBe(true);
    expect(comesBefore(logToggle(), screen.getByText('Needs attention'))).toBe(
      true
    );
  });

  it('is drawn over the All done card too', () => {
    renderReview(inReview({ problems: [] }));

    expect(comesBefore(logToggle(), screen.getByText('✓ All done'))).toBe(true);
  });

  it('is not drawn for a run with no lines', () => {
    renderReview(inReview({ log: [] }));

    expect(screen.queryByRole('button', { name: /Activity log/ })).toBeNull();
  });
});
