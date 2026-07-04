import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { StarRating } from './StarRating';
import { theme } from '../../styles/theme';

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
