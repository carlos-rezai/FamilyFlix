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

/** Pure: the empty card's line for a tab of `kind` that holds nothing. */
export function emptyLine(kind: LibraryTitle['kind']): string {
  return kind === 'movie'
    ? 'No movies in your library.'
    : 'No series in your library.';
}

/** The **Clear dialog**'s words (log 47 Q13), `DeleteView`'s twin. */
export interface ClearView {
  /** The sentence under _Clear details?_. */
  subtitle: string;
  /** **What goes**. */
  goes: string[];
  /** **What stays**. */
  stays: string[];
}

/** Everything a **Clear details** empties, as the dialog lists it. */
const CLEAR_GOES = [
  'Year, synopsis, credits and genres',
  'Poster, backdrop and artwork',
  'Its TMDB match and score',
];

/** Everything it keeps. */
const CLEAR_STAYS = ['Its title and files', 'Watch history, rating and heart'];

/** Pure: a **Library title** → the **Clear dialog**'s words. */
export function clearView(title: LibraryTitle): ClearView {
  const noun = title.kind === 'movie' ? 'movie' : 'series';
  return {
    subtitle: `The ${noun} stays in your library under its title, with no details, until you edit it or sync it with TMDB.`,
    goes: [...CLEAR_GOES],
    stays: [...CLEAR_STAYS],
  };
}

/** The **Delete dialog**'s words (log 47 Q12). */
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
  /** The linked callout for `folder` and `videos`, else `null`. */
  callout: string | null;
}

const SHARED_GOES = [
  'Its details, poster and artwork',
  'Its watch history, rating and heart',
];

const LINKED_CALLOUT =
  'This is a linked title. Its files go from your library folder to the Recycle Bin, not just out of FamilyFlix.';

/** What goes beyond the details and history, by the title's files. */
function filesGoing(title: LibraryTitle): string[] {
  switch (title.linkedFiles) {
    case null:
      return ['FamilyFlix’s copy of its video and subtitles'];
    case 'folder':
      return ['Its folder, to the Recycle Bin'];
    case 'videos':
      return ['Its video file(s), to the Recycle Bin'];
    case 'unreachable':
      return [];
  }
}

/** What stays, by the title's files. */
function filesStaying(title: LibraryTitle): string[] {
  if (title.linkedFiles === 'unreachable') {
    return [`Its files on ${title.path} — they can’t be reached right now`];
  }
  return title.linkedFiles === null && title.originalPath !== null
    ? ['Your original in its library folder — Scan folders would bring it back']
    : ['Nothing'];
}

/** Pure: a **Library title** → the **Delete dialog**'s words. */
export function deleteView(title: LibraryTitle): DeleteView {
  const noun = title.kind === 'movie' ? 'movie' : 'series';
  return {
    heading: `Delete “${title.title}”?`,
    subtitle: `This takes the ${noun} out of FamilyFlix. It can’t be undone from here.`,
    goes: [...SHARED_GOES, ...filesGoing(title)],
    stays: filesStaying(title),
    confirm: `Delete ${noun}`,
    callout:
      title.linkedFiles === 'folder' || title.linkedFiles === 'videos'
        ? LINKED_CALLOUT
        : null,
  };
}
