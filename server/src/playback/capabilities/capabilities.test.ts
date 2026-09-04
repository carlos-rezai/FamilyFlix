// @vitest-environment node
//
// 10 — Video player, Phase 8: "truthful capabilities" (issue #92).
//
// The read that makes the CodecManager stop being decorative: what this machine
// can *actually* decode, which is Chromium's native set on its own when there is
// no **Playback component**, and that set ∪ what `ffmpeg -decoders` reports when
// there is one. **No screen renders it in this initiative** — it is built here
// because the mechanism belongs with the rest of the format policy, and the
// Settings initiative is what will consume it.
//
// Nothing here spawns anything. The component is resolved from empty files in a
// temporary directory, exactly as `ffmpegBinary`'s own suite does, and what
// `ffmpeg -decoders` would have printed arrives as a string — a listing that
// shelled out could only ever be asked about the machine running the test, and
// CI is a machine with no FFmpeg on it.

import { describe, expect, it, vi } from 'vitest';

import {
  componentDir,
  ffmpegIn,
  ffprobeIn,
} from '../../test-support/componentDir/componentDir';
import type { FfmpegBinaries } from '../ffmpegBinary/ffmpegBinary';

import {
  capabilities,
  type CodecCapability,
  type PlaybackCapabilities,
} from './capabilities';

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

/** A listing that answers the same thing whatever binaries it is handed. */
const listing = (output: string | null) => () => output;

/** A listing a test can ask what it was handed, and whether it was asked at all. */
const spyListing = (output: string | null = DECODERS) =>
  vi.fn<(binaries: FfmpegBinaries) => string | null>(() => output);

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

describe('capabilities — the machine with no Playback component', () => {
  it('reports Chromium’s native set alone, and says there is no component', () => {
    // The whole point of the absent state: a family whose installer has not run
    // yet still has a codec screen that tells them the truth, and the truth is
    // that MP4s play and nothing else does. The listing here would have plenty
    // to add — it is never asked, because there is nothing to ask.
    const reported = capabilities(
      { PATH: componentDir([]) },
      listing(DECODERS)
    );

    expect(reported.component).toBe(false);
    expect(names(reported)).toEqual(CHROMIUM_NATIVE);
  });

  it('marks every one of them native, and knows video from audio', () => {
    const reported = capabilities({}, listing(DECODERS));

    expect(reported.codecs.every((entry) => entry.support === 'native')).toBe(
      true
    );
    expect(entryFor(reported, 'h264')?.kind).toBe('video');
    expect(entryFor(reported, 'aac')?.kind).toBe('audio');
  });

  it('answers rather than throwing when the environment says nothing at all', () => {
    // CI is this machine, and so is my parents' before the installer runs. A
    // throw here would be a Settings screen that takes the app down with it.
    expect(() => capabilities({})).not.toThrow();
  });
});

describe('capabilities — the union with a resolved component', () => {
  it('reports the codecs the component adds, marked as coming from it', () => {
    const dir = componentDir();

    const reported = capabilities({ PATH: dir }, listing(DECODERS));

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

  it('keeps the whole native set alongside them', () => {
    const dir = componentDir();

    const reported = capabilities({ PATH: dir }, listing(DECODERS));

    for (const codec of CHROMIUM_NATIVE) {
      expect(entryFor(reported, codec)).toBeDefined();
    }
  });

  it('lists a codec both can decode once, as native', () => {
    // h264 is in Chromium's set and in every ffmpeg build. Reporting it twice
    // would be two rows for one format; reporting it as via-component would be
    // a lie that costs the family a transcode they never needed — **Direct
    // play** wants no component at all.
    const dir = componentDir();

    const reported = capabilities({ PATH: dir }, listing(DECODERS));

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
    const dir = componentDir();

    const reported = capabilities({ PATH: dir }, listing(DECODERS));

    expect(names(reported)).not.toContain('subrip');
    expect(names(reported)).not.toContain('=');
    expect(names(reported)).not.toContain('Decoders:');
    expect(names(reported)).not.toContain('------');
  });

  it('reports the component present but adds nothing when it will not say', () => {
    // A binary that is there and answers nothing — a broken build, a listing
    // that timed out. It is still installed, so the report must not claim it is
    // missing; it added no formats, so it must not claim it did.
    const dir = componentDir();

    const reported = capabilities({ PATH: dir }, listing(null));

    expect(reported.component).toBe(true);
    expect(names(reported)).toEqual(CHROMIUM_NATIVE);
  });
});

describe('capabilities — resolving the component through ffmpegBinary', () => {
  it('asks the component the three-step lookup chose, ffprobe and all', () => {
    // Asserted rather than assumed: a second copy of the lookup here is a
    // second place for the installer's slot to stop being honoured, and
    // replacing the component in Settings would quietly change nothing.
    const chosen = componentDir();
    const ignored = componentDir();
    const asked = spyListing();

    capabilities(
      { FAMILYFLIX_FFMPEG_PATH: ffmpegIn(chosen), PATH: ignored },
      asked
    );

    expect(asked).toHaveBeenCalledWith({
      ffmpeg: ffmpegIn(chosen),
      ffprobe: ffprobeIn(chosen),
    });
  });

  it('falls through a variable naming a binary that is not there', () => {
    const onPath = componentDir();
    const asked = spyListing();

    capabilities(
      {
        FAMILYFLIX_FFMPEG_PATH: ffmpegIn(componentDir([])),
        PATH: onPath,
      },
      asked
    );

    expect(asked).toHaveBeenCalledWith({
      ffmpeg: ffmpegIn(onPath),
      ffprobe: ffprobeIn(onPath),
    });
  });

  it('treats half a component as none, and never asks it anything', () => {
    // ffmpeg with no ffprobe beside it cannot say what a file is, so it is not
    // a component — and a report that asked it anyway would list formats the
    // player will still refuse.
    const asked = spyListing();

    const reported = capabilities({ PATH: componentDir(['ffmpeg']) }, asked);

    expect(asked).not.toHaveBeenCalled();
    expect(reported.component).toBe(false);
    expect(names(reported)).toEqual(CHROMIUM_NATIVE);
  });
});
