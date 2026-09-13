import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import ImportPage from './ImportPage';
import { theme } from '@/styles/theme';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';

beforeEach(() => {
  // The flow writes on Start import and reads nothing on mount in this slice;
  // the stub is here so a page test never reaches the network if that ever
  // changes.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => undefined))
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
 * surface**, at the 760 measure `feat.ImportFlow.dc.html` draws its column
 * at. What the flow does once mounted is tested where it lives.
 */
describe('ImportPage', () => {
  it('mounts the import flow', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Import library' })
    ).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Spreadsheet' })).toBeDefined();
    expect(
      screen.getByRole('textbox', { name: 'Movies root folder' })
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Start import' })).toBeDefined();
  });

  it('draws the column at the flow’s 760 measure', () => {
    renderPage();

    // 760, not Settings' 780: the two prototypes draw their columns a
    // measure apart, and until they are amended to one sheet each screen
    // states its own.
    expect(measuresAroundHeading()).toContain('760px');
    expect(measuresAroundHeading()).not.toContain('780px');
  });

  it('returns to Settings from Back', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(screen.getByTestId('pathname').textContent).toBe('/settings');
    expect(screen.getByText('the settings hub')).toBeDefined();
  });
});
