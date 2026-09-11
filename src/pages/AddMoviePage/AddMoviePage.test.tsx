import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import AddMoviePage from './AddMoviePage';
import { theme } from '@/styles/theme';

beforeEach(() => {
  // The form writes on Save and reads nothing on mount in this slice; the stub
  // is here so a page test never reaches the network if that ever changes.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => undefined))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderPage(url = '/add') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ThemeProvider theme={theme}>
        <AddMoviePage />
      </ThemeProvider>
    </MemoryRouter>
  );
}

/**
 * `/add` — composition only: the **Movie form** in the **Maintainer surface**.
 * What the form does once mounted is tested where it lives.
 */
describe('AddMoviePage', () => {
  it('mounts the movie form', () => {
    renderPage();

    expect(screen.getByRole('textbox', { name: /title/i })).toBeDefined();
    expect(screen.getByRole('textbox', { name: /year/i })).toBeDefined();
    expect(
      screen.getByRole('button', { name: /add to library/i })
    ).toBeDefined();
  });
});
