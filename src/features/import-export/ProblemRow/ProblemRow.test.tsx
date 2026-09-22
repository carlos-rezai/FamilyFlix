import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { ProblemRow, type ProblemRowProps } from './ProblemRow';
import type { ImportProblem, ProblemKind } from '@/types';
import { theme } from '@/styles/theme';

/**
 * 13 — Bulk import, Phase 4: "problems and review" (issue #129).
 *
 * One row of the **Review step**'s **Needs attention** list, from
 * `feat.ImportFlow.dc.html`: a 10px dot coloured by the **Problem**'s kind,
 * the title and the reason under it, and _Resolve_ and _Skip_ as `Button`
 * `secondary` `sm` — COMPONENT-SPEC §1 forbids a one-off inline control. The
 * dot is `danger` for `no-folder` / `no-video` / `failed`, `accent` for
 * `ambiguous`, `text-faint` for `no-row` and the soft `missing-meta`.
 *
 * _Resolve_ is a navigation — `/add?problem=<id>` — so it is a link, which
 * the maintainer can middle-click; _Skip_ is an action, so it is a button.
 * Neither knows what happens next: the row draws a problem and reports a
 * press.
 */

const problem = (overrides: Partial<ImportProblem> = {}): ImportProblem => ({
  id: 'p1',
  kind: 'no-folder',
  title: 'The Lantern Keeper',
  reason: 'No folder found matching this spreadsheet row.',
  ...overrides,
});

function renderRow(props: Partial<ProblemRowProps> = {}) {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <ProblemRow
          problem={props.problem ?? problem()}
          onSkip={props.onSkip ?? (() => undefined)}
        />
      </ThemeProvider>
    </MemoryRouter>
  );
}

/** The dot sits before the text block the title and reason are in. */
const dotOf = (title: string): HTMLElement =>
  screen.getByText(title).parentElement?.previousElementSibling as HTMLElement;

const resolveLink = () => screen.getByRole('link', { name: 'Resolve' });
/** Resolve's query, read back the way the **Movie form** reads it. */
const resolveQuery = () =>
  new URLSearchParams(resolveLink().getAttribute('href')?.split('?')[1] ?? '');
const skipButton = () => screen.getByRole('button', { name: 'Skip' });

const DANGER = 'rgb(201, 122, 106)';
const ACCENT = 'rgb(217, 122, 78)';
const TEXT_FAINT = 'rgb(133, 122, 104)';

/** The token each kind's dot is filled with, as jsdom reports the hex. */
const DOT: Record<ProblemKind, string> = {
  'no-folder': DANGER,
  'no-video': DANGER,
  failed: DANGER,
  ambiguous: ACCENT,
  'no-row': TEXT_FAINT,
  'missing-meta': TEXT_FAINT,
};

describe('ProblemRow — what it shows', () => {
  it('shows the title and the reason', () => {
    renderRow();

    expect(screen.getByText('The Lantern Keeper')).toBeDefined();
    expect(
      screen.getByText('No folder found matching this spreadsheet row.')
    ).toBeDefined();
  });

  it('draws the dot as a 10px circle before the title', () => {
    renderRow();

    const dot = getComputedStyle(dotOf('The Lantern Keeper'));
    expect(dot.width).toBe('10px');
    expect(dot.height).toBe('10px');
  });

  it.each(Object.keys(DOT) as ProblemKind[])(
    'fills the dot in the %s kind’s colour',
    (kind) => {
      renderRow({ problem: problem({ kind }) });

      expect(
        getComputedStyle(dotOf('The Lantern Keeper')).backgroundColor
      ).toBe(DOT[kind]);
    }
  );

  it('offers Resolve and Skip, in that order', () => {
    renderRow();

    expect(
      resolveLink().compareDocumentPosition(skipButton()) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});

describe('ProblemRow — the two controls', () => {
  it('links Resolve to the form in import context, by the problem’s id', () => {
    renderRow({ problem: problem({ id: 'p7' }) });

    expect(resolveLink().getAttribute('href')).toBe('/add?problem=p7');
  });

  it('encodes the id into the link, so it reads back whole', () => {
    renderRow({ problem: problem({ id: 'p 1/x&movie=m9' }) });

    const query = resolveQuery();
    expect(query.get('problem')).toBe('p 1/x&movie=m9');
    expect(query.has('movie')).toBe(false);
  });

  it('links Resolve for the soft kind to the Edit job, the movie and the problem both named', () => {
    // Issue #132, story 92: a `missing-meta` row is already in the library,
    // so its Resolve amends that record rather than adding it twice —
    // `/add?movie=<movieId>&problem=<id>`, the Edit job under the banner.
    renderRow({
      problem: problem({ id: 'p7', kind: 'missing-meta', movieId: 'm42' }),
    });

    expect(resolveLink().getAttribute('href')).toBe(
      '/add?movie=m42&problem=p7'
    );
  });

  it('encodes the movie id into the soft kind’s link', () => {
    renderRow({
      problem: problem({
        id: 'p 1/x',
        kind: 'missing-meta',
        movieId: 'm 2/y&',
      }),
    });

    const query = resolveQuery();
    expect(query.get('movie')).toBe('m 2/y&');
    expect(query.get('problem')).toBe('p 1/x');
  });

  it('raises onSkip when Skip is pressed, and not before', () => {
    const onSkip = vi.fn();
    renderRow({ onSkip });
    expect(onSkip).not.toHaveBeenCalled();

    fireEvent.click(skipButton());

    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('draws both as secondary sm Buttons: 40px tall, 14px text, bordered, unfilled', () => {
    renderRow();

    for (const control of [resolveLink(), skipButton()]) {
      const style = getComputedStyle(control);
      expect(style.height).toBe('40px');
      expect(style.fontSize).toBe('14px');
      expect(style.borderTopWidth).toBe('1px');
      expect(style.borderTopColor).toBe('rgb(58, 48, 36)');
      expect(style.backgroundColor).toMatch(
        /^(transparent|rgba\(0, 0, 0, 0\))$/
      );
    }
  });
});

describe('ProblemRow — the awkward titles', () => {
  it('shows a title with quotes in it, whole', () => {
    renderRow({ problem: problem({ title: 'The "Lantern" Keeper\'s Son' }) });

    expect(screen.getByText('The "Lantern" Keeper\'s Son')).toBeDefined();
  });

  it('shows a title with diacritics, whole', () => {
    renderRow({ problem: problem({ title: 'Amélie — Le Fabuleux Destin' }) });

    expect(screen.getByText('Amélie — Le Fabuleux Destin')).toBeDefined();
  });

  it('shows a very long title whole, in a text block that may shrink rather than push the controls out', () => {
    const long = 'The Extraordinarily Long Title '.repeat(6).trim();
    renderRow({ problem: problem({ title: long }) });

    const title = screen.getByText(long);
    expect(title.textContent).toBe(long);
    // The prototype's `flex: 1; min-width: 0` on the text block: without the
    // nought a long title widens the row past the list instead of wrapping.
    expect(getComputedStyle(title.parentElement as HTMLElement).minWidth).toBe(
      '0px'
    );
    expect(resolveLink()).toBeDefined();
    expect(skipButton()).toBeDefined();
  });
});
