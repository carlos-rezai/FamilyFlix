import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { LibrarySection } from './LibrarySection';
import { GroupHeading } from '../section.styles';
import { theme } from '@/styles/theme';
import {
  LocationProbe,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';

/**
 * 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125).
 *
 * The Settings hub's **Library section**, from `page.SettingsPage.dc.html`:
 * the `Library` group heading over the `＋ Add a movie` and `⇪ Import from
 * spreadsheet` rows.
 *
 * 14 — Export, Phase 1: "the tracer bullet" (issue #137) draws the third row
 * the prototype always had, `⬇ Export to CSV` — the label kept as drawn
 * though the dialog offers Excel — and it leads to an overlay rather than a
 * route: the section holds whether the **Export dialog** is open and mounts
 * it beside its rows, so closing it leaves the page where it was, with focus
 * back on the row. The app's first import of one feature's organism by
 * another: a section composing a dialog is fine; a feature importing another's
 * hook or wire would not be.
 *
 * Like `SettingsHeader`, the section owns where its rows lead: the maintainer
 * surface's only doors are here, and a page is composition only.
 *
 * 15 — Settings hub, Phase 1: "the tracer bullet" (issue #143) moves the
 * **Group heading** into the feature's shared `section.styles.ts`, the
 * furniture every **Settings group** draws with, so the Playback card's
 * heading and this one are one styled component rather than two copies.
 * The three rows are exactly as before.
 */
let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  // The dialog asks for the **Export summary** on open; the section's tests
  // are not about the count, so every read answers a small library.
  fetchMock = vi
    .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
    .mockResolvedValue(okResponse({ movieCount: 3 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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
const exportRow = () => screen.getByRole('button', { name: /export to csv/i });
const exportDialog = () =>
  screen.queryByRole('dialog', { name: 'Export library' });

describe('LibrarySection', () => {
  it('is headed Library', () => {
    renderSection();

    expect(screen.getByText('Library')).toBeDefined();
  });

  it('draws its heading with the shared section furniture', () => {
    // The same styled component the other groups' headings are: rendered on
    // its own beside the section, it carries the same class.
    renderSection();
    const { container } = render(
      <ThemeProvider theme={theme}>
        <GroupHeading>Elsewhere</GroupHeading>
      </ThemeProvider>
    );
    const shared = container.firstElementChild as HTMLElement;

    const heading = screen.getByText('Library');
    expect(shared.className.length).toBeGreaterThan(0);
    expect(heading.className).toBe(shared.className);
    expect(getComputedStyle(heading).textTransform).toBe('uppercase');
  });

  it('draws exactly three rows: Add a movie, Import from spreadsheet, Export to CSV', () => {
    renderSection();

    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(comesBefore(addRow(), importRow())).toBe(true);
    expect(comesBefore(importRow(), exportRow())).toBe(true);
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
    expect(screen.getByText('⬇')).toBeDefined();
    expect(
      screen.getByText('Save your whole library out as a spreadsheet backup.')
    ).toBeDefined();
  });

  it('labels the third row Export to CSV, as drawn, though the dialog offers Excel', () => {
    renderSection();

    expect(screen.getByText('Export to CSV')).toBeDefined();
  });

  it('keeps the Export dialog shut until the row is pressed', () => {
    renderSection();

    expect(exportDialog()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lands on the movie form from Add a movie', () => {
    renderSection();

    fireEvent.click(addRow());

    expect(pathname()).toBe('/add');
    expect(screen.getByText('the movie form')).toBeDefined();
  });

  it('lands on the import flow from Import from spreadsheet', () => {
    renderSection();

    fireEvent.click(importRow());

    expect(pathname()).toBe('/import');
    expect(screen.getByText('the import flow')).toBeDefined();
  });
});

describe('LibrarySection — the Export row', () => {
  it('opens the Export dialog over the page', () => {
    renderSection();

    fireEvent.click(exportRow());

    expect(exportDialog()).not.toBeNull();
    expect(
      within(exportDialog() as HTMLElement).getByRole('button', {
        name: 'Export as CSV',
      })
    ).toBeDefined();
  });

  it('navigates nowhere — the row leads to an overlay, not a route', () => {
    renderSection();

    fireEvent.click(exportRow());

    expect(pathname()).toBe('/settings');
    expect(screen.getByText('Library')).toBeDefined();
    expect(addRow()).toBeDefined();
  });

  it('closes from Cancel and leaves the page where it was', () => {
    renderSection();
    fireEvent.click(exportRow());

    fireEvent.click(
      within(exportDialog() as HTMLElement).getByRole('button', {
        name: 'Cancel',
      })
    );

    expect(exportDialog()).toBeNull();
    expect(pathname()).toBe('/settings');
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('closes from the ✕', () => {
    renderSection();
    fireEvent.click(exportRow());

    fireEvent.click(
      within(exportDialog() as HTMLElement).getByRole('button', {
        name: 'Close',
      })
    );

    expect(exportDialog()).toBeNull();
  });

  it('closes from Escape', () => {
    renderSection();
    fireEvent.click(exportRow());

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });

    expect(exportDialog()).toBeNull();
  });

  it('returns focus to the row once the dialog is closed', () => {
    renderSection();
    const row = exportRow();
    row.focus();
    fireEvent.click(row);
    expect(document.activeElement).toBe(exportDialog());

    fireEvent.click(
      within(exportDialog() as HTMLElement).getByRole('button', {
        name: 'Cancel',
      })
    );

    expect(document.activeElement).toBe(row);
  });

  it('opens again after being closed', () => {
    renderSection();
    fireEvent.click(exportRow());
    fireEvent.click(
      within(exportDialog() as HTMLElement).getByRole('button', {
        name: 'Cancel',
      })
    );

    fireEvent.click(exportRow());

    expect(exportDialog()).not.toBeNull();
  });
});
