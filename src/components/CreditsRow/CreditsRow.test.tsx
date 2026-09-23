import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { CreditsRow, type CreditsRowProps } from '@/components';
import { theme } from '@/styles/theme';

/**
 * 22 — Series (TV), Phase 2 (issue #191): the **Credits row** graduates from
 * the movie-detail feature to `components/`, because a second page draws it.
 * The first credit's heading is a prop — the movie page passes _Director_, the
 * series page _Created by_ — and the cast's heading reads _Cast_ unless the
 * page names it (the series page's _Starring_). The rule it keeps is the one it
 * had: a missing credit shows "—" under its heading, and the row is drawn only
 * when at least one credit exists.
 */

/** What a view mapper writes into a credit the record does not have. */
const MISSING = '—';

function renderCreditsRow(props: Partial<CreditsRowProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <CreditsRow
        leadLabel={props.leadLabel ?? 'Director'}
        lead={props.lead ?? 'Michael Rowe'}
        castLabel={props.castLabel}
        castText={props.castText ?? 'Ana Vega, Tomas Bell'}
        hasCredits={props.hasCredits ?? true}
      />
    </ThemeProvider>
  );
}

describe('CreditsRow — the first credit’s label', () => {
  it('heads the first credit Director when the movie page says so', () => {
    renderCreditsRow({ leadLabel: 'Director', lead: 'Michael Rowe' });

    expect(screen.getByText('Director')).toBeTruthy();
    expect(screen.getByText('Michael Rowe')).toBeTruthy();
  });

  it('heads the first credit Created by when the series page says so', () => {
    renderCreditsRow({ leadLabel: 'Created by', lead: 'Mara Quinn' });

    expect(screen.getByText('Created by')).toBeTruthy();
    expect(screen.getByText('Mara Quinn')).toBeTruthy();
    expect(screen.queryByText('Director')).toBeNull();
  });
});

describe('CreditsRow — the cast', () => {
  it('heads the cast Cast when the page names no other heading', () => {
    renderCreditsRow();

    expect(screen.getByText('Cast')).toBeTruthy();
    expect(screen.getByText('Ana Vega, Tomas Bell')).toBeTruthy();
  });

  it('heads the cast Starring when the series page names it so', () => {
    renderCreditsRow({ leadLabel: 'Created by', castLabel: 'Starring' });

    expect(screen.getByText('Starring')).toBeTruthy();
    expect(screen.queryByText('Cast')).toBeNull();
  });
});

describe('CreditsRow — a missing credit', () => {
  it('keeps both headings when only the first credit is missing', () => {
    renderCreditsRow({ leadLabel: 'Created by', lead: MISSING });

    expect(screen.getByText('Created by')).toBeTruthy();
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
    renderCreditsRow({
      leadLabel: 'Created by',
      lead: MISSING,
      castText: MISSING,
      hasCredits: false,
    });

    expect(screen.queryByText('Created by')).toBeNull();
    expect(screen.queryByText('Cast')).toBeNull();
    expect(screen.queryByText(MISSING)).toBeNull();
  });
});
