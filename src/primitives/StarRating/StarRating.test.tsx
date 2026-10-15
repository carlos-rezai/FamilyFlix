import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { StarRating } from './StarRating';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';

function renderStars(props: Parameters<typeof StarRating>[0]) {
  return render(
    <ThemeProvider theme={theme}>
      <StarRating {...props} />
    </ThemeProvider>
  );
}

describe('StarRating', () => {
  it('renders five stars for an unrated (0%) movie without crashing or blanking', () => {
    const { container } = renderStars({ rating: 0 });
    expect(container.textContent).toContain('★★★★★');
  });

  it('shows the numeric out-of-5 value when showValue is set', () => {
    const { getByText } = renderStars({ rating: 80, showValue: true });
    expect(getByText('4.0')).toBeTruthy();
  });
});

/**
 * An unrated movie and a movie someone scored nought are different facts, and
 * until now this atom printed `0.0` for both. It now takes the absence itself
 * rather than a percent standing in for one, and drops the *number* while
 * keeping the *stars* — the row is fixed furniture in a fixed-height tile, so
 * removing it would leave the cards in a row uneven.
 */
describe('StarRating — unrated is not zero', () => {
  it('suppresses the numeric value for an unrated movie even with showValue', () => {
    const { container, queryByText } = renderStars({
      rating: null,
      showValue: true,
    });

    expect(container.textContent).toContain('★★★★★');
    expect(queryByText('0.0')).toBeNull();
  });

  it('still prints 0.0 for a movie genuinely rated zero', () => {
    const { getByText } = renderStars({ rating: 0, showValue: true });
    expect(getByText('0.0')).toBeTruthy();
  });
});

/**
 * 26 — TMDB ratings (issue #370): a TMDB-sourced rating is drawn as
 * **TMDB-marked stars** — the same row, its filled stars `muted` off the
 * accent, and a `tag` after the value. The atom stays domain-free: it is
 * handed the word, it does not know what TMDB is.
 */
describe('StarRating — muted and tag', () => {
  /** `colors.accent`, as the browser resolves it. */
  const ACCENT = 'rgb(217, 122, 78)';

  /** The clipped row on top — the filled stars — after the base row. */
  function filledStars(): HTMLElement {
    return screen.getAllByText('★★★★★')[1];
  }

  it('changes nothing with neither prop: the accent fill, nothing after the value', () => {
    const { container } = renderStars({ rating: 80, showValue: true });

    expect(getComputedStyle(filledStars()).color).toBe(ACCENT);
    expect(container.textContent).toBe('★★★★★★★★★★4.0');
  });

  it('moves the filled stars off the accent when muted', () => {
    renderStars({ rating: 80, showValue: true, muted: true });

    const ink = getComputedStyle(filledStars()).color;
    expect(ink).not.toBe('');
    expect(ink).not.toBe(ACCENT);
  });

  it('draws the tag as readable text after the value', () => {
    renderStars({ rating: 70, showValue: true, muted: true, tag: 'TMDB' });

    const value = screen.getByText('3.5');
    const tag = screen.getByText('TMDB');
    expect(comesBefore(value, tag)).toBe(true);
  });
});
