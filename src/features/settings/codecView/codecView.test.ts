import { describe, expect, it } from 'vitest';

import { codecRows, codecSummary } from './codecView';
import type { CodecCapability, PlaybackCapabilities } from '@/types';

/**
 * 15 — Settings hub, Phase 1: "the tracer bullet" (issue #143).
 *
 * The **Codec report**'s pure view, on the `importView` precedent: the raw
 * report the wire carries in — `{ codec, kind, support }` per row — and what
 * the screen draws out. The **Format catalogue** lives here and nowhere else:
 * decoder name → the prototype's display name → its **Container chips**,
 * video then audio, in the order the rows draw.
 *
 * `codecRows` is the catalogue ∩ the report, in catalogue order. A decoder the
 * catalogue does not name (`pcm_s16le`, `bmp`, `rawvideo`) is not a row, and a
 * catalogued codec nothing decodes is not a row either — no "unsupported"
 * state, the rule `capabilities` already keeps. `codecSummary` counts those
 * rows rather than the report, and says whether a **Playback component** is
 * part of the answer.
 */

const native = (codec: string, kind: 'video' | 'audio'): CodecCapability => ({
  codec,
  kind,
  support: 'native',
});

const added = (codec: string, kind: 'video' | 'audio'): CodecCapability => ({
  codec,
  kind,
  support: 'via-component',
});

/** Chromium's own set, the report on a machine with no component. */
const CHROMIUM: CodecCapability[] = [
  native('h264', 'video'),
  native('vp8', 'video'),
  native('vp9', 'video'),
  native('av1', 'video'),
  native('aac', 'audio'),
  native('mp3', 'audio'),
  native('opus', 'audio'),
  native('vorbis', 'audio'),
  native('flac', 'audio'),
];

const withoutComponent = (
  codecs: CodecCapability[] = CHROMIUM
): PlaybackCapabilities => ({ component: false, codecs });

const withComponent = (codecs: CodecCapability[]): PlaybackCapabilities => ({
  component: true,
  codecs,
});

/** The catalogue in the order the rows draw: video first, then audio. */
const CATALOGUE_ORDER = [
  'h264',
  'hevc',
  'vp8',
  'vp9',
  'av1',
  'mpeg4',
  'mpeg2video',
  'vc1',
  'prores',
  'theora',
  'aac',
  'mp3',
  'opus',
  'vorbis',
  'flac',
  'ac3',
  'eac3',
  'dts',
  'truehd',
];

/** A report naming every catalogued codec, handed over in reverse. */
const EVERYTHING = withComponent(
  [...CATALOGUE_ORDER]
    .reverse()
    .map((codec) =>
      added(codec, CATALOGUE_ORDER.indexOf(codec) < 10 ? 'video' : 'audio')
    )
);

describe('codecRows — which codecs become rows', () => {
  it('keeps only the codecs the catalogue names', () => {
    // A full ffmpeg build lists a few hundred decoders — raw PCM, bitmap
    // images, test patterns. None of them is a format the family's films are
    // made of, and a list of two hundred rows is a list nobody reads.
    const rows = codecRows(
      withComponent([
        native('h264', 'video'),
        added('pcm_s16le', 'audio'),
        added('bmp', 'video'),
        added('rawvideo', 'video'),
        added('hevc', 'video'),
      ])
    );

    expect(rows.map((row) => row.codec)).toEqual(['h264', 'hevc']);
  });

  it('draws no row for a catalogued codec the report lacks', () => {
    // No "unsupported" state: absence is how the report says so.
    const rows = codecRows(withoutComponent([native('h264', 'video')]));

    expect(rows.map((row) => row.codec)).toEqual(['h264']);
    expect(rows.find((row) => row.codec === 'hevc')).toBeUndefined();
  });

  it('answers no rows for an empty report', () => {
    expect(codecRows(withoutComponent([]))).toEqual([]);
  });
});

describe('codecRows — the order', () => {
  it('draws the rows in catalogue order, whatever order the report came in', () => {
    expect(codecRows(EVERYTHING).map((row) => row.codec)).toEqual(
      CATALOGUE_ORDER
    );
  });

  it('draws every video format before any audio format', () => {
    const rows = codecRows(
      withComponent([
        added('dts', 'audio'),
        native('aac', 'audio'),
        added('hevc', 'video'),
        native('h264', 'video'),
      ])
    );

    expect(rows.map((row) => row.codec)).toEqual([
      'h264',
      'hevc',
      'aac',
      'dts',
    ]);
  });
});

describe('codecRows — what each row carries', () => {
  it('names the codec the way the prototype does, with its container chips', () => {
    const rows = codecRows(
      withComponent([
        native('h264', 'video'),
        added('hevc', 'video'),
        added('mpeg4', 'video'),
        added('vc1', 'video'),
        native('aac', 'audio'),
        added('ac3', 'audio'),
        added('dts', 'audio'),
      ])
    );
    const byCodec = new Map(rows.map((row) => [row.codec, row]));

    expect(byCodec.get('h264')).toEqual({
      codec: 'h264',
      name: 'H.264 / AVC',
      exts: ['.mp4', '.mov', '.m4v'],
      support: 'native',
    });
    expect(byCodec.get('hevc')).toMatchObject({
      name: 'H.265 / HEVC',
      exts: ['.mkv', '.mp4'],
    });
    expect(byCodec.get('mpeg4')).toMatchObject({
      name: 'MPEG-4 / XviD',
      exts: ['.avi', '.mkv'],
    });
    expect(byCodec.get('vc1')).toMatchObject({
      name: 'Windows Media Video',
      exts: ['.wmv'],
    });
    expect(byCodec.get('aac')).toMatchObject({ name: 'AAC Audio' });
    expect(byCodec.get('ac3')).toMatchObject({
      name: 'AC-3 / Dolby Digital',
      exts: ['.mkv', '.avi'],
    });
    expect(byCodec.get('dts')).toMatchObject({ name: 'DTS Audio' });
  });

  it('gives every catalogued codec a display name and at least one chip', () => {
    for (const row of codecRows(EVERYTHING)) {
      expect(row.name.length).toBeGreaterThan(0);
      expect(row.exts.length).toBeGreaterThan(0);
      for (const ext of row.exts) {
        expect(ext).toMatch(/^\.[a-z0-9]+$/);
      }
    }
  });

  it('carries the support through as the report gave it', () => {
    const rows = codecRows(
      withComponent([native('h264', 'video'), added('hevc', 'video')])
    );

    expect(rows.find((row) => row.codec === 'h264')?.support).toBe('native');
    expect(rows.find((row) => row.codec === 'hevc')?.support).toBe(
      'via-component'
    );
  });
});

describe('codecSummary — the line above the rows', () => {
  it('counts the rows and the ones the component added', () => {
    const summary = codecSummary(
      withComponent([
        ...CHROMIUM,
        added('hevc', 'video'),
        added('ac3', 'audio'),
        added('dts', 'audio'),
      ])
    );

    expect(summary).toBe('12 formats enabled · 3 from the playback component');
  });

  it('counts the rows, not the report', () => {
    // Two hundred decoders the catalogue does not name are not two hundred
    // formats enabled: the number on the line is the number of rows under it.
    const summary = codecSummary(
      withComponent([
        native('h264', 'video'),
        added('hevc', 'video'),
        added('pcm_s16le', 'audio'),
        added('bmp', 'video'),
        added('rawvideo', 'video'),
      ])
    );

    expect(summary).toBe('2 formats enabled · 1 from the playback component');
  });

  it('says there is no playback component when the report has none', () => {
    expect(codecSummary(withoutComponent())).toBe(
      '9 formats enabled · no playback component'
    );
  });

  it('says the component added nothing when it is there and will not say', () => {
    expect(codecSummary(withComponent(CHROMIUM))).toBe(
      '9 formats enabled · 0 from the playback component'
    );
  });

  it('reads 0 formats enabled for an empty report', () => {
    expect(codecSummary(withoutComponent([]))).toBe(
      '0 formats enabled · no playback component'
    );
    expect(codecSummary(withComponent([]))).toBe(
      '0 formats enabled · 0 from the playback component'
    );
  });
});
