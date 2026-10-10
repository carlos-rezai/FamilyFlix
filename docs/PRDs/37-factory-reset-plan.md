# Plan: Factory reset — erase everything FamilyFlix made from Settings

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/297

Today the only way to start over is to quit FamilyFlix, find
`%APPDATA%\FamilyFlix\` in Explorer, and delete the database, the media
folder and the uploaded codec pack by hand, without touching the Shell log or
the maintainer's own movie folders.

This is build step 20, the fifth of the third chain (log 32 Q3), and a
`feat:`. The PRD and design log 37 decide that it ships as **two issues**:
first the wire, then the surface. The plan keeps that split, one phase per
issue.

## Running the phases

Phase 1 runs AFK under `issue-loop`. A request alone can check it, and it
draws nothing.

Phase 2 is **HITL**. Its first step revises the prototype. Unlike the last two
steps, that revision does not reshape a row that already exists: it draws a new
row and a whole new dialog. `issue-loop` stops at this issue, so the
maintainer can review the revision before any code is built against it.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**:
  - `POST /api/reset` → `204`, with no body in either direction.
  - `409 { error }` while an import is `scanning` or `importing`: "An import
    is running. Stop it before erasing everything."
  - `409 { error }` while a Sync is `running`: "A sync is running. Stop it
    before erasing everything."
  - The order is load-bearing:
    1. Check the import.
    2. Check the Sync.
    3. `enrichment.cancel()`.
    4. `storage.reset()`.
    5. `media.emptyRoot()`.
    6. `playback.removeComponent()`, its outcome ignored.
    7. `await importer.cancel()`.
    8. `204`.

    Steps 1–6 are synchronous, so no request can land between the check and
    the erase. The one `await` comes last, over a run that is only waiting.

  - The route composes the domains itself (`DELETE /movies/:id`'s precedent).
    There is no `factoryReset(world)` unit and no `services/`.

- **Schema**: no migration. `user_version` is untouched, and there is no
  `VACUUM`.
  - `ERASED_TABLES`, child-first: `movie_genres`, `subtitles`,
    `series_genres`, `episode_subtitles`, `episodes`, `movies`, `series`,
    `library_folders`, `settings`.
  - `KEPT_TABLES`: `genres`. It is kept with its ids, not re-seeded.
  - Both lists are spelled once, in a new unit under `db/` (the `seriesSeed/`
    precedent), and are never read off `sqlite_master` at run time. A guard
    reads `sqlite_master` after every migration and fails for a table in
    neither list.
- **Key models and seams**:
  - `LibraryStorage.reset(): void` is the router's only way to SQLite, the
    seam `close()` already is.
  - `Media.emptyRoot(): void` is `createMedia`'s fourth removal. It removes
    each entry inside the media root on its own, each failure swallowed. The
    root stays, a missing root is nothing to do, and a link is removed as a
    link and never followed.
  - The client's wire call has two outcomes and a rejection:
    `{ kind: 'reset' }` for a `204`, `{ kind: 'refused'; sentence }` for a
    `409` carrying an `error`, and a rejection for anything else.
  - After a reset, `window.location.assign('/')` is the **third Fresh home**:
    a push and a full reload, so every provider starts fresh. Neither
    `location.replace` nor a router `navigate` is used.
  - The device's two `localStorage` keys (volume, `seenVersion`) are not
    touched.
- **Never touched**: any Library folder on disk, any Export folder, the Shell
  log.

---

## Phase 1: The reset wire

**User stories**: 15, 16, 19–32, 38–42

### What to build

The server half, end to end, with no UI.

1. **The database reset.** A new unit under `db/` erases every row of every
   table in `ERASED_TABLES`, child-first, in one transaction, and leaves
   `genres` as it was. It exports the two lists. A guard over a fully migrated
   database fails for any table in neither list.
2. **The storage seam.** `LibraryStorage.reset()` hands over to that unit.
3. **The media removal.** `Media.emptyRoot()` empties the media root
   best-effort and keeps the root itself.
4. **The route.** `POST /api/reset` composes the importer, the enrichment,
   the storage, the media and the playback domain in the order the
   architectural decisions give, answering each `409` before anything is
   erased.

When this phase is done, a `POST /api/reset` against a filled dev library
answers `204`. Afterwards `/api/home` is empty, the genre pool still holds its
twelve genres, the media root exists and is empty, and the Codecs report shows
the Default component again. Against a running import or Sync, it answers
`409` with the sentence, and nothing is erased.

### Acceptance criteria

- [ ] Over a filled database, every table in `ERASED_TABLES` is empty
      afterwards, and `genres` holds the same twelve rows with the same ids
- [ ] The table guard fails when a migration adds a table that is in neither
      list
- [ ] With a `RAISE(ABORT)` trigger on the last erased table, the reset
      throws and every row in every table is still in place
- [ ] `user_version` is unchanged by a reset
- [ ] The router reaches SQLite only through `LibraryStorage.reset()` and
      never imports `db/`
- [ ] `emptyRoot` removes the root's files and folders and keeps the root. A
      missing root is not an error. A symlink inside the root is removed, and
      its target outside the root survives
- [ ] A file that cannot be removed does not stop the other entries from
      being removed, and does not throw
- [ ] `POST /api/reset` over a filled library, filled media and an uploaded
      component answers `204`. Afterwards `/api/home` is empty, the media root
      is empty and the component is gone
- [ ] With an import `scanning` or `importing` (held with `heldCopy`), the
      route answers `409` with the import sentence, and nothing is erased
- [ ] With a Sync `running` (held with `fakeTmdb`), the route answers `409`
      with the sync sentence, and nothing is erased
- [ ] An import in review and a Sync in review are each let go, and the reset
      goes ahead
- [ ] A component that cannot be removed (`in-use`, `failed`) does not fail
      the reset
- [ ] The full suite, `tsc -b --force`, ESLint and Prettier are green

---

## Phase 2: The Factory reset row and the Reset dialog

**User stories**: 1–14, 17, 18, 33–37, 43, 44

### What to build

The surface, over the wire from Phase 1. **HITL**: the prototype revision is
reviewed before anything is built against it.

1. **The prototype.** Revise it first. `page.SettingsPage.dc.html`'s Storage
   card gains a divider after the space line and the Factory reset row:
   "Factory reset" over "Erase every title, watch history and setting, and
   empty the media folder. Your own folders are not touched.", with a
   `danger` `sm` "Reset…" button. The Reset dialog sits in an `sc-if`.
   `COMPONENT-SPEC.md` gains a ResetDialog entry.
2. **The wire call.** It lives in the settings feature's own `api/`, because
   it has one caller, and it reads the two outcomes and the rejection.
3. **The hook.** It answers `{ resetting, refusal, reset }`. `resetting` is
   true while the request is in flight. A `reset` outcome reloads onto `/`. A
   refusal is held until the next press, the Export's rule. A rejection leaves
   the state as it was with `resetting` false again, the Delete dialog's rule.
   If jsdom cannot observe the reload, a new `src/test-support/stubLocation/`
   does it, the `stubScrollTo` precedent.
4. **The dialog.** It is drawn on `Modal` with the title "Erase everything?",
   the subtitle "This can't be undone." and `BangTriangleIcon`. Under them come
   the **What goes** and **What stays** lists in the PRD's copy, then the
   refusal in danger ink when there is one, then the buttons: _Erase
   everything_ (`danger`, reading _Erasing…_ and disabled in flight) before
   _Cancel_ (`secondary`). Focus stays on the card. There is no initial-focus
   prop and no type-to-confirm.
5. **The Storage card.** The row comes after the space line. It is a control,
   not a read: it is drawn before the Storage report lands, and in a browser
   without the folder bridge. The card owns the dialog's open state.

When this phase is done, the maintainer can press _Reset…_ on the Storage
card, read what goes and what stays, and press _Erase everything_. The app
then reloads onto a library that reads _Your library is empty_. While an
import or a Sync runs, the dialog shows the one sentence instead, and nothing
is erased.

### Acceptance criteria

- [ ] The prototype draws the divider, the Factory reset row and the Reset
      dialog, and `COMPONENT-SPEC.md` has a ResetDialog entry, before any
      code in this phase. The maintainer has reviewed them
- [ ] The wire call reads a `204` as `reset` and a `409` with an `error` as
      `refused` with that sentence. Anything else rejects
- [ ] The hook reports `resetting` while the request is in flight, and
      reloads onto `/` with `location.assign` on success
- [ ] A refusal is held until the next press. A rejection leaves the state as
      it was, with the button live again
- [ ] The dialog draws its title, its subtitle and both lists' copy exactly as
      the PRD gives them
- [ ] _Erase everything_ comes before _Cancel_. In flight it reads
      _Erasing…_ and is disabled
- [ ] A refusal is drawn in danger ink above the buttons
- [ ] Cancel, Escape, the scrim and ✕ each close the dialog with no request
      sent
- [ ] Focus is on the dialog card when it opens, so Enter alone erases
      nothing
- [ ] The Factory reset row comes after the space line. It is drawn before the
      Storage report lands and without the folder bridge, and its button opens
      the dialog
- [ ] No Family-facing screen changes
- [ ] The full suite, `tsc -b --force`, ESLint and Prettier are green
