import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useAudioTracks } from './useAudioTracks';
import type { AudioTrack } from '@/types';

/**
 * 46 — Audio tracks, Phase 5: "the picker" (issue #403).
 *
 * The **Audio picker**'s state: the offered **Audio tracks**, the one playing,
 * `choose(track)` for a press on the menu, and `next()` for the `a` key,
 * wrapping from the last track back to the first. It opens on the track
 * `preferredAudio` picks for the language it is handed, and every pick made by
 * hand — a press or the key — is reported up as the **Audio choice**: that
 * track's language, `null` for a track with none.
 *
 * Asserted through what the hook hands back and what it reports, never through
 * how it holds the pick.
 */

function track(overrides: Partial<AudioTrack>): AudioTrack {
  return {
    index: 0,
    language: 'English',
    label: 'English',
    fileDefault: false,
    path: 'direct',
    ...overrides,
  };
}

const ENGLISH = track({ index: 0, fileDefault: true });
const SPANISH = track({
  index: 1,
  language: 'Spanish',
  label: 'Spanish',
  path: 'remux',
});
const COMMENTARY = track({
  index: 2,
  language: null,
  label: 'Commentary',
  path: 'transcode',
});

const THREE = [ENGLISH, SPANISH, COMMENTARY];

type Options = Parameters<typeof useAudioTracks>[0];

function renderTracks(overrides: Partial<Options> = {}) {
  const onChoice = vi.fn<(language: string | null) => void>();
  const view = renderHook((props: Options) => useAudioTracks(props), {
    initialProps: {
      tracks: THREE,
      language: 'English',
      onChoice,
      ...overrides,
    } as Options,
  });
  return { ...view, onChoice };
}

describe('useAudioTracks — the track it opens on', () => {
  it('opens on the track in the language it is handed', () => {
    const { result } = renderTracks({ language: 'Spanish' });

    expect(result.current.playing).toEqual(SPANISH);
  });

  it('opens on the file’s default when no track speaks the language', () => {
    const { result } = renderTracks({ language: 'Japanese' });

    expect(result.current.playing).toEqual(ENGLISH);
  });

  it('hands back every offered track, in index order', () => {
    const { result } = renderTracks();

    expect(result.current.tracks).toEqual(THREE);
  });

  it('plays nothing for a film with no track to offer', () => {
    const { result } = renderTracks({ tracks: [] });

    expect(result.current.tracks).toEqual([]);
    expect(result.current.playing).toBeNull();
  });

  it('opens on the preferred track once the tracks arrive late', () => {
    // The Playback read lands after the screen mounts: the hook is first
    // handed nothing, then the tracks.
    const { result, rerender, onChoice } = renderTracks({ tracks: [] });

    rerender({ tracks: THREE, language: 'Spanish', onChoice });

    expect(result.current.playing).toEqual(SPANISH);
  });

  it('reports nothing for the track it opens on, which nobody picked', () => {
    const { onChoice } = renderTracks({ language: 'Spanish' });

    expect(onChoice).not.toHaveBeenCalled();
  });
});

describe('useAudioTracks — choosing', () => {
  it('plays the track chosen', () => {
    const { result } = renderTracks();

    act(() => result.current.choose(COMMENTARY));

    expect(result.current.playing).toEqual(COMMENTARY);
  });

  it('reports a pick by hand up as the Audio choice, its language', () => {
    const { result, onChoice } = renderTracks();

    act(() => result.current.choose(SPANISH));

    expect(onChoice).toHaveBeenCalledTimes(1);
    expect(onChoice).toHaveBeenLastCalledWith('Spanish');
  });

  it('reports a track with no language as a null Audio choice', () => {
    const { result, onChoice } = renderTracks();

    act(() => result.current.choose(COMMENTARY));

    expect(onChoice).toHaveBeenLastCalledWith(null);
  });

  it('keeps the chosen track when the language it was handed changes', () => {
    const { result, rerender, onChoice } = renderTracks();

    act(() => result.current.choose(COMMENTARY));
    rerender({ tracks: THREE, language: 'Spanish', onChoice });

    expect(result.current.playing).toEqual(COMMENTARY);
  });
});

describe('useAudioTracks — the next track', () => {
  it('moves to the next track in index order', () => {
    const { result } = renderTracks();

    act(() => result.current.next());

    expect(result.current.playing).toEqual(SPANISH);
  });

  it('wraps from the last track back to the first', () => {
    const { result } = renderTracks();

    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.playing).toEqual(COMMENTARY);

    act(() => result.current.next());

    expect(result.current.playing).toEqual(ENGLISH);
  });

  it('moves on from the track playing, not from the first', () => {
    const { result } = renderTracks({ language: 'Spanish' });

    act(() => result.current.next());

    expect(result.current.playing).toEqual(COMMENTARY);
  });

  it('reports the key’s pick as the Audio choice too, being a pick by hand', () => {
    const { result, onChoice } = renderTracks();

    act(() => result.current.next());

    expect(onChoice).toHaveBeenLastCalledWith('Spanish');
  });

  it('does nothing for a film with no track to offer', () => {
    const { result, onChoice } = renderTracks({ tracks: [] });

    expect(() => act(() => result.current.next())).not.toThrow();
    expect(result.current.playing).toBeNull();
    expect(onChoice).not.toHaveBeenCalled();
  });
});

describe('useAudioTracks — the Audio picker’s rule', () => {
  it('is no picker for a film with no track to offer', () => {
    const { result } = renderTracks({ tracks: [] });

    expect(result.current.hasAudioTracks).toBe(false);
  });

  it('is no picker for a film with one track', () => {
    const { result } = renderTracks({ tracks: [ENGLISH] });

    expect(result.current.hasAudioTracks).toBe(false);
  });

  it('is a picker for a film with two tracks', () => {
    const { result } = renderTracks({ tracks: [ENGLISH, SPANISH] });

    expect(result.current.hasAudioTracks).toBe(true);
  });
});
