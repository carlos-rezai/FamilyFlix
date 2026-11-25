/**
 * _What the scanner accepts_ as the amended `feat.ImportFlow.dc.html` draws it
 * (log 76): the film and the series examples line by line, the three rules
 * word for word with their names in mono, and what the block no longer says.
 * `FolderShapes` and both pages that draw it test against these.
 */

/** The film example, one entry per drawn line, its indent left out. */
export const FILM_EXAMPLE = [
  'Heat (1995)\\',
  'Heat.mkv',
  'Images\\poster.jpg',
  'Images\\backdrop.jpg',
  'Subtitles\\English.srt',
];

/** The series example, one entry per drawn line, its indent left out. */
export const SERIES_EXAMPLE = [
  'The Show (2019)\\',
  'Images\\poster.jpg',
  'Season 01\\',
  'The Show S01E01.mkv',
  'Images\\poster.jpg',
  'Images\\Stills\\S01E01.jpg',
  'Subtitles\\S01E01\\English.srt',
];

/** The three rules, in order, word for word. */
export const RULES = [
  'A folder with one video is a film; one with Season folders (Season 01) is a series.',
  'Each episode’s number comes from its filename (S01E03, 1x03), its season from its Season folder.',
  'Art goes in Images\\, named ending in poster or backdrop; subtitles go in Subtitles\\. Anything it can’t place lands in the review list.',
];

/** The folder and file names the rules set in mono. */
export const RULE_NAMES = [
  'Season 01',
  'S01E03',
  '1x03',
  'Images\\',
  'poster',
  'backdrop',
  'Subtitles\\',
];

/** What the retired shape lines and folder-first sentence said. */
export const RETIRED = [
  'subs.en.srt',
  'Show Name\\',
  'loose episodes',
  'the folder first',
];

/** Text with every run of whitespace (the indent's no-break spaces too) as one space. */
export const normalized = (text: string | null) =>
  (text ?? '').replace(/\s+/g, ' ').trim();

/** Does `text` hold every one of `lines`, each after the one before it? */
export function holdsInOrder(text: string, lines: readonly string[]): boolean {
  let from = 0;
  for (const line of lines) {
    const at = text.indexOf(line, from);
    if (at < 0) return false;
    from = at + line.length;
  }
  return true;
}

/** The deepest element whose text holds every one of `texts`. */
export function innermostHolding(...texts: string[]): HTMLElement {
  const holding = Array.from(document.body.querySelectorAll('*')).filter(
    (element) => {
      const text = normalized(element.textContent);
      return texts.every((part) => text.includes(part));
    }
  );
  const deepest = holding.filter(
    (element) =>
      !holding.some((other) => other !== element && element.contains(other))
  );
  if (deepest.length !== 1) {
    throw new Error(
      `expected one element holding ${JSON.stringify(texts)}, found ${deepest.length}`
    );
  }
  return deepest[0] as HTMLElement;
}
