// @vitest-environment node
//
// 46 — Audio tracks, Phase 2: "the track on the wire" (issue #400).
//
// The probe learns every audio stream, in file order — the **Audio track
// index** is a place among them — each with its codec, its raw language tag,
// its trimmed title and whether the file marks it default. And the video codec
// skips a cover picture, so the policy reads the stream `-map 0:V:0?` sends.
//
// Nothing here spawns anything: what ffprobe would have printed arrives
// through `probe`'s third parameter.

import { describe, expect, it } from 'vitest';

import { probe, type ProbeOutput } from './probe';

function printing(streams: Array<Record<string, unknown>>): ProbeOutput {
  return () =>
    JSON.stringify({
      format: { format_name: 'matroska,webm', duration: '5391.200000' },
      streams,
    });
}

const H264 = { codec_type: 'video', codec_name: 'h264' };

describe('probe — every audio stream, in file order', () => {
  it('reads each stream’s codec, language, title and default flag', () => {
    const output = printing([
      H264,
      {
        codec_type: 'audio',
        codec_name: 'aac',
        tags: { language: 'eng', title: 'Stereo' },
        disposition: { default: 1 },
      },
      { codec_type: 'subtitle', codec_name: 'subrip' },
      {
        codec_type: 'audio',
        codec_name: 'ac3',
        tags: { language: 'fre', title: '  Commentary  ' },
        disposition: { default: 0 },
      },
    ]);

    expect(probe('ffprobe', 'film.mkv', output)?.audioStreams).toEqual([
      { codec: 'aac', language: 'eng', title: 'Stereo', isDefault: true },
      { codec: 'ac3', language: 'fre', title: 'Commentary', isDefault: false },
    ]);
  });

  it('reads an absent language and title as null', () => {
    const output = printing([H264, { codec_type: 'audio', codec_name: 'aac' }]);

    expect(probe('ffprobe', 'film.mkv', output)?.audioStreams).toEqual([
      { codec: 'aac', language: null, title: null, isDefault: false },
    ]);
  });

  it('reads an empty or blank title as null', () => {
    const output = printing([
      H264,
      { codec_type: 'audio', codec_name: 'aac', tags: { title: '' } },
      { codec_type: 'audio', codec_name: 'aac', tags: { title: '   ' } },
    ]);

    expect(
      probe('ffprobe', 'film.mkv', output)?.audioStreams.map((s) => s.title)
    ).toEqual([null, null]);
  });

  it('answers no streams for a file with no audio', () => {
    const output = printing([H264]);

    expect(probe('ffprobe', 'film.mkv', output)?.audioStreams).toEqual([]);
  });
});

describe('probe — the video codec skips a cover picture', () => {
  it('reads the film’s stream rather than an attached picture before it', () => {
    const output = printing([
      {
        codec_type: 'video',
        codec_name: 'mjpeg',
        disposition: { attached_pic: 1 },
      },
      { codec_type: 'video', codec_name: 'hevc' },
      { codec_type: 'audio', codec_name: 'aac' },
    ]);

    expect(probe('ffprobe', 'film.mkv', output)?.videoCodec).toBe('hevc');
  });

  it('answers no video codec for a file whose only picture is a cover', () => {
    const output = printing([
      {
        codec_type: 'video',
        codec_name: 'png',
        disposition: { attached_pic: 1 },
      },
      { codec_type: 'audio', codec_name: 'flac' },
    ]);

    expect(probe('ffprobe', 'film.mkv', output)?.videoCodec).toBeNull();
  });
});
