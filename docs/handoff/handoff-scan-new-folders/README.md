# Scan new folders: handoff

Step 37, design log `docs/design-logs/54-scan-new-folders.md`. Two changes:

1. The **Library folders page** scans only the folders no run has walked yet,
   with a second press for every folder.
2. A scan (or a sheet import) with _Also fetch metadata and posters from TMDB_
   ticked hands on to a Sync over **just what the run added**, not the whole
   library.

Prototype: `prototype/page.LibraryFoldersPage.dc.html` (open it over a local
server, e.g. `python -m http.server` in `prototype/`; it is self-contained,
with mock data: one scanned folder, one unreachable, one new). The changed
molecule is `prototype/mol.FolderRow.dc.html`. The other files are unchanged
copies the page imports. No screenshots were taken: no browser was available
to the session.

Phase 1 of the log carries these into `docs/handoff/` (`page.LibraryFoldersPage`,
`mol.FolderRow`, `feat.EnrichmentFlow`, the model in `FamilyFlix.dc.html`) and
`COMPONENT-SPEC.md`.

## The Folder row: a New folder's line

A **New folder** is a listed Library folder with `scannedAt: null`: no run has
walked it to review. The row's second line:

| Folder                 | Line                          | Colour      |
| ---------------------- | ----------------------------- | ----------- |
| Unreachable (any mark) | _Can't be reached right now_  | `danger`    |
| Scanned                | _214 titles_                  | `textFaint` |
| New, no titles         | _Not scanned yet_             | `textFaint` |
| New, holding titles    | _38 titles · not scanned yet_ | `textFaint` |

Same 13px sans line as today; no badge, no tint. Import setup's listed folders
draw the same line (`folderLine`).

New prop on `mol.FolderRow`: `scanned: boolean` (default `true`). In code the
row already takes the whole `LibraryFolderView`, so it reads
`folder.scannedAt === null`.

## The group Scan: two presses

The shapes, the Import mode and the TMDB box are unchanged. The single _Scan
folders_ becomes a row of two `lg` buttons, `gap: 12px`, wrapping on a narrow
window:

| Button               | Variant     | Disabled when           | Walks                           |
| -------------------- | ----------- | ----------------------- | ------------------------------- |
| **Scan new folders** | `primary`   | no New folder is listed | the New folders, in order added |
| **Scan all folders** | `secondary` | no folder is listed     | every listed folder (today's)   |

Both send the Import mode and the box with `scope: 'new' | 'all'`, both push
`/import`, and both are held while either is in flight. `/import` is unchanged:
its `Scanning   <path>` lines name exactly the folders walked. When the run
reaches review, every folder it **read** is marked scanned; an unreachable one
stays new. (The prototype's mono line under the buttons stands in for the push
to `/import`; it is not drawn in the app.)

## The Sync after the run: Just what was added

_Finish_ on a run carrying `enrich` (_Continue to TMDB sync_) pushes
`/enrich?added=<run.startedAt>` instead of `/enrich?scope=all`. Sync setup's
_What to sync_ then draws three cards, the third chosen:

| Card                    | Line                                                      |
| ----------------------- | --------------------------------------------------------- |
| Only what's missing     | _12 titles have no synopsis or artwork_ (as today)        |
| Everything              | _250 titles, re-checks ones already filled in_ (as today) |
| **Just what was added** | _3 titles this run brought in_                            |

Same `scopeCard` / `scopeDot` styles as the other two. The third card is drawn
only with `?added=`. "Added" means every title created since the run started,
plus a held series that took new episodes; it plans fields as _Everything_
does. Review's _Done_ still goes to the fresh home.

## Copy changes elsewhere

- The Manage library line for a title whose original lies in a Library folder
  names _Scan all folders_ instead of _Scan folders_.
- The TMDB box's hint is unchanged (_Runs straight after the scan, over
  everything it brings in._), and is now true.
