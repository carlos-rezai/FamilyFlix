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

/** The one tail form that carries a year, wherever it sits at the end. */
const YEAR_TAIL = new RegExp(
  `(?:^|[\\s([])(${YEAR})[)\\]]?\\s*(?:\\d{3,4}p|4k)?\\s*$`,
  'i'
);

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
  let key = name
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(SEPARATORS, ' ');

  for (let stripped = key.replace(TAIL, ''); stripped !== key; ) {
    key = stripped;
    stripped = key.replace(TAIL, '');
  }

  return key
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The separators a **Source folder** name uses in place of the spaces a title
 * cannot carry on disk. Narrower than {@link SEPARATORS}: a hyphen stays,
 * because `Spider-Man` is a title and the guess is for typing into a field.
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

/** The first Release noise word, and everything after it. */
const NOISE_EDGE = '[\\s\\u2010-\\u2015-]';
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
 * The **Search query**: a title as TMDB is asked it. A dot or an underscore
 * read as a space, Release noise dropped, the tail forms stripped, curly
 * quotes and dashes folded to ASCII, `&` read as `and`, and every other
 * character that is not a letter or a digit a space. Unlike the **Title key**
 * the case and the accents stay: TMDB is the one comparing.
 */
export function searchQuery(title: string): string {
  return stripTails(dropReleaseNoise(title.replace(SPACE_SEPARATORS, ' ')))
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―]/g, '-')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * The title a `no-row` **Source folder** name suggests: the name with the
 * **Title key**'s tail forms dropped — and only those. The key is for
 * comparing and folds everything away; the guess is for the form's title
 * field, so the case, the accents and the punctuation the folder kept are
 * kept, and a dot or an underscore is read as the space it stands for.
 * `Harbor.Lights.2019` guesses "Harbor Lights", and a guess and its folder
 * name share one key.
 */
export function titleGuess(name: string): string {
  let guess = dropReleaseNoise(name.replace(SPACE_SEPARATORS, ' '));

  for (let stripped = guess.replace(TAIL, ''); stripped !== guess; ) {
    guess = stripped;
    stripped = guess.replace(TAIL, '');
  }

  return guess.replace(/\s+/g, ' ').trim();
}

/**
 * The year a **Source folder** name carries in its tail — `Die Hard (1988)`,
 * `Die.Hard.1988.1080p`, `Amelie [2001]` — or `null` for a name that carries
 * none. Read through the same tail forms {@link titleKey} strips, so a name
 * and its key can never disagree about whether there was a year.
 */
export function yearInName(name: string): number | null {
  const match = YEAR_TAIL.exec(name.replace(SEPARATORS, ' '));
  return match === null ? null : Number(match[1]);
}
