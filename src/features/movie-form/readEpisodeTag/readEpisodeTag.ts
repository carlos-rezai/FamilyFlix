/**
 * What an **Episode tag** says on the client: the numbers, and the title after
 * it. The server's `EpisodeTag` with one word changed — `number`, the form's
 * and `NewEpisode`'s, where the server says `episode`.
 */
export interface EpisodeTag {
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
export const TAG_SHAPES = [
  /(?:^|[\s._-])s(\d{1,3})e(\d{1,4})(?:-?e\d{1,4})*(?=$|[\s._-])/i,
  /(?:^|[\s._-])(\d{1,2})x(\d{1,3})(?=$|[\s._-])/i,
];

/**
 * The **Episode word** — `Episode 12`, `Ep 12`, `Ep.12`, `E12` — either case,
 * standing as a word of its own. It gives an episode number only, so it is
 * read only under a season the caller already knows.
 */
const EPISODE_WORD =
  /(?:^|[\s._-])(?:episode|ep|e)[\s.]?(\d{1,4})(?=$|[\s._-])/i;

/** The words a release name carries that are not the episode's. */
const QUALITY_TAG =
  /^(?:\d{3,4}p|4k|uhd|x26[45]|h26[45]|hevc|avc|xvid|divx|bluray|blu-ray|bdrip|brrip|webrip|web-dl|webdl|web|hdtv|hdrip|dvdrip|dvd|hdr|10bit|8bit|aac|ac3|dts|ddp?5\.1|proper|repack)$/i;

/** A filename without its extension. */
function withoutExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(0, dot) : filename;
}

/**
 * Read the **Episode tag** off a picked file's name:
 * `{ season, number, title }`, or `null` for a name that carries none. The
 * title is the text after the tag, dots and underscores read as spaces and
 * quality tags dropped.
 *
 * Given the `season` the caller already knows, the **Episode word** is read
 * too, under that season — the server's rule, held to it by the drift guard.
 */
export function readEpisodeTag(
  filename: string,
  season?: number
): EpisodeTag | null {
  const name = withoutExtension(filename);

  const titleAfter = (found: RegExpExecArray): string | null => {
    const words = name
      .slice(found.index + found[0].length)
      .split(/[\s._]+/)
      .filter((word) => word !== '' && word !== '-' && !QUALITY_TAG.test(word));
    return words.length === 0 ? null : words.join(' ');
  };

  for (const shape of TAG_SHAPES) {
    const found = shape.exec(name);
    if (found !== null) {
      return {
        season: Number(found[1]),
        number: Number(found[2]),
        title: titleAfter(found),
      };
    }
  }
  if (season === undefined) {
    return null;
  }
  const word = EPISODE_WORD.exec(name);
  return word === null
    ? null
    : { season, number: Number(word[1]), title: titleAfter(word) };
}
