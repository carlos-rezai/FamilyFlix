import type { DetailsState, LibraryTitle } from '@/types';
import { spellYearSpan } from '@/utils';

/** The tone of a **Details state**'s dot, a theme colour's name. */
export type DotTone = 'success' | 'info' | 'warning';

/** The **Title row**'s words, every sentence spelled once. */
export interface TitleRowView {
  /** The film's year, a show's **Year range**; `null` with none. */
  year: string | null;
  badge: 'Linked' | 'Copied';
  /** _N files_, or _N seasons · N episodes_. */
  files: string;
  dot: { tone: DotTone; label: string };
  /** _Can’t be reached right now_ for an unreachable title, else `null`. */
  unreachable: string | null;
}

const DOTS: Record<DetailsState, { tone: DotTone; label: string }> = {
  synced: { tone: 'success', label: 'Synced with TMDB' },
  own: { tone: 'info', label: 'Your own details' },
  none: { tone: 'warning', label: 'No details' },
};

const counted = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

/** Pure: a **Library title** → the **Title row**'s words. */
export function titleRowView(title: LibraryTitle): TitleRowView {
  return {
    year:
      title.kind === 'movie'
        ? title.year === null
          ? null
          : String(title.year)
        : spellYearSpan(title.year, title.endYear),
    badge: title.linkedFiles === null ? 'Copied' : 'Linked',
    files:
      title.kind === 'movie'
        ? counted(title.files, 'file')
        : `${counted(title.seasons, 'season')} · ${counted(title.episodes, 'episode')}`,
    dot: DOTS[title.details],
    unreachable:
      title.linkedFiles === 'unreachable' ? 'Can’t be reached right now' : null,
  };
}

/**
 * Pure: the toolbar's summary beside a tab — _6 movies · 1 without details_,
 * the second part only when there is one.
 */
export function tabSummary(
  kind: LibraryTitle['kind'],
  titles: readonly LibraryTitle[]
): string {
  const count =
    kind === 'movie'
      ? counted(titles.length, 'movie')
      : `${titles.length} series`;
  const bare = titles.filter((title) => title.details === 'none').length;
  return bare === 0 ? count : `${count} · ${bare} without details`;
}

/** The **Delete dialog**'s words for a copied title (log 47 Q12). */
export interface DeleteView {
  /** _Delete “Coco”?_ */
  heading: string;
  /** The sentence under it: the title leaves FamilyFlix, not undone here. */
  subtitle: string;
  /** **What goes**. */
  goes: string[];
  /** **What stays**: the original in its Library folder, else _Nothing_. */
  stays: string[];
  /** _Delete movie_ / _Delete series_. */
  confirm: string;
}

const COPIED_GOES = [
  'Its details, poster and artwork',
  'Its watch history, rating and heart',
  'FamilyFlix’s copy of its video and subtitles',
];

/** Pure: a copied **Library title** → the **Delete dialog**'s words. */
export function deleteView(title: LibraryTitle): DeleteView {
  const noun = title.kind === 'movie' ? 'movie' : 'series';
  return {
    heading: `Delete “${title.title}”?`,
    subtitle: `This takes the ${noun} out of FamilyFlix. It can’t be undone from here.`,
    goes: COPIED_GOES,
    stays:
      title.originalPath === null
        ? ['Nothing']
        : [
            'Your original in its library folder — Scan folders would bring it back',
          ],
    confirm: `Delete ${noun}`,
  };
}
