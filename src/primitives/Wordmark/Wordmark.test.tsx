import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { Wordmark } from '@/primitives';
import { theme } from '@/styles/theme';

/**
 * The FamilyFlix **Wordmark**: _Family_ in the text ink and _Flix_ in the
 * accent, serif 700, sized by whatever `font-size` its parent sets — so the
 * suite asserts the words, the inks and the face, and never a size.
 */
function renderWordmark() {
  return render(
    <ThemeProvider theme={theme}>
      <Wordmark />
    </ThemeProvider>
  );
}

/** `colors.text` and `colors.accent`, as the browser resolves them. */
const TEXT_INK = 'rgb(243, 236, 224)';
const ACCENT = 'rgb(217, 122, 78)';

describe('Wordmark', () => {
  it('draws Family and Flix, run together into FamilyFlix', () => {
    renderWordmark();

    const family = screen.getByText('Family');
    const flix = screen.getByText('Flix');
    expect(family.parentElement).toBe(flix.parentElement);
    expect(family.parentElement?.textContent).toBe('FamilyFlix');
  });

  it('draws Flix in the accent and Family in the text ink', () => {
    renderWordmark();

    expect(getComputedStyle(screen.getByText('Flix')).color).toBe(ACCENT);
    expect(getComputedStyle(screen.getByText('Family')).color).toBe(TEXT_INK);
  });

  it('sets the whole mark in the serif at 700', () => {
    renderWordmark();

    for (const word of ['Family', 'Flix']) {
      const style = getComputedStyle(screen.getByText(word));
      expect(style.fontFamily).toContain('Source Serif 4');
      expect(style.fontWeight).toBe('700');
    }
  });
});
