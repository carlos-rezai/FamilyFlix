import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import SettingsPage from './SettingsPage';
import { theme } from '@/styles/theme';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <ThemeProvider theme={theme}>
        <SettingsPage />
      </ThemeProvider>
    </MemoryRouter>
  );
}

/**
 * `/settings` — composition only. What the header does — where Back goes,
 * what ＋ Add a movie opens — is tested where it lives, in
 * `features/settings/SettingsHeader`.
 */
describe('SettingsPage', () => {
  it('composes the settings header in the maintainer sheet', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeDefined();
    expect(screen.getByRole('button', { name: /add a movie/i })).toBeDefined();
  });
});
