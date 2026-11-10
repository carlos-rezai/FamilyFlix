import {
  DEFAULT_SUBTITLE_LANGUAGE,
  LANGUAGE_POOL,
  type PoolLanguage,
} from '@/types';

/**
 * The tags a subtitle filename spells each of the **Language pool**'s names
 * by: the ISO 639-1 and 639-2 codes. The English name itself is a tag too,
 * added below off the tuple rather than spelled here, so the seven names are
 * `LANGUAGE_POOL`' and this map cannot name an eighth or miss one.
 */
const CODES: Record<PoolLanguage, readonly string[]> = {
  English: ['en', 'eng'],
  Spanish: ['es', 'spa'],
  French: ['fr', 'fre', 'fra'],
  German: ['de', 'ger', 'deu'],
  Portuguese: ['pt', 'por'],
  Italian: ['it', 'ita'],
  Dutch: ['nl', 'dut', 'nld'],
};

/**
 * Each language's own name, diacritics folded: `Nederlands.srt` is Dutch.
 * English's own name is its English name, already a tag off the tuple.
 */
const ENDONYMS: Record<PoolLanguage, readonly string[]> = {
  English: [],
  Spanish: ['espanol'],
  French: ['francais'],
  German: ['deutsch'],
  Portuguese: ['portugues'],
  Italian: ['italiano'],
  Dutch: ['nederlands'],
};

/** Each language of the pool with every tag that spells it. */
const LANGUAGE_TAGS: [language: PoolLanguage, tags: string[]][] =
  LANGUAGE_POOL.map((language) => [
    language,
    [...CODES[language], ...ENDONYMS[language], language.toLowerCase()],
  ]);

/** The tag, lowercased, onto its language. */
const BY_TAG = new Map<string, string>(
  LANGUAGE_TAGS.flatMap(([language, tags]) =>
    tags.map((tag) => [tag, language] as [string, string])
  )
);

/** A code onto its language: the only tag a region may follow. */
const BY_CODE = new Map<string, string>(
  LANGUAGE_POOL.flatMap((language) =>
    CODES[language].map((code) => [code, language] as [string, string])
  )
);

/** A two-letter region after a code, `BR` in `pt-BR`. */
const REGION = /^[a-z]{2}$/;

/** The name lowercased with its diacritics folded: `Español` is `espanol`. */
function fold(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

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
 *
 * A language's own name reads too, diacritics folded (`Español`), and a
 * two-letter region after a known code reads as the code (`pt-BR`, `en_GB`).
 */
export function detectSubtitleLanguage(filename: string): string {
  const name = filename.split(/[/\\]/).pop() ?? '';
  const stem = name.slice(0, name.lastIndexOf('.'));
  const pieces = fold(stem).split(/[._-]/);
  const tag = pieces[pieces.length - 1] ?? '';
  const byTag = BY_TAG.get(tag);
  if (byTag) return byTag;
  const code = pieces.length > 1 ? pieces[pieces.length - 2] : undefined;
  const byCode =
    code !== undefined && REGION.test(tag) ? BY_CODE.get(code) : undefined;
  return byCode ?? DEFAULT_SUBTITLE_LANGUAGE;
}
