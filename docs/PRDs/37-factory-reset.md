> **Initiative:** `factory-reset`
> **Design log:** `docs/design-logs/37-factory-reset.md`
> **Issue:** #297
> **Build order:** step 20, the fifth of the third chain (log 32 Q3). It ships as two issues: the wire, then the surface

## Problem Statement

I keep the family library up to date. Sometimes I want to start over: after
testing an import against the wrong folder, after a messy first migration, or
before handing the machine to someone else. Right now the only way is to quit
FamilyFlix, find `%APPDATA%\FamilyFlix\` in Explorer, and delete the database,
the media folder and the uploaded codec pack by hand. I have to know where
they are, which files matter, and that I mustn't touch the log or my own
movie folders. Nothing in the app tells me any of this, and it is easy to get
wrong.

## Solution

The Storage card in Settings gets one more row, under a divider: **Factory
reset**, with a line saying what it erases and that my own folders are not
touched, and a red _Reset…_ button. The button opens the **Reset dialog**.
The dialog asks _Erase everything?_, warns _This can't be undone._, and lists
plainly **What goes** (every title with its watch history, ratings and
hearts; the library folders list; every setting, the TMDB key included;
everything in the media folder; an uploaded playback component) and **What
stays** (my library folders and every file in them; my exports; FamilyFlix
itself). _Erase everything_ comes first and _Cancel_ second, as in the Delete
dialog. A stray Enter does nothing, because focus starts on the card.

If an import or a Sync is running, the reset is refused with one sentence in
the dialog telling me to stop it first, and nothing is erased. A run that is
only waiting in review is let go. Otherwise FamilyFlix empties the database
in one transaction (the genre pool stays), empties the media folder as far as
it can, removes an uploaded component, and reloads onto the library, which
now reads _Your library is empty_. My Library folders on disk, my Export
folders and the Shell log are never touched.

## User Stories

1. As the maintainer, I want a Factory reset row on the Storage card, so that I can start over without knowing where `%APPDATA%` is.
2. As the maintainer, I want the row under a divider after the space line, so that the destructive action sits apart from the reads above it.
3. As the maintainer, I want the row's line to read _Erase every title, watch history and setting, and empty the media folder. Your own folders are not touched._, so that I know what it does before I press anything.
4. As the maintainer, I want a `danger` `sm` _Reset…_ button, so that the colour warns me and the ellipsis tells me a dialog follows.
5. As the maintainer, I want the row drawn before the Storage report lands, so that the control never waits on a read it doesn't need.
6. As the maintainer, I want the row drawn in a browser too, so that the reset doesn't depend on the desktop bridge.
7. As the maintainer, I want pressing _Reset…_ to open a dialog rather than erase at once, so that one click can't wipe the library.
8. As the maintainer, I want the dialog titled _Erase everything?_ with _This can't be undone._ under it and a warning glyph, so that the stakes are clear.
9. As the maintainer, I want a **What goes** list, so that I see every kind of thing I'm about to lose.
10. As the maintainer, I want a **What stays** list naming my library folders, my exports and FamilyFlix itself, so that I'm sure my own files are safe.
11. As the maintainer, I want _Erase everything_ first and _Cancel_ second, so that the dialog reads like the Delete dialog I already know.
12. As the maintainer, I want focus on the dialog card when it opens, so that a reflexive Enter does nothing.
13. As the maintainer, I want Escape, the scrim, ✕ and _Cancel_ to close the dialog without erasing, so that backing out is always easy.
14. As the maintainer, I want _Erase everything_ to read _Erasing…_ and be disabled while the request is in flight, so that I can't send it twice.
15. As the maintainer, I want the reset refused with _An import is running. Stop it before erasing everything._ while an import is scanning or importing, so that a copy in progress isn't pulled out from under itself.
16. As the maintainer, I want the reset refused with _A sync is running. Stop it before erasing everything._ while a Sync is running, so that a TMDB write can't land on an emptied library.
17. As the maintainer, I want a refusal shown in danger ink above the buttons, so that I see why nothing happened.
18. As the maintainer, I want a refusal to stay until I press _Erase everything_ again, so that it behaves as the Export's refusals do.
19. As the maintainer, I want a refused reset to erase nothing at all, so that I can stop the run and try again safely.
20. As the maintainer, I want an import or a Sync waiting in review let go by the reset, so that a stale review doesn't block starting over.
21. As the maintainer, I want every title, episode, subtitle, genre link, library folder and setting erased, so that the library really is empty afterwards.
22. As the maintainer, I want the TMDB key erased with the other settings, so that a reset machine carries none of my credentials.
23. As the maintainer, I want the twelve genres kept, so that the Movie form's genre chips are there when I start adding again.
24. As the maintainer, I want the database emptied in one transaction, so that a failure leaves the library as it was rather than half-erased.
25. As the maintainer, I want the media folder emptied but kept, so that the Storage card still shows its path and _Open folder_ still opens it.
26. As the maintainer, I want one locked file not to stop the rest of the media folder from being emptied, so that a file Windows holds open costs only that file.
27. As the maintainer, I want a missing media folder to be nothing to do, so that a reset on a fresh install doesn't fail.
28. As the maintainer, I want a link inside the media folder removed as a link and never followed, so that nothing outside the media folder can be deleted.
29. As the maintainer, I want an uploaded playback component removed, so that the next Play uses the Default component again.
30. As the maintainer, I want a component that can't be removed right now (in use, or failing) not to fail the reset, so that the Codecs page simply still shows it with its ✕.
31. As the maintainer, I want my Library folders on disk and everything in them never touched, so that the reset can't cost me a single original movie.
32. As the maintainer, I want my Export folders and the Shell log never touched, so that backups and diagnostics survive.
33. As the maintainer, I want the app to reload onto the library after a reset, so that every screen starts from nothing and reads _Your library is empty_.
34. As the maintainer, I want the reload to be a push onto `/`, so that it is a **Fresh home** like _Add to library_ and Import's _Finish_.
35. As the maintainer, I want the Ultrawide margins and the Snackbar stack to start fresh after the reload, so that nothing on screen remembers the erased library.
36. As a family member, I want this device's volume and the last-seen version kept, so that the reset doesn't touch what belongs to the device rather than the library.
37. As the maintainer, I want a failed request (not a refusal) to leave the dialog as it was with the button live again, so that I can retry or cancel.
38. As the maintainer, I want the database emptied before the media folder, so that a failure partway leaves at worst stranded files Space used will show, never rows pointing at nothing.
39. As a developer, I want the erased and kept tables spelled as two lists, so that the rule is read in one place.
40. As a developer, I want a guard that fails when a migration adds a table in neither list, so that a future table can't slip past the reset unnoticed.
41. As a developer, I want the route to reach SQLite through `LibraryStorage` only, so that the router still never touches `db/`.
42. As a developer, I want the route to compose the domains itself, so that no `services/` by another name appears.
43. As the maintainer, I want the prototype to show the row and the dialog before the code does, so that the prototype stays the spec.
44. As a family member, I want nothing on my screens to change, so that browsing and watching look as they did.

## Implementation Decisions

- **Two issues.** First the wire: `resetDatabase`, `LibraryStorage.reset()`, `Media.emptyRoot()` and `POST /api/reset`, which can be checked with a request alone. Then the surface: the prototype revision first, then `factoryReset`, `useFactoryReset`, `ResetDialog`, the Storage card's row and the reload.
- **`resetDatabase(db)` (new unit under `db/`, the `seriesSeed/` precedent).** It erases every row of every table but `genres` in one transaction. Two exported lists spell the rule:
  - `ERASED_TABLES`, child-first: `movie_genres`, `subtitles`, `series_genres`, `episode_subtitles`, `episodes`, `movies`, `series`, `library_folders`, `settings`.
  - `KEPT_TABLES`: `genres`.
  - The genre pool is **kept, not re-seeded**. Nothing has written `genres` since migration 1, so a delete and re-insert would only mint new ids for the same twelve names. `user_version` is untouched. No `VACUUM`. The table list is never read off `sqlite_master` at run time, because a new table would then be erased without anyone deciding it should be.
- **`LibraryStorage.reset(): void`** hands over to `resetDatabase`, the seam `close()` already is. The router never imports `db/`.
- **`Media.emptyRoot(): void`**, a fourth removal on `createMedia`. It removes each entry directly inside the media root on its own (`rmSync`, recursive, each failure swallowed). The root itself stays. A missing root is nothing to do. `rmSync` removes a symlink as a link and never follows it.
- **`POST /api/reset`**, composed in the route (`DELETE /movies/:id`'s precedent), in this order:
  1. `409 { error }` when the importer's current run is `scanning` or `importing`: "An import is running. Stop it before erasing everything."
  2. `409 { error }` when the enrichment's current run is `running`: "A sync is running. Stop it before erasing everything."
  3. `enrichment.cancel()`, letting go a Sync in review.
  4. `storage.reset()`, the transaction.
  5. `media.emptyRoot()`, best-effort.
  6. `playback.removeComponent()`, its outcome ignored (`nothing-uploaded` is the usual answer; `in-use` or `failed` leaves a pair the Codecs page still shows).
  7. `await importer.cancel()`, letting go an import in review.
  8. `204`.
  - Steps 1–6 are synchronous, so no request can land between the check and the erase. The one `await` comes last, over a run that is only waiting. There is no `factoryReset(world)` unit: no domain owns all five calls, and `shell/` is the process lifecycle.
- **`factoryReset()`** in `features/settings/api/` (one caller): `{ kind: 'reset' }` for a `204`, `{ kind: 'refused'; sentence }` for a `409` carrying an `error`, and a rejection for anything else.
- **`useFactoryReset()`** in `features/settings/useFactoryReset/` answers `{ resetting, refusal, reset }`. On `reset` it calls `window.location.assign('/')`, a push and a full reload. A refusal is held until the next press (the Export's rule). A rejection leaves the state as it was, with `resetting` false again (the Delete dialog's rule).
- **`ResetDialog`** in `features/settings/ResetDialog/`, three files, on `Modal`:
  - `title` "Erase everything?", `subtitle` "This can't be undone.", `icon` `BangTriangleIcon`, decorative as every Modal icon is.
  - Two lists, each a small heading over a `ul`. **What goes**: "Every title, with its watch history, ratings and hearts" · "The library folders list" · "Every setting, the TMDB key included" · "Everything in the media folder" · "An uploaded playback component". **What stays**: "Your library folders and every file in them" · "Your exports" · "FamilyFlix itself".
  - The refusal sentence in danger ink above the buttons, when there is one.
  - _Erase everything_ (`danger`, _Erasing…_ and disabled in flight), then _Cancel_ (`secondary`).
  - Focus stays on the card, `Modal`'s existing rule. There is no `initialFocus` prop and no type-to-confirm.
- **The Storage card.** After the space line, a `Divider`, then a `Row $last`: `RowTitle` "Factory reset" over `RowDesc` "Erase every title, watch history and setting, and empty the media folder. Your own folders are not touched.", and a `danger` `sm` Button "Reset…". The row is a control, not a read: drawn before the report lands and in a browser too. `StorageSection` owns the dialog's `open` state.
- **After the reset.** `location.assign('/')` is the **third Fresh home**. `will-navigate` allows it, because `/` is on the app's own origin. The two `localStorage` keys (volume, `seenVersion`) stay: they belong to the device, not the library. `location.replace` is not used, because a Fresh home is a push. A router `navigate('/')` is not used, because every provider would keep what it read before the erase.
- **Prototype first, in the surface issue.** `page.SettingsPage.dc.html` gains the divider, the row and the dialog in an `sc-if`. `COMPONENT-SPEC.md` gains a ResetDialog entry.

## Testing Decisions

- A good test checks what a unit answers, what the wire carries, or what a person sees. It never checks how a unit is wired inside. Server units are tested over sandboxes and real SQLite, the route over the composed router, and the hook and dialog through the DOM and `fakeResponse`.
- **`resetDatabase`**: over a filled database, every erased table is empty and `genres` holds the same twelve ids. The table guard reads `sqlite_master` after every migration and fails for a table in neither list. Atomicity: a `RAISE(ABORT)` trigger on the last erased table leaves every row in every table in place. Prior art: `seriesSeed`'s and the migrations' suites.
- **`createMedia` (`emptyRoot`)**: the root's files and folders are gone and the root itself remains; a missing root is nothing; a symlink's target outside the root survives. Prior art: its `removeMovieFolder` cases.
- **`routes.reset`**: `204` over a filled library, filled media and an uploaded component, then `/api/home` empty, the root empty and the component gone. Each `409`, using `heldCopy` for a running import and `fakeTmdb`'s held call for a running Sync, with nothing erased. A review run of each kind is let go. Prior art: `routes.export` and the Delete route's suites.
- **`api` (`factoryReset`)**: `204` is `reset`, `409` with an `error` is `refused` with that sentence, anything else rejects. Prior art: `saveTmdbKey`'s outcome cases.
- **`useFactoryReset`**: `resetting` in flight; the reload onto `/` on success; a refusal held until the next press; a rejection leaves the state as it was. The reload is observed through a new `src/test-support/stubLocation/`, the `stubScrollTo` precedent for a browser call jsdom does not perform, if jsdom needs it.
- **`ResetDialog`**: the title, subtitle and both lists' copy; confirm before Cancel (`comesBefore`); _Erasing…_ and disabled in flight; the refusal drawn above the buttons; Cancel closes without a request. Prior art: `DeleteMovieDialog`'s suite.
- **`StorageSection`**: the row comes after the space line (`comesBefore`), is drawn before the report lands and without the bridge, and its button opens the dialog.

## Out of Scope

- Resetting part of the library (only the films, only the watch history, …).
- Clearing the device's `localStorage`.
- A backup before erasing: the Roadmap's **Back up the library**.
- Touching any Library folder, Export folder, or the Shell log.
- Shrinking the database file (`VACUUM`).
- Type-to-confirm, or a second confirmation.
- Re-seeding the genre pool.

## Further Notes

- Glossary entries were updated in log 37's commit: **Factory reset**, **Reset dialog** and **Fresh home** (now three). ✅ is ticked in README and CLAUDE.md only after the step's refactor, not when the build issues close.
- Every future migration that adds a table must also decide whether a reset erases it. That is the guard's point.
- The order is load-bearing: database first, so a failure partway leaves at worst stranded files that Space used will show, never rows pointing at nothing.
