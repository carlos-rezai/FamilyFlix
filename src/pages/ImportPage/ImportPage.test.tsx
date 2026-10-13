import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import ImportPage from './ImportPage';
import { theme } from '@/styles/theme';
import {
  LocationProbe,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import {
  notFoundResponse,
  okResponse,
} from '@/test-support/fakeResponse/fakeResponse';

beforeEach(() => {
  // The flow asks for the current run on arrival and offers nothing until it
  // is answered; a page test never reaches the network, so the stub answers
  // it with the one state that lands on the setup step: no run.
  // The setup step reads the Library folders too: an empty list.
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        String(input).endsWith('/api/library-folders')
          ? okResponse([])
          : notFoundResponse('No import is running')
      )
    )
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Import opened from Settings, so Back has somewhere to go — the state the
 * one route into this screen actually creates.
 */
function renderPage(history: string[] = ['/', '/settings', '/import']) {
  return render(
    <MemoryRouter initialEntries={history} initialIndex={history.length - 1}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/" element={<p>the browse home</p>} />
          <Route path="/settings" element={<p>the settings hub</p>} />
          <Route path="/import" element={<ImportPage />} />
        </Routes>
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
}

/**
 * The measures of every box around the heading, innermost first — the
 * column's is the one the layout sets, wherever the flow's own wrappers sit.
 */
function measuresAroundHeading(): string[] {
  const measures: string[] = [];
  let node = screen.getByRole('heading', {
    level: 1,
    name: 'Import library',
  }).parentElement;
  while (node) {
    measures.push(getComputedStyle(node).maxWidth);
    node = node.parentElement;
  }
  return measures;
}

/**
 * `/import` — composition only: the **Import flow** in the **Maintainer
 * surface**, at the one **Page measure** every column screen shares. What the flow does once mounted is tested where it lives.
 */
describe('ImportPage', () => {
  it('mounts the import flow', async () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Import library' })
    ).toBeDefined();
    expect(
      await screen.findByRole('textbox', { name: 'Spreadsheet' })
    ).toBeDefined();
    expect(await screen.findByText('Library folders')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Start import' })).toBeDefined();
  });

  it('draws the column at the one Page measure', () => {
    renderPage();

    expect(measuresAroundHeading()).toContain('880px');
  });

  it('returns to Settings from Back', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(pathname()).toBe('/settings');
    expect(screen.getByText('the settings hub')).toBeDefined();
  });
});
