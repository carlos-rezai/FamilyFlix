import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { ImportReview, type ImportReviewProps } from './ImportReview';
import { theme } from '@/styles/theme';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';

/**
 * 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125).
 *
 * The **Review step**, at the width this slice draws it: the run has no
 * **Problems** to list yet — a row the matcher cannot settle is neither
 * imported nor shown until the review slice — so what the step shows is the
 * `✓ All done` card and _Finish — go to library_. The tiles and the **Needs
 * attention** list arrive with the problems.
 */

function renderReview(props: Partial<ImportReviewProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <ImportReview
        run={makeImportRun({
          phase: 'review',
          found: 2,
          total: 2,
          done: 2,
          matched: 2,
        })}
        onFinish={() => undefined}
        {...props}
      />
    </ThemeProvider>
  );
}

const finishButton = () =>
  screen.getByRole('button', { name: 'Finish — go to library' });

describe('ImportReview — all done', () => {
  it('shows the All done card with its line', () => {
    renderReview();

    expect(screen.getByText('✓ All done')).toBeDefined();
    expect(
      screen.getByText('Every flagged movie has been handled.')
    ).toBeDefined();
  });

  it('offers Finish — go to library', () => {
    renderReview();

    expect(finishButton()).toBeDefined();
  });

  it('finishes when Finish is pressed', () => {
    const onFinish = vi.fn();
    renderReview({ onFinish });

    fireEvent.click(finishButton());

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('shows neither headline of the running step', () => {
    renderReview();

    expect(screen.queryByText('Scanning your library…')).toBeNull();
    expect(screen.queryByText('Importing movies…')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel import' })).toBeNull();
  });
});
