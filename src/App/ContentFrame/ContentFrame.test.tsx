import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ContentFrame } from './ContentFrame';
import { DisplayPreferenceContext } from '@/App/useDisplayPreference/useDisplayPreference';
import { theme } from '@/styles/theme';

/**
 * 27 — Ultrawide margins: the **Content frame**'s own rule (refactor 252).
 *
 * On, the frame caps what its outlet renders at the **Content measure** —
 * `max-width: 1920px` with auto side margins. Off, or `null` before the read
 * lands, there is no cap at all. Whatever the preference, the child route
 * renders inside it.
 *
 * The frame is rendered as a layout route on a `MemoryRouter`, the preference
 * handed to it on the context directly — no fetch, no provider. Which routes
 * are framed is the route table's, proven through `App` in
 * `App.contentFrame.test.tsx`.
 */

function renderFramed(ultrawideMargins: boolean | null) {
  return render(
    <ThemeProvider theme={theme}>
      <DisplayPreferenceContext.Provider
        value={{ ultrawideMargins, setUltrawideMargins: async () => undefined }}
      >
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<ContentFrame />}>
              <Route path="/" element={<p>Framed screen</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </DisplayPreferenceContext.Provider>
    </ThemeProvider>
  );
}

/** The frame: the element the child route renders directly inside. */
function frame(): HTMLElement {
  return screen.getByText('Framed screen').parentElement as HTMLElement;
}

describe('ContentFrame', () => {
  it('caps its outlet at 1920px with auto side margins while the preference is on', () => {
    renderFramed(true);

    const style = getComputedStyle(frame());
    expect(style.maxWidth).toBe('1920px');
    expect(style.marginLeft).toBe('auto');
    expect(style.marginRight).toBe('auto');
  });

  it('draws no cap while the preference is off', () => {
    renderFramed(false);

    expect(getComputedStyle(frame()).maxWidth).toBe('');
  });

  it('draws no cap while the preference is null — the read not landed', () => {
    renderFramed(null);

    expect(getComputedStyle(frame()).maxWidth).toBe('');
  });

  it('renders the child route inside it', () => {
    const { container } = renderFramed(true);

    expect(screen.getByText('Framed screen')).toBeTruthy();
    expect(container.firstElementChild).toBe(frame());
  });
});
