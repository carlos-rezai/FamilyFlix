import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { DialogLoader } from '@/components';
import { theme } from '@/styles/theme';

/**
 * 53, Loading states, Phase 5 (issue #487): the **Dialog loader**.
 *
 * `{ label }`: a 64px `LogoLoader` with its label, `aria-busy`, drawn inside a
 * **Bare** `Modal` that is locked. What a Delete or Reset dialog becomes once
 * its action is **Shown**: no heading, no ✕ and no Cancel.
 */

function renderLoader(label = 'Erasing everything') {
  return render(
    <ThemeProvider theme={theme}>
      <DialogLoader label={label} />
    </ThemeProvider>
  );
}

const card = () => screen.getByRole('dialog');

describe('DialogLoader', () => {
  it('draws its label as a busy status, inside a modal dialog', () => {
    renderLoader();

    const status = within(card()).getByRole('status', {
      name: 'Erasing everything',
    });
    expect(card().getAttribute('aria-modal')).toBe('true');
    expect(status.closest('[aria-busy="true"]')).not.toBeNull();
    expect(card().textContent).toContain('Erasing everything');
  });

  it('draws the loader at 64px', () => {
    renderLoader();

    const mark = within(card()).getByRole('status').querySelector('svg');
    expect(Number(mark?.getAttribute('width'))).toBe(64);
  });

  it('is bare: no heading and no ✕', () => {
    renderLoader();

    expect(within(card()).queryByRole('heading')).toBeNull();
    expect(within(card()).queryByRole('button')).toBeNull();
  });
});
