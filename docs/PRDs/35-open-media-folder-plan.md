# Plan: Open the media folder — an Open folder button on the Storage card

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/291

Today the Storage card in Settings shows the path of the **Managed media
directory**, but the path can only be read. To look inside the folder, the
maintainer types `%APPDATA%\FamilyFlix\media` into Explorer by hand.

This is build step 18, the third of the third chain (log 32 §5), and a
`feat:`. The PRD and design log 35 Q9 decide that it ships as **one issue with
two commits**, and the plan keeps that. A `refactor:` commit comes first and
moves `folderBridge` into `src/api/` with no change in behaviour. Then a
`feat:` commit adds the whole slice. The refactor prepares the slice and is not
a vertical slice of its own, so it is the phase's first commit rather than a
phase.

## Running the phase

Phase 1 runs AFK under `issue-loop`. The prototype revision comes first in the
same issue, before the code (log 35). It relabels one button in a file that
already exists, so it does not need a HITL stop.

## Architectural decisions

Durable decisions that apply across the phase:

- **Routes**: unchanged. No HTTP route, wire call, server domain or migration
  is added. The only new path is an IPC channel between the renderer and main.
- **Schema**: no migration.
- **Key models**:
  - **Shell paths** gains `mediaRoot`. When installed it is
    `join(userData, 'media')`. Unpackaged (`dev` and `start`) it is
    `join(appPath, 'media')`, the directory that the server's default
    `./media` resolves to under `serverCwd`. main never builds the path
    itself.
  - **Server launch**: when installed, the fork's `FAMILYFLIX_MEDIA_PATH` is
    `paths.mediaRoot`, so the server and the button read one spelling of the
    path. Unpackaged, the launch still sets nothing, and a developer's own
    variable is honoured as it is today.
  - **The channel**: `FOLDER_CHANNELS.openMedia` =
    `'familyflix:folders:open-media'`. It is an `invoke` that takes **no
    argument** and resolves to nothing once main is done. The renderer never
    names a path.
  - **Folder bridge**: `openMedia(): Promise<void>` is its third member,
    beside `pick` and `pickOne`.
  - **The open**: a main-process unit shaped like `shellDialogs`, over an
    injected world (`mkdir`, `openPath`, `log`). It runs a recursive `mkdir`
    first and then the open. Any failure, whether `openPath` answers an error
    string or `mkdir` throws, is one Shell log line:
    `Couldn’t open the media folder: <error>`, with the root named. It never
    rejects.
- **Boundaries**:
  - `folderBridge` moves to `src/api/`, because Settings is the second
    feature to read `window.familyflix?.folders`, and no feature imports
    another's wire. `updateBridge` stays where it is.
  - The button is drawn only when the bridge exists, whether or not the
    **Storage report** has landed. **Blank until it lands** governs reads,
    not controls.
  - Nothing appears after a press: no busy state, no snackbar and no error
    face.
  - _Change…_ stays the Roadmap's **Move the media folder**.

---

## Phase 1: Open folder on the Storage card

**User stories**: 1–21

### What to build

**Commit 1, `refactor:`.** Move `folderBridge` and its unchanged suite from
the import-export feature into `src/api/`, imported by path. Repoint the
Library folders page and the Export dialog to it. Update `familyflix.d.ts`'s
comment and CLAUDE.md's `api/` list to name it. Nothing changes in behaviour.

**Commit 2, `feat:`.**

1. **The prototype.** Revise it first: in `page.SettingsPage.dc.html`, the
   Storage card's _Change…_ button becomes _Open folder_, with the same
   element and styles.
2. **The shell.** Add `mediaRoot` to Shell paths, and have the server launch
   read it when installed. Add the open unit and its suite. Add the channel
   constant and the bridge member, register main's handler beside the two
   pickers, and add the preload's one line.
3. **The fake bridge.** Its third member counts presses, following its `pick`
   and `pickOne` counters.
4. **The button.** In the Storage card's folder row, after the title and the
   path, add a secondary `sm` _Open folder_ button. It keeps its full width
   while a long path shortens with an ellipsis.
5. **The Package smoke.** Add its one check.

When this phase is done, pressing _Open folder_ in the desktop app opens the
media folder in Explorer, even on a fresh install with nothing imported yet.
In a browser, the row looks the same as it does today.

### Acceptance criteria

- [ ] The `refactor:` commit moves `folderBridge` into `src/api/` with its
      suite unchanged. The Library folders page's and the Export dialog's
      suites pass untouched apart from the import paths
- [ ] The Settings prototype's Storage card reads _Open folder_ where it read
      _Change…_
- [ ] `mediaRoot` is `userData\media` when installed and `<appPath>\media`
      in `dev` and `start`
- [ ] Installed, the server's `FAMILYFLIX_MEDIA_PATH` is `paths.mediaRoot`.
      A fake Shell paths with a distinct root proves the value is read, not
      rebuilt. Unpackaged, the variable is not set
- [ ] The open unit makes the root before opening it
- [ ] Given `''`, the open unit logs nothing. Given an error string, it logs
      one line naming the root and the error
- [ ] When `mkdir` throws, the open unit logs the failure and opens nothing.
      The unit never rejects
- [ ] The channel takes no argument, and the bridge member is named
      `openMedia`
- [ ] In a browser there is no _Open folder_
- [ ] Under the fake bridge, the button is drawn before the report lands and
      comes after the path. One press calls `openMedia` once, and the button
      can be pressed again right away
- [ ] The button is the `Button` primitive, `secondary` and `sm`, with no
      glyph and `flex: 0 0 auto`
- [ ] `docs/release-checklist.md`'s Package smoke checks that Open folder
      opens `%APPDATA%\FamilyFlix\media`, on a fresh install too
- [ ] The full suite, `tsc -b --force`, ESLint and Prettier are green
- [ ] Checked in `electron:dev`, since the IPC is untested wiring: the press
      opens the repo's own `media` folder in Explorer
