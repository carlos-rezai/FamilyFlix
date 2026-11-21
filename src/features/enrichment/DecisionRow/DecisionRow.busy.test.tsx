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
 * control inside keeping its own face (none greyed, none relabelled).
 *
 * 71, Busy overlay, Phase 2 (issue #677): once `shown` the row draws its
 * **Busy overlay** last in its root, reading _Saving match…_ over the row; the
 * kind dot keeps its slot, nothing is dimmed, and the root is a containing
 * block at every phase. The overlay's beat fades rather than moves under
 * reduced motion.
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

describe('DecisionRow: the root is a containing block at every phase', () => {
  it.each(['idle', 'waiting', 'shown'] as const)(
    'is position: relative and undimmed at %s, its overlay only once shown',
    (busy) => {
      const { container } = pickedRow(busy);
      const drawn = resolvedStyle(rootOf(container));

      expect(drawn.position).toBe('relative');
      expect(drawn.opacity).not.toBe('.75');
      expect(drawn.cursor).not.toBe('progress');

      // No overlay before shown, and the lock only from waiting.
      if (busy !== 'shown') {
        expect(screen.queryByRole('status')).toBeNull();
        expect(screen.queryByText('Saving match…')).toBeNull();
      }
      expect(rootOf(container).hasAttribute('inert')).toBe(busy !== 'idle');
      expect(rootOf(container).hasAttribute('aria-busy')).toBe(busy !== 'idle');
    }
  );
});

describe('DecisionRow: shown', () => {
  it('stays inert and aria-busy once shown', () => {
    const { container } = pickedRow('shown');

    expect(rootOf(container).hasAttribute('inert')).toBe(true);
    expect(rootOf(container).getAttribute('aria-busy')).toBe('true');
  });

  it('keeps the kind dot in its slot alongside Saving match…', () => {
    pickedRow('shown');

    const loader = screen.getByRole('status', { name: 'Saving match…' });
    expect(loader.textContent).toContain('Saving match…');

    // The dot's slot, right before the title and reason, is still the dot.
    const slot = reason().parentElement?.previousElementSibling;
    expect(slot).not.toBeNull();
    expect(slot).not.toBe(loader);
    expect(slot?.contains(loader)).toBe(false);
    expect(slot?.getAttribute('role')).not.toBe('status');
    expect(slot?.textContent).toBe('');
  });

  it('draws the overlay last in its root, over the row', () => {
    const { container } = pickedRow('shown');
    const root = rootOf(container);
    const loader = screen.getByRole('status', { name: 'Saving match…' });

    const overlay = root.lastElementChild as HTMLElement;
    expect(overlay.contains(loader)).toBe(true);
    expect(overlay.contains(reason())).toBe(false);
    expect(resolvedStyle(overlay).position).toBe('absolute');
    expect(Number(loader.querySelector('svg')?.getAttribute('width'))).toBe(18);
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

  it('fades the overlay’s mark rather than moving it', () => {
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

describe('DecisionRow: refuses a press while locked', () => {
  const CONFLICT: Decision = {
    id: 'd2',
    kind: 'conflict',
    title: 'The Lantern Keeper',
    reason: 'TMDB has different values for fields you already filled in.',
    path: null,
    query: 'The Lantern Keeper',
    fields: [{ field: 'year', label: 'Year', mine: '2019', tmdb: '2018' }],
  };
  const MISSING: Decision = {
    id: 'd3',
    kind: 'missing',
    title: 'Sundial',
    reason: 'Nothing on TMDB matched this title.',
    path: null,
    query: 'Sundial',
  };
  type Report = 'onSkip' | 'onPick' | 'onSearch' | 'onApply';
  const PRESSES: { press: RegExp; decision: Decision; report: Report }[] = [
    { press: /82% match/, decision: AMBIGUOUS, report: 'onPick' },
    { press: /^Search$/, decision: MISSING, report: 'onSearch' },
    { press: /^Apply choices$/, decision: CONFLICT, report: 'onApply' },
    { press: /^Skip$/, decision: AMBIGUOUS, report: 'onSkip' },
    { press: /^Keep all mine$/, decision: CONFLICT, report: 'onSkip' },
  ];

  it.each(
    (['waiting', 'shown'] as const).flatMap((busy) =>
      PRESSES.map((press) => ({ busy, ...press }))
    )
  )(
    'reports nothing for $press while $busy',
    ({ busy, press, decision, report }) => {
      const reports = {
        onSkip: vi.fn(),
        onPick: vi.fn(),
        onSearch: vi.fn(),
        onApply: vi.fn(),
      };
      render(
        <ThemeProvider theme={theme}>
          <DecisionRow decision={decision} busy={busy} {...reports} />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByRole('button', { name: press }));

      expect(reports[report]).not.toHaveBeenCalled();
    }
  );
});
