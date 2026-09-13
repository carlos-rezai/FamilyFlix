import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { LibrarySection } from './LibrarySection';
import { theme } from '@/styles/theme';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';

/**
 * 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125).
 *
 * The Settings hub's **Library section**, from `page.SettingsPage.dc.html`:
 * the `Library` group heading over the `＋ Add a movie` and `⇪ Import from
 * spreadsheet` rows. Exactly two — the prototype draws a third, `⬇ Export to
 * CSV`, and a row whose destination does not exist is not drawn. Export is
 * its own initiative.
 *
 * Like `SettingsHeader`, the section owns where its rows lead: the maintainer
 * surface's only doors are here, and a page is composition only.
 */
function renderSection() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/settings" element={<LibrarySection />} />
          <Route path="/add" element={<p>the movie form</p>} />
          <Route path="/import" element={<p>the import flow</p>} />
        </Routes>
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
}

const addRow = () => screen.getByRole('button', { name: /add a movie/i });
const importRow = () =>
  screen.getByRole('button', { name: /import from spreadsheet/i });
const currentPath = () => screen.getByTestId('pathname').textContent;

describe('LibrarySection', () => {
  it('is headed Library', () => {
    renderSection();

    expect(screen.getByText('Library')).toBeDefined();
  });

  it('draws exactly two rows, Add a movie above Import from spreadsheet', () => {
    renderSection();

    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(comesBefore(addRow(), importRow())).toBe(true);
  });

  it('draws each row with its glyph and its line', () => {
    renderSection();

    expect(screen.getByText('＋')).toBeDefined();
    expect(
      screen.getByText(
        'Pick the video, poster, and subtitle files for one title.'
      )
    ).toBeDefined();
    expect(screen.getByText('⇪')).toBeDefined();
    expect(
      screen.getByText(
        'Bulk-migrate a spreadsheet + movie folders in one pass.'
      )
    ).toBeDefined();
  });

  it('draws no Export row — its destination does not exist yet', () => {
    renderSection();

    expect(screen.queryByText(/export/i)).toBeNull();
  });

  it('lands on the movie form from Add a movie', () => {
    renderSection();

    fireEvent.click(addRow());

    expect(currentPath()).toBe('/add');
    expect(screen.getByText('the movie form')).toBeDefined();
  });

  it('lands on the import flow from Import from spreadsheet', () => {
    renderSection();

    fireEvent.click(importRow());

    expect(currentPath()).toBe('/import');
    expect(screen.getByText('the import flow')).toBeDefined();
  });
});
