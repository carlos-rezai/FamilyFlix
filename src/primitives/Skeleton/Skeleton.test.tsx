import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import styled, { ThemeProvider } from 'styled-components';

import { Skeleton } from '@/primitives';
import { theme } from '@/styles/theme';

describe('Skeleton', () => {
  it('is hidden from assistive technology rather than announced as content', () => {
    // Six empty boxes read aloud is worse than silence — the screens using it
    // already announce "Loading" once through a role="status" wrapper.
    render(
      <ThemeProvider theme={theme}>
        <div data-testid="wrap">
          <Skeleton />
        </div>
      </ThemeProvider>
    );

    const block = screen.getByTestId('wrap').firstElementChild;
    expect(block?.getAttribute('aria-hidden')).toBe('true');
  });

  it('is sized by the call site, which is how one surface draws two screens', () => {
    const Poster = styled(Skeleton)`
      width: 300px;
    `;

    render(
      <ThemeProvider theme={theme}>
        <div data-testid="wrap">
          <Poster />
        </div>
      </ThemeProvider>
    );

    // The extension's class has to reach the element, or the call site's
    // dimensions never land.
    const block = screen.getByTestId('wrap').firstElementChild;
    expect(block?.className.split(' ').length).toBeGreaterThan(1);
  });
});
