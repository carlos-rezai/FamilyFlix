// @vitest-environment node
//
// 60, Rebuild edges, Phase 13 (issue #576): one refusal for a held video.
//
// `heldVideoRefusal(storage, placed)` is the **Held video** rule's route-layer
// sentence, shared by the movie add and the series add: given the placed
// videos, the `409` sentence _<Title> already plays this file._ naming the
// holder of the first placed video a held title plays, film or series, or
// `null` when none is held. A copied video (`null`) and a stored one (no
// Library folder) are never held.

import { describe, expect, it } from 'vitest';

import { heldVideoRefusal } from './heldVideoRefusal';
import type { HeldTitle } from '../../library';
import type { Movie, Series, StoredVideo } from '@/types';

/**
 * A fake storage holding `Heat` (a film) and `Tidewater` (a series), each
 * playing one video under the Library folder `shows`.
 */
function fakeStorage() {
  const held = new Map<string, HeldTitle>([
    ['shows|Heat (1995)/Heat.1995.mp4', { kind: 'movie', id: 'heat' }],
    [
      'shows|Tidewater (2018)/Season 01/Tidewater.S01E01.mp4',
      { kind: 'series', id: 'tidewater' },
    ],
  ]);
  return {
    titleHolding: (folderId: string, videoPath: string): HeldTitle | null =>
      held.get(`${folderId}|${videoPath}`) ?? null,
    getMovie: (id: string): Movie | null =>
      id === 'heat' ? ({ id, title: 'Heat' } as Movie) : null,
    getSeries: (id: string): Series | null =>
      id === 'tidewater' ? ({ id, title: 'Tidewater' } as Series) : null,
  };
}

const linked = (videoPath: string): StoredVideo => ({
  videoPath,
  videoFolderId: 'shows',
});

describe('heldVideoRefusal', () => {
  it('is null for videos no title plays', () => {
    expect(
      heldVideoRefusal(fakeStorage(), [
        linked('Ronin (1998)/Ronin.1998.mp4'),
        linked('Tidewater (2018)/Season 01/Tidewater.S01E02.mp4'),
      ])
    ).toBeNull();
  });

  it('is null for copied and stored videos', () => {
    expect(
      heldVideoRefusal(fakeStorage(), [
        null,
        { videoPath: 'Heat (1995)/Heat.1995.mp4', videoFolderId: null },
      ])
    ).toBeNull();
  });

  it('is null for no videos', () => {
    expect(heldVideoRefusal(fakeStorage(), [])).toBeNull();
  });

  it('names the film that plays a held video', () => {
    expect(
      heldVideoRefusal(fakeStorage(), [linked('Heat (1995)/Heat.1995.mp4')])
    ).toBe('Heat already plays this file.');
  });

  it('names the series that plays a held episode video', () => {
    expect(
      heldVideoRefusal(fakeStorage(), [
        null,
        linked('Tidewater (2018)/Season 01/Tidewater.S01E02.mp4'),
        linked('Tidewater (2018)/Season 01/Tidewater.S01E01.mp4'),
      ])
    ).toBe('Tidewater already plays this file.');
  });

  it('names the holder of the first held video when several are held', () => {
    expect(
      heldVideoRefusal(fakeStorage(), [
        linked('Tidewater (2018)/Season 01/Tidewater.S01E01.mp4'),
        linked('Heat (1995)/Heat.1995.mp4'),
      ])
    ).toBe('Tidewater already plays this file.');
    expect(
      heldVideoRefusal(fakeStorage(), [
        linked('Heat (1995)/Heat.1995.mp4'),
        linked('Tidewater (2018)/Season 01/Tidewater.S01E01.mp4'),
      ])
    ).toBe('Heat already plays this file.');
  });
});
