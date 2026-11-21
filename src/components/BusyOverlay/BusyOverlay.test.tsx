import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { BusyOverlay } from '@/components';
import { theme } from '@/styles/theme';
import { resolvedStyle } from '@/test-support/resolvedStyle/resolvedStyle';

/**
 * 71, Busy overlay, Phase 2 (issue #677): the **Busy overlay**.
 *
 * `{ label }`: the face a **Busy row** draws over itself once **Shown**. A
 * scrim, `bg` at .55 under a 4px blur, over the whole row, the 18px `inline`
 * **Logo loader** and its _-ing_ label centred on it. It adds no control and
 * takes no focus; it fades in, and under reduced motion nothing in it moves.
 */

function renderOverlay(label = 'Saving match…') {
  return render(
    <ThemeProvider theme={theme}>
      <BusyOverlay label={label} />
    </ThemeProvider>
  );
}

/** The overlay's root: the one element the render draws. */
const rootOf = (container: HTMLElement) =>
  container.firstElementChild as HTMLElement;

describe('BusyOverlay: what it draws', () => {
  it('draws its label with the 18px inline loader', () => {
    renderOverlay();

    const loader = screen.getByRole('status', { name: 'Saving match…' });
    expect(loader.textContent).toContain('Saving match…');

    const mark = loader.querySelector('svg');
    expect(Number(mark?.getAttribute('width'))).toBe(18);
    expect(resolvedStyle(loader)['flex-direction']).toBe('row');
  });

  it('adds no control and takes no focus', () => {
    const { container } = renderOverlay();

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(
      container.querySelectorAll('[tabindex], button, a, input, select')
    ).toHaveLength(0);
    expect(document.activeElement).toBe(document.body);
  });

  it('leaves the focus where it was when it comes', () => {
    const before = document.createElement('button');
    document.body.appendChild(before);
    before.focus();

    renderOverlay();

    expect(document.activeElement).toBe(before);
    before.remove();
  });
});

describe('BusyOverlay: over the row', () => {
  it('covers the whole row, its corners the row’s, under a progress cursor', () => {
    const { container } = renderOverlay();
    const drawn = resolvedStyle(rootOf(container));

    expect(drawn.position).toBe('absolute');
    expect(drawn.inset).toBe('0');
    expect(drawn['border-radius']).toBe('inherit');
    expect(drawn.cursor).toBe('progress');
  });

  it('reads the same on a light poster or a dark row: a bg scrim under the blur', () => {
    const { container } = renderOverlay();
    const drawn = resolvedStyle(rootOf(container));

    const scrim = drawn.background ?? drawn['background-color'];
    expect(scrim).toBe('rgba(20,17,13,.55)');
    expect(drawn['backdrop-filter']).toBe('blur(4px)');
  });
});

describe('BusyOverlay: under reduced motion', () => {
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

  it('fades in on ffFade at .18s', () => {
    const { container } = renderOverlay();

    expect(resolvedStyle(rootOf(container)).animation).toMatch(/^ffFade \.18s/);
  });

  it('fades its mark rather than moving it', () => {
    renderOverlay();
    const loader = screen.getByRole('status', { name: 'Saving match…' });
    const fs = Array.from(loader.querySelectorAll('path'));
    expect(fs.length).toBeGreaterThanOrEqual(2);
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

    const declarations = beat?.declarations ?? '';
    const name =
      /animation-name\s*:\s*([\w-]+)/.exec(declarations)?.[1] ??
      /animation\s*:\s*([\w-]+)/.exec(declarations)?.[1] ??
      '';
    const properties = keyframeProperties(css, name);
    expect(properties.length).toBeGreaterThan(0);
    expect(new Set(properties)).toEqual(new Set(['opacity']));
  });
});
