import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import SettingsPage from './SettingsPage';
import { theme } from '@/styles/theme';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <ThemeProvider theme={theme}>
        <SettingsPage />
      </ThemeProvider>
    </MemoryRouter>
  );
}

const header = () => screen.getByRole('heading', { name: 'Settings' });
const importRow = () =>
  screen.getByRole('button', { name: /import from spreadsheet/i });

/**
 * `/settings` — composition only. What the header does — where Back goes,
 * what ＋ Add a movie opens — is tested where it lives, in
 * `features/settings/SettingsHeader`; what the Library section's rows open,
 * in `features/settings/LibrarySection`.
 */
describe('SettingsPage', () => {
  it('composes the settings header in the maintainer sheet', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeDefined();
    // By its exact name: the Library section under it carries a second
    // "Add a movie", the row, whose name runs on into its line.
    expect(screen.getByRole('button', { name: 'Add a movie' })).toBeDefined();
  });

  it('composes the Library section under the header', () => {
    renderPage();

    // 13 — Bulk import, Phase 2 (issue #125): the first of the grouped
    // sections, because both of its destinations now exist.
    expect(screen.getByText('Library')).toBeDefined();
    expect(
      screen.getByRole('button', { name: /import from spreadsheet/i })
    ).toBeDefined();
    expect(comesBefore(header(), importRow())).toBe(true);
  });

  it('builds none of the other sections yet', () => {
    renderPage();

    // Playback, Storage and About are the settings-shell initiative's.
    for (const section of ['Playback', 'Storage', 'About']) {
      expect(screen.queryByText(section)).toBeNull();
    }
  });
});
