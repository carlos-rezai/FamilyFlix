import {
  DEFAULT_SUBTITLE_LANGUAGE,
  SUBTITLE_LANGUAGES,
  type SubtitleLanguage,
} from '@/types';

/**
 * The tags a subtitle filename spells each of the **Language pool**'s names
 * by: the ISO 639-1 and 639-2 codes. The English name itself is a tag too,
 * added below off the tuple rather than spelled here, so the seven names are
 * `SUBTITLE_LANGUAGES`' and this map cannot name an eighth or miss one.
 */
const CODES: Record<SubtitleLanguage, readonly string[]> = {
  English: ['en', 'eng'],
  Spanish: ['es', 'spa'],
  French: ['fr', 'fre', 'fra'],
  German: ['de', 'ger', 'deu'],
  Portuguese: ['pt', 'por'],
  Italian: ['it', 'ita'],
  Dutch: ['nl', 'dut', 'nld'],
};

/** Each language of the pool with every tag that spells it. */
const LANGUAGE_TAGS: [language: SubtitleLanguage, tags: string[]][] =
  SUBTITLE_LANGUAGES.map((language) => [
    language,
    [...CODES[language], language.toLowerCase()],
  ]);

/** The language an untagged track is filed under — the shared default. */
const DEFAULT_LANGUAGE: string = DEFAULT_SUBTITLE_LANGUAGE;

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
