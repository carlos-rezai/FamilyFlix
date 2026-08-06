import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { MainLayout } from './MainLayout';
import { theme } from '@/styles/theme';

/** Reports the router's current path, so a navigation can name the URL. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderLayout(children: React.ReactNode, entry = '/') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ThemeProvider theme={theme}>
        <MainLayout>{children}</MainLayout>
      </ThemeProvider>
      <LocationProbe />
    </MemoryRouter>
  );
}

function currentPath() {
  return screen.getByTestId('location').textContent;
}

const logo = () => screen.getByRole('button', { name: /familyflix/i });
const gear = () => screen.getByRole('button', { name: 'Settings' });

describe('MainLayout', () => {
  it('renders the body it is handed, under the header', () => {
    renderLayout(<p>the library goes here</p>);

    const body = screen.getByText('the library goes here');
    expect(body).toBeDefined();

    // The chrome is above the body, not wrapped around it.
    const header = screen.getByRole('banner');
    expect(header.contains(body)).toBe(false);
    expect(
      header.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('offers the logo and the gear on every screen it wraps', () => {
    renderLayout(<p>the library goes here</p>);

    expect(logo()).toBeDefined();
    expect(gear()).toBeDefined();
  });

  it('navigates home when the logo is clicked', () => {
    renderLayout(<p>the settings screen</p>, '/settings');

    fireEvent.click(logo());

    expect(currentPath()).toBe('/');
  });

  it('navigates to settings when the gear is clicked', () => {
    renderLayout(<p>the library goes here</p>);

    fireEvent.click(gear());

    expect(currentPath()).toBe('/settings');
  });

  it('labels the gear by the action it performs, not the glyph it draws', () => {
    renderLayout(<p>the library goes here</p>);

    expect(gear().getAttribute('aria-label')).toBe('Settings');
  });
});
