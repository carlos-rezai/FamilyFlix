import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ThemeProvider } from 'styled-components';

// Through the category barrel, the way every caller imports it: there is no
// per-unit barrel, so this is the whole public surface.
import { LogoLoader, type LogoLoaderProps } from '@/primitives';
import { theme } from '@/styles/theme';
import { resolvedStyle } from '@/test-support/resolvedStyle/resolvedStyle';

/**
 * 53, Loading states, Phase 5 (issue #487): the **Logo loader**.
 *
 * `prim.LogoLoader.dc.html`: the two Fs of the mark take turns rising, or,
 * given a `progress`, fill left to right with the detail reading `NN%`. A
 * `status` named by its label and detail; `size`, `tile`, `tone` and `inline`
 * change what is drawn; its clip id comes from `useId`, made safe for a
 * `url(#…)` reference, so two on a page never share one. Its beat fades under
 * reduced motion with a rule `GlobalStyle`'s `*` does not collapse.
 */

function draw(tree: ReactElement) {
  return render(<ThemeProvider theme={theme}>{tree}</ThemeProvider>);
}

function renderLoader(props: Partial<LogoLoaderProps> = {}) {
  return draw(<LogoLoader {...props} />);
}

const status = () => screen.getByRole('status');

/** The drawn mark: the one `svg` in the loader. */
const mark = () => status().querySelector('svg') as SVGSVGElement;

/** A value as drawn: an inline style or attribute first, then the stylesheet. */
function drawnValue(element: Element, property: string): string | undefined {
  const inline = (element as HTMLElement).style?.getPropertyValue(property);
  if (inline) return inline;
  const attribute = element.getAttribute(property);
  if (attribute !== null) return attribute;
  return resolvedStyle(element as HTMLElement)[property];
}

describe('LogoLoader: a status', () => {
  it('is a polite status named by its label, the label drawn under the mark', () => {
    renderLoader({ label: 'Erasing everything' });

    const loader = screen.getByRole('status', { name: 'Erasing everything' });
    expect(loader.getAttribute('aria-live')).toBe('polite');
    expect(loader.textContent).toContain('Erasing everything');
    expect(mark()).not.toBeNull();
  });

  it('keeps the drawn mark and words out of the accessible tree', () => {
    renderLoader({ label: 'Erasing everything' });

    // The status speaks once, through its own name; what it draws is hidden.
    const svg = mark();
    expect(svg.closest('[aria-hidden="true"]')).not.toBeNull();
    const words = screen.getByText('Erasing everything');
    expect(words.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('is named Loading when it has neither label nor detail', () => {
    renderLoader();

    expect(screen.getByRole('status', { name: 'Loading' })).toBeDefined();
  });
});

describe('LogoLoader: progress', () => {
  it('draws its progress as NN%, and speaks it after the label', () => {
    renderLoader({ label: 'Copying', progress: 0.42 });

    expect(screen.getByText('42%')).toBeDefined();
    expect(screen.getByRole('status', { name: 'Copying, 42%' })).toBeDefined();
  });

  it('draws no percentage without a progress', () => {
    renderLoader({ label: 'Copying' });

    expect(status().textContent).not.toMatch(/%/);
  });

  it('draws a detail it is given in place of the percentage', () => {
    renderLoader({ label: 'Copying', progress: 0.42, detail: '3 of 7' });

    expect(screen.getByText('3 of 7')).toBeDefined();
    expect(screen.queryByText('42%')).toBeNull();
  });
});

describe('LogoLoader: what its props draw', () => {
  it('is 48px wide by default, its height the mark’s own ratio', () => {
    renderLoader();

    expect(Number(mark().getAttribute('width'))).toBe(48);
    expect(Number(mark().getAttribute('height'))).toBe(
      Math.round((48 * 424) / 704)
    );
  });

  it('draws at the size it is given', () => {
    renderLoader({ size: 64 });

    expect(Number(mark().getAttribute('width'))).toBe(64);
  });

  it('draws the app-icon tile behind the mark, square, only when asked', () => {
    const { unmount } = renderLoader({ size: 64 });
    const bare = mark().querySelectorAll('rect').length;
    unmount();

    renderLoader({ size: 64, tile: true });

    expect(mark().querySelectorAll('rect').length).toBe(bare + 1);
    expect(Number(mark().getAttribute('height'))).toBe(64);
  });

  it('paints the Fs in the brand inks by default, and both in currentColor with tone current', () => {
    const { unmount } = renderLoader();
    const brand = Array.from(mark().querySelectorAll('path')).map((path) =>
      drawnValue(path, 'fill')
    );
    unmount();

    renderLoader({ tone: 'current' });
    const current = Array.from(mark().querySelectorAll('path')).map((path) =>
      drawnValue(path, 'fill')
    );

    expect(brand.length).toBeGreaterThanOrEqual(2);
    expect(new Set(brand).size).toBe(2);
    expect(brand).not.toContain('currentColor');
    expect(current.length).toBe(brand.length);
    expect(new Set(current)).toEqual(new Set(['currentColor']));
  });

  it('sets the mark and its words in a column, or in a row when inline', () => {
    const { unmount } = renderLoader({ label: 'Saving' });
    const stacked = drawnValue(status(), 'flex-direction');
    unmount();

    renderLoader({ label: 'Saving', inline: true });

    expect(stacked).toBe('column');
    expect(drawnValue(status(), 'flex-direction')).toBe('row');
  });
});

describe('LogoLoader: its clip id', () => {
  it('gives two loaders on a page distinct ids a url(#…) can carry', () => {
    draw(
      <>
        <LogoLoader label="One" progress={0.3} />
        <LogoLoader label="Two" progress={0.6} />
      </>
    );

    const ids = ['One', 'Two'].map((name) => {
      const loader = screen.getByRole('status', { name: new RegExp(name) });
      const clip = loader.querySelector('clipPath');
      expect(clip).not.toBeNull();
      const id = clip?.getAttribute('id') ?? '';
      expect(id).toMatch(/^[A-Za-z][A-Za-z0-9_-]*$/);

      // The fill is clipped by its own loader's path, by reference.
      const clipped = loader.querySelector('[clip-path]');
      expect(clipped?.getAttribute('clip-path')).toBe(`url(#${id})`);
      return id;
    });

    expect(ids[0]).not.toBe(ids[1]);
  });
});

describe('LogoLoader: reduced motion', () => {
  /** Every style tag's text, as styled-components injected it. */
  function injectedCss(): string {
    return Array.from(document.querySelectorAll('style'))
      .map((sheet) => sheet.textContent ?? '')
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '');
  }

  /** The rules inside every `prefers-reduced-motion: reduce` block. */
  function reducedMotionRules(css: string) {
    const blocks = [
      ...css.matchAll(
        /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g
      ),
    ].map(([, body]) => body);
    return blocks.flatMap((body) =>
      [...body.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
        ([, selector, declarations]) => ({
          selector: selector.trim(),
          declarations,
        })
      )
    );
  }

  /** The properties a named `@keyframes` block animates. */
  function keyframeProperties(css: string, name: string): string[] {
    const block = new RegExp(
      `@keyframes\\s+${name}\\s*\\{((?:[^{}]*\\{[^{}]*\\})*)[^{}]*\\}`
    ).exec(css);
    if (block === null) return [];
    return [...block[1].matchAll(/([\w-]+)\s*:/g)].map(
      ([, property]) => property
    );
  }

  it('fades the beat under reduced motion, a rule GlobalStyle’s * does not collapse', () => {
    renderLoader({ label: 'Erasing everything' });
    const fs = Array.from(mark().querySelectorAll('path'));
    const css = injectedCss();

    const beat = reducedMotionRules(css).find(
      ({ selector, declarations }) =>
        /animation/.test(declarations) &&
        selector
          .split(',')
          .some((one) =>
            fs.some((f) => f.matches(one.replace(/::?[\w-]+$/, '').trim()))
          )
    );
    expect(beat).toBeDefined();

    // GlobalStyle's `*` collapses every animation with `!important`; only an
    // `!important` of its own, on a selector that out-ranks `*`, survives it,
    // so the beat never freezes at its dimmest frame.
    const declarations = beat?.declarations ?? '';
    expect(declarations).toMatch(/animation[^;]*!important/);
    expect(beat?.selector).toMatch(/[.#[]/);
    expect(declarations).not.toMatch(/0?\.01ms/);

    // A fade: the reduced-motion keyframes move nothing, only opacity.
    const name =
      /animation-name\s*:\s*([\w-]+)/.exec(declarations)?.[1] ??
      /animation\s*:\s*([\w-]+)/.exec(declarations)?.[1] ??
      '';
    const properties = keyframeProperties(css, name);
    expect(properties.length).toBeGreaterThan(0);
    expect(new Set(properties)).toEqual(new Set(['opacity']));
  });
});
