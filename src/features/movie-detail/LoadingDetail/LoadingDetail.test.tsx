import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { LoadingDetail } from './LoadingDetail';
import { theme } from '@/styles/theme';

function renderLoadingDetail() {
  return render(
    <ThemeProvider theme={theme}>
      <LoadingDetail />
    </ThemeProvider>
  );
}

describe('LoadingDetail', () => {
  it('announces the wait once, as a named status', () => {
    renderLoadingDetail();

    expect(screen.getByRole('status', { name: 'Loading movie' })).toBeTruthy();
  });

  it('claims no title, so the page is never read as a movie that loaded', () => {
    renderLoadingDetail();

    expect(screen.queryAllByRole('heading')).toHaveLength(0);
  });

  it('hides the placeholder blocks from assistive technology', () => {
    // Nine empty boxes read aloud would describe the placeholder rather than
    // the wait, which the status above already announces.
    const { container } = renderLoadingDetail();

    const columns = container.querySelectorAll('[role="status"] > *');
    expect(columns).toHaveLength(2);
    columns.forEach((column) => {
      expect(column.getAttribute('aria-hidden')).toBe('true');
    });
  });
});
