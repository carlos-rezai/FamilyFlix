/**
 * The **Title guess** off a picked video's name — the client's counterpart of
 * the importer's `titleGuess`. The extension goes, dots and underscores read as
 * spaces, and everything from the first year, quality tag or **Episode tag**
 * onward is dropped. Case, accents and punctuation are kept.
 */

/** A trailing extension: a dot, then a letter and up to four more. */
const EXTENSION = /\.[a-z][a-z0-9]{1,4}$/i;

/** What a title cannot carry on disk and stood in for a space. */
const SPACE_SEPARATORS = /[._]+/g;

/** The forms that end a title: a year, a quality tag, an Episode tag. */
const TAIL_STARTS: readonly RegExp[] = [
  /[([]?\b(?:19|20)\d{2}\b/,
  /\b\d{3,4}p\b/i,
  /\b4k\b/i,
  /\bs\d{1,2}e\d{1,3}\b/i,
  /\b\d{1,2}x\d{2,3}\b/i,
];

export function titleFromFilename(filename: string): string {
  const name = filename.replace(EXTENSION, '').replace(SPACE_SEPARATORS, ' ');

  // The earliest tail form after the start — one at the very start would
  // leave no title at all, so it is read as part of the title instead.
  let end = name.length;
  for (const tail of TAIL_STARTS) {
    const match = tail.exec(name);
    if (match !== null && match.index > 0 && match.index < end) {
      end = match.index;
    }
  }

  return name
    .slice(0, end)
    .replace(/[\s([-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}
