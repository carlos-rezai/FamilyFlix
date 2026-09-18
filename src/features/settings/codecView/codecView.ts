import type {
  CodecCapability,
  CodecSupport,
  PlaybackCapabilities,
} from '@/types';

/** One **Codec row** as the screen draws it. */
export interface CodecRowModel {
  /** The decoder's name on the wire — `h264`, `hevc`, `ac3`. */
  codec: string;
  /** The prototype's display name — _H.264 / AVC_. */
  name: string;
  /** The **Container chips**, display only. */
  exts: string[];
  support: CodecSupport;
}

/** One entry of the **Format catalogue**: a decoder, named and chipped. */
interface CatalogueEntry {
  codec: string;
  name: string;
  exts: readonly string[];
}

/**
 * The **Format catalogue**: every decoder the screen has a row for, in the
 * order the rows draw — video first, then audio. A decoder the catalogue does
 * not name is not a row: a full ffmpeg build lists a few hundred, and raw
 * PCM, bitmap images and test patterns are not formats a family's films are
 * made of. The names and the chips are the prototype's.
 */
const CATALOGUE: readonly CatalogueEntry[] = [
  { codec: 'h264', name: 'H.264 / AVC', exts: ['.mp4', '.mov', '.m4v'] },
  { codec: 'hevc', name: 'H.265 / HEVC', exts: ['.mkv', '.mp4'] },
  { codec: 'vp8', name: 'VP8', exts: ['.webm'] },
  { codec: 'vp9', name: 'VP9', exts: ['.webm', '.mkv'] },
  { codec: 'av1', name: 'AV1', exts: ['.mkv', '.mp4', '.webm'] },
  { codec: 'mpeg4', name: 'MPEG-4 / XviD', exts: ['.avi', '.mkv'] },
  { codec: 'mpeg2video', name: 'MPEG-2', exts: ['.mpg', '.vob'] },
  { codec: 'vc1', name: 'Windows Media Video', exts: ['.wmv'] },
  { codec: 'prores', name: 'Apple ProRes', exts: ['.mov'] },
  { codec: 'theora', name: 'Theora', exts: ['.ogv'] },
  { codec: 'aac', name: 'AAC Audio', exts: ['.mp4', '.m4a'] },
  { codec: 'mp3', name: 'MP3 Audio', exts: ['.mp3', '.avi'] },
  { codec: 'opus', name: 'Opus Audio', exts: ['.webm', '.mkv'] },
  { codec: 'vorbis', name: 'Vorbis Audio', exts: ['.webm', '.ogg'] },
  { codec: 'flac', name: 'FLAC Audio', exts: ['.flac', '.mkv'] },
  { codec: 'ac3', name: 'AC-3 / Dolby Digital', exts: ['.mkv', '.avi'] },
  { codec: 'eac3', name: 'E-AC-3 / Dolby Digital Plus', exts: ['.mkv'] },
  { codec: 'dts', name: 'DTS Audio', exts: ['.mkv'] },
  { codec: 'truehd', name: 'Dolby TrueHD', exts: ['.mkv'] },
];

/**
 * The rows the **Codec report** draws: the catalogue ∩ the report, in
 * catalogue order, each carrying the support the report gave it.
 *
 * A catalogued codec the report lacks is not a row either — no "unsupported"
 * state, the rule `capabilities` already keeps: the absence of a row is the
 * honest way to say nothing on this machine decodes it.
 */
export function codecRows(report: PlaybackCapabilities): CodecRowModel[] {
  const reported = new Map<string, CodecCapability>(
    report.codecs.map((entry) => [entry.codec, entry])
  );

  return CATALOGUE.flatMap((entry) => {
    const capability = reported.get(entry.codec);
    return capability === undefined
      ? []
      : [
          {
            codec: entry.codec,
            name: entry.name,
            exts: [...entry.exts],
            support: capability.support,
          },
        ];
  });
}

/**
 * The **Codec summary**, the line above the rows: how many rows there are and
 * how many the **Playback component** added — or that there is none. It
 * counts the rows rather than the report, so two hundred decoders the
 * catalogue does not name are not two hundred formats enabled.
 */
export function codecSummary(report: PlaybackCapabilities): string {
  const rows = codecRows(report);
  const added = rows.filter((row) => row.support === 'via-component').length;
  const tail = report.component
    ? `${added} from the playback component`
    : 'no playback component';

  return `${rows.length} formats enabled · ${tail}`;
}
