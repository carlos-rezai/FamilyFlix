import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { ProgressBar } from './ProgressBar';
import { theme } from '../../styles/theme';

function renderBar(props: Parameters<typeof ProgressBar>[0]) {
  return render(
    <ThemeProvider theme={theme}>
      <ProgressBar {...props} />
    </ThemeProvider>
  );
}

describe('ProgressBar', () => {
  it('exposes the clamped percent on the determinate bar', () => {
    const { getByRole } = renderBar({ percent: 150 });
    expect(getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });

  it('omits aria-valuenow when indeterminate', () => {
    const { getByRole } = renderBar({ indeterminate: true });
    expect(getByRole('progressbar').getAttribute('aria-valuenow')).toBeNull();
  });
});
