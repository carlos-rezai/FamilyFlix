// @vitest-environment node
//
// 10 — Video player refactor, Group F: the four playback modules nothing named
// (issue #94).
//
// What ffprobe says a file is, turned into the `MediaProbe` the format policy
// decides from. The interesting rules are all on this side of the spawn: the
// `mov,mp4,m4a,…` list collapsing to `mp4`, and `matroska,webm` splitting on
// the file's own extension because Chromium reads one and refuses the other.
//
// Nothing here spawns anything. What the prober would have printed arrives
// through `probe`'s third parameter, which is `capabilities`' seam in the same
// domain — a test that shelled out could only ever ask about the machine
// running it, and CI is a machine with no FFmpeg on it.

import { describe, expect, it, vi } from 'vitest';

import { probe, type ProbeOutput } from './probe';

/** ffprobe's `-print_format json`, as a function that never runs anything. */
function printing(payload: unknown): ProbeOutput {
  return () => JSON.stringify(payload);
}

/**
 * The shape a real answer has: one format object and a list of streams.
 * `null` for the duration is the field being absent rather than empty, which is
 * a thing ffprobe does for a container that does not carry one.
 */
function ffprobeJson(
  formatName: string,
  streams: Array<Record<string, unknown>> = [],
  duration: string | null = '6832.500000'
) {
  const format =
    duration === null
      ? { format_name: formatName }
      : { format_name: formatName, duration };

  return { format, streams };
}

const H264 = { codec_type: 'video', codec_name: 'h264' };
const AAC = { codec_type: 'audio', codec_name: 'aac' };

describe('probe — the container, named once', () => {
  it('collapses ffprobe’s MP4 family to mp4', () => {
    const output = printing(ffprobeJson('mov,mp4,m4a,3gp,3g2,mj2'));

    expect(probe('ffprobe', 'film.mp4', output)?.container).toBe('mp4');
  });

  it('reads a .webm as webm, which Chromium plays', () => {
    const output = printing(ffprobeJson('matroska,webm'));

    expect(probe('ffprobe', 'film.webm', output)?.container).toBe('webm');
  });

  it('reads a .mkv as matroska, which Chromium refuses', () => {
    // One demuxer, two fates. The bytes cannot answer this, which is why the
    // file's name is read here and nowhere else in the policy.
    const output = printing(ffprobeJson('matroska,webm'));

    expect(probe('ffprobe', 'film.mkv', output)?.container).toBe('matroska');
  });

  it('does not care how the extension is spelled', () => {
    const output = printing(ffprobeJson('matroska,webm'));

    expect(probe('ffprobe', 'FILM.WEBM', output)?.container).toBe('webm');
  });

  it('treats an extension it does not know as the Matroska it demuxes as', () => {
    const output = printing(ffprobeJson('matroska,webm'));

    expect(probe('ffprobe', 'film.mkv.part', output)?.container).toBe(
      'matroska'
    );
  });

  it('takes the first name for a container with nothing to disambiguate', () => {
    const output = printing(ffprobeJson('avi'));

    expect(probe('ffprobe', 'film.avi', output)?.container).toBe('avi');
  });

  it('trims the spaces a list is allowed to carry', () => {
    const output = printing(ffprobeJson('mov, mp4, m4a'));

    expect(probe('ffprobe', 'film.mp4', output)?.container).toBe('mp4');
  });
});

describe('probe — the streams', () => {
  it('names the video and audio codecs a file carries', () => {
    const output = printing(ffprobeJson('avi', [H264, AAC]));

    expect(probe('ffprobe', 'film.avi', output)).toEqual({
      container: 'avi',
      videoCodec: 'h264',
      audioCodec: 'aac',
      durationSeconds: 6832.5,
    });
  });

  it('takes the first stream of each kind', () => {
    const output = printing(
      ffprobeJson('matroska,webm', [
        H264,
        AAC,
        { codec_type: 'audio', codec_name: 'ac3' },
      ])
    );

    expect(probe('ffprobe', 'film.mkv', output)?.audioCodec).toBe('aac');
  });

  it('answers null for a stream the file does not have', () => {
    // A film with no audio track has nothing that could fail to decode, which
    // is not the same as an audio track nothing can read.
    const output = printing(ffprobeJson('avi', [H264]));

    expect(probe('ffprobe', 'film.avi', output)?.audioCodec).toBeNull();
  });

  it('skips a stream that will not say what codec it is', () => {
    const output = printing(
      ffprobeJson('avi', [{ codec_type: 'video' }, { codec_type: 'audio' }])
    );

    const answer = probe('ffprobe', 'film.avi', output);

    expect(answer?.videoCodec).toBeNull();
    expect(answer?.audioCodec).toBeNull();
  });

  it('reads a file with no streams listed at all', () => {
    const output = printing({ format: { format_name: 'avi' } });

    expect(probe('ffprobe', 'film.avi', output)).toEqual({
      container: 'avi',
      videoCodec: null,
      audioCodec: null,
      durationSeconds: 0,
    });
  });

  it('ignores a streams field that is not a list', () => {
    const output = printing({
      format: { format_name: 'avi' },
      streams: 'nope',
    });

    expect(probe('ffprobe', 'film.avi', output)?.videoCodec).toBeNull();
  });
});

describe('probe — how long the film runs', () => {
  it('reads the seconds the format reports', () => {
    const output = printing(ffprobeJson('avi', [], '90.5'));

    expect(probe('ffprobe', 'film.avi', output)?.durationSeconds).toBe(90.5);
  });

  it('answers 0 when the format will not say', () => {
    const output = printing(ffprobeJson('avi', [], null));

    expect(probe('ffprobe', 'film.avi', output)?.durationSeconds).toBe(0);
  });

  it('answers 0 for the N/A ffprobe prints when it cannot measure', () => {
    const output = printing(ffprobeJson('avi', [], 'N/A'));

    expect(probe('ffprobe', 'film.avi', output)?.durationSeconds).toBe(0);
  });

  it('answers 0 rather than a negative length', () => {
    const output = printing(ffprobeJson('avi', [], '-12'));

    expect(probe('ffprobe', 'film.avi', output)?.durationSeconds).toBe(0);
  });
});

describe('probe — every way of not knowing is one answer', () => {
  it('answers null when the prober printed nothing', () => {
    // A binary that will not start, a file it will not open, a run that timed
    // out: folded to `null` behind the seam, because no caller can act
    // differently on them.
    expect(probe('ffprobe', 'film.mkv', () => null)).toBeNull();
  });

  it('answers null for output that is not JSON', () => {
    expect(probe('ffprobe', 'film.mkv', () => 'ffprobe: not found')).toBeNull();
  });

  it('answers null for JSON that is not an object', () => {
    expect(probe('ffprobe', 'film.mkv', printing([1, 2, 3]))).toBeNull();
  });

  it('answers null when there is no format object', () => {
    expect(probe('ffprobe', 'film.mkv', printing({ streams: [] }))).toBeNull();
  });

  it('answers null when the format will not name itself', () => {
    expect(
      probe('ffprobe', 'film.mkv', printing({ format: { duration: '90' } }))
    ).toBeNull();
  });
});

describe('probe — the seam', () => {
  it('asks the prober about the binary and the file it was given', () => {
    const output = vi.fn<ProbeOutput>(() => JSON.stringify(ffprobeJson('avi')));

    probe('/opt/ffmpeg/ffprobe', '/media/film.avi', output);

    expect(output).toHaveBeenCalledExactlyOnceWith(
      '/opt/ffmpeg/ffprobe',
      '/media/film.avi'
    );
  });
});
