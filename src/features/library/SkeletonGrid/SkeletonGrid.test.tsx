import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { SkeletonGrid } from './SkeletonGrid';
import { theme } from '@/styles/theme';

/**
 * 63, Row view, the closing round (issue #616): one loading grid for the two
 * screens that wait on a whole grid.
 */
describe('SkeletonGrid', () => {
  it('is a status named by its label, holding 12 placeholder cards', () => {
    render(
      <ThemeProvider theme={theme}>
        <SkeletonGrid label="Loading Drama" />
      </ThemeProvider>
    );

    const status = screen.getByRole('status', { name: 'Loading Drama' });
    expect(status.children).toHaveLength(12);
  });
});
