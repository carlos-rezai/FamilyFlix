import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import type { EpisodeFormRow, FolderArt } from '@/types';
import { useSeasonPosters } from './useSeasonPosters';

/**
 * 76, Whole add, Phase 3 (issue #718): the pick fills the Season posters.
 *
 * `useSeasonPosters` gains `prefillFolderArt(art, picked)`, the same prefill
 * `useShowFolderPick` offers: each **Season poster** in the **Folder art**
 * fills its season's slot as a **Found file** by the one fill rule (a slot is
 * filled when it is empty or still holds the earlier pick's file, never over
 * a file picked by hand). Offering empty art with the earlier pick's, as the
 * Show folder row's ✕ does, takes back each slot still holding it. A slot is
 * drawn once the rows hold its season.
 */

const SHOW = 'E:\\Shows\\The Show (2019)';
const OTHER = 'E:\\Shows\\Other Show';

/** An episode row in `season`, the rest of it beside the point. */
const row = (season: string): EpisodeFormRow => ({
  key: `row-${season}`,
  file: { kind: 'found', path: `${SHOW}\\S0${season}E01.mkv`, filename: 'x' },
  season,
  number: '1',
  title: '',
  subtitles: [],
  still: null,
});

const art = (folder: string, seasons: number[]): FolderArt => ({
  poster: null,
  backdrop: null,
  seasonPosters: Object.fromEntries(
    seasons.map((season) => [
      season,
      `${folder}\\Season 0${season}\\Images\\poster.jpg`,
    ])
  ),
});

const NO_ART: FolderArt = { poster: null, backdrop: null, seasonPosters: {} };

const image = (name: string) =>
  new File(['image bytes'], name, { type: 'image/jpeg' });

/** The slots as `[season, the slot's file]`. */
function slotsOf(result: { current: ReturnType<typeof useSeasonPosters> }) {
  return result.current.slots.map((slot) => [slot.season, slot.poster]);
}

const found = (folder: string, season: number) => ({
  kind: 'found',
  path: `${folder}\\Season 0${season}\\Images\\poster.jpg`,
  filename: 'poster.jpg',
});

describe('useSeasonPosters: the Folder art prefill', () => {
  it('fills each empty slot with its found Season poster', () => {
    const { result } = renderHook(() =>
      useSeasonPosters([row('1'), row('2'), row('3')], true)
    );

    act(() => result.current.prefillFolderArt(art(SHOW, [1, 3]), null));

    expect(slotsOf(result)).toEqual([
      [1, found(SHOW, 1)],
      [2, null],
      [3, found(SHOW, 3)],
    ]);
  });

  it('draws no slot for a found Season poster whose season no row holds', () => {
    const { result } = renderHook(() => useSeasonPosters([row('1')], true));

    act(() => result.current.prefillFolderArt(art(SHOW, [1, 4]), null));

    expect(slotsOf(result)).toEqual([[1, found(SHOW, 1)]]);
  });

  it('never fills a slot picked by hand', () => {
    const { result } = renderHook(() =>
      useSeasonPosters([row('1'), row('2')], true)
    );
    act(() => result.current.pick(1, image('mine.jpg')));

    act(() => result.current.prefillFolderArt(art(SHOW, [1, 2]), null));

    expect(result.current.slots[0].poster).toMatchObject({
      kind: 'picked',
      filename: 'mine.jpg',
    });
    expect(result.current.slots[1].poster).toEqual(found(SHOW, 2));
  });

  it('replaces the earlier pick’s Season posters on a second pick', () => {
    const { result } = renderHook(() =>
      useSeasonPosters([row('1'), row('2')], true)
    );
    const first = art(SHOW, [1, 2]);
    act(() => result.current.prefillFolderArt(first, null));

    act(() => result.current.prefillFolderArt(art(OTHER, [1]), first));

    expect(slotsOf(result)).toEqual([
      [1, found(OTHER, 1)],
      [2, null],
    ]);
  });

  it('takes the pick’s Season posters back, keeping one replaced by hand', () => {
    const { result } = renderHook(() =>
      useSeasonPosters([row('1'), row('2')], true)
    );
    const first = art(SHOW, [1, 2]);
    act(() => result.current.prefillFolderArt(first, null));
    act(() => result.current.remove(2));
    act(() => result.current.pick(2, image('mine.jpg')));

    act(() => result.current.prefillFolderArt(NO_ART, first));

    expect(result.current.slots[0].poster).toBeNull();
    expect(result.current.slots[1].poster).toMatchObject({
      kind: 'picked',
      filename: 'mine.jpg',
    });
  });
});
