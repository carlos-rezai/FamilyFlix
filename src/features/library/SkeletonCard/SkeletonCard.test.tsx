import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import styled, { ThemeProvider } from 'styled-components';

import { SkeletonCard } from './SkeletonCard';
import { theme } from '@/styles/theme';

function renderCard(node: React.ReactNode) {
  return render(
    <ThemeProvider theme={theme}>
      <div data-testid="wrap">{node}</div>
    </ThemeProvider>
  );
}

function card() {
  return screen.getByTestId('wrap').firstElementChild;
}

describe('SkeletonCard', () => {
  it('draws a poster block and the title line under it', () => {
    renderCard(<SkeletonCard />);

    expect(card()?.children).toHaveLength(2);
  });

  it('is hidden from assistive technology rather than announced as content', () => {
    // The screens using it announce "Loading" once, through a role="status".
    renderCard(<SkeletonCard />);

    expect(card()?.getAttribute('aria-hidden')).toBe('true');
  });

  it('has no accessible name of its own', () => {
    renderCard(<SkeletonCard />);

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('takes its width from the call site, which is the one thing screens differ on', () => {
    const Fixed = styled(SkeletonCard)`
      width: 190px;
    `;

    renderCard(<Fixed />);

    // The extension's class has to reach the element, or the strip's fixed
    // width never lands and the grid's track never wins.
    expect(card()?.className.split(' ').length).toBeGreaterThan(1);
  });
});
