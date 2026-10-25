/**
 * A title's **Details state**, the Title row's dot: `synced` — a TMDB match
 * held; `none` — nothing a Sync fills held; `own` — anything else.
 */
export const DETAILS_STATES = ['synced', 'own', 'none'] as const;

export type DetailsState = (typeof DETAILS_STATES)[number];

/**
 * A title's **Linked files**, what a Delete that asks for the Recycle Bin
 * would move there: its Source folder whole, its unshared linked videos alone,
 * nothing when every video is another held title's too (`shared`), or nothing
 * while its Library folder can't be read. A copied title has none: `null`.
 */
export type LinkedFiles = 'folder' | 'videos' | 'shared' | 'unreachable';

/**
 * The **Recycle choice** a Delete is confirmed with: `keep` the title's
 * Linked files where they lie, or `trash` them to the Recycle Bin.
 */
export type DeleteFiles = 'keep' | 'trash';

/** What both kinds of **Library title** carry. */
interface LibraryTitleBase {
  id: string;
  title: string;
  year: number | null;
  /**
   * Absolute: a linked title's Source folder (a Collection folder film's
   * video), else its Media folder.
   */
  path: string;
  /** `null` for a copied title. */
  linkedFiles: LinkedFiles | null;
  /** A copied title's Source folder in a Library folder, absolute; else `null`. */
  originalPath: string | null;
  details: DetailsState;
}

/**
 * One **Library title** as `GET /api/library-titles` answers it — a film with
 * its file count, or a show with its Year range and counts.
 */
export type LibraryTitle =
  | (LibraryTitleBase & { kind: 'movie'; files: number })
  | (LibraryTitleBase & {
      kind: 'series';
      endYear: number | null;
      seasons: number;
      episodes: number;
    });

/**
 * A title's **Delete facts**: what its **Delete dialog** reads to say what
 * goes and what stays, the Manage library list's and a detail read's alike.
 */
export type DeleteFacts = Pick<
  LibraryTitle,
  'path' | 'linkedFiles' | 'originalPath'
>;

/** What `deleteView` reads off a title: a **Library title**'s, or a page's. */
export type DeleteSubject = Pick<LibraryTitle, 'kind' | 'title'> & DeleteFacts;

/** A film **Library title**, the Movies tab's row. */
export type LibraryMovieTitle = Extract<LibraryTitle, { kind: 'movie' }>;

/** A show **Library title**, the Series tab's row. */
export type LibrarySeriesTitle = Extract<LibraryTitle, { kind: 'series' }>;

/** The **Manage library page**'s one read: both tabs, each A–Z. */
export interface LibraryTitles {
  movies: LibraryMovieTitle[];
  series: LibrarySeriesTitle[];
}
