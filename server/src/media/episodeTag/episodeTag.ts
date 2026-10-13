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
 * The **Episode word** — `Episode 12`, `Ep 12`, `Ep.12`, `E12` — either case,
 * standing as a word of its own. It gives an episode number only, so it is
 * read only under a season the caller already knows.
 */
const EPISODE_WORD =
  /(?:^|[\s._-])(?:episode|ep|e)[\s.]?(\d{1,4})(?=$|[\s._-])/i;

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
 *
 * Given the `season` the caller already knows — a Season folder's, or 1 at a
 * Show folder's root — the **Episode word** is read too, under that season. A
 * full tag still answers its own numbers.
 */
export function episodeTag(
  filename: string,
  season?: number
): EpisodeTag | null {
  const name = filename.slice(0, filename.length - extname(filename).length);

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
        episode: Number(found[2]),
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
    : { season, episode: Number(word[1]), title: titleAfter(word) };
}

/**
 * Spell an **Episode tag** from its numbers — `S01E03`, two digits a side at
 * least — the inverse of {@link episodeTag}: whatever shape a tag was read
 * from, this is the one it is written back in, in the console, in a Problem's
 * reason and in the set of tags a held show already carries.
 *
 * With no `episode`, the season alone — `S02` — the tag's season form, the
 * client's `formatEpisodeTag` precedent: a Sync's Season poster file,
 * `S02-poster.jpg`, and an Export's `seasons/S02`.
 */
export function spellEpisodeTag(season: number, episode?: number): string {
  const twoDigits = (n: number): string => String(n).padStart(2, '0');
  return episode === undefined
    ? `S${twoDigits(season)}`
    : `S${twoDigits(season)}E${twoDigits(episode)}`;
}
