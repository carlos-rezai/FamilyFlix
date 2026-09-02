// @vitest-environment node
//
// 10 — Video player, Phase 7: "the FFmpeg pipeline" (issue #89).
//
// The whole format policy, and the cheapest thing in the backend to test: a
// probe in, a decision and an argv out, no filesystem and no child process. The
// PRD calls this the deep module of the backend for exactly that reason — the
// riskiest logic in the slice is the logic a unit test can pin completely.
//
// Nothing here spawns anything, and nothing here can: the function has no I/O
// to do. The **Playback component**'s availability arrives as a value, which is
// what lets the no-component matrix be asserted on a machine that has FFmpeg
// installed and on one that does not — CI being the second kind.

import { describe, expect, it } from 'vitest';

import {
  choosePlaybackPath,
  type ComponentAvailability,
  type PlaybackDecision,
} from './choosePlaybackPath';
import type { MediaProbe } from '../probe/probe';

/** The film being decided about — absolute, and already containment-checked. */
const MKV = '/media/Northwind (2018)/northwind.mkv';
const MP4 = '/media/Northwind (2018)/northwind.mp4';
const AVI = '/media/Northwind (2018)/northwind.avi';

/** A machine with a component and no hardware encoder — the common case. */
const SOFTWARE: ComponentAvailability = {
  available: true,
  hardwareEncoder: null,
};

/** A machine with nothing installed: the state the PRD makes first-class. */
const ABSENT: ComponentAvailability = {
  available: false,
  hardwareEncoder: null,
};

/**
 * A **ffprobe** read, defaulting to the one file Chromium needs no help with.
 * Each case overrides only the field its row of the matrix is about, so what a
 * test is testing is the only thing written down in it.
 */
function probeOf(partial: Partial<MediaProbe> = {}): MediaProbe {
  return {
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    durationSeconds: 5391.2,
    ...partial,
  };
}

function choose(
  file: string,
  probe: MediaProbe | null,
  component = SOFTWARE,
  offsetSeconds = 0
): PlaybackDecision {
  return choosePlaybackPath({ file, probe, component, offsetSeconds });
}

/**
 * The argv of a decision that has one. A decision that does not is a failure
 * rather than an empty array — `direct` and `cannot-play` run nothing, and an
 * assertion about the arguments of a path that spawns nothing would otherwise
 * pass for the wrong reason.
 */
function argvOf(decision: PlaybackDecision): string[] {
  if (decision.path === 'direct' || decision.path === 'cannot-play') {
    throw new Error(`${decision.path} runs nothing, so it has no argv`);
  }
  return decision.args;
}

describe('choosePlaybackPath — a file Chromium already reads', () => {
  it('sends an MP4 of H.264 and AAC out untouched', () => {
    // The cheapest path there is, and the one most of a modern library takes:
    // nothing is spawned, and the element seeks by byte range.
    expect(choose(MP4, probeOf()).path).toBe('direct');
  });

  it('runs nothing at all, so there is no argv to get wrong', () => {
    expect(choose(MP4, probeOf())).not.toHaveProperty('args');
  });
});

describe('choosePlaybackPath — only the container is wrong', () => {
  it('rewraps an MKV of H.264 and AAC rather than re-encoding it', () => {
    // The commonest file in the family folder, and the row where the difference
    // between the two converting paths actually matters: this one is I/O-bound,
    // and a transcode of the same film would pin a CPU for two hours.
    const decision = choose(
      MKV,
      probeOf({ container: 'matroska', videoCodec: 'h264', audioCodec: 'aac' })
    );

    expect(decision.path).toBe('remux');
  });

  it('copies the streams instead of touching them', () => {
    const args = argvOf(choose(MKV, probeOf({ container: 'matroska' })));

    expect(args.join(' ')).toContain('-c copy');
  });

  it('writes a fragmented MP4, which is the only kind a live stream can be', () => {
    // An ordinary MP4 puts its index at the end, so it cannot be written to a
    // pipe: the element would be handed bytes it can make no sense of until a
    // file it will never see the end of has ended.
    const args = argvOf(choose(MKV, probeOf({ container: 'matroska' })));

    expect(args.join(' ')).toMatch(/-movflags\s+\S*frag/);
    expect(args.join(' ')).toContain('-f mp4');
  });

  it('names the film it was asked about', () => {
    const args = argvOf(choose(MKV, probeOf({ container: 'matroska' })));

    expect(args).toContain(MKV);
  });

  it('asks for no encoder, because a remux encodes nothing', () => {
    const args = argvOf(choose(MKV, probeOf({ container: 'matroska' })));

    expect(args.join(' ')).not.toContain('libx264');
  });
});

describe('choosePlaybackPath — a codec the browser cannot decode', () => {
  it('re-encodes HEVC, whatever container it arrived in', () => {
    const decision = choose(
      MKV,
      probeOf({ container: 'matroska', videoCodec: 'hevc' })
    );

    expect(decision.path).toBe('transcode');
  });

  it('re-encodes AC-3 audio inside a container Chromium reads perfectly well', () => {
    // The row that stops the policy being about containers: the file is an MP4,
    // the picture is fine, and the family would get a silent film.
    const decision = choose(MP4, probeOf({ audioCodec: 'ac3' }));

    expect(decision.path).toBe('transcode');
  });

  it('re-encodes DTS audio for the same reason', () => {
    const decision = choose(
      MKV,
      probeOf({ container: 'matroska', audioCodec: 'dts' })
    );

    expect(decision.path).toBe('transcode');
  });

  it('re-encodes an AVI of XviD, which is wrong on both counts', () => {
    const decision = choose(
      AVI,
      probeOf({ container: 'avi', videoCodec: 'mpeg4', audioCodec: 'mp3' })
    );

    expect(decision.path).toBe('transcode');
  });

  it('re-encodes to H.264 and AAC, which is what Chromium reads', () => {
    const args = argvOf(choose(MKV, probeOf({ videoCodec: 'hevc' })));

    expect(args).toContain('aac');
    expect(args.join(' ')).toMatch(/h264|libx264/);
  });

  it('names the film it was asked about', () => {
    const args = argvOf(choose(MKV, probeOf({ videoCodec: 'hevc' })));

    expect(args).toContain(MKV);
  });
});

describe('choosePlaybackPath — which encoder does the work', () => {
  it('uses the hardware encoder when the machine reports one', () => {
    // "Available" varies by machine and is not something a test can pin, so the
    // detection is somebody else's job and what arrives here is a value. That
    // is the whole reason the selection lives in the pure function's argv: this
    // is the one place it can be asserted at all.
    const args = argvOf(
      choose(MKV, probeOf({ videoCodec: 'hevc' }), {
        available: true,
        hardwareEncoder: 'h264_nvenc',
      })
    );

    expect(args).toContain('h264_nvenc');
    expect(args).not.toContain('libx264');
  });

  it('falls back to software encoding when the machine reports none', () => {
    const args = argvOf(choose(MKV, probeOf({ videoCodec: 'hevc' })));

    expect(args).toContain('libx264');
  });

  it('never asks for a hardware encoder on a remux, which encodes nothing', () => {
    const args = argvOf(
      choose(MKV, probeOf({ container: 'matroska' }), {
        available: true,
        hardwareEncoder: 'h264_nvenc',
      })
    );

    expect(args).not.toContain('h264_nvenc');
  });
});

describe('choosePlaybackPath — with no playback component at all', () => {
  it('still direct-plays an MP4, because a partial setup is not a dead app', () => {
    // Nothing on this machine could have run a probe, so the answer comes from
    // the file itself. An MP4 needs no help, and a family whose installer has
    // not run yet can still watch most of the library.
    expect(choose(MP4, null, ABSENT).path).toBe('direct');
  });

  it('answers cannot-play for an MKV rather than sending bytes nothing reads', () => {
    expect(choose(MKV, null, ABSENT).path).toBe('cannot-play');
  });

  it('answers cannot-play for an AVI', () => {
    expect(choose(AVI, null, ABSENT).path).toBe('cannot-play');
  });

  it('refuses a film it knows needs converting when there is nothing to convert with', () => {
    // A probe from a machine that had a component, read on one that no longer
    // does. The policy answers from what is installed now, never from what was.
    const decision = choose(MKV, probeOf({ container: 'matroska' }), ABSENT);

    expect(decision.path).toBe('cannot-play');
  });

  it('produces no argv it has nothing to run', () => {
    expect(choose(MKV, null, ABSENT)).not.toHaveProperty('args');
  });
});

// --- 10 — Video player, Phase 7 (second slice): "seeking on a stream path"
// (issue #90) -----------------------------------------------------------------
//
// The **Stream offset** reaches the format policy, which is the only place it
// can: a stream path has no byte ranges to seek in, so where the film starts is
// an argument to the conversion rather than something the element asks for
// later. It is still a pure function — a number in, an argument out — and it
// stays the one place in `playback/` that decides anything about an argv.

describe('choosePlaybackPath — starting a conversion partway into the film', () => {
  /** Where the family let go of the knob, in **Absolute position** seconds. */
  const OFFSET = 1200;

  it('starts a remux at the second it was given', () => {
    const args = argvOf(
      choose(MKV, probeOf({ container: 'matroska' }), SOFTWARE, OFFSET)
    );

    expect(args.join(' ')).toContain('-ss 1200');
  });

  it('starts a transcode at the second it was given', () => {
    const args = argvOf(
      choose(MKV, probeOf({ videoCodec: 'hevc' }), SOFTWARE, OFFSET)
    );

    expect(args.join(' ')).toContain('-ss 1200');
  });

  it('seeks the input rather than the output, on both converting paths', () => {
    // `-ss` before `-i` tells ffmpeg to open the file at that second; after
    // `-i` it decodes everything up to it and throws it away. On a two-hour
    // film that is the difference between a scrub that settles and one that
    // spends minutes producing nothing.
    for (const probe of [
      probeOf({ container: 'matroska' }),
      probeOf({ videoCodec: 'hevc' }),
    ]) {
      const args = argvOf(choose(MKV, probe, SOFTWARE, OFFSET));

      expect(args.indexOf('-ss')).toBeGreaterThanOrEqual(0);
      expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'));
    }
  });

  it('asks for no offset at all when the film starts at its beginning', () => {
    // Nought is nothing to say rather than `-ss 0`: the fresh open is the
    // commonest request the route serves, and it should read as the plain one.
    const args = argvOf(choose(MKV, probeOf({ container: 'matroska' })));

    expect(args).not.toContain('-ss');
  });

  it('leaves direct play alone, offset or no offset', () => {
    // **Direct play** seeks by byte range and the offset is meaningless to it.
    // A file that started being sent from the middle because of a `?t=` would
    // be a film that skips its own opening.
    const decision = choose(MP4, probeOf(), SOFTWARE, OFFSET);

    expect(decision.path).toBe('direct');
    expect(decision).not.toHaveProperty('args');
  });

  it('leaves a film nothing can play unplayable, offset or no offset', () => {
    const decision = choose(
      MKV,
      probeOf({ container: 'matroska' }),
      ABSENT,
      OFFSET
    );

    expect(decision.path).toBe('cannot-play');
    expect(decision).not.toHaveProperty('args');
  });
});
