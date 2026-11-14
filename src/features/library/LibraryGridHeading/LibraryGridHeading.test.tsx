import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { LibraryGridHeading } from './LibraryGridHeading';
import { theme } from '@/styles/theme';

/**
 * 63, Row view, the closing round (issue #616): the grid heading and its count
 * line, drawn once for the three bodies that show them.
 */
describe('LibraryGridHeading', () => {
  it('draws the title as a level-2 heading, the count line under it', () => {
    const { container } = render(
      <ThemeProvider theme={theme}>
        <LibraryGridHeading title="All series" count="3 series · 12 episodes" />
      </ThemeProvider>
    );

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toBe('All series');
    const count = screen.getByText('3 series · 12 episodes');
    expect(heading.nextElementSibling).toBe(count);
    expect(container.children).toHaveLength(2);
  });
});
