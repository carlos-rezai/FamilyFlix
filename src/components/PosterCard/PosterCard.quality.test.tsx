// 70 — Video quality, Phase 1: "one film, through the Movie form" (issue #664).
//
// The card's Star row becomes a flex row, the stars at its left and the
// title's rung of the **Quality ladder** at its right end, a `prim.MetaTag`
// drawn only while `quality` is set. The art is untouched, and the card is
// still named by its title alone: the tag is a glance, not an announcement.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { PosterCard } from './PosterCard';
import { theme } from '@/styles/theme';
import type { PosterCardMovie } from '@/types';
import { makePosterCardMovie } from '@/test-support/makePosterCardMovie/makePosterCardMovie';
import { resolvedStyle } from '@/test-support/resolvedStyle/resolvedStyle';

function renderCard(movie: PosterCardMovie) {
  return render(
    <ThemeProvider theme={theme}>
      <PosterCard
        movie={movie}
        onOpen={() => undefined}
        onToggleFavorite={() => undefined}
      />
    </ThemeProvider>
  );
}

const rated = (quality: PosterCardMovie['quality']): PosterCardMovie =>
  makePosterCardMovie({ title: 'Comet Season', rating: 80, quality });

/** The card's own control, named for the movie. */
const card = () => screen.getByRole('button', { name: 'Comet Season' });

/** The 2:3 poster tile: the root's first child, the art's frame. */
function tile(): Element {
  const first = card().firstElementChild;
  if (first === null) throw new Error('the card has no tile');
  return first;
}

/** The smallest element holding the stars, which is the Star row's star side. */
function starsElement(): Element {
  const all = Array.from(card().querySelectorAll('*')).filter((element) =>
    (element.textContent ?? '').includes('★★★★★')
  );
  const innermost = all.filter(
    (element) =>
      !all.some((other) => other !== element && element.contains(other))
  );
  if (innermost.length === 0) throw new Error('the card draws no stars');
  return innermost[0];
}

describe('PosterCard — the quality tag', () => {
  it('draws the tag when quality is set', () => {
    renderCard(rated('1080p'));

    expect(screen.getByText('1080p')).toBeTruthy();
  });

  it('draws it at the Star row’s end, after the stars', () => {
    renderCard(rated('4K'));

    const tag = screen.getByText('4K');
    // The row: the nearest ancestor holding both the stars and the tag.
    let row: Element | null = tag.parentElement;
    while (row !== null && !row.contains(starsElement())) {
      row = row.parentElement;
    }
    if (row === null) throw new Error('the tag shares no row with the stars');

    expect(tile().contains(tag)).toBe(false);
    const last = row.lastElementChild;
    expect(last?.contains(tag)).toBe(true);
    expect(last?.contains(starsElement())).toBe(false);

    const style = resolvedStyle(row);
    expect(style.display).toBe('flex');
    expect(style['justify-content']).toBe('space-between');
    expect(style['align-items']).toBe('center');
  });

  it('draws no tag when quality is null', () => {
    const withTag = renderCard(rated('720p'));
    const tagged = withTag.container.textContent ?? '';
    withTag.unmount();

    const { container } = renderCard(rated(null));

    expect(screen.queryByText('720p')).toBeNull();
    expect(tagged).toBe(`${container.textContent ?? ''}720p`);
  });

  it('leaves the art unchanged', () => {
    const untagged = renderCard(rated(null));
    const art = tile().innerHTML;
    untagged.unmount();

    renderCard(rated('480p'));

    expect(screen.getByText('480p')).toBeTruthy();
    expect(tile().innerHTML).toBe(art);
  });

  it('is still named by its title alone', () => {
    renderCard(rated('SD'));

    expect(screen.getByText('SD')).toBeTruthy();
    expect(card().getAttribute('aria-label')).toBe('Comet Season');
    expect(screen.getByRole('button', { name: 'Comet Season' })).toBe(card());
  });

  it('adds no control to the card', () => {
    renderCard(rated('1080p'));

    expect(screen.getByText('1080p')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
