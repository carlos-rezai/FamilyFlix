import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { CreditsRow, type CreditsRowProps } from './CreditsRow';
import { theme } from '@/styles/theme';

/** What `detailView` writes into a credit the record does not have. */
const MISSING = '—';

function renderCreditsRow(props: Partial<CreditsRowProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <CreditsRow
        director={props.director ?? 'Michael Rowe'}
        castText={props.castText ?? 'Ana Vega, Tomas Bell'}
        hasCredits={props.hasCredits ?? true}
      />
    </ThemeProvider>
  );
}

describe('CreditsRow', () => {
  it('shows the director and the cast under their headings', () => {
    renderCreditsRow();

    expect(screen.getByText('Director')).toBeTruthy();
    expect(screen.getByText('Michael Rowe')).toBeTruthy();
    expect(screen.getByText('Cast')).toBeTruthy();
    expect(screen.getByText('Ana Vega, Tomas Bell')).toBeTruthy();
  });
});

describe('CreditsRow — a missing credit', () => {
  it('keeps both headings when only the director is missing', () => {
    // "We know who is in it and not who directed it" is information; hiding
    // the heading would make the gap look like a rendering bug instead.
    renderCreditsRow({ director: MISSING });

    expect(screen.getByText('Director')).toBeTruthy();
    expect(screen.getByText(MISSING)).toBeTruthy();
    expect(screen.getByText('Ana Vega, Tomas Bell')).toBeTruthy();
  });

  it('keeps both headings when only the cast is missing', () => {
    renderCreditsRow({ castText: MISSING });

    expect(screen.getByText('Cast')).toBeTruthy();
    expect(screen.getByText(MISSING)).toBeTruthy();
    expect(screen.getByText('Michael Rowe')).toBeTruthy();
  });

  it('draws nothing at all when both are missing', () => {
    // Two dashes under two headings is a row that says nothing while taking
    // the space of one that does.
    renderCreditsRow({
      director: MISSING,
      castText: MISSING,
      hasCredits: false,
    });

    expect(screen.queryByText('Director')).toBeNull();
    expect(screen.queryByText('Cast')).toBeNull();
    expect(screen.queryByText(MISSING)).toBeNull();
  });
});
