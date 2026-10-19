import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import ManageLibraryPage from './ManageLibraryPage';
import { theme } from '@/styles/theme';
import {
  LocationProbe,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';

/**
 * 47 — Manage library, Phase 1: "the list, read-only" (issue #407).
 *
 * `/settings/library` — composition only, `LibraryFoldersPage`'s shape: the
 * **Manage library page**'s organism in the **Maintainer surface**, at the
 * one **Page measure**. What the organism does once mounted is tested where
 * it lives.
 */

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(okResponse({ movies: [], series: [] })))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Opened from Settings, the state the Manage library row creates. */
function renderPage(
  history: string[] = ['/', '/settings', '/settings/library']
) {
  return render(
    <MemoryRouter initialEntries={history} initialIndex={history.length - 1}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/" element={<p>the browse home</p>} />
          <Route path="/settings" element={<p>the settings hub</p>} />
          <Route path="/settings/library" element={<ManageLibraryPage />} />
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
    name: 'Manage library',
  }).parentElement;
  while (node) {
    measures.push(getComputedStyle(node).maxWidth);
    node = node.parentElement;
  }
  return measures;
}

describe('ManageLibraryPage', () => {
  it('mounts the Manage library organism', async () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Manage library' })
    ).toBeDefined();
    expect(await screen.findByText('No movies in your library.')).toBeDefined();
  });

  it('draws the column at the one Page measure', () => {
    renderPage();

    expect(measuresAroundHeading()).toContain('880px');
  });

  it('returns to Settings from Back', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(pathname()).toBe('/settings');
    expect(screen.getByText('the settings hub')).toBeDefined();
  });
});
