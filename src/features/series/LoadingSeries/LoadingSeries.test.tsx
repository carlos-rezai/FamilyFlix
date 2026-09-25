import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { LoadingSeries } from './LoadingSeries';
import { theme } from '@/styles/theme';

function renderLoadingSeries() {
  return render(
    <ThemeProvider theme={theme}>
      <LoadingSeries />
    </ThemeProvider>
  );
}

describe('LoadingSeries', () => {
  it('announces the wait once, as a named status', () => {
    renderLoadingSeries();

    expect(screen.getByRole('status', { name: 'Loading series' })).toBeTruthy();
  });

  it('claims no title, so the page is never read as a series that loaded', () => {
    renderLoadingSeries();

    expect(screen.queryAllByRole('heading')).toHaveLength(0);
  });

  it('hides the placeholder blocks from assistive technology', () => {
    const { container } = renderLoadingSeries();

    const hero = container.querySelectorAll('[role="status"] > *');
    expect(hero).toHaveLength(1);
    expect(hero[0].getAttribute('aria-hidden')).toBe('true');
  });
});
