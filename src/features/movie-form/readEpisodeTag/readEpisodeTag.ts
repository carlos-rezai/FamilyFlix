/** What an **Episode tag** says on the client: the numbers, and the title after it. */
export interface ReadEpisodeTag {
  season: number;
  number: number;
  /** The words after the tag, or `null` when none are left. */
  title: string | null;
}

/**
 * The two shapes a tag is written in — `S01E03` and `1x03` — either case,
 * standing as a word of its own. A multi-episode tag answers its first number.
 * The server's `episodeTag` reads the same shapes; the drift guard beside this
 * file holds the two together.
 */
const TAG_SHAPES = [
  /(?:^|[\s._-])s(\d{1,3})e(\d{1,4})(?:-?e\d{1,4})*(?=$|[\s._-])/i,
  /(?:^|[\s._-])(\d{1,2})x(\d{1,3})(?=$|[\s._-])/i,
];

/** The words a release name carries that are not the episode's. */
const QUALITY_TAG =
  /^(?:\d{3,4}p|4k|uhd|x26[45]|h26[45]|hevc|avc|xvid|divx|bluray|blu-ray|bdrip|brrip|webrip|web-dl|webdl|web|hdtv|hdrip|dvdrip|dvd|hdr|10bit|8bit|aac|ac3|dts|ddp?5\.1|proper|repack)$/i;

/** A filename without its extension. */
function withoutExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(0, dot) : filename;
}

/**
 * Read the **Episode tag** off a picked file's name: `{ season, number, title }`,
 * or `null` for a name that carries none. The title is the text after the tag,
 * dots and underscores read as spaces and quality tags dropped.
 */
export function readEpisodeTag(filename: string): ReadEpisodeTag | null {
  const name = withoutExtension(filename);

  for (const shape of TAG_SHAPES) {
    const found = shape.exec(name);
    if (found === null) {
      continue;
    }
    const words = name
      .slice(found.index + found[0].length)
      .split(/[\s._]+/)
      .filter((word) => word !== '' && word !== '-' && !QUALITY_TAG.test(word));
    return {
      season: Number(found[1]),
      number: Number(found[2]),
      title: words.length === 0 ? null : words.join(' '),
    };
  }
  return null;
}
