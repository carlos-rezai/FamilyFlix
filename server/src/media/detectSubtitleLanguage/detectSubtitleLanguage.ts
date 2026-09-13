/**
 * The **Movie form**'s seven languages — the **Language pool** its dropdown
 * offers — each with the tags a subtitle filename spells it by: the ISO 639-1
 * and 639-2 codes and the English name.
 */
const LANGUAGE_TAGS: [language: string, tags: string[]][] = [
  ['English', ['en', 'eng', 'english']],
  ['Spanish', ['es', 'spa', 'spanish']],
  ['French', ['fr', 'fre', 'fra', 'french']],
  ['German', ['de', 'ger', 'deu', 'german']],
  ['Portuguese', ['pt', 'por', 'portuguese']],
  ['Italian', ['it', 'ita', 'italian']],
  ['Dutch', ['nl', 'dut', 'nld', 'dutch']],
];

/** The language an untagged track is filed under — the form's own default. */
const DEFAULT_LANGUAGE = 'English';

/** The tag, lowercased, onto its language. */
const BY_TAG = new Map<string, string>(
  LANGUAGE_TAGS.flatMap(([language, tags]) =>
    tags.map((tag) => [tag, language] as [string, string])
  )
);

/**
 * A subtitle's language, read off its filename tag onto one of the form's
 * seven names — `die-hard.pt.srt` is Portuguese — and `English` when nothing
 * in the name says otherwise.
 *
 * The tag is the last piece before the extension, split on dots, underscores
 * and hyphens, so a word of the title is never read as one: `it-follows.srt`
 * ends in `follows`, and `de-lift.1983.srt` in `1983`. A tag the form does not
 * offer — Japanese, Swedish — is `English` too: the maintainer corrects it on
 * the form rather than the importer inventing an eighth name.
 */
export function detectSubtitleLanguage(filename: string): string {
  const name = filename.split(/[/\\]/).pop() ?? '';
  const stem = name.slice(0, name.lastIndexOf('.'));
  const tag = stem.split(/[._-]/).pop()?.toLowerCase() ?? '';
  return BY_TAG.get(tag) ?? DEFAULT_LANGUAGE;
}
