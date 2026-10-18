// @vitest-environment node
//
// 46 — Audio tracks, Phase 2: "the track on the wire" (issue #400).
//
// The format policy decides over the chosen **Audio track index**: that
// stream's codec, not the first one's. Both converting paths always map —
// `-map 0:V:0? -map 0:a:<index>?`, even at index 0 — so a remux sends one
// picture and one voice and nothing an MP4 cannot hold. **Direct play** stays
// index 0 of a native file, because the element plays whichever track it
// plays; and an index the file does not have is `no-track`.

import { describe, expect, it } from 'vitest';

import {
  choosePlaybackPath,
  type ComponentAvailability,
  type PlaybackDecision,
} from './choosePlaybackPath';
import type { MediaProbe, ProbedAudio } from '../probe/probe';

const MKV = '/media/Amelie (2001)/amelie.mkv';
const MP4 = '/media/Amelie (2001)/amelie.mp4';

const SOFTWARE: ComponentAvailability = {
  available: true,
  hardwareEncoder: null,
};

function audio(codec: string, language: string | null = null): ProbedAudio {
  return { codec, language, title: null, isDefault: false };
}

function probeOf(partial: Partial<MediaProbe> = {}): MediaProbe {
  return {
    container: 'mp4',
    videoCodec: 'h264',
    audioStreams: [audio('aac', 'fre'), audio('aac', 'eng')],
    durationSeconds: 7320,
    ...partial,
  };
}

function choose(
  file: string,
  probe: MediaProbe | null,
  audioTrack: number
): PlaybackDecision {
  return choosePlaybackPath({
    file,
    probe,
    component: SOFTWARE,
    audioTrack,
  });
}

function argvOf(decision: PlaybackDecision): string[] {
  if (decision.path === 'remux' || decision.path === 'transcode') {
    return decision.args;
  }
  throw new Error(`${decision.path} runs nothing, so it has no argv`);
}

/** Every value given to `-map`, in order. */
function mapsOf(args: string[]): string[] {
  return args.flatMap((arg, at) =>
    arg === '-map' ? [args[at + 1] ?? ''] : []
  );
}

describe('choosePlaybackPath — the chosen track of a native file', () => {
  it('direct-plays index 0 of a native file', () => {
    expect(choose(MP4, probeOf(), 0)).toEqual({ path: 'direct' });
  });

  it('direct-plays a native file when no track is named, as today', () => {
    expect(
      choosePlaybackPath({ file: MP4, probe: probeOf(), component: SOFTWARE })
    ).toEqual({ path: 'direct' });
  });

  it('remuxes index 1 of the same file, mapping its picture and that voice', () => {
    const decision = choose(MP4, probeOf(), 1);

    expect(decision.path).toBe('remux');
    expect(mapsOf(argvOf(decision))).toEqual(['0:V:0?', '0:a:1?']);
  });

  it('maps after the input, so the maps read the film', () => {
    const args = argvOf(choose(MP4, probeOf(), 1));

    expect(args.indexOf('-map')).toBeGreaterThan(args.indexOf('-i'));
  });
});

describe('choosePlaybackPath — the codec at the chosen index', () => {
  it('transcodes a non-native codec at the index, with the same maps', () => {
    const probe = probeOf({
      audioStreams: [audio('aac', 'eng'), audio('ac3', 'fre')],
    });
    const decision = choose(MP4, probe, 1);

    expect(decision.path).toBe('transcode');
    expect(mapsOf(argvOf(decision))).toEqual(['0:V:0?', '0:a:1?']);
  });

  it('remuxes a native codec at the index even when another track is not', () => {
    const probe = probeOf({
      container: 'matroska',
      audioStreams: [audio('dts', 'eng'), audio('aac', 'fre')],
    });

    expect(choose(MKV, probe, 1).path).toBe('remux');
  });
});

describe('choosePlaybackPath — index 0 of a file that is converted anyway', () => {
  it('maps 0:a:0? on a remux', () => {
    const decision = choose(MKV, probeOf({ container: 'matroska' }), 0);

    expect(decision.path).toBe('remux');
    expect(mapsOf(argvOf(decision))).toEqual(['0:V:0?', '0:a:0?']);
  });

  it('maps 0:a:0? on a transcode', () => {
    const decision = choose(
      MKV,
      probeOf({ container: 'matroska', videoCodec: 'hevc' }),
      0
    );

    expect(decision.path).toBe('transcode');
    expect(mapsOf(argvOf(decision))).toEqual(['0:V:0?', '0:a:0?']);
  });
});

describe('choosePlaybackPath — a remux holds only what an MP4 can', () => {
  it('maps no subtitle or data stream, only the picture and the one voice', () => {
    const args = argvOf(choose(MKV, probeOf({ container: 'matroska' }), 1));

    // Every stream that leaves is one of the two maps: an unmapped
    // `-c copy` would carry a SubRip or attachment stream into a fragmented
    // MP4 that cannot hold it.
    expect(mapsOf(args)).toEqual(['0:V:0?', '0:a:1?']);
    expect(args).not.toContain('0');
    expect(args.filter((arg) => arg === '-map')).toHaveLength(2);
  });
});

describe('choosePlaybackPath — an index the file does not have', () => {
  it('answers no-track for an index past the streams', () => {
    expect(choose(MKV, probeOf({ container: 'matroska' }), 2)).toEqual({
      path: 'no-track',
    });
  });

  it('answers no-track for index 1 of a native file with one track', () => {
    expect(
      choose(MP4, probeOf({ audioStreams: [audio('aac', 'eng')] }), 1)
    ).toEqual({ path: 'no-track' });
  });
});
