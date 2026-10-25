import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { UpNextCard, type UpNextCardProps } from './UpNextCard';
import { theme } from '@/styles/theme';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';

/**
 * 22 — Series (TV), Phase 6: "Up next — the countdown and auto-play"
 * (issue #196).
 *
 * The **Up next card**, drawn 1:1 from the `showNextEp` block of
 * `feat.PlayerControls.dc.html`: 440px wide, 28px from the right and 150px up,
 * on `ffPop`; a 16:9 thumbnail, centred, beside _Up next · in 12s_, the next
 * episode's code and its title, then _Play now_ and _Cancel_. Since #423 the
 * thumbnail takes the width the text column does not need, so the margin is
 * even, and its **Still** covers it edge to edge.
 *
 * Presentational: it is told the **Next episode** and the seconds left, and
 * hands the two presses back. When it is shown, what the countdown reads and
 * what a press does to the screen are the `Player`'s, proven in
 * `Player.upNext.test.tsx`.
 */

const NEXT: UpNextCardProps['next'] = {
  id: 'e31',
  season: 3,
  number: 1,
  title: 'New Moorings',
  stillPath: null,
};

function renderCard(props: Partial<UpNextCardProps> = {}) {
  const onPlayNow = vi.fn();
  const onCancel = vi.fn();
  render(
    <ThemeProvider theme={theme}>
      <UpNextCard
        next={NEXT}
        secondsLeft={12}
        onPlayNow={onPlayNow}
        onCancel={onCancel}
        {...props}
      />
    </ThemeProvider>
  );
  return { onPlayNow, onCancel };
}

const label = () => screen.getByText('Up next · in 12s');
const playNow = () => screen.getByRole('button', { name: 'Play now' });
const cancel = () => screen.getByRole('button', { name: 'Cancel' });

/** The card: the nearest ancestor of the label drawn at the card's width. */
function card(): HTMLElement {
  let node: HTMLElement | null = label();
  while (node !== null && getComputedStyle(node).width !== '440px') {
    node = node.parentElement;
  }
  if (node === null) {
    throw new Error('no 440px card around the label');
  }
  return node;
}

/** The thumbnail: the card's first decorative element. */
function thumbnail(): HTMLElement {
  const found = card().querySelector<HTMLElement>('[aria-hidden="true"]');
  if (found === null) {
    throw new Error('the card drew no thumbnail');
  }
  return found;
}

/** The text column: the label's parent, holding the code, title and actions. */
function body(): HTMLElement {
  const found = label().parentElement;
  if (found === null) {
    throw new Error('the label has no column');
  }
  return found;
}

/** A declaration as the injected stylesheet resolves it, normalised. */
function declared(element: Element, property: string): string {
  return normCss(resolvedStyle(element)[property] ?? '');
}

function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/** A hover's fill, as the injected stylesheet resolves it. */
function hoverFill(element: Element): string {
  const hovered = resolvedStyle(element, { hover: true });
  return normCss(hovered['background'] ?? hovered['background-color'] ?? '');
}

describe('UpNextCard — what it says', () => {
  it('counts down to the end of the file', () => {
    renderCard();

    expect(label()).toBeDefined();
  });

  it('names the next episode by its code and its title', () => {
    renderCard();

    expect(screen.getByText('S03E01')).toBeDefined();
    expect(screen.getByText('New Moorings')).toBeDefined();
  });

  it('reads the seconds it is given', () => {
    renderCard({ secondsLeft: 3 });

    expect(screen.getByText('Up next · in 3s')).toBeDefined();
  });
});

describe('UpNextCard — the two presses', () => {
  it('hands Play now back', () => {
    const { onPlayNow, onCancel } = renderCard();

    fireEvent.click(playNow());

    expect(onPlayNow).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('hands Cancel back', () => {
    const { onPlayNow, onCancel } = renderCard();

    fireEvent.click(cancel());

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onPlayNow).not.toHaveBeenCalled();
  });
});

describe('UpNextCard — drawn as its prototype', () => {
  it('is 440px wide, 28px from the right and 150px up, over the chrome', () => {
    renderCard();

    const drawn = getComputedStyle(card());
    expect(drawn.position).toBe('absolute');
    expect(drawn.right).toBe('28px');
    expect(drawn.bottom).toBe('150px');
    expect(drawn.zIndex).toBe('40');
    expect(drawn.display).toBe('flex');
    expect(drawn.gap).toBe('14px');
    expect(drawn.padding).toBe('14px');
  });

  it('is the dark glass card on the medium radius', () => {
    renderCard();

    const drawn = getComputedStyle(card());
    expect(drawn.backgroundColor).toBe('rgba(20, 17, 13, 0.88)');
    expect(drawn.borderRadius).toBe('12px');
  });

  it('enters on ffPop', () => {
    renderCard();

    expect(getComputedStyle(card()).animation).toMatch(
      /^ffPop (0?\.18s|180ms)/
    );
  });

  it('centres its two columns on the cross axis, so the margin is even (#423)', () => {
    renderCard();

    expect(declared(card(), 'align-items')).toBe('center');
  });

  it('draws a 16:9 thumbnail on the 7px radius that takes the width the text does not need (#423)', () => {
    renderCard();

    const frame = thumbnail();
    expect(getComputedStyle(frame).borderRadius).toBe('7px');
    expect(declared(frame, 'aspect-ratio')).toBe('16/9');
    expect(declared(frame, 'overflow')).toBe('hidden');
    expect(declared(frame, 'flex')).toBe('1 1 0');
    expect(declared(frame, 'min-width')).toBe('0');
    expect(declared(frame, 'width')).toBe('');
    expect(declared(frame, 'align-self')).toBe('');
  });

  it('sizes the text column to its content, capped at 200px so a long title still ellipsises (#423)', () => {
    renderCard({
      next: {
        ...NEXT,
        title: 'A Very Long Episode Title That Will Never Fit The Column',
      },
    });

    const column = body();
    expect(declared(column, 'flex')).toBe('0 1 auto');
    expect(declared(column, 'max-width')).toBe('200px');
    expect(declared(column, 'min-width')).toBe('0');

    const title = getComputedStyle(
      screen.getByText(
        'A Very Long Episode Title That Will Never Fit The Column'
      )
    );
    expect(title.overflow).toBe('hidden');
    expect(title.textOverflow).toBe('ellipsis');
    expect(title.whiteSpace).toBe('nowrap');
  });

  it('draws the next episode’s still edge to edge, with no gradient strip under it (#423)', () => {
    renderCard({
      next: { ...NEXT, stillPath: 'harbor-2019/season-03/S03E01-still.jpg' },
    });

    const frame = thumbnail();
    const still = frame.querySelector('img');
    expect(still).not.toBeNull();
    const image = still as HTMLImageElement;
    expect(image.getAttribute('src')).toContain(
      '/api/images/harbor-2019/season-03/S03E01-still.jpg'
    );
    expect(image.getAttribute('alt')).toBe('');
    expect(declared(image, 'display')).toBe('block');
    expect(declared(image, 'width')).toBe('100%');
    expect(declared(image, 'height')).toBe('100%');
    expect(declared(image, 'object-fit')).toBe('cover');
  });

  it('draws the gradient alone for an episode with no still', () => {
    renderCard();

    const frame = thumbnail();
    expect(frame.childElementCount).toBe(0);
    expect(declared(frame, 'background')).toContain('linear-gradient');
  });

  it('draws the label small, bold and uppercase', () => {
    renderCard();

    const drawn = getComputedStyle(label());
    expect(drawn.fontSize).toBe('12px');
    expect(drawn.fontWeight).toBe('700');
    expect(drawn.textTransform).toBe('uppercase');
    expect(drawn.color).toBe('rgba(255, 255, 255, 0.55)');
  });

  it('draws the code at 15px semibold white, the title at 13px beneath it', () => {
    renderCard();

    const code = getComputedStyle(screen.getByText('S03E01'));
    expect(code.fontSize).toBe('15px');
    expect(code.fontWeight).toBe('600');
    expect(code.color).toBe('rgb(255, 255, 255)');

    const title = getComputedStyle(screen.getByText('New Moorings'));
    expect(title.fontSize).toBe('13px');
    expect(title.color).toBe('rgba(255, 255, 255, 0.6)');
  });

  it('draws Play now as the 36px accent button with the near-black ink', () => {
    renderCard();

    const drawn = getComputedStyle(playNow());
    expect(drawn.height).toBe('36px');
    expect(drawn.backgroundColor).toBe(rgb(theme.colors.accent));
    expect(drawn.color).toBe(rgb('#1a1109'));
    expect(drawn.fontSize).toBe('14px');
    expect(drawn.fontWeight).toBe('700');
    expect(drawn.borderRadius).toBe('8px');
  });

  it('hovers Play now to the accent’s hover', () => {
    renderCard();

    expect([
      normCss(theme.colors.accentHover),
      normCss(rgb(theme.colors.accentHover)),
    ]).toContain(hoverFill(playNow()));
  });

  it('draws Cancel as the 36px outlined ghost', () => {
    renderCard();

    const drawn = getComputedStyle(cancel());
    expect(drawn.height).toBe('36px');
    expect(drawn.borderTopColor).toBe('rgba(255, 255, 255, 0.2)');
    expect(drawn.color).toBe('rgba(255, 255, 255, 0.8)');
    expect(drawn.fontSize).toBe('14px');
    expect(drawn.fontWeight).toBe('500');
    expect(drawn.borderRadius).toBe('8px');
  });

  it('hovers Cancel to a faint white wash', () => {
    renderCard();

    expect(hoverFill(cancel())).toBe(normCss('rgba(255,255,255,.1)'));
  });
});

/**
 * Library audit (issue #464): an Up next card whose next episode's **Still**
 * names a file that no longer exists used to draw a broken image. A still that
 * fails to load now falls back to what a still-less card draws: the gradient
 * alone.
 */
describe('UpNextCard — a still that fails to load', () => {
  const MISSING_STILL = '/api/images/harbor-2019/season-03/S03E01-still.jpg';

  it('draws the gradient alone once its still fails', () => {
    renderCard({
      next: { ...NEXT, stillPath: 'harbor-2019/season-03/S03E01-still.jpg' },
    });
    const img = thumbnail().querySelector(`img[src="${MISSING_STILL}"]`);
    if (img === null) {
      throw new Error('the thumbnail loads no <img> of its still to fail');
    }

    fireEvent.error(img);

    expect(thumbnail().querySelector('img')).toBeNull();
    const painted = [
      thumbnail(),
      ...Array.from(thumbnail().querySelectorAll('*')),
    ].map((element) => window.getComputedStyle(element).backgroundImage);
    expect(painted.some((bg) => bg.includes('linear-gradient'))).toBe(true);
    expect(painted.some((bg) => bg.includes(MISSING_STILL))).toBe(false);
  });
});
