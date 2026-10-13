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
          onApply={props.onApply ?? (() => undefined)}
          onPick={props.onPick ?? (() => undefined)}
          onImportAs={props.onImportAs ?? (() => undefined)}
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
/** The Sync's conflict gold, `#c9a86a` — the `differs` dot in the prototype. */
const GOLD = 'rgb(201, 168, 106)';

/** The token each kind's dot is filled with, as jsdom reports the hex. */
const DOT: Record<ProblemKind, string> = {
  'no-folder': DANGER,
  'no-video': DANGER,
  failed: DANGER,
  unplaced: DANGER,
  ambiguous: ACCENT,
  'no-row': TEXT_FAINT,
  'missing-meta': TEXT_FAINT,
  differs: GOLD,
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

/**
 * 38 — Title editing, Slice 7 (issue #310): the `unplaced` **Problem** is one
 * per show — titled with the show, its reason the count — and its _Resolve_
 * opens the **Series Resolve**: the Movie form's series kind in import
 * context, `/add?kind=series&problem=<id>`, with `&series=<id>` beside it when
 * the show is one the library holds already, so the save joins it. The
 * `resolvable` exclusion that drew _Skip_ alone is gone.
 */
describe('ProblemRow — an unplaced show', () => {
  const unplaced = problem({
    id: 'p5',
    kind: 'unplaced',
    title: 'The Night Ferry',
    reason: '8 episodes need numbers',
  });

  it('shows the show’s title and the count as its reason', () => {
    renderRow({ problem: unplaced });

    expect(screen.getByText('The Night Ferry')).toBeDefined();
    expect(screen.getByText('8 episodes need numbers')).toBeDefined();
  });

  it('offers Resolve before Skip', () => {
    renderRow({ problem: unplaced });

    expect(
      resolveLink().compareDocumentPosition(skipButton()) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('links Resolve to the series kind of the form, by the problem’s id', () => {
    renderRow({ problem: unplaced });

    expect(resolveLink().getAttribute('href')).toBe(
      '/add?kind=series&problem=p5'
    );
  });

  it('names the held series beside the problem when the show is already in the library', () => {
    renderRow({ problem: { ...unplaced, seriesId: 'night-ferry' } });

    const query = resolveQuery();
    expect(query.get('kind')).toBe('series');
    expect(query.get('problem')).toBe('p5');
    expect(query.get('series')).toBe('night-ferry');
    expect(query.has('movie')).toBe(false);
  });

  it('encodes both ids into the link, so each reads back whole', () => {
    renderRow({
      problem: { ...unplaced, id: 'p 1/x&', seriesId: 's 2/y#' },
    });

    const query = resolveQuery();
    expect(query.get('problem')).toBe('p 1/x&');
    expect(query.get('series')).toBe('s 2/y#');
  });

  it('offers Skip, and raises onSkip when it is pressed', () => {
    const onSkip = vi.fn();
    renderRow({ problem: unplaced, onSkip });

    fireEvent.click(skipButton());

    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});

/**
 * 40 — Import review, Phase 3: "Sheet differences" (issue #333).
 *
 * The row gains `DecisionRow`'s face slot under its head. A `differs` Problem
 * draws the graduated `FieldDiff` as _Yours | Spreadsheet_, every field on the
 * sheet until a press says otherwise, and no _Resolve_; _Apply choices_
 * reports `onApply(choices)` with `'theirs'` mapped to `'sheet'`, and _Keep
 * all mine_ is the row's _Skip_. Every other kind draws no face.
 */
describe('ProblemRow — a differs row', () => {
  const differs = problem({
    id: 'p9',
    kind: 'differs',
    title: 'Die Hard',
    reason:
      'The spreadsheet has different values for fields you already filled in.',
    movieId: 'm1',
    differences: [
      {
        field: 'director',
        label: 'Director',
        mine: 'Renny Harlin',
        sheet: 'John McTiernan',
      },
      { field: 'rating', label: 'Rating', mine: '★★½', sheet: '★★★★' },
    ],
  });

  const sheetSides = () =>
    screen.getAllByRole('button', { name: /^Spreadsheet/ });
  const yoursSides = () => screen.getAllByRole('button', { name: /^Yours/ });

  it('shows the title and the reason', () => {
    renderRow({ problem: differs });

    expect(screen.getByText('Die Hard')).toBeDefined();
    expect(
      screen.getByText(
        'The spreadsheet has different values for fields you already filled in.'
      )
    ).toBeDefined();
  });

  it('offers no Resolve, and keeps Skip', () => {
    renderRow({ problem: differs });

    expect(screen.queryByRole('link', { name: 'Resolve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Resolve' })).toBeNull();
    expect(skipButton()).toBeDefined();
  });

  it('draws one Yours | Spreadsheet row per difference, both sides spelled', () => {
    renderRow({ problem: differs });

    expect(yoursSides()).toHaveLength(2);
    expect(sheetSides()).toHaveLength(2);
    expect(screen.getByText('Director')).toBeDefined();
    expect(screen.getByText('Renny Harlin')).toBeDefined();
    expect(screen.getByText('John McTiernan')).toBeDefined();
    expect(screen.getByText('Rating')).toBeDefined();
    expect(screen.getByText('★★½')).toBeDefined();
    expect(screen.getByText('★★★★')).toBeDefined();
    expect(screen.queryAllByRole('button', { name: /^TMDB/ })).toHaveLength(0);
  });

  it('draws the diff under the head', () => {
    renderRow({ problem: differs });

    expect(
      screen.getByText('Die Hard').compareDocumentPosition(yoursSides()[0]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('chooses the spreadsheet on every field by default', () => {
    renderRow({ problem: differs });

    for (const side of sheetSides()) {
      expect(side.getAttribute('aria-pressed')).toBe('true');
    }
    for (const side of yoursSides()) {
      expect(side.getAttribute('aria-pressed')).toBe('false');
    }
  });

  it('reports Apply choices keyed by field, the sheet’s side as sheet', () => {
    const onApply = vi.fn<ProblemRowProps['onApply']>();
    renderRow({ problem: differs, onApply });

    fireEvent.click(yoursSides()[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Apply choices' }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({ director: 'sheet', rating: 'mine' });
  });

  it('reports Keep all mine as Skip, and applies nothing', () => {
    const onSkip = vi.fn();
    const onApply = vi.fn<ProblemRowProps['onApply']>();
    renderRow({ problem: differs, onSkip, onApply });

    fireEvent.click(screen.getByRole('button', { name: 'Keep all mine' }));

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('reports Skip as Skip', () => {
    const onSkip = vi.fn();
    renderRow({ problem: differs, onSkip });

    fireEvent.click(skipButton());

    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});

describe('ProblemRow — the other kinds draw no face', () => {
  it.each([
    'no-folder',
    'ambiguous',
    'no-video',
    'no-row',
    'failed',
    'missing-meta',
    'unplaced',
  ] as ProblemKind[])(
    'draws no diff on a %s row, and keeps Resolve',
    (kind) => {
      renderRow({ problem: problem({ kind, movieId: 'm1' }) });

      expect(
        screen.queryByRole('button', { name: 'Apply choices' })
      ).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Keep all mine' })
      ).toBeNull();
      expect(screen.queryAllByRole('button', { name: /^Yours/ })).toHaveLength(
        0
      );
      expect(resolveLink()).toBeDefined();
    }
  );
});

/**
 * 40 — Import review, Phase 4: "the Folder picker" (issue #334).
 *
 * An `ambiguous` row draws the **Folder picker** in the face slot under its
 * head, one card per **Candidate folder**, with _Resolve_ kept beside _Skip_
 * for a pick that wants editing first. A press reports `onPick(folder)`; the
 * row knows nothing of what follows. No other kind draws it.
 */
describe('ProblemRow — an ambiguous row', () => {
  const ambiguous = problem({
    id: 'p4',
    kind: 'ambiguous',
    title: 'Die Hard',
    reason: 'Two folders look like plausible matches. Pick one.',
    candidates: [
      {
        path: 'D:/Films/Die.Hard.1988.1080p',
        name: 'Die.Hard.1988.1080p',
        videos: 1,
      },
      { path: 'D:/Films/Die Hard (1988)', name: 'Die Hard (1988)', videos: 2 },
    ],
  });

  /** A Candidate folder's card: the button its name is drawn in. */
  const folderCard = (name: string): HTMLElement => {
    const card = screen.getByText(name).closest('button');
    if (card === null) {
      throw new Error(`no card for ${name}`);
    }
    return card;
  };

  it('draws one card per Candidate folder, with its path and video count', () => {
    renderRow({ problem: ambiguous });

    expect(screen.getByText('Die.Hard.1988.1080p')).toBeDefined();
    expect(screen.getByText('D:/Films/Die.Hard.1988.1080p')).toBeDefined();
    expect(screen.getByText('1 video')).toBeDefined();
    expect(screen.getByText('Die Hard (1988)')).toBeDefined();
    expect(screen.getByText('D:/Films/Die Hard (1988)')).toBeDefined();
    expect(screen.getByText('2 videos')).toBeDefined();
  });

  it('keeps Resolve and Skip beside the picker, and draws no diff', () => {
    renderRow({ problem: ambiguous });

    expect(folderCard('Die Hard (1988)')).toBeDefined();
    expect(resolveLink()).toBeDefined();
    expect(skipButton()).toBeDefined();
    expect(resolveQuery().get('problem')).toBe('p4');
    expect(screen.queryByRole('button', { name: 'Apply choices' })).toBeNull();
  });

  it('draws the picker under the head', () => {
    renderRow({ problem: ambiguous });

    expect(
      skipButton().compareDocumentPosition(folderCard('Die Hard (1988)')) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('reports the folder pressed, and skips nothing', () => {
    const onPick = vi.fn<ProblemRowProps['onPick']>();
    const onSkip = vi.fn();
    renderRow({ problem: ambiguous, onPick, onSkip });

    fireEvent.click(folderCard('Die Hard (1988)'));

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('D:/Films/Die Hard (1988)');
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('draws the picker on an ambiguous row alone', () => {
    const KINDS: ProblemKind[] = [
      'no-folder',
      'ambiguous',
      'no-video',
      'no-row',
      'failed',
      'missing-meta',
      'unplaced',
      'differs',
    ];
    const drawn = KINDS.filter((kind) => {
      const { unmount } = renderRow({
        problem: problem({
          kind,
          movieId: 'm1',
          candidates: ambiguous.candidates,
        }),
      });
      const shown = screen.queryByText('2 videos') !== null;
      unmount();
      return shown;
    });

    expect(drawn).toEqual(['ambiguous']);
  });
});

/**
 * 40 — Import review, Phase 4: "Import as on a no-row row" (issue #335).
 *
 * A `no-row` row draws _Import as “Ironwood (2018)”_ — `secondary`, `sm` — in
 * the face slot under its head, the Problem's `guess` spelled in it, with
 * _Resolve_ kept beside _Skip_ for a name the maintainer would rather choose.
 * A press reports `onImportAs()`; the row knows nothing of what follows. No
 * other kind draws it, and every kind's _Skip_ still reports `onSkip`.
 */
describe('ProblemRow — a no-row row', () => {
  const noRow = problem({
    id: 'p5',
    kind: 'no-row',
    title: 'Ironwood.2018.1080p',
    reason: "Folder isn't in the spreadsheet.",
    guess: 'Ironwood (2018)',
  });

  const importAs = () =>
    screen.getByRole('button', { name: 'Import as “Ironwood (2018)”' });

  it('draws Import as with the guess spelled, title and year', () => {
    renderRow({ problem: noRow });

    expect(importAs()).toBeDefined();
  });

  it('spells a guess with no year as its title alone', () => {
    renderRow({
      problem: { ...noRow, guess: 'The Quiet Hours' },
    });

    expect(
      screen.getByRole('button', { name: 'Import as “The Quiet Hours”' })
    ).toBeDefined();
  });

  it('keeps Resolve and Skip beside it, Resolve onto the form by the id', () => {
    renderRow({ problem: noRow });

    expect(resolveLink()).toBeDefined();
    expect(skipButton()).toBeDefined();
    expect(resolveLink().getAttribute('href')).toBe('/add?problem=p5');
  });

  it('draws it under the head', () => {
    renderRow({ problem: noRow });

    expect(
      skipButton().compareDocumentPosition(importAs()) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('draws it as a secondary sm Button', () => {
    renderRow({ problem: noRow });

    const style = getComputedStyle(importAs());
    expect(style.height).toBe('40px');
    expect(style.fontSize).toBe('14px');
    expect(style.borderTopWidth).toBe('1px');
    expect(style.borderTopColor).toBe('rgb(58, 48, 36)');
    expect(style.backgroundColor).toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/);
  });

  it('reports the press, and skips nothing', () => {
    const onImportAs = vi.fn<ProblemRowProps['onImportAs']>();
    const onSkip = vi.fn();
    renderRow({ problem: noRow, onImportAs, onSkip });

    fireEvent.click(importAs());

    expect(onImportAs).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });

  const OTHERS: ProblemKind[] = [
    'no-folder',
    'ambiguous',
    'no-video',
    'failed',
    'missing-meta',
    'unplaced',
    'differs',
  ];

  it('draws Import as on a no-row row alone', () => {
    const drawn = (['no-row', ...OTHERS] as ProblemKind[]).filter((kind) => {
      const { unmount } = renderRow({
        problem: problem({ kind, movieId: 'm1', guess: noRow.guess }),
      });
      const shown =
        screen.queryByRole('button', { name: /^Import as/ }) !== null;
      unmount();
      return shown;
    });

    expect(drawn).toEqual(['no-row']);
  });

  it.each([
    'no-folder',
    'no-video',
    'failed',
    'missing-meta',
    'unplaced',
  ] as ProblemKind[])(
    'keeps a %s row’s Resolve, and draws no Import as',
    (kind) => {
      renderRow({ problem: problem({ kind, movieId: 'm1' }) });

      expect(resolveLink()).toBeDefined();
      expect(screen.queryByRole('button', { name: /^Import as/ })).toBeNull();
    }
  );

  it.each(['no-row', ...OTHERS] as ProblemKind[])(
    'reports Skip on a %s row as before, and imports nothing',
    (kind) => {
      const onSkip = vi.fn();
      const onImportAs = vi.fn<ProblemRowProps['onImportAs']>();
      renderRow({
        problem: problem({ kind, movieId: 'm1', guess: noRow.guess }),
        onSkip,
        onImportAs,
      });

      fireEvent.click(skipButton());

      expect(onSkip).toHaveBeenCalledTimes(1);
      expect(onImportAs).not.toHaveBeenCalled();
    }
  );
});
