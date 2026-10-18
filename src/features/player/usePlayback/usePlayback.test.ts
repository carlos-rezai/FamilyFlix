import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { usePlayback } from './usePlayback';
import type { VolumePreference } from '../volumePreference/volumePreference';
import type { AudioTrack, PlaybackRead } from '@/types';
import { stubMediaElement } from '@/test-support/stubMediaElement/stubMediaElement';
import { shippingSourcesMatching } from '@/test-support/shippingSources/shippingSources';

/**
 * 10 — Video player, Phase 3 (issue #85).
 *
 * The deep module of the frontend: every media-element edge case behind one
 * hook, so that nothing above it ever touches the element. What it hands back
 * is the **Absolute position** — seconds into the film itself — which on
 * **Direct play** is the element's own time and on a stream path will be the
 * **Stream offset** plus it. Every later consumer (the scrubber, the cue
 * lookup, the watch reporter) reads that one number and none of them learns
 * which path is playing.
 *
 * Only `direct` exists in this slice, so what is pinned here is the invariant
 * rather than the arithmetic: on direct play the offset is nought, and the
 * position the hook reports is the position the film is at.
 */

/**
 * The **Playback read** this hook is opened with. The duration is the file's,
 * to a fraction of a second, and it is the only duration in the feature: it is
 * what a seek clamps against and what the **Scrubber** draws, neither of which
 * has anywhere else to get it from.
 */
const DIRECT_PLAY: PlaybackRead = {
  path: 'direct',
  durationSeconds: 6832.5,
  audioTracks: [],
};

/**
 * Where the film's bytes come from, before any **Stream offset** is put on it.
 * The hook is handed the plain stream URL and answers with the one the element
 * should be pointed at, which on a stream path is this plus a `?t=`.
 */
const STREAM = '/api/movies/m1/stream';

function renderPlayback(
  read: PlaybackRead = DIRECT_PLAY,
  startAt = 0,
  startVolume?: VolumePreference,
  audioTrack: AudioTrack | null = null
) {
  const video = document.createElement('video');
  const ref = { current: video };
  const view = renderHook(() =>
    usePlayback({
      videoRef: ref,
      read,
      startAt,
      streamSrc: STREAM,
      startVolume,
      audioTrack,
    })
  );
  return { video, ...view };
}

/** Fire one of the element's own events, the way a browser would. */
function emit(video: HTMLMediaElement, type: string): void {
  act(() => {
    video.dispatchEvent(new Event(type));
  });
}

describe('usePlayback', () => {
  stubMediaElement();

  it('starts the film when the screen opens, without a second press', async () => {
    const { video, result } = renderPlayback();

    await waitFor(() => expect(result.current.playing).toBe(true));
    expect(video.paused).toBe(false);
  });

  it('pauses a playing film and resumes a paused one', async () => {
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(true));

    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.playing).toBe(false));
    expect(video.paused).toBe(true);

    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.playing).toBe(true));
    expect(video.paused).toBe(false);
  });

  it('reports the absolute position, which on direct play is the element’s own', async () => {
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(true));

    video.currentTime = 1840;
    emit(video, 'timeupdate');

    // Nought offset, so the two agree — and the number every consumer reads is
    // this one, not `video.currentTime`.
    expect(result.current.position).toBe(1840);
  });

  it('starts at the beginning of the film rather than at nothing', () => {
    const { result } = renderPlayback();

    expect(result.current.position).toBe(0);
  });

  it('reports the element waiting, and stops when it plays again', async () => {
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(true));

    emit(video, 'waiting');
    expect(result.current.buffering).toBe(true);

    emit(video, 'playing');
    expect(result.current.buffering).toBe(false);
  });

  it('is not buffering merely because it has just opened', async () => {
    const { result } = renderPlayback();

    await waitFor(() => expect(result.current.playing).toBe(true));
    expect(result.current.buffering).toBe(false);
  });

  it('knows when the film has finished', async () => {
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(true));

    emit(video, 'ended');

    expect(result.current.ended).toBe(true);
    expect(result.current.playing).toBe(false);
  });

  it('follows the element when something else pauses it', async () => {
    // The element is the truth, not our idea of it: a pause that did not come
    // through `toggle` — a keyboard media key, the OS — still has to leave the
    // big-play circle showing.
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(true));

    act(() => video.pause());

    expect(result.current.playing).toBe(false);
  });
});

describe('usePlayback — when the browser refuses to autoplay', () => {
  stubMediaElement({ autoplay: 'refused' });

  it('leaves the film stopped rather than failing silently', async () => {
    const { video, result } = renderPlayback();

    await waitFor(() => expect(video.paused).toBe(true));
    // Paused is what draws the big-play circle, which is the answer to a
    // refused autoplay — a black picture with no explanation is not.
    expect(result.current.playing).toBe(false);
  });

  it('starts on one press', async () => {
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(false));

    act(() => result.current.toggle());

    await waitFor(() => expect(result.current.playing).toBe(true));
    expect(video.paused).toBe(false);
  });

  it('does not leave the refusal as an unhandled rejection', async () => {
    // An uncaught `play()` rejection is an error in the console on every open
    // where a browser blocks autoplay, which is most of them.
    const rejections: unknown[] = [];
    const onRejection = (event: PromiseRejectionEvent) => {
      rejections.push(event.reason);
    };
    window.addEventListener('unhandledrejection', onRejection);

    const { result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(false));
    await new Promise((resolve) => setTimeout(resolve, 0));

    window.removeEventListener('unhandledrejection', onRejection);
    expect(rejections).toEqual([]);
  });
});

/**
 * 10 — Video player, Phase 4 (issue #86).
 *
 * Seeking joins the hook rather than the scrubber, for the reason the hook
 * exists: nothing above it touches the element. The **Scrubber** hands it an
 * **Absolute position** and learns nothing about which path is playing, and the
 * clamp at the far end uses the same duration the scrubber draws, because there
 * is only one — the **Playback read**'s.
 */
describe('usePlayback — seeking', () => {
  stubMediaElement();

  it('takes the film to the second it is given', async () => {
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(true));

    act(() => result.current.seek(1840));

    expect(video.currentTime).toBe(1840);
  });

  it('reports the film’s length from the playback read', () => {
    // Not `runtimeMinutes`, which is rounded and nullable, and not the
    // element's, which is `NaN` on a live transcode.
    const { result } = renderPlayback();

    expect(result.current.duration).toBe(6832.5);
  });

  it('cannot be taken past either end of the film', async () => {
    // A hand-thrown scalar, a knob overshot at the end of a drag, or a −10s at
    // four seconds in: all three arrive here, and none of them may leave the
    // element at a position the film does not have.
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(true));

    act(() => result.current.seek(-30));
    expect(video.currentTime).toBe(0);

    act(() => result.current.seek(99999));
    expect(video.currentTime).toBe(6832.5);
  });

  it('skips exactly ten seconds, in both directions', async () => {
    // Replaying a line of dialogue is the whole of what this is for, so ten
    // seconds means ten — not "about ten, after rounding".
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(true));
    video.currentTime = 600;
    emit(video, 'timeupdate');

    act(() => result.current.skip(-10));
    expect(video.currentTime).toBe(590);

    emit(video, 'timeupdate');
    act(() => result.current.skip(10));
    expect(video.currentTime).toBe(600);
  });

  it('clamps a skip at the start and at the end rather than refusing it', async () => {
    // Pressing −10s four seconds in goes to the beginning. Doing nothing at all
    // would read as a broken button.
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(true));
    video.currentTime = 4;
    emit(video, 'timeupdate');

    act(() => result.current.skip(-10));
    expect(video.currentTime).toBe(0);

    video.currentTime = 6830;
    emit(video, 'timeupdate');
    act(() => result.current.skip(10));
    expect(video.currentTime).toBe(6832.5);
  });

  it('skips from where the film is now, not from where it opened', async () => {
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(true));

    video.currentTime = 100;
    emit(video, 'timeupdate');
    act(() => result.current.skip(10));

    expect(video.currentTime).toBe(110);
  });
});

/**
 * Volume lives here for the same reason seeking does — it is element state, and
 * the hook is the one thing allowed to touch the element. What the family left
 * it at between films is `volumePreference`'s; applying that to an element is
 * this hook's, and the two meet at the level the film opens at.
 */
describe('usePlayback — volume and mute', () => {
  stubMediaElement();

  it('starts at the element’s full volume, unmuted', () => {
    const { result } = renderPlayback();

    expect(result.current.volume).toBe(1);
    expect(result.current.muted).toBe(false);
  });

  it('changes the volume across the whole range', async () => {
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(true));

    act(() => result.current.setVolume(0.4));
    expect(video.volume).toBeCloseTo(0.4);
    expect(result.current.volume).toBeCloseTo(0.4);

    act(() => result.current.setVolume(0));
    expect(video.volume).toBe(0);

    act(() => result.current.setVolume(1));
    expect(video.volume).toBe(1);
  });

  it('silences the film the moment mute is pressed', async () => {
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(true));

    act(() => result.current.toggleMute());

    expect(video.muted).toBe(true);
    expect(result.current.muted).toBe(true);
  });

  it('gives back the level it was at rather than jumping to full', async () => {
    // Unmuting a film that was turned down to a quarter and having it come back
    // at full volume is the version of this that wakes the house up.
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(true));
    act(() => result.current.setVolume(0.25));

    act(() => result.current.toggleMute());
    act(() => result.current.toggleMute());

    expect(video.muted).toBe(false);
    expect(video.volume).toBeCloseTo(0.25);
    expect(result.current.volume).toBeCloseTo(0.25);
  });

  it('follows the element when something else changes the volume', async () => {
    // The element is the truth here too: an operating-system volume key or a
    // second slider must leave the icon and the fill telling the truth.
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(true));

    act(() => {
      video.volume = 0.15;
      video.dispatchEvent(new Event('volumechange'));
    });

    expect(result.current.volume).toBeCloseTo(0.15);
  });
});

/**
 * The one rule the whole seeking design rests on, checked in the only place it
 * can be: the source. `video.duration` is `NaN` on a live transcode and a
 * rounded lie on a remux, so the **Playback read** is where a duration comes
 * from — and a single `.duration` read that crept back in would work perfectly
 * on direct play and fail only on the films the family actually owns.
 */
describe('the player feature’s duration rule', () => {
  it('reads no duration off the media element, anywhere in the feature', () => {
    // Comments are stripped before the match — prose about `video.duration` is
    // not a read of it.
    const offenders = shippingSourcesMatching(
      'src/features/player',
      /\.duration\b/
    );

    expect(offenders).toEqual([]);
  });
});

/**
 * 10 — Video player, Phase 5 (issue #87).
 *
 * The read side of the **Resume position**. It lands in this hook rather than
 * in the screen above for the reason the hook exists: winding a film to a
 * second before it starts is a media-element concern — it has to happen once,
 * before the first frame, and on a stream path it is the thing the **Stream
 * offset** will re-anchor against.
 *
 * Silently, per the design log: an in-progress film simply starts where it was
 * left, with no "Resume / Start over" dialog the prototype does not draw.
 */
describe('usePlayback — resuming', () => {
  stubMediaElement();

  it('starts an in-progress film where the family left it', async () => {
    const { video, result } = renderPlayback(DIRECT_PLAY, 1800);

    await waitFor(() => expect(result.current.playing).toBe(true));
    expect(video.currentTime).toBe(1800);
  });

  it('reports the resumed position rather than the beginning', () => {
    // Otherwise the **Scrubber** draws an empty bar for a frame before jumping,
    // which reads as the film having been lost.
    const { result } = renderPlayback(DIRECT_PLAY, 1800);

    expect(result.current.position).toBe(1800);
  });

  it('starts a film with nothing stored at the beginning', async () => {
    const { video, result } = renderPlayback(DIRECT_PLAY, 0);

    await waitFor(() => expect(result.current.playing).toBe(true));
    expect(video.currentTime).toBe(0);
  });

  it('winds the film to its position once, and never again', async () => {
    // The screen re-renders constantly — the position ticks ten times a second
    // — and a resume that re-applied would pin a film to the second it opened
    // at and make every seek snap back.
    const { video, result, rerender } = renderPlayback(DIRECT_PLAY, 1800);
    await waitFor(() => expect(result.current.playing).toBe(true));
    expect(video.currentTime).toBe(1800);

    act(() => result.current.seek(2400));
    rerender();

    expect(video.currentTime).toBe(2400);
  });
});

/**
 * 10 — Video player, Phase 7 (second slice): "seeking on a stream path"
 * (issue #90).
 *
 * The invariant this hook was built around finally gets a caller. On a
 * **Remux** or a **Transcode** there are no byte ranges and no known length, so
 * a seek cannot be a write to `currentTime`: it re-points the element at a new
 * **Stream offset**, ffmpeg restarts there, and the element comes back at zero
 * knowing nothing about where in the film it is.
 *
 * What the hook reports through all of that is the one number every consumer
 * already reads:
 *
 * > **Absolute position = Stream offset + Element time**
 *
 * Nothing above the hook learns which path is playing, which is why the
 * scrubber, the overlay and the reporter do not change in this slice.
 */
describe('usePlayback — seeking a film that is being converted', () => {
  stubMediaElement();

  /** A film whose container alone was wrong: a live stream, started at a `t`. */
  const REMUX: PlaybackRead = {
    path: 'remux',
    durationSeconds: 5391.2,
    audioTracks: [],
  };

  /**
   * The **Stream offset** a source carries, in seconds — nought for a URL with
   * no `?t=` on it. The invariant is about the number, not about how the URL is
   * spelled, so this is what the assertions below read.
   */
  function offsetOf(src: string): number {
    const query = src.slice(src.indexOf('?') + 1);
    const t = new URLSearchParams(src.includes('?') ? query : '').get('t');
    return t === null ? 0 : Number(t);
  }

  it('re-points the source at the second the family let go of the knob', async () => {
    // The one place the wire contract is spelled out: this is the URL the
    // stream route parses a `?t=` out of.
    const { result } = renderPlayback(REMUX);
    await waitFor(() => expect(result.current.playing).toBe(true));

    act(() => result.current.seek(1200));

    expect(result.current.src).toBe(`${STREAM}?t=1200`);
  });

  it('does not wind the element, which has no such second in it', async () => {
    // `currentTime = 1200` on a live stream is either ignored or an error: the
    // element was handed a film that starts where the conversion started, and
    // it holds nothing before that.
    const { video, result } = renderPlayback(REMUX);
    await waitFor(() => expect(result.current.playing).toBe(true));

    act(() => result.current.seek(1200));

    expect(video.currentTime).toBe(0);
  });

  it('reports the second that was asked for straight away', async () => {
    // Before the restarted stream has fired anything. A position that fell back
    // to nought for even a frame would take the **Scrubber** to the start of
    // the film and write that second down as where the family was watching.
    const { video, result } = renderPlayback(REMUX);
    await waitFor(() => expect(result.current.playing).toBe(true));
    video.currentTime = 45;
    emit(video, 'timeupdate');
    expect(result.current.position).toBe(45);

    act(() => result.current.seek(1200));

    expect(result.current.position).toBe(1200);
  });

  it('adds the element’s own time to the offset as the film runs on', async () => {
    // The invariant itself: the element is 45 seconds into a stream that began
    // 1200 seconds into the film, and what the screen shows is 1245.
    const { video, result } = renderPlayback(REMUX);
    await waitFor(() => expect(result.current.playing).toBe(true));
    act(() => result.current.seek(1200));

    video.currentTime = 45;
    emit(video, 'timeupdate');

    expect(result.current.position).toBe(1245);
  });

  it('skips ten seconds from where the film is, not from where the stream is', async () => {
    // A −10s at 1245 has to land at 1235 of the *film*. Reading the element
    // alone would take it to nought and start the whole conversion again.
    const { video, result } = renderPlayback(REMUX);
    await waitFor(() => expect(result.current.playing).toBe(true));
    act(() => result.current.seek(1200));
    video.currentTime = 45;
    emit(video, 'timeupdate');

    act(() => result.current.skip(-10));

    expect(offsetOf(result.current.src)).toBe(1235);
    expect(result.current.position).toBe(1235);
  });

  it('answers with the second it landed on, which is what the watch tick is written from', async () => {
    // The screen passes this straight to `reportSeek`: the position the hook
    // reports has not caught up at the moment the knob is let go, so a reporter
    // reading it would store the second the film was at before it moved.
    const { result } = renderPlayback(REMUX);
    await waitFor(() => expect(result.current.playing).toBe(true));

    let landed = 0;
    act(() => {
      landed = result.current.seek(1200);
    });

    expect(landed).toBe(1200);
  });

  it('cannot be taken past either end of the film', async () => {
    // The same clamp direct play has, against the same duration — the
    // **Playback read**'s, which is the only length either path has.
    const { result } = renderPlayback(REMUX);
    await waitFor(() => expect(result.current.playing).toBe(true));

    act(() => result.current.seek(99999));
    expect(offsetOf(result.current.src)).toBe(5391.2);
    expect(result.current.position).toBe(5391.2);

    act(() => result.current.seek(-30));
    expect(offsetOf(result.current.src)).toBe(0);
    expect(result.current.position).toBe(0);
  });

  it('opens an in-progress film at its resume position rather than winding to it', async () => {
    // The same re-anchoring, on the way in. Winding the element is a no-op on a
    // live stream, so a film left an hour in would silently start again from
    // the beginning — the exact thing the **Resume position** exists to prevent.
    const { video, result } = renderPlayback(REMUX, 1800);

    await waitFor(() => expect(offsetOf(result.current.src)).toBe(1800));
    expect(result.current.position).toBe(1800);
    expect(video.currentTime).toBe(0);
  });

  it('leaves direct play seeking the way it always has', async () => {
    // The common case changes in nothing: the element is wound, the source is
    // never re-pointed, and no `?t=` is ever put on it.
    const { video, result } = renderPlayback(DIRECT_PLAY);
    await waitFor(() => expect(result.current.playing).toBe(true));

    act(() => result.current.seek(1200));

    expect(video.currentTime).toBe(1200);
    expect(result.current.src).toBe(STREAM);
    expect(result.current.position).toBe(1200);
  });
});

/**
 * 10 — Video player, Phase 8 (issue #91).
 *
 * The level the film opens at. Where it comes from is `volumePreference`'s
 * question — a per-machine preference in `localStorage`, and every hostile
 * answer that key can give is pinned there. What is pinned here is the half
 * only this hook can do: putting it on the element, once, on the way in.
 *
 * It is the same shape as the **Resume position** and for the same reason.
 * Both are a number that arrives from outside and has to reach the element
 * exactly once: an opening level re-applied on every render would pin the film
 * to it and make the slider snap back under the hand dragging it.
 */
describe('usePlayback — the level the film opens at', () => {
  stubMediaElement();

  it('opens at the level the family left the last film at', async () => {
    const { video, result } = renderPlayback(DIRECT_PLAY, 0, {
      volume: 0.3,
      muted: false,
    });

    await waitFor(() => expect(video.volume).toBeCloseTo(0.3));
    expect(result.current.volume).toBeCloseTo(0.3);
  });

  it('opens silenced if that is how the last film was left', async () => {
    // Muted with a level underneath, so the first press of unmute gives back
    // the quarter it was at rather than waking the house up.
    const { video, result } = renderPlayback(DIRECT_PLAY, 0, {
      volume: 0.25,
      muted: true,
    });

    await waitFor(() => expect(video.muted).toBe(true));
    expect(result.current.muted).toBe(true);
    expect(video.volume).toBeCloseTo(0.25);
  });

  it('opens at full volume, unmuted, when it is handed nothing', async () => {
    // The state of a machine that has never played a film — and the state a
    // refused or nonsense `localStorage` has to come back as.
    const { video, result } = renderPlayback();

    await waitFor(() => expect(result.current.playing).toBe(true));

    expect(video.volume).toBe(1);
    expect(video.muted).toBe(false);
    expect(result.current.volume).toBe(1);
    expect(result.current.muted).toBe(false);
  });

  it('applies it once, and then leaves the volume alone', async () => {
    // Re-applying it on a later render would fight the slider: the level would
    // snap back to what the film opened at on the next thing that re-rendered
    // this screen, which is the position ticking ten times a second.
    const { video, result, rerender } = renderPlayback(DIRECT_PLAY, 0, {
      volume: 0.3,
      muted: false,
    });
    await waitFor(() => expect(video.volume).toBeCloseTo(0.3));

    act(() => result.current.setVolume(0.8));
    rerender();

    expect(video.volume).toBeCloseTo(0.8);
    expect(result.current.volume).toBeCloseTo(0.8);
  });
});

/**
 * 10 — Video player: "a conversion that fails to start" (issue #96).
 *
 * A **Failed conversion** is invisible from inside this hook — the element was
 * pointed at a stream, and what came back was a refusal rather than a picture.
 * The one thing the element does say is `error`, and until now nothing listened
 * for it: the hook stayed `buffering` and the screen said **Getting this film
 * ready…** for the rest of the evening.
 *
 * `failed` is the element's own report, exactly as `playing` and `buffering`
 * are. It is deliberately not "the stream 500'd": a direct-play file whose
 * bytes stop mid-film reaches the element the same way, and the family is owed
 * the same sentence either way.
 */
describe('usePlayback — a film the element could not start', () => {
  stubMediaElement();

  /** A film arriving down a conversion, which is where this failure lives. */
  const REMUXED: PlaybackRead = {
    path: 'remux',
    durationSeconds: 5391.2,
    audioTracks: [],
  };

  it('reports the failure the element reported', async () => {
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(true));

    emit(video, 'error');

    expect(result.current.failed).toBe(true);
  });

  it('stops waiting for bytes that are not coming', async () => {
    // The whole defect in two lines: the element was waiting, and then the
    // stream refused. A hook that stayed `buffering` here is a spinner that
    // never stops.
    const { video, result } = renderPlayback();
    await waitFor(() => expect(result.current.playing).toBe(true));
    emit(video, 'waiting');
    expect(result.current.buffering).toBe(true);

    emit(video, 'error');

    expect(result.current.buffering).toBe(false);
    expect(result.current.failed).toBe(true);
  });

  it('has not failed merely because it has just opened', async () => {
    const { result } = renderPlayback();

    await waitFor(() => expect(result.current.playing).toBe(true));

    expect(result.current.failed).toBe(false);
  });

  it('reports it on a converted film the same way, whatever the offset', async () => {
    // A stream path is where this actually happens — the conversion is what
    // fails to start — and a film that failed an hour in must not be reported
    // as one that never opened.
    const { video, result } = renderPlayback(REMUXED, 0);
    await waitFor(() => expect(result.current.playing).toBe(true));
    act(() => {
      result.current.seek(3600);
    });

    emit(video, 'error');

    expect(result.current.failed).toBe(true);
    expect(result.current.position).toBeCloseTo(3600);
  });
});

/**
 * 46 — Audio tracks, Phase 4: "the opening" (issue #402).
 *
 * The hook is handed the **Audio track** the player opens on. Its path is the
 * track's own — index 1 of a native MP4 is a **Remux** though the read says
 * `direct` for index 0 — and the source carries `?a=` only when the index is
 * not nought, so a single-track film's URL is the one it has always been.
 * `null` is a file with no track to offer, which plays on the read's path.
 */
describe('usePlayback — the audio track it opens on', () => {
  stubMediaElement();

  /** A native MP4: index 0 plays direct, index 1 is remuxed to map it. */
  const ENGLISH_FIRST: PlaybackRead = {
    path: 'direct',
    durationSeconds: 6832.5,
    audioTracks: [
      {
        index: 0,
        language: 'English',
        label: 'English',
        fileDefault: true,
        path: 'direct',
      },
      {
        index: 1,
        language: 'Spanish',
        label: 'Spanish',
        fileDefault: false,
        path: 'remux',
      },
    ],
  };
  const [, SPANISH] = ENGLISH_FIRST.audioTracks;

  /** The query a source carries, read as parameters rather than spelled. */
  function queryOf(src: string): URLSearchParams {
    return new URLSearchParams(src.includes('?') ? src.split('?')[1] : '');
  }

  it('carries the index as a = for any other track', async () => {
    const { result } = renderPlayback(ENGLISH_FIRST, 0, undefined, SPANISH);
    await waitFor(() => expect(result.current.playing).toBe(true));

    expect(result.current.src).toBe(`${STREAM}?a=1`);
  });

  it('plays on the track’s own path, not the read’s', async () => {
    // Index 1 is a remux, so a seek re-points the stream — still on track 1 —
    // rather than winding an element that holds no such track.
    const { video, result } = renderPlayback(
      ENGLISH_FIRST,
      0,
      undefined,
      SPANISH
    );
    await waitFor(() => expect(result.current.playing).toBe(true));

    act(() => result.current.seek(1200));

    const query = queryOf(result.current.src);
    expect(query.get('t')).toBe('1200');
    expect(query.get('a')).toBe('1');
    expect(video.currentTime).toBe(0);
    expect(result.current.position).toBe(1200);
  });

  it('resumes at the saved position on the chosen track', async () => {
    const { video, result } = renderPlayback(
      ENGLISH_FIRST,
      1800,
      undefined,
      SPANISH
    );

    await waitFor(() =>
      expect(queryOf(result.current.src).get('t')).toBe('1800')
    );
    expect(queryOf(result.current.src).get('a')).toBe('1');
    expect(result.current.position).toBe(1800);
    expect(video.currentTime).toBe(0);
  });
});

/**
 * 46 — Audio tracks, Phase 5: "the picker" (issue #403).
 *
 * A switch of **Audio track** mid-film, handed to the hook as a new
 * `audioTrack`. It keeps the **Absolute position** either way:
 *
 * - onto a **streaming** path it is `anchorStream(absolute())` with the new
 *   `a` — the source re-pointed at the second the film is at;
 * - onto **direct** it drops the **Stream offset** and winds `currentTime` to
 *   the position once the element has metadata — not before, when the element
 *   has nothing to wind.
 *
 * The buffering circle is the only feedback while the new source loads, and a
 * paused film stays paused.
 */
describe('usePlayback — switching audio track mid-film', () => {
  stubMediaElement();

  const ENGLISH: AudioTrack = {
    index: 0,
    language: 'English',
    label: 'English',
    fileDefault: true,
    path: 'direct',
  };
  const SPANISH: AudioTrack = {
    index: 1,
    language: 'Spanish',
    label: 'Spanish',
    fileDefault: false,
    path: 'remux',
  };
  const COMMENTARY: AudioTrack = {
    index: 2,
    language: null,
    label: 'Commentary',
    fileDefault: false,
    path: 'transcode',
  };

  /** A native MP4 with three tracks: only index 0 plays direct. */
  const NATIVE: PlaybackRead = {
    path: 'direct',
    durationSeconds: 6832.5,
    audioTracks: [ENGLISH, SPANISH, COMMENTARY],
  };

  function queryOf(src: string): URLSearchParams {
    return new URLSearchParams(src.includes('?') ? src.split('?')[1] : '');
  }

  function renderSwitchable(audioTrack: AudioTrack) {
    const video = document.createElement('video');
    const ref = { current: video };
    const view = renderHook(
      ({ track }: { track: AudioTrack }) =>
        usePlayback({
          videoRef: ref,
          read: NATIVE,
          startAt: 0,
          streamSrc: STREAM,
          audioTrack: track,
        }),
      { initialProps: { track: audioTrack } }
    );
    return { video, ...view };
  }

  it('re-points a direct film at its position with the new a, onto a streaming track', async () => {
    const { video, result, rerender } = renderSwitchable(ENGLISH);
    await waitFor(() => expect(result.current.playing).toBe(true));
    video.currentTime = 1234;
    emit(video, 'timeupdate');

    rerender({ track: SPANISH });

    const query = queryOf(result.current.src);
    expect(result.current.src.split('?')[0]).toBe(STREAM);
    expect(query.get('t')).toBe('1234');
    expect(query.get('a')).toBe('1');
    expect(result.current.position).toBe(1234);

    // And a seek after it re-points again, still on the chosen track.
    act(() => result.current.seek(2000));
    const after = queryOf(result.current.src);
    expect(after.get('t')).toBe('2000');
    expect(after.get('a')).toBe('1');
  });

  it('re-points a streaming film at its Absolute position, offset and element time together', async () => {
    const { video, result, rerender } = renderSwitchable(SPANISH);
    await waitFor(() => expect(result.current.playing).toBe(true));
    act(() => result.current.seek(1200));
    video.currentTime = 30;
    emit(video, 'timeupdate');
    expect(result.current.position).toBe(1230);

    rerender({ track: COMMENTARY });

    const query = queryOf(result.current.src);
    expect(query.get('t')).toBe('1230');
    expect(query.get('a')).toBe('2');
    expect(result.current.position).toBe(1230);
  });

  it('drops the offset onto the first track of a native file, and writes no a', async () => {
    const { video, result, rerender } = renderSwitchable(SPANISH);
    await waitFor(() => expect(result.current.playing).toBe(true));
    act(() => result.current.seek(1200));
    video.currentTime = 30;
    emit(video, 'timeupdate');

    rerender({ track: ENGLISH });

    expect(result.current.src).toBe(STREAM);
    expect(result.current.position).toBe(1230);
  });

  it('winds the element to the position once its metadata lands, onto direct', async () => {
    const { video, result, rerender } = renderSwitchable(SPANISH);
    await waitFor(() => expect(result.current.playing).toBe(true));
    act(() => result.current.seek(1200));
    video.currentTime = 30;
    emit(video, 'timeupdate');

    rerender({ track: ENGLISH });
    // The new source starts at its own beginning, as a browser's load does.
    video.currentTime = 0;
    emit(video, 'loadedmetadata');

    expect(video.currentTime).toBe(1230);
    expect(result.current.position).toBe(1230);
  });

  it('seeks by winding the element after a switch onto direct, re-pointing nothing', async () => {
    const { video, result, rerender } = renderSwitchable(SPANISH);
    await waitFor(() => expect(result.current.playing).toBe(true));
    act(() => result.current.seek(1200));

    rerender({ track: ENGLISH });
    video.currentTime = 0;
    emit(video, 'loadedmetadata');
    act(() => result.current.seek(2000));

    expect(result.current.src).toBe(STREAM);
    expect(video.currentTime).toBe(2000);
    expect(result.current.position).toBe(2000);
  });

  it('shows the buffering circle while the new track loads, until it plays', async () => {
    const { video, result, rerender } = renderSwitchable(ENGLISH);
    await waitFor(() => expect(result.current.playing).toBe(true));
    expect(result.current.buffering).toBe(false);

    rerender({ track: SPANISH });

    expect(result.current.buffering).toBe(true);

    emit(video, 'playing');

    expect(result.current.buffering).toBe(false);
  });

  it('keeps a paused film paused across a switch onto direct, wound and done buffering', async () => {
    const { video, result, rerender } = renderSwitchable(SPANISH);
    await waitFor(() => expect(result.current.playing).toBe(true));
    act(() => result.current.seek(1200));
    act(() => result.current.toggle());
    expect(result.current.playing).toBe(false);
    const play = vi.spyOn(video, 'play');

    rerender({ track: ENGLISH });
    video.currentTime = 0;
    emit(video, 'loadedmetadata');
    emit(video, 'loadeddata');
    emit(video, 'canplay');

    expect(play).not.toHaveBeenCalled();
    expect(video.paused).toBe(true);
    expect(result.current.playing).toBe(false);
    expect(video.currentTime).toBe(1200);
    expect(result.current.buffering).toBe(false);
  });
});
