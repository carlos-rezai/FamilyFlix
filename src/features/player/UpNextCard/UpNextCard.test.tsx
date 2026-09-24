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
 * `feat.PlayerControls.dc.html`: 372px wide, 28px from the right and 150px up,
 * on `ffPop`; a 104px 16:9 thumbnail beside _Up next · in 12s_, the next
 * episode's code and its title, then _Play now_ and _Cancel_.
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
  while (node !== null && getComputedStyle(node).width !== '372px') {
    node = node.parentElement;
  }
  if (node === null) {
    throw new Error('no 372px card around the label');
  }
  return node;
}

/** The thumbnail: the one element in the card drawn 104px wide. */
function thumbnail(): HTMLElement {
  const found = Array.from(card().querySelectorAll<HTMLElement>('*')).find(
    (node) => getComputedStyle(node).width === '104px'
  );
  if (found === undefined) {
    throw new Error('the card drew no 104px thumbnail');
  }
  return found;
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
  it('is 372px wide, 28px from the right and 150px up, over the chrome', () => {
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

  it('draws a 104px 16:9 thumbnail on the 7px radius', () => {
    renderCard();

    const drawn = getComputedStyle(thumbnail());
    expect(drawn.borderRadius).toBe('7px');
    expect(normCss(drawn.aspectRatio)).toBe('16/9');
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
