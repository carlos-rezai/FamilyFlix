import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { StatusBadge } from './StatusBadge';
import { theme } from '@/styles/theme';

describe('StatusBadge', () => {
  it('renders a labelled watched badge', () => {
    const { getByLabelText } = render(
      <ThemeProvider theme={theme}>
        <StatusBadge />
      </ThemeProvider>
    );
    expect(getByLabelText('Watched')).toBeTruthy();
  });
});
