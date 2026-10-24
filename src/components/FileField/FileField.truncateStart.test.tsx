import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { FileField } from '@/components';
import { theme } from '@/styles/theme';

/**
 * 51 — Library audit, Phase 13 (issue #456): `truncateStart`.
 *
 * The Movie form's Show folder row ellipsises its name from the start, so the
 * folder's own last segment always shows, and carries the whole name as its
 * `title` for the hover (`mol.FileField.dc.html`: `direction: rtl` on the
 * name, the name itself in a left-to-right `<bdi>`).
 */

const PATH = 'C:\\Users\\Carlos\\Videos\\Series\\Harbor and Vine';

function renderField(truncateStart?: boolean) {
  render(
    <ThemeProvider theme={theme}>
      <FileField
        label="Show folder"
        chooseLabel="Choose show folder"
        filename={PATH}
        accept=""
        icon={<svg />}
        onPick={vi.fn()}
        onRemove={vi.fn()}
        truncateStart={truncateStart}
      />
    </ThemeProvider>
  );
}

/** The element carrying the name's ellipsis: the one under the text itself. */
const nameBox = () => {
  const text = screen.getByText(PATH);
  return text.tagName === 'BDI' ? (text.parentElement as HTMLElement) : text;
};

describe('FileField — truncateStart', () => {
  it('ellipsises the name from its start', () => {
    renderField(true);

    const style = getComputedStyle(nameBox());
    expect(style.direction).toBe('rtl');
    expect(style.textOverflow).toBe('ellipsis');
  });

  it('keeps the name itself reading left to right', () => {
    renderField(true);

    const text = screen.getByText(PATH);
    expect(text.tagName).toBe('BDI');
    expect(text.getAttribute('dir')).toBe('ltr');
  });

  it('carries the full name as the row’s title', () => {
    renderField(true);

    expect(nameBox().getAttribute('title')).toBe(PATH);
  });
});
