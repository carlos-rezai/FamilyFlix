import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';

import { Fab, type FabProps, type FabIcon } from '@/components';
import { theme } from '@/styles/theme';

/**
 * 19 — Back-to-top FAB, Phase 1: "the molecule" (issue #166).
 *
 * The **FAB**, from `mol.Fab.dc.html`, proven by rendering it and reading what
 * is on screen: one `styled(IconButton)` face — the accent circle at 28px from
 * the bottom-right corner, the near-black ink, the accent shadow, and a lift
 * on hover — holding one of two glyphs, `arrow-up` or `plus`, never both. It
 * is named by a required `label`: the one deviation from the prototype's
 * _Back to top_ default, for `IconButton`'s reason — a default right for one
 * icon and wrong for the other is not a default.
 *
 * Presentational to the last prop: it owns no state, no listener and no
 * effect. It does not know there is a **Scroll threshold**; the thing that
 * mounts it — **Back-to-top**, `components/BackToTop/`, with its own suite —
 * decides. Nothing here reaches for a state variable or a listener's handle;
 * the one place the injected stylesheet is read is the hover, because jsdom
 * has no `:hover` and the prototype's lift is otherwise unprovable.
 */
const LABEL = 'Back to top';

/** The two glyphs, told apart by their picture, off the prototype's SVGs. */
const GLYPH_STROKE: Record<FabIcon, string> = {
  'arrow-up': 'M12 19V5m0 0l-6 6m6-6l6 6',
  plus: 'M12 5v14M5 12h14',
};

function renderFab(props: Partial<FabProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <Fab label={LABEL} onClick={() => undefined} {...props} />
    </ThemeProvider>
  );
}

const fab = () => screen.getByRole('button', { name: LABEL });

/** The glyph: the one svg the circle draws. */
function glyph(): SVGSVGElement {
  const svg = fab().querySelector('svg');
  if (svg === null) {
    throw new Error('the circle drew no glyph');
  }
  return svg;
}

/** Every path the circle is drawn with, so the glyph is told by its picture. */
const strokes = (): string[] =>
  Array.from(fab().querySelectorAll('path')).map(
    (path) => path.getAttribute('d') ?? ''
  );

/** A token as jsdom reports it back. */
function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/** The prototype's ink on the accent fill — not a surface, so no token fits. */
const INK = '#1a1109';

/**
 * What the button's hover resolves to, read off the injected stylesheet since
 * jsdom has no `:hover`: every `:hover:enabled` rule for any class the button
 * wears, merged in stylesheet order so a later face replaces an earlier one
 * exactly as the cascade would. Only the declarations come back, never the
 * class names — the test asks what a hover *paints*, not what it is called.
 */
function hoverDeclarations(): Record<string, string> {
  const css = Array.from(document.querySelectorAll('style'))
    .map((sheet) => sheet.textContent ?? '')
    .join('\n');
  const merged: Record<string, string> = {};
  for (const className of Array.from(fab().classList)) {
    const rule = new RegExp(`\\.${className}:hover:enabled\\{([^}]*)\\}`, 'g');
    for (const match of css.matchAll(rule)) {
      for (const declaration of match[1].split(';')) {
        const colon = declaration.indexOf(':');
        if (colon > 0) {
          merged[declaration.slice(0, colon).trim()] = declaration
            .slice(colon + 1)
            .trim();
        }
      }
    }
  }
  return merged;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Fab — the name', () => {
  it('renders a button whose accessible name is the label', () => {
    renderFab({ label: 'Add a movie' });

    expect(screen.getByRole('button', { name: 'Add a movie' })).toBeInstanceOf(
      HTMLButtonElement
    );
  });
});

/**
 * Against the compiler, not the DOM: passes at runtime and fails
 * `npm run typecheck` if `label` ever grows the prototype's default. A
 * `@ts-expect-error` with no error to swallow is itself an error, so the guard
 * cannot rot silently.
 */
describe('Fab — label is required by the type, not defaulted', () => {
  it('will not compile without a label', () => {
    // @ts-expect-error — a FAB without a name announces as "button"
    const props: FabProps = { onClick: () => undefined };

    expect(props.label).toBeUndefined();
  });
});

describe('Fab — the glyph', () => {
  it('draws the arrow for arrow-up, and not the plus', () => {
    renderFab({ icon: 'arrow-up' });

    expect(strokes()).toContain(GLYPH_STROKE['arrow-up']);
    expect(strokes()).not.toContain(GLYPH_STROKE.plus);
  });

  it('draws the plus for plus, and not the arrow', () => {
    renderFab({ icon: 'plus' });

    expect(strokes()).toContain(GLYPH_STROKE.plus);
    expect(strokes()).not.toContain(GLYPH_STROKE['arrow-up']);
  });

  it('draws the arrow when no icon is given', () => {
    renderFab();

    expect(strokes()).toContain(GLYPH_STROKE['arrow-up']);
    expect(strokes()).not.toContain(GLYPH_STROKE.plus);
  });

  it('draws one glyph, never both', () => {
    renderFab({ icon: 'plus' });

    expect(fab().querySelectorAll('svg')).toHaveLength(1);
  });

  it('sizes the arrow at 24 and the plus at 26 — the molecule’s numbers, not the glyphs’', () => {
    const { unmount } = renderFab({ icon: 'arrow-up' });
    expect(glyph().getAttribute('width')).toBe('24');
    expect(glyph().getAttribute('height')).toBe('24');
    unmount();

    renderFab({ icon: 'plus' });
    expect(glyph().getAttribute('width')).toBe('26');
    expect(glyph().getAttribute('height')).toBe('26');
  });

  it('keeps the glyph decorative: the label is the name, the picture is not a second one', () => {
    renderFab();

    expect(glyph().getAttribute('aria-hidden')).toBe('true');
    expect(glyph().getAttribute('role')).toBeNull();
  });
});

describe('Fab — the press', () => {
  it('asks onClick when pressed', async () => {
    const onClick = vi.fn();
    renderFab({ onClick });

    await userEvent.click(fab());

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Fab — the size', () => {
  it('is a 52px square by default', () => {
    renderFab();

    const drawn = getComputedStyle(fab());
    expect(drawn.width).toBe('52px');
    expect(drawn.height).toBe('52px');
  });

  it('takes size as the square’s edge', () => {
    renderFab({ size: 64 });

    const drawn = getComputedStyle(fab());
    expect(drawn.width).toBe('64px');
    expect(drawn.height).toBe('64px');
  });
});

describe('Fab — the face, 1:1', () => {
  it('sits absolute at 28px from the bottom-right corner, at z-index 60', () => {
    renderFab();

    const drawn = getComputedStyle(fab());
    expect(drawn.position).toBe('absolute');
    expect(drawn.right).toBe('28px');
    expect(drawn.bottom).toBe('28px');
    expect(drawn.zIndex).toBe('60');
  });

  it('fills with the accent and inks in the near-black', () => {
    renderFab();

    const drawn = getComputedStyle(fab());
    expect(drawn.backgroundColor).toBe(rgb(theme.colors.accent));
    expect(drawn.color).toBe(rgb(INK));
  });

  it('casts the accent shadow and draws no border', () => {
    renderFab();

    const drawn = getComputedStyle(fab());
    expect(drawn.boxShadow).toBe('0 8px 28px rgba(217, 122, 78, 0.42)');
    expect(drawn.borderStyle).toBe('none');
  });

  it('lifts on hover, enabled only: the accent-hover fill, the same ink, the transform', () => {
    renderFab();

    const hover = hoverDeclarations();
    expect(hover.background ?? hover['background-color']).toBe(
      theme.colors.accentHover
    );
    expect(hover.color).toBe(INK);
    expect(hover.transform).toBe('translateY(-2px) scale(1.05)');
  });

  it('declares no transition: the lift snaps, as the prototype’s does', () => {
    renderFab();

    expect(getComputedStyle(fab()).transition).toBe('');
    expect(hoverDeclarations().transition).toBeUndefined();
  });
});

describe('Fab — built on IconButton', () => {
  it('is type="button", so it submits nothing', () => {
    renderFab();

    expect(fab().getAttribute('type')).toBe('button');
  });

  it('wears the primitive’s pill corner, which on a square is the prototype’s 50%', () => {
    renderFab();

    expect(getComputedStyle(fab()).borderRadius).toBe(theme.radius.pill);
  });
});

describe('Fab — no state, no listener, no effect', () => {
  it('changes nothing on its own: time passes and scrolls fire, and it is still the same circle', () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    renderFab({ onClick });

    act(() => {
      vi.advanceTimersByTime(60_000);
      fireEvent.scroll(window);
      fireEvent.scroll(document.body);
    });

    expect(fab()).toBeInstanceOf(HTMLButtonElement);
    expect(strokes()).toContain(GLYPH_STROKE['arrow-up']);
    expect(onClick).not.toHaveBeenCalled();
  });
});
