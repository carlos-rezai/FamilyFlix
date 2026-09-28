import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';
import type { Candidate } from '@/types';
import { CandidatePicker, type CandidatePickerProps } from './CandidatePicker';

/**
 * 23 — Enrichment refactor (issue #214), Group 4: `CandidatePicker` is its own
 * unit, its leaves moved down from `DecisionRow`'s suite.
 *
 * An `ambiguous` **Decision**'s face: one button per **Candidate** — its
 * poster straight from `image.tmdb.org` over the Gradient fallback, the
 * title, year · genre · language, and _% match_, green above 70 — then the
 * dashed _Search by title_ card. It reports `onPick(tmdbId)` and
 * `onSearchByTitle()`, nothing more.
 */

const candidate = (overrides: Partial<Candidate> = {}): Candidate => ({
  tmdbId: 101,
  title: 'Harbor Lights',
  year: 1963,
  genre: 'Drama',
  language: 'EN',
  posterUrl: 'https://image.tmdb.org/t/p/w185/poster-101.jpg',
  score: 82,
  ...overrides,
});

const CANDIDATES: Candidate[] = [
  candidate(),
  candidate({ tmdbId: 102, year: 2019, score: 70, posterUrl: null }),
  candidate({
    tmdbId: 103,
    title: 'The Harbor Light',
    year: 2005,
    genre: null,
    language: 'NO',
    score: 51,
    posterUrl: 'https://image.tmdb.org/t/p/w185/poster-103.jpg',
  }),
];

function renderPicker(props: Partial<CandidatePickerProps> = {}) {
  const handlers = {
    onPick: vi.fn<(tmdbId: number) => void>(),
    onSearchByTitle: vi.fn(),
  };
  render(
    <ThemeProvider theme={theme}>
      <CandidatePicker
        candidates={props.candidates ?? CANDIDATES}
        onPick={props.onPick ?? handlers.onPick}
        onSearchByTitle={props.onSearchByTitle ?? handlers.onSearchByTitle}
      />
    </ThemeProvider>
  );
  return handlers;
}

const candidateButtons = () =>
  screen.getAllByRole('button', { name: /% match/ });
const searchCard = () =>
  screen.getByRole('button', { name: 'Search by title' });
const style = (
  element: Element,
  property: string,
  state: Parameters<typeof resolvedStyle>[1] = {}
) => normCss(resolvedStyle(element, state)[property] ?? '');

describe('CandidatePicker — the cards', () => {
  it('draws one card per candidate', () => {
    renderPicker();

    expect(candidateButtons()).toHaveLength(3);
  });

  it('draws a candidate’s title, its meta line and % match', () => {
    renderPicker();

    const card = candidateButtons()[0];
    expect(within(card).getByText('Harbor Lights')).toBeDefined();
    expect(within(card).getByText('1963 · Drama · EN')).toBeDefined();
    expect(within(card).getByText('82% match')).toBeDefined();
  });

  it('leaves out of the meta line whatever TMDB does not know', () => {
    renderPicker();

    expect(within(candidateButtons()[2]).getByText('2005 · NO')).toBeDefined();
  });

  it('loads a candidate’s poster straight from TMDB', () => {
    renderPicker();

    const poster = candidateButtons()[0].querySelector('img');
    expect(poster?.getAttribute('src')).toBe(
      'https://image.tmdb.org/t/p/w185/poster-101.jpg'
    );
  });

  it('draws the Gradient fallback, and no image, for a candidate with no poster', () => {
    renderPicker();

    expect(candidateButtons()[1].querySelector('img')).toBeNull();
    expect(
      style(candidateButtons()[1].firstElementChild as Element, 'background')
    ).toMatch(/^linear-gradient\(155deg/);
  });

  it('reports the candidate picked by its TMDB id', () => {
    const { onPick } = renderPicker();

    fireEvent.click(candidateButtons()[2]);

    expect(onPick).toHaveBeenCalledWith(103);
  });
});

describe('CandidatePicker — % match', () => {
  it('wears the watched green above 70', () => {
    renderPicker();

    expect(style(screen.getByText('82% match'), 'color')).toBe(
      normCss(theme.colors.watched)
    );
  });

  it('is faint at 70 and below', () => {
    renderPicker();

    expect(style(screen.getByText('70% match'), 'color')).toBe(
      normCss(theme.colors.textFaint)
    );
    expect(style(screen.getByText('51% match'), 'color')).toBe(
      normCss(theme.colors.textFaint)
    );
  });
});

describe('CandidatePicker — Search by title', () => {
  it('closes the row with the dashed card', () => {
    renderPicker();

    const buttons = screen.getAllByRole('button');
    expect(buttons.at(-1)).toBe(searchCard());
    expect(style(searchCard(), 'border')).toBe(
      normCss(`1px dashed ${theme.colors.border}`)
    );
  });

  it('reports its press', () => {
    const { onSearchByTitle, onPick } = renderPicker();

    fireEvent.click(searchCard());

    expect(onSearchByTitle).toHaveBeenCalledTimes(1);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('lights its border in the accent line on hover', () => {
    renderPicker();

    expect(style(searchCard(), 'border-color', { hover: true })).toBe(
      normCss(theme.colors.accentLine)
    );
    expect(style(searchCard(), 'color', { hover: true })).toBe(
      normCss(theme.colors.textDim)
    );
  });

  it('is drawn with no candidates at all', () => {
    renderPicker({ candidates: [] });

    expect(screen.queryAllByRole('button', { name: /% match/ })).toHaveLength(
      0
    );
    expect(searchCard()).toBeDefined();
  });
});
