import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { DecisionRow, type DecisionRowProps } from './DecisionRow';
import type { BusyPhase, Decision } from '@/types';
import { theme } from '@/styles/theme';
import { resolvedStyle } from '@/test-support/resolvedStyle/resolvedStyle';

/**
 * 69, Silent waits, Phase 1 (issue #653): the Decision row as a **Busy row**.
 *
 * The review hands the row its `busy` phase; which press it was is the row's
 * own. From `waiting` the row's root is `inert` and `aria-busy`, every
 * control inside keeping its own face (none greyed, none relabelled). Once
 * `shown` the row dims to .75 under a progress cursor, and an 18px `inline`
 * **Logo loader** reading _Saving match…_ stands in the kind dot's slot, its
 * beat fading rather than moving under reduced motion.
 */

const AMBIGUOUS: Decision = {
  id: 'd1',
  kind: 'ambiguous',
  title: 'Harbor Lights',
  reason: 'Three releases share this title. Pick the right one.',
  path: null,
  query: 'Harbor Lights',
  candidates: [
    {
      tmdbId: 101,
      title: 'Harbor Lights',
      year: 1963,
      genre: 'Drama',
      language: 'en',
      posterUrl: null,
      score: 82,
    },
    {
      tmdbId: 102,
      title: 'Harbor Lights',
      year: 2019,
      genre: 'Drama',
      language: 'en',
      posterUrl: null,
      score: 74,
    },
  ],
};

function tree(busy: BusyPhase, props: Partial<DecisionRowProps>) {
  return (
    <ThemeProvider theme={theme}>
      <DecisionRow
        decision={AMBIGUOUS}
        busy={busy}
        onSkip={props.onSkip ?? vi.fn()}
        onPick={props.onPick ?? vi.fn()}
        onSearch={props.onSearch ?? vi.fn()}
        onApply={props.onApply ?? vi.fn()}
      />
    </ThemeProvider>
  );
}

/**
 * The row picked: drawn idle, its first candidate pressed, then handed
 * `busy` by the review, as `EnrichmentFlow` does across a pick.
 */
function pickedRow(busy: BusyPhase) {
  const onPick = vi.fn<(tmdbId: number) => void>();
  const view = render(tree('idle', { onPick }));
  fireEvent.click(screen.getByRole('button', { name: /82% match/ }));
  expect(onPick).toHaveBeenCalledWith(101);
  view.rerender(tree(busy, { onPick }));
  return view;
}

/** The row's root: the one element the render draws. */
const rootOf = (container: HTMLElement) =>
  container.firstElementChild as HTMLElement;

const reason = () =>
  screen.getByText('Three releases share this title. Pick the right one.');

describe('DecisionRow: waiting', () => {
  it('is inert and aria-busy from waiting, every control in its own face', () => {
    const { container } = pickedRow('waiting');
    const root = rootOf(container);

    expect(root.hasAttribute('inert')).toBe(true);
    expect(root.getAttribute('aria-busy')).toBe('true');

    // Locked by the row, not greyed: no control is disabled or relabelled.
    for (const button of Array.from(root.querySelectorAll('button'))) {
      expect(button.disabled).toBe(false);
    }
    expect(screen.getByRole('button', { name: 'Skip' }).textContent).toBe(
      'Skip'
    );
    expect(screen.getAllByRole('button', { name: /% match/ })).toHaveLength(2);

    // Locked only: no loader yet, the kind dot still in its slot, no dim.
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('Saving match…')).toBeNull();
    const slot = reason().parentElement?.previousElementSibling;
    expect(slot?.getAttribute('role')).not.toBe('status');
    expect(resolvedStyle(root).opacity).not.toBe('.75');
  });
});

describe('DecisionRow: shown', () => {
  it('stays inert and aria-busy once shown', () => {
    const { container } = pickedRow('shown');

    expect(rootOf(container).hasAttribute('inert')).toBe(true);
    expect(rootOf(container).getAttribute('aria-busy')).toBe('true');
  });

  it('draws the 18px inline mark reading Saving match… in the kind dot’s slot', () => {
    pickedRow('shown');

    const loader = screen.getByRole('status', { name: 'Saving match…' });
    expect(loader.textContent).toContain('Saving match…');

    // The dot's slot: right before the block the title and reason sit in.
    expect(reason().parentElement?.previousElementSibling).toBe(loader);

    const mark = loader.querySelector('svg');
    expect(Number(mark?.getAttribute('width'))).toBe(18);
    expect(resolvedStyle(loader)['flex-direction']).toBe('row');
  });

  it('dims the row to .75 under a progress cursor', () => {
    const { container } = pickedRow('shown');
    const drawn = resolvedStyle(rootOf(container));

    expect(drawn.opacity).toBe('.75');
    expect(drawn.cursor).toBe('progress');
  });
});

describe('DecisionRow: the loader under reduced motion', () => {
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

  it('fades the row’s mark rather than moving it', () => {
    pickedRow('shown');
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
