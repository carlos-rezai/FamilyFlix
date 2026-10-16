import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import type { EpisodeFormRow, MovieFormFile } from '@/types';
import { useSeasonPosters } from './useSeasonPosters';

/**
 * 42 — Review at scale refactor (issue #366), Group 6: the **Movie form**'s
 * _Season posters_, in a hook of their own on `useEpisodeList`'s pattern.
 *
 * One slot per **Season** the episode rows hold, in season order, appearing
 * and going with the rows; a pick and a ✕ per season; and `hold`, the series
 * edit's opening, which marks each held poster `held` so an emptied slot can
 * be told from one never filled. A **Series Resolve** draws none.
 */

/** An episode row in `season`, the rest of it beside the point. */
const row = (season: string, key = `row-${season}`): EpisodeFormRow => ({
  key,
  file: {
    kind: 'picked',
    file: new File(['video'], `${key}.mkv`),
    filename: `${key}.mkv`,
  },
  season,
  number: '1',
  title: '',
  subtitles: [],
  still: null,
});

const art = (name: string) =>
  new File(['image bytes'], name, { type: 'image/jpeg' });

const HELD: MovieFormFile = {
  kind: 'stored',
  path: 'harbor-vine-2019/S02-poster.jpg',
  filename: 'S02-poster.jpg',
};

/** The slots as `[season, filename, held]`. */
function slotsOf(result: { current: ReturnType<typeof useSeasonPosters> }) {
  return result.current.slots.map((slot) => [
    slot.season,
    slot.poster?.filename ?? null,
    slot.held,
  ]);
}

describe('useSeasonPosters — the slots', () => {
  it('draws one empty slot per season the rows hold, sorted', () => {
    const { result } = renderHook(() =>
      useSeasonPosters([row('2'), row('10'), row('1'), row('2', 'again')], true)
    );

    expect(slotsOf(result)).toEqual([
      [1, null, false],
      [2, null, false],
      [10, null, false],
    ]);
  });

  it('reads season 0 as a season, and a blank one as none', () => {
    const { result } = renderHook(() =>
      useSeasonPosters([row('0'), row('')], true)
    );

    expect(slotsOf(result)).toEqual([[0, null, false]]);
  });

  it('adds a slot with its first row and takes it away with its last', () => {
    const { result, rerender } = renderHook(
      ({ rows }) => useSeasonPosters(rows, true),
      { initialProps: { rows: [row('1')] } }
    );

    rerender({ rows: [row('1'), row('3')] });
    expect(slotsOf(result).map(([season]) => season)).toEqual([1, 3]);

    rerender({ rows: [row('3')] });
    expect(slotsOf(result).map(([season]) => season)).toEqual([3]);
  });

  it('draws none in a Series Resolve', () => {
    const { result } = renderHook(() => useSeasonPosters([row('1')], false));

    expect(result.current.slots).toEqual([]);
  });
});

describe('useSeasonPosters — pick, remove and hold', () => {
  it('puts a picked file in its season’s slot, and the ✕ empties it', () => {
    const { result } = renderHook(() =>
      useSeasonPosters([row('1'), row('2')], true)
    );

    act(() => result.current.pick(2, art('spring.jpg')));
    expect(slotsOf(result)).toEqual([
      [1, null, false],
      [2, 'spring.jpg', false],
    ]);

    act(() => result.current.remove(2));
    expect(slotsOf(result)).toEqual([
      [1, null, false],
      [2, null, false],
    ]);
  });

  it('holds a record’s posters as held, and an emptied one stays held', () => {
    const { result } = renderHook(() =>
      useSeasonPosters([row('1'), row('2')], true)
    );

    act(() => result.current.hold({ 2: HELD }));
    expect(slotsOf(result)).toEqual([
      [1, null, false],
      [2, 'S02-poster.jpg', true],
    ]);

    act(() => result.current.remove(2));
    expect(slotsOf(result)).toEqual([
      [1, null, false],
      [2, null, true],
    ]);

    act(() => result.current.pick(2, art('autumn.jpg')));
    expect(slotsOf(result)).toEqual([
      [1, null, false],
      [2, 'autumn.jpg', true],
    ]);
  });

  it('puts a held record in place of what the slots held before', () => {
    const { result } = renderHook(() =>
      useSeasonPosters([row('1'), row('2')], true)
    );

    act(() => result.current.pick(1, art('spring.jpg')));
    act(() => result.current.hold({ 2: HELD }));

    expect(slotsOf(result)).toEqual([
      [1, null, false],
      [2, 'S02-poster.jpg', true],
    ]);
  });
});
