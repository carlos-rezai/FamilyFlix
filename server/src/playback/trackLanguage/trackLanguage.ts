/**
 * Tags that name no language a family would choose between: undetermined,
 * multiple, no linguistic content, uncoded.
 */
const NO_LANGUAGE = ['und', 'mul', 'zxx', 'mis'];

const NAMES = new Intl.DisplayNames(['en'], {
  type: 'language',
  fallback: 'none',
});

/**
 * A stream's language tag → its base language named in English (`pt-BR` is
 * Portuguese), or `null` for no tag, a tag naming no language, a tag `Intl`
 * refuses and one it cannot name. Never throws.
 */
export function trackLanguage(tag: string | null): string | null {
  if (tag === null) {
    return null;
  }
  try {
    const base = new Intl.Locale(tag).language;
    if (NO_LANGUAGE.includes(base)) {
      return null;
    }
    return NAMES.of(base) ?? null;
  } catch {
    return null;
  }
}
