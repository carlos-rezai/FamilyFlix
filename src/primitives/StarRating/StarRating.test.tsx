import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { StarRating } from './StarRating';
import { theme } from '@/styles/theme';

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
