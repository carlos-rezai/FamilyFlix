import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { EditMenu } from './EditMenu';
import { theme } from '@/styles/theme';

/**
 * Opening, closing and focus return belong to `mol.Menu` and are tested there.
 * What is left for this file is the part that is this menu's own: which control
 * opens it, what it offers, and where that offer goes.
 */
function renderEditMenu(movieId = 'm1') {
  function Probe() {
    const location = useLocation();
    return (
      <span data-testid="destination">{`${location.pathname}${location.search}`}</span>
    );
  }

  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={['/movie/m1']}>
        <EditMenu movieId={movieId} />
        <Probe />
      </MemoryRouter>
    </ThemeProvider>
  );
}

const openMenu = () =>
  fireEvent.click(screen.getByRole('button', { name: 'More options' }));

describe('EditMenu', () => {
  it('offers a named ⋯ trigger', () => {
    renderEditMenu();

    expect(screen.getByRole('button', { name: 'More options' })).toBeTruthy();
  });

  it('holds only Edit details — no Delete row, disabled or otherwise', () => {
    renderEditMenu();

    openMenu();

    expect(screen.getByRole('button', { name: 'Edit details' })).toBeTruthy();
    expect(screen.queryByText(/delete/i)).toBeNull();
  });

  it('sends Edit details to the add screen carrying this movie', () => {
    renderEditMenu('northwind-1994');

    openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));

    expect(screen.getByTestId('destination').textContent).toBe(
      '/add?movie=northwind-1994'
    );
  });
});
