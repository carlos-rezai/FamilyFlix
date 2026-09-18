// @vitest-environment node
//
// 10 — Video player, Phase 8: "truthful capabilities" (issue #92).
//
// The read that makes the CodecManager stop being decorative: what this machine
// can *actually* decode, which is Chromium's native set on its own when there is
// no **Playback component**, and that set ∪ what `ffmpeg -decoders` reports when
// there is one.
//
// 15 — Settings hub, Phase 1: "the tracer bullet" (issue #143) moves the report
// behind the seam. `capabilities` used to resolve the binary itself — the
// three-step `ffmpegBinary` lookup a second time — and would have been wrong the
// day the upload initiative makes the live component replaceable: two
// resolutions of one slot, disagreeing. Now it is asked about a
// `PlaybackComponent | null`, the one `main.ts` composed, and reads the listing
// off its `decoders()`. The environment is never consulted here again.
//
// Nothing here spawns anything. The component is a fake whose `decoders()`
// answers a string — a listing that shelled out could only ever be asked about
// the machine running the test, and CI is a machine with no FFmpeg on it. The
// types come from `@/types`, where both build targets now read them.

import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CodecCapability, PlaybackCapabilities } from '@/types';

import { componentDir } from '../../test-support/componentDir/componentDir';
import type {
  PlaybackComponent,
  PlaybackProcess,
} from '../ffmpegComponent/ffmpegComponent';

import { capabilities } from './capabilities';

/**
 * What `ffmpeg -decoders` actually prints: a legend whose lines also begin with
 * a flag field and a space, a `------` rule, and then one line per decoder.
 * Trimmed to the codecs the family's films are made of.
 */
const DECODERS = [
  'Decoders:',
  ' V..... = Video',
  ' A..... = Audio',
  ' S..... = Subtitle',
  ' .F.... = Frame-level multithreading',
  ' ..S... = Slice-level multithreading',
  ' ...X.. = Codec is experimental',
  ' ....B. = Supports draw_horiz_band',
  ' .....D = Supports direct rendering method 1',
  ' ------',
  ' V....D 012v                 Uncompressed 4:2:2 10-bit',
  ' VFS..D h264                 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10',
  ' VFS..D hevc                 HEVC (High Efficiency Video Coding)',
  ' V....D mpeg4                MPEG-4 part 2',
  ' A....D aac                  AAC (Advanced Audio Coding)',
  ' A....D ac3                  ATSC A/52A (AC-3)',
  ' A....D dts                  DCA (DTS Coherent Acoustics)',
  ' S....D subrip               SubRip subtitle',
  '',
].join('\n');

/**
 * A **Playback component** that answers a fixed decoder listing — `null` for
 * one that is there and will not say — and can be asked nothing else that
 * matters here.
 */
function fakeComponent(decoders: string | null): PlaybackComponent {
  return {
    hardwareEncoder: null,
    decoders: () => decoders,
    probe: () => null,
    spawn: (): PlaybackProcess => ({
      stdout: Readable.from([]),
      kill: () => undefined,
    }),
  };
}

/** The codecs reported, by name, in an order no assertion has to know. */
const names = (reported: PlaybackCapabilities): string[] =>
  reported.codecs.map((entry) => entry.codec).sort();

/** The one entry for a codec, or `undefined` when it is not reported at all. */
const entryFor = (
  reported: PlaybackCapabilities,
  codec: string
): CodecCapability | undefined =>
  reported.codecs.find((candidate) => candidate.codec === codec);

/**
 * Everything Chromium decodes unaided — the same set `choosePlaybackPath` calls
 * **Direct play**, which is what makes this report the truth rather than a
 * second opinion.
 */
const CHROMIUM_NATIVE = [
  'aac',
  'av1',
  'flac',
  'h264',
  'mp3',
  'opus',
  'vorbis',
  'vp8',
  'vp9',
];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('capabilities — the machine with no Playback component', () => {
  it('reports Chromium’s native set alone, and says there is no component', () => {
    // The whole point of the absent state: a family whose installer has not run
    // yet still has a codec screen that tells them the truth, and the truth is
    // that MP4s play and nothing else does.
    const reported = capabilities(null);

    expect(reported.component).toBe(false);
    expect(names(reported)).toEqual(CHROMIUM_NATIVE);
  });

  it('marks every one of them native, and knows video from audio', () => {
    const reported = capabilities(null);

    expect(reported.codecs.every((entry) => entry.support === 'native')).toBe(
      true
    );
    expect(entryFor(reported, 'h264')?.kind).toBe('video');
    expect(entryFor(reported, 'aac')?.kind).toBe('audio');
  });

  it('answers rather than throwing', () => {
    // CI is this machine, and so is my parents' before the installer runs. A
    // throw here would be a Settings screen that takes the app down with it.
    expect(() => capabilities(null)).not.toThrow();
  });
});

describe('capabilities — the union with the component it was handed', () => {
  it('reports the codecs the component adds, marked as coming from it', () => {
    const reported = capabilities(fakeComponent(DECODERS));

    expect(reported.component).toBe(true);
    expect(entryFor(reported, 'hevc')).toEqual({
      codec: 'hevc',
      kind: 'video',
      support: 'via-component',
    });
    expect(entryFor(reported, 'ac3')?.support).toBe('via-component');
    expect(entryFor(reported, 'dts')?.support).toBe('via-component');
    expect(entryFor(reported, 'mpeg4')?.support).toBe('via-component');
  });

  it('knows video from audio among the added rows', () => {
    const reported = capabilities(fakeComponent(DECODERS));

    expect(entryFor(reported, 'hevc')?.kind).toBe('video');
    expect(entryFor(reported, 'ac3')?.kind).toBe('audio');
  });

  it('keeps the whole native set alongside them', () => {
    const reported = capabilities(fakeComponent(DECODERS));

    expect(reported.component).toBe(true);
    for (const codec of CHROMIUM_NATIVE) {
      expect(entryFor(reported, codec)).toBeDefined();
    }
    expect(names(reported)).toEqual(
      [...CHROMIUM_NATIVE, 'ac3', 'dts', 'hevc', 'mpeg4'].sort()
    );
  });

  it('lists a codec both can decode once, as native', () => {
    // h264 is in Chromium's set and in every ffmpeg build. Reporting it twice
    // would be two rows for one format; reporting it as via-component would be
    // a lie that costs the family a transcode they never needed — **Direct
    // play** wants no component at all.
    const reported = capabilities(fakeComponent(DECODERS));

    expect(reported.component).toBe(true);
    expect(
      reported.codecs.filter((entry) => entry.codec === 'h264')
    ).toHaveLength(1);
    expect(entryFor(reported, 'h264')?.support).toBe('native');
  });

  it('reports nothing the listing’s legend or its subtitle decoders imply', () => {
    // The header lines begin with a flag field and a space exactly as the
    // decoder lines do, so `= Video` is the shape a careless parser invents a
    // codec from. `subrip` is a real decoder and still not one of these: this
    // read is about what the family can watch, and subtitles are parsed by us.
    const reported = capabilities(fakeComponent(DECODERS));

    expect(reported.component).toBe(true);
    expect(names(reported)).not.toContain('subrip');
    expect(names(reported)).not.toContain('=');
    expect(names(reported)).not.toContain('Decoders:');
    expect(names(reported)).not.toContain('------');
  });

  it('reports the component present but adds nothing when it will not say', () => {
    // A binary that is there and answers nothing — a broken build, a listing
    // that timed out. It is still installed, so the report must not claim it is
    // missing; it added no formats, so it must not claim it did.
    const reported = capabilities(fakeComponent(null));

    expect(reported.component).toBe(true);
    expect(names(reported)).toEqual(CHROMIUM_NATIVE);
  });

  it('reports the component present over the native rows for an empty listing', () => {
    const reported = capabilities(fakeComponent(''));

    expect(reported.component).toBe(true);
    expect(names(reported)).toEqual(CHROMIUM_NATIVE);
  });
});

describe('capabilities — the component handed over is the only one asked', () => {
  it('asks the component it was given what it decodes', () => {
    const component = fakeComponent(DECODERS);
    const asked = vi.spyOn(component, 'decoders');

    capabilities(component);

    expect(asked).toHaveBeenCalled();
  });

  it('reads nothing off the environment and resolves no binary of its own', () => {
    // Asserted rather than assumed: a second copy of the lookup here is a
    // second place for the installer's slot to stop being honoured, and
    // replacing the component in Settings would quietly change nothing. A
    // complete component sits on PATH and in the variable; `null` still means
    // there is none.
    const dir = componentDir();
    vi.stubEnv('FAMILYFLIX_FFMPEG_PATH', `${dir}/ffmpeg`);
    vi.stubEnv('PATH', dir);

    const reported = capabilities(null);

    expect(reported.component).toBe(false);
    expect(names(reported)).toEqual(CHROMIUM_NATIVE);
  });
});
