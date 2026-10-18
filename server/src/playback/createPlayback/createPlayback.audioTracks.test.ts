// @vitest-environment node
//
// 46 — Audio tracks, Phase 2: "the track on the wire" (issue #400).
//
// The domain answers the offered **Audio tracks** beside the path, from the
// one probe — each track with its own **Playback path**, and `path` still
// index 0's, the one the plain URL plays. `stream` takes an **Audio track
// index**, passes its maps through to the conversion, and answers `no-track`
// for an index the file lacks with nothing spawned. The slot is still read per
// request, so an uploaded component changes what is offered on the next read.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { ComponentSlot } from '../componentSlot/componentSlot';
import type {
  PlaybackComponent,
  PlaybackProcess,
} from '../ffmpegComponent/ffmpegComponent';
import type { MediaProbe, ProbedAudio } from '../probe/probe';

import { createPlayback } from './createPlayback';

function audio(
  codec: string,
  language: string | null,
  isDefault = false
): ProbedAudio {
  return { codec, language, title: null, isDefault };
}

/** An MP4 of H.264 with English AAC first and French AC-3 second. */
const TWO_TRACK_MP4: MediaProbe = {
  container: 'mp4',
  videoCodec: 'h264',
  audioStreams: [audio('aac', 'eng', true), audio('ac3', 'fre')],
  durationSeconds: 7320,
};

/** An MKV of H.264 with French and English AAC: every track a remux. */
const TWO_TRACK_MKV: MediaProbe = {
  container: 'matroska',
  videoCodec: 'h264',
  audioStreams: [audio('aac', 'fre', true), audio('aac', 'eng')],
  durationSeconds: 7320,
};

interface FakeComponent extends PlaybackComponent {
  spawned: string[][];
}

function fakeComponent(probe: MediaProbe | null): FakeComponent {
  const component: FakeComponent = {
    spawned: [],
    hardwareEncoder: null,
    decoders: () => null,
    probe: () => probe,
    spawn: (args: string[]): PlaybackProcess => {
      component.spawned.push(args);
      return { stdout: Readable.from([]), kill: () => undefined };
    },
  };
  return component;
}

/** A slot whose live component the test replaces between two reads. */
function changingSlot(): {
  slot: ComponentSlot;
  put(next: PlaybackComponent | null): void;
} {
  let live: PlaybackComponent | null = null;
  const refuse = (): never => {
    throw new Error('the changing slot neither receives nor removes');
  };
  return {
    slot: {
      current: () => live,
      info: () =>
        live === null
          ? null
          : { source: 'uploaded', bytes: 1000, files: ['ffmpeg', 'ffprobe'] },
      receive: refuse,
      remove: refuse,
    },
    put: (next) => {
      live = next;
    },
  };
}

function mediaWith(relativePath: string): { media: string; file: string } {
  const media = sandboxRoot('familyflix-audio-');
  const file = join(media, relativePath);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, 'film bytes');
  return { media, file };
}

describe('createPlayback — the read offers the audio tracks', () => {
  it('answers each track with its own path, and path still index 0’s', () => {
    const { media, file } = mediaWith('Amelie (2001)/amelie.mp4');
    const playback = createPlayback(
      media,
      fixedSlot(fakeComponent(TWO_TRACK_MP4)),
      () => null
    );

    expect(playback.read(file)).toEqual({
      path: 'direct',
      durationSeconds: 7320,
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
          language: 'French',
          label: 'French',
          fileDefault: false,
          path: 'transcode',
        },
      ],
    });
  });

  it('offers at most index 0 with no Playback component', () => {
    const { media, file } = mediaWith('Amelie (2001)/amelie.mp4');
    const read = createPlayback(media, fixedSlot(null), () => null).read(file);

    expect(read.audioTracks.length).toBeLessThanOrEqual(1);
    expect(read.audioTracks.filter((track) => track.index > 0)).toEqual([]);
  });

  it('offers the tracks an uploaded component can read on the next read, with no restart', () => {
    const { media, file } = mediaWith('Amelie (2001)/amelie.mkv');
    const { slot, put } = changingSlot();
    const playback = createPlayback(media, slot, () => null);

    expect(playback.read(file).audioTracks).toEqual([]);

    put(fakeComponent(TWO_TRACK_MKV));

    expect(
      playback.read(file).audioTracks.map((track) => [track.index, track.path])
    ).toEqual([
      [0, 'remux'],
      [1, 'remux'],
    ]);
  });
});

describe('createPlayback — the stream of a chosen track', () => {
  it('passes the chosen track’s maps through to the conversion', () => {
    const { media, file } = mediaWith('Amelie (2001)/amelie.mkv');
    const component = fakeComponent(TWO_TRACK_MKV);
    const playback = createPlayback(media, fixedSlot(component), () => null);

    expect(playback.stream(file, 0, 1).path).toBe('converted');
    expect(component.spawned).toHaveLength(1);
    expect(component.spawned[0]).toEqual(
      expect.arrayContaining(['-map', '0:V:0?', '0:a:1?'])
    );
  });

  it('converts index 1 of a native file it would direct-play at index 0', () => {
    const { media, file } = mediaWith('Amelie (2001)/amelie.mp4');
    const component = fakeComponent(TWO_TRACK_MP4);
    const playback = createPlayback(media, fixedSlot(component), () => null);

    expect(playback.stream(file, 0, 0)).toEqual({ path: 'direct' });
    expect(playback.stream(file, 0, 1).path).toBe('converted');
    expect(component.spawned[0]).toContain('0:a:1?');
  });

  it('answers no-track for an index the file lacks, spawning nothing', () => {
    const { media, file } = mediaWith('Amelie (2001)/amelie.mkv');
    const component = fakeComponent(TWO_TRACK_MKV);
    const playback = createPlayback(media, fixedSlot(component), () => null);

    expect(playback.stream(file, 0, 2)).toEqual({ path: 'no-track' });
    expect(component.spawned).toEqual([]);
  });

  it('maps index 0 when no track is named', () => {
    const { media, file } = mediaWith('Amelie (2001)/amelie.mkv');
    const component = fakeComponent(TWO_TRACK_MKV);
    const playback = createPlayback(media, fixedSlot(component), () => null);

    expect(playback.stream(file, 0).path).toBe('converted');
    expect(component.spawned[0]).toContain('0:a:0?');
  });
});
