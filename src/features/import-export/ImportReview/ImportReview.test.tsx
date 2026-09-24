import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { ImportReview, type ImportReviewProps } from './ImportReview';
import type { ImportProblem } from '@/types';
import { theme } from '@/styles/theme';
import { makeImportRun } from '@/test-support/makeImportRun/makeImportRun';

/**
 * 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125) and Phase 4:
 * "problems and review" (issue #129).
 *
 * The **Review step**, from `feat.ImportFlow.dc.html`: two stat tiles —
 * `matched confidently and imported` and `need your attention` — over the
 * **Needs attention** list, one row per **Problem** with its dot, title,
 * reason, _Resolve_ and _Skip_; the `✓ All done` card once the list is
 * empty; and _Finish — go to library_ either way. The step draws the run it
 * is handed and reports a press — _Skip_ names the problem's id — and never
 * removes a row itself: the **Run hook** does, and the next `run` shows it.
 */

const PROBLEMS: ImportProblem[] = [
  {
    id: 'p1',
    kind: 'no-row',
    title: 'Ironwood (2018)',
    reason: "Folder isn't in the spreadsheet.",
  },
  {
    id: 'p2',
    kind: 'no-folder',
    title: 'The Lantern Keeper',
    reason: 'No folder found matching this spreadsheet row.',
  },
  {
    id: 'p3',
    kind: 'missing-meta',
    title: 'Amélie',
    reason:
      "Imported, but the row has no genre — it won't appear in any genre row.",
    movieId: 'm9',
  },
];

const inReview = (problems: ImportProblem[] = PROBLEMS, matched = 7) =>
  makeImportRun({
    phase: 'review',
    found: 10,
    total: matched,
    done: matched,
    matched,
    problems,
  });

function renderReview(props: Partial<ImportReviewProps> = {}) {
  const view = (
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <ImportReview
          run={props.run ?? inReview()}
          onSkip={props.onSkip ?? (() => undefined)}
          onFinish={props.onFinish ?? (() => undefined)}
        />
      </ThemeProvider>
    </MemoryRouter>
  );
  const rendered = render(view);
  return {
    ...rendered,
    /** The same step, handed a later run. */
    rerenderWith: (run: ImportReviewProps['run']) =>
      rendered.rerender(
        <MemoryRouter>
          <ThemeProvider theme={theme}>
            <ImportReview
              run={run}
              onSkip={props.onSkip ?? (() => undefined)}
              onFinish={props.onFinish ?? (() => undefined)}
            />
          </ThemeProvider>
        </MemoryRouter>
      ),
  };
}

const finishButton = () =>
  screen.getByRole('button', { name: 'Finish — go to library' });

/** A tile is its label's parent; the number is the one other thing in it. */
const tileNumber = (label: RegExp): string =>
  within(screen.getByText(label).parentElement as HTMLElement).getByText(
    /^[\d,]+$/
  ).textContent ?? '';

const MATCHED = /matched confidently\s*and imported/;
const ATTENTION = /need your\s*attention/;

/** The row a problem's title is in: the text block's parent. */
const rowOf = (title: string): HTMLElement =>
  screen.getByText(title).parentElement?.parentElement as HTMLElement;

describe('ImportReview — the two tiles', () => {
  it('counts the matched in the first tile and the problems in the second', () => {
    renderReview({ run: inReview(PROBLEMS, 7) });

    expect(tileNumber(MATCHED)).toBe('7');
    expect(tileNumber(ATTENTION)).toBe('3');
  });

  it('counts down as problems leave the run', () => {
    const { rerenderWith } = renderReview({ run: inReview(PROBLEMS, 7) });
    expect(tileNumber(ATTENTION)).toBe('3');

    rerenderWith(inReview(PROBLEMS.slice(1), 7));

    expect(tileNumber(ATTENTION)).toBe('2');
    expect(tileNumber(MATCHED)).toBe('7');
  });

  it('shows the matched tile first', () => {
    renderReview();

    expect(
      screen
        .getByText(MATCHED)
        .compareDocumentPosition(screen.getByText(ATTENTION)) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});

describe('ImportReview — the Needs attention list', () => {
  it('heads the list Needs attention', () => {
    renderReview();

    expect(screen.getByText('Needs attention')).toBeDefined();
  });

  it('lists every problem with its title and reason, in the run’s order', () => {
    renderReview();

    const titles = PROBLEMS.map((problem) => screen.getByText(problem.title));
    for (const problem of PROBLEMS) {
      expect(screen.getByText(problem.reason)).toBeDefined();
    }
    expect(
      titles[0].compareDocumentPosition(titles[1]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      titles[1].compareDocumentPosition(titles[2]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('gives every row its Resolve and its Skip', () => {
    renderReview();

    expect(screen.getAllByRole('link', { name: 'Resolve' })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Skip' })).toHaveLength(3);
  });

  it('links each row’s Resolve to its own problem', () => {
    renderReview();

    expect(
      within(rowOf('The Lantern Keeper'))
        .getByRole('link', { name: 'Resolve' })
        .getAttribute('href')
    ).toBe('/add?problem=p2');
  });

  it('reports a Skip with that row’s id, and removes nothing itself', () => {
    const onSkip = vi.fn();
    renderReview({ onSkip });

    fireEvent.click(
      within(rowOf('The Lantern Keeper')).getByRole('button', { name: 'Skip' })
    );

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledWith('p2');
    // The row is the run's to remove: it stays until the next snapshot.
    expect(screen.getByText('The Lantern Keeper')).toBeDefined();
  });

  it('drops the row once the run no longer carries the problem', () => {
    const { rerenderWith } = renderReview();

    rerenderWith(inReview(PROBLEMS.filter((problem) => problem.id !== 'p2')));

    expect(screen.queryByText('The Lantern Keeper')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Skip' })).toHaveLength(2);
  });

  it('seats a quoted, an accented and a very long title each in its own row', () => {
    const long = 'The Extraordinarily Long Title '.repeat(6).trim();
    renderReview({
      run: inReview([
        { ...PROBLEMS[0], id: 'q', title: 'The "Lantern" Keeper\'s Son' },
        { ...PROBLEMS[1], id: 'a', title: 'Amélie — Le Fabuleux Destin' },
        { ...PROBLEMS[2], id: 'l', title: long },
      ]),
    });

    expect(screen.getByText('The "Lantern" Keeper\'s Son')).toBeDefined();
    expect(screen.getByText('Amélie — Le Fabuleux Destin')).toBeDefined();
    expect(screen.getByText(long)).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Skip' })).toHaveLength(3);
    expect(tileNumber(ATTENTION)).toBe('3');
  });
});

describe('ImportReview — all done', () => {
  it('shows the All done card only once the list is empty', () => {
    const { rerenderWith } = renderReview();
    expect(screen.queryByText('✓ All done')).toBeNull();
    expect(
      screen.queryByText('Every flagged movie has been handled.')
    ).toBeNull();

    rerenderWith(inReview([]));

    expect(screen.getByText('✓ All done')).toBeDefined();
    expect(
      screen.getByText('Every flagged movie has been handled.')
    ).toBeDefined();
    expect(screen.queryByText('Needs attention')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
  });

  it('offers Finish while problems remain, and once they are gone', () => {
    const { rerenderWith } = renderReview();
    expect(finishButton()).toBeDefined();
    expect((finishButton() as HTMLButtonElement).disabled).toBe(false);

    rerenderWith(inReview([]));

    expect((finishButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it('finishes when Finish is pressed', () => {
    const onFinish = vi.fn();
    renderReview({ onFinish });

    fireEvent.click(finishButton());

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('shows zeros in both tiles and the card for a run over an empty root', () => {
    renderReview({
      run: makeImportRun({
        phase: 'review',
        found: 0,
        total: 0,
        done: 0,
        matched: 0,
        problems: [],
      }),
    });

    expect(tileNumber(MATCHED)).toBe('0');
    expect(tileNumber(ATTENTION)).toBe('0');
    expect(screen.getByText('✓ All done')).toBeDefined();
  });

  it('shows neither headline of the running step', () => {
    renderReview();

    expect(screen.queryByText('Scanning your library…')).toBeNull();
    expect(screen.queryByText('Importing movies…')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel import' })).toBeNull();
  });
});

/**
 * 22 — Series (TV), Phase 7 (issue #197): the **Review step** draws the new
 * hard `unplaced` **Problem** among the rest — counted in the second tile,
 * its row carrying _Skip_ and no _Resolve_, the rows around it unchanged.
 */
describe('ImportReview — an unplaced episode', () => {
  const UNPLACED: ImportProblem = {
    id: 'p4',
    kind: 'unplaced',
    title: 'Lighthouse Keepers · Behind the Scenes.mp4',
    reason: 'No episode number — rename it S01E03 and import again.',
  };

  it('lists it with its title and reason, and counts it', () => {
    renderReview({ run: inReview([...PROBLEMS, UNPLACED]) });

    expect(screen.getByText(UNPLACED.title)).toBeDefined();
    expect(screen.getByText(UNPLACED.reason)).toBeDefined();
    expect(tileNumber(ATTENTION)).toBe('4');
  });

  it('gives its row Skip and no Resolve, and leaves the others theirs', () => {
    renderReview({ run: inReview([...PROBLEMS, UNPLACED]) });

    const row = within(rowOf(UNPLACED.title));
    expect(row.queryByRole('link', { name: 'Resolve' })).toBeNull();
    expect(row.getByRole('button', { name: 'Skip' })).toBeDefined();
    expect(screen.getAllByRole('link', { name: 'Resolve' })).toHaveLength(3);
  });

  it('reports its Skip with its id', () => {
    const onSkip = vi.fn();
    renderReview({ run: inReview([...PROBLEMS, UNPLACED]), onSkip });

    fireEvent.click(
      within(rowOf(UNPLACED.title)).getByRole('button', { name: 'Skip' })
    );

    expect(onSkip).toHaveBeenCalledWith('p4');
  });
});
