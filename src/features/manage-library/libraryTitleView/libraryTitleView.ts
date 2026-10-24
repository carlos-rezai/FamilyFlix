import type { DeleteFiles, DetailsState, LibraryTitle } from '@/types';
import {
  enrichPath,
  movieFormPath,
  moviePath,
  seriesPath,
  spellYearSpan,
} from '@/utils';

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

/** Where a **Title row**'s presses go, `addLeaving`'s precedent. */
export interface TitlePaths {
  /** The **Movie form**'s edit of the title. */
  edit: string;
  /** The title's own page. */
  page: string;
  /** Its Sync, **Started on arrival**. */
  sync: string;
}

/** Pure: a **Library title** → where _Edit details_ and _Sync with TMDB_ go. */
export function titlePaths(title: LibraryTitle): TitlePaths {
  return title.kind === 'movie'
    ? {
        edit: movieFormPath({ movie: title.id }),
        page: moviePath(title.id),
        sync: enrichPath({ movie: title.id, start: true }),
      }
    : {
        edit: movieFormPath({ series: title.id }),
        page: seriesPath(title.id),
        sync: enrichPath({ series: title.id, start: true }),
      };
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

/** The **Delete dialog**'s words (log 47 Q12, log 51 Q6). */
export interface DeleteView {
  /** _Delete “Coco”?_ */
  heading: string;
  /** The sentence under it: the title leaves FamilyFlix, not undone here. */
  subtitle: string;
  /** **What goes**. */
  goes: string[];
  /** **What stays**: what the delete leaves on disk, else _Nothing_. */
  stays: string[];
  /** _Delete movie_ / _Delete series_, on either card. */
  confirm: string;
  /** The linked callout, on the **Recycle choice**'s second card only. */
  callout: string | null;
}

/** What `deleteView` reads off a title: a **Library title**'s, or a page's. */
export type DeleteSubject = Pick<
  LibraryTitle,
  'kind' | 'title' | 'path' | 'linkedFiles' | 'originalPath'
>;

const SHARED_GOES = [
  'Its details, poster and artwork',
  'Its watch history, rating and heart',
];

const LINKED_CALLOUT =
  'This is a linked title. Its files go from your library folder to the Recycle Bin, not just out of FamilyFlix.';

/** A linked title's own files, by its Linked files; `null` for the rest. */
function ownFiles(title: DeleteSubject): string | null {
  switch (title.linkedFiles) {
    case 'folder':
      return 'Its folder';
    case 'videos':
      return 'Its video file(s)';
    default:
      return null;
  }
}

/**
 * Whether the **Recycle choice** is drawn for `title`: a linked title whose
 * files can be moved, `folder` or `videos`. The shell is the caller's to add.
 */
export function offersRecycleChoice(title: DeleteSubject): boolean {
  return ownFiles(title) !== null;
}

/** What goes beyond the details and history, by the title's files. */
function filesGoing(title: DeleteSubject, own: string | null, trash: boolean) {
  if (title.linkedFiles === null) {
    return ['FamilyFlix’s copy of its video and subtitles'];
  }
  return own !== null && trash ? [`${own}, to the Recycle Bin`] : [];
}

/** What stays, by the title's files and the choice. */
function filesStaying(
  title: DeleteSubject,
  own: string | null,
  trash: boolean
): string[] {
  if (title.linkedFiles === 'unreachable') {
    return [`Its files on ${title.path} — they can’t be reached right now`];
  }
  if (title.linkedFiles === 'shared') {
    return ['Its video file(s), which another title plays'];
  }
  if (own !== null && !trash) {
    return [`${own}, in your library folder`];
  }
  return title.linkedFiles === null && title.originalPath !== null
    ? ['Your original in its library folder — Scan folders would bring it back']
    : ['Nothing'];
}

/**
 * Pure: a title and the **Recycle choice** → the **Delete dialog**'s words.
 * `keep` lists a linked title's files under What stays; `trash` moves them to
 * What goes, keeps _Nothing_ and draws the callout.
 */
export function deleteView(
  title: DeleteSubject,
  files: DeleteFiles = 'keep'
): DeleteView {
  const noun = title.kind === 'movie' ? 'movie' : 'series';
  const own = ownFiles(title);
  const trash = own !== null && files === 'trash';
  return {
    heading: `Delete “${title.title}”?`,
    subtitle: `This takes the ${noun} out of FamilyFlix. It can’t be undone from here.`,
    goes: [...SHARED_GOES, ...filesGoing(title, own, trash)],
    stays: filesStaying(title, own, trash),
    confirm: `Delete ${noun}`,
    callout: trash ? LINKED_CALLOUT : null,
  };
}
