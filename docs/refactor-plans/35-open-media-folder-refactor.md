# Refactor plan: Open the media folder — the shell's paths made whole, one try in the open, the button placed as log 35 ruled, and the docs that close it

> Source initiative: [`open-media-folder`, issue #291](https://github.com/carlos-rezai/FamilyFlix/issues/291)
> Shipped by issue 292 (`e55f33c` refactor, `549283e` RED, `ad6d593` GREEN).
> Design log: `docs/design-logs/35-open-media-folder.md`. Plan:
> `docs/PRDs/35-open-media-folder-plan.md`.
> Filed as issue 293.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._

## Problem Statement

`open-media-folder` shipped as log 35 Q9 ruled: a `refactor:` commit that
moved `folderBridge` into `src/api/`, then one `feat:` slice. The slice
revised `page.SettingsPage.dc.html`, gave **Shell paths** a `mediaRoot`, had
`serverLaunch` read it when installed, built `electron/openMediaFolder/` and
its suite, added `FOLDER_CHANNELS.openMedia`, the bridge's third member, the
preload line and main's handler, taught `fakeFolderBridge` to count
`openMedias()`, drew _Open folder_ on the Storage card, and added two
Package smoke checks.

Every log-35 ruling was read against the code for this filing. Q1–Q4 and
Q6–Q9 hold: `mediaRoot` in both branches and nowhere else spelled, the unit
over an injected world that makes, opens and logs and never rejects, an
`invoke` with no argument, the bridge read once through `api/`, no busy
state, no notice, the prototype first. The full suite of the slice is green
(117 leaves across the five touched suites). What the slice left behind is of
five kinds.

### 1. The invariant log 35 said it restored is still false

Log 35 Q1 says that after `mediaRoot`, "every path main hands the Server
process comes from Shell paths" holds again, and the glossary states it as
an invariant. It does not hold. `serverLaunch` still joins two of the
installed paths itself: `FAMILYFLIX_DB_PATH` from `userData` and
`familyflix.db`, and `FAMILYFLIX_COMPONENT_PATH` from `userData` and
`playback-component`. Those two joins are the only reason `serverLaunch`
still takes `userData` beside `paths`. `mediaRoot` showed the shape: a field
on Shell paths in both branches, read by the launch only when installed. The
database and the **Component slot** have not followed it.

`serverLaunch`'s docblock also took the slice's edit without a reflow, so
**Trusted hosts** is broken across two lines mid-bold.

### 2. Two failure paths, two spellings, one untested

`openMediaFolder` has two `try` blocks, each with its own
`error instanceof Error ? error.message : String(error)`. The first catches a
`mkdir` that throws; the second catches an `openPath` that rejects. The suite
covers the first and not the second, so the unit's "never rejects" promise
rests partly on a branch no leaf runs. One `try` around make-then-open keeps
the behaviour (a throwing `mkdir` still opens nothing) with one spelling of
the message.

### 3. Main builds the world inline

Every other injected world in `main.ts` is a named, typed constant with a
docblock (`logFs: LogFileSystem`, `dialogWorld: DialogWorld`). The Open
folder handler builds its `MediaFolderWorld` as a literal inside the
`ipcMain.handle` callback, rebuilt on every press, and wraps `mkdirSync` in a
block body where `logFs.mkdir` uses an expression. Log 35 Q2 wrote the
handler as `openMediaFolder(paths.mediaRoot, world)`.

### 4. The button is placed by a child selector, not as log 35 ruled

Log 35 Q5 placed the button through `styled(Button)` as `OpenFolder`, with
`flex: 0 0 auto`. That is how every caller in the codebase places a control
it adds chrome to (`styled(IconButton)` eight times, `styled(NavigationRow)`
twice). The slice could not: `Button` does not forward `className`, where
`IconButton` and `NavigationRow` both do, for exactly this reason. So it
wrote `& > button { flex: 0 0 auto; }` inside `Folder` — the only element
selector on a primitive in `src/`, coupled to the tag the primitive happens
to render.

### 5. Tests and docs the slice left stale

- `StorageSection.test`'s first describe still holds _draws no Change…
  button — the title and path alone on their line_. In the desktop app the
  line is no longer the title and path alone, and its no-button assertion is
  now the browser describe's _draws no Open folder_.
- `serverLaunch.test` has the slice's media leaves in a describe of their
  own, beside issue 228's _every path from ShellPaths_, which is the same
  claim about the other paths.
- `fakeFolderBridge`'s docblock took the slice's edit without a reflow.
- **The glossary** still marks `mediaRoot` and `openMedia()` _(log 35, 🔜)_
  and says `folderBridge` is "graduating" to `src/api/`.
- **CLAUDE.md**: the `electron/` tree has no `openMediaFolder/` line; the
  preload line names `pick` and `pickOne` only; the `shellPaths/` line omits
  the media root; the Foundation entry calls the folder bridge "the native
  folder picker". Step 18 and its Settings hub entry are 🔜.
- **README**: step 18 and its status row are 🔜.
- **The dev journal** has no entry for the build and none for this round.

## Solution

Five groups. The tree is working and green after every commit:

0. **The record.** The build's journal entry first, so it describes what
   shipped before this round changes anything.
1. **The shell.** The open unit's one `try`, main's named world, and Shell
   paths made whole — the database and the Component slot joining
   `mediaRoot`, and `serverLaunch` losing `userData`.
2. **The frontend.** `Button` forwards `className`, and _Open folder_ is
   placed as `OpenFolder`.
3. **The tests' tidies.** The stale Storage leaf, the fake's docblock.
4. **The docs.** Last, because they describe the tree the earlier groups
   leave. They close 291 and this issue.

That's sixteen commits. No wire, schema, channel, environment variable value
or pixel changes. Every installed path the server receives is the same
string before and after.

## Commits

### Group 0: the record of what was built

1. **The journal's open-media-folder build entry.** A new top entry, _Open
   the media folder (issue #292)_, in the earlier build entries' sections:
   - What shipped: the `folderBridge` move, `mediaRoot`, `serverLaunch`
     reading it, `openMediaFolder` and its suite, the channel and member,
     the preload and main lines, the fake's counter, the button, the
     prototype relabel and the two Package smoke checks — one refactor, one
     RED and one GREEN commit, as Q9 ruled.
   - The deviation the build made: `& > button` in place of Q5's
     `styled(Button)`, because `Button` forwards no `className`.
   - The judgement calls left for this round: items 1–5 above, by name.
   - What was deliberately not built: everything log 35 rules out.
   - The test and file counts at the end of the build, measured at
     `ad6d593`.
   - The follow-ups, which are this plan, by bare number.

   Docs only.

### Group 1: the shell

2. **The open unit's rejecting `openPath` is pinned.** One new leaf in
   `openMediaFolder.test`'s _openPath refuses_ describe: a world whose
   `openPath` rejects with an `Error` is logged as one line opening
   _Couldn’t open the media folder:_, naming the error and the root, and the
   call still resolves to nothing. The recorded world gains an
   `openRejects` option beside `mkdirThrows`. It passes against the code as
   it stands — it pins the branch before the next commit reshapes it. Test
   only.

3. **One `try`, one spelling of the message.** `openMediaFolder` becomes one
   `try` around `mkdir` then `openPath`, a non-empty answer logged inside
   it, and one `catch` logging whatever was thrown or rejected. The
   `instanceof Error` reading is spelled once, as a local helper beside
   `failed`. A throwing `mkdir` still opens nothing, because it throws
   before the open. The docblock is unchanged. Every leaf passes unchanged.

4. **Main names the Open folder world.** A module-level
   `mediaFolderWorld: MediaFolderWorld` beside `dialogWorld`, with a
   one-line docblock on that constant's pattern (Node's `mkdirSync`,
   `shell.openPath` and the **Shell log**, for Open folder). Its `mkdir`
   takes `logFs.mkdir`'s expression form. The handler becomes
   `() => openMediaFolder(paths.mediaRoot, mediaFolderWorld)`, its comment
   kept. Untested wiring, as today; the typecheck carries it.

5. **Shell paths answer the database and the Component slot.** Two fields
   join `mediaRoot` on `ShellPaths`, each with a docblock in the
   `mediaRoot` field's style: `database` (installed `userData\familyflix.db`,
   unpackaged `<appPath>\familyflix.db` — where the server's default
   `./familyflix.db` resolves under `serverCwd`) and `componentSlot`
   (installed `userData\playback-component`, unpackaged
   `<appPath>\playback-component`, likewise). `shellPaths.test` gains the
   four leaves, beside the two `mediaRoot` ones. Every fake `ShellPaths` in
   `serverLaunch.test` gains the two fields so it still typechecks. Nothing
   reads them yet.

6. **`serverLaunch.test`'s path claims in one describe.** Issue 228's
   _every path from ShellPaths_ describe absorbs issue 292's media
   describe: its fake gains a distinct `mediaRoot` (it has one) and the
   media leaves move in unchanged — installed reads `paths.mediaRoot`,
   `dev` and `start` set no `FAMILYFLIX_MEDIA_PATH`. The describe's header
   comment names both issues. Test only; leaf count unchanged.

7. **The launch reads the database and the slot off Shell paths.** When
   installed, `FAMILYFLIX_DB_PATH` is `paths.database` and
   `FAMILYFLIX_COMPONENT_PATH` is `paths.componentSlot`; unpackaged still
   sets neither. In the describe from commit 6, the installed leaf becomes
   one `it.each` over the three variables and their fields
   (`FAMILYFLIX_DB_PATH`/`database`, `FAMILYFLIX_MEDIA_PATH`/`mediaRoot`,
   `FAMILYFLIX_COMPONENT_PATH`/`componentSlot`), against the fake whose
   paths share no root with `userData`, and the unpackaged leaf likewise
   over the three. The existing installed-environment leaves, which assert
   the `userData` strings, pass unchanged against the real `shellPaths`
   fixture — that is the proof no value moved.

8. **`serverLaunch(mode, paths)`.** The `userData` parameter, unread since
   commit 7, goes. Main's one call site and the suite's call sites drop the
   argument. The docblock is rewritten for the new truth — every path it
   hands the fork is one Shell paths answered, the database, the media and
   the slot among them — and reflowed, mending the split **Trusted hosts**.
   Every leaf passes unchanged apart from the dropped argument.

### Group 2: the frontend

9. **`Button` forwards `className`.** An optional `className` on the
   button's face, passed to `Root` in both forms, with the docblock line
   `IconButton` carries ("which is how each call site adds its own
   chrome"). `Button.test` gains `IconButton.test`'s leaf: it wears a
   `className` a caller hands it, in the button form and the link form.
   Nothing else changes; every existing `Button` suite passes.

10. **_Open folder_ is placed as `OpenFolder`.** `StorageSection.styles`
    gains `OpenFolder = styled(Button)` with `flex: 0 0 auto` and its
    docblock (the button holds its width while a long path takes the
    ellipsis, as the prototype's _Change…_ did). `Folder` loses its
    `& > button` rule, and its docblock loses the sentence about the button.
    `StorageSection` draws `<OpenFolder …>` with the same props. The
    _keeps its width_ and _is the Button primitive_ leaves pass unchanged —
    they read the button, not the selector.

### Group 3: the tests' tidies

11. **The Storage card's _Change…_ leaf says what it still proves.**
    _draws no Change… button — the title and path alone on their line_
    becomes _draws no Change… — Move the media folder is not built_, and
    keeps only its `/change/i` assertion. The no-button-in-a-browser
    assertion is the browser describe's _draws no Open folder_, which
    already holds it. Test only.

12. **`fakeFolderBridge`'s docblock reflowed.** The overlong last line
    wrapped to the file's width, the words unchanged. Test-support only.

### Group 4: the docs

13. **The glossary.** The **Shell paths** row drops _(log 35, 🔜)_, and
    names the database and the Component slot beside `mediaRoot`. The
    **Folder bridge** row drops its 🔜 and says `folderBridge()` lives in
    `src/api/` (graduated in log 35). The **Shell paths** invariant is
    unchanged in words — it is now true. Docs only.

14. **CLAUDE.md ticks step 18.** The `electron/` tree gains an
    `openMediaFolder/` line (the Storage card's _Open folder_ answered in
    main: make the root, open it, log a failure, never reject; the
    `shellDialogs` shape); the preload line names `openMedia`; the
    `shellPaths/` line names the media root, the database and the
    Component slot; the `serverLaunch/` line reads
    `serverLaunch(mode, paths)`; the Foundation entry's preload sentence
    names the **Folder bridge**. Step 18 and the Settings hub's _Open the
    media folder_ entry become ✅. Docs only. Closes 291.

15. **README ticks step 18.** Step 18 and its status row become ✅. Docs
    only.

16. **The refactor's journal entry.** A new top entry, _Open the media
    folder refactor (issue 293)_, on issue 290's entry's sections:
    what each group changed, the invariant made true, the follow-ups by bare
    number. Docs only. Closes this issue.

## Decision Document

- **Shell paths are whole.** `ShellPaths` answers `database`,
  `componentSlot` and `mediaRoot` in both branches, each the directory the
  server's own default resolves to under `serverCwd` when unpackaged. The
  names follow the field list's nouns (`renderer`, `ffmpeg`, `mediaRoot`)
  and the glossary's **Component slot**.
- **The launch reads, never joins.** `serverLaunch(mode, paths)`: when
  installed it hands the fork the three data paths off Shell paths; `dev`
  and `start` hand none of them, so a developer's own variable is still
  honoured — log 35's rule for the media path, extended to its two
  siblings. The glossary's invariant ("every path main hands the Server
  process comes from Shell paths") becomes true as written.
- **The open unit's contract is unchanged.** `openMediaFolder(root, world)`
  makes, then opens, logs any failure as one line naming the root, and
  never rejects. Its body becomes one `try`; a rejecting `openPath` is now a
  tested path rather than a defensive one.
- **Main's worlds are named.** `mediaFolderWorld` joins `logFs` and
  `dialogWorld` as module-level, typed, documented constants.
- **`Button` forwards `className`**, as `IconButton` and `NavigationRow`
  do, so callers place it with `styled(Button)`. No other prop changes.
- **_Open folder_ is `OpenFolder`**, `styled(Button)` with
  `flex: 0 0 auto`, as log 35 Q5 ruled. No element selectors on a
  primitive.
- **Unchanged:** the channel name, the bridge member, `FOLDER_CHANNELS`'
  home in `libraryFolders.ts`, the log line's words, the preload,
  `useState(folderBridge)`, the prototype, the Package smoke checks.

## Testing Decisions

- A good test checks what a unit answers or what a user sees, never how it
  is wired. Shell units over injected worlds; the Storage card through the
  DOM and the fake bridge.
- **`openMediaFolder`**: one new leaf for a rejecting `openPath`, written
  before the reshaping commit and passing on both sides of it. Prior art:
  its own `mkdirThrows` leaves.
- **`shellPaths`**: four new leaves, `database` and `componentSlot` per
  branch, beside the `mediaRoot` pair.
- **`serverLaunch`**: one describe for "every path from ShellPaths"; the
  installed and unpackaged leaves `it.each` over the three data variables
  against a fake whose paths share no root with `userData`, proving each is
  read, not rebuilt. The existing installed-environment leaves, unchanged,
  prove no value moved.
- **`Button`**: one leaf, `IconButton.test`'s _wears a className_, in both
  forms.
- **`StorageSection`**: no new leaf; the flex and face leaves already hold
  the placement. One leaf renamed and narrowed.
- `main.ts` and `preload.ts` stay untested wiring. After commit 8, one
  manual check under `electron:dev`: the app starts on the repo's library,
  Settings → Storage → _Open folder_ opens the repo's `media`, and Codecs
  still reads the slot — because the launch changed shape.
- Every commit: the touched suites, `tsc -b --force`, ESLint and Prettier
  green. Before the docs group: the full suite.

## Out of Scope

- One shared reading of a thrown value. `instanceof Error ? … : String(…)`
  is spelled in `createUpdates`, `shellDialogs`, `openMediaFolder` and the
  server's `shellHandshake` — across two tsconfig projects. A unit of its
  own, if ever; recorded as a follow-up in the journal.
- Moving `FOLDER_CHANNELS` or `FolderBridge` out of `libraryFolders.ts`.
- The log line's wording, or a notice for a failed open (log 35 Q6).
- Unpackaged, main honouring a developer's own `FAMILYFLIX_*_PATH` for the
  button (log 35, Trade-offs).
- The logs directory and the failure dialog's `userData`: main reads them
  itself, and neither is handed to the Server process.
- _Change…_ — the Roadmap's **Move the media folder**.

## Further Notes

- Log 35 is an immutable snapshot; its claim in Q1 that the invariant
  "holds again" is recorded in the journal as not yet true at `ad6d593`,
  and made true by commits 5–8.
- `Button` forwarding `className` is the one primitive change. It widens
  the face by one optional prop and changes no existing call site.
