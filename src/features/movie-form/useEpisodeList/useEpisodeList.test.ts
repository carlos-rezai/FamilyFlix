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

/**
 * 29 — Add a series, Phase 4 (issue #264): each row's own **Subtitles**.
 *
 * The movie subtitles' rule, held per row: a picked file is a track in
 * English until the maintainer says otherwise, its language can be changed
 * and the track removed — each by the row's key and the track's own key, so
 * no edit ever reaches another row's tracks.
 */
describe('useEpisodeList — a row’s subtitles', () => {
  const subtitle = (name: string) =>
    new File(['cue bytes'], name, { type: 'text/plain' });

  function twoRows() {
    const hook = renderHook(() => useEpisodeList());
    add(hook.result, [
      'Harbor.and.Vine.S01E01.Pilot.mkv',
      'Harbor.and.Vine.S01E02.Low.Tide.mkv',
    ]);
    return hook;
  }

  const keyOf = (
    result: { current: ReturnType<typeof useEpisodeList> },
    index: number
  ) => result.current.episodes[index].key;

  /** One row's tracks as `[filename, language]`, in the order held. */
  const tracks = (
    result: { current: ReturnType<typeof useEpisodeList> },
    index: number
  ) =>
    result.current.episodes[index].subtitles.map((track) => [
      track.file.filename,
      track.language,
    ]);

  it('adds a track to a row, in English by default, as a picked file', () => {
    const { result } = twoRows();
    const file = subtitle('S01E01.srt');

    act(() => {
      result.current.addEpisodeSubtitle(keyOf(result, 0), file);
    });

    expect(tracks(result, 0)).toEqual([['S01E01.srt', 'English']]);
    expect(result.current.episodes[0].subtitles[0].file).toEqual({
      kind: 'picked',
      file,
      filename: 'S01E01.srt',
    });
  });

  it('appends a second track after the first', () => {
    const { result } = twoRows();
    const key = keyOf(result, 0);

    act(() => {
      result.current.addEpisodeSubtitle(key, subtitle('S01E01.en.srt'));
    });
    act(() => {
      result.current.addEpisodeSubtitle(key, subtitle('S01E01.pt.srt'));
    });

    expect(tracks(result, 0)).toEqual([
      ['S01E01.en.srt', 'English'],
      ['S01E01.pt.srt', 'English'],
    ]);
    const [first, second] = result.current.episodes[0].subtitles;
    expect(first.key).not.toBe(second.key);
  });

  it('leaves the other rows’ tracks alone when one row gains a track', () => {
    const { result } = twoRows();

    act(() => {
      result.current.addEpisodeSubtitle(keyOf(result, 0), subtitle('a.srt'));
    });

    expect(tracks(result, 1)).toEqual([]);
  });

  it('changes one track’s language, and no other', () => {
    const { result } = twoRows();
    act(() => {
      result.current.addEpisodeSubtitle(keyOf(result, 0), subtitle('a.srt'));
      result.current.addEpisodeSubtitle(keyOf(result, 0), subtitle('b.srt'));
      result.current.addEpisodeSubtitle(keyOf(result, 1), subtitle('c.srt'));
    });
    const target = result.current.episodes[0].subtitles[1].key;

    act(() => {
      result.current.changeEpisodeSubtitleLanguage(
        keyOf(result, 0),
        target,
        'Portuguese'
      );
    });

    expect(tracks(result, 0)).toEqual([
      ['a.srt', 'English'],
      ['b.srt', 'Portuguese'],
    ]);
    expect(tracks(result, 1)).toEqual([['c.srt', 'English']]);
  });

  it('removes one track, and leaves the rest of every row as it was', () => {
    const { result } = twoRows();
    act(() => {
      result.current.addEpisodeSubtitle(keyOf(result, 0), subtitle('a.srt'));
      result.current.addEpisodeSubtitle(keyOf(result, 0), subtitle('b.srt'));
      result.current.addEpisodeSubtitle(keyOf(result, 1), subtitle('c.srt'));
    });
    const target = result.current.episodes[0].subtitles[0].key;

    act(() => {
      result.current.removeEpisodeSubtitle(keyOf(result, 0), target);
    });

    expect(tracks(result, 0)).toEqual([['b.srt', 'English']]);
    expect(tracks(result, 1)).toEqual([['c.srt', 'English']]);
    expect(rows(result)).toEqual([
      ['1', '1', 'Pilot', 'Harbor.and.Vine.S01E01.Pilot.mkv'],
      ['1', '2', 'Low Tide', 'Harbor.and.Vine.S01E02.Low.Tide.mkv'],
    ]);
  });

  it('keeps a row’s season, number and title through its track edits', () => {
    const { result } = twoRows();
    const key = keyOf(result, 1);
    act(() => {
      result.current.setEpisodeTitle(key, 'The Low Tide');
    });

    act(() => {
      result.current.addEpisodeSubtitle(key, subtitle('c.srt'));
    });

    expect(rows(result)[1]).toEqual([
      '1',
      '2',
      'The Low Tide',
      'Harbor.and.Vine.S01E02.Low.Tide.mkv',
    ]);
  });
});
