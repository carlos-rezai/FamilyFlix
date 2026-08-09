import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { ContinueCard } from './ContinueCard';
import { theme } from '@/styles/theme';
import type { ContinueCardMovie } from '@/types';

const movie: ContinueCardMovie = {
  id: 'm1',
  title: 'Comet Season',
  g1: '#1f2a3a',
  g2: '#3a6a8a',
  resumeLabel: 'Resume · 1:13 of 1:55',
  progress: 64,
};

function renderCard(
  overrides: { onOpen?: () => void; movie?: ContinueCardMovie } = {}
) {
  return render(
    <ThemeProvider theme={theme}>
      <ContinueCard
        movie={overrides.movie ?? movie}
        onOpen={overrides.onOpen ?? (() => undefined)}
      />
    </ThemeProvider>
  );
}

describe('ContinueCard', () => {
  it('shows the movie title', () => {
    const { getByText } = renderCard();

    expect(getByText('Comet Season')).toBeTruthy();
  });

  it('shows the resume label exactly as the mapper built it', () => {
    const { getByText } = renderCard();

    expect(getByText('Resume · 1:13 of 1:55')).toBeTruthy();
  });

  it('fills the progress track to the model percent', () => {
    const { getByRole } = renderCard();

    expect(getByRole('progressbar').getAttribute('aria-valuenow')).toBe('64');
  });

  it('clamps a percent past the end of the movie to 100', () => {
    const { getByRole } = renderCard({ movie: { ...movie, progress: 150 } });

    expect(getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });

  it('clamps a negative percent to an empty track', () => {
    const { getByRole } = renderCard({ movie: { ...movie, progress: -20 } });

    expect(getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  it('calls onOpen when the tile is clicked', () => {
    const onOpen = vi.fn();
    const { container } = renderCard({ onOpen });

    fireEvent.click(container.firstChild as Element);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('offers no favorite control anywhere on the tile', () => {
    const { queryByTitle, queryByLabelText } = renderCard();

    expect(queryByTitle('Favorite')).toBeNull();
    expect(queryByLabelText(/favorite/i)).toBeNull();
  });
});

describe('ContinueCard — opening it without a mouse', () => {
  it('exposes a control named for the movie', () => {
    renderCard();

    expect(screen.getByRole('button', { name: 'Comet Season' })).toBeTruthy();
  });

  it('gives that control a tab stop, so it can be reached at all', () => {
    renderCard();
    const tile = screen.getByRole('button', { name: 'Comet Season' });

    tile.focus();

    // jsdom only moves focus to an element the focus rules say is focusable, so
    // this fails for a bare div exactly as tabbing to one would.
    expect(document.activeElement).toBe(tile);
  });

  it('is a real button, so Enter and Space open the movie', () => {
    const onOpen = vi.fn();
    renderCard({ onOpen });
    const tile = screen.getByRole('button', { name: 'Comet Season' });

    // The tile holds no other control, so it can be a button outright and let
    // the platform do the keyboard work: browsers synthesise a click from Enter
    // and from Space on a button, which is strictly better than re-implementing
    // that by hand. jsdom does not simulate that synthesis, so the assertion
    // that carries the guarantee is that this really is a button rather than a
    // div wearing a role — and that the click it would synthesise opens the
    // movie.
    expect(tile.tagName).toBe('BUTTON');
    expect(tile.hasAttribute('disabled')).toBe(false);

    fireEvent.click(tile);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
