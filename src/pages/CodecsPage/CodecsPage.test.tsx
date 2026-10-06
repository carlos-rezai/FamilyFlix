import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import CodecsPage from './CodecsPage';
import type { PlaybackCapabilities } from '@/types';
import { theme } from '@/styles/theme';
import {
  LocationProbe,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';

/**
 * 26 — Codecs page, Phase 1: "the page, end to end" (issue #244).
 *
 * `/settings/codecs` — composition only, `ImportPage` and `EnrichmentPage`'s
 * shape: the **Codec manager** in the **Maintainer surface**, at the Settings
 * hub's own 780 column. What the manager does once mounted is tested where it
 * lives.
 */

const REPORT: PlaybackCapabilities = {
  component: null,
  codecs: [{ codec: 'h264', kind: 'video', support: 'native' }],
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(okResponse(REPORT)))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Opened from Settings, the state the Codecs row creates. */
function renderPage(
  history: string[] = ['/', '/settings', '/settings/codecs']
) {
  return render(
    <MemoryRouter initialEntries={history} initialIndex={history.length - 1}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/" element={<p>the browse home</p>} />
          <Route path="/settings" element={<p>the settings hub</p>} />
          <Route path="/settings/codecs" element={<CodecsPage />} />
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
    name: 'Codecs',
  }).parentElement;
  while (node) {
    measures.push(getComputedStyle(node).maxWidth);
    node = node.parentElement;
  }
  return measures;
}

describe('CodecsPage', () => {
  it('mounts the codec manager', async () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Codecs' })
    ).toBeDefined();
    expect(await screen.findByText(/formats enabled/)).toBeDefined();
    expect(screen.getByText('Add a codec pack')).toBeDefined();
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
