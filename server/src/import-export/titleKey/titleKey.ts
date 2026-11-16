/**
 * The tails a **Source folder** name carries after the title, in the order a
 * name lays them down: a year in parentheses, in brackets or bare, and a
 * quality tag — `1080p`, `720p`, `2160p`, `4K`. Each is stripped from the end
 * for as long as one is there, so `Die.Hard.1988.1080p` loses the tag and then
 * the year.
 *
 * A bare year is one of the two centuries a film can be from, so a title that
 * ends in a number of its own — `Ocean's 11` — keeps it.
 */
const YEAR = '(?:1[89]|20)\\d{2}';
const TAIL = new RegExp(
  `\\s*(?:\\(${YEAR}\\)|\\[${YEAR}\\]|${YEAR}|\\d{3,4}p|4k)\\s*$`,
  'i'
);

/** The tail forms stripped from the end for as long as one is there. */
function stripTails(name: string): string {
  let rest = name;
  for (let stripped = rest.replace(TAIL, ''); stripped !== rest; ) {
    rest = stripped;
    stripped = rest.replace(TAIL, '');
  }
  return rest;
}

/**
 * The separators a folder name uses for the spaces a title has. A hyphen is
 * among them: `die-hard-1988` is how a folder spells "Die Hard 1988".
 */
const SEPARATORS = /[._-]+/g;

/**
 * The accents `normalize('NFD')` splits off their letters — the Unicode
 * combining diacritical marks block — so `Amélie` reads as `Amelie`.
 */
const COMBINING_MARKS = /[\u0300-\u036f]/g;

/**
 * The **Title key**: the normalised form of a title or a **Source folder** name
 * that matching compares. Case, diacritics, dots, underscores, each trailing
 * tail form, punctuation and spacing are all folded away, so that
 * `Die.Hard.1988.1080p` and "Die Hard" answer the same key.
 *
 * A pure function with a table of examples in its test, rather than a regular
 * expression inside the matcher: this is the heuristic that will be tuned
 * against the real folder names, and every spelling the family's shelves turn
 * out to use becomes one more row there.
 */
export function titleKey(name: string): string {
  const folded = name
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(SEPARATORS, ' ');

  return stripTails(folded)
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The separators a **Source folder** name uses in place of the spaces a title
 * cannot carry on disk. Narrower than {@link SEPARATORS}: a hyphen stays,
 * because **Release noise** is spelled with one (`WEB-DL`, `Blu-ray`) and must
 * still be whole when the noise is cut. {@link searchQuery} turns it into a
 * space afterwards, like any other mark.
 */
const SPACE_SEPARATORS = /[._]+/g;

/**
 * **Release noise**: the whole-word tags a release name lays down after the
 * title and that no title carries — the source, the codec, the cut — written
 * lower-case. Wherever the first of them stands, it and everything after it
 * (the release group among them) is noise.
 */
export const RELEASE_NOISE: readonly string[] = [
  'bluray',
  'blu-ray',
  'brrip',
  'bdrip',
  'bdremux',
  'remux',
  'web-dl',
  'webdl',
  'webrip',
  'hdtv',
  'hdrip',
  'dvdrip',
  'dvdscr',
  'xvid',
  'divx',
  'x264',
  'x265',
  'h264',
  'h265',
  'hevc',
  '10bit',
];

/**
 * The dashes a title or a name may be written with, as a regular expression
 * source: the ASCII hyphen and the Unicode dashes, curly ones included. The
 * one spelling of the class — the noise edge here and the **Search ladder**'s
 * subtitle mark both read it.
 */
export const DASHES = '[\\u2010-\\u2015-]';

/** The first Release noise word, and everything after it. */
const NOISE_EDGE = `(?:\\s|${DASHES})`;
const NOISE_TAIL = new RegExp(
  `(?:^|${NOISE_EDGE})(?:${RELEASE_NOISE.map((each) =>
    each.replace(/-/g, '\\-')
  ).join('|')})(?=$|${NOISE_EDGE}).*$`,
  'i'
);

/** A name with its first Release noise word and everything after it cut. */
function dropReleaseNoise(name: string): string {
  return name.replace(NOISE_TAIL, '');
}

/**
 * The **Search query**: a title as TMDB is asked it. A dot or an underscore
 * read as a space, Release noise dropped, the tail forms stripped, `&` read as
 * `and`, and every character that is not a letter or a digit a space — quotes
 * and dashes with them, curly or not. Unlike the **Title key** the case and
 * the accents stay: TMDB is the one comparing.
 */
export function searchQuery(title: string): string {
  return stripTails(dropReleaseNoise(title.replace(SPACE_SEPARATORS, ' ')))
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
