import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useEpisodeList } from './useEpisodeList';

/**
 * 29 — Add a series, Phase 3 (issue #263): the **Movie form**'s episode list.
 *
 * The keyed `EpisodeFormRow`s the series kind holds. A pick of episode files
 * is read through `readEpisodeTag` and inserted in tag order, each row
 * prefilled with the season, the number and the title the tag gave; a file
 * with no tag goes to season 1 as the next free number. A second pick appends
 * after the first, and nothing is ever re-sorted on an edit — the rows stay
 * where the maintainer saw them land.
 *
 * `episodesComplete` is the series half of the **Save gate**: at least one
 * row, every season and number at least 1, and no (season, number) pair
 * twice.
 */

const video = (name: string) =>
  new File(['video bytes'], name, { type: 'video/x-matroska' });

/** The rows as `[season, number, title, filename]`, in the order held. */
function rows(result: { current: ReturnType<typeof useEpisodeList> }) {
  return result.current.episodes.map((row) => [
    row.season,
    row.number,
    row.title,
    row.file.filename,
  ]);
}

function add(
  result: { current: ReturnType<typeof useEpisodeList> },
  names: string[]
) {
  act(() => {
    result.current.addEpisodeFiles(names.map(video));
  });
}

describe('useEpisodeList — a pick', () => {
  it('opens empty', () => {
    const { result } = renderHook(() => useEpisodeList());

    expect(result.current.episodes).toEqual([]);
  });

  it('lands a tagged pick in tag order, each row prefilled', () => {
    const { result } = renderHook(() => useEpisodeList());

    add(result, [
      'Harbor.and.Vine.S01E03.The.Night.Market.mkv',
      'Harbor.and.Vine.S02E01.Spring.Tide.mkv',
      'Harbor.and.Vine.S01E01.Pilot.mkv',
      'Harbor.and.Vine.S01E02.Low.Tide.mkv',
    ]);

    expect(rows(result)).toEqual([
      ['1', '1', 'Pilot', 'Harbor.and.Vine.S01E01.Pilot.mkv'],
      ['1', '2', 'Low Tide', 'Harbor.and.Vine.S01E02.Low.Tide.mkv'],
      [
        '1',
        '3',
        'The Night Market',
        'Harbor.and.Vine.S01E03.The.Night.Market.mkv',
      ],
      ['2', '1', 'Spring Tide', 'Harbor.and.Vine.S02E01.Spring.Tide.mkv'],
    ]);
  });

  it('holds each pick as a picked file', () => {
    const { result } = renderHook(() => useEpisodeList());
    const file = video('Harbor.and.Vine.S01E01.Pilot.mkv');

    act(() => {
      result.current.addEpisodeFiles([file]);
    });

    expect(result.current.episodes[0].file).toEqual({
      kind: 'picked',
      file,
      filename: 'Harbor.and.Vine.S01E01.Pilot.mkv',
    });
  });

  it('prefills an empty title when the tag carries none', () => {
    const { result } = renderHook(() => useEpisodeList());

    add(result, ['Harbor.and.Vine.S01E04.1080p.mkv']);

    expect(result.current.episodes[0].title).toBe('');
  });

  it('gives an untagged file the next free number in season 1', () => {
    const { result } = renderHook(() => useEpisodeList());

    add(result, [
      'Harbor.and.Vine.S01E01.Pilot.mkv',
      'Harbor.and.Vine.S01E02.Low.Tide.mkv',
    ]);
    add(result, ['bonus.mkv']);

    expect(rows(result)[2].slice(0, 2)).toEqual(['1', '3']);
  });

  it('numbers untagged files on from 1 in season 1 on an empty list', () => {
    const { result } = renderHook(() => useEpisodeList());

    add(result, ['first.mkv', 'second.mkv']);

    expect(rows(result).map((row) => row.slice(0, 2))).toEqual([
      ['1', '1'],
      ['1', '2'],
    ]);
  });

  it('appends a second pick after the first, rather than sorting it in', () => {
    const { result } = renderHook(() => useEpisodeList());

    add(result, ['Harbor.and.Vine.S01E04.mkv', 'Harbor.and.Vine.S01E03.mkv']);
    add(result, ['Harbor.and.Vine.S01E01.mkv']);

    expect(rows(result).map((row) => row[1])).toEqual(['3', '4', '1']);
  });

  it('gives every row its own key', () => {
    const { result } = renderHook(() => useEpisodeList());

    add(result, ['Harbor.and.Vine.S01E01.mkv', 'Harbor.and.Vine.S01E02.mkv']);
    add(result, ['Harbor.and.Vine.S01E01.mkv']);

    const keys = result.current.episodes.map((row) => row.key);
    expect(new Set(keys).size).toBe(3);
  });
});

describe('useEpisodeList — edits', () => {
  function threeRows() {
    const hook = renderHook(() => useEpisodeList());
    add(hook.result, [
      'Harbor.and.Vine.S01E01.Pilot.mkv',
      'Harbor.and.Vine.S01E02.Low.Tide.mkv',
      'Harbor.and.Vine.S01E03.The.Night.Market.mkv',
    ]);
    return hook;
  }

  it('sets a row’s season', () => {
    const { result } = threeRows();
    const key = result.current.episodes[1].key;

    act(() => result.current.setSeason(key, '2'));

    expect(result.current.episodes[1].season).toBe('2');
  });

  it('sets a row’s number without re-sorting the list', () => {
    const { result } = threeRows();
    const key = result.current.episodes[0].key;

    act(() => result.current.setNumber(key, '9'));

    expect(rows(result).map((row) => [row[1], row[2]])).toEqual([
      ['9', 'Pilot'],
      ['2', 'Low Tide'],
      ['3', 'The Night Market'],
    ]);
  });

  it('sets a row’s title', () => {
    const { result } = threeRows();
    const key = result.current.episodes[2].key;

    act(() => result.current.setEpisodeTitle(key, 'The Long Night'));

    expect(result.current.episodes[2].title).toBe('The Long Night');
  });

  it('removes the row holding a key, and leaves the rest as they were', () => {
    const { result } = threeRows();
    const [first, second, third] = result.current.episodes;

    act(() => result.current.removeEpisode(second.key));

    expect(result.current.episodes).toEqual([first, third]);
  });
});

describe('useEpisodeList — episodesComplete', () => {
  it('is false for an empty list', () => {
    const { result } = renderHook(() => useEpisodeList());

    expect(result.current.episodesComplete).toBe(false);
  });

  it('is true for numbered rows with no pair twice', () => {
    const { result } = renderHook(() => useEpisodeList());

    add(result, [
      'Harbor.and.Vine.S01E01.mkv',
      'Harbor.and.Vine.S01E02.mkv',
      'Harbor.and.Vine.S02E01.mkv',
    ]);

    expect(result.current.episodesComplete).toBe(true);
  });

  it('is false while a number is blank', () => {
    const { result } = renderHook(() => useEpisodeList());
    add(result, ['Harbor.and.Vine.S01E01.mkv']);

    act(() => result.current.setNumber(result.current.episodes[0].key, ''));

    expect(result.current.episodesComplete).toBe(false);
  });

  it('is false while a season is blank', () => {
    const { result } = renderHook(() => useEpisodeList());
    add(result, ['Harbor.and.Vine.S01E01.mkv']);

    act(() => result.current.setSeason(result.current.episodes[0].key, ''));

    expect(result.current.episodesComplete).toBe(false);
  });

  it('is false for season 0', () => {
    const { result } = renderHook(() => useEpisodeList());
    add(result, ['Harbor.and.Vine.S01E01.mkv']);

    act(() => result.current.setSeason(result.current.episodes[0].key, '0'));

    expect(result.current.episodesComplete).toBe(false);
  });

  it('is false for episode 0', () => {
    const { result } = renderHook(() => useEpisodeList());
    add(result, ['Harbor.and.Vine.S01E01.mkv']);

    act(() => result.current.setNumber(result.current.episodes[0].key, '0'));

    expect(result.current.episodesComplete).toBe(false);
  });

  it('is false while two rows share a season and number', () => {
    const { result } = renderHook(() => useEpisodeList());
    add(result, ['Harbor.and.Vine.S01E01.mkv', 'Harbor.and.Vine.S01E02.mkv']);

    act(() => result.current.setNumber(result.current.episodes[1].key, '1'));

    expect(result.current.episodesComplete).toBe(false);
  });

  it('reads 01 and 1 as the same number', () => {
    const { result } = renderHook(() => useEpisodeList());
    add(result, ['Harbor.and.Vine.S01E01.mkv', 'Harbor.and.Vine.S01E02.mkv']);

    act(() => result.current.setNumber(result.current.episodes[1].key, '01'));

    expect(result.current.episodesComplete).toBe(false);
  });

  it('is true again once the duplicate is removed', () => {
    const { result } = renderHook(() => useEpisodeList());
    add(result, ['Harbor.and.Vine.S01E01.mkv', 'Harbor.and.Vine.S01E01.mkv']);
    expect(result.current.episodesComplete).toBe(false);

    act(() => result.current.removeEpisode(result.current.episodes[1].key));

    expect(result.current.episodesComplete).toBe(true);
  });
});
