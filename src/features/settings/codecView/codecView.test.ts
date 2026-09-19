import { describe, expect, it } from 'vitest';

import { codecRows, codecSummary, componentRow } from './codecView';
import type {
  CodecCapability,
  PlaybackCapabilities,
  PlaybackComponentInfo,
} from '@/types';

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
 * rows rather than the report.
 *
 * ---
 *
 * 16 — Playback component upload, Phase 1: "the slot resolves what is live,
 * and it has a row" (issue #152). `CodecRowModel` reshapes to
 * `{ key, name, chips, size, status, removable }` — one template for two kinds
 * of row, with the four pill words on it — and `componentRow` answers the
 * **Component row**: the one row that has a size and a source, drawn last and
 * absent on a machine with no component at all.
 *
 * **The summary counts formats, not the row about the component.** A family
 * reading "20 formats enabled" is reading how many films play, and the ffmpeg
 * pair is not a film format.
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

/** The **Default component**: what `ffmpegBinary` resolved, 94.2 MB of it. */
const DEFAULT_COMPONENT: PlaybackComponentInfo = {
  source: 'default',
  bytes: 98_765_432,
  files: ['ffmpeg.exe', 'ffprobe.exe'],
};

/** The **Uploaded component**: the pair the maintainer dropped in. */
const UPLOADED_COMPONENT: PlaybackComponentInfo = {
  source: 'uploaded',
  bytes: 101_468_672,
  files: ['ffmpeg.exe', 'ffprobe.exe'],
};

const withoutComponent = (
  codecs: CodecCapability[] = CHROMIUM
): PlaybackCapabilities => ({ component: null, codecs });

const withComponent = (
  codecs: CodecCapability[],
  component: PlaybackComponentInfo = DEFAULT_COMPONENT
): PlaybackCapabilities => ({ component, codecs });

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

    expect(rows.map((row) => row.key)).toEqual(['h264', 'hevc']);
  });

  it('draws no row for a catalogued codec the report lacks', () => {
    // No "unsupported" state: absence is how the report says so.
    const rows = codecRows(withoutComponent([native('h264', 'video')]));

    expect(rows.map((row) => row.key)).toEqual(['h264']);
    expect(rows.find((row) => row.key === 'hevc')).toBeUndefined();
  });

  it('answers no rows for an empty report', () => {
    expect(codecRows(withoutComponent([]))).toEqual([]);
  });
});

describe('codecRows — the order', () => {
  it('draws the rows in catalogue order, whatever order the report came in', () => {
    expect(codecRows(EVERYTHING).map((row) => row.key)).toEqual(
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

    expect(rows.map((row) => row.key)).toEqual(['h264', 'hevc', 'aac', 'dts']);
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
    const byKey = new Map(rows.map((row) => [row.key, row]));

    expect(byKey.get('h264')).toEqual({
      key: 'h264',
      name: 'H.264 / AVC',
      chips: ['.mp4', '.mov', '.m4v'],
      size: '—',
      status: 'built-in',
      removable: false,
    });
    expect(byKey.get('hevc')).toMatchObject({
      name: 'H.265 / HEVC',
      chips: ['.mkv', '.mp4'],
    });
    expect(byKey.get('mpeg4')).toMatchObject({
      name: 'MPEG-4 / XviD',
      chips: ['.avi', '.mkv'],
    });
    expect(byKey.get('vc1')).toMatchObject({
      name: 'Windows Media Video',
      chips: ['.wmv'],
    });
    expect(byKey.get('aac')).toMatchObject({ name: 'AAC Audio' });
    expect(byKey.get('ac3')).toMatchObject({
      name: 'AC-3 / Dolby Digital',
      chips: ['.mkv', '.avi'],
    });
    expect(byKey.get('dts')).toMatchObject({ name: 'DTS Audio' });
  });

  it('gives every catalogued codec a display name and at least one chip', () => {
    for (const row of codecRows(EVERYTHING)) {
      expect(row.name.length).toBeGreaterThan(0);
      expect(row.chips.length).toBeGreaterThan(0);
      for (const chip of row.chips) {
        expect(chip).toMatch(/^\.[a-z0-9]+$/);
      }
    }
  });

  it('says Built-in or Installed as the report’s support says', () => {
    const rows = codecRows(
      withComponent([native('h264', 'video'), added('hevc', 'video')])
    );

    expect(rows.find((row) => row.key === 'h264')?.status).toBe('built-in');
    expect(rows.find((row) => row.key === 'hevc')?.status).toBe('installed');
  });

  it('gives no codec row a size or a remove', () => {
    // Every **Installed** row exists because of the one **Playback
    // component**; none is a thing that can be taken out on its own, and none
    // has a weight of its own. The size and the ✕ are the Component row's.
    for (const row of codecRows(EVERYTHING)) {
      expect(row.size).toBe('—');
      expect(row.removable).toBe(false);
    }
  });
});

describe('componentRow — the row the component has', () => {
  it('draws the default component as one row of the same template', () => {
    expect(componentRow(withComponent(CHROMIUM, DEFAULT_COMPONENT))).toEqual({
      key: 'component',
      name: 'Playback component',
      chips: ['ffmpeg.exe', 'ffprobe.exe'],
      size: '94.2 MB',
      status: 'default',
      removable: false,
    });
  });

  it('draws an uploaded component as Uploaded, and removable', () => {
    // The **Default component** is the installer's and not the maintainer's,
    // so only the uploaded one can be taken back out.
    expect(componentRow(withComponent(CHROMIUM, UPLOADED_COMPONENT))).toEqual({
      key: 'component',
      name: 'Playback component',
      chips: ['ffmpeg.exe', 'ffprobe.exe'],
      size: '96.8 MB',
      status: 'uploaded',
      removable: true,
    });
  });

  it('writes the pair’s bytes the way the Storage card does', () => {
    // `formatBytes`, 1024-based — the same number Explorer's Properties
    // dialog shows for the folder.
    expect(
      componentRow(
        withComponent(CHROMIUM, {
          ...DEFAULT_COMPONENT,
          bytes: 19_756_849_562,
        })
      )?.size
    ).toBe('18.4 GB');
  });

  it('carries whatever the pair’s files are called', () => {
    expect(
      componentRow(
        withComponent(CHROMIUM, {
          ...UPLOADED_COMPONENT,
          files: ['ffmpeg', 'ffprobe'],
        })
      )?.chips
    ).toEqual(['ffmpeg', 'ffprobe']);
  });

  it('answers null for a machine with no component at all', () => {
    // No row rather than an empty one: there is nothing to name, weigh or
    // remove.
    expect(componentRow(withoutComponent())).toBeNull();
    expect(componentRow(withoutComponent([]))).toBeNull();
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

  it('never counts the Component row among the formats', () => {
    // The row under the codecs is the ffmpeg pair, not a film format. The
    // count is the codec rows' and nothing else's, uploaded or default.
    const codecs = [native('h264', 'video'), added('hevc', 'video')];

    expect(codecSummary(withComponent(codecs, DEFAULT_COMPONENT))).toBe(
      '2 formats enabled · 1 from the playback component'
    );
    expect(codecSummary(withComponent(codecs, UPLOADED_COMPONENT))).toBe(
      '2 formats enabled · 1 from the playback component'
    );
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
