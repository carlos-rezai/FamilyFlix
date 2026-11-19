import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { LoadingForm } from './LoadingForm';
import { theme } from '@/styles/theme';
import type { FormKind } from '@/types';

/**
 * 69 — Silent waits, Phase 7 (issue #659): the **Form skeleton**.
 *
 * The **Movie form**'s own frame in **Skeleton** blocks, held while a job
 * naming a record reads it: no heading, no fields, no save, announced once as
 * a status named by the job's kind, its insides hidden from assistive
 * technology. `LoadingDetail` and `LoadingSeries` are its precedent.
 */

function renderLoadingForm(kind: FormKind) {
  return render(
    <ThemeProvider theme={theme}>
      <LoadingForm kind={kind} />
    </ThemeProvider>
  );
}

describe('LoadingForm', () => {
  it('announces a movie wait once, as a status named Loading movie', () => {
    renderLoadingForm('movie');

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status', { name: 'Loading movie' })).toBeTruthy();
  });

  it('announces a series wait once, as a status named Loading series', () => {
    renderLoadingForm('series');

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status', { name: 'Loading series' })).toBeTruthy();
  });

  it('claims no heading, so it is never read as a form that loaded', () => {
    renderLoadingForm('movie');

    expect(screen.queryAllByRole('heading')).toHaveLength(0);
  });

  it('draws no save button and nothing to type into', () => {
    renderLoadingForm('movie');

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });

  it('hides its placeholder blocks from assistive technology', () => {
    const { container } = renderLoadingForm('series');

    const insides = container.querySelectorAll('[role="status"] > *');
    expect(insides.length).toBeGreaterThan(0);
    insides.forEach((block) =>
      expect(block.getAttribute('aria-hidden')).toBe('true')
    );
  });
});
