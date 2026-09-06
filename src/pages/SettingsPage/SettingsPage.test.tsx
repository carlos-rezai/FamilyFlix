import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import SettingsPage from './SettingsPage';
import { theme } from '@/styles/theme';
import { LocationProbe } from '@/test-support/LocationProbe/LocationProbe';

/**
 * Settings opened from the browse home, so Back has somewhere to go — the state
 * every route into this screen actually creates, since the gear is the only
 * door.
 */
function renderPage(history: string[] = ['/', '/settings']) {
  return render(
    <MemoryRouter initialEntries={history} initialIndex={history.length - 1}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route path="/" element={<p>the browse home</p>} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/add" element={<p>the movie form</p>} />
        </Routes>
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>
  );
}

const back = () => screen.getByRole('button', { name: /back/i });
const addMovie = () => screen.getByRole('button', { name: /add a movie/i });
const currentPath = () => screen.getByTestId('pathname').textContent;

/**
 * The **Maintainer**'s hub, and the reason this slice is a tracer bullet rather
 * than a URL typed into the address bar: the gear is the only route to any
 * maintainer surface, and ＋ Add a movie is the only route from here to the
 * **Movie form**.
 *
 * Four elements and nothing else. The grouped Library / Playback / Storage /
 * About sections are a different initiative, and the last test here is what
 * keeps them from arriving early and unasked.
 */
describe('SettingsPage', () => {
  it('renders the header the prototype draws', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeDefined();
    expect(back()).toBeDefined();
    expect(addMovie()).toBeDefined();
    expect(
      screen.getByText('Manage your library, playback, and storage.')
    ).toBeDefined();
  });

  it('returns to where Settings was opened from', () => {
    renderPage(['/', '/settings']);

    fireEvent.click(back());

    // A history step, not a navigation to `/` — the browse home the maintainer
    // had already filtered and scrolled, returned to as they left it. The one
    // Back rule the app has.
    expect(currentPath()).toBe('/');
  });

  it('returns to the browse home when there is no history behind it', () => {
    renderPage(['/settings']);

    fireEvent.click(back());

    // Reloaded or deep-linked: a history step would strand the maintainer on
    // the screen they asked to leave.
    expect(currentPath()).toBe('/');
  });

  it('opens the movie form from ＋ Add a movie', () => {
    renderPage();

    fireEvent.click(addMovie());

    expect(currentPath()).toBe('/add');
  });

  it('builds nothing below the header', () => {
    renderPage();

    // The settings-shell initiative owns these. Asserting their absence is what
    // keeps this slice honest about being four static elements.
    for (const section of ['Library', 'Playback', 'Storage', 'About']) {
      expect(screen.queryByText(section)).toBeNull();
    }
  });
});
