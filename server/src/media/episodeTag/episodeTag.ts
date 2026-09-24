import { extname } from 'node:path';

/** What an **Episode tag** says: the numbers, and the title after it. */
export interface EpisodeTag {
  season: number;
  episode: number;
  /** The words after the tag, or `null` when none are left. */
  title: string | null;
}

/**
 * The two shapes a tag is written in — `S01E03` and `1x03` — either case,
 * standing as a word of its own: bounded by the start, the end, or a
 * separator, so a year or a resolution is never read as one. A
 * multi-episode tag — `S01E01E02` — is read whole and answers its first number.
 */
const TAG_SHAPES = [
  /(?:^|[\s._-])s(\d{1,3})e(\d{1,4})(?:-?e\d{1,4})*(?=$|[\s._-])/i,
  /(?:^|[\s._-])(\d{1,2})x(\d{1,3})(?=$|[\s._-])/i,
];

/**
 * The words a release name carries that are not the episode's: resolutions,
 * codecs, sources and the like. Dropped from the title wherever they sit.
 */
const QUALITY_TAG =
  /^(?:\d{3,4}p|4k|uhd|x26[45]|h26[45]|hevc|avc|xvid|divx|bluray|blu-ray|bdrip|brrip|webrip|web-dl|webdl|web|hdtv|hdrip|dvdrip|dvd|hdr|10bit|8bit|aac|ac3|dts|ddp?5\.1|proper|repack)$/i;

/**
 * Read the **Episode tag** off a filename: `{ season, episode, title }`, or
 * `null` for a name that carries none. The title is the text after the tag,
 * with dots and underscores read as spaces and quality tags dropped; nothing
 * left is a `null` title. The extension never reaches it.
 */
export function episodeTag(filename: string): EpisodeTag | null {
  const name = filename.slice(0, filename.length - extname(filename).length);

  for (const shape of TAG_SHAPES) {
    const found = shape.exec(name);
    if (found === null) {
      continue;
    }
    const rest = name.slice(found.index + found[0].length);
    const words = rest
      .split(/[\s._]+/)
      .filter((word) => word !== '' && word !== '-' && !QUALITY_TAG.test(word));
    return {
      season: Number(found[1]),
      episode: Number(found[2]),
      title: words.length === 0 ? null : words.join(' '),
    };
  }
  return null;
}
