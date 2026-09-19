import type { CodecCapability, PlaybackCapabilities } from '@/types';
import { formatBytes } from '@/utils';

/**
 * What the **Status pill** says, as a word rather than as a support: the two
 * a codec row can be, and the two the **Component row** can be. One template
 * serves both kinds of row, so the word is the model's rather than the
 * molecule's to work out.
 */
export type CodecRowStatus = 'built-in' | 'installed' | 'default' | 'uploaded';

/** One row of the **Codec report** as the screen draws it — of either kind. */
export interface CodecRowModel {
  /** What the row is about: a decoder's wire name, or `component`. */
  key: string;
  /** The prototype's display name — _H.264 / AVC_, _Playback component_. */
  name: string;
  /** The **Container chips**, or the pair's basenames. Display only. */
  chips: string[];
  /** The size cell: `—` for a codec, the pair's weight for the component. */
  size: string;
  status: CodecRowStatus;
  /** Whether there is anything here the maintainer can take back out. */
  removable: boolean;
}

/** The size cell of a row that has no size of its own. */
const NO_SIZE = '—';

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
            key: entry.codec,
            name: entry.name,
            chips: [...entry.exts],
            // Every **Installed** row exists because of the one **Playback
            // component**: none is a thing that can be taken out on its own,
            // and none has a weight of its own.
            size: NO_SIZE,
            status:
              capability.support === 'native'
                ? ('built-in' as const)
                : ('installed' as const),
            removable: false,
          },
        ];
  });
}

/**
 * The **Component row**: the one row that has a size and a source — the pair
 * the player actually converts with, named _Playback component_, chipped with
 * its two basenames and weighed the way the Storage card weighs the media
 * folder.
 *
 * `null` for a machine with no component at all. No row rather than an empty
 * one: there is nothing to name, weigh or remove, and the absence of a row is
 * how this screen says so — the rule the codec rows already keep.
 *
 * Only an **Uploaded component** is removable. The **Default component** is
 * the installer's rather than the maintainer's, and it is what a remove falls
 * back to.
 */
export function componentRow(
  report: PlaybackCapabilities
): CodecRowModel | null {
  const component = report.component;
  if (component === null) {
    return null;
  }

  return {
    key: 'component',
    name: 'Playback component',
    chips: [...component.files],
    size: formatBytes(component.bytes),
    status: component.source,
    removable: component.source === 'uploaded',
  };
}

/**
 * The **Codec summary**, the line above the rows: how many rows there are and
 * how many the **Playback component** added — or that there is none. It
 * counts the rows rather than the report, so two hundred decoders the
 * catalogue does not name are not two hundred formats enabled.
 *
 * **It counts the codec rows alone.** The **Component row** never enters the
 * count: a family reading "20 formats enabled" is reading how many films play,
 * and the ffmpeg pair is not a film format.
 */
export function codecSummary(report: PlaybackCapabilities): string {
  const rows = codecRows(report);
  const added = rows.filter((row) => row.status === 'installed').length;
  const tail =
    report.component !== null
      ? `${added} from the playback component`
      : 'no playback component';

  return `${rows.length} formats enabled · ${tail}`;
}
