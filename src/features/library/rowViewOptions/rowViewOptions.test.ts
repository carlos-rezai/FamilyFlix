import { describe, it, expect, vi } from 'vitest';

import { rowViewOptions } from './rowViewOptions';
import type { RowView } from '@/types';

/**
 * 63, Row view, Phase 2 (issue #609): the **Row view switch**'s rows, the
 * `sortOptions` / `ratingOptions` shape. _All_ then _By genre_, the current
 * one checked, no counts, choosing a row calling back with its value.
 */

/** The options built for a given view, with nothing listening. */
const optionsFor = (current: RowView) =>
  rowViewOptions(current, () => undefined);

describe('rowViewOptions: the rows', () => {
  it('lists All then By genre', () => {
    expect(optionsFor('genre').map((option) => option.label)).toEqual([
      'All',
      'By genre',
    ]);
  });

  it('carries no count: a view is a way of arranging, not a shelf', () => {
    for (const option of optionsFor('all')) {
      expect(option.count).toBeUndefined();
    }
  });
});

describe('rowViewOptions: which row reads as chosen', () => {
  it.each([
    ['all', 'All'],
    ['genre', 'By genre'],
  ] as const)('checks %s and only it', (current, label) => {
    const selected = optionsFor(current).filter((option) => option.selected);

    expect(selected.map((option) => option.label)).toEqual([label]);
  });
});

describe('rowViewOptions: what choosing a row asks for', () => {
  it.each([
    ['All', 'all'],
    ['By genre', 'genre'],
  ] as const)('choosing %s calls back with %s', (label, value) => {
    const onChoose = vi.fn<(view: RowView) => void>();
    const option = rowViewOptions('genre', onChoose).find(
      (candidate) => candidate.label === label
    );

    option?.onSelect();

    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith(value);
  });

  it('tells nobody anything until a row is actually chosen', () => {
    const onChoose = vi.fn<(view: RowView) => void>();

    rowViewOptions('all', onChoose);

    expect(onChoose).not.toHaveBeenCalled();
  });
});
