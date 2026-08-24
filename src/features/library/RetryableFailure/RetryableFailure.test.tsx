import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { RetryableFailure } from './RetryableFailure';
import { theme } from '@/styles/theme';

function renderFailure(onRetry = vi.fn()) {
  render(
    <ThemeProvider theme={theme}>
      <RetryableFailure
        title="Couldn’t load your library"
        body="Something went wrong reading your movies."
        onRetry={onRetry}
      />
    </ThemeProvider>
  );
  return onRetry;
}

describe('RetryableFailure', () => {
  it('says what failed, in the words the screen gave it', () => {
    renderFailure();

    expect(screen.getByText('Couldn’t load your library')).toBeDefined();
    expect(
      screen.getByText('Something went wrong reading your movies.')
    ).toBeDefined();
  });

  it('offers exactly one way out, and it is a Retry', () => {
    renderFailure();

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toBe('Retry');
  });

  it('runs the load again when Retry is pressed', () => {
    const onRetry = renderFailure();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not retry on its own, only when pressed', () => {
    const onRetry = renderFailure();

    expect(onRetry).not.toHaveBeenCalled();
  });
});
