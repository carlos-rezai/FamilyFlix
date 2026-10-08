import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import LibraryFoldersPage from './LibraryFoldersPage';
import { theme } from '@/styles/theme';
import {
  LocationProbe,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';

/**
 * 30 — Library folders refactor (issue 274), commit 16.
 *
 * `/settings/folders` — composition only, `CodecsPage`'s shape: the **Library
 * folders** organism in the **Maintainer surface**, at the Settings hub's own
 * 780 column. What the organism does once mounted is tested where it lives.
 */

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        okResponse(String(input) === '/api/tmdb/key' ? { key: null } : [])
      )
    )
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Opened from Settings, the state the Library folders row creates. */
function renderPage(
  history: string[] = ['/', '/settings', '/settings/folders']
) {
  return render(
    <MemoryRouter initialEntries={history} initialIndex={history.length - 1}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/" element={<p>the browse home</p>} />
          <Route path="/settings" element={<p>the settings hub</p>} />
          <Route path="/settings/folders" element={<LibraryFoldersPage />} />
        </Routes>
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
}

/** The measures of every box around the heading, innermost first. */
function measuresAroundHeading(): string[] {
  const measures: string[] = [];
  let node = screen.getByRole('heading', {
    level: 1,
    name: 'Library folders',
  }).parentElement;
  while (node) {
    measures.push(getComputedStyle(node).maxWidth);
    node = node.parentElement;
  }
  return measures;
}

describe('LibraryFoldersPage', () => {
  it('mounts the Library folders organism', async () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Library folders' })
    ).toBeDefined();
    expect(await screen.findByText('No folders yet.')).toBeDefined();
  });

  it('draws the column at the Settings hub’s 780 measure', () => {
    renderPage();

    expect(measuresAroundHeading()).toContain('780px');
    expect(measuresAroundHeading()).not.toContain('760px');
  });

  it('returns to Settings from Back', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(pathname()).toBe('/settings');
    expect(screen.getByText('the settings hub')).toBeDefined();
  });
});
