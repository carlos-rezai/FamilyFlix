> **Initiative:** `show-folder-title`
> **Issue:** #628 (the PRD, step 48)
> **Design log:** `docs/design-logs/65-show-folder-title.md`
> **Handoff:** `docs/handoff/feat.MovieForm.dc.html` (one comment amended by log 65)
> **Build order:** step 48, **Show folder title**. It ships as thin slices (log 65, _Implementation Plan_). No migration, no new route, no screen: the **Show folder read** answers the picked folder's **Folder key**, and the form prefills its title and year from it.

## Problem Statement

The maintainer adds a series by hand on the **Movie form**: _＋ Add show folder_, then picks `E:\Series\Severance (2022–)`. The form types _Severance (2022–)_ into the Title field. If the maintainer had pressed _Scan all folders_ instead, the same folder would arrive as _Severance_, year 2022. One folder gets two names depending on which button was used.

The cause is that the **Show folder pick** still names a show by the importer's older **Title guess** rule. That rule strips a `(2022)` but not a range like `(2022–)`, and it cleans release names (`Severance.S01.1080p.WEB-DL`), which a scan no longer does. A scan reads a folder's name as its **Folder key** (log 64): the name is the title, and a year at the end is the year.

The pick also ignores the year. The folder name says 2022, and a scan would store 2022, but the form leaves the Year field empty until a Sync fills it.

## Solution

A picked show folder is named exactly as _Scan all folders_ names it.

- **The title is the folder's Folder key.** `Severance (2022–)/` types _Severance_; `Heat (1995)/` types _Heat_; `Heat/` types _Heat_. A name the old guess cleaned (`Severance.S01.1080p.WEB-DL`, `Seinfeld 1989`) is typed verbatim, as a scan would read it, and the maintainer edits it before Save if they want to.
- **The year is filled too.** `Severance (2022–)/` puts 2022 in the Year field. A folder with no year at the end fills no year, and a Sync still fills an empty year from TMDB as before.
- **A typed value is never overwritten.** Title and year each follow the rule the title already had: a pick fills the field when it is empty, or when it still holds what the earlier pick filled. Anything the maintainer typed stays, whether typed before or after the pick.
- **A picked Season folder** still stands for its show, and is named by the show's folder.

Nothing on screen changes apart from what the two fields are filled with.

## User Stories

1. As the maintainer, I want picking `Severance (2022–)/` to type _Severance_ into the title, so that the form names the show as _Scan all folders_ would.
2. As the maintainer, I want picking `Severance (2022–)/` to put 2022 into the Year field, so that I don't wait for a Sync to learn a year the folder already states.
3. As the maintainer, I want picking `Severance (2022-2025)/` or `Severance (2022–2025)/` to fill year 2022, so that either dash and a closed range read like a scan reads them.
4. As the maintainer, I want picking `Heat (1995)/` to type _Heat_ and fill 1995, so that the usual folder spelling still works.
5. As the maintainer, I want picking a yearless `Death Note/` to type _Death Note_ and leave the Year field empty, so that no year is invented.
6. As the maintainer, I want picking `Severance.S01.1080p.WEB-DL/` to type that name verbatim, so that the form and the library agree on one rule, and I can edit the field before Save.
7. As the maintainer, I want picking `Seinfeld 1989/` to type _Seinfeld 1989_ and fill no year, so that a bare number is never dropped from the title as a year that is then never filled.
8. As the maintainer, I want picking `Heat (1995) [1080p]/` to type that name verbatim with no year, so that text after the brackets is read as a scan reads it.
9. As the maintainer, I want picking a `Season 1/` folder to name the show by its parent folder, so that picking the season folder still works as before.
10. As the maintainer, I want a title I typed before the pick to stay, so that a pick never overwrites my work.
11. As the maintainer, I want a year I typed before the pick to stay, so that a pick never overwrites my work.
12. As the maintainer, I want a typed title with an empty year still to take the folder's year, so that each field is decided on its own.
13. As the maintainer, I want a typed year with an empty title still to take the folder's title, so that each field is decided on its own.
14. As the maintainer, I want a second pick to replace the title the first pick filled, so that picking the wrong folder first is harmless.
15. As the maintainer, I want a second pick to replace the year the first pick filled, so that picking `Heat (1995)/` and then `Heat (1986)/` shows 1986.
16. As the maintainer, I want a second pick of a yearless folder to empty the year the first pick filled, so that the form never keeps a year from a folder I no longer picked.
17. As the maintainer, I want a title or year I typed after the first pick to survive a second pick, so that my edits are never thrown away.
18. As the maintainer, I want an emptied field (one I cleared by hand) to be filled by the next pick, so that clearing a field means "fill it for me".
19. As the maintainer, I want the refusal for an already held folder to name the held series' title, so that the message names the show as the library shows it.
20. As the maintainer, I want that refusal to fall back to the folder's Folder key title when no held series is named, so that `Severance is already in your library.` reads cleanly and not with its range.
21. As the maintainer, I want a picked show's year to be saved like any typed year, so that a Sync treats it as filled and does not replace it.
22. As the maintainer, I want the Sync still to fill an empty year from TMDB, so that a yearless folder gets its year the usual way.
23. As the maintainer, I want the title prefill from a picked video's file name (`titleFromFilename`) to work as before, so that a release-named file still gets a clean guess.
24. As the maintainer, I want everything else about a pick (episodes numbered, Unplaced videos, stray subtitles, Link or Copy, the held check) unchanged, so that only the naming changes.
25. As the maintainer, I want a browser session (no shell) unchanged, so that the form without a Show folder pick behaves as before.
26. As the maintainer, I want the TMDB **Search query** to keep cleaning release noise, so that a Sync of a release-named title still finds its match.

## Implementation Decisions

- **One initiative** (log 65 Q1), step 48, `show-folder-title`. `titleFromFilename` and **Missing videos** (step 49) are not in it.
- **The spec** (Q2): one comment in the movie form prototype, already amended: an empty title takes the folder's title, and an empty year its year, both read as a scan reads the folder. No layout, state or copy change.
- **Show folder read** (import-export domain, Q3, Q4, Q8):
  - `readShowFolder` reads the Show folder's name by the media domain's `folderKeyOf`, the scan's own reader, and answers its `title` and `year`. A picked Season folder is still resolved to its Show folder first (`showFolderOf`), unchanged.
  - No guess on top of the key: a release name is the title, verbatim.
- **The wire** (Q8): `ShowFolderRead` loses `titleGuess: string` and gains `title: string` and `year: number | null`, flat beside its other fields, documented as the picked folder's Folder key. No nested `folderKey` (the server's `FolderKey` carries a `name` the form never needs). `GET /api/show-folder` answers the new shape; the route itself is unchanged.
- **`useShowFolderPick`** (Q9):
  - Its input `prefillTitle(guess, picked)` becomes `prefillFolderKey(key, picked)`, where both are the read's `title` and `year` (`Pick<ShowFolderRead, 'title' | 'year'>`), and `picked` is `null` before any pick.
  - Its ref `pickedTitle` becomes `pickedKey`, holding the last pick's title and year.
  - The held refusal reads `held?.series.title ?? read.title`.
- **`useMovieForm`'s `prefillFolderKey`** (Q6, Q7): in one `setValues`, each of title and year is replaced when it is empty (trimmed) or still equals what `picked` filled; otherwise it stays. The year is written as the field's text, `String(year)`, or `''` for a `null` year (which only lands when the field was empty or picked, so a yearless second pick empties a picked year). Title and year are decided independently, never as one unit.
- **`titleGuess` retires** (Q5): deleted from the `titleKey` unit with its test tables. `dropReleaseNoise`, `stripTails` and `RELEASE_NOISE` stay for `searchQuery`; `titleKey` is untouched.
- **No migration, no new route, no page, no new unit, no setting** (Q10).
- **Documents** (Q13): the docblocks of `readShowFolder`, `ShowFolderRead`, `useShowFolderPick` and `useMovieForm`'s prefill; `titleFromFilename`'s docblock and its test header, which name the retired `titleGuess` as their counterpart. The glossary, checklist and prototype comment were done in the grill-me.
- **Slices** (log 65, _Implementation Plan_):
  1. The read answers the key: `readShowFolder` and `ShowFolderRead` move to `title` and `year`; the hook prefills the title from `title`; the refusal reads `read.title`. Demo: pick `Severance (2022–)/` in the shell, and the title reads _Severance_.
  2. The year is prefilled: `prefillFolderKey` fills the year by the picked-or-empty rule. Demo: the Year field reads 2022; a second pick of a yearless folder empties it; a typed year stays.
  3. The guess retires: `titleGuess` and its test tables go; the docblocks.

## Testing Decisions

- A good test drives a unit through its public face and asserts what a caller or the maintainer would see: the title and year a picked folder answers, the shape the route returns, and what the Title and Year fields read after a pick. It never asserts which helper ran or which ref held what.
- **`readShowFolder`**: each `titleGuess` expectation becomes `title` and `year`; new rows for `Severance (2022–)` (_Severance_, 2022), `Heat` (_Heat_, `null`) and a release-named folder kept verbatim with `null`; a picked Season folder titled by its Show folder. Prior art: the `readShowFolder.*.test.ts` files over temp folders.
- **`routes.showFolder`**: the answered shape carries `title` and `year` and no `titleGuess`. Prior art: `routes.showFolder.test.ts`.
- **`useShowFolderPick`**: `prefillFolderKey` called with the read's key and `null` on a first pick, then with the first pick's key on a second; not called on a refused (held) pick; the refusal names the held series, else `read.title`. Prior art: `useShowFolderPick.test.ts`.
- **`MovieForm.showFolderTitle`** (the integrated form): an empty year filled; a typed year kept; a typed title with an empty year taking only the year; a second pick replacing the picked year, and emptying it for a yearless folder; a year typed after the first pick surviving the second. Prior art: `MovieForm.showFolderTitle.test.tsx`.
- **Fixtures**: every `ShowFolderRead` literal in the movie form's tests (`api`, `formValues`, the `MovieForm.*` suites) moves to `title` and `year`; their expectations do not otherwise change.
- **`titleKey.test.ts`**: loses its `titleGuess` tables; the `searchQuery` and `titleKey` tables stay green unchanged, which is the guard that the shared helpers still serve the Search query.
- Slice 1's and 2's demos in the shell are the acceptance: pick `Severance (2022–)/` on the series add and read _Severance_, 2022; pick a yearless folder next and see the picked year emptied; type a year and pick again to see it kept.

## Out of Scope

- `titleFromFilename`, the Title guess off a picked video's file name (Q1).
- Missing videos, step 49 (Q1).
- Renaming a picked folder, or warning that its name looks like a release name.
- Any change to what a pick numbers, holds-checks or links.
- Any change to the Search query or `titleKey`.

## Further Notes

- The trade-off is accepted: a release-named show folder now types its release name into the title, to be edited before Save, where the old guess cleaned it; a bare `Seinfeld 1989` keeps its number in the title.
- The maintainer approved every recommendation of log 65 in advance; this PRD adds no decision the log doesn't hold, apart from spelling out that an emptied field counts as empty (user story 18, the existing title rule) and that `titleFromFilename`'s docblocks lose their reference to the retired `titleGuess`.
