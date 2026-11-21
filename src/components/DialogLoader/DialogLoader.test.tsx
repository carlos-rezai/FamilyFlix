import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { DialogLoader } from '@/components';
import { theme } from '@/styles/theme';

/**
 * 53, Loading states, Phase 5 (issue #487), amended by 71, Busy overlay,
 * Phase 6 (issue #679): the **Dialog loader**.
 *
 * `{ label }`: the layer a `Modal` given a `loader` draws over its hidden idle
 * face, `inset: 0`, the 64px `LogoLoader` and its label centred on
 * `surface2`. It has no `Modal` of its own: the card it sits in is the
 * dialog's own.
 */

function renderLoader(label = 'Erasing everything') {
  return render(
    <ThemeProvider theme={theme}>
      <DialogLoader label={label} />
    </ThemeProvider>
  );
}

describe('DialogLoader', () => {
  it('draws its label as a status', () => {
    renderLoader();

    expect(
      screen.getByRole('status', { name: 'Erasing everything' })
    ).toBeDefined();
    expect(document.body.textContent).toContain('Erasing everything');
  });

  it('draws the loader at 64px', () => {
    renderLoader();

    const mark = screen.getByRole('status').querySelector('svg');
    expect(Number(mark?.getAttribute('width'))).toBe(64);
  });

  it('draws no dialog of its own', () => {
    renderLoader();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
