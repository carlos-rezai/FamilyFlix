# Dev Journal

Running record of what shipped, what was deliberately left alone, and what a
later session should know before touching something. Design logs are immutable
snapshots of a decision at a moment; PRDs and refactor plans describe intent
before the work. This file is the thing in between — written _after_ the work,
and the place a known-but-not-yet-fixed problem goes so that it surfaces as a
follow-up rather than as somebody's later surprise.

Newest entry first.

---

## 2026-10-10 — Export name refactor (issue 296)

Fifteen commits against `docs/refactor-plans/36-export-name-refactor.md`, one
per plan commit. **7771 tests pass across 468 files**, up from 7770 across 468
at the end of the build (`13c4d0b`). The new leaf is `exportBody`'s. `tsc -b
--force` is clean. `eslint src server electron .husky` reports no errors and
the one warning earlier rounds already logged (`AboutSection.test.tsx`'s
escaped dot). No pixel, sentence, status, schema or prototype changed.

### What each group changed

- **Group 0, the record.** The build's own entry, below, written before the
  round touched anything.
- **Group 1, the server.**
  - `EXPORT_REFUSALS` is `{ status, field, error }` again, the shape of every
    other refusal table, and the route reads the status off it.
  - `exportBody` reads the name right after the destination, in the dialog's
    top-to-bottom order, and `StartExport` declares it there.
  - `writeExport`'s docblock was reflowed.
  - `FORBIDDEN_IN_NAME` in `exportName` is the one spelling of what Windows
    refuses in a folder name. `exportRows` builds its global title-folder
    replacer from it.
- **Group 2, the client.**
  - `EXPORT_FIELDS` and `IMPORT_FIELDS` are `as const` lists, with the
    unions derived from them.
  - `isFieldRefusal(body, fields)` replaces `isRefusal` and
    `isExportRefusal`. `refusalSentence` moved beside its one remaining
    caller, the folder add.
  - The hook's `ExportFieldRefusal` and `setDestinationField` were renamed.
  - The hook's and the dialog's docblocks were updated.
- **Group 3, the tests.**
  - `'a\b'` is labelled a backspace, and `writeExport.name.test` checks a
    real backslash.
  - "Dated" was retired from leaves that now ask for a name. The route POST
    suites name their requests with one `NAME`, so only the summary's leaf
    reads the clock.
  - `ExportModal.name.test`'s helpers are `nameField()` and `nameLabel()`.
- **Group 4, the docs.** The glossary, CLAUDE.md (closing 294), the README,
  and this entry.

### The one wire behaviour that moved

A `POST /api/export` body wrong in both its `name` and its _Include_
booleans used to earn the booleans' sentence. It now earns the name's. Our
client never sends such a body. `exportBody.test` pins the new order.

### Where the round met the plan's words and differed

- **The glossary keeps its _(new)_ tags.** The plan said to drop them from
  **Folder name field** and **Name refusal** "as the earlier rounds did". The
  earlier rounds did not: the third chain's section still marks **Detail
  backdrop** and **Open folder** _(new)_. The tags stay, for consistency.
- **An intermittent failure.** One full-suite run late in the round reported
  1 failed of 7771. Its output was not captured, so the leaf is unknown. The
  two runs straight after, and every run before, were green. Nothing in the
  round touches a timer, the network or the clock, apart from removing the
  route suites' clock reads.

### Left as it is

- **`exportRows`' title-folder namer** strips the forbidden characters but
  does not refuse or rename `CON`, `NUL` and the rest, and has no length cap.
  Changing that changes the export's inner folders, so it is a question of
  its own. This is a follow-up, not filed.
- **`media/safeFilename`** has a third look-alike of the character class. It
  guards a file inside a Movie folder, in another domain (log 36 Q4), and is
  left apart on purpose.
- **The prototype's `rowLabel` and `counted`.** These are old names, not
  wrong ones, and the prototype is the spec.

### Follow-ups

The `exportRows` reserved-name question above, unfiled.

---

## 2026-10-10 — Export name (issue #295)

The Export dialog's name row is now the **Folder name field**: a mono
`TextField` under _Save to_, with the title count at its heading's right end.
It is prefilled with today's `familyflix-collection_DD-MM-YYYY` and never
overwritten once edited. The server names the **Export folder** and the sheet
after the name asked for, numbers it if taken, and refuses a name a folder
can't have with one sentence under the field. Nothing is ever stripped.

Three commits, as log 36 Q10 ruled: `04636ab` refactor, `bf0b4b6` RED and
`13c4d0b` GREEN. They follow the plan in `docs/PRDs/36-export-name-plan.md`,
built from `docs/design-logs/36-export-name.md`. **7770 tests pass across 468
files**, measured at `13c4d0b`, up from 7657 across 464 at the end of the Open
the media folder refactor. The four new files are the `.name` suites of
`writeExport`, the route, `useExport` and `ExportModal`.

### What shipped

- **The rename.** `ExportSummary.folderName` became `defaultName`, in a
  `refactor:` commit of its own before the RED.
- **The prototype.** `feat.ExportModal.dc.html` draws the _Folder name_
  section, with _Save to_'s refusal on `destinationRefused` and the name's on
  `nameRefused`. `COMPONENT-SPEC.md`'s entry follows.
- **`exportNameRefusal(name)`**, beside `exportName(now)`. It answers
  `unnamed`, `too-long`, `bad-character`, `bad-ending` or `reserved`, in that
  order, or `null`. Windows' rules apply on every platform, and nothing is
  trimmed.
- **The body** carries `name`, read only as a string.
- **The writer** checks the destination, then the name, and makes the
  folder and the sheet under `request.name`. It lost its `now` parameter, so
  `exportName(now)` has one caller left, `exportSummary`.
- **The route.** Every `EXPORT_REFUSALS` entry names its `field`, and a
  refusal is answered `400 { error, field }`, the same shape as
  `/api/import`.
- **The client.** `startExport` reads `{ kind: 'refused', field, sentence }`
  off a `400` that names a known field. `useExport` gains `name`, `setName`,
  a `nameEdited` ref beside `destinationEdited`, and a fielded refusal.
  `ExportModal` draws the section and each refusal under its own field.
  `NameRow`, `NameLead` and `ExportName` were retired.

### Where the build met the log and differed

- **`EXPORT_REFUSALS` lost `status`.** Log 36's Design typed it
  `{ status, field, error }`. The build replaced `status` with `field`, and
  the route writes a literal `400`. Every other refusal table in the router
  carries its status.

### Judgement calls the log did not name

Each is the refactor round's to settle
(`docs/refactor-plans/36-export-name-refactor.md`):

- **The body reads the name last.** It comes after the two _Include_
  booleans, not after the destination as the dialog and the writer order it.
  `StartExport` declares it last too.
- **Two spellings of one rule.** `exportName`'s `BAD_CHARACTER` and
  `exportRows`' `UNSAFE_IN_NAME` are the same character class. The client's
  `isRefusal` and `isExportRefusal` are the same guard, each spelling its
  field union a second time.
- **Names the second field made wrong.** The hook exports an
  `ExportRefusal` interface, the same name as the server's kind union. Its
  destination setter is still `setField`. Several docblocks took the edit
  without being reflowed, or still describe a dialog with one field.
- **A backslash that is a backspace.** `'a\b'` is labelled _a backslash_ in
  `exportName.test` and `writeExport.name.test`. The latter checks no real
  backslash at all.
- **Tests and docs left stale.** There are "dated" leaf names where the name
  is now asked for, and the route POST suites name their requests off the
  clock. `ExportModal.name.test`'s helper is called `folderName()`. The
  glossary's **Export summary**, **Export dialog**, **Export ready** and
  **Export name** rows are out of date, and step 19 is 🔜 in CLAUDE.md and
  the README.

### Deliberately not built

Everything log 36 rules out:

- remembering a name between opens;
- a name template or date tokens;
- renaming an Export folder after it is written;
- checking the name as it is typed, or anywhere in the client;
- clearing a refusal on the next edit;
- a sheet name that differs from the folder's;
- any other platform's naming rules.

### Follow-ups

The refactor plan, filed as 296.

---

## 2026-10-10 — Open the media folder refactor (issue 293)

Sixteen commits against
`docs/refactor-plans/35-open-media-folder-refactor.md`, one per plan commit.
**7657 tests pass across 464 files**, from 7642 across 464 at the end of the
build (`ad6d593`): one new leaf is `openMediaFolder`'s, six `shellPaths`'
(the unpackaged pair runs under `dev` and `start`), six `serverLaunch`'s
(the data-path tables) and two `Button`'s. `tsc -b --force` is clean, and
`eslint src server electron .husky` reports no errors and the one warning
earlier rounds already logged (`AboutSection.test.tsx`'s escaped dot). No
wire, schema, channel, environment variable value or pixel changed.

### What each group changed

- **Group 0, the record.** The build's own entry, below, written before the
  round touched anything.
- **Group 1, the shell.**
  - `openMediaFolder` is one `try` around make-then-open, the thrown value
    read once by a local `reason`. A leaf for a rejecting `openPath` was
    committed first and passed on both sides of the reshape.
  - `main.ts` names `mediaFolderWorld: MediaFolderWorld` beside
    `dialogWorld`; the handler is
    `openMediaFolder(paths.mediaRoot, mediaFolderWorld)`.
  - **Shell paths are whole.** `ShellPaths` answers `database` and
    `componentSlot` beside `mediaRoot`, in both branches. `serverLaunch`
    reads all three when installed and sets none unpackaged, and is
    `serverLaunch(mode, paths)`: the `userData` parameter is gone. Its
    docblock is rewritten and **Trusted hosts** is whole on one line.
  - `serverLaunch.test`'s media describe is folded into issue 228's _every
    path from ShellPaths_, whose installed and unpackaged leaves are each
    an `it.each` over the three variables. The installed-environment leaves,
    which assert the `userData` strings, passed unchanged.
- **Group 2, the frontend.** `Button` forwards `className`, in both forms,
  and _Open folder_ is `OpenFolder = styled(Button)` with `flex: 0 0 auto`,
  as log 35 Q5 ruled. `Folder`'s `& > button` rule is gone; there is no
  element selector on a primitive in `src/`.
- **Group 3, the tests' tidies.** The Storage card's _Change…_ leaf is
  _draws no Change… — Move the media folder is not built_, asserting only
  that; `fakeFolderBridge`'s docblock is reflowed.
- **Group 4, the docs.** The glossary's **Shell paths** and **Folder
  bridge** rows lose their 🔜 marks and name what landed. CLAUDE.md's tree
  gains `openMediaFolder/`, the preload and `types/` lines name `openMedia`,
  the `shellPaths/` and `serverLaunch/` lines describe the whole Shell paths,
  the Foundation entry names the **Folder bridge**, and step 18 and its
  Settings hub entry are ✅. The README matches.

### The invariant made true

Log 35 Q1 said every path main hands the **Server process** comes from Shell
paths again; at `ad6d593` that was not yet so — the database and the slot
were still joined off `userData` inside `serverLaunch`. After commit 8 it
holds as the glossary words it, and every installed path the server receives
is the same string as before.

### Where the round met the plan's words and differed

- **Commits 2, 6, 11 and 12 were made as `test:`**, the commit gate's type
  for a test-only change; the plan does not type them.
- **Commit 7 also dropped `serverLaunch.ts`' `join` import**, unread once
  the two joins went; ESLint warned on it.
- **Commit 9's leaves read a caller's `margin-top` off the computed style**
  rather than counting class names as `IconButton.test`'s leaf does, so each
  fails against a `Button` that drops `className` — checked by running them
  against the old `Button`.
- **Commit 10 moved `min-width: 0`'s sentence onto `FolderText`'s
  docblock**, the element it describes, as `Folder`'s lost the button's.
- **Commit 11 also mended the suite's header**, which still said _the title
  and path alone on their line_.
- **Commit 14 also fixed the `types/` line's `FOLDER_CHANNELS` list**, which
  the plan did not name and which still read `pick`, `pickOne`.
- **One full run after commit 8 reported a single failing leaf** that two
  reruns did not reproduce; the run's output was not kept, so which leaf is
  not known. Every other full run in the round was green.
- **The manual `electron:dev` check** the plan asks for after commit 8 —
  the app starts on the repo's library, _Open folder_ opens the repo's
  `media`, Codecs still reads the slot — was not run in this round; it is
  the maintainer's.

### Left as it is

- **One shared reading of a thrown value.** `instanceof Error ? … :
String(…)` is spelled in `createUpdates`, `shellDialogs`,
  `openMediaFolder` and the server's `shellHandshake`, across two tsconfig
  projects. A unit of its own, if ever.
- **`FOLDER_CHANNELS` and `FolderBridge` in `libraryFolders.ts`.**
- **The logs directory and the failure dialog's `userData`**: main reads
  them itself, and neither is handed to the Server process.
- Everything log 35 ruled out, as the build's entry lists it.

This entry's commit closes this round, 293. CLAUDE.md's commit closes the
initiative, 291, on push.

---

## 2026-10-10 — Open the media folder (issue #292)

The Storage card's path row draws _Open folder_ in the desktop app: a press
asks main, over a no-argument channel, to make the managed media directory
if it is missing and open it in Explorer, logging a failure to the **Shell
log** and never rejecting. Undrawn in a browser.

Three commits, as log 35 Q9 ruled: `e55f33c` refactor, `549283e` RED and
`ad6d593` GREEN, against the plan in `docs/PRDs/35-open-media-folder-plan.md`,
built from `docs/design-logs/35-open-media-folder.md`. **7642 tests pass
across 464 files**, measured at `ad6d593`, from 7611 across 463 at the end of
the Backdrop veil refactor; the new file is `openMediaFolder`'s suite.

### What shipped

- **The bridge's move.** `folderBridge` moved from
  `features/import-export/` into `src/api/`, the third feature to read it
  being the Storage card — a `refactor:` commit of its own, before the RED.
- **`mediaRoot` on Shell paths**, in both branches: `userData\media`
  installed, `<appPath>\media` unpackaged, where the server's own default
  resolves under `serverCwd`.
- **`serverLaunch` reads it** when installed, for `FAMILYFLIX_MEDIA_PATH`;
  `dev` and `start` set no media path, as before.
- **`electron/openMediaFolder/`** and its suite: `openMediaFolder(root,
world)` over an injected world that makes, opens and logs.
- **The channel and the member.** `FOLDER_CHANNELS.openMedia`, and
  `FolderBridge`'s third member, `openMedia()`, taking no argument.
- **The preload line and main's handler**, `ipcMain.handle` over
  `paths.mediaRoot`.
- **`fakeFolderBridge` counts `openMedias()`.**
- **The button.** _Open folder_ on the Storage card's path row, the
  `secondary` `Button` at `sm`, drawn when the bridge exists; no busy state,
  no notice.
- **The prototype.** `page.SettingsPage.dc.html`'s _Change…_ relabelled
  _Open folder_ first, as Q8 ruled.
- **Two Package smoke checks** in `docs/release-checklist.md`: the button
  opens `%APPDATA%\FamilyFlix\media`, made on a fresh install.

### Where the build met the log and differed

- **The button is placed by `& > button`** inside `Folder`, not as Q5's
  `styled(Button)` named `OpenFolder`: `Button` forwards no `className`,
  where `IconButton` and `NavigationRow` both do. It is the only element
  selector on a primitive in `src/`.

### Judgement calls the log did not name

Each is the refactor round's to settle
(`docs/refactor-plans/35-open-media-folder-refactor.md`):

- **The invariant is not yet true.** Log 35 Q1 says every path main hands
  the Server process comes from Shell paths again. `serverLaunch` still
  joins `FAMILYFLIX_DB_PATH` and `FAMILYFLIX_COMPONENT_PATH` off `userData`
  itself, which is why it still takes `userData`. Its docblock also splits
  **Trusted hosts** across two lines.
- **Two failure paths, two spellings.** `openMediaFolder` has two `try`
  blocks, each reading the thrown value its own way, and the rejecting
  `openPath` branch has no leaf.
- **Main builds the world inline**, inside the handler, rebuilt on every
  press, where `logFs` and `dialogWorld` are named, typed constants.
- **The button's placement**, above.
- **Tests and docs left stale**: `StorageSection.test`'s _draws no
  Change… button — the title and path alone on their line_;
  `serverLaunch.test`'s media leaves in a describe beside issue 228's
  _every path from ShellPaths_; `fakeFolderBridge`'s unreflowed docblock;
  the glossary's 🔜 marks and "graduating"; CLAUDE.md's tree, preload,
  `shellPaths/` and Foundation lines, and step 18 in CLAUDE.md and the
  README.

### Deliberately not built

Everything log 35 rules out:

- opening any other folder — a Library folder, an Export folder;
- revealing a single file (`showItemInFolder`);
- _Change…_, the Roadmap's **Move the media folder**;
- a notice for a failed open;
- unpackaged, the button following a developer's own
  `FAMILYFLIX_MEDIA_PATH`.

### Follow-ups

The refactor plan, filed as 293.

---

## 2026-10-09 — Backdrop veil refactor (issue 290)

Nine commits against `docs/refactor-plans/34-backdrop-veil-refactor.md`, one
per plan commit. **7611 tests pass across 463 files**, from 7608 across 462
at the end of the build (`6712655`); the three new leaves and the new file
are `paintedBackgrounds`'. `tsc -b --force` is clean, and
`eslint src server electron .husky` reports no errors and the one warning
earlier rounds already logged (`AboutSection.test.tsx`'s escaped dot). No
wire, schema, type or pixel changed, and the server is untouched.

### What each group changed

- **Group 0, the record.** The build's own entry, below, written before the
  round touched anything.
- **Group 1, the code's tidy.** `MovieDetail` and `SeriesDetail` import
  `DetailBackdrop` in its alphabetical place. The barrel's appended line
  stays last, as every molecule joined it.
- **Group 2, the tests' tidies.**
  - `test-support/paintedBackgrounds/`, with three leaves: every element
    from a root down, each as its resolved `background`, `backgroundImage`
    and `backgroundColor` on one line. The molecule's `backgrounds()` moved
    into it.
  - The molecule's suite and both page suites' accent-wash leaves read
    through it; the molecule's theme argument is typed `Theme`.
  - Each page suite's _keeps no art area or scrim of its own_, which read the
    `.styles` module's export names, is _draws exactly one Detail backdrop_:
    exactly one element paints the backdrop's url, inside an `aria-hidden`
    layer. Checked by drawing the molecule twice on the movie page, which
    fails it.
- **Group 3, the prototype.** `page.SeriesPage.dc.html`'s art layer draws
  `sr.posterStyle`, the 155° **Gradient fallback** the movie page draws, and
  `FamilyFlix.dc.html`'s series model drops `backdropStyle` and its blur.
  Not opened in a browser this round; the change is one binding and one
  removed property nothing else read.
- **Group 4, the docs.** CLAUDE.md's tree gains `DetailBackdrop/` after
  `CreditsRow/`, and step 17 and its Browse & discover entry are ✅, with the
  build-order sentence reading _steps 16–17 are done_. The README matches.

### Where the round met the plan's words and differed

- **The new page leaf asks for one painter of the url inside an
  `aria-hidden` layer**, not that the layer is _the one_ the accent-wash
  leaf finds: the page has other `aria-hidden` elements (glyphs), so _one
  layer_ is read off _one painter_.
- **Commit 7 also changed the build-order sentence** (_step 16 is done,
  17–23 are planned_), which the plan did not list but step 17's tick makes
  false.

### Left as it is

- **The `Scroller`s' `position: relative`**, which nothing is placed against
  any more: a CSS change in a round that moves no pixel.
- **A token for `bg` with an alpha**: `rgba(20, 17, 13, …)` is spelled in ten
  shipping files, the veil's two stops among them.
- **The two `Scroller` docblocks' near-twin wording**: pages do not share
  styles.
- **`COMPONENT-SPEC`'s molecules without a `mol.*` file**, on `CreditsRow`'s
  precedent.
- Everything log 34 ruled out, as the build's entry lists it.

This entry's commit closes the initiative, 288, and this round, 290.

---

## 2026-10-09 — Backdrop veil (issue #289)

Both detail pages draw one **Detail backdrop**: the art a full viewport tall,
pinned to the top of the page's scroller while the content scrolls over it,
under the **Backdrop veil** — a darkening gradient over the theme's
`accentSoft` — in place of the old 62% `ArtArea` and its `Scrim`.

One slice, as log 34 Q9 ruled: `15607c3` RED and `6712655` GREEN, against
the plan in `docs/PRDs/34-backdrop-veil-plan.md`, built from
`docs/design-logs/34-backdrop-veil.md`. **7608 tests pass across 462
files**, measured at `6712655`, from 7600 across 461 at the end of the
Single-title Sync refactor.

### What shipped

- **The molecule.** `components/DetailBackdrop/` — `{ url, g1, g2 }`, an
  `aria-hidden` root holding `ArtArea` (sticky at `top: 0`, `100vh`, the
  negative margin that lets the content ride over it, and the comment naming
  its coupling to the pages' scrollers) and `Veil` (`bg` at `.65`, `.85` at
  50%, solid `bg`, over `accentSoft`, one background in two layers). Its
  suite reads `getComputedStyle`, the wash under `createTheme('#3a7bd5')`.
- **The barrel line**, appended last in `components/index.ts`.
- **Both features swapped.** `MovieDetail` and `SeriesDetail` draw the
  molecule; each feature's `ArtArea` and `Scrim` are deleted from its
  styles.
- **Both page `Scroller` docblocks** rewritten for a sticky art layer.
- **Both page prototypes**, `page.MoviePage.dc.html` and
  `page.SeriesPage.dc.html`, revised to the full-height art and the veil,
  and the molecule's row added to `COMPONENT-SPEC.md` — no `mol.*` file, as
  Q6 ruled on `CreditsRow`'s precedent.

### Where the build met the RED suite and differed

The GREEN commit fixed two things in the RED suite, and its message names
both. Neither relaxes an assertion:

- **`soft()`'s regex lost its escapes** inside a template literal, so it
  matched nothing; the escapes were restored.
- **`artworkImage()` looked for an `hsl()` stop** that the resolved style
  spells as `rgb()`; it finds the gradient by its angle instead.

### Judgement calls the log did not name

Each is the refactor round's to settle
(`docs/refactor-plans/34-backdrop-veil-refactor.md`):

- **The import order.** Both callers append `DetailBackdrop` to an
  otherwise alphabetical `@/components` list.
- **One walk written three times.** The molecule's suite has a
  `backgrounds(root)` helper; the two feature suites spell the same walk
  inline, fifteen lines apiece.
- **Two leaves that read a module.** Each feature suite's _keeps no art area
  or scrim of its own_ asserts on the `.styles` module's export names rather
  than on the rendered page.
- **The series prototype's `backdropStyle`.** The slice rewrote both
  prototypes' container and veil but left the series art drawn as a blurred
  120° gradient, where the movie prototype draws the **Gradient fallback**
  and the code has never blurred.

### Deliberately not built

Everything log 34 rules out:

- a blur (log 32 Q2b);
- parallax or any motion of the art;
- a veil on the Season page, which draws no backdrop;
- stops tuned per image brightness.

### Follow-ups

The refactor plan, filed as 290.

---

## 2026-10-09 — Single-title Sync refactor (issue 287)

Eleven commits against `docs/refactor-plans/33-single-title-sync-refactor.md`,
one per plan commit. **7600 tests pass across 461 files**, from 7597 across
461 at the end of the build (`e9fc99c`); the three new leaves are
`conflictResponse`'s. `tsc -b --force` is clean, and
`eslint src server electron .husky` reports no errors and the one warning
earlier rounds already logged (`AboutSection.test.tsx`'s escaped dot). No
wire, schema, prototype or pixel changed, and the server is untouched.

### What each group changed

- **Group 0, the record.** The build's own entry, below, written before the
  round touched anything.
- **Group 1, the comments.** `useEnrichmentRun`'s docblock names the
  re-attach rule and the **Waiting run**; the predicate's docblock stops
  bolding _belongs here_, a phrase of the **Single-title Sync** row; and
  `EnrichmentFlow`'s single-film paragraph is rewrapped to the measure.
- **Group 2, the code's tidies.**
  - `belongs` is `belongsHere`, log 33 Q1's name, still module-local.
  - `LetGoLine` is `LetGoNote`, log 33 Q4's name, `SourceNote`'s sibling,
    no longer one letter's case from the `letGoLine` that words it.
  - `start` reads the started snapshot, or after a `409` the current run
    that belongs here, into one local, then holds it and lets the Waiting
    run go once. Its contract is unchanged, and the hook's suite passed
    unchanged, both `409` describes included.
- **Group 3, the tests' tidies.**
  - `fakeResponse` gains `conflictResponse(error)`, a `409` with
    `{ error }`, defaulting to the enrichment route's sentence, with three
    leaves. The enrichment feature's four hand-spelled `409`s read through
    it.
  - `import-export`'s five do too, each passing the importer's own
    sentence. The one built with `new Response` was checked first:
    `startFolderScan` reads only `status` and `ok`, so it moved.
  - `EnrichmentFlow.movie.test.tsx` is `EnrichmentFlow.whoseRun.test.tsx`,
    its four describes in the siblings' `EnrichmentFlow — …` form.
- **Group 4, the docs.**
  - The glossary: **Let-go line** and **Busy notice** are new rows;
    **Single-title Sync** names the `409` rule and **Waiting run** the
    Let-go line.
  - CLAUDE.md: the tree's `useEnrichmentRun/` and `enrichmentView/` lines
    describe the slice, and step 16 and its Browse & discover entry are ✅.
    The README matches.

### Where the round met the plan's words and differed

- **Commit 2 was made as `refactor:`**, after a first `docs:` was amended
  before it left the machine. The plan types only 1 and 9–11 as `docs:`.
- **One full run after commit 5 dropped a file**: 460 of 461 files and
  7486 of 7597 tests, no failing leaf named, and the hook's own suite green
  just before it. Commit 5 had already been made. Two full runs straight
  after were green at 7597, and every later commit was made only on a run
  that exited `0`. Read as load, not as the change; noted in case it
  returns.

### Left as it is

- **A `movieId` that changes while the flow stays mounted.** The mount
  effect re-reads on a new `movieId` but does not clear a run or Waiting run
  held for the old one. Nothing navigates `/enrich?movie=a` to
  `/enrich?movie=b` without leaving the route, so it is unreachable today.
- **The flow suites' local `makeRun` builders** (`EnrichmentFlow.test`,
  `.library`, `.writeBack`), older than this initiative.
- **`StartEnrichment` as a union by scope**, which would let the spread's
  second guard go: a type change across the wire shape, not a tidy.
- **`fakeResponse`'s module docblock** still says _three_ fakes; it has said
  so since the third.
- Everything log 33 ruled out, as the build's entry lists it.

---

## 2026-10-09 — Single-title Sync (issue #286)

The ⋯ menu's _⟳ Fetch from TMDB_ no longer re-attaches to whatever
**Current enrichment run** exists. A film's flow holds only that film's own
`single` run. A run in review that is not its own is the **Waiting run**,
named by one line under Start. A `409` over another's running Sync raises
the busy notice. Opened with no film, the flow re-attaches to every run, as
before.

One slice, as log 33 Q7 ruled: `d60101d` RED and `e9fc99c` GREEN, against
the plan in `docs/PRDs/33-single-title-sync-plan.md`, built from
`docs/design-logs/33-single-title-sync.md`. **7597 tests pass across 461
files**, measured at `e9fc99c`, from 7555 across 460 at the end of the
Export options refactor.

### What shipped

- **The type.** `EnrichmentRun.movieId?`, the film a `single` run belongs
  to, absent on a library run.
- **The server record.** `createEnrichment.start` spreads `movieId` onto a
  `single` run's snapshot; `current()` carries it as it is. The route,
  `enrichmentBody` and every status code are untouched.
- **The hook.** `useEnrichmentRun(movieId)`: the mount read holds a run that
  belongs here, else keeps one in review apart as `waiting`. Start's `409`
  holds the current run when it belongs here and rejects with
  `EnrichmentBusyError` when it does not. Both are kept apart from a late
  read by the generation guard the hook already had.
- **The view.** `letGoLine(waiting)`: the library's or another movie's sync
  waiting for review, `null` with no Waiting run or no Decisions left.
- **The setup.** `EnrichmentSetup`'s `letGo` prop, drawn under Start in the
  source note's style.
- **The notice.** `EnrichmentFlow.onStart` raises _A sync is already
  running._, a `warning`, on `EnrichmentBusyError`.

### Where the build met the log and differed

- **The commit is a `feat:`.** Q7 ruled a `fix:`; the GREEN commit was made
  as `feat:`. The history is left as it is.
- **The spread carries a second guard**,
  `&& options.movieId !== undefined`, beside Q5's scope test.
  `StartEnrichment.movieId` is optional and the domain's own suites call it
  without the route, so the guard keeps a `movieId: undefined` key off a
  snapshot. On the wire `enrichmentBody` already guarantees the id. Kept.

### Judgement calls the log did not name

Each was made by a subagent reading one issue. Each is the refactor round's
to settle (`docs/refactor-plans/33-single-title-sync-refactor.md`), except
the guard above:

- **`belongs`** for Q1's `belongsHere`, and **`LetGoLine`** for Q4's
  `LetGoNote` — one letter's case away from the `letGoLine` that words it.
- **The hold written twice** in `start`: the success path and the `409` path
  each end in the same `setRun` and `setWaiting(null)`.
- **Two more hand-spelled `409`s**, the hook suite's `busy` and the flow
  suite's `busyResponse`, beside seven already in the tree.
- **The new flow suite named `.movie`**, though the one-movie suite is
  `EnrichmentFlow.test.tsx` and the new one is about whose run the flow
  holds, the no-film case included.

### Deliberately not built

Everything log 33 rules out:

- a server-side refusal to replace another scope's review — log 32 chose
  the line;
- a warning ahead of time about a _running_ Sync;
- a single-title Sync for a series;
- re-attaching a library flow only to library runs.

### Follow-ups

The refactor plan, filed as 287.

---

## 2026-10-09 — Export options refactor (issue 283)

Twenty-four commits against `docs/refactor-plans/31-export-options-refactor.md`,
one per plan commit. Commit 24 is empty, as the plan allowed: the prototype
was read against the tree and nothing had drifted. **7555 tests pass across
460 files**, from 7586 across 461 at the end of the build (`2f6cbe3`); the
drop is the retired download path's own leaves. `tsc -b --force` is clean,
and `eslint src server electron .husky` reports no errors and the one
warning earlier rounds already logged (`AboutSection.test.tsx`'s escaped
dot). No pixel changed, and no wire answer but the retired route's.

Issue 282, the plan's Phase 7 (_the close_), was merged into this plan when
it was filed. The standing rule makes the close the refactor's last commit
anyway, so one refactor issue closes the initiative. 282's acceptance
criteria are commits 5–7 and 21–23, and its journal entry is commits 1 and
this one.

### What each group changed

- **Group 0, the record.** The build's own entry, below, written before the
  round touched anything.
- **Group 1, the comments and the import.** The build's over-measure comment
  lines rewrapped, `ExportModal`'s broken sentence joined, the docblocks that
  still described log 14 (the filename row, the sheet glyph, the summary's
  one count) corrected, and `exportBody`'s import in its alphabetical place.
- **Group 2, the retirement.**
  - The GET suite's unported leaves moved onto the `POST` first.
  - `GET /api/export/:format`, its format reader and content-type table, and
    `writeDownload/` are gone.
  - `fetchExportFile`, `fileResponse`, `saveToComputer/` and `stubDownload/`
    are gone, and `fakeUpdateBridge` names `stubScrollTo` alone as its model.
  - `EXPORT_FILENAME` is gone.
  - `routes.exportFolder.test.ts` is `routes.export.test.ts`.
- **Group 3, the server's tidies.**
  - `spellYearSpan` beside `yearSpan`; `exportRows`' `yearRange` is gone.
  - `titleFolderName` is built on `safeName`.
  - `media/writableFolder/`, asked by `writeExport` and `writeBack.check`.
  - `writeExport` answers `ExportRefusal` kinds and a failure's reason, and
    the route words them through `EXPORT_REFUSALS`.
  - `import-export/exportSummary/` holds the summary's rule, on
    `getSeriesHome()`'s one read. Both export routes read series off it, so
    neither borrows the Sync's `seriesInScope`.
  - `SHEET_NAME` is built from an exported `SHEET_STEM`.
  - `PATH_COLUMNS` is built from `ExportColumn | ExportEpisodeColumn`; a
    misspelt column was tried and fails the typecheck.
  - `main.ts`' one `showFolderDialog`.
- **Group 4, the client's tidies.**
  - `features/import-export/pathField.styles.ts`: `PathRow` and `Refusal`,
    re-exported by both organisms' styles.
  - `NameRow`, `NameLead`, `ExportName` and `DonePath`.
  - `useExport` reads the bridge once; `edited` and `setField`.
  - `refusalSentence`, the one reader of `{ error }` in the feature's `api.ts`.
- **Group 5, the docs.**
  - The glossary: **Save to computer** is _retired_; **Export** and **Export
    file** say the download path _was retired_; **Export folder** names its
    title folders `Heat (1995)`; **Export destination** names its two checks;
    one relationship line says _name row_.
  - CLAUDE.md: the tree names every new unit and drops every retired one, the
    exporter paragraph and the Architectural Boundaries rule describe the
    Export, step 15 and its Maintainer tools entry are ✅, and 🧭 **Back up
    the library** is on the Roadmap. The README matches.
  - COMPONENT-SPEC: ExportModal's _Composes_ column was the one drift. Its
    props column describes the prototype's model and still matches it.

### Where the round met the plan's words and differed

- **The furniture is re-exported**, not imported directly: each organism's
  styles re-export `PathRow` and `Refusal`, the way `LibraryFolders.styles`
  already re-exports the Settings and Maintainer furniture.
- **`getSeriesHome({ sort: 'a-z' })`**, not the default order: the series
  reach `writeExport` in the order `seriesInScope` gave them.
- **The `writeExport` leaves that named a sentence were renamed** with their
  assertions: _is refused as relative_, _is refused as read-only_, _a
  missing path is missing_, _answers failed with the error's reason_.
- **CLAUDE.md's types line** keeps every underscored identifier in
  backticks. Changing the export names there moved Prettier's emphasis
  pairing, and fixing that cleared the `\_Finish*` mangle on the
  `enrichPath/` line the last round logged.
- **The README's server, test-support and feature tree lines** were updated
  too, beyond the plan's ✅ and Roadmap lines.

### Leaves added, removed and moved

Added:

- `routes.export`: the untouched row after an edit (×2), the awkward title
  (×2), the BOM ahead of the awkward titles, stripped by the reader and once
  ahead of a header-only file, a library of none (×4) and the summary as it
  stands now; twelve tests;
- `yearSpan`: `spellYearSpan`'s four shapes and the round trip (×3); seven;
- `writableFolder.test.ts`: four;
- `exportSummary.test.ts`: seven.

Removed: the GET suite's 39 leaves; `api`'s `fetchExportFile` describe (6);
`fakeResponse`'s `fileResponse` (3); `saveToComputer` and `stubDownload`
(13). Restated: the four `writeExport` leaves above. Net −31.

### Surfaced

- CLAUDE.md's tree still has no `createUpdates/` or `fakeUpdateBridge/`,
  and _Bulk Import / Export_ still says the domain is four units. Both were
  logged last round and are left.
- The shell's `will-download` handler and `downloadPath/` stay, as the plan
  said: they are the window's rule for any download, though nothing in the
  renderer downloads now.

None filed. This entry closes 275, 282 and 283.

---

## 2026-10-09 — Export options (issues #276–#281)

The Export dialog writes an **Export folder**, `familyflix-collection_DD-MM-YYYY`,
at an **Export destination** the maintainer types or picks with _Browse…_.
It holds the sheet with sixteen columns, films and series together, and an
Episodes table beside it. With the _Include_ toggles on, each title's
posters, backdrops, stills and subtitles travel in a folder per title. The
server writes it straight to the folder, through `POST /api/export`. The
prototype amendment (`feat.ExportModal.dc.html` and the COMPONENT-SPEC
entries) rode in #276's `feat:` commit, as the plan said.

Twelve commits across issues #276–#281: six RED/GREEN pairs, plus one
`fix:`. They follow the plan in `docs/PRDs/31-export-options-plan.md`, built
from `docs/design-logs/31-export-options.md`. **7586 tests pass across 461
files**, measured at `2f6cbe3`, from 7450 across 442 at the end of the
Library folders refactor.

### What shipped, slice by slice

- **#276, a dated folder of films.**
  - `exportName`, `exportRows` over films, and `writeSheet(tables, format,
name)`.
  - `writeExport`, `exportBody` and `POST /api/export`.
  - The summary grown to `{ movieCount, seriesCount, episodeCount,
defaultDestination, folderName }`.
  - The client's `startExport`, the new `useExport`, and the dialog's
    _Save to_, name row and done copy.
  - The Metadata sheet moved onto `exportRows`' sixteen columns.
  - The old download moved onto a new `writeDownload` unit, so the Sheet
    writer could change shape.
- **#277, series and episodes.** Series rows in the Titles table, and the
  Episodes table: a second worksheet in xlsx, `<name>-episodes.csv` in csv.
- **#278, images beside the sheet.** The file plan, the art in a folder per
  title, the `xlsx` hyperlinks on the path cells, and the _Images_ toggle.
- **#279, subtitles beside the sheet.** The subtitle files and their toggle.
  `3f010ce`, a `fix:`, makes three importer suites await their runs.
- **#280, the native picker.** `pickOneFolder`, the `pickOne` channel and
  preload member, `fakeFolderBridge.pickOne`, and _Browse…_.
- **#281, the edges.** The three refusals (relative, missing, read-only),
  the numbered name, the rollback, an unreadable file skipped, and the
  sheet written last.

### The plan's two departures from the log

- **No prototype-only slice.** The revision rode Phase 1's build step, as
  in the Library folders plan.
- **The Metadata sheet moved into Phase 1.** Phase 1 changed
  `EXPORT_COLUMNS` and the Sheet writer's signature, and `writeBack` calls
  both.

### Judgement calls the log did not name

Each was made by a subagent reading one issue. Each is the refactor round's
to settle (`docs/refactor-plans/31-export-options-refactor.md`), except the
four it keeps:

- **Title folders named `Heat (1995)`** by `exportRows`, not by
  `movieFolder`, which slugs. Kept.
- **The _Include_ rows on their own styles**, at the prototype's sizes rather
  than the Settings `Row`'s. Kept.
- **The suites split by phase**: `exportRows` into `.series`, `.images` and
  `.subtitles`, `writeExport` into `.images`, `.subtitles`, `.readOnly` and
  `.edges`. Kept.
- **`3f010ce`**, three importer suites made to await their runs. Kept.
- **`writeDownload`**, the old route kept alive on a copy of log 14's cell
  rules, with no suite.
- **`yearRange`**, a private spelling of a Year range, and **two name
  strips** in the file plan.
- **A second write check** in `writeExport`, and its refusals worded as
  sentences in the domain.
- **The summary's rule in the route**, reading episodes once per series.
- **`SHEET_STEM`** beside `SHEET_NAME`, **untyped `PATH_COLUMNS`**, and the
  **second dialog fallback** in `main.ts`.
- **The path row and refusal line copied** from `LibraryFolders` into
  `ExportModal`, the **bridge read every render** in `useExport`, and **a
  second refusal parse** in the feature's `api.ts`.

### Deliberately not built

Everything log 31 Q2 rules out:

- video files — 🧭 **Back up the library**;
- a column picker;
- remembering the last destination;
- a _Show in folder_ button;
- reading the new columns back on import.

### Follow-ups

The refactor plan, filed as 283, with the plan's Phase 7, filed as 282,
merged into it.

---

## 2026-10-08 — Library folders refactor (issue 274)

Twenty commits against `docs/refactor-plans/30-library-folders-refactor.md`,
one per plan commit, none dropped. **7450 tests pass across 442 files**, from
7419 across 438 at the end of the build (`0ca65f6`). `tsc -b --force` is
clean, and `eslint src server electron .husky` reports no errors and the one
warning earlier rounds already logged (`AboutSection.test.tsx`'s escaped
dot). No pixel changed, and no route, wire, schema or log line.

Issue 273, the plan's Phase 6 (_the close_), was merged into this plan when
it was filed. The standing rule makes the close the refactor's last commit
anyway, and its acceptance criteria are commits 17 and 18.

### What each group changed

- **Group 0, the record.** The build's own entry, below, written before the
  round touched anything.
- **Group 1, the comments and names.**
  - Shipping comments say **Library folder**, or _the spreadsheet's root_
    where they mean the one typed path.
  - `walkLibraryRoot` is `walkLibraryFolder`: the folder, both files, the
    export, both importer call sites, `groupShows.test`'s mention and
    COMPONENT-SPEC.
  - The build's thirteen over-measure comment lines are rewrapped.
  - The build's imports sit in their groups in `main.ts`, `createImporter`
    and `routes/index.ts`, and `ImportFlow`'s `COPY` is `WORDING`.
- **Group 2, the server's tidies.**
  - `createEnrichment`'s `reachableFolders` asks `readableFolder`, and its
    `stat` import is gone.
  - `sourceFolder(id)` is `titleSource(id)`, both source columns in one
    query, `null` without a folder. The Sync matches a title's run folder by
    id, and the Metadata sheet reads each film's folder once. `setSourceFolder`
    takes a `string` folder id, and its third parameter is `sourceFolder`.
  - `Origin` is gone: the importer passes the `StoredLibraryFolder`, and
    `sheetOriginOf` is `sheetFolderOf`.
  - Both runs end in `importPlaced(current, films, shows, verb, signal)`,
    which builds the genre pool and the warned set. `fileUnplacedOn` is
    `fileUnplaced`, and `seriesInLibrary` takes its list with no default.
  - Both starts claim the run through `claimRun(source, enrich, roots)`.
  - `start` reads the list and the clash once and hands both to
    `sheetFolderOf`.
  - `clashSentence` sits beside `folderOverlap`. The route and the
    importer's refusal both read it.
  - `import-export/admitFolder/` holds the add's rules and answers
    `added`, `refused` or `clash`. The route maps a refusal through
    `FOLDER_REFUSALS`, and the untyped `let added;` is gone.
- **Group 3, the client's tidies.** `useKeyStored` is the one stored-key
  read, for `ImportFlow` and `LibraryFolders`. `useFolderScan` holds the
  _Scan folders_ press. `LibraryFoldersPage` has its suite.
- **Group 4, the docs.**
  - The glossary's **Library root (retired)** names migration 7 and the
    rename as done. Six current entries and three relationship lines say
    **Library folder** or _the spreadsheet's root_.
  - CLAUDE.md's tree names every new unit, `preload.ts` among them.
  - CLAUDE.md's `db/` line lists migrations 6 and 7, and the settings
    slice no longer lists `library-root`.
  - The Settings Hub section has the four routes and `/settings/folders`,
    and Bulk Import has the Folder scan.
  - The Foundation line names the preload's two members.
  - Step 14 and the Maintainer tools entry are ✅, and _(next)_ is on 15.
  - The README matches.
  - COMPONENT-SPEC was read against the tree. `FolderRow`'s props were the
    one drift: the row takes `folder`, a `LibraryFolder`, and `onRemove`.

### Where the round met the plan's words and differed

- **`start` keeps its own busy check** before it reads either field, and
  `claimRun` asks again after them. Without it, a start during a run would
  answer the sheet's refusal instead of _busy_.
- **`clashSentence`, not `overlapSentence`.** The plan names the moved
  function both ways. The Decision Document's name won.
- **`enrich.sourceFolder.test` gained `titleSource`'s leaves** rather than
  being restated: no leaf there read `sourceFolder` before.
- **Two leaves renamed**, because the state they named no longer exists: a
  Source folder recorded under no Library folder. _enrich.sourcePath › is
  null once the folder it was moved onto is removed_ and
  _createEnrichment.sourcePath › is null when the title's Library folder was
  removed_ keep their assertions.
- **`ImportSetup`'s docblock** split **Library root** across two lines, so
  the plan's list missed it. Commit 4 rewrote it with the rewrap.
- **The build entry said migration 6 added `source_folder`.** Migration 5
  did. This commit corrects that line.

### Leaves added, removed and moved

Added:

- `titleSource`, five leaves in `enrich.sourceFolder.test`;
- `clashSentence`, three leaves in `folderOverlap.test`;
- `admitFolder.test.ts`: an add, the refusals (empty twice, relative,
  missing, a file, nothing added) and the four clashes, the race among them;
  eleven tests;
- `useKeyStored.test.ts`: five leaves;
- `useFolderScan.test.tsx`: four leaves;
- `LibraryFoldersPage.test.tsx`: three leaves.

Removed: none. Restated: the two renamed leaves above, and
`walkLibraryFolder`'s two `describe` names. Net +31.

### Surfaced

- `tsc -b` without `--force` reported commit 7's two spec errors as clean,
  where `tsc -p tsconfig.spec.json` caught them. The incremental build info
  can hide a test file's type error after a shipping signature changes. The
  commit gate runs the same command. Every check after that commit used
  `--force`.
- CLAUDE.md's tree still has no `createUpdates/` or `fakeUpdateBridge/`,
  both from step 9.
- CLAUDE.md's `enrichPath/` line carries Prettier's mangled emphasis
  (`\_Finish*`), which predates this round. Bare underscores elsewhere in
  the tree re-pair it, so new tree lines must keep identifiers in backticks.
- _Bulk Import / Export_ still says the domain is four units. `groupShows`,
  `writeSheet` and now `admitFolder` have joined them.

None filed. This entry closes 267, 273 and 274.

---

## 2026-10-08 — Library folders (issues #268–#272)

The maintainer keeps a list of **Library folders**, each a top folder of
movies and series, at `/settings/folders`. The Settings hub reaches it
through the Library group's _📁 Library folders_ row. Folders are added by
typed path or by _Browse…_ over Electron's native dialog, several at a time.
A **Folder scan** imports every folder on the list in one run, and the Sync
writes posters and a Metadata sheet into each folder a title came from. The
spreadsheet import still takes one typed root, and that root now joins the
list. The prototype amendments (`page.LibraryFoldersPage`, `mol.FolderRow`,
`page.SettingsPage`, `feat.ImportFlow`, `feat.EnrichmentFlow`,
`FamilyFlix.dc.html` and the COMPONENT-SPEC entries) rode in #268's `feat:`
commit, as the plan said.

Ten commits across issues #268–#272, five RED/GREEN pairs, against the plan
in `docs/PRDs/30-library-folders-plan.md`, built from
`docs/design-logs/30-library-folders.md`. **7419 tests pass across 438
files**, measured at `0ca65f6`, from 7246 across 417 at the end of the Add a
series refactor.

### What shipped, slice by slice

- **#268, the remembered folder list.**
  - Migration 6: the `library_folders` table, and `library_folder_id` on both
    titles, beside the `source_folder` migration 5 added.
  - The `library/folders/` slice, `folderOverlap`, and `readableFolder`,
    extracted from the importer's `checkRoot`.
  - The three list routes: `GET`, `POST` and `DELETE /api/library-folders`.
  - `useLibraryFolders`, `FolderRow`, the `LibraryFolders` organism,
    `LibraryFoldersPage` and the Settings row.
- **#269, the Folder scan.** `Importer.scan`, `ImportRun.source`, `titleAt`,
  the three-argument `setSourceFolder`, `POST /api/library-folders/scan`,
  `FolderShapes`, and the `/import` heading worded by source.
- **#270, the sheet root joins the list.** The spreadsheet's typed root is
  added to the list when it is new, used when it is already there, and
  refused when it contains a folder on the list.
- **#271, the Sync over folders.**
  - Migration 7: the carry-over of `settings.library-root` onto the list.
  - `sourcePath`, the per-folder write check, and posters and Metadata
    sheets written per folder.
  - `EnrichmentSummary.libraryFolders` and `EnrichCheckCard`.
  - `libraryRoot` removed from the settings slice.
- **#272, the native picker.** `pickFolders`, its channel in `main.ts` and
  `preload.ts`, `folderBridge`, `fakeFolderBridge`, and _Browse…_.

### The plan's two departures from the log

- **The spreadsheet root got its own slice**, #270. The log had folded it
  into the Folder scan.
- **The carry-over moved from migration 6 to migration 7.** The importer
  wrote `library-root` and the Sync read it until #270 and #271. Deleting
  the key in migration 6 would have left the Sync with no write targets
  for two slices.

### Judgement calls the log did not name

Each was made by a subagent reading one issue. Each is the refactor round's
to settle (`docs/refactor-plans/30-library-folders-refactor.md`), except the
five it keeps:

- **`titleAt`**, a storage read the log didn't list, for the first
  Already-in-library rule. Kept.
- **`readableFolder` answers a four-way `FolderReading`** rather than a
  boolean, so the add can tell _relative_ apart from _missing_. Kept.
- **The add's extra `400` sentence** for a relative path, _Type the folder's
  full path, starting with its drive._ Kept.
- **`ImportSource` exported** as a named type. Kept.
- **`fakeUpdateBridge` spreads `window.familyflix`**, so the two fakes can
  stand together. Kept.
- **`createEnrichment`'s own `stat`**, a fourth reading of reach.
- **A title's run folder matched by joined paths**, where the row carries
  its folder's id.
- **`Origin`**, the importer's `StoredLibraryFolder` under other names.
- **`executeScan` written beside `execute`**, and `scan` beside `start`.
- **The sheet root's clash read twice** in one call.
- **`overlapSentence` in the route**, and the importer restating its
  sentence.
- **The add's rules in the route handler.**
- **The stored-key effect copied** from `ImportFlow` into `LibraryFolders`,
  and the scan's press inline in the organism.
- **No suite for `LibraryFoldersPage`.**

### Deliberately not built

Everything log 30 _Not built_ lists:

- playing media in place;
- watching folders, scanning on launch, a per-folder scan;
- loose videos at a Library folder's top level;
- a Browse button on Import setup's fields;
- reading a sheet found inside a Library folder.

### Follow-ups

The refactor plan, filed as 274, with the plan's Phase 6, filed as 273,
merged into it.

---

## 2026-10-08 — Add a series refactor (issue 266)

Twenty commits against `docs/refactor-plans/29-add-series-refactor.md`, one
per plan commit, none dropped. **7246 tests pass across 417 files**, from
7200 across 416 at the end of the build. `tsc -b` is clean, and
`eslint src server electron .husky` reports no errors and the one warning
earlier rounds already logged (`AboutSection.test.tsx`'s escaped dot).

One pixel changed: an **Episode file row**'s number and title fields keep
the browser's focus ring. The prototype draws them with `outline: none`, and
`TextField` and `Textarea` already record the same deviation from that line —
the ring is the only thing that tells a keyboard user where they are.

Issue 265, the plan's Phase 5 (_the close_), was folded into this plan when
it was filed, so the initiative has one refactor issue. The standing rule
makes the close the refactor's last commit anyway, and its acceptance
criteria are commit 19's.

### What each group changed

- **Group 0, the record.** The build's own entry, below, written before the
  round touched anything. It records log 22 Q2's open item as closed for the
  add.
- **Group 1, the comments.**
  - `MovieForm` names the two **Form kinds** and the **Kind tabs**, and the
    heading's docblock says it follows the kind on an add.
  - `useMovieForm`'s gate is one condition per kind; `?kind=` is the URL's
    third parameter, read on a plain add alone; a series lands on its kind's
    **Fresh home**. The _"Why no test file"_ section counts the suite as
    measured — **266 tests over 62 blocks**, where the plan quoted 290 — and
    says the list rules are `useEpisodeList`'s suite's.
  - `save` writes _the title_, and each episode member of
    `UseMovieFormResult` has a docblock.
  - The build's eight over-measure comment lines are rewrapped.
- **Group 2, the client's tidies.**
  - `FormKind` sits in `types/form.ts` beside `EpisodeFormRow`, in the
    barrel.
  - `PillTabs<T extends string>` hands back its caller's type, so
    `MovieForm`'s `isFormKind` guard is gone and `onChange={setKind}`.
  - The heading on an add is `WORDING[kind].heading`; `HEADING` keeps
    `edit` alone.
  - `formValues` gained `pickedSubtitle(key, file)` beside `pickedFile`, with
    `DEFAULT_LANGUAGE` and story 27's docblock moved there. `useMovieForm`
    and `useEpisodeList` build every picked file and track through the two.
  - `SeriesFormFiles`' nine episode props are required; `ignore` and the
    defaults are gone. Its suite's render helper passes a `vi.fn()` for
    each, and its header no longer says the rows arrive in the next slice.
  - `filesCard.styles.ts` holds `Card`, `Caption` and the list section
    (`ListSection`, `ListLabel`, `ListRows`). Both cards' styles files are
    now re-exports of it under their own names, with nothing of their own
    left, and `SeriesFormFiles.styles` no longer imports from
    `MovieFormFiles.styles`.
  - `filesCard.ts` holds the three `accept` lists with their docblocks,
    `CARD_LABEL`, `POSTER_LABEL` and `POSTER_CHOOSE`. No existing name in
    the codebase covered the idea, so the plan's names stand.
  - `EpisodeFileRow` keeps the focus ring, and its lengths are
    `SEASON_LENGTH` and `NUMBER_LENGTH`.
  - The client's tag type is `EpisodeTag`, and `readEpisodeTag` exports
    `TAG_SHAPES`.
  - `titleFromFilename` ends a title at `TAG_SHAPES` instead of its own two
    patterns, so the client spells the tag's shape once, and its docblock is
    on the function.
  - `AddMovieButton` is `AddTitleButton`, and `kindSwitchable` is
    COMPONENT-SPEC's `showKindTabs`.
- **Group 3, the server's tidies, and the primitive's leaves.**
  - `seriesFormBody.test.ts`, on `movieFormBody.test.ts`' shape and header.
    `collectEpisodeUploads` stays asserted through the router.
  - `readSeriesFields` answers each episode as a `LandedEpisode`, its
    `video` and `subtitles` paired once the checks pass, so the route's two
    casts are gone. `span?.endYear == null` is strict, and the route's
    `yearSpan` import sits with the other `library/` import.
  - `cellYears` is inlined into its one caller.
  - `FilePicker`'s multiple mode has its leaves.
- **Group 4, the docs.**
  - CLAUDE.md: the tree names `PillTabs/`, `EpisodeFileRow/`,
    `seriesFormBody/`, `yearSpan/`, the movie form's units (`MovieForm/`,
    the two Files cards, `filesCard.styles.ts`, `filesCard.ts`,
    `useMovieForm/`, `useEpisodeList/`, `readEpisodeTag/`,
    `titleFromFilename/`, `formValues/`, `createSeries`), and `form.ts` in
    the types line. _Movie Import — One Form_ says the form adds a series on
    the Kind tabs, that the Save gate is a video for either kind and held on
    the wire, and that a series is one atomic `POST /api/series`. Step 13 and
    the _Add a series_ line are ✅, _(next)_ is on step 14, and _Neither 14
    nor 15 has a prototype yet_.
  - README: the same ✅ and _(next)_, and the new units in its tree.
  - The glossary and COMPONENT-SPEC were read against the final tree. The
    glossary names none of the round's renamed identifiers, and
    COMPONENT-SPEC already said `showKindTabs`, so neither changed.

### Two behaviours narrowed on the way

Neither is reachable through the form, and both are recorded so they are not
a later surprise:

- **A tag in brackets no longer ends a title.** `TAG_SHAPES` want a
  separator or the start of the name before the tag, where the prefill's own
  patterns took any word boundary. `Show (S01E03).mkv` now prefills
  _Show (S01E03)_, and the row is untagged, so the two readers still agree.
- **A subtitle slot taken but never filled refuses.** `readSeriesFields`
  counts only the paths that landed, so such a body answers _Episode … is
  missing a subtitle_ rather than passing an `undefined` path through the
  cast. `readBody` awaits every part, so no body reaches that state today.

### Leaves added, removed and moved

Added:

- _EpisodeFileRow — focus › a focused field keeps the browser's focus ring_,
  red before commit 11's edit and green after;
- _titleFromFilename › titles Harbor.and.Vine.1x3.mkv "Harbor and Vine"_,
  red before commit 13's edit and green after;
- `seriesFormBody.test.ts`: 29 leaves, 40 tests once its `it.each` tables
  expand — `readEpisodeField` (17), the record (7), the refusals (11) and
  their order (5);
- _FilePicker — the multiple mode_: four leaves.

Removed: none. Restated: `SeriesFormFiles.test.tsx`'s render helper, with no
leaf renamed or changed; and `seriesFormBody`'s two value leaves gained the
landed paths in commit 16, as the plan said.

Net +46.

### Follow-ups

None filed. `TextField` and `Textarea` have no focus-ring leaf of their own;
`EpisodeFileRow`'s is the first, read through `resolvedStyle`'s keyboard
focus, and giving them one is a candidate for a later round rather than this
one's work. This entry closes 260, 265 and 266.

---

## 2026-10-08 — Add a series (issues #261–#264)

The **Movie form** now adds a **Series** too. A plain add at `/add` has two
**Form kinds**, chosen on the **Kind tabs** (the Library tabs' pill track,
held in `?kind=series`); the edit and the Resolve stay movie-only. A series is
its shared fields, a poster and one **Episode file row** per picked video,
each numbered from its **Episode tag** and carrying its own subtitles, saved
as one atomic `POST /api/series` that lands on the Series tab. The **Save
gate** is a video for either kind, held on the wire too, and the title fills
itself from the filename. This **closes log 22 Q2's open item**, a form for
series, for the add: Edit, Delete and _Add episodes_ for a held series stay
the follow-up log 29 names. The prototype amendments (`feat.MovieForm`,
`mol.PillTabs`, `mol.EpisodeFileRow`, `page.LibraryPage`, `page.SettingsPage`
and the COMPONENT-SPEC entries) rode in #262's `feat:` commit, as the plan
said.

Eight commits across issues #261–#264 — four RED/GREEN pairs — against the
plan in `docs/PRDs/29-add-series-plan.md`, built from
`docs/design-logs/29-add-series.md`. **7200 tests pass across 416 files**,
measured at `7f06da3`.

### What shipped, slice by slice

- **#261, the video gate and the title prefill.** `titleFromFilename`, and
  picking a video into an empty title fills it. `POST /api/movies` and
  `PATCH /api/movies/:id` refuse a body with no video, in the resolve route's
  sentence, so no row says it has no film behind it.
- **#262, the Kind tabs and the series surface.**
  - `PillTabs` extracted to `components/`, and `LibraryTabs` drawn on it.
  - The Kind tabs on `?kind=series`, the series' words, and
    `SeriesFormFiles`, the series' Files card.
  - The Settings entrances renamed _Add a title_.
- **#263, a series saved with its episodes.**
  - _The client._ `readEpisodeTag` and its drift guard against the server's
    `episodeTag`, `useEpisodeList`, `EpisodeFileRow`, `FilePicker`'s
    multiple mode, and `createSeries`, landing on the Series tab.
  - _The server._ `yearSpan`, extracted from `readSheet`'s `cellYears`;
    `seriesFormBody`; `addSeries(input, episodes)` in one transaction; and
    `POST /api/series`, rolled back whole on a refusal.
- **#264, each row's own subtitles.** Each Episode file row's _＋ Add
  subtitle_ and **Subtitle rows**, sent as `episodeSubtitle` parts and stored
  in `episode_subtitles`.

### Judgement calls the log did not name

Each was made by a subagent reading one issue, and each is the refactor
round's to settle (`docs/refactor-plans/29-add-series-refactor.md`), except
the last two, which it keeps:

- **`FormKind` declared in the hook**, where log 29 Q28 put it in
  `src/types/` beside `EpisodeFormRow`.
- **`PillTabs` over `string`**, so `MovieForm` added an `isFormKind` guard to
  get its union back out of `onChange`.
- **`HEADING.addSeries`**, a kind's word keyed by job and picked by a nested
  ternary.
- **The picked literals inline.** `useEpisodeList` spells the `picked` arm
  three times beside `pickedFile`, and declares a second `DEFAULT_LANGUAGE`.
- **Optional episode props on `SeriesFormFiles`**, with an `ignore` default,
  though its one caller passes every one since #263.
- **The Files card's constants and furniture restated**, and its styles
  re-exported from `MovieFormFiles.styles`.
- **The prototype's `outline: none` carried** onto `EpisodeFileRow`'s fields.
- **`titleFromFilename`'s own tag patterns**, narrower than
  `readEpisodeTag`'s.
- **`seriesFormBody` without a suite** of its own.
- **The route's casts** of paths the body reader had already proved.
- **`FilePicker`'s multiple mode without a leaf** in its own suite.
- **`lib: dom.iterable` in `tsconfig.spec.json`**, so suites can spread a sent
  `FormData` to read its parts in order. Kept.
- **`FilePicker`'s two modes as a union of prop shapes** told apart by
  `multiple`, rather than a second primitive. Kept.

### Deliberately not built

Everything log 29 _Not built_ lists:

- Edit, Delete, or _Add episodes_ for a series already held;
- series in the **Import context** (`unplaced` stays Skip-only);
- a backdrop slot, a still slot, an air-date field;
- a bulk subtitle picker matched by stem;
- an upload progress bar (debt shared with the movie kind);
- a duplicate-series check.

### Follow-ups

The refactor plan, filed as 266, with the plan's Phase 5, filed as 265,
folded into it.

---

## 2026-10-07 — Default poster refactor (issue 259)

Ten commits against `docs/refactor-plans/28-default-poster-refactor.md`, one
per plan commit, none dropped. **6946 tests pass across 407 files**, from
6943 across 406 at the end of the build. `tsc -b` is clean, and
`eslint src server electron .husky` reports no errors and the one warning the
codecs-page round already logged (`AboutSection.test.tsx`'s escaped dot). No
commit changed a pixel.

Issue 258, the plan's Phase 5 (_the close_), was folded into this plan when
it was filed, so the initiative has one refactor issue. The standing rule
makes the close the refactor's last commit anyway, and its acceptance
criteria are commit 10's.

### What each group changed

- **Group 0, the record.** The build's own entry, below, written before the
  round touched anything. It records log 03 Q6's open item as closed.
- **Group 1, the comments.**
  - The five `IMAGE_ROUTE` docblocks the build orphaned are gone from `view`,
    `seriesCardView`, `detailView`, `seriesView` and `Player`, so each
    declaration under them is documented by its own block again.
  - `ContinueCardMovie` no longer says the tile carries no artwork.
  - `EpisodeContinueEntry` names the series' poster.
  - `PosterCard` names the **Default poster**.
  - `view`'s `null` resolves to the Default poster.
  - `Artwork` names the **Poster surfaces** and everything that draws the
    plain gradient, instead of listing three callers.
  - The six comment lines the build wrote past 80 columns are rewrapped.
- **Group 2, the shipping tidies.**
  - `ContinueCardMovie.posterUrl` sits beside the title, where
    `PosterCardMovie` has it, and both mappers' literals follow.
  - `ContinueCard`'s `Art` states only the `center 25%` crop. The cover is
    `Artwork`'s. The _"covering the tile at center 25%"_ leaf, which reads
    both properties through `resolvedStyle`, was green before and after.
- **Group 3, one builder per view model, one guard per rule.**
  - `makeContinueCardMovie` sits in `test-support/` beside
    `makePosterCardMovie`, with its suite, and that builder's docblock no
    longer says the resume tile deliberately has none.
  - `ContinueCard`, `CardCarousel` and `ContinueRow` build through it. Their
    local literal, `makeContinueMovie` and `makeMovie` are gone, and every
    leaf keeps its name.
  - The `hasArtwork` name guard left `detailView.test.ts` with its
    `shippingSourcesMatching` import. The `hasPoster` leaves keep the rule,
    and `tsc -b` keeps the name gone.
- **Group 4, the docs.**
  - CLAUDE.md:
    - the tree names `Artwork/`, `Wordmark/`, `imageUrl/` and
      `makeContinueCardMovie/`;
    - the types line says `EpisodeContinueEntry`'s `series` carries
      `posterPath`;
    - step 12 is ✅, _(next)_ is on step 13, and _None of 13–15 has a
      prototype yet_;
    - the Maintainer tools line _Default poster_ is ✅.
  - README: the same ✅ and _(next)_, steps 10–12 in the build order's
    preamble, and `Artwork`, the Wordmark, `imageUrl` and the new builder in
    its tree.
  - The glossary and COMPONENT-SPEC were read against the final tree and left
    alone, as the plan expected.

### Leaves added, removed and moved

Added: `makeContinueCardMovie`'s four:

- _builds every field the tile renders from, none missing_;
- _builds nothing the view model does not declare_;
- _builds a posterless film part-way through_;
- _replaces exactly the field named_.

The plan said three. The key check is two leaves, as in
`makePosterCardMovie`'s suite.

Removed: _detailView — hasArtwork is gone › is read by no shipping file_.

Restated: the fixtures of `ContinueCard`, `CardCarousel` and `ContinueRow`,
with no leaf renamed or changed.

Net +3.

### Follow-ups

None. This entry closes 253, 258 and 259.

---

## 2026-10-07 — Default poster (issues #254–#257)

A title with no **Poster** now draws the **Default poster**: its own
**Gradient fallback** with the FamilyFlix **Wordmark** centred in it, scaled
to the tile, plus the caption the surface already drew. It is drawn in CSS and
never stored, so `poster_path` stays `NULL`, a **Sync** still fetches one,
and no **Write target** writes it out. It appears on the **Poster surfaces**
alone: the Poster card, both detail poster frames and the **Continue card**.
The same initiative put real artwork on the Continue card, which **closes log
03 Q6's open item**, flagged then as a prototype amendment for later. The
prototype amendments (`mol.PosterCard`, `mol.ContinueCard`, `page.MoviePage`,
`page.SeriesPage` and COMPONENT-SPEC's Default poster note) rode in #254's
`feat:` commit, as the plan said. They set the mark's numbers: `11cqmin`,
`opacity: .9` and the title overlay's `0 1px 8px rgba(0,0,0,.55)` shadow.

Eight commits across issues #254–#257 — four RED/GREEN pairs — against the
plan on #253, built from `docs/design-logs/28-default-poster.md`. **6943 tests
pass across 406 files**, measured at `0ed5279`.

### What shipped, slice by slice

- **#254, the Default poster on the card.**
  - _The `Wordmark` primitive._ _Family_ in the text ink, _Flix_ in the
    accent, serif 700, sized by its parent's `font-size`. `MainLayout`'s
    `Logo` and `AboutSection`'s brand row draw it through `styled(Wordmark)`
    at their own 25px and 18px, and neither looks any different.
  - _`Artwork`._ It gained `poster`. With no url, `poster` draws the
    `aria-hidden` Wordmark centred. `Artwork` is a size container, so the
    mark is `11cqmin` of whatever frame it is in. A url is now a background
    layer **over** the gradient for every caller, backdrops included, so a
    file that fails to load shows the gradient rather than a hole.
  - _`PosterCard`_ passes `poster`, on the Movies tab and the Series tab
    alike.
- **#255, the detail pages.** `hasArtwork` became `hasPoster`
  (`posterPath !== null`) in `detailView` and `seriesView`, and both poster
  frames pass `poster`. A title with a backdrop and no poster now gets a
  captioned Default poster in front of its backdrop.
- **#256, the movie's Continue card.** `imageUrl` in `utils/` replaced the
  six local `IMAGE_ROUTE` copies, and a guard holds the route to that one
  file. `ContinueCardMovie` gained `posterUrl`, which `continueView` fills.
  The `ContinueCard` draws it through its own `styled(Artwork)`, cropped
  `center 25%` under the existing scrim.
- **#257, the episode's Continue card.** The series browse read's Continue
  query selects `s.poster_path`, and `EpisodeContinueEntry.series` carries
  `posterPath`. `episodeContinueView` fills `posterUrl` from it and hashes
  its gradient from the **series** id, so the card wears its show's colours.

### Judgement calls the log did not name

Each was made by a subagent reading one issue, and each is the refactor
round's to settle (`docs/refactor-plans/28-default-poster-refactor.md`):

- **Five docblocks orphaned.** The `IMAGE_ROUTE` constants went, but five of
  their docblocks stayed, each now sitting over a different declaration's.
- **`posterUrl` appended.** It sits after `progress` in `ContinueCardMovie`,
  where `PosterCardMovie` has it beside the title.
- **`Art` restates `background-size: cover`**, which `Artwork`'s `Root`
  already declares for every caller.
- **Three local `ContinueCardMovie` literals extended.** Each suite gained
  `posterUrl: null` rather than sharing a builder, though
  `makePosterCardMovie`'s own rule now calls for one.
- **A `hasArtwork` name guard.** `detailView.test.ts` walks the shipping tree
  for the retired name, which `tsc -b` already refuses.
- **The About card's size leaves read the mark.** jsdom doesn't cascade
  inherited properties into `getComputedStyle`, so the 18px is read on the
  word's parent, where it is set. Kept.
- **The Wordmark's gap is the caller's.** It is 2px in the header and 1px in
  the About card, as each drew it before, set through `styled(Wordmark)`.
  Kept.

### Deliberately not built

Everything log 28 _Not built_ lists:

- art on the Season card, the episode thumbnails or the Up next card;
- a Wordmark on a backdrop or behind the player;
- an `<img>` with `onError`;
- a generated or stored Default poster;
- the backdrop or the Still as Continue art.

### Follow-ups

The refactor plan, filed as 259, with the plan's Phase 5, filed as 258,
folded into it.

---

## 2026-10-07 — Ultrawide margins refactor (issue 252)

Eleven commits against `docs/refactor-plans/27-ultrawide-margins-refactor.md`,
one per plan commit, none dropped. **6901 tests pass across 404 files**, from
6891 across 402 at the end of the build. `tsc -b` is clean, and
`eslint src server electron .husky` reports no errors and the one warning the
codecs-page round already logged (`AboutSection.test.tsx:295`). No commit
changed a pixel.

### What each group changed

- **Group 0, the record.** The build's own entry, below, written before the
  round touched anything.
- **Group 1, the shipping tidies.** `SettingsPage`'s docblock rewrapped, no
  word changed; `App`'s route paragraph rewrapped and now naming the season
  page and the **Codecs page**, two framed routes it never listed. The
  stack's `right` is one declaration whose value `$framed` chooses, the
  conditional `css` block and its import gone — the five _Ultrawide margins_
  stack leaves green before and after.
- **Group 2, the wire call as a unit.** `saveUltrawideMargins` in `App/`
  beside its one caller, over `postValue` with `isMarginsEcho`, after
  `saveSubtitleLanguage`; then the provider calling it, its endpoint
  constant, `isBoolean` and `postValue` import gone, its twelve leaves
  unchanged.
- **Group 3, one holder per preference.** `useSettings` holds
  `subtitleLanguage: string | null` rather than the whole `Settings`, so the
  Settings page no longer keeps a second copy of **Ultrawide margins** that
  never updates (log 27 Q13). `PlaybackSection` reads the field; its suite
  passed unchanged. `tsc -b` found no other caller.
- **Group 4, one suite per thing it proves.** `ContentFrame.test.tsx`, the
  frame on a `MemoryRouter` with the context handed in directly — no fetch,
  no provider; `App.contentFrame.test.tsx` keeps the route table's shape. The
  Settings page's Network leaf checks the order it is named for.
- **Group 5, the docs.** The glossary's **Network group** sits between
  Display and Storage. CLAUDE.md: six groups and the widened read and the new
  route in _Settings Hub_; `App/`'s six units, `layout.ts`, `theme.ts`
  mounting `layout`, `DisplaySection/`, the row furniture, `useSettings/`
  holding the language alone, the server's `setUltrawideMargins()`, and the
  types line; step 11 ✅ and _(next)_ on step 12. README: the same ✅ and
  _(next)_, the hub's row counting six groups, and its tree's new units.
  COMPONENT-SPEC was read against the final tree and left alone.

### Leaves added, removed, moved and restated

Added: `saveUltrawideMargins`'s six — _POSTs the new value as JSON to the
ultrawide-margins route_, _sends false … rather than a second route_,
_answers with the value the route says it stored_, _falls back to the
requested value when the route echoes nothing usable_ (the string `"true"`
among them), _throws when the save does not succeed_, _throws when the
request itself cannot be made_; `ContentFrame`'s _caps its outlet at 1920px
with auto side margins while the preference is on_, _draws no cap while the
preference is null_ and _renders the child route inside it_; `useSettings`'
_keeps the subtitle language alone, not the rest of the settings_. Moved:
_draws no cap while the preference is off_, from the App suite to
`ContentFrame`'s. Restated: every `useSettings` leaf against
`subtitleLanguage`, names kept but _hands over the settings once they land_,
now _the subtitle language once it lands_, and the `ultrawideMargins: false`
padding gone from its expectations. Renamed: _composes the Network section
between Display and Storage_, comparing the _Ultrawide margins_ row rather
than _Preferred language_. Net +10.

### Where the round met the plan's words and differed

- **No _Setting row_ term.** The plan named `section.styles.ts`'s rows the
  **Setting row** furniture; the glossary has no such term, so CLAUDE.md and
  README call them the row furniture, and name `Row`, `RowTitle` and
  `RowDesc`.
- **The Network leaf's heading comparison moved too.** Besides the
  _Preferred language_ row, its _Playback_ heading comparison became
  _Display_, so both checks name the neighbour the leaf is titled for.

### 251, merged

The plan's Phase 3, filed as 251, was folded into this round: the standing
rule already makes the close the refactor's last commits, so one issue closes
the initiative rather than two touching the same files.

### Surfaced

Nothing new. The `no-useless-escape` warning above is still the codecs-page
round's, outside this plan.

---

## 2026-10-07 — Ultrawide margins (issues #249–#250)

**Ultrawide margins** is a household preference beside the subtitle
language: one Toggle in a new **Display group** on the Settings page that
caps every screen but the player at the **Content measure**, 1920px, centred,
the page's `bg` showing through the margins. One seam decides it, in `App/`:
the **Content frame** is a layout route around every route but the player's
two, so no layout, page or feature learns the preference exists and a new
screen is framed by default (log 27 Q8–Q12). The value lives in the library's
database, not `localStorage`, so it survives a cleared profile and travels
with a backup. The prototype amendments — the Display group in
`page.SettingsPage.dc.html` and COMPONENT-SPEC's Content frame note — rode in
#249's `feat:` commit, as the plan said, rather than a docs-only one of their
own.

Four commits across issues #249–#250 — two RED/GREEN pairs — against the plan
on #248, built from `docs/design-logs/27-ultrawide-margins.md`. **6891 tests
pass across 402 files**, measured at `1f5dfed`.

### What shipped, slice by slice

- **#249, the toggle and the frame.**
  - _The server._ The `ultrawide-margins` key in `library/settings/`, stored
    `'1'` / `'0'`; `settings()` answers `ultrawideMargins` beside the
    language, `DEFAULT_ULTRAWIDE_MARGINS` (`false`) when the row is absent;
    `setUltrawideMargins()` as an upsert; and
    `POST /api/settings/ultrawide-margins { value }` → `{ value }`, a
    **Single-signal write** whose `400` refuses anything but a boolean — the
    string `"true"`, `1` and `null` included.
  - _The type._ `Settings` gained `ultrawideMargins`, and `settings.ts`
    `DEFAULT_ULTRAWIDE_MARGINS`.
  - _The provider and hook._ `DisplayPreferenceProvider` in `App/`, outside
    the Snackbar stack, reads the shared `fetchSettings` once on mount
    (**Blank until it lands**) and writes on `useSettings`' bargain: shown at
    once, posted, the echo kept, put back on refusal, never rejecting.
    `useDisplayPreference()` reads it, throwing outside the provider.
  - _The frame._ `ContentFrame` in `App/`, the layout route's element:
    `max-width` at the measure with auto side margins while the preference is
    `true`, nothing while it is `false` or `null` — no media query, no
    transition.
  - _The Display group._ `DisplaySection`, between Playback and Network: the
    _Ultrawide margins_ row and its Toggle, writing through the provider.
  - _The furniture._ `Row`, `RowTitle` and `RowDesc` moved out of
    `PlaybackSection.styles.ts` into `section.styles.ts`, both sections on
    them — the plan's phase 3, done in the build because phase 1 would
    otherwise have written them twice.
  - _The token._ `tokens/layout.ts`, `contentMeasure: '1920px'`, mounted by
    `createTheme` as `theme.layout`.
- **#250, the stack at the frame's corner.** `SnackbarProvider`'s stack takes
  `$framed` while the preference is on: its `right` follows the frame's
  bottom-right corner on a window wider than the measure, and the window's
  own corner on a narrower one. Nothing else moves (log 27 Q16–Q17).

### Judgement calls the log did not name

Each was made by a subagent reading one issue, and each is the refactor
round's to settle (`docs/refactor-plans/27-ultrawide-margins-refactor.md`):

- **The wire call inlined.** The plan named `saveUltrawideMargins` beside the
  provider; the build has none. The provider holds the endpoint as a module
  constant, its own `isBoolean` guard, and calls `postValue` inline, so the
  route's wire contract is proven only as the effect a fetch mock observes.
- **`useSettings` left holding the whole `Settings`.** Log 27 Q13 kept it to
  the subtitle language. It holds both fields, so the Settings page holds the
  preference twice — once in the provider, which follows every flip, and once
  in `PlaybackSection`'s read, which never updates. Eleven fixtures across
  `useSettings.test.ts` and `PlaybackSection.test.tsx` gained
  `ultrawideMargins: false` to keep up.
- **`ContentFrame` proven only through `App`.** It has no suite of its own;
  its docblock points at `App.contentFrame.test.tsx`, which proves the
  frame's three states through twelve routes and six fetch branches.
- **The stack's `right` written twice.** `Stack` declares `right: s5`, then a
  second `right: max(…)` in a conditional `css` block, working by cascade
  order.
- **The stack reads `DisplayPreferenceContext` directly**, not through the
  throwing hook, so the eighteen suites that mount the stack alone read as
  off. Kept — the refactor plan's Decision Document says why.
- **The furniture guard's source reader joins with `node:path`.** Vite
  rewrote the RED suite's dynamic `new URL` template into an asset glob, so
  `DisplaySection.test.tsx` reads the two sections' sources through
  `path.join` instead.

### Deliberately not built

Everything log 27 _Not built_ lists: a width picker or a custom measure,
wheel scrolling forwarded from the margins, a `localStorage` mirror for the
first paint, and any change to the player, fullscreen or the Modal.

### Follow-ups

The refactor plan, filed as 252, with the plan's phase 3, filed as 251,
folded into it.

---

## 2026-10-07 — Codecs page refactor (issue 247)

Eleven commits against `docs/refactor-plans/26-codecs-page-refactor.md`, one
per plan commit, none dropped. **6835 tests pass across 398 files**, from 6832
across 398 at the end of the build. `tsc -b` is clean, and
`eslint src server electron .husky` reports no errors and one warning that
predates this initiative (below).

### What each group changed

- **Group 0, the record.** The build's own entry, below, completed before
  the round touched anything: slice by slice, the judgement calls the log did
  not name, what was not built, the counts, the follow-up.
- **Group 1, two tidies.** `PlaybackSection`'s two spliced docblock
  paragraphs and `NetworkSection`'s sync paragraph rewrapped, no word
  changed. `GroupCard` stops re-spelling `Card`'s 32px; `$last` writes only
  `margin-bottom: 0`, on `AboutCard`'s reason.
- **Group 2, one suite per proof.** The keys and the chevron moved into
  `NavigationRow.test.tsx`; the Codecs row suite keeps what `PlaybackSection`
  hands the molecule; the Sync row suite gained its placement.
- **Group 3, the placement.** `NavigationRow` forwards `className` onto the
  button, `LoadMessage`'s precedent, and its own `Row` keeps only the `0 4px`
  inset both prototypes share. `SyncRow` and `CodecsRow`, each
  `styled(NavigationRow)` in its section's styles, place it — first both at
  `15px 4px 4px`, a pure refactor, then the Codecs row at the prototype's
  `4px 4px 0`.
- **Group 4, the docs.** The glossary's **Navigation row**, the **Codecs
  row** entry pointing at it, and the relationship line made five groups with
  only _Change…_ undrawn; `page.CodecsPage` ✅ in COMPONENT-SPEC; CLAUDE.md's
  `NavigationRow/` line naming the placement. README's tree line already
  held, and was left.

### Leaves restated

Added: `CodecManager`'s _keeps the group gap under the Playback component
card and none under Formats_; `NavigationRow`'s _pushes its destination on
Enter after Tab_, _on Space after Tab_, _carries a chevron at its end_ and
_puts a className handed in on the button_; the Sync row's _sits at the
prototype's 15px 4px 4px_; the Codecs row's _sits at the prototype's 4px 4px
0_. Removed from the Codecs row suite: _on Enter after Tab_ and _on Space
after Tab_ (now the molecule's), _takes only the read from useCapabilities,
never a write_ (the source grep — _sends nothing to the component route_
proves the rule by behaviour), and _matches the Sync metadata & posters row
rule for rule_. Renamed: _carries the microchip glyph in its tile_, its
chevron half gone to the molecule. Net +3.

### The one visible change

The Codecs row moved up 11px and lost 4px of height: `page.SettingsPage.dc.html`
draws it at `4px 4px 0`, first in its card, where the Sync row sits at
`15px 4px 4px` under a divider. Log 26 Q14's "character for character" was the
condition for one molecule, not a reason to make two paddings one.

### Where the round met the plan's words and differed

- **No _Action row_ term to sit beside.** The plan put **Navigation row**
  "beside **Action row**", but the glossary has no such row — _Action rows_
  appears only in prose (the **Section card** row and a relationship line).
  The new term sits in _The Codecs page_ table beside the **Codecs row**. An
  **Action row** term was not added; it is a gap, not this round's.
- **The guard's section assertion was replaced, not kept.** _The two rows it
  replaced_ asserted each section's `.tsx` renders `<NavigationRow`; once each
  renders its placement it cannot. It now asserts each section's styles
  extend `styled(NavigationRow)` and declare no `styled.button`, with the copy
  pattern narrowed to the five inner parts.
- **The gap leaf reads both cards off the _Formats_ heading.** _Playback
  component_ is both the group heading and the Component row's line, so the
  cards are the heading's previous and next siblings.

### The tick

Left standing where #246 put it, in README and CLAUDE.md. This round closing,
with 243, is what makes it true.

### Surfaced

`eslint` reports one `no-useless-escape` warning at
`AboutSection.test.tsx:295`, from `af7bf17` (software-update #237). The
enrichment refactor had taken the suite to zero warnings; this one came in
after. Not fixed here — outside the plan.

---

## 2026-10-06 — Codecs page (issues #244–#246)

The Codec report left the Settings page for `/settings/codecs`, the hub's
first nested route, and the shape a future Settings sub-page follows: a page
in `pages/` that is `MaintainerLayout` at the hub's 780 column around one
`features/settings/` organism, which draws its own maintainer header with
Back onto Settings as its **Landing**, and a **navigation row** on the
Settings card that pushes it — now `NavigationRow`, the Codecs row and
_Sync metadata & posters_ written twice and extracted once (log 26 Q14), and
kept in `features/settings/` because both callers are Settings groups. The
report is read twice on a round trip, once by the Playback card for the Codec
summary and once by the Codecs page for itself; that was accepted rather than
cached (log 26 Q13), because the read is cheap and a shared cache would be a
second source of truth for what pressing Play will do. The prototype
amendments (`page.CodecsPage`, the reworked `feat.CodecManager`, the Settings
page's Codecs row, COMPONENT-SPEC) rode in #244's commit rather than a
docs-only one of their own.

Six commits across issues #244–#246 — three RED/GREEN pairs — against the
plan on #243, built from `docs/design-logs/26-codecs-page.md`. **6832 tests
pass across 398 files**, measured at `301a7ae`.

### What shipped, slice by slice

- **#244, the Codecs page end to end.** `CodecsPage` at `/settings/codecs`,
  `MaintainerLayout` at 780 around `CodecManager`, which gained its own
  maintainer header — Back onto Settings, **Codecs**, the lede — over the
  _Playback component_ group (the Component row, then the drop zone) and the
  _Formats_ group (the Codec summary over the rows). The route went into
  `App.tsx`. The Playback card kept a stopgap report until #245.
- **#245, the Codecs row on Settings.** The Playback card opens with one
  Codecs row whose line is the Codec summary, pushing `/settings/codecs`; the
  stopgap report and its styles went, and `PlaybackSection` takes only the
  read from `useCapabilities`.
- **#246, the graduation.** The Codecs row and _Sync metadata & posters_
  draw through one `NavigationRow` in `features/settings/`, both sections'
  copies of the row's styles gone; and the close's docs — both trees, the
  Settings Hub section, the tick, this entry, the glossary's Codecs row.

### Judgement calls the log did not name

Each was made by a subagent reading one issue, and each is the refactor
round's to settle (`docs/refactor-plans/26-codecs-page-refactor.md`):

- **The Codecs row took the Sync row's padding.** #245's body says the row
  was copied "rule for rule… No difference from the Sync row was needed". The
  amended `page.SettingsPage.dc.html` draws the Codecs row at `4px 4px 0`,
  first in its card, and the Sync row at `15px 4px 4px`, under a divider — so
  the Codecs row sits 11px low and 4px tall, and #246 baked that into the
  molecule's default.
- **A _rule for rule_ leaf.** `PlaybackSection.codecsRow.test.tsx` asserts
  every computed property of both rows' six parts equal — written to force
  the graduation, and now asserting the wrong thing for placement.
- **The molecule's behaviour proven through one caller.** Enter, Space and
  the chevron are leaves in the Codecs row suite, not in
  `NavigationRow.test.tsx`; the Sync row's suite proves none of it.
- **A source-grep leaf.** _Takes only the read from useCapabilities, never a
  write_ greps `PlaybackSection.tsx` for the write names, beside a leaf that
  proves the same rule by behaviour.
- **`GroupCard` re-spells the group gap.** It extends `Card`, which already
  sets the 32px, and writes it again for every card but the last.
- **The ✅ ticked at #246**, in README and CLAUDE.md, rather than when the
  refactor closes. It is left standing; this round closing with #243 is what
  makes it true.

### Deliberately not built

Everything log 26 _Not built_ lists: an accordion or any collapse, a
Video/Audio split, search or filter over the formats, a codec's own details
page, a shared cache of the report, a header action, **Move the media
folder**, and any server change.

### Follow-ups

The refactor plan, filed as 247.

---

## 2026-10-05 — The Sandbox blank window, closed undiagnosed (issue #240)

The blank window from _Closed without steps 2–8_ below was never diagnosed.
The Shell log was not read, and neither `--disable-gpu` nor
`<vGPU>Disable</vGPU>` was tried. The likeliest reading is still Chromium not
painting under the Sandbox's virtual GPU, but that is a guess, not a finding.

The maintainer closed #240 and **moved the Package smoke off Windows Sandbox
onto real hardware**: the maintainer's own Windows machine for the draft's
Installer, then the parents' PC. The family runs real GPUs, so real hardware is
the closer proof. What is lost is the _clean user_. The dev machine has Node,
the VC++ runtimes and maybe FFmpeg on PATH. The installed app always reads its
own Default component, so PATH cannot mask a missing FFmpeg, but a missing
runtime DLL could hide there. **The parents' PC is now the clean-machine
check**: v0.2.0 is installed and an `.mkv` played there before v0.2.1 is cut,
because from v0.2.1 on a published release reaches that PC by itself.

`docs/release-checklist.md` §2 now names the target machine rather than the
Sandbox, and §11's offline check quotes the row's own words. If a blank window
is ever seen on real hardware, the two untried checks above are still the place
to start.

The manual check #236 left open passed the same day: under `electron:start`,
**Check for updates** reads _Checking…_, then _Updates are only available in
the installed app._

---

## 2026-10-03 — Desktop packaging refactor (issue #234)

Thirteen commits against `docs/refactor-plans/25-desktop-packaging-refactor.md`,
with the docs slice filed as 233 folded in — twelve of the plan's fourteen, one
`fix:` the smoke found, and none for commit 9, dropped. **6700 tests pass
across 388 files**, from 6693 across 387 at the end of the build. `tsc -b` is
clean, and `eslint src server electron .husky` reports nothing.

**Not ticked.** The plan's last step is the ✅, and it is held back: the
**Package smoke** has run its step 1 and not its steps 2–8 (see the build's
entry below, _The smoke's result_). Desktop packaging stays 🔜 in README and
CLAUDE.md, step 8 stays in the build-order chain, and #234 and #227 stay open
until the smoke passes in Windows Sandbox.

### What each group changed

- **Group 0, the record.** The build's own entry, below, written before the
  round touched anything.
- **Group 1, the guard.** Three characterization leaves in
  `packagingConfig.test.ts`, each green on arrival: `files` is exactly
  `package.json`, the two bundles and the icon, with no glob (Q7);
  `win.signAndEditExecutable` is `true`, with the log's reason as its comment
  (Q18); and the binding's `extraResources` `from`, joined onto a repo, is the
  directory `shellPaths('start', …)` reads it from.
- **Group 2, the units.** `productName` left `builderConfig.json`, so
  `package.json`'s names the exe, the Installer and `userData` alike, and the
  guard asserts the config carries none. `ShellPaths.app` went, with its two
  leaves — nothing read it. The guard's two installed `shellPaths(…)` calls
  became one `installedPaths()`. And the zip reader left `fetchFfmpeg.mjs` for
  `electron/scripts/zipEntries/`, on `verifyDigest`'s precedent, with a suite
  of five: stored, **deflated** — the branch every real run takes, run by a
  test for the first time — not a zip, a damaged local header, an unknown
  method. `fetchFfmpeg`'s own suite did not change and stayed green.
- **Group 3, the smoke.** `docs/release-checklist.md`, linked from README;
  step 1 run and passed; `b03a0e1`, the one fix it found — `"publish": null`,
  so the layout carries no `app-update.yml` — and the result in the build's
  entry.
- **Group 4, the documents.** CLAUDE.md's stack line, packaging line, the two
  variables and the folder map; README's packaging line, _The installer_,
  _Installing on a new machine_ and its tree; the **App mark** row in
  COMPONENT-SPEC; the glossary's **Package smoke** and **Packaged layout**
  rows, and a relationship line still saying the installer "bundles" the
  component; ⚠️ pointers on log 24 Q19 and log 17 Q11.

### Leaves restated

Added: the three guard leaves, the five `zipEntries` leaves, and the
_names no release feed_ leaf; one assertion — no `productName` — on the
existing _versioned 0.1.0_ leaf. Removed: _answers the repo as the app_ and
its installed counterpart in `shellPaths.test.ts`. Nothing else moved.

### Commit 9, dropped

`electron/scripts/package.json`, `{ "type": "module" }`, would have silenced
the `MODULE_TYPELESS_PACKAGE_JSON` warning `fetchFfmpeg.mjs` prints when it
imports a `.ts` unit. It did: the leaf asserting no warning went red without
it and green with it, and `tsc -b` stayed clean. But `nx show projects` then
failed outright — _"The projects in the following directories have no name
provided: electron/scripts"_. Nx reads every nested `package.json` as a
project, and the plan forbade giving it a name. The plan's rule was to drop
the commit if either check failed, so it was dropped, manifest and leaf both.

**The warning is accepted.** It prints once per `electron:ffmpeg` — twice per
`electron:package`'s log is the worst it gets, since both units load in one
run — and changes nothing: Node reparses the unit as ESM and runs it. An
`.nxignore` entry for `electron/scripts` would let the manifest stand; it was
offered and not taken, because it means teaching Nx to look away from a
directory to quiet a warning, and the next nested manifest would need the
same.

### Deliberately left out

- **The glossary's _(new)_ tags stay.** The plan said to drop them "on the
  precedent of the earlier sections". There is none: every section keeps its
  tags, the shell refactor's glossary commit included. Dropping them from one
  section would make it the odd one out.
- Everything the plan's _Out of Scope_ named: the fetch scripts' own output
  directories, a suite for `packageApp.mjs`, the NSIS target and
  `electronVersion` in the script, `serverLaunch`'s `userData` parameter,
  `buildElectron.test`'s better-sqlite3 marker, and everything log 25 ruled
  out.

### Still to do

**The Package smoke's steps 2–8**, in Windows Sandbox, against an Installer
rebuilt after `b03a0e1`. Sandbox is off on the dev machine
(`Containers-DisposableClientVM`): _Turn Windows features on or off →
Windows Sandbox_, then a restart. Then the result goes in the build's entry,
any failure is a `fix:` under 234, and the ✅, the chain's step 8 and the
close of 234 and 227 follow.

---

## 2026-10-01 — Desktop packaging (issues #228–#232)

Ten commits across issues #228–#232 — five RED/GREEN pairs — against the plan
on #227, built from `docs/design-logs/25-desktop-packaging.md`. **6693 tests
pass across 387 files**, from 6626 across 383 at the end of the shell round.
`tsc -b` is clean, and `eslint src server electron .husky` reports no errors
and no warnings. 19 files, most of the line count the lockfile. It carries
build step 8: the repo becomes one file, `FamilyFlix-Setup-0.1.0.exe`, that
the maintainer double-clicks on the parents' PC. The prototype draws no
installer, so "the prototype" here is the **App mark**, and every surface the
log listed (Q18) points at the one `icon.ico`.

**Not ticked** in the feature table. ✅ when the refactor closes and the
**Package smoke** has passed, not when the build issues do.

### What shipped

- **#228, the installed shape's paths.** `electron/shellPaths/`, pure: the
  **Shell mode** and Electron's three locations → the icon, the server bundle,
  the renderer, the binding, FFmpeg and the server's working directory, read
  once by main in place of `process.cwd()`. `serverLaunch(mode, userData,
paths)` built on it, with `nativeBindingPath` folded in, as the plan said.
- **#229, no `node_modules` to ship.** `better-sqlite3`'s JS bundled into
  `electron/dist/server.js`, and `dependencies: {}` — everything moved to
  `devDependencies`, the lockfile refreshed with `--package-lock-only` —
  guarded by `buildElectron.test.ts`. Split out of the log's first step, as
  the plan said, because the paths and the dependencies do not depend on each
  other.
- **#230, the first Installer.** `electron-builder` behind `packageApp.mjs`
  (`electron:package`, `--dir` for the layout alone),
  `electron/packaging/builderConfig.json` and its guard,
  `packagingConfig.test.ts`; `version` `0.1.0` and `author` in
  `package.json`, so About reads `0.1.0`.
- **#231, FFmpeg on board.** The **FFmpeg pin**,
  `electron/packaging/ffmpegPin.json`; `fetchFfmpeg.mjs` (`electron:ffmpeg`)
  and `verifyDigest`; the gitignored `electron/.ffmpeg/` shipped as
  `resources\ffmpeg\`; and `FAMILYFLIX_FFMPEG_PATH` set by `serverLaunch` when
  installed, so the pin's build is the **Default component**.
- **#232, hardening.** The four fuses in `builderConfig.json` — `runAsNode`,
  `enableNodeOptionsEnvironmentVariable` and `enableNodeCliInspectArguments`
  off, `onlyLoadAppFromAsar` on — with asar integrity validation left unset.

### Judgment calls the slices made on their own

- **`verifyDigest` at `electron/scripts/verifyDigest/`**, erasable TypeScript
  imported by the `.mjs` under Node's type stripping. That disproves the
  reason the `electron-shell` refactor gave for leaving the binding's path
  spelled twice — "a `.mjs` script run by Node cannot import a `.ts` unit
  without a loader". It can.
- **The README's digest as `fetchFfmpeg`'s "already matches" mark**, rather
  than hashing two binaries on every package.
- **The zip read by hand**, so the script needs no dependency.
- **The NSIS x64 target and `electronVersion` supplied by `packageApp.mjs`**,
  not written in the config, because `--dir` swaps the target and the version
  is read off `node_modules/electron`, so the runtime and the binding cannot
  disagree (Q17). Both stay.
- **The pin at gyan.dev's essentials 9.0.2**, from the GyanD GitHub release,
  its SHA-256 computed over the download and checked against the digest
  GitHub publishes for the asset.
- **`nativeBindingPath` folded into `shellPaths`**, as the plan said.

### Verified unattended

- `electron:package --dir` wrote `release/win-unpacked/`: `app.asar` holds
  only `package.json`, the two bundles and `icon.ico`; `resources\renderer\`
  and `resources\native\better_sqlite3.node` beside it; no `node_modules`
  anywhere.
- `electron:package` wrote `release/FamilyFlix-Setup-0.1.0.exe`, on Electron
  38.8.6, the installed version and the binding's.
- The exe's version resource reads FileDescription `FamilyFlix`, FileVersion
  `0.1.0` and CompanyName `Carlos Rezai`.
- The real pin downloaded, verified and extracted in about five seconds to
  exactly `ffmpeg.exe`, `ffprobe.exe`, `LICENSE.txt` and `README.txt`;
  `ffmpeg.exe -version` reads `9.0.2-essentials_build-www.gyan.dev`; a second
  run said it already matched.
- The fuse wire read back from the exe matches the config.
- Vitest green straight after a package.

### Not run: the Package smoke

The log's proof of an **Installer** (Q26) needs an install, and a slice runs
unattended. Each closing comment listed its items as outstanding:

- **#228, #229:** `electron:dev` and `electron:start` on `shellPaths`, the
  bundled `better-sqlite3` and the Electron-ABI binding.
- **#230:** no console window flashing during a package; the exe's icon in
  Explorer; SmartScreen once, the one-click window wearing the mark, the app
  opening maximized; the mark on the shortcuts, the taskbar, Alt+Tab, a pin
  and _Settings → Apps_ (publisher Carlos Rezai, 0.1.0); Task Manager reading
  FamilyFlix; the pin and the window as one button; uninstall keeping
  `%APPDATA%\FamilyFlix\` and a reinstall showing the same library; a
  direct-played MP4.
- **#231:** `resources\ffmpeg\` holding exactly the four files, no
  `ffplay.exe`; an `.mkv` remuxed and played; the Codec report saying
  **Default**; an uploaded pair overriding it and the ✕ falling back.
- **#232:** all of the above on the hardened exe; `ELECTRON_RUN_AS_NODE`,
  `NODE_OPTIONS` and `--inspect` with no effect; a stray `app` folder beside
  the asar ignored.

So nothing has yet proven that the installed app opens on a machine with no
Node. The refactor writes the smoke down as a checklist and runs it, as its
Group 3.

### The smoke's result (2026-10-03) — step 1 only, 2–8 deferred

Run against `docs/release-checklist.md` on the dev machine, Windows 11 Pro
10.0.26200.9457, over the tree after the refactor's Groups 1–2.

- **Step 1, Build — passed.** `npm run electron:package` ran with no console
  window flashing. It wrote `release/FamilyFlix-Setup-0.1.0.exe` (152 MB).
  `release/win-unpacked/resources/ffmpeg/` held exactly `ffmpeg.exe`,
  `ffprobe.exe`, `LICENSE.txt` and `README.txt`. The exe's version resource
  read FileDescription and ProductName `FamilyFlix`, FileVersion `0.1.0` and
  CompanyName `Carlos Rezai`, and `Get-AuthenticodeSignature` read both the
  exe and the Installer as `NotSigned`, as Q21 settled. The log's _signing
  with signtool.exe_ lines are rcedit's stamping (Q18), not a signature.
- **One finding, fixed in `b03a0e1`.** The layout carried
  `resources\app-update.yml` naming a GitHub provider off the git remote.
  `packageApp.mjs`'s `publish: 'never'` stops an upload, not the inference,
  so with no `publish` in the config `electron-builder` wrote the feed step 9
  owns (Q1). `"publish": null` in `builderConfig.json`, held by a new guard
  leaf; a `--dir` package after it has no `app-update.yml`. Nothing reads the
  file before step 9, so it was harmless — but it is part of the Installer,
  and the Installer should name no feed it does not have.
- **Steps 2–8 — not run, deferred.** Windows Sandbox is not enabled on this
  machine (`Containers-DisposableClientVM` disabled), and enabling it needs an
  admin prompt and a restart. The maintainer chose to finish the round's
  documents first. An install on the dev machine itself would not stand in:
  it has Node, a dev library and earlier installs, which is exactly what step
  3 exists to rule out.

So **Desktop packaging stays 🔜** and #234 and #227 stay open until steps 2–8
pass. The Installer on disk from this run predates `b03a0e1`; rebuild before
running them. Each failure becomes a `fix:` commit under 234, and the results
are added here.

### Closed without steps 2–8 (2026-10-04)

The Installer was rebuilt after `b03a0e1` (no `app-update.yml` in the layout)
and Windows Sandbox enabled. In the Sandbox it installed and its window opened
wearing the mark, but the window drew nothing: Windows' default light grey,
not the window's own `#14110d` background, with something under the pointer
that reacted to a hover. That reads as Chromium not painting under the
Sandbox's virtual GPU rather than a missing page — the window only shows on
`ready-to-show` — but it was **not diagnosed**: neither `--disable-gpu` nor a
Sandbox with `<vGPU>Disable</vGPU>` was tried, and the Shell log was not read.

The maintainer chose to close the initiative on step 1 alone and move on to
step 9. So **Desktop packaging is ✅ with the Installer unproven on a clean
machine**: steps 2–8 of `docs/release-checklist.md` have never passed. The
first install on the parents' PC, or step 9's own proof cycle, is where a
blank window would show up first; if it does, the two checks above are the
place to start.

### Deliberately not built (Q1, Q2, Q16, Q21, the Trade-offs)

The release feed, `publish`, `release.yml` and `npm version` (step 9); signing
of any kind, and asar integrity validation; arm64, macOS and Linux; an
assisted installer, a directory picker, installer artwork, a portable build or
an MSI; auto-launch, a tray, and backup on install.

### Follow-ups

The refactor is 234. The docs-and-refactor-filing slice, 233, was folded into
it and closed at filing.

---

## 2026-09-30 — Electron desktop shell refactor (issue #226)

Seventeen commits against `docs/refactor-plans/24-electron-shell-refactor.md`,
the docs-and-refactor-filing slice filed as 225 folded in. **6626 tests pass
across 383 files**, from 6608 across 378. `tsc -b` is clean, and
`eslint src server electron .husky` is clean of warnings too: the one
`no-script-url` warning was the whole of its report. `electron/main.ts` is
**238 lines, from 257** — fewer lines is not the point; what is left is
wiring. **Nothing changes on screen.**

**Electron desktop shell** is ticked ✅ in both feature lists, and **Desktop
packaging** is next.

### What each group changed

- **Group 0, the record.** The build's own journal entry, below, written first
  so it describes what shipped before this round changed it.
- **Group 1, the shared double.** `electron/test-support/fakeServerChild/`, the
  shell's rung of the test-support rule, excluded from `tsconfig.electron.json`
  so the typecheck enforces it. The `awaitExitOrKill`, `serverHandle` and
  `shellDialogs` suites moved onto it; their three local `FakeChild`s are gone.
- **Group 2, the main process.**
  - `shellMode(isPackaged, env)` → `'dev' | 'start' | 'installed'`, the
    **Shell mode**, read once. `serverLaunch` and `rendererUrl` take the mode
    in place of `isPackaged` and a flag, and `main.ts` reads
    `FAMILYFLIX_SHELL_PROD` nowhere.
  - **One fork path.** `serverLaunch` answers `electron/dist/server.js` in
    every mode, `execArgv` left `ServerLaunch`, and `electron/serverBoot.mjs`
    is deleted. `electron:dev`'s watcher already built that bundle before it
    launched Electron.
  - `quitAfterShutdown`, `reloadOnce` and `loadRenderer`: the quit gate, the
    one reload, and loading until Vite answers, each a unit with a suite.
    `loadRenderer` also checks the window before each ask, not only after a
    refusal — a retry scheduled as the window closed would otherwise have
    called `loadURL` on a destroyed window, which Electron throws on.
  - **The dialogs log themselves.** `DialogWorld` gained `log`, so the
    _stopped unexpectedly_ dialog reaches the **Shell log** as the startup one
    already did, and a third dialog cannot be added unlogged.
- **Group 3, the server's half.**
  - `shellHandshake(parentPort, startup)` is handed a `Started` — which moved
    into its module — and answers it. `server/src/main.ts` lost its reassigned
    `let shutdown` and the optional third parameter is gone.
  - `boundPort(server)` in `listen/`, the one reading of the port; the cast
    lives there alone.
  - `loopbackGuard` and `rendererRouter` moved to `routes/`, as Q13 and Q15
    placed them. `shell/` is `shellHandshake`, `listen` and `orderedShutdown`.
  - `withoutCsp` is gone, and with the renderer path unset nothing is mounted.
    The rule is the renderer's policy: sent on the renderer, never on `/api`.
- **Group 4, the drift.** `electron:start` calls `nx` by path, and the
  `buildElectron` suite now asserts every `electron:*` command is `node` on a
  path. The `javascript:` literal carries its `eslint-disable` and reason.
- **Group 5, the documents.** CLAUDE.md's environment section, the folder map
  (`electron/` and every unit, `server/src/shell/`, the two route units,
  `shell.ts`, `db/`'s binding), the commit gate's three shipping projects,
  _Desktop Build_, step 7's line (Q3's autofill struck) and the new Roadmap
  item **Move the media folder** (Q2). README's run section rewritten around
  `dev`, `electron:dev`, `electron:start`, `electron:native` and
  `electron:icon`; the nonexistent `npm run release` and `npm version` hooks
  are gone. The glossary's **Save to computer**, **Server process**, **One
  origin**, **Loopback guard** and **Unpackaged run** corrected, **Shell mode**
  added, and the ⚠️ pointers on `04-movie-detail` Q14 and `17-software-update`
  Q13.

### Leaves restated

As the plan named: `serverLaunch`'s dev pair (_forks the bundle the watcher
builds_, _passes no Node flags_) and `rendererRouter`'s pair (_never sends the
renderer's policy on /api_, _sends the renderer's policy nowhere_). One more
than the plan named: _leaves an unknown /api path the API's own 404_ asserted a
null CSP in one line, which Express's own `404` no longer gives once
`withoutCsp` is gone; that line now asserts the renderer's policy is absent,
the same restatement. The packaged-with-the-flag run of `serverLaunch`'s
packaged describe collapsed into `'installed'`, and "packaged ignores the flag"
is `shellMode`'s leaf instead.

### The manual smoke

The bundled server — the one every mode now forks — was run under Node over a
scratch library with the built renderer: a deep route answered `index.html`
under the renderer's policy, `/api` answered with none, Express's own `404`
carried its own `default-src 'none'`, and a rebinding `Host` got `403`.

**The Electron window smokes were not run**, for want of a display session:
`electron:dev` opening the library over the bundle and a film playing,
`electron:start` reloading on `/series/3/season/2`, closing during playback
inside 5 s with no `-wal`, and killing the server offering Restart with the
dialog in the **Shell log**. They are the first thing to run by hand.

### Deliberately left out

The installed app's resource paths (step 8's), one spelling of the native
binding's path, tests for `buildIcon.mjs` and `fetchNative.mjs`,
`orderedShutdown`'s idempotence (the memo stays in `start()`), the guard's
`bind(port)` shape, and `npm run dev`'s bare `concurrently` — each as the
plan's _Out of Scope_ gives it.

---

## 2026-09-30 — Electron desktop shell (issues #216–#224)

Seventeen commits across issues #216–#224 — eight RED/GREEN pairs and one
prototype amendment — against the plan on #215, built from
`docs/design-logs/24-electron-shell.md`. **6608 tests pass across 378 files**,
from 6430 across 361 at the end of the enrichment round. `tsc -b` is clean;
`eslint src server electron .husky` reports no errors and one `no-script-url`
warning, in `windowPolicy`'s suite. About 53 files and 5,000 lines. It carries
build step 7, the first step that needs Electron. The maintainer's instruction
was the scope: translate the prototype 1:1 into the codebase, in its naming,
conventions, patterns and architecture — and the prototype draws no shell, so
"the prototype" here is the **App mark**, the `--color-bg` the window opens on,
the three font families and the **Wordmark**. All of them shipped as drawn.

**Not ticked** in the feature table. ✅ when the refactor closes, not when the
build issues do.

### What shipped

- **#216, the window over the server.** `electron/main.ts` forks the **Server
  process** in a `utilityProcess` and opens one maximized window on `#14110d`
  once the **Shell handshake**'s `ready` arrives. `serverHandle` (fork, the
  15 s ready timeout, `fatal`, an exit before `ready`), `serverLaunch`,
  `rendererUrl`; `server/src/shell/` with `shellHandshake` and `listen` (the
  `127.0.0.1` bind, always, standalone included). The handshake's messages
  typed once in `src/types/shell.ts`. `tsconfig.electron.json` as the third
  shipping project, the commit gate taught to build it on a `test:` commit,
  and `fetchNative.mjs` with `db/`'s `FAMILYFLIX_SQLITE_BINDING`, so the
  Electron-ABI `better-sqlite3` sits in the gitignored `electron/.native/`
  and Vitest keeps the package's own.
- **#217, the ordered shutdown.** `orderedShutdown` and `shutdownOnSignals`,
  one path for the `shutdown` command and the signals; `awaitExitOrKill`,
  `serverHandle.shutdown(ms)`, and main's `before-quit` waiting it out,
  killing the server at 5 s.
- **#218, the App mark** — the prototype amendment, in `docs/handoff/brand/`
  and registered under COMPONENT-SPEC §2, approved before anything used it.
- **#219, the App mark in the app.** `buildIcon.mjs` renders `icon.ico` at
  seven sizes, the favicon and the preview PNGs; `iconSizes.test.ts` guards
  the `.ico`; `appIdentity`'s `APP_USER_MODEL_ID` set before the window.
- **#220, the installed shape.** `rendererRouter` serving the built renderer
  beside `/api` under its CSP — **One origin**; the **Shell port** `41720`
  and its ephemeral fallback in `listen`; `serverLaunch`'s packaged and
  prod-flag shapes; `buildElectron.mjs`'s two CJS bundles; `electron:start`.
- **#221, offline fonts and the title.** The three families at the token
  weights from `@fontsource`, imported once in `src/main.tsx`; no Google
  Fonts link; `<title>FamilyFlix</title>`.
- **#222, the Loopback guard.** Mounted first, bound to the port after
  `listen`; the **Trusted hosts** off `FAMILYFLIX_TRUSTED_HOSTS`.
- **#223, the window's rules.** `windowPolicy` (`isAppUrl`,
  `openExternalAllowed`, `permissionAllowed`) and `downloadPath` — a download
  straight to Downloads under a free name, no dialog; no menu when installed.
- **#224, failures and logs.** The **Shell log** (`shellLog`, rolled at
  5 MB, to the terminal when unpackaged) and `shellDialogs`: the startup
  dialog and _stopped unexpectedly_, with `startServer` putting every startup
  failure in front of the first.

### Judgment calls the slices made on their own

- **`electron/serverBoot.mjs`**, because a `utilityProcess` ignores `--import`
  in its `execArgv`, so Q32's "from source with `--import tsx`" never reached
  the server. The shim re-implements Node's preload by hand, and has no suite.
- **`loopbackGuard` and `rendererRouter` went into `server/src/shell/`**,
  where Q13 and Q15 placed them in `routes/`, because it was the new folder
  the slice was already in.
- **`listen` and `orderedShutdown` got units of their own**, where the log
  left both in `server/src/main.ts`. That was right, and they stay.
- **`withoutCsp`**, a patch of `res.setHeader` on every request, so that
  Express's own `404` page carries no `Content-Security-Policy` either —
  because the leaf was written as "no CSP", not "not the renderer's".
- **`shellDialogs` and `startServer`**, a unit the log did not name. That was
  right, and it stays.
- **The build scripts are `electron/scripts/` in camelCase** —
  `buildElectron.mjs`, `buildIcon.mjs`, `fetchNative.mjs` — where the log
  named `scripts/build-electron.mjs`, `build-icon.mjs` and
  `electron-sqlite.mjs`; and the bundles are `electron/dist/main.js` and
  `server.js`, where it named `.cjs` files in two folders. Both are the repo's
  own conventions, and they stay.
- **`electron:icon`**, a fourth script the log did not list.

### Deliberately not built (Q2, Q3, Q4, the Trade-offs)

The installer and FFmpeg bundling (step 8); the preload and
`window.familyflix` (step 9); _Change…_; any native picker; a tray, a custom
title bar or an application menu; remembered bounds; macOS and Linux.

### The manual smokes

- **#216**: `electron:dev` by hand — a maximized window titled FamilyFlix
  over Vite, the API on `127.0.0.1:3001` only, a second launch exits. This is
  the run that found `--import` ignored.
- **#220**: the bundled server over `curl` — a deep route answers
  `index.html` under the CSP, `/api` answers with none.
- **#222**: `tsx server/src/main.ts` over `curl` — a trusted Host, the
  `localhost` spelling and Vite's `localhost:4200` answer `200`; a rebinding
  Host and a `POST` with a foreign Origin answer `403`.
- **Not run unattended**, each for want of a display session: closing during
  playback or an import (#217), the taskbar and pin (#219), the volume
  surviving a relaunch (#220), the network-off fonts (#221), the window's
  three rules (#223), and killing the server and `chrome://crash` (#224). The
  refactor runs them once, after its server group.

### Follow-ups

The refactor is 226. The docs-and-refactor-filing slice, 225, was folded into
it and closed at filing.

---

## 2026-09-28 — Enrichment (TMDB) refactor (issue #214)

Twenty-eight commits against `docs/refactor-plans/23-enrichment-refactor.md`,
the docs-and-checks slice filed as 213 folded in. **6430 tests pass across 361
files**, from 6175 across 341. `tsc -b` is clean, and `eslint src server` is
clean of warnings too: the eight `no-useless-escape` warnings were the whole
of its report, and they are gone. `createEnrichment` is **955 lines, from
1256**, and is the run's state machine and nothing else.

**Enrichment (TMDB)** and the **Network group** are ticked ✅. The build order
loses step 6, and the **Electron desktop shell** is next.

### What each group changed

- **Group 0, the record.** The build's own entry, below this one, written
  before this round changed anything.
- **Group 1, one vocabulary and one double.** `ENRICH_FIELDS`,
  `ENRICH_FIELD_LABELS` and `ENRICH_SCOPES` in `types/enrichment.ts`, the
  unions derived from them, `EXPORT_COLUMNS`' precedent; the server validates
  against them, `planFields` labels its conflicts off them, and the chips draw
  them. `test-support/fakeTmdb/` replaced the eight suites' eight TMDB copies:
  each question off a table, every call recorded, one call held or failed on
  cue, the builders, and `reviewed()`.
- **Group 2, the server.** `routes/enrichmentBody/` reads the start and _Apply
  choices_, so `bad-body` left the domain and `no-movie` joined it.
  `tmdbGenreName` and `releaseYear` put TMDB's vocabulary with its owners.
  Five pure units came out of `createEnrichment` — `decisionFace`,
  `currentFields`, `plannedEnrichment`, `planEpisode`, and the reasons with
  them. `Media` gained `readStored` and `storeInSeriesFolder`, so only
  `media/` touches managed storage. The series half of the enrichment storage
  moved to `library/series/enrich/`, **Full details** is spelled once as
  `fullDetails`, and `library/settings` reads a key one way.
- **Group 3, the shared client units.** `enrichPath` for the three surfaces
  that spelled `/enrich` by hand; `formatElapsed`, the run clock `importView`
  and `enrichmentView` each carried; `scopeDescription` and `writtenSummary`
  into the view.
- **Group 4, the feature.** `SetupBanner`, `ScopeCard`, `WriteTargetRow`,
  `CandidatePicker` and `TitleSearch` as the log's units. Suites for the three
  steps, the run hook, the enrichment `api`, `useTmdbKey`,
  `useEnrichmentSummary` and `saveTmdbKey`. The run hook settles a row through
  one `settled(run, id, { counted })`. `EnrichmentFlow` raises through
  `useSnackbar()`, and the optional chain is gone.
- **Group 5, the checkbox.** The TMDB box is the prototype's `<label>` over a
  native checkbox clipped by `visuallyHidden`.
- **Group 6, the documents.** The map, README's tree, the glossary's
  **Decision** and **Candidate**, three flags, and this entry.

### What changed on screen

The three the plan named, and nothing else:

- A **Candidate**'s line reads its genre off the **Genre pool** and its
  language upper-cased: `1982 · Sci-Fi · EN`.
- The conflict's log line reads _⚠ Title — differs from what you filled in_.
- The Import TMDB box is a native checkbox: Space toggles it, and Tab reaches
  it as it reaches any checkbox.

### Where the round departed from the plan

- **The start's `400`s were not asserted anywhere.** Commit 4 counted on the
  route suites to prove the move; none of them sent a bad body. The new
  `enrichmentBody` suite pins every refusal's sentence and its order, and
  `routes.enrichment.test.ts` gained two leaves for the wiring: a bad body,
  and a film the library does not hold.
- **A series image is asked for before the Series folder is checked.** The
  guard moved into `storeInSeriesFolder` with the path arithmetic, so a show
  whose episode has no Series folder above it costs one image request before
  the store refuses. It still writes nothing, and no importer puts an episode
  there.
- **`'E:\Movies'` was `'E:Movies'`.** The escape was not only a lint warning:
  the Library-root leaves stored and read back a string with no separator.
  `String.raw` makes them store the path they name.
- **`makeEnrichmentRun`** joined `src/test-support/` beside `makeImportRun`,
  for the step, hook and api suites. `EnrichmentFlow.saved.test.tsx` went
  whole: its leaves were all the setup's pixels, and they are now
  `EnrichmentSetup`'s and `WriteTargetRow`'s.
- **`saveTmdbKey` has no `empty` outcome.** The plan listed `empty` on a
  `400`. The call answers `saved`, `refused` or `unreachable`, and a `400`
  reads as `unreachable`. It is never sent one, because `useTmdbKey` refuses a
  blank field before the wire, so the leaves assert what the call does.
- **Four suites rendered the flow bare, not three.** `EnrichmentPage.test`
  needed the provider too.
- **The checkbox has no focus ring.** The prototype draws none, and this round
  invents none. Its leaves assert the tab order and Space.

### Deliberately left out

The plan's own list: a review face for an unsettled series (a behaviour and a
prototype amendment), folding `lookUp` and `lookUpSeries`, interaction states
on the radio and Candidate cards (a §2a amendment), sharing `ActionRow` with
the sync row, the Source folder's separator, `createImporter`'s own size,
everything log 23 Q3 ruled out, and per-notice durations.

### Follow-ups

None filed. The unsettled series and the series page's ⋯ menu are flagged in
the glossary, where the next grill-me will find them.

---

## 2026-09-27 — Enrichment (TMDB) (issues #203–#212)

Twenty commits across issues #203–#212 — ten RED/GREEN pairs — against the
plan on #202, built from `docs/design-logs/23-enrichment.md`. **6175 tests
pass across 341 files**, from 5584 across 295 at the end of the series round.
`tsc -b` is clean; `eslint src server` reports no errors and eight
`no-useless-escape` warnings, all in `library/settings`' suite. About 150
files and 20,000 lines — the first feature that goes online, and the first
that raises a **Snackbar notice**. It carries build step 6, **Enrichment
(TMDB)** and the **Network group**. The maintainer's instruction was the
scope: translate the prototype 1:1 into the codebase, in its naming,
conventions, patterns and architecture.

**Neither is ticked** in the feature table. ✅ when the refactor closes, not
when the build issues do.

### What shipped

The log's six steps became ten slices.

- **#203, the TMDB key in Settings → Network.** `enrichment/`, the fifth
  server domain, born of `playback/`'s rule — nothing that existed was a
  network client: `tmdbClient` over an injected `fetch`, `tmdbAuth`, and the
  domain injected as `createApiRouter(…, enrichment)`. The **TMDB key** in
  `library/settings`; `NetworkSection` and `useTmdbKey` in Settings, with
  _Test connection_'s four notices. `test-support/offlineTmdb/` for the
  suites that compose the router for something else.
- **#204, Fetch from TMDB for one Confident film.** Migration 5 — the
  enrichment columns on `movies` and `series`, `episodes.still_path`, and
  `tmdb_id` finally written. `matchScore`'s Confident line, `fetchedFields`,
  `planFields`, `tmdbGenres` onto the **Genre pool**, `library/enrich`,
  `storeNamed` on `createMedia`. `/enrich?movie=<id>` from the ⋯ menu's
  _⟳ Fetch from TMDB_, and the organism with its three steps.
- **#205, sync the whole library.** The **Current enrichment run**, polled at
  500 ms and re-attachable, the running card and its estimate, and the
  last-sync stamp.
- **#206, setup's readiness and the sync row.** The key and offline banners,
  Start inert until both are settled, the Settings row's `syncLine`, and the
  shared `useEnrichmentSummary` and `fetchEnrichmentSummary`. `BangRingIcon`
  and `SyncIcon`.
- **#207, ambiguous and missing Decisions.** `DecisionRow`'s picker of
  **Candidates** with their % match, and the _Search by title_ box.
- **#208, conflict Decisions.** `FieldDiff`'s _Yours | TMDB_ rows, _Apply
  choices_ and _Keep all mine_.
- **#209, series and episodes.** A series and its episodes looked up by the
  same rules; **Stills** into the season folder, series posters and
  backdrops into the **Series folder**.
- **#210, the Library root and Source folders.** The import remembers its
  root and records every title's **Source folder**. `DatabaseIcon`.
- **#211, the two Write targets.** `writeBack`: `familyflix-metadata.csv` at
  the root and `poster.jpg` in each Source folder, neither overwriting a file
  that exists. `LandscapeIcon` and `TableIcon`.
- **#212, Also fetch from TMDB on Import setup.** The checkbox, its hint off
  the shared `fetchTmdbKey`, and _Finish_ handing off to `/enrich?scope=all`.

### Judgment calls the slices made on their own

- **`createEnrichment` held six pure concerns Q28 did not name** — reading
  the start body, the picker's Candidates, a title's current values, a plan
  into columns (twice, and `tmdbSide` a third time), an episode's plan, and a
  second TMDB genre table — and grew to 1256 lines.
- **The series half of the storage went into the movie's `library/enrich/`**,
  `enrich.series.test.ts` beside the film's suite, because the movie's
  statements were open there.
- **`storeSeriesImage` did its own path arithmetic** over managed storage —
  `dirname` of a season folder, a `split('/')` guard, `createReadStream` of a
  stored poster — because `storeNamed` answered only for a film's folder.
- **`EnrichmentFlow` read `SnackbarContext` raw**, `snackbar?.notify(…)`, so
  that three suites without a provider still ran.
- **The five Q40 molecules were left inline**: `SetupBanner`, `ScopeCard`
  and `WriteTargetRow` in `EnrichmentSetup`, `CandidatePicker` and
  `TitleSearch` in `DecisionRow`.
- **The TMDB box was built as a `button[role=checkbox]`**, where the
  prototype and Q45 name a native checkbox under `visuallyHidden`.
- **`useEnrichmentSummary` went on the global rung**, because Settings and
  the flow both read it. That was right, and it stays.

### Where the run departed from the log

- **The Candidate's genre and language.** The line reads TMDB's first genre
  name and its lower-case language (`1982 · Science Fiction · en`), where the
  log's Shapes say the first `genre_ids` on the pool, upper-cased.
- **The conflict's log line** reads _TMDB disagrees with what you filled in_,
  where Q32 and PRD story 52 settle _differs from what you filled in_.
- **An unsettled series** — ambiguous or not found — is one log line and no
  **Decision**, because the review's pick and apply write a film and the
  prototype draws no series Decision.

### Deliberately not built (Q3)

A place the TMDB score or the original title is drawn, a series _Fetch from
TMDB_, a language choice, a scheduled sync, and specials.

### The Snackbar stack's first callers

The stack shipped empty in the snackbar round, its first caller expected to be
the Software update's **Update offer snackbar**. Enrichment got there first:
the Network group's four notices (_Paste a key first._, _Connected to TMDB._,
_TMDB didn't accept that key._, _Couldn't reach TMDB._) and the flow's _Add
your TMDB key here first._, _Match saved._, _Details updated._ and
_Searching TMDB…_.

### Follow-ups

The refactor is 214. The docs-and-checks slice, 213, was folded into it and
closed at filing.

---

## 2026-09-25 — Series (TV) refactor (issue #201)

Twenty-six commits against `docs/refactor-plans/22-series-refactor.md`, the
docs-and-checks slice filed as 200 folded in. **5584 tests pass across 295
files**, from 5486 across 282: thirteen new suites — the five series storage
units, `useSeriesRead`, `useSeriesDetail`, `useSeasonEpisodes`,
`SeriesMetaLine`, `LoadingSeries`, `useUpNext`, `formatEpisodeTag` and the
`makeSeriesDetail` fixture — and the router suites trimmed to what is HTTP.
`tsc -b` and `eslint src server` are clean on every commit. Two things changed
on screen, the two the plan named: the series page's Back is the prototype's
glass circle, and a season-page mark takes the route's echo, as the heart
already did.

**Series (TV)**, **Episode playback** and **Series import** are ticked ✅.
**Enrichment (TMDB)** is next.

### What changed

- **Group 0, the record.** The build's own journal entry, written before the
  round touched the tree it describes.
- **Group 1, the server.** Series storage became one unit per concern under
  `library/series/` — `read`, `browse`, `write`, `curation`, `watch`, beside
  `nextEpisodeOf` — each created from the reader the way the movie's are, each
  with a suite over `freshStorage`; the router suites kept status, parsing and
  payload. The movie's `watch/` is back to its three methods, and the dead
  `markEpisodeWatched` is gone from the seam. `episodeOr404` sits beside
  `movieOr404`; `/resume` and `/watched` are one handler each, mounted per kind
  through the `playables` table with the file routes. `Media.seasonFolder`
  makes `season-NN/`, so the importer no longer imports `mkdir`; and
  `spellEpisodeTag` is `episodeTag`'s inverse, with a round-trip suite.
- **Group 2, the shared client units.** `formatEpisodeTag` replaced seven
  spellings and five local `pad`s. `SeasonCardSeason` and `EpisodeRowEpisode`
  live in `types/viewModels` and `SeasonCardModel` is gone; the page models
  are `SeriesPageModel` and `SeasonPageModel`, the prototype's `tsType`s.
  `useOptimisticEdit` moved to `hooks/`, generic over `T extends { id }`.
- **Group 3, the series feature.** `useSeriesRead` is the one load both pages
  read; the series heart and the season page's two marks are
  `useOptimisticEdit` calls. `SeriesMetaLine` and `LoadingSeries` are units.
  The Back is a `styled(IconButton)` circle, 1:1 with `page.SeriesPage`. The
  five bare hovers wear `:not(:disabled)`.
- **Group 4, the player.** The **Playable** is the only address — the
  reporter, the subtitles, the opening reads, the wire and `Player` — and
  `Addressed`, `addressOf` and `PlayableTarget` are gone. **Up next** is
  `useUpNext`, its end-of-file effect keyed on `ended` through a ref, with no
  `exhaustive-deps` suppression left in the Player.
- **Group 5, the documents.** The folder map, the README tree, the `api/`
  paragraph (seven calls now), the glossary's **Playable**, **Episode tag**,
  **Series page** and **Optimistic save**, one new flagged ambiguity, and the
  tick.

### Departures from the plan

- **A test fixture the plan did not name.** Three new hook suites needed the
  same `SeriesDetail`, so `test-support/makeSeriesDetail/` was added on
  `makeMovie`'s precedent, with a suite of its own.
- **`HeldSeries`.** `useOptimisticEdit` needs a record with an `id`, and a
  `SeriesDetail` has none at its top, so `useSeriesRead` holds the read as
  `SeriesDetail & { id }`, the series' id lifted onto it.
- **Up next cancels by episode id.** `useUpNext` holds a _Cancel_ against the
  episode it was pressed on, so "this episode only" holds whether or not the
  screen is remounted for the next one; the Player still is, by its key.
- **One season-mark leaf dropped.** "touches no other season" cannot be
  observed through one page's hook; `series/watch`'s suite asserts it.
- **The flagged list gained one entry, not four.** The one-card-per-series
  Continue row and `PosterCardMovie` were already flagged by the build; the
  second was reworded to say this round left it. The series form and Export
  are the new entry. CLAUDE.md's Series entry also lost "never one card per
  series", which Q29 had overruled.
- **The fixture's path.** The plan put `seriesFixture` under
  `test-support/`; the tree is at `createImporter/seriesFixture/` beside the
  film fixture, and `test-support/seriesFixture/` is the copier. The map says
  both.

### Deliberately left

Everything in the plan's Out of Scope: the `PosterCardMovie` rename, a series
form, delete and Export, a shared detail-page scroll container, `EpisodeRow`'s
own lift and empty air-date line, the `importMatch` / `importShow` parallel,
and `seriesInLibrary` reading through `getSeriesHome`. `writeSignal`'s docblock
still counts the routes it once drained; two of its four callers now go
through the per-kind handlers.

### Follow-ups

None filed. 188 is closed with this one, by comment.

---

## 2026-09-25 — Series (TV) (issues #189–#199)

Twenty-three commits across issues #189–#199 — eleven RED/GREEN pairs and one
fix — against the plan on #188, built from `docs/design-logs/22-series.md`.
**5486 tests pass across 282 files**, from 4928 across 255 at the end of the
motion round. `tsc -b` and `eslint src server` are clean. The largest
initiative the app has had — about 120 files and 15,000 lines — and the first
entity that is not a **Movie**. It carries all three parts of build step 5,
**Series (TV)**, **Episode playback** and **Series import**, because none is
usable alone. The maintainer's instruction was the scope: translate the
prototype 1:1 into the codebase, in its naming, conventions, patterns and
architecture.

**None of the three is ticked** in the feature table. ✅ when the refactor
closes, not when the build issues do.

### What shipped

The log's six slices became the plan's nine phases, and the nine became
eleven issues: Phase 1 split into the import (#189) and the tab (#190), and
Phase 2 into the hero (#191) and the season cards (#192).

- **#189, a Season-folder show imports as one series.** Migration 4 — the
  `series` and `episodes` tables and their two joins, `series_genres` and
  `episode_subtitles`; `movies` untouched. `media/episodeTag` reads
  `S01E03` and `1x03`; `import-export/groupShows` gathers a Library root's
  `Season NN/` folders under their show; the importer's episode loop copies
  each episode into a **Series folder**'s `season-NN/`. `library/series/read`
  and `series/write` behind `LibraryStorage`. The fixture is
  `createImporter/seriesFixture/`, beside the film fixture.
- **#190, the Movies / Series switch and the All series grid.**
  `LibraryTabs` and `LibraryBody` on the library page, `?tab=series` written
  as a replace by the existing query-param writer; `SeriesHome` over the same
  `LibraryGrid` and `PosterCard`, through `seriesCardView`.
- **#191, the series page hero and the next episode.** `series/nextEpisodeOf`,
  `GET /api/series/:id`, the `/series/:id` page over `seriesView`, and
  `CreditsRow` graduated from `movie-detail/` to `components/` with its lead
  label as a prop.
- **#192, season cards and the series heart.** `SeasonCard` on the card
  fragments, `seasonPath`, the Seasons grid, and the heart on the page and on
  the tab through the shared `saveSeriesFavorite`.
- **#193, the season page.** `EpisodeRow`, `SeasonEpisodes`,
  `useSeasonEpisodes`, `seasonView`, the episode box and _Mark season
  watched_ through the shared `saveEpisodeWatched` and the season write.
- **#194, episode playback on a Playable.** `GET /api/episodes/:id` and the
  movie routes' file handlers mounted again under `/episodes` over a
  `playables` lookup of the **Stored path**, so `playback/` never learned
  there are episodes. The player's hooks and wire take a **Playable**;
  `episodePlayPath`; the title line reads `Show · S02E04 · Episode title`.
- **#195, Continue Watching on the Series tab.** One card per series, on the
  episode `nextEpisodeOf` answers, through `episodeContinueView`.
- **#196, Up next.** `UpNextCard` in the last 15 seconds, its countdown,
  _Play now_ and _Cancel_, and auto-play at the end of the file — a
  **Sideways move**, so Back from the next episode still reaches the season.
- **#197, loose episodes and unplaced.** Episodes at a show's root, episode
  subtitles, and the `unplaced` Problem for an episode whose numbers cannot
  be read.
- **#198, re-runs, year ranges, unnamed shows, the setup panel.** A second
  run adds only the episodes it does not hold; a show's **Year range**; a
  folder with no row still imports under its guessed title; Import setup
  shows the accepted shapes verbatim, under `InfoRingIcon`. Its fix commit
  moved the held-series read ahead of the walk's first `await` — it had run
  outside every catch, so a run whose storage closed mid-walk rejected
  unhandled and vitest exited 1 with every test green.
- **#199, the Series tab's filters.** Search, genre, rating and sort over
  `GET /api/series`, and `GET /api/series/genres` counted in series.

### Judgment calls the slices made on their own

- **Reuse over the log's sketch.** The Series tab's Continue row is the
  movie's `ContinueRow`, and its load is `useBrowseLoad`, where the log
  sketched `EpisodeContinueRow` and `useSeriesHome`.
- **Two storage files, not four units.** Q12 named `read`, `browse`, `watch`
  and `curation` under `library/series/`. What shipped is `series/read` —
  detail, episode, list, home and genres, 384 lines — and `series/write`,
  neither with a suite of its own; every assertion is in the router suites.
- **The episode watch writes went into the movie's `watch/`**, because that is
  where the statements were. It carries seven methods over two tables, one of
  them, `markEpisodeWatched`, with no shipping caller.
- **The `movieId | playable` shim.** The plan made "the movie suites stay
  green without edits" its proof that the build was additive, so the player's
  hooks accept both addresses and `addressOf` / `routeOf` normalise them.
- **`SeriesMetaLine` and the loading face left inline** in the `SeriesDetail`
  organism, where Q35 and Q49 named the first as its own unit.
- **The series page's Back copied from the movie page** — the text pill,
  down to the styles' docblock — where `page.SeriesPage` draws a glass circle.
- **`resolvedStyle` learned one thing.** `normCss` drops the spaces around a
  `/`, because stylis prints `2 / 3` as `2/3`. It did not learn the
  ancestor-state selector the motion round expected `EpisodeRow` to need: the
  row's hover rules resolve without it.

### Deliberately not built (Q2)

A series form, series delete, series in Export, season posters and specials.
The form and Export are flagged for a prototype amendment rather than
improvised.

### Follow-ups

The refactor is 201. The docs-and-checks slice, 200, was folded into it and
closed at filing.

---

## 2026-09-23 — Motion & interaction states refactor (issue #187)

Fourteen commits against `docs/refactor-plans/21-motion-refactor.md` — three
to shipping files, six to tests, five to documents; the docs slice filed as 186
was folded in. **4928 tests pass across 255 files**, from 4920 across 255: the
eight new leaves are all `resolvedStyle`'s own, and every migrated suite kept
its leaf names. `tsc -b` is clean and `eslint src server` is clean on every
commit. Nothing the family or the maintainer can see changed: every surface
resolves to the hover, press and ring it did before the round.

### What changed

- **Group 0, the record.** The build's own journal entry, written before the
  round touched the tree it describes.
- **Group 1, one press and one guard.** `controlStates` writes its press at
  doubled specificity, `&&:active:not(:disabled)`, so a press — always also a
  hover — out-ranks any hover that writes `transform`, an extension's
  included. The poster heart's `scale(.92)` and the carousel `Arrow`'s
  `translateY(-50%) scale(.94)` moved up to the same rank; `Fab`,
  `MoreButton`, `CircleToggle` and `ChromeIconButton` dropped the press they
  had each restated. `IconButton`'s docblock rule 3 says the press is the
  primitive's now. Then `:enabled` went: `IconButton`'s two faces, the six
  extensions' hovers and the two remaining presses write `:not(:disabled)`,
  the spelling `controlStates` and `Button` use, and rule 1 says so.
- **Group 2, one cascade reader.** `resolvedStyle` learned the two cases it
  got wrong: `focus`, a click's focus that `:focus-visible` does not match,
  with `focusVisible` still implying `:focus`; and a selector with a
  combinator, applying when its last compound matches in the named state and
  the part before it matches through the DOM's own `matches`, specificity
  summed — a state on an ancestor still "does not apply", for Series'
  `EpisodeRow` to teach it. Then `interactionStates`, `Button`, `Chip` and the
  Filter dropdown dropped their four hand-rolled readers and ask it what
  _wins_; a press is resolved as hover and active together. The option rows'
  ease now resolves through the dropdown's descendant rule, and
  `GlobalStyle`'s docblock says why it alone keeps a `ServerStyleSheet` read.
- **Group 3, the docs.** COMPONENT-SPEC §2a's first row is **Controls**, its
  hover column names `Chip`'s rise and `IconButton`'s swell. The glossary's
  **Control**, **Press** and the two relationship lines follow Group 1; the
  _"Buttons never lift"_ entry is past tense, and three entries are new —
  `resolvedStyle` against Q16, `ffSpin`, and the FAB's eased lift. CLAUDE.md's
  map and README's tree gained `motion.ts`, the theme factory,
  `interactionStates/`, `accentScale/` and `resolvedStyle/`. And the tick.

### Three departures from the plan

- **Group 1 changed one test.** `Fab.test.tsx` has a hover reader of its own
  from log 19 — a fifth, which the plan's list of four missed — keyed on the
  `:hover:enabled` spelling. The guard commit carried its regex to
  `:not(:disabled)`. It stays: its one reason to exist is the leaf _declares
  no transition of its own on hover_, a question about what was written,
  which `resolvedStyle` answers with the winner instead.
- **§2a's sentence is half the plan's.** The plan wrote "a Control never
  takes a shadow or the accent edge"; `Chip` and the Filter dropdown hover to
  the accent line, so the spec says "a Control's hover never adds a shadow; a
  Card never recolours its fill".
- **The combinator got six leaves, not three.** Beyond the plan's applies /
  ancestor absent / ancestor with a state: the ancestor's weight out-ranking a
  bare class, a sibling combinator, and the last compound still asked for its
  state.

### Deliberately left

The Fab's own hover reader, above; `IconButton`'s suite reading its docblock
for the rules' wording, which constrained rule 3's rewrite and was not the
round's to change; `resolvedStyle` reading a state on an ancestor; the literals
outside the contract (`Toggle`'s `.18s ease`, `ProgressBar`'s `.2s ease`,
`ffPop`, the chrome's fade); `ffSpin`; every surface the revision did not
touch. Every log-21 ruling the plan lists was checked against the code and
holds.

### Follow-ups

None filed. **Series (TV)** is step 5 and next: `SeasonCard` and `EpisodeRow`
compose `cardLift` and `cardFocus` as they stand, and the row's hover overlay
is the first ancestor-state selector `resolvedStyle` will need.

---

## 2026-09-23 — Motion & interaction states (issues #181–#185)

Ten commits across issues #181–#185, five slices against the plan on #180,
built from `docs/design-logs/21-motion-interaction-states.md`. **4920 tests
pass across 255 files**, up from 250 files before the grill: `accentScale`,
`theme`, `GlobalStyle`, `interactionStates` and `resolvedStyle` are the five
new suites, and every surface on the contract gained leaves in its own. `tsc
-b` and `eslint src server` are clean on every commit. The first initiative
that changed how existing surfaces _feel_ rather than what they do, and the
sixth driven wholly by `issue-loop`. The maintainer's one instruction was the
scope the grill ran under: translate the prototype 1:1 into the codebase, in
its naming, conventions, patterns and architecture — and COMPONENT-SPEC §2a
said the same in one sentence, _do not invent per-component variations_.

**Motion & interaction states is _not_ ticked** in the feature table. The rule
holds: ✅ when the refactor closes, not when the build issues do.

### What shipped

- **#181, the tokens, the scale, the factory and reduced motion.**
  `tokens/motion.ts` — `durFast`, `durBase`, `durSlow`, `easeOut`, flat and
  `as const`, mounted as `theme.motion`, `durSlow` with no caller (Q4).
  `utils/accentScale/` derives the accent's five — hover, press, soft, line and
  the focus ring — and `createTheme(accent = colors.accent)` spreads them over
  `colors`, so `colors.ts` spells one accent and the eighteen readers of the
  old three names did not change (Q6, Q7). `GlobalStyle` carries the one
  `prefers-reduced-motion` block, verbatim, which honours for free the seven
  motions log 19 had left unhonoured (Q9).
- **#182, the control vocabulary on `Button`.**
  `styles/interactionStates/` with `controlStates(press)` — the transition, the
  press at 60ms, the 3px keyboard ring — and the **structural guard** in its
  suite: no shipping file but the tokens spells `120ms`, `180ms`, `280ms` or the
  curve, none but the fragment spells a `60ms` or `70ms` press (Q11, Q16).
  `Button`'s guards moved from `:enabled` to `:not(:disabled)`, so **the link
  face gained a hover, a press and a ring it had lacked since it shipped** — an
  anchor never matches `:enabled` (Q13).
- **#183, `Chip` and the Filter dropdown.** The `Control` shape only — `Tag` is
  not a control and gets nothing — with the file's own 1px rise and
  `translateY(0) scale(.97)` press; the dropdown's trigger on the fragment, and
  its option rows on a `durFast` transition of their own.
- **#184, `IconButton` and its five extensions.** The primitive composes the
  fragment at `scale(.94)` and swells to 1.06 on hover; `Fab`, the carousel
  `Arrow`, `MoreButton`, `CircleToggle` and `ChromeIconButton` keep their own
  hovers (Q15). **The Fab's lift now eases at `durFast` instead of snapping** —
  log 19's "snaps, as the prototype's does" predates the contract, which covers
  every interactive component.
- **#185, the card vocabulary.** `cardLift` on the tile and `cardFocus` on the
  focusable root, split because the prototype puts them there: hovering a title
  under a poster does not lift it (Q12). `PosterCard` and `ContinueCard` compose
  both; `ContinueCard` gains the resting shadow it never had and loses its
  `opacity: .94` hover; the poster heart presses at `scale(.92)`.

### The prototype was amended in the grill

`tokens.css` shipped hover, press and ring values its own formula does not
produce for the stock `#d97a4e`. The whole-app prototype already rendered the
derived ones, so the literals were the stale side: the three values in
`tokens.css` became the derived `#e0926e`, `#bf6b45` and
`rgba(224, 146, 110, 0.55)` in the grill session, and standalone previews and
the app agree (Q8).

### `ffSpin` was kept

The revision dropped the keyframe from `tokens.css`; `PlayerNotice`'s buffering
spinner still turns on it. Removing a keyframe a shipped component uses was not
this initiative's to do (Q10) — a known prototype/code gap for the player's next
revision.

### The calls the subagents made alone

The log named none of these; all three are in the code.

- **`test-support/resolvedStyle/`, at #184, against the PRD's testing
  decision.** Q16 said the surfaces' suites would gain _nothing they cannot
  observe_ and ruled out `toHaveStyleRule`. From #182 on, every surface suite
  asserted its hover, press and focus rules anyway — about 700 lines — and the
  first three slices each hand-rolled a stylesheet reader to do it (in
  `interactionStates`, `Button`, `Chip` and `FilterDropdown`). #184 needed to
  know which rule _wins_, not which was written, and built the double: the
  cascade by hand for a named state — `!important`, then specificity, then
  order — with a suite of its own.
- **Four extensions restated a press they should have inherited.** An
  extension's `&:hover:enabled` ranks equal to the primitive's press and comes
  later, so a hover that writes `transform` — even `none` — holds through the
  press. Each slice was given one extension and a failing press leaf, and
  `&:active:enabled { transform: scale(0.94) }` was the smallest change that
  passed it; `IconButton`'s docblock rule 3 wrote the trap down for the next
  one. Five slices, the same line.
- **The option rows' transition reaches them through the dropdown's slot**, a
  `${Item}` rule inside the dropdown's own `Root`, rather than through `Menu`'s
  `Item` — the ⋯ menu shares the component and is outside the contract (Q2).

### Deliberately not built

Per Q17: no token beyond the four motion values and the five derivatives; no
press token (Q5); no state on `Toggle`, `TextField`, `Textarea`, the menus,
`SubtitleRow`, `ActionRow`, _View all_, the Modal's ✕, the Snackbar, the Back
pill or `SettingsHeader` — zero changed lines on each since `ef1dc27`; no Series
cards; no accent picker; no tokenising of the literals the revision left alone
(`Toggle`'s `.18s ease`, `ProgressBar`'s `.2s ease`, `ffPop`, the player
chrome's fade), because `ease` is not `easeOut` (Q3).

### Follow-ups

The refactor round, filed as 187 with the docs slice 186 folded into it: one
press every extension inherits, one spelling of the guard, one cascade reader
in place of four, §2a corrected to what shipped, and the documents that close
the initiative.

---

## 2026-09-22 — Back navigation refactor (issue #177)

Thirteen commits against `docs/refactor-plans/20-back-navigation-refactor.md`
— three to shipping files, five to tests, five to documents. **4789 tests pass
across 249 files**, from 4783 across 247: `moviePath`'s three and
`shippingSources`' five are new, the probe's suite gained one, and the three
per-file source scans are gone. `tsc -b` is clean and `eslint src server` is
clean on every commit. Nothing moved a pixel, changed a wire or changed what
any press does.

### What changed

- **Group 0, the record.** The build's own journal entry, written before the
  round touched the tree it describes.
- **Group 1, one spelling of the film's route.** `utils/moviePath/` on
  `toGenreQueryParams`'s shape, encoding the id for consistency rather than
  need, with its own test and a line in the barrel. Then the four callers:
  `Player`'s private copy went and its **Landing** paragraph moved onto
  `leave`, `useMovieForm`'s `afterEdit` went, `HomeRows` and `GenreGrid` open a
  card through it, and `MovieDetail`'s Play builds the player's route on it —
  the last unencoded id in a path. `HomeRows`' `genrePath` stayed: one caller.
- **Group 2, the form in the glossary's words.** `FRESH_HOME`, `ADD_LANDING`,
  `REVIEW_LANDING`, and the edit's **Landing** is `moviePath(movie)`;
  `REVIEW_LANDING`'s docblock lost the sentence apologising for its old name.
  `const back = goBack;` went, and the returned member is `back: goBack` with
  the docblock on it.
- **Group 3, one structural guard on a shared walk.**
  `test-support/shippingSources/` — `shippingSources`, `withoutComments` and
  `shippingSourcesMatching`, run in its own suite over a sandbox so no edit
  elsewhere can move an answer. The hook suite's two guards and the player's
  duration rule read it, and both hand-rolled walkers went; the hook's guards
  are comment-blind now. The three per-file scans in `Player`, `ImportFlow` and
  `MovieForm` tests went, each suite's docblock naming the presses that carry
  the claim instead. `LocationProbe` exports `navigationType()`, and the four
  suites dropped their copies. `App.test.tsx`'s `pressBack` moved up beside
  `renderApp` and `cardFor`, and the Import, edit and Resolve journeys use it.
- **Group 4, the docs.** The glossary's five rows and three relationship lines
  held as written; a _Flagged ambiguities_ entry records `formLanding` for the
  sketch's `landingFor`, the journeys in `App.test.tsx` as well, and `fallback`
  kept. CLAUDE.md's map and README's tree gained the hook's parameter,
  `moviePath/`, `LocationProbe/` and `shippingSources/`. And the tick: **Back
  navigation** ✅ in both feature lists, step 3 gone from the build-order
  chain, **Motion & interaction states** now "next".

### One departure from the plan

Group 2's rename was to change no test, but the `MovieForm` scan matched
`navigate(AFTER_ADD)` in the source by name, so the commit that renamed the
constant carried its regex along with it. The scan was deleted four commits
later with the other two — which is the round's argument against them made
once more, by the round itself.

### Deliberately left

The probe's three older spellings, read by hand in twenty-four suites; the
two unencoded query parameters, `?movie=` and `?problem=`; the hook's
`fallback` parameter name; the historical phase docblocks in the screens'
suites, which describe what each slice changed at the time; `HomeRows`'
`genrePath` and the player's `/play` suffix, one caller each. Every log-20
ruling the plan lists was checked against the code and holds.

### Follow-ups

- **The probe's three older readers**, filed as 178.
- **Encoding the two query parameters**, filed as 179.
- **Motion & interaction states** is step 4 and next.

---

## 2026-09-22 — Back navigation (issues #171–#175)

Ten commits across issues #171–#175, five slices against the plan on #170,
built from `docs/design-logs/20-back-navigation.md`. **4783 tests pass across
247 files**, up from 4748 across 247. `tsc -b` and `eslint src server` are
clean on every commit. The fifth initiative driven wholly by `issue-loop`, and
the first found by auditing the build against the prototype rather than by
reading the prototype for something new: nothing in `docs/handoff/` was drawn
for it, and nothing there was amended. The maintainer's one instruction was the
scope the grill ran under: translate the prototype 1:1 into the codebase, in
its naming, conventions, patterns and architecture.

**Back navigation is _not_ ticked** in the feature table. The rule holds: ✅
when the refactor closes, not when the build issues do.

### What shipped

- **#171, the Landing and the probe.** `useGoBack(fallback = '/')` — the one
  **Back rule** grows one parameter, the screen's own **Landing** for the
  no-history case, still pushed rather than replaced so the screen it lands on
  has a Back of its own (Q3). `LocationProbe` gains a fourth spelling,
  `navigationType`, off `useNavigationType()`: `POP` after a **History step**,
  `PUSH` after a push. Nothing on screen changed.
- **#172, the player.** `leave` is `useGoBack(moviePath(movieId))`. The Back
  pill and Escape already shared it, so both became steps in one line (Q4).
- **#173, Import.** Back is `useGoBack('/settings')`; _Finish_ is still the
  push to `/` the prototype's `goBrowse()` is. `useImportRun` is untouched — a
  Back mid-run leaves the server's **Current run** where it is (Q5).
- **#174, the form's Landing.** `formLanding(movie, problem)`, read off the
  URL's two query parameters on the first render — `?problem=` → `/import`,
  `?movie=` → the film's page, else `/settings` — never off `editing` or
  `resolving`, which are `null` until a fetch lands (Q6). Back, Cancel and
  _Save changes_ are one `goBack`; _Add to library_ stays the push to `/`. One
  older test was amended: the soft-problem fallback's _Save changes_ asserted
  the push.
- **#175, the Import context.** _Save & continue_, _Skip this one_ and Back
  step onto the **Review step** instead of pushing a second `/import`. The
  review survives the step because it is the **Current run**'s state, not the
  entry's: `ImportFlow` re-attaches on mount (Q7).

### Why it outlived three initiatives

Every one of the four pushes landed on the right URL. The bug was only ever
visible on the _second_ press — Play → Back → Back in the player, Settings →
Import → Back → Back on Import — and every suite in the app asserted where one
press landed, never how the router got there. A push onto the right URL and a
step onto it read the same through `pathname`, `search` and `url`. The probe's
fourth spelling is what makes the difference assertable, and it is the reason
#171 had to land before any screen changed.

The journeys reproduced in the browser on 2026-09-21 are tests now: Play →
Back → Back in `Player.test.tsx` and `App.test.tsx`; Settings → Import → Back →
Back in `ImportFlow.test.tsx` and `App.test.tsx`; movie → _Edit details_ →
_Save changes_ → Back in `App.test.tsx`, with `MovieForm.test.tsx` holding the
first half of it — _Save changes_ is a `POP` onto the film's page — and a
fourth, the Resolve round trip, in `App.test.tsx` alone. The fourth symptom — a Delete after a Play visit landing in the player
of a deleted movie — and the fifth — the detail page coming back from the
player at the top — were fixed by not touching `useDeleteMovie` or
`useRestoredScroll`: with the player's leave a step, the entry behind the
delete is `/`, and the entry the detail page returns to is the one the scroll
was remembered against (Q8).

### No prototype amendment

`FamilyFlix.dc.html` is a stateless screen switcher: `exitPlayer`,
`backFromAdd`, `saveMovie`, `goSettings` and `goBrowse` say where each leaving
lands, and nothing can say whether it pushes or steps, because there is no
history to push onto. Log 04 Q13 had already read the prototype's
`detailReturn` flag as a hand-rolled history stack and translated it to the
router's real one; this initiative finished that reading on the four screens
that never got it (Q12). The prototype's landings are the **Landings**, and its
two surviving `goBrowse()` calls are the two **Fresh homes**.

### The calls the subagents made alone

The log named none of these; all three are in the code.

- **`formLanding`**, where the log's design sketch wrote `landingFor`. It takes
  the two parameters rather than the `searchParams` the sketch passed, because
  `useMovieForm` already reads both, and the name reads as the form's own.
- **The journeys in `App.test.tsx` as well as in the screens' suites.** Q11
  placed them in the screens' own suites. In each of them the second press
  belongs to a different screen — the detail page's Back, Settings' Back — and
  only the router composed in `App` has both, so the builds wrote them at App
  level against the real screens, and kept a screen-level version against a
  stand-in route where the screen's suite could hold one.
- **Three per-file source scans.** `Player.test.tsx`, `ImportFlow.test.tsx`
  and `MovieForm.test.tsx` each end with a test that reads its own shipping
  file off disk and counts `navigate(`. Each slice was asked to prove its
  screen no longer pushed, and reading the file was the most direct proof
  inside that slice; from above, the presses in the same files already say it.

### Deliberately not built

A second hook (`useLeave`); a `from` in route state; a replace anywhere — on
the **Landing** or on the two **Fresh homes**; any handling of browser-chrome
Back, which the app draws none of; any prototype edit; any change to
`useDeleteMovie`, `useRestoredScroll`, `GenreLayout`, `MoviePage` or
`SettingsHeader`.

### Known and not fixed

- **A deep-linked player loops once** (Q3): `/movie/1/play` → Back →
  `/movie/1` → Back → the player again, because the **Landing** is pushed.
  Accepted — the parent is never stranded, and the packaged app opens at `/`.
- **A wrong Landing is visible only on a deep link.** The deep-link tests in
  each screen's suite are the only thing keeping the three strings honest.

### Follow-ups

The refactor round, filed as 177 with the docs slice 176 folded into it: one
spelling of the film's route, the form's constants in the glossary's words, one
structural guard on a shared walker in place of four, the probe's reader, and
the documents that close the initiative.

---

## 2026-09-21 — Back-to-top FAB refactor (issue #169)

Eight commits against `docs/refactor-plans/19-back-to-top-refactor.md` — one
to a shipping file, two to tests, five to documents. **4748 tests pass across
247 files**, from 4742 across 246: `stubScrollTo`'s six are new and nothing
else moved — the verbose reporter's leaf names before and after, diffed, show
those six added and none gone or renamed. `tsc -b` is clean and `eslint src
server` is clean on every commit. Nothing moved a pixel and nothing changed a
wire: the one change to a shipping file reorders four lines of a type. The
smallest round yet, after the smallest build — the debt an `issue-loop` build
leaves is of a kind, and made of what a subagent reading one issue cannot
see.

### What changed

- **Group 0, the record.** The build's own journal entry, written before the
  round touched the tree it describes, so it says `label` first and the stub
  twice.
- **Group 1, the props in the prototype's order.** `FabProps` and the
  destructuring read `icon`, `label`, `size`, `onClick` — the `data-props`
  order, per log 19 Q6 and the `mol.Snackbar` precedent. Each prop kept its
  docblock; the `@ts-expect-error` guard that `label` is required still had
  an error to swallow.
- **Group 2, one stub, leaving the document as it found it.**
  `test-support/stubScrollTo/` on `stubFullscreen`'s shape: called inside a
  `describe`, it installs `scrollTo` on `Element.prototype` — which jsdom
  leaves `undefined`, having it on `window` alone — for the length of that
  block, records every request as the element asked and the options it was
  asked for, in order, and deletes what was absent on cleanup. Then
  `BackToTop.test` and `MainLayout.test` read it and dropped their two
  identical copies, which assigned onto `document.documentElement` and
  `document.body` and never took it back. The two press leaves kept their
  names and their meaning, now read as _one request, and it was the
  container's_; the `window.scrollTo` spy stayed as it was.
- **Group 3, the docs.** COMPONENT-SPEC's Icons table gained `ArrowUpIcon`
  and told the truth about `PlusIcon`; its `mol.Fab` row got the tick and its
  _what shipped_ note, and `page.LibraryPage`'s composition names the mount.
  CLAUDE.md's folder map and README's tree gained `Fab/`, `BackToTop/`, the
  two glyphs, the `MainLayout` line that says what it mounts and why, and
  `stubScrollTo/`; the `hooks/` line beside `MainLayout`'s names the two
  hooks that exist. The glossary's three rows and three relationship lines
  held as written, and a _Flagged ambiguities_ entry records `Circle` for
  `Root` (a decision) and `label` ahead of `icon` (a slip, put back). And the
  tick: **Back-to-top FAB** ✅ in both feature lists, step 2 gone from the
  build-order chain, the Electron desktop shell now "next".

### Deliberately left

The two-line wheel helper in three suites, because it is not a stub for
something jsdom lacks; the ref beside `BackToTop`'s state, because a leaf
that counts commits should not rest on a `useState` bail-out React does not
promise everywhere; `Circle`'s name; the mount suite's `FRESH_HOME` entry,
because a reset affordance on `useRestoredScroll` would be a hook carrying
something for its tests; the `Fab` test's local hover reader, the only one
in the app; `BackToTop` importing `Fab` by relative path, as `FilterDropdown`
and `SubtitleRow` reach `MenuItem`; the four literals on the face; the
carousel suite's `scrollBy` stub, one suite and horizontal, which joins the
new unit if a second suite ever needs it. Every log-19 ruling the plan lists
was checked against the code and holds.

### Follow-ups

- **`prd-to-issues` stops filing the docs slice as its own issue.** Folding
  it into the refactor plan is now 140→141, 148→149, 156→157, 163→164 and
  168→169; round 18 said a fifth would be the signal, and this is the fifth.
  A process change with its own small issue, to be filed before the Electron
  shell's PRD is broken into issues, so the shell is the first initiative
  planned under the amended rule.
- **The Electron desktop shell** is step 3 and next. `Change…` in the
  Storage group and folder-path autofill in the Movie form both wait on it.

---

## 2026-09-21 — Back-to-top FAB (issues #166–#167)

Four commits across issues #166–#167, two slices against the plan on #165,
built from `docs/design-logs/19-back-to-top-fab.md`. **4742 tests pass across
246 files**, up from 4702 across 242. `npm run typecheck` is green and
`eslint src server` is clean on every commit. The fourth initiative driven
wholly by `issue-loop`, and the smallest FamilyFlix has run: two glyphs, one
molecule, one control, one line in the layout. It is its own initiative rather
than a tail on the Snackbar's because log 18 Q5 said so in advance — _two
unblocked slices are not one initiative because they are both unblocked_ — and
log 19 Q1 held to it. The maintainer's one instruction was the scope the grill
ran under: translate the prototype 1:1 into the codebase, in its naming,
conventions, patterns and architecture.

**Back-to-top FAB is _not_ ticked** in the feature table. The rule holds: ✅
when the refactor closes, not when the build issues do.

### What shipped

- **#166, the molecule and its two glyphs.** `ArrowUpIcon` and `PlusIcon` on
  `IconBase`, stroke 2.2, `currentColor`, decorative, each carrying
  `mol.Fab.dc.html`'s own path data and named for what it draws. Then
  `components/Fab/`, the prototype's circle cell for cell: `styled(IconButton)`
  — one more face beside the favorite heart, the carousel arrows, the ⋯
  trigger and the detail page's circles — absolute at 28px from the
  bottom-right corner at `z-index: 60`, the accent fill under the near-black
  ink, no border, the literal accent shadow, the `:hover:enabled` lift
  replacing both `background` and `color` so nothing leaks up from the ghost
  face, no `transition`. Named by a required `label`, choosing the glyph by
  `icon` at the molecule's own sizes — 24 for the arrow, 26 for the plus — and
  owning no state, no listener and no effect.
- **#167, the control and the mount.** `components/BackToTop/`, two files and
  no styles because it draws nothing of its own: it takes the scrolling
  container as a ref, reads its `scrollTop` on every passive `scroll` and once
  on attach, holds one boolean written only when the answer changes, mounts
  the **FAB** past `scrollTop > 420` — strictly — and asks the container alone
  for the top, smoothly. `MainLayout` renders it in one line after the body it
  already owns, handed the ref `useRestoredScroll` attached, with no state and
  no prop; its docblock no longer says the FAB "still lands with the feature
  that owns it".

### The ladder, and who mounts it

The maintainer's sketch was three rungs: a **FAB** made of _our button
component_, and a **Back-to-top** made of the FAB. The bottom rung is
`IconButton`, not `Button` (Q5) — `Button`'s `label` is visible text and its
sizes are heights with side padding, so a 52px accent circle around a glyph
would fight every rule in it, where `IconButton` already owns the square, the
centring, the pill corner, `type="button"` and the accessible name. The FAB is
that primitive wearing a face, exactly as the five faces before it are.

The prototype's page holds `showFab` because the page holds the body ref. In
the codebase that page was split three ways — chrome to `MainLayout`, rows to
`HomeRows`, composition to `LibraryPage` — and the body ref lives in the
chrome, attached by `useRestoredScroll`. So the chrome mounts the control
(Q12), on the argument that put scroll restoration there: the body is where
the scrolling happens, so the chrome is what knows how far it has gone. A
component rather than a hook (Q13), because a `useBackToTop(body)` would have
one caller and would leave the layout holding `visible`; two files in
`components/` rather than a sub-unit of the layout (Q14), because no layout
has sub-units and a control that takes any container is reusable the day a
grill says so.

### The one thing not in the prototype

The read on attach (Q16). The prototype reads only on `scroll`; here a screen
returned to by Back is put to its remembered position by `useRestoredScroll`
before the family touches anything, and the FAB must already be there when
the rows land. The restore's writes do fire `scroll` in a browser, but the
read on attach is what the tests can hold to.

### The calls the subagents made alone

The log named none of these; all five are in the code.

- **`label` first in the props.** Q6 rules the props _"1:1 with the
  prototype's `data-props`, in its order"_ — `icon`, `label`, `size`,
  `onClick`. The build declared `label` first, the likeliest reason being that
  a required prop was put ahead of the optional ones. Reasonable, and not the
  convention; the refactor round puts the prototype's order back.
- **`Circle` for the face's styled export**, where the log's contract sketch
  wrote `Root`. The five other `styled(IconButton)` faces are named for what
  they are — `FavoriteButton`, `Arrow`, `MoreButton`, `CircleToggle`,
  `ChromeIconButton` — and `Root` is what a styles file calls its outermost
  element when it has several. `Circle` follows the faces.
- **Five suites where the log said three.** Q23 named `Fab.test.tsx`,
  `BackToTop.test.tsx` and the extension to `MainLayout.test.tsx`; the PRD
  amended that to one test file per glyph as well, on the `UploadIcon` /
  `DownloadIcon` precedent — the prototype's path data, the `currentColor`
  ink, the 24×24 frame and the decorative default.
- **A `stubScrollTo` written twice.** jsdom implements `scrollTo` on no
  element, and the PRD said nothing lands in `test-support/`, citing the
  carousel suite's per-test `scrollBy` stub. The control's suite stubbed it
  that way; the mount suite, two commits later, copied the same four lines
  and the same docblock. Each copy assigns onto an element and never takes it
  back — nothing for the container the test creates and removes, but the
  press leaves stub `document.documentElement` and `document.body` too, to
  prove the control asks nothing of them, and those outlive the test.
- **`FRESH_HOME` in the mount suite.** `MemoryRouter` keys its first entry
  `default` on every render and `useRestoredScroll`'s module-level map had
  already remembered that key at 1240 from the restoration test above, so a
  body meant to start at its top was truthfully put back past the line before
  the control attached. The suite renders the home as a history entry of its
  own (`['/settings', '/']`), which is order-independent and documented at the
  constant.

### Deliberately not built

A FAB on any screen but the home; a `GenreLayout` mount, even though the
214-card shelf is the longer scroll; an opt-out or a threshold prop; a
`useBackToTop` hook; a transition on hover or on mount; `prefers-reduced-motion`;
focus management after the press; a fix for the corner the FAB shares with
the Snackbar stack; a `types/` entry; a `test-support/` double.

### Known and not fixed

- **Focus drops to `document.body` after the press** (Q19). The button
  unmounts the moment the ride drops the body under 420. Accepted as the
  prototype's own behaviour; moving focus to the header or the first card is
  a bigger surprise than letting it go.
- **A Snackbar notice covers the FAB while it is up** (Q21). The stack is at
  24/24 and `z-index: 200`, the FAB at 28/28 and 60, as the prototype draws
  both. No screen raises a notice today; solving it is a prototype amendment
  for the day it is a problem on screen.
- **`prefers-reduced-motion` is now unhonoured across eight motions** (Q20),
  the smooth scroll joining the seven. The pass belongs to `GlobalStyle` and
  every motion at once.

### Follow-ups

The refactor round, filed as 169 with the docs slice 168 folded into it: the
props in the prototype's order, the one stub two suites wrote moved to
`test-support/` and made to leave the document as it found it, and the docs
that close the initiative.

---

## 2026-09-20 — Snackbar system refactor (issue #164)

Nine commits against `docs/refactor-plans/18-snackbar-refactor.md` — two
code and test, two that only move a comment, five documents. **4702 tests
pass across 242 files**, from 4699 across 241: `snackbarStack`'s three are
new and nothing else moved — the verbose reporter's leaf names before and
after, diffed, show those three added and none gone or renamed. `tsc -b` is
green and `eslint src server` is clean on every commit. Done in one sitting
under a standing approval, one commit per resolved item; the docs slice filed
as 163 is folded in as the first and last groups, on 141's, 149's and 157's
precedent, so the initiative has one closing issue.

**Snackbar system is ticked** in the feature table by this round's last
commit, and the build-order chain in README and CLAUDE.md loses step 1; the
remaining four keep their numbers and their gates, and the Back-to-top FAB is
now "next". The rule holds: ✅ when the refactor closes, not when the build
issues do.

### What changed

- **Group 0 — the record.** The journal's entry for the build, below, written
  before anything moved so it describes the tree the four slices left — the
  `data-testid` and the two scheduling comments included.
- **Group 1 — the stack found by its geometry.** `test-support/snackbarStack/`
  is a new unit on `comesBefore`'s shape: the one element whose computed style
  is `position: fixed` and `flex-direction: column-reverse` — the container's
  host as the prototype draws it and log 18 Q20 rules it — throwing, naming
  itself, when there is none. `SnackbarProvider.test`'s `stack()` and
  `App.test`'s four reads moved onto it and `data-testid="snackbar-stack"`
  came off the provider: the one attribute shipping code carried for its
  tests alone, and the round's only change to a shipping file. Every leaf
  kept its name and its assertions; the geometry leaf still asserts `right`,
  `bottom`, `z-index`, `gap` and `align-items`, which the helper does not
  select by, so it is a test and not a tautology.
- **Group 2 — the comments that scheduled.** `Snackbar.test.tsx`'s banner
  stopped saying the stack is "what the next slice builds" and names
  `App/SnackbarProvider/`. `App.tsx`'s docblock stopped calling
  `/movie/:id/play` and `/add` placeholders — the player shipped in round 10
  and the form in round 11 — and lists seven routes as seven real screens,
  keeping the sentence about the URLs being the stable part in the past tense
  it has earned. Nobody had opened `App.tsx` for anything but a mount since
  round 9.
- **Group 3 — the docs.** COMPONENT-SPEC's `mol.Snackbar` row rewritten to
  what shipped — the flat props, the role by variant, `error` reading
  `danger`, the card's own ✕, the provider/hook split, the one timing rule,
  no caller yet — its Icons table gaining the four glyphs, and its
  `page.SettingsPage` row waiting on the shell and the packaging rather than
  the Snackbar system. CLAUDE.md's folder map naming `App/SnackbarProvider/`,
  `App/useSnackbar/`, `components/Snackbar/`, the four glyphs and
  `test-support/snackbarStack/`, its Settings Hub section saying the stack
  ships first and empty and that none of the six refusing screens was
  reopened; README's tree in the same places. The glossary's **Snackbar
  stack** row corrected and a _Flagged ambiguities_ entry recording why, by
  bare number.

### The sentence the code never carried

Log 18 Q19 keeps the stack mounted when empty "so a live region precedes its
content", and the glossary repeated it. The stack is not a live region: the
roles are on the cards (Q9, the prototype's own `role="status"`), each of
which mounts carrying its content — the case the sentence warns about — and
the provider's own suite asserts the column has none. So the always-mounted
stack was kept for a reason that holds and described by one that does not.
The row now gives the reason that holds: an empty flex column paints nothing,
and a conditional mount is a branch with nothing behind it. No `aria-live`
was added to the stack — a behaviour change off the prototype, and an `alert`
card inside a polite region is a nesting screen readers disagree about. **The
gap is real and is not fixed:** a card inserted with its content may be
announced less reliably than a persistent region would announce an insertion.
That is an accessibility pass over every live region in the app, not a
refactor's change to one.

### Deliberately not changed

- **The glyph names and their tests.** `InfoCircleIcon` and `BangTriangleIcon`
  follow Q10's "named for what they draw" more faithfully than Q10's own
  `InfoIcon` and `WarningIcon`, the second of which names the notice. The four
  tests follow the three most recent glyphs; leaving the four newest the only
  recent ones without a test would be the odd convention out.
- **`SnackbarApi`** keeps its name where the log's sketch wrote `Snackbars`: a
  plural of the molecule's name reads as a list of cards, and
  `{ notify, dismiss }` is not one. Recorded in the glossary, not corrected.
- **`App.tsx` stays flat** in `App/` (Q16): co-located with its test, which is
  what the one-folder-per-unit rule asks for, and `App/` is simultaneously the
  category the two units join. No barrel; both imported by path.
- **The stack reads `space.s5` and `space.s3` where the molecule writes
  literals.** On-scale values reading the token is the more common spelling
  across fifty reads of `theme.space`; `14px`, `18px`, `360px` and `28px` are
  off the scale and stay literal.
- **`variantColour` stays exported** from the styles file with no reader
  outside it; the styles file is the one place a variant becomes a colour.
- **The molecule keeps `dismissible`** (Q23): the prop is the prototype's
  `data-props`. The notice does not carry it and the stack never passes
  `false`.
- **The four icon tests and the molecule's `it.each` are not folded.** Each
  variant leaf asserts one thing; a fold would be one leaf asserting twelve.
- **Q19, Q20, Q23, Q24, Q25 and Q26** were each checked against the code for
  the plan and hold; the plan's decision document names them so the next
  round can read that they were checked rather than check them again.

### What this round was for

The third `issue-loop` initiative, and the smallest round yet — nothing moved
a pixel, nothing changed a wire. The debt is the kind rounds 15 and 16 found:
a subagent reading one issue cannot see that a `data-testid` is the first
attribute in shipping code that exists for a test, or that the banner it
writes "for the next slice" will be stale two commits later. The new thing is
the glossary: written by the grill ahead of the build, it carried a rationale
the code never did, and the rule that settled it is 163's — where the code and
the glossary disagree, the code wins, and the glossary says so in the entry
that corrects it.

The plan's own note stands: folding the docs issue into the refactor is now
the fourth time. If a fifth initiative does the same, `prd-to-issues` should
stop filing the docs slice as its own issue and fold it at planning time.

---

## 2026-09-20 — Snackbar system (issues #159–#162)

Seven commits across issues #159–#162, four slices against the plan on #158,
built from `docs/design-logs/18-snackbar.md`. **4699 tests pass across 241
files**, up from 4603 across 234. `npm run typecheck` is green and
`eslint src server` is clean on every commit. The third initiative driven
wholly by `issue-loop`, and the first in FamilyFlix that ships with no caller
— by design: log 17 Q32 ruled that two of the four **Update check** outcomes
have nowhere to go but a Snackbar, so the update flow's bridge cannot go
first; log 18 Q2 that a component specified to the word by a named consumer
(the **Update offer snackbar**, log 17's copy table) is not the speculative
one this project refuses; Q3 that none of the six screens which refused a
snackbar on their own merits would be reopened to give it work; and Q4 that
its own tests are the whole proof until the **Software update** flow lands
three initiatives from now. The maintainer's one instruction was the scope
the grill ran under: translate the prototype 1:1 into the codebase, in its
naming, conventions, patterns and architecture.

**Snackbar system is _not_ ticked** in the feature table. The rule holds: ✅
when the refactor closes, not when the build issues do.

### What shipped

- **#159, the prototype amended first.** `FamilyFlix.dc.html`'s
  `checkForUpdates()` confirmation `duration: 4000` → `5000` — log 17's
  amendment 2, inherited because it is the Snackbar's timing rule that it
  makes consistent. `mol.Snackbar.dc.html` and the container's `pushSnack` /
  `dismissSnack` untouched.
- **#160, the molecule and its four glyphs.** `InfoCircleIcon`,
  `CheckCircleIcon`, `BangTriangleIcon` and `CrossCircleIcon` on `IconBase`,
  in `currentColor`, each carrying the prototype's own path data. Then
  `components/Snackbar/`, `mol.Snackbar.dc.html` cell for cell: the 360px
  card on `surface2` under the prototype's literal shadow, the 4px accent
  bar, the glyph seated 1px down, the 15/600 title over the 14px dim message,
  the bordered action written in the variant's colour, the 28px ✕ pulled into
  the padding announcing itself as **Dismiss**, `ffSnackIn` on entry. Props
  flat and in the `data-props` order, `dismissible` included. Two deviations
  the log rules: `error` reads `danger` because the prototype's own map does,
  and the prototype's flat `role="status"` becomes `status` for `info` /
  `success` and `alert` for `warning` / `error`. Presentational to the last
  prop — no timer, no effect.
- **#161, the stack, the hook and the mount.** `App/useSnackbar/` owns the
  context, the hook and `SnackbarNotice`, and throws outside a provider,
  naming itself. `App/SnackbarProvider/` owns the queue, the ids off a
  counter, one `setTimeout` per notice in a ref keyed by id, and the
  **Snackbar stack**: the container's host at `position: fixed` (Q20),
  `column-reverse` so an array appended to puts the newest nearest the corner,
  `pointer-events: none` with each card's wrapper taking them back, always
  mounted, no portal, no cap, no dedupe. `notify` and `dismiss` never change
  identity. Mounted in `App` between `GlobalStyle` and `Routes`, so a notice
  raised on one route is still in the corner on the next.
- **#162, the actionable notice.** The one timing rule in one place: a notice
  with an `action` arms no timer and persists; every other notice dies at
  5s; pressing the action takes its own notice off first and then runs
  `onClick`; the ✕ takes it off without running it; `dismiss(id)` retracts one
  nobody pressed and does nothing against one already gone.

### The calls the subagents made alone

The log named none of these; all four are in the code.

- **The glyph names.** Q10 wrote `InfoIcon` and `WarningIcon` and ruled the
  four "named for what they draw". The build named them `InfoCircleIcon` and
  `BangTriangleIcon`, which follows the rule better than its own examples:
  `WarningIcon` names the notice it sits on, `BangTriangleIcon` names the
  picture.
- **Four icon tests.** Q10 said "no tests — `Icon/` is flat and untested but
  for the three that earned one". The build gave all four a test on the
  precedent of the three most recent glyphs (`DownloadIcon`, `MicrochipIcon`,
  `UploadIcon`): the prototype's path data, the `currentColor` ink, the 24×24
  frame and the decorative default.
- **`SnackbarApi` for the hook's answer**, where the log's contract sketch
  wrote `Snackbars`. A plural of the molecule's name reads as a list of cards,
  and `{ notify, dismiss }` is not one.
- **A `data-testid="snackbar-stack"` on the stack**, the only one in shipping
  code — there because the stack has no role of its own (the roles are on the
  cards) and four leaves need to find it empty. The refactor round takes it
  off.

### Deliberately not built

A caller in any of the six refusing screens (ratings, add, delete, import,
export, the codec manager); `duration` or `dismissible` on the notice; a cap,
a dedupe, coalescing; a portal; an exit animation; `prefers-reduced-motion`
(now unhonoured across six animations rather than five, to be fixed in
`GlobalStyle` for all of them at once); Escape-to-dismiss; hover-to-pause; a
`types/snackbar.ts`; a `test-support/` double for the stack; `App.tsx` moved
into a folder of its own.

### Known and not fixed

- **The stack is not a live region.** Q19 keeps it mounted when empty "so a
  live region precedes its content", but the roles are on the cards (Q9, the
  prototype), each of which mounts carrying its content — the case the
  sentence warns about. The always-mounted stack is right for a reason that
  holds (an empty flex column paints nothing, and a conditional mount is a
  branch with nothing behind it); the reliability gap is real and is an
  accessibility pass over every live region in the app, not this feature's.
- **A notice raised under a fullscreen player is unseen until fullscreen
  exits** (Q33). An actionable one is waiting on the other side; a 5s
  confirmation about something the family did not do is no loss.

### Follow-ups

The refactor round, filed as 164 with the docs slice 163 folded into it: the
stack found by its geometry rather than the `data-testid`, the glossary's
live-region sentence corrected, the two comments that still schedule, and the
docs that close the initiative.

---

## 2026-09-19 — Playback component upload refactor (issue #157)

Sixteen commits against `docs/refactor-plans/16-component-upload-refactor.md` —
nine code and test, four documents, and the three that only move a comment.
**4603 tests pass across 234 files**, from 4597 across 233: `zoneFace`'s five
are new, Group 3 adds three that cover behaviour nothing asserted, two leaves
fold into their neighbours, and two are rewritten rather than added. `npm run
typecheck` is green and `eslint src server` is clean on every commit. Done in
one sitting under a standing approval, one commit per resolved item; the docs
slice filed as 156 is folded in as the first and last groups, on 141's and
149's precedent, so the initiative has one closing issue.

**Codec manager — add a playback component is ticked** in the feature table by
this round's last commit, which completes the Settings hub's five rows. The
rule holds: ✅ when the refactor closes, not when the build issues do.

### What changed

- **Group 0 — the record.** The journal's entry for the build, above, written
  before anything moved so it describes what the five slices left — including
  the five judgment calls the subagents made that no issue asked for.
- **Group 1 — the prototype's own ✕.** `feat.CodecManager.dc.html`'s
  `title="Remove codec"` became `title="Remove playback component"`, since
  #151's amendment made the component row the only row a ✕ is drawn on, and
  "codec" is the word that row exists to stop the screen saying. Then
  `CodecRow` was built to it: the local styled `RemoveButton` went from
  `CodecRow.styles.ts` and the molecule draws
  `primitives/RemoveButton`, which builds the same accessible name it built by
  hand and adds the `title` the prototype draws. The local copy was the
  primitive's rule character for character **plus** `font-family: sans` and
  `font-size: 13px`, two properties the prototype writes on neither of its ✕s
  — so this is the one pixel the round moves, and it moves onto the prototype.
  `PlaybackSection`'s docblock stopped saying the zone it points at "is not
  drawn".
- **Group 2 — the zone's faces as a table.** `zoneFace/` is a new pure unit on
  `importView`'s precedent: an **Upload state** in, `{ title, line, refused }`
  out. `ComponentDropZone`'s nested ternary and three guarded `{cond && …}`
  blocks became one `<Line>` reading the mapper. `busy` stayed on the molecule
  — it disables the input, kills the hover and makes a second drop report
  nothing, which is behaviour rather than copy. The invitation's `line` is
  `null`, recorded on the prop rather than hidden, because its `ffmpeg` is a
  `<Mono>` span the molecule composes.
- **Group 3 — the refusal nobody asserted.** The build's fourth install
  refusal, `failed`, had two paragraphs of reasoning and no leaf; the two
  nearest asserted a negative, and the install's wrapped the call in a
  `try/catch` so a **throw would have passed** — on the one path whose whole
  design decision is "a value, never a throw". Both now assert
  `{ ok: false, reason: 'failed' }`. A third leaf covers the swap's rollback:
  a second rename that fails with `current/` already in `previous/` puts the
  live pair back — checked by mutation, since removing the rollback turns it
  red. And the two route fakes' outcome unions are now the slot's own
  `InstallOutcome` and `RemoveOutcome` rather than hand-copied lists, with a
  `500` leaf each, so `REFUSALS` and `REMOVE_REFUSALS` are exhaustively
  covered and the next reason added to either union will not compile in the
  suite that has to cover it.
- **Group 4 — the tests read by behaviour.** The mid-file phase banners in
  `CodecManager.test.tsx`, `useCapabilities.test.ts`, the settings feature's
  `api.test.ts`, `ComponentDropZone.test.tsx` and `routes.settings.test.ts`
  folded into their files' top banners, and `componentSlot.test.ts`'s two
  section banners kept their prose and lost their dating.
  `CodecManager.test.tsx` counts the zone once — its old leaf's zone half is
  what `draws the zone last` already asserts in a stronger form, and its
  distinct `✕` query joined the ✕ describe's positive — and
  `CodecRow.test.tsx` counts its buttons once. `test-support/componentDir`
  re-exports `EXE` from the resolver that owns it rather than declaring a
  second copy.
- **Group 5 — the docs.** COMPONENT-SPEC's `CodecManager` row rewritten and
  `CodecRow` and `ComponentDropZone` given rows of their own, the Icons table
  gaining `UploadIcon`. CLAUDE.md's folder map naming the three new
  `playback/` units, `test-support/fixedSlot/` and `componentDir/`,
  `ComponentDropZone/` and `zoneFace/`, `visuallyHidden`, and the amended
  `createPlayback`, `capabilities`, `CodecManager`, `CodecRow`, `codecView`,
  `useCapabilities` and `api/` lines; its Settings Hub section carrying the
  two component routes, its "not drawn" list down to two, and the Tech Stack
  paragraph's "Settings' codec pack replaces this binary" now true. README's
  tree in the same places. The glossary's three amendments, by bare number.

### Deliberately not changed

- **The route keeps its own "both halves" check.** `taken.size < 2` at the
  door and `pairIn(incomingDir) === null` in `install()` are the same rule
  twice, and dropping the route's would answer identically through
  `REFUSALS.incomplete`. It stays: the route's check is the sibling of
  `stray`, which only the route can make, and removing it would push the rule
  into the route suite's fake slots, which would then have to model `pairIn`.
  One rule written twice beats one rule simulated in a double.
- **`routes.settings.test.ts` keeps both initiatives' routes.** Round 15's
  rule was one suite per initiative, and its reasoning was that a second
  listener and sandbox for routes that share a page is scaffolding duplicated
  for nothing. The two component routes are the Settings page's wire. A
  `routes.component.test.ts` would copy ~130 lines of setup to move ~460 of
  leaves.
- **`useCapabilities` keeps its three guards.** `wanted`, `onScreen` and
  `inFlight` are three mechanisms for two questions where `useExport` uses one
  epoch ref. `wanted` is the shape every fetch-once hook on this page uses,
  `inFlight` cannot be state because the callback closes over the render it
  was made in, and `onScreen` is what makes a write landing after the page has
  gone redraw nothing. Considered and kept.
- **`componentSlot.ts` stays one unit** at 340 lines, owning resolution,
  staging, verification-dispatch and the swap — which is what the design log
  said it would own. Splitting the swap out would put the rename
  classification on one side of a seam and the recomposition on the other.
- **`bytesOf` and `spaceUsed` stay two**, and **the four `readBody` catches
  keep their one sentence** — the latter is project-wide and belongs with the
  routes round, not this one.
- **Per-test `File` fixtures stay per-test**, with the shared-fetch-double and
  shared-listening-harness rounds named since round 13.
- **`routes/index.ts` at ~1666 lines** — the routes round, still its own.

### What this round was for

The second `issue-loop` initiative, and Groups 1, 2 and 4 are round 15's
finding again, in the same feature one round later: #154 amended the card
`PlaybackSection` describes and never opened it; #152 built a ✕-shaped hole
and #155 filled it without looking for the atom the design log's own
background section names; each slice wrote its banner under the last one's
rather than into it. A build that does not read back leaves exactly that.

Group 3 is the new thing. The `failed` refusal is good engineering nobody
asked for — a subagent saw that `renameSync` fails for reasons that are
neither the lock nor the pair, decided a throw would be the one outcome the
route could not answer, added a fourth reason to both unions, mapped both to
`500`, and wrote two paragraphs explaining why. It then wrote no test for any
of it, because the acceptance criteria it was working from named three
refusals. **An issue's acceptance criteria are a floor, and a build that adds
a state must add its leaf in the same commit** — the RED step cannot cover a
state that does not exist until GREEN, so the only place it can be caught is
the build writing its own. Worth a line in the `build` skill. The durable half
of the fix is the smaller one: the route fakes now import the unions instead
of copying them, so the next reason added will not compile until it is
covered.

---

## 2026-09-19 — Playback component upload (issues #151–#155)

Ten commits across issues #151–#155, five slices against the plan on #150,
built from `docs/design-logs/16-component-upload.md`. **4597 tests pass across
233 files**, up from 4398 across 227. `npm run typecheck` is green and
`eslint src server` is clean on every commit. The second initiative driven
wholly by `issue-loop`: every RED and every GREEN was a subagent's, and the
maintainer's one instruction was the scope the grill session ran under —
translate the prototype 1:1 into the codebase, in its naming, conventions,
patterns and architecture. Nobody read a diff between the commits; the
refactor round is where that reading happens.

**Codec manager — add a playback component is _not_ ticked** in the feature
table. The rule holds: ✅ when the refactor closes, not when the build issues
do.

### What shipped

- **#151, the prototype amended first.** `FamilyFlix.dc.html`'s `codecs`
  model gains the **Component row** as its last entry — `Playback component`,
  the two binary names, a real size, and a `source` of `default` / `uploaded`
  that decides the pill's colouring and whether the ✕ is drawn at all;
  `uploadCodec()` flips it to uploaded and `removeCodec` on it flips it back.
  `feat.CodecManager.dc.html`'s zone reads `zoneTitle`, `zoneLine`,
  `zoneBusy` and `zoneRefused` instead of literals, so the busy and refused
  faces are on the prototype the way the player's buffering and unavailable
  states are. Geometry unchanged in both. The initiative's own rule,
  exercised: amend the prototype, then build to the amendment.
- **#152, the tracer bullet — the slot resolves what is live, and it has a
  row.** `createComponentSlot(slotDir, env, seams)` is the **Component
  slot**: `current/` read ahead of `FAMILYFLIX_FFMPEG_PATH` and ahead of
  `PATH`, with `incoming/` and `previous/` swept on startup, and
  `PlaybackComponentInfo` — the **Component info** the screen draws — off
  whichever won. `createPlayback(mediaPath, slot)` takes the slot rather than
  a component and reads it per request, so the next press of Play decides
  over whatever is live with nothing cached to clear; that is the signature
  change, and the thirty-odd test call sites moved onto
  `test-support/fixedSlot/` with it — the widest edit the initiative makes,
  and entirely mechanical. `capabilities(component)` answers rows alone. On
  the screen: `codecView`'s reshaped model and `componentRow`, and `CodecRow`
  1:1 with the two props of the row template that were idle — a real size and
  an `onRemove`.
- **#153, an upload changes what the next Play decides.** `componentBinary`
  is the feature's security boundary the way `fileKinds` is media's: a file
  part is `ffmpeg`, `ffprobe`, or nothing, by its name alone.
  `verifyComponent` runs the staged pair before anything moves. The
  **Component swap** is three directory renames — `current/` → `previous/`,
  `incoming/` → `current/`, `previous/` removed — so a Windows lock on a
  running `ffmpeg.exe` fails the _first_ rename with nothing moved and
  answers the **In-use refusal** rather than leaving a mixed pair behind.
  `POST /api/playback/component` on the wire, echoing the whole **Codec
  report** after the write so the screen redraws from the echo.
- **#154, the zone.** `visuallyHidden`, `UploadIcon`, and
  `ComponentDropZone` — a `<label>` over a clipped multiple file input, with
  drag-over drawn as the prototype's hover and the three faces the
  prototype's author never wrote. `installComponent` and
  `ComponentRefusedError` in the feature's `api/`, `upload` state on
  `useCapabilities`, and `CodecManager` composing the zone under the rows.
  The first thing the maintainer can see work: drop the pair, watch the
  **Installed** rows appear.
- **#155, the ✕ takes it back.** `removeComponent` on the slot — the same
  rename, the same lock classification, the same echo — behind
  `DELETE /api/playback/component`, on the hook, and wired to the **Component
  row**'s ✕, which is drawn only when the live component is the maintainer's.
  A remove falls back to whatever the installer or PATH offers, which is the
  slot's resolution order read the other way round.

### The calls the subagents made alone

The design log named three install refusals and did not name any of these.
All five are in the code, all five are right, and the refactor round's
Group 3 exists because the first of them was asserted by nothing.

- **A fourth refusal, `failed`, on both outcome unions.** A swap can stop for
  something that is neither the lock nor the pair — a full disk, a directory
  gone from under it. It is a value rather than a throw "because an install
  that threw would be the one outcome the route could not answer", and it is
  not `in-use` because "sending the maintainer to stop a film that is not the
  problem would be worse than saying nothing useful". `RemoveRefusal` gained
  the same fourth and `routes/index.ts` maps both to `500` with a sentence
  each.
- **`componentBinary` accepts a `-` suffix.** A build downloaded from a build
  site is called `ffmpeg-7.1.exe` as often as `ffmpeg`, so the name,
  lowercased, is the binary's own word, optionally followed by a `-` and
  whatever the build called itself, optionally under a `.exe` — and nothing
  else. `myffmpeg.exe` and `ffmpeg.dll` are halves of nothing.
- **`EACCES` joins `EBUSY` and `EPERM`** in the lock set, because the three
  are what a held handle answers as depending on who is holding it.
- **A `rename` seam beside `verify`**, injected for the reason the
  environment is: a unit that spawns or renames must be assertable on a
  machine that has neither an FFmpeg on it nor a Windows lock to reproduce.
- **The swap rolls back a first rename that succeeded.** If `incoming/` →
  `current/` fails after `current/` has already moved to `previous/`, the code
  renames `previous/` back, because the live component is the one thing that
  must be where it was.

### What only a human can accept

Three criteria no subagent could exercise, and none of them run in CI:

- drop a real `ffmpeg`/`ffprobe` pair on the zone and watch the **Installed**
  rows appear;
- press the ✕ and watch them go back to **Built-in**;
- start a transcode, drop mid-conversion on Windows, and get the **In-use
  refusal** with the previous pair still live.

### Deliberately not built

A zip upload; an Electron folder dialog for the pair; a confirm on remove; an
upload progress bar; a success flash or snackbar after a swap (log 16 Q13
rules it out for good — the redrawn rows are the feedback); a per-row ✕ or
size on codec rows (log 15 Q7 and log 16 Q9, also for good); memoising
`decoders()` or `capabilities()`, because the component is asked afresh on
purpose so the report and the next Play cannot disagree; killing running
conversions to free a locked binary; a version string parsed off
`ffmpeg -version` for the row's name.

`FAMILYFLIX_COMPONENT_PATH` defaults to a repo-local `./playback-component`
and is the slot until the Electron shell points it at
`app.getPath('userData')`. That, and _Change…_ and _Software update_, are
still their own initiatives.

### Follow-ups

The refactor round, filed as 157 with the docs slice 156 folded into it: the
**Component row** drawing the `RemoveButton` atom rather than a local copy of
it two properties out from the prototype, the zone's three faces as a pure
`zoneFace` mapper on `importView`'s precedent, the leaves nobody wrote for the
fourth refusal and the swap's rollback, the mid-file phase banners, and the
docs.

---

## 2026-09-18 — Settings hub refactor (issue #149)

Twelve commits against `docs/refactor-plans/15-settings-hub-refactor.md` —
six code, six documents. **4398 tests pass across 227 files**, from 4399
across 228: one leaf folded into another with its one distinct query carried,
twelve moved between files with their names and assertions untouched, none
changed. `npm run typecheck` is green and `eslint src server` is clean on
every commit. Done in one sitting under a standing approval, one commit per
resolved item; the docs slice filed as 148 is folded in as the first and last
groups, on 141's precedent, so the initiative has one closing issue.

**The Settings hub is ticked** in the feature table by this round's last
commit, in the shape the design log's Q24 named: **Settings shell**,
**Subtitle preferences** and **Storage** ✅, **Codec manager** split into
_view installed codecs_ ✅ and _add a playback component_ 🔜, **Software
update** still 🔜. The rule holds: ✅ when the refactor closes, not when the
build issues do.

### What changed

- **Group 0 — the record.** The journal's entry for the build, above,
  written before anything moved so it describes what the five slices left.
- **Group 1 — the pixel and two cleanups.** `AboutCard` sets `margin-bottom:
0` over the 32px `Card` carries for the two cards that need a group gap
  under them; the prototype's last card has none. The one styles change of
  the round, and a subtraction. `LibrarySection`'s docblock stopped saying
  Storage and About were "later phases". `SubtitleRow`'s `languages` prop
  became `readonly string[]`, so `MovieFormFiles` hands `SUBTITLE_LANGUAGES`
  through by name the way `PlaybackSection` already maps it, and the local
  copy that existed to shed the `readonly` went; `detectSubtitleLanguage`'s
  `DEFAULT_LANGUAGE` alias went the same way.
- **Group 2 — one route suite.** `routes.storage.test.ts` folded into
  `routes.settings.test.ts` under one `freshApi({ component, mediaPath,
exists })` that returns the media directory; the twelve storage leaves
  moved with their `chdir` restore. The banner now names the initiative's
  four routes rather than "one route in this phase".
- **Group 3 — tests read by behaviour.** `SettingsPage.test.tsx` counts its
  six buttons once: the Storage card's leaf folded into "composes the five
  sections and nothing else", which gained the `/change/i` query it lacked;
  the three settings-hub leaves lost their inline phase comments. The
  mid-file phase banners in the settings feature's `api.test.ts`,
  `useSubtitles.test.ts` and `db.test.ts` folded into their files' top
  banners, on `LibrarySection.test.tsx`'s precedent.
- **Group 4 — the docs.** COMPONENT-SPEC's `CodecManager` row (no props,
  owns `useCapabilities`, composes `CodecRow`; no zone and no ✕), `Toggle`
  row (four props, `aria-disabled`, the name required), `SettingsPage` row
  (five sections) and Icons table (`MicrochipIcon`). CLAUDE.md's folder map
  and README's tree naming every unit the initiative added, and a **Settings
  Hub** section in CLAUDE.md carrying the four routes. The glossary's one
  amendment: **Codec report** says `CodecRowModel`, the code's name, where it
  said "Format row model".

### Deliberately not changed

- **Three fetch-once hooks stay three.** `useCapabilities`,
  `useStorageReport` and the read half of `useSettings` are the same twenty
  lines under different names, and a `useRead(fetcher)` was rejected: each
  hook's name is what its test and its organism read, each docblock says
  which report and why it is blank until it lands, and a generic would move
  that "why" into a parameter. `useSubtitles`' settings read is the same
  shape with a `movieId` dependency — the case a generic would have to grow
  an argument for.
- **The hand-rolled `fetch*` calls stay hand-rolled**, and so does the
  listening-API harness the two route suites (now one) share with the
  import's and the export's. A shared JSON-GET helper, a shared read hook,
  a shared harness and a shared fetch double are project-wide rounds, named
  as such since round 13.
- **`chooseSubtitleLanguage` keeps its `Promise<void>`.** The log's sketch
  wrote `void`; the build returns the settled promise so a test can await
  the revert. It never rejects, a leaf pins that, and the section calls it
  with `void`.
- **`Toggle`'s `onToggle` stays required.** A disabled switch passing
  `() => undefined` is one line in one place; an optional handler on a
  control that exists to be pressed would be the wrong default the day
  auto-on ships.
- **`DECODER_LINE` keeps its letter-first rule** and **`windBackToV1` keeps
  dropping `settings`** — the two calls the build entry records, both read
  and both right.
- **The `ItemDesc` under _Subtitles_ keeps its 440px cap**, **`RowRule` and
  `Divider` stay two**, and **the prototype's literals stay literal** —
  `#1a1109`, `rgba(138, 154, 107, 0.16)`, `0.3` — on the `Button`,
  `ExportModal` and `MetaLine` precedents.
- **`routes/index.ts` at ~1510 lines** — the routes round, still its own.

### What this round was for

The first initiative built wholly by `issue-loop`, and every finding in
Groups 1–3 is of one kind: nothing wrong, nothing the tests would catch, a
thing a human reading the whole feature notices and a subagent reading one
issue does not. #146 and #147 amended `SettingsPage` and its test and never
opened `LibrarySection`, so a sentence about "later phases" sat there for two
slices; #146 wrote its route suite beside #143's rather than inside it,
because "the settings suite" was a file it had not been told about. The
refactor round is where the reading back happens, which is the argument for
keeping it even when it is short.

---

## 2026-09-18 — Settings hub (issues #143–#147)

Ten commits across issues #143–#147, five slices against the plan on #142,
built from `docs/design-logs/15-settings-hub.md`. **4399 tests pass across
228 files**, up from 4132 across 210. `npm run typecheck` is green and
`eslint src server` is clean on every commit. The first initiative driven
wholly by `issue-loop`: every RED and every GREEN was a subagent's, and the
maintainer's one instruction was the scope the grill session ran under —
translate the prototype 1:1 into the codebase, in its naming, conventions,
patterns and architecture. Nobody read a diff between the commits; the
refactor round is where that reading happens.

**The Settings hub is _not_ ticked** in the feature table. The rule holds:
✅ when the refactor closes, not when the build issues do.

### What shipped

- **#143, the tracer bullet — a true codec row on the page.** The **Codec
  report** moves behind the **Playback component** seam: the component
  gains `decoders()`, `ffmpegComponent`'s listing becomes an
  encoders/decoders pair, `capabilities(component)` reads the listing off
  the one `main.ts` composed and consults nothing else — not the
  environment, not a binary on PATH — and `Playback.capabilities()` exposes
  it to `GET /api/playback/capabilities`. The codec types move to
  `src/types/playback.ts` for both build targets. On the screen: the
  **Format catalogue** in `codecView`, `fetchCapabilities` and
  `useCapabilities` (blank until it lands), `MicrochipIcon`, `CodecRow`,
  `CodecManager`, `PlaybackSection` over the new `section.styles.ts` — the
  **Section card**, divider, item title and lede, and the **Group heading**
  moved out of `LibrarySection.styles.ts` — and `SettingsPage` composing
  LIBRARY then PLAYBACK. The prototype's `summaryLabel` copy was amended
  first (`5db8da0`): the rows it counts are what the bundled component
  decodes, which the family never "added".
- **#144, the Subtitles rows — the preference kept and shown.**
  `src/types/settings.ts` (`SUBTITLE_LANGUAGES`, `SubtitleLanguage`,
  `DEFAULT_SUBTITLE_LANGUAGE`, `Settings`, `StorageReport`), the **Language
  pool** spelled once and read by the form's **Subtitle row**, the scanner's
  tags and the _Preferred language_ pill; migration 3, the `settings` table,
  and `settings()` / `setSubtitleLanguage()` on `LibraryStorage` under
  `library/settings/`; `GET /api/settings` and
  `POST /api/settings/subtitle-language`, a **Single-signal write**;
  `fetchSettings` in the shared `api/` (the player asks for it too),
  `saveSubtitleLanguage` and `useSettings` with its optimistic
  choose-and-revert; the `Toggle` primitive; and the Playback card's second
  half under the divider — _Turn on automatically_ with the **Coming soon
  pill** and a disabled switch, and the _Preferred language_ pill over
  `FilterDropdown`.
- **#145, the player honours the preference.** `useSubtitles` reads the
  household's **Preferred subtitle language** through the shared
  `fetchSettings` once per open and hands it to `preferredSubtitle`, which
  has known what to do with one since log 10 wrote it. Track order until the
  settings land and when the read is refused; the **Cue list** held against
  the row it came from, so CC pressed before the settings land does not
  leave the first row's lines under a later-chosen track.
- **#146, the Storage card.** `spaceUsed(root)` in `server/src/media/` — a
  walk summing every file's size, `0` for a missing root, an entry gone
  mid-walk skipped, never throwing; `GET /api/storage` →
  `{ mediaPath, bytesUsed, movieCount }`, the path resolved to absolute at
  request time, the walk read afresh on every visit; `formatBytes` in
  `utils/`, 1024-based; `fetchStorageReport`, `useStorageReport`,
  `StorageSection` — no _Change…_, blank until the report lands.
- **#147, the About card.** `AboutSection` under STORAGE: the brand row,
  the **App version** in mono beside it, the tagline pushed to the far end.
  `__APP_VERSION__` declared once in `src/types/appVersion.d.ts` and defined
  by Vite from `package.json`'s `version`, real under vitest too. No
  _Software update_ row.

### The loop, measured

The two slices the design log's own phases sized — the tracer bullet, which
carried the server seam, the types promotion, the shared furniture and five
frontend units; and the Subtitles rows, which carried a migration, a route
pair, a new primitive, a hook and a scanner change — ran every step over the
loop's 100k-token budget. The three later slices ran under it. Both heavy
slices were the log's phases taken whole, and both would have been two
issues each. For the next `prd-to-issues`: a slice that names a new
primitive _and_ a migration is two slices.

### Two judgment calls the subagents made alone

- **A decoder name begins with a letter.** The RED fixture for
  `capabilities` listed `012v` — a real, uncompressed ffmpeg decoder — and
  its exact-set assertion excluded it. The build's `DECODER_LINE` regex
  makes a name begin with a letter, which is also what keeps the legend's
  ` V..... = Video` from being reported as a codec called `=`. The
  digit-named decoders ffmpeg has — `012v`, `4xm`, `8bps` — are none the
  **Format catalogue** names, so no row is lost. Documented in the regex's
  docblock; the one parsing decision nobody was present to confirm.
- **`windBackToV1` drops `settings`; migration 3 stays strict.** The
  pre-existing helper in `db.test.ts` wound a database back to v1 by
  dropping what migration 2 added; once migration 3 existed, a "v1"
  database still held a `settings` table and re-opening failed. The
  subagent chose to make the helper drop the table rather than give the
  migration `IF NOT EXISTS`: a migration that tolerates its own table
  already existing cannot tell a fresh database from a half-run one.

### What no subagent could exercise

Each slice's last acceptance criterion was a hands-on check, ticked on the
strength of the tests rather than driven: a live machine with ffmpeg on PATH
and one without (#143); choosing Spanish against a dev library, reloading,
and reading the `settings` row in `familyflix.db` (#144); the track a film
opens on (#145); Explorer's Properties dialog against the managed media
folder (#146); the version in the running app (#147). The route and hook
tests cover both faces over a fake component and a real SQLite file; the
looking is the maintainer's.

### Deliberately not built

- **The _Add a codec pack_ drop zone and the per-row ✕** — the **Playback
  component upload** initiative, with its own grill. The size cell is a
  column of dashes until that initiative decides what a component's size
  means on a row.
- **_Change…_ on the Storage card and the _Software update_ row** — the
  Electron shell's, and the Snackbar system's. Neither is drawn: the rule
  that held the Export row back until its dialog existed.
- **Auto-on subtitles** — still 🧭; the **Auto-on toggle** ships disabled
  under its Coming soon pill.
- **A skeleton, an error face, a snackbar** on any of the three reads — the
  Export summary's rule: `null` until it lands, `null` if it never does,
  nothing drawn while so.
- **A "not supported" row**, **validating the preference against the pool**,
  **memoising `capabilities()` or `spaceUsed`** — the log's ruled-out list,
  left ruled out.

### Follow-ups

The refactor plan, filed as 149 and folding the docs slice 148 in: the About
card's inherited group gap, the one pixel; a `LibrarySection` docblock still
scheduling phases that shipped; a tuple copied to shed a `readonly` the prop
should take; a second route suite where the first's banner says one; and
leaves that count the page's buttons three times because three slices each
asked "and did I add one?". Nothing wrong, nothing the tests would catch — a
thing a human reading the whole feature notices and a subagent reading one
issue does not.

---

## 2026-09-17 — Export refactor (issue #141)

Fifteen commits against `docs/refactor-plans/14-export-refactor.md` —
nine code, six documents. **4132 tests pass across 210 files**, from 4135
across 210: two cases added (a close mid-request; the done copy with and
without a count), four removed with named twins, one duplicate leaf dropped.
`npm run typecheck` is green and `eslint src server` is clean on every commit.
The smallest round yet, done in one sitting under a standing approval, one
commit per resolved item; the docs slice filed as 140 is folded in as the
first and last groups, on 135's precedent, so the initiative has one closing
issue.

**Export is ticked** in the feature table by this round's last commit. The
rule holds: ✅ when the refactor closes, not when the build issues do.

### What changed

- **The wire and the hook.** `exportLibrary(format) → Promise<Blob>` in the
  feature's `api/` is `fetchExportFile` — the name its one import already
  gave it, and what every other reading call is called. The hook's action
  keeps `exportLibrary`: a wire call is named for the request, a hook action
  for the intent, and the button's verb is the dialog's contract.
  `useExport`'s docblock now says what the code does — a close mid-request
  drops the **Export ready** redraw and not the file — and a test pins it:
  `open` flipped false while the bytes are on their way, the browser handed
  one download, `done` never set.
- **The one behaviour change.** The done face with no count read _Saved
  `family-library.csv`⏎with to your computer._ — the `{count}` slot as a
  hole in a sentence built around it, which the edges slice's "no `null`,
  `undefined` or `NaN`" assertion could not see. It now reads _Saved
  `family-library.csv` to your computer._ — the clause left out. One
  conditional in the dialog; both arms pinned through `squashed()`.
- **`GET /api/movies` is gone**, with `parseLimit` and its four-leaf block.
  The genre-page glossary held it "for the exporter"; the exporter reads
  `storage.listMovies` on the server. Before the route went, its thirteen
  test-suite readers moved to the repository — `movieTitles(storage, sort)`
  in `routes.test.ts`, four bare reads in `routes.import.test.ts`, the
  delete suite's neighbours check — each asking "what does the library hold
  now", which is the repository's question. The four sort leaves were
  verified against their twins on `/home?sort=`, `/genre/:name` and
  `browse.test.ts` before filing and again before removal; none moved.
  `MovieQuery.limit` stays — `/home`'s rows are capped through it.
- **Tests read by behaviour.** The dialog's two reopening blocks are one,
  on the `Host` harness, with the `rerender` case kept as its last leaf
  because it asserts the one thing the Host cases do not — the reset keys on
  `open`, not on the dialog's own exits. The route suite's per-format
  "header-only" leaves live in the `describe.each` "a library of none", the
  plain BOM leaf in "the BOM through the route and the reader", and the leaf
  about "the intermediate 400 from #137" — a state that existed for one
  commit — is gone. Two `writeSheet` leaves and two mid-file banners stopped
  narrating the slice they arrived in; the top-of-file phase banners stay,
  as round 12 ruled.
- **The docs.** COMPONENT-SPEC's `ExportModal` row is `{ open, onClose }`
  over `Modal` (`bare`), `FormatCard` ×2 and `Button`, and `LibrarySection`'s
  is three rows and the overlay it mounts; `Modal` has `bare` in its table.
  CLAUDE.md's map and README's tree name `writeSheet`, the four dialog units,
  the two `test-support` additions, `types/export.ts`, `Icon/` and `Modal`'s
  flag, and "CSV export to come" is gone from the three places it stood. The
  glossary's two `GET /api/movies` notes are marked resolved by this round,
  **Sheet reader** has its third parameter, **Export dialog** and **Save to
  computer** say what a close mid-request does, **Export ready** has the copy
  without a count, and **Export file** names `fetchExportFile`.

### Deliberately not changed

- **`Modal`'s `bare` stays a boolean.** Two arrangements do not earn the
  `ModalHeader` / `ModalBody` composition; the log and the PRD both file it
  when a third dialog wants a third arrangement.
- **`EXPORT_CONTENT_TYPE` stays in the router.** The wire's own concern; the
  client never reads it. `types/export.ts` holds what both targets read.
- **The prototype's literals stay literal** — the tick circle's
  `rgba(138, 154, 107, 0.16)` has no token, and the `99px` circles are drawn
  with `radius.pill` as everywhere else. Nothing in this round touches a
  styles file.
- **The `COLUMNS` list in the dialog's test stays spelled**, as the writer's
  does: a test that imported `EXPORT_COLUMNS` would prove the pills read the
  constant, not that the constant is the prototype's eight.
- **The cross-feature import stays, and stays the only one.** `LibrarySection`
  → `ExportModal` by path — a section composing a dialog, the log's
  precedent. No hook and no wire crosses.
- **`stubDownload` stays a `test-support` unit** — three callers, the
  folder's own bar — and is recorded in the build entry as the one thing the
  PRD's testing section got wrong.
- **Cancelling an export in flight** stays out of scope; commit 3 pins the
  consequence rather than changing it.

### Follow-ups this refactor surfaced

- **A sketch's names are shapes, not names.** The design log's sketch spelled
  the wire call `exportLibrary`, the build followed it to the letter, and the
  convention it broke was in the folder next door. When a design section
  sketches a signature, check the name against the rung's neighbours before
  it becomes the build's.
- **A copy assertion should read the copy.** The edges slice guarded the
  done sentence against `null`, `undefined` and `NaN` — the right thing to
  guard — and did not read the sentence, so a slot the sample data never
  emptied went unseen. `squashed()` was in the file for exactly this.
- **`routes/index.ts` at ~1450 lines.** This round took ~35 out and added
  none; the routes round is still its own round.
- **A shared listening-API harness and a shared fetch double** — still
  project-wide rounds, still not this one.
- **Node 24 and `\u` in a scratch script.** A `node -e` / scratch-file
  rewrite of a test that contains the literal characters `﻿` in a regex
  found the escape resolved to the BOM character itself under this Node,
  whatever the quoting; the cause was not chased and the workaround was
  `String.fromCharCode(92)`. Not a project concern — nothing shipped is affected — but worth knowing before
  the next scripted edit of a file that spells a BOM.

---

## 2026-09-17 — Export (issues #137–#139)

Five commits across issues #137–#139, three slices against the plan on #136,
built from `docs/design-logs/14-export.md`. **4135 tests pass across 210
files**, up from 3866 across 202. `npm run typecheck` is green and
`eslint src server` is clean on every commit. The smallest initiative since
Delete, and the third slice, #139, driven by `issue-loop`: its forty edge
tests went through the commit gate as a RED commit without `--no-verify` —
and were green on arrival, so the slice has no build commit. What it named,
the first two slices had already built.

**Export is _not_ ticked** in the feature table. The rule holds: ✅ when the
refactor closes, not when the build issues do.

### What shipped

- **`server/src/import-export/writeSheet/`, the reader's mirror.**
  `writeSheet(movies, format) → Promise<Buffer>` over `exceljs`: pure over
  the list it is given, no storage, no sorting. The header row in the eight
  **Export columns**, one row per movie in the order given, the eight cell
  rules inside it and nowhere else — Year, Director and Rating empty when
  null; Genres, Cast and Subtitles joined with `, `, subtitles in track order;
  Status `Watched` / `In progress` / `Unwatched` off the derived state. The
  CSV arm writes a UTF-8 BOM so Excel opens an `é` as an `é` with no import
  wizard; the `xlsx` arm writes one worksheet and no styling.
- **The Sheet reader amended**, in the same slice because the round trip is
  what proves it: `Status` joins the watched column's synonyms, `Watched` the
  truthy values, `In progress` and `Unwatched` fall through to `false`, and
  the CSV parser strips a BOM. The `watched` header and `yes / true / 1 / ✓`
  still read.
- **Two routes**, nothing new injected: `GET /api/export` → `200 { movieCount }`
  off `storage.countMovies()`, and `GET /api/export/:format` →
  `storage.listMovies({ sort: 'a-z' })` → `writeSheet` → the bytes under the
  format's content type and `Content-Disposition: attachment;
filename="family-library.<format>"`; `400 { error }` for any format that is
  not one of the two. A failing file route answers a status, never a page.
- **`src/types/export.ts`**, read by both build targets: `EXPORT_FORMATS`,
  `EXPORT_COLUMNS`, `EXPORT_FILENAME`, `ExportSummary`.
- **The dialog.** `features/import-export/ExportModal` owning `useExport(open)`
  — `csv` and idle on every open, the **Export summary** fetched fresh, the
  count `null` until it lands and never blocking the export; `FormatCard`, a
  `role="radio"` button on the `StatTile` pattern; `saveToComputer`, an
  object URL on an anchor carrying `download`, clicked and revoked — a DOM
  side effect, so a feature unit and not a `utils/` helper; and the two calls
  in the feature's `api/`. `Modal` gained `bare` for the **Export ready** face
  — no header, no ✕, `title` as the card's `aria-label` — so the done face
  swaps inside the same card and the pop-in runs once. `DownloadIcon` joined
  the Icon primitives.
- **The third row.** `LibrarySection`'s _⬇ Export to CSV_ — the label kept as
  drawn though the dialog offers Excel (log Q15) — opening an overlay rather
  than a route: the page keeps its scroll, focus returns to the row. The
  app's first import of one feature's organism by another; the log's line is
  that a section composing a dialog is fine and a feature importing another's
  hook or wire would not be.
- **The round trip, in both formats and both directions of the README's
  promise**: a library the importer filled, exported and fed back to the
  importer over the same root adds nothing; the same export with one row's
  Year and Genres edited, imported onto a fresh library, yields a movie
  carrying the edited values.

### What arrived that the PRD said would not

The PRD's testing section anticipated no new frontend `test-support/` unit.
Two arrived, and both were needed:

- **`stubDownload`.** jsdom has no object URLs — `URL.createObjectURL` is not
  its own, and Node's underneath refuses a jsdom blob — and an anchor's
  `click()` is a "navigation not implemented" error on the console. A unit
  that hands a blob to the browser through an anchor cannot be observed at
  all without one, and would throw before it was. Used by the
  `saveToComputer`, `useExport` and `ExportModal` suites — three callers, the
  folder's own bar — and shaped on `stubFullscreen`, cleanup included.
- **`fileResponse`** in `fakeResponse`: a `200` carrying a file rather than
  JSON, the one double whose caller reads `blob()`. Its `json()` rejects, so
  a client that parsed a CSV as a document would fail here rather than read
  a header row as one.

### Deliberately not built

- **An error face.** A refused export puts the button back and changes
  nothing else — the Delete dialog's rule; the prototype designs no error
  face and none was invented.
- **A column picker** (the pills are a list, not controls), **Excel styling**
  (a bold header, column widths, frozen panes — "a header row" and no more),
  **a save-location dialog** (the Electron shell's, when it ships), **a
  snackbar on done** (the done face is the confirmation), a Description
  column or the stored paths — the log's ruled-out list, left ruled out.
- **The `ModalHeader` / `ModalBody` composition.** `bare` is a boolean; two
  arrangements do not earn the composition. Filed when a third dialog wants a
  third arrangement, per the log and the PRD.
- **Cancelling an export in flight.** One request, no run; nothing to cancel
  that a browser could recall.

### Follow-ups

The refactor plan, filed as 141 and folding the docs slice 140 in: the one
reading call not named `fetch*`, already aliased to the right name at its one
import; `GET /api/movies`, which the genre-page glossary said to delete "when
export ships" and which nothing but the test suite reads; the done copy's
`{count}` slot rendered as a hole when the summary never landed — the one
behaviour change; `useExport`'s docblock promising to drop an export the code
lands; and test blocks split where the slice boundary was. Nothing wrong;
one name copied from a sketch, one endpoint outlived, one sentence the
prototype's sample data never emptied.

---

## 2026-09-15 — Bulk import refactor (issue #135)

Twenty-nine commits against `docs/refactor-plans/13-bulk-import-refactor.md`
— twenty-two code, seven documents. **3866 tests pass across 202 files**, from
3857 across 199: six type-shape assertions removed, six added for the subtitle
pairing, and nine for the two new `test-support/` units. Every other leaf name
is unchanged — the verbose reporter's list before and after, diffed, shows
exactly those twenty-one lines. `npm run typecheck` is green and
`eslint src server` is clean on every commit. No wire changed.

The round was the second `issue-loop` initiative's, and its debt was the kind
the delete round named at ten times the size: nothing wrong, several things
spelled twice because two slices each needed them and neither saw the other,
two wire calls in the wrong feature, and one byte nobody could see. In the
order the plan took it:

- **The server: one rule spelled once.** `derivedRuntime` moved from
  `routes/` to `playback/` — a function over `Playback` lives where `Playback`
  lives — and the importer, which had carried the same eleven lines with a
  docblock asking for exactly this, now asks it. The three extension lists
  in two folders became `media/fileKinds`, security docblock and all, with
  `isPosterFilename` renamed `isImageFilename` because a backdrop is an image
  the poster slot never sees; the scanner and the walker read it, and one
  `extname`-based `hasExtension` serves all three. The subtitle pairing left
  `routes/index.ts` for `movieFormBody` as `subtitleRows`, answering each row
  as `{ language, stored }` or `{ language, path }` and interpreting neither —
  the edit reads a path as a **Stored path**, the resolve as a **Found file**,
  and the add takes only the stored rows, so **bytes only** holds there. The
  add's subtitle tests passed unchanged, which was the condition the plan set
  for keeping that commit. `ImportField` is a shared type; `filmKey`'s
  separator is `'\0'`, and `grep` calls the importer text again.
- **The frontend: each wire call with its caller.** `dismissProblem` is the
  fourth call to earn `src/api/`, sent by the Review step's _Skip_ and the
  form's _Skip this one_. `fetchProblem` and `resolveProblem` moved to
  `movie-form/api` beside `createMovie` and `updateMovie`, so `movieFormData`
  is a local import and neither feature reaches into the other's wire any
  more. `features/maintainer.styles.ts` holds the header row, heading and lede
  the form and the import flow had spelled identically and Settings nearly so,
  and the captioned field the form and the setup step had spelled identically;
  each feature re-exports or extends it. The header, lede and field values
  were read off the rendered `/add`, `/import` and `/settings` in the browser
  afterwards — same pixels.
- **The prototype's own values.** `Button`'s `sm` corner is one shorthand,
  as `md` and `lg` spell theirs; the longhands' premise (that jsdom never
  expands the shorthand) was false, and the test reads `borderRadius`. The
  stepper's dot ink is `colors.bg`. The form's four copy tables are a heading
  chosen by the job and a Save pair chosen by the context. Five files stopped
  naming the slice that made them true.
- **Tests read by behaviour, doubles written once.** `heldCopy` is the seam
  both import suites had written, forwarding every argument — the route
  suite's copy dropped the cancel signal, which its own test now pins.
  `libraryFixture` copies the importer's fixture under a sandbox for both.
  The two `no-row` blocks joined the blocks they belong to, and the
  `expectTypeOf` block whose `expect`s compared literals to themselves went.

### Decisions taken inside the plan

- **`subtitleRows` answers a discriminated union, not `{ stored?, path? }`.**
  The plan spelled the row with two optional fields; a union of two required
  ones says the same thing and lets the resolve's map be a one-line
  `'stored' in row`, with no `!` or fallback for a row that could be neither.
- **The add filters to `stored` rows rather than trusting the path column
  empty.** `movieFormData` always sends it empty on the add, but "bytes only"
  is a rule about clients this route did not write, and a `subtitlePath` on
  `POST /api/movies` now produces no track rather than a stored path.
- **`libraryFixture` takes the sandbox directory rather than minting one.**
  Both suites already mint a `sandboxRoot` and put a managed directory and a
  scratch folder beside the root; a helper that minted its own would have put
  the root in a second temp directory for no reason.
- **`hasExtension` is `extname`-based for the route's two predicates too.**
  The scanner's spelling, not the route's `endsWith`: a bare dotfile called
  `.png` is now refused rather than passed, which is the stricter reading of
  "what the file is called" and is what the double-extension test was already
  saying.

### What the browser pass reached

The three furniture commits have no automated test, on every pixel round's
footing. After the third, `/add`, `/import` and `/settings` were opened in the
browser and the heading (serif, 30px, 600), the header row (flex, 16px gap,
8px below — Settings' own 6px), the lede (`0 0 28px 58px`, 15px) and the
captioned field (a `label`, 13px/600/0.2px caption, 8px under) read off the
computed styles. Every value matched.

### Deliberately not changed

- **`importRun/` is not extracted**, for the reason the build entry gives and
  the plan's decision document restates.
- **`isUnder` stays lexical.** A symlink under the library root pointing
  outside it would be copied from; tightening it is a behaviour change with
  its own test, and lifting the containment rule into one module both domains
  import is a round that owns both. Filed below.
- **The language pool stays spelled on both sides** — the seven names in
  `MovieFormFiles` and in `detectSubtitleLanguage`, `'English'` in three
  places — until the settings hub's subtitle preference makes it a wire value
  and a runtime import across build targets is taken deliberately.
- **`useMovieForm` keeps its four-way save**, one expression with four
  one-line arms; the copy tables were different because two axes had been
  written out as their product.
- **The phase banners in the test files stay**; what moved was behaviour
  split across two `describe`s by a build boundary.
- **The example dialogue in the glossary** still has the maintainer asking
  for `copyFile`; the **Copy-in** row says what the build chose and why. The
  dialogue is a record of what was said.

### Follow-ups this refactor surfaced

- **A backdrop on a resolved movie.** The problem detail carries
  `files.backdrop`, the form has no backdrop slot, and the resolve route reads
  none — a film the run would have given a backdrop loses it when resolved by
  hand. A behaviour gap for the user to file.
- **`isUnder`'s symlink leniency**, above.
- **A shared listening-API harness.** `routes.test.ts` and
  `routes.import.test.ts` each build an Express app on an ephemeral port with
  their own `servers` array and `afterEach`. A project-wide round, like the
  fetch double the delete plan declined and this one declines again.
- **`routes/index.ts` at ~1430 lines.** This round took the pairing out and
  added nothing; the next cut is a routes round.
- **CLAUDE.md is tracked**, since #110. Two earlier journal entries say it is
  gitignored, and the folder-map commit in this round repeated it before
  `git ls-files` said otherwise — the map landed in the following commit. The
  earlier entries are left as they were written.
- **A lint for control characters in string literals.** The NUL byte is the
  one finding no rule predicts: nothing in the toolchain objected, only
  `grep`. Worth a `no-control-regex`-style rule for literals if one exists.

---

## 2026-09-14 — Bulk import (issues #124–#133)

Seventeen commits across issues #124–#133 over two days, ten slices against
the plan on #123, built from `docs/design-logs/13-bulk-import.md`. **3857
tests pass across 199 files**, up from 3161 across 176. `npm run typecheck` is
green and `eslint src server` is clean on every commit. The largest initiative
so far, and the second driven end to end by `issue-loop`: one fresh subagent
per step, six RED commits through the commit gate without `--no-verify`, and
the loop stopping where it was told to — at 134, the docs slice, which is
folded into the refactor filed as 135.

**Bulk import is _not_ ticked** in the feature table, and neither is the
import progress console. The rule holds: ✅ when the refactor closes, not when
the build issues do.

### What shipped

- **`server/src/import-export/`, the domain CLAUDE.md had given a job to and
  nothing had built.** Four units: `readSheet` (`.xlsx` and `.csv` by
  extension, the first worksheet, headers through a synonym table), `titleKey`
  (pure: the normalised form matching compares, and `titleGuess` for a folder
  with no row), `matchRows` (pure: rows × folder scans → matches, problems by
  kind, unclaimed folders) and `createImporter` — the injected domain, fifth
  router argument after `media`, holding one **Current run** in memory:
  `start`, `current`, `cancel`, `problem`, `resolve`, `dismiss`.
- **Three `media/` units and one method.** `walkLibraryRoot` (a folder holding
  a video is a **Source folder** and is not descended; one holding none is;
  an unreadable one is reported and skipped), `scanMovieFolder` (every video,
  the poster by name over the first image, the backdrop by name only, every
  subtitle with its language), `detectSubtitleLanguage` (the tag table), and
  `Media.copyIn(folder, sourcePath, signal)` — a stream piped under the cancel
  signal rather than `fs.copyFile`, so a 12 GB copy can be stopped partway
  and the folder rolled back.
- **Six routes**: `POST /api/import` (`400 { error, field }` naming the
  **Setup step**'s field, `409` while a run exists), `GET /api/import/current`
  (the snapshot every 500 ms poll reads), `POST …/cancel`, and under
  `…/problems/:id` a `GET` for the **Problem detail**, a `DELETE` for _Skip_
  and a `POST …/resolve` — the one route in the app that accepts a path, and
  only a path under the Current run's root.
- **The screen.** `pages/ImportPage` on `MaintainerLayout`;
  `features/import-export/` with `ImportFlow` owning `useImportRun` and
  rendering one of `ImportSetup`, `ImportProgress` and `ImportReview`; the
  molecules `PhaseStepper`, `StatTile` and `ProblemRow`; the pure
  `importView`; and `components/LogConsole`, the pinned-to-bottom activity
  log. `TextField` gained `mono` and the sheet and folder glyphs; `Button`
  gained `sm` for the review rows.
- **The Settings entry.** `LibrarySection` with its two `ActionRow`s — _Add a
  movie_ and _Import from spreadsheet_ — owning its routes as `SettingsHeader`
  owns its one. No export row until export ships.
- **The Movie form's third job.** **Import context**: `/add?problem=<id>`
  prefilled from the **Sheet row** and the **Source folder**'s **Found
  files**, the accent banner, _Save & continue_ and _Skip this one_; and for
  the soft kind, `/add?movie=<id>&problem=<pid>` — an edit of the movie the
  run already added, closing the problem on save. A **Found file** is the
  third kind of slot after **Stored** and **Picked**, and travels as an
  absolute path the server refuses unless it is under the root.
- **The seed went** in #127, the commit after the two slices that made a
  fixture import stand in for it. Its own journal entry is below.

### Decisions the build took inside the log

- **The domain is four units, not the five the log sketched.** `importRun/`
  — the state machine one run walks — became closures inside
  `createImporter` over the run, the sources map and the abort controller,
  rather than a unit of its own. Pulling it out would pass all three across a
  seam nobody else uses, to be tested through the same `start` → `current`
  walk it is tested through now. The refactor plan rules the same way, with
  the reasoning written there.
- **The Problem detail is not on the snapshot.** What the run knew when it
  filed a problem — the row, the folder, an `ambiguous`'s candidates — sits
  beside the snapshot and is read by `GET …/problems/:id` once, when a form
  opens. A thousand scans on every poll would have been the wire cost of a
  detail one form reads.
- **`ambiguous` prefills the first candidate**, as the log's trade-offs
  accepted; a wrong first guess costs a Remove and a hand-pick.
- **A `no-video` folder holding two videos reports both** and the detail
  guesses neither; the maintainer picks.
- **A cancel resolves once the run has stopped and its folder is gone**, so
  a start after it never races a rollback. The route suite holds one copy
  open to prove it.

### Deliberately not built

- **A backdrop on a resolved movie.** The detail carries `files.backdrop`,
  but the form has no backdrop slot, so a film the run would have given a
  backdrop loses it when resolved by hand. A behaviour gap the prototype does
  not design a slot for; named for the user to file.
- **A chooser for `ambiguous`**, a native folder dialog, SSE, a snackbar for a
  backgrounded run, TMDB or any network, a move — every one ruled out in the
  log and left ruled out.
- **`isUnder` as a real-path check.** The resolve route's containment uses
  `path.relative`, lexically, so a symlink under the library root pointing
  outside it would be copied from. `mediaFilePath` and `containedFolder`
  resolve real paths. A tightening is a behaviour change with its own test,
  and lifting the containment rule into one module both domains import is a
  round that owns both; left, and named on 135.

### Follow-ups

The refactor plan, filed as 135 and folding 134 in: the runtime derivation
spelled twice with a docblock asking for the fold, three extension lists in
two folders, the subtitle pairing spelled twice in `routes/index.ts`, a
literal U+0000 in `filmKey` that makes `grep` call the importer binary, two
wire calls in the wrong feature, the Maintainer's header and field styled
three times, and the two test suites that each wrote the same two doubles.
Nothing wrong; several things spelled twice because two slices each needed
them and neither saw the other.

---

## 2026-09-13 — The seed goes (issue #127)

The promise CLAUDE.md carried since library-core is kept: `server/src/db/seed/`,
its test and `npm run db:seed` are deleted, one commit after the two slices
that made it possible — #125 fills a library from the importer's own fixture,
and #126's already-in-library skip makes a second run over the same sheet add
nothing, which is what lets a fixture import stand in for an idempotent seed.
Filling a dev library is now: run the app, Settings → Import from spreadsheet,
type the paths under `server/src/import-export/createImporter/fixture/`, Start
import.

- **The ten-second MP4 outlived the seed**, as `routes.test.ts`'s docblock
  predicted it would. It is now `server/src/test-support/fixtureVideo/`, a
  unit with its own test, and the playback-read suite imports `FIXTURE_VIDEO`
  and `FIXTURE_DURATION_SECONDS` from it instead of reaching into `db/seed/` by
  path. The importer's fixture videos are hand-made `moov` headers (132 and 122
  minutes of claimed runtime over 128 bytes), deliberately not films, so a dev
  library filled from them renders its posters and runtimes but plays nothing
  — the same as the seed before #85 gave it bytes. A dev who needs a playable
  film adds one through Add Movie.
- **The reserved `__seed__/` prefix is gone from source.** The one remaining
  mention was a path literal in `mediaFilePath.test.ts`'s deep-directory test,
  now an ordinary `Genre/Title (Year)/file.mp4`.
- **No test counts changed by the removal itself**: the seed's own suite went,
  `fixtureVideo`'s two tests came, everything else passes unchanged.

---

## 2026-09-13 — Delete a movie refactor (issue #121)

Thirteen commits against `docs/refactor-plans/12-delete-movie-refactor.md` —
twelve code, one document. **3161 tests pass across 176 files**, the same
count as before the round: no test was added, none removed, and none changed
what it asserts. `npm run typecheck` is green and `eslint src server` is clean
on every commit. No wire changed.

The round was the first `issue-loop` initiative's, and its debt was the kind
four fresh contexts leave rather than the kind a rush does: nothing wrong, a
few things written twice or in build order. In the order the plan took it:

- **One containment rule for both removals of a folder.** `removeFolder`, the
  form's rollback, carried its own inline resolve-and-contain one screen above
  the `containedFolder` the third slice wrote for `removeMovieFolder`. It asks
  the helper now, and keeps its throw — a rollback runs before any row has
  committed, and the log's three-contracts decision (Q17, Q18) is untouched.
  The eleven `removeFolder` / `removeMovieFolder` tests against a real sandbox
  ran unchanged.
- **The prototype's own values in `Modal`.** The icon tile's `12px` and the
  ✕'s `8px` read `radius.md` and `radius.sm`; the scrim and the card write
  `animation: ffFade 0.18s ease` and `animation: ffPop 0.2s ease` by name, as
  `mol.Modal` does, resolved by the `@keyframes` `GlobalStyle` already
  registers. The local `fade` and `pop` and the `keyframes` import are gone.
  Same pixels, same motion — read back from the open dialog in Chrome.
- **One import line** in `useDeleteMovie`, so the hook reads like its siblings.
- **The tests read by behaviour.** `DeleteMovieDialog.test.tsx`'s seven
  top-level blocks are three: the copy (now holding the two "any title" tests),
  the two buttons, and _confirming_ — afterwards, in flight, dismissed
  mid-flight and failure nested under it, the helpers each leaned on hoisted
  above in their existing order. `routes.test.ts` describes
  `DELETE /api/movies/:id` once, the bytes' four tests nested under it as "the
  Movie folder afterwards". The verbose reporter diffed across both commits
  shows the same 22 and 410 leaf names with only their paths moved.
- **The same two rules carried across the older files.** `GlobalStyle` now
  registers `ffSpin`, the one keyframe `tokens.css` had that the code side did
  not. `Menu` pops by name — the one commit that moved pixels, a 4px slide
  becoming the prototype's `scale(0.96)` on all three menus. `PlayerNotice`
  pops and spins by name. `FilterDropdown`'s pill and `ProgressBar`'s
  conditional corner read `radius.pill`.

### Decisions taken inside the plan

- **The routes banner merged with the blocks.** The file marks its sections by
  phase, and the two `DELETE` sections were one behaviour split by a build
  boundary; one describe under two banners would have kept the split in the
  furniture. It reads `12 — Delete movie: the row (issue #116), then the bytes
(issue #117)` now. `createMedia.test.ts`'s banners are left as the plan left
  them.
- **The nested block is "the Movie folder afterwards"** — named for what the
  four tests look at, the glossary's term for it, rather than the phase that
  wrote them.
- **`containedFolder`'s docblock names its two callers** and what each hands
  it: the absolute path `reserveFolder` made, and the first segment of a
  **Stored path**.

### What the browser pass could and could not reach

The Delete dialog, the ⋯ menu, the Filter menu and the player's missing-file
notice were each read back with `getComputedStyle` in Chrome against the dev
server: `ffPop 0.14s` on both menus, `ffPop 0.2s` / `ffFade 0.18s` on the
dialog, `ffPop 0.2s` on the notice's circle, and every `ff*` name from
`tokens.css` present in `document.styleSheets`. The buffering spinner itself
was not seen turning — the seeded films have no bytes on this machine, so the
player never buffers — and `ffSpin` is verified by its registration and the
computed line on `Spinner`, not by eye.

### Deliberately not changed

Everything the plan's decision document names: the hook's rejection as its
API, `Menu` and `Modal`'s separate dismissal contracts, `focusablesIn` in
`Modal.tsx`, the danger tint as a literal, `Skeleton`'s local `pulse`, the
cross-domain import of `mediaFilePath`, and `IconTile` as one element.

### Follow-ups this refactor surfaced

- **"Containment is checked on the resolved path, on both deletions."**
  `createMedia`'s domain docblock still counts two; there have been three
  since `removeMovieFolder` arrived. One word, for whoever next opens the
  file — beside the `PATCH` handler's leftover slice sentence the plan already
  lists.

---

## 2026-09-12 — Delete a movie (issues #114–#120)

Eleven commits across issues #114–#119 in one afternoon, five phases against
the plan on #114, built from `docs/design-logs/12-delete-movie.md`. **3161 tests
pass across 176 files**, up from 3072 across 173. `npm run typecheck` is green
and `eslint src server` is clean on every commit.

**Delete a movie is _not_ ticked** in the feature table. The rule holds: ✅
when the refactor closes, not when the build issues do. The refactor is filed
as 121.

### The first initiative `issue-loop` drove

The four buildable slices (#116–#119) were driven by `issue-loop`, the skill
that landed in `661cab2` the same afternoon: for each slice a fresh subagent ran
`tdd` and committed RED, a second ran `build` and committed GREEN, and the
driver grabbed the next. Nobody was watching between commits; the issue stood
in for every approval the two skills ask for. From the RED commit of #116 to
the GREEN commit of #119 took three hours and twenty minutes, and the loop
stopped where it was told to — at this issue, which binds nothing under `src/`.

Two things worth keeping from that:

- **Every RED commit went through the commit gate.** Four `test:` commits, no
  `--no-verify`. This is what 111 was for — the gate narrows to `app` and
  `server` on a `test:` subject — and the delete-movie initiative is the first
  to have used it from start to finish. The habit the movie-form journal named
  ("ten RED commits, ten `--no-verify`") ended here.
- **What four fresh contexts leave behind is a different shape of debt.** Not
  a rushed handler or a missing test: `removeMovieFolder`'s slice wrote a
  `containedFolder` helper that `removeFolder`, written a fortnight earlier for
  the form's rollback, spells inline one screen above it — and nobody was
  holding the whole file in their head to notice. That, two radius literals,
  and tests grouped by the slice that wrote them are the whole of 121.

### The prototype was amended before a line of code

The prototype's only Delete was a red row wired to `onToggleEditMenu` — it
closed the menu and did nothing — and no confirmation existed anywhere in
`docs/handoff/`. Log 04 had refused to ship that row twice. CLAUDE.md's rule
for the case is "amend the prototype first," and #115 did exactly that, as one
`docs:` commit: `mol.Modal` lifted verbatim from `feat.ExportModal`'s idle
shell, `feat.DeleteMovieDialog` composed on top of it, `danger` added to
`prim.Button`'s enum (its `renderVals` had implemented it all along), and the
row rewired to open the dialog. Nothing in the dialog was designed from
scratch; it is three pieces the prototype already had and had never put
together. The build then translated the amended prototype like any other.

### What shipped

- **`DELETE /api/movies/:id`** → `204`, or the JSON `404` every per-movie
  route sends. **Row first, then bytes, best-effort**: `storage.deleteMovie`
  (the cascade takes genre tags and subtitles), then `media.removeMovieFolder`,
  which swallows its own failure. A locked video — Windows will not unlink a
  file the stream route still has open — leaves a **Stranded folder** and a
  `204`, never a ghost row and a `500`.
- **`Media.removeMovieFolder(storedPath)`** removes the **Movie folder** the
  path's first segment _names_, whether or not the file is still in it.
  Neither existing removal fitted: `openFolder` answers nothing for a missing
  file (right for an edit, wrong here — a hand-deleted video would strand its
  poster and subtitles forever), and `removeFolder` throws (right for a
  rollback, wrong after a commit). Three removals, three stated contracts.
- **`components/Modal`**, the molecule the 🔜 Export dialog will draw on: a
  portal to the document body, mounting only when open, and the whole
  dismissal contract in one place — ✕, Escape and the scrim all call
  `onClose`; focus lands on the card itself so a reflexive Enter does nothing;
  Tab wraps at both ends; focus returns to whatever had it on close. Bespoke
  rather than `<dialog>`, because jsdom cannot drive `showModal()`.
- **`MenuItem.danger`**, the **Danger row** — danger ink, a `.12` tint on
  hover, and the only destructive row in the app. A statement about the row's
  consequence, not a mode: it closes the menu and reports like any other.
- **`DeleteMovieDialog`** with the fixed copy, `useDeleteMovie` going back
  through `useGoBack` on resolution, and `api.deleteMovie` beside `saveRating`
  — one caller, so CLAUDE.md's `api/` rule keeps it with the feature.
  **Gone is gone**: a `204` and a `404` both resolve.
- **`EditMenu`** gained `title` and owns the dialog's open state, because it
  owns the row.

### Decisions the build took inside the log

- **Focus is captured as the card opens, not as it closes.** The ✕ that was
  pressed is gone with the card by the time the close effect runs, and the
  active element by then is the body — so `Modal` records `document.activeElement`
  in the open effect and restores it from the cleanup.
- **Shift+Tab from the card itself wraps to the last focusable.** The card
  holds `tabIndex=-1` and is where focus starts; backwards from there is off
  the top, and the ring closes on its last control.
- **A press inside the card is not a way out.** The scrim's click handler
  compares `target` to `currentTarget`, so a click that bubbles up from a
  button in the card does nothing.
- **The confirm swallows its own rejection.** `useDeleteMovie.deleteMovie`
  rejects on a refused delete; the dialog catches it at the button and does
  nothing else, on the form's precedent: the prototype designs no error state
  on this screen. Dismissing mid-flight does not cancel the request, and a
  success after a dismissal still goes back.
- **`noContentResponse`** joined `fakeResponse`'s doubles for the `204` — a
  real `Response` would throw on reading its empty body, which is why
  `deleteMovie` never reads one.

### Deliberately not built

- **Undo, a snackbar, a trash.** Not designed; the snackbar system is its own
  🔜 feature. "This can’t be undone" is true and stays true.
- **Delete from a card, the browse grid, the player, or a keyboard shortcut.**
  The prototype's only Delete is the detail page's ⋯ menu.
- **A red icon tile.** It would need `dangerSoft` and `dangerLine` tokens the
  prototype does not have; the tile stays the Modal pattern's brand tile.
- **Scroll-locking behind the scrim.** Not in the prototype.
- **Touching the Library root.** Never; the dialog says so.

### Known and deliberately not fixed

- **A Stranded folder is invisible.** Nothing surfaces it; the 🔜 Storage
  section's "space used" is the first place it could. Named in the log's
  trade-offs.
- **The deleted movie's page stays in the forward stack.** Stepping onto it
  lands on `MovieDetail`'s existing `not-found` state, which was written for
  precisely this. Asserted in `MovieDetail.test.tsx`.
- **`Menu` and `Modal` both listen for Escape on the document.** About ten
  lines of overlap; the two contracts differ where it matters (trigger vs.
  previous element, pointerdown-outside vs. scrim-click). Considered for 121
  and left, with the reasoning written there so it is not re-derived.
- **The dev seed is still here.** Delete can now empty a library by hand, but
  the seed's stated expiry is unchanged: the commit that ships **bulk import**
  deletes it.

### Found while writing this, not fixed here

- **Neither folder map knew `features/movie-detail/` existed.** The feature
  has been in the tree since #25, eight initiatives ago, and neither
  CLAUDE.md's map nor README's listed it. Both now do — CLAUDE.md with every
  unit in the folder, the way it lists the player's, because a map that named
  `DeleteMovieDialog` under a folder it had never mentioned would have been
  stranger than the omission; README with the units this initiative added.
- **`routes/index.ts`'s `PATCH` comment still says "this slice is demoable
  on."** Movie-form narration that round two missed because it was scoped to
  `src/`. One line; listed on 121 as out of scope.
- **`FilterDropdown` writes `999px` where `radius.pill` exists.** Same rule as
  121's two radii, different initiative's file. Listed on 121, not taken.

---

## 2026-09-11 — Movie form refactor, round two (issue #113)

Twenty-two commits against `docs/refactor-plans/11b-movie-form-refactor.md` —
eighteen code, four documents. **3072 tests pass across 173 files**, up from
3060 across 169. `npm run typecheck` is green and `eslint src server` is clean
on every commit. No wire changed; no test changed what it asserts.

The round's instruction was the player's: a 1:1 translation of the prototype
into our codebase, using our naming, conventions, patterns and architecture.
What that bought, in the order the plan took it:

- **Three pixels the prototype draws and the code did not.** Every text field
  on the form takes the accent line while it has focus (`feat.MovieForm` is the
  one file in the handoff that declares a `style-focus`, and it declares it
  four times). The Files card is padded `20px`, not `s5`. The language list
  wears `mol.SubtitleRow`'s own smaller face — 8px corner, 5px padding, the
  lighter shadow, 13px items on `8px 12px` — rather than the filter dropdown's
  that `Menu` was built from. All three checked in the browser against the
  prototype's values, plus `Fields` losing a top margin the lede already owned.
- **Two atoms and one piece of furniture.** `primitives/FilePicker/` is the
  dashed "＋ …" box that owns the hidden `<input type="file">` — `FileField`
  composes it empty and the Files card composes it for the ＋ under the rows,
  and the value reset that only the list needed is simply what the atom does.
  `primitives/RemoveButton/` is the ✕ with its name and title built from one
  string. `components/fileRow.styles.ts` is the soft box, the glyph and the
  filename both molecules were drawing character for character, flat beside the
  folders on `layouts/chrome.styles.ts`'s precedent.
- **The maintainer sheet, once.** `layouts/MaintainerLayout/` is the `bg2`
  scroll container and the centred column that the form, Settings and the
  coming import flow each opened with; `AddMoviePage` and `SettingsPage` are
  now the layout around an organism, the way `GenrePage` is. The header row —
  back pill, heading, lede — stays each screen's own, for the reason below.
- **A page back on its rung.** `SettingsPage` had a 91-line styles file and a
  `useNavigate`. The header, the ＋ and the lede are
  `features/settings/SettingsHeader/` now, in the folder COMPONENT-SPEC already
  names for the settings shell; the page is composition only and its styles
  file is gone.
- **Two small folds.** `pickedFile` beside `storedFile` in `formValues/`, called
  three times from the hook; one `sendMovie` behind `createMovie` and
  `updateMovie`, parameterised over the verb and the endpoint, which were the
  only two things they disagreed about.
- **Comments that describe the code as it is.** Nine sentences of slice
  narration across five shipping files, the four the plan named in the form's
  test, the placeholder name in `App.test.tsx`, and the deletion of
  `AddMoviePage.test.tsx`'s "no longer echoes the placeholder's copy" — a test
  that asserted the absence of words no shipping file has held since the stub
  went, and so could not fail.
- **The form's test file read by behaviour.** 2143 lines, 22 top-level blocks in
  build order and helpers introduced at the line their slice reached, became the
  same 129 tests under **eight** blocks — the fields, the chips, the rating
  picker, the Files card, the save gate, saving, the actions row, the Edit
  context — with every helper at the top. The five save-gate blocks are one; the
  six saving blocks are one with a nested block per kind of value. The verbose
  reporter diffed across the two commits shows the same 129 leaf names with
  only their paths moved.

### Where the twelve new tests came from

`FilePicker` 6 (three moved off `FileField`, two of its own about the label and
the accept list, one new: the same file picked twice in a row). `RemoveButton` 5. `MaintainerLayout` 3. `pickedFile` 1. `SettingsPage` 1, with its five moved
unchanged to `SettingsHeader`. `FileField` 15 → 12 and `AddMoviePage` 2 → 1.
Net +12.

### Decisions taken inside the plan

- **Which of `FileField`'s picker tests moved.** The three about the input's
  own behaviour — that it is a file input, that it reports the `File`, that a
  dismissed dialog says nothing. The two about the caption and the accept list
  stayed, because they are the molecule handing its props through, and the atom
  has its own two beside them.
- **`Filled` is the furniture's `Row` re-exported under the slot's own name**,
  not an empty `styled(Row)` extension. `GenreLayout` re-exports `Root` and
  `Body` the same way; an extension with nothing in it is ceremony.
- **`RemoveButton`'s one prop is `removes`.** It is the thing the press takes
  away, and both the accessible name and the title are `Remove ${removes}`.
- **`MaintainerLayout`'s width is asserted through `getComputedStyle`.** The
  plan said the pixel commits have no automated test, and they have none; the
  width is a prop, and `FilterDropdown.test.tsx` already reads a `minWidth` back
  for the same reason — a geometry value the caller chooses is the one kind of
  style worth reading.
- **Two more comments than the plan listed were rewritten in the form's test.**
  "The gate arrived in halves" inside the gate's own test, and four in-body
  sentences that said "this slice", surfaced by the regrouping. Comments, not
  assertions; the count did not move.
- **`SettingsPage` keeps one test** — that it composes the header in the sheet —
  rather than none, so the page's one composition decision has a reader.

### Deliberately not changed

- **The header row stays out of the layout.** The prototype draws the three
  maintainer sheets a few pixels apart — 780 against 760 for the column, 6px
  against 8px under the header row, 30px against 28px under the lede — and the
  form's heading is its own hook's state. Both are settled by a prototype
  amendment and a provider decision, not by a 1:1 round.
- **`TextField.styles.ts`'s own `IconSlot`.** A primitive does not import from
  `components/`, and one block is not a second furniture file.
- **The two recorded deviations** — `radius.md` over the prototype's inline
  `10px`, and `Textarea` without `minHeight` — and the browser focus ring beside
  the new accent border.
- **The `Textarea` gets no focus border**, because `prim.Textarea` declares
  none and the form's prototype declares it only on its four inputs. A 1:1
  translation carries the omission.

### Follow-ups this refactor surfaced

- **One sheet, three prototypes.** `page.SettingsPage`, `feat.MovieForm` and
  `feat.ImportFlow` disagree by 20px in one place and 2px in two. To raise in
  the settings shell's grill-me; when the prototype is amended to one sheet,
  the header row becomes `MaintainerLayout`'s with a `heading` slot the way
  `GenreLayout` already does it, and the form's heading gets there by a
  provider or by being passed up.
- **Does the synopsis box focus like the fields above it?** Almost certainly a
  prototype oversight rather than a decision; one line in the same grill.
- **`IconButton`'s glyph is 18 where the prototype's formula gives 20** at
  42px, on every back pill in the app alike. For a round that owns the
  primitive.

---

## 2026-09-10 — The Continue Watching flake (issue #112)

The flake #109 found and would not fix. One test, `routes.test.ts`'s "puts the
film at the front of Continue Watching, and finishing takes it off", posting two
resume positions back to back and asserting the order that came back.

`last_watched_at` is an ISO string, so the two calls could land in the same
millisecond. When they did, `last-watched` fell through to its tail —
`created_at DESC, m.id` — where the two films tied _again_ on a creation instant
they also shared, because the same test added both. `m.id` is a `randomUUID()`.
So about one run in twenty the shelf's order was settled by a coin toss between
two random strings.

**The fix is in the test, not the shelf.** The ordering rule is right: a family
cannot watch two films in the same millisecond, and the rule that says the most
recent comes first is the rule the feature means. What was wrong is a test that
did not control its own inputs.

`clockMovesOn` waits until the millisecond is over — not for a guessed sleep —
between the two posts. That reads as the scenario rather than as a workaround,
because it _is_ the scenario: the family watched one film and then, later,
another.

### The thing worth carrying forward

**This project already knew about this failure mode and had written it down.**
`server/src/test-support/seedByAge/` exists for exactly it, and its docblock says
so in as many words: "seed a library any other way and every `recently-added`
assertion in the suite becomes a coin toss between rows that share a timestamp."
It solves it with fake timers.

A route test cannot use that solution — the stamp has to be written by the
request, and fake timers would stop the listener the request travels over — so
the one test that had to use a real clock quietly opted out of the discipline
without anybody noticing it had. The other multi-film order assertions in
`routes.test.ts` all set `lastWatchedAt` explicitly and were never at risk.

So the lesson is not "watch out for timestamp ties", which was already recorded.
It is that **a shared helper stating a rule does not protect the cases that
cannot call it**, and those are exactly the cases that need the rule spelled out
locally. `clockMovesOn` carries `seedByAge`'s paragraph for the one place
`seedByAge` cannot reach.

Verified 20 consecutive single-file runs and 8 under the parallel load the flake
actually preferred. No production code changed.

---

## 2026-09-10 — The two process debts (issues #110, #111)

The follow-ups #109 filed, taken in the same session. Neither is a feature; both
are about the machinery the features are built with, and both had already cost
something real.

### #110 — the workflow is version-controlled now

`.gitignore` ignored `.claude/` wholesale, which took the project's own
instructions with it. **Decided: track `CLAUDE.md`, `skills/`, `hooks/` and
`settings.json`; keep `settings.local.json` and `scheduled_tasks.lock` out.** The
reasoning is written into `.gitignore` beside the rule rather than only here, so
it is next to the thing it explains.

The argument that settled it is README's own. Lines 56, 70 and 143 advertise the
skill workflow as part of what this repository is, on a public repository where
none of it was. The cost was concrete twice: an amendment that did not travel
after the player refactor, and #108 having _amend CLAUDE.md_ as a literal
acceptance criterion — the amendment was made, sat on disk, and was not in the
commit, so a fresh clone read the wrong "Movie Import" section for the entire
`movie-form` initiative. Nothing reviews a file git does not see.

Two things found on the way in, both worth knowing:

- **`.claude/hooks/block-dangerous-git.sh` is inert.** No `hooks` block
  references it; the git guardrail is a `permissions.deny` list. It is tracked
  with a header saying so, because on a public repo a script that looks like it
  is guarding the tree and is not is worse than no script at all.
- **Prettier mangled CLAUDE.md the moment it became a tracked file.** lint-staged
  formatted it on the way in, and a `+` continuing a parenthetical at the start of
  a line was read as a list marker and rewritten as `-`, breaking the sentence
  about `utils/` co-location in half. Repaired, and the sentence reworded so
  Prettier and it agree. **This is now a live hazard for every markdown file in
  the repo** — a wrapped line beginning `+`, `-` or a digit-dot is a list to
  Prettier, whatever it was to the author.

### #111 — RED commits no longer need `--no-verify`

A `test:` commit typechecks `tsconfig.app.json` and `tsconfig.server.json`; every
other commit typechecks the whole solution file. Ten consecutive `movie-form`
commits used `--no-verify`, each citing the last as precedent, back to `5c066c3`
in the player initiative — and the gate they skipped is the only one that would
catch a _genuine_ type error in a test file, skipped on exactly the commits that
add test files. That is how `npm run typecheck` stayed red for six commits.

**The gate moved to `commit-msg`.** The issue flagged this as worth checking and
it was: `pre-commit` fires before git has written the message, so
`COMMIT_EDITMSG` there holds the _previous_ commit's. `commit-msg` is the first
hook the message exists for, and aborting from it refuses the commit identically.
No environment variable was needed. `pre-commit` keeps lint-staged.

**The issue's proposed shape did not work as written**, and this is the part
worth carrying forward. It suggested typechecking `src` and `server` but not
`tsconfig.spec.json` — except `tsconfig.server.json` included `server/**/*.ts`,
tests and all, so a RED _server_ test would still have failed the narrowed gate.
Most RED tests in this project are server tests. The fix was structural: the
server's tests moved to `tsconfig.spec.json`, where the frontend's already were.
**The three projects now mean what their names say** — `app` is the frontend's
shipping code, `server` the backend's, `spec` all of the tests — and that was
not true before.

Verified against the real hook rather than argued: a RED `test:` commit went
through with no bypass, a type error in `server/` blocked one, and a type error
in a _test_ file blocked a `feat:` commit. The probe was reverted afterwards.

The decision is a unit with tests, `.husky/commitTypecheck/`, and most of them
are about what must **not** relax the gate: `testing:`, `Test:`, a `test:` in the
body of a refactor commit, a commented-out subject, an empty message. A gate that
relaxes on the strength of a string the committer wrote should be hard to relax
by accident, and the failure direction that costs something is a gate that
quietly stopped running.

**Do not put `--no-verify` back on a RED commit.** It is the habit this exists to
end, and CLAUDE.md now says so where the next session will read it.

---

## 2026-09-10 — Movie form refactor (issue #109)

Fourteen commits against `docs/refactor-plans/11-movie-form-refactor.md`.
**3041 tests pass across 168 files**, up from 2920 across 159. `npm run
typecheck` is green and `eslint src server` is clean on every commit.

`server/src/routes/index.ts` is **1661 → 1186 lines**, back below where the
`movie-form` initiative found it. `POST /api/movies` is 273 → 124 and
`PATCH /api/movies/:id` is 261 → 137. Eight new units under `routes/`, each a
folder with its test and no category barrel: `onlyField`, `optionalYear`,
`optionalText`, `optionalRating`, `isRatingValue`, `uploadKinds`, `readBody`,
`derivedRuntime`, and `movieFormBody` — the shared read the two saves now share.

**Not one of the 288 route tests was edited to describe different behaviour.**
The only edit any of them took was the two composition sites in commit 13, which
now build `createMedia(dir)` themselves because the router's fourth argument
stopped defaulting.

### What the refactor found

- **`readBody` could take the process down.** A rejecting `onFile` was only ever
  answered at busboy's `close`, a later turn of the event loop, so the promise
  spent that turn unhandled — which Node answers by exiting. Through the router
  that throw was always somebody's failed save and the crash it also was had
  nowhere to be seen; it took giving the function its own first test to make it
  visible. Fixed in the same commit, with a second reaction on the same promise.
  The rejection `Promise.all` carries out is unchanged, and so is every status
  code on the wire.

  The general lesson is the one the plan was written on: the eight helpers were
  each _covered_ through 288 route tests and none of them was _examined_. Cover
  and directness are different things, and this is what the difference bought.

- **The refusal order was true by coincidence.** A body wrong in two ways has to
  earn the same sentence whichever save it was sent to, and that held only
  because two handlers had been written in the same sequence with nothing
  anywhere saying so. It is now a describe block of its own in
  `movieFormBody.test.ts`.

### Decisions taken inside the plan

- **`isRatingValue` and `MAX_RATING` got a unit the plan did not name.**
  `optionalRating` needs the scale, and so do `/movies/:id/rating` and
  `parseMinRating`. Duplicating a rule that guards the one write that _erases_ a
  rating was the worse option, and so was importing it out of a folder named
  after one of its callers.
- **`isPosterFilename` and `isSubtitleFilename` are one `uploadKinds/` unit.**
  The plan left the choice open. They are the same rule at two slots with one
  argument for it, and splitting them across two folders would have split the
  reason they exist. They are a security boundary — `/api/images` is
  `express.static` over the media root — so their tests are mostly about what is
  refused, `poster.png.html` first among them.
- **The subtitle assembly stayed in each handler.** The edit's version is a
  strict generalisation of the add's, so sharing it was tempting — and would have
  been a wire change: a POST carrying a `subtitlePath` field, which it currently
  ignores, would have started being honoured. The plan's own rule applied ("if a
  third parameter appears, the extraction is being forced").
- **`useMovieForm` keeps having no test file, and now says why.** Every member of
  `UseMovieFormResult` is something a maintainer presses, and `MovieForm.test.tsx`
  presses all of them across 129 tests. A `renderHook` suite would assert the
  shape of a seam rather than anything observable. The header names the line to
  watch: a second caller, or a branch no press can reach.

### Follow-ups this refactor surfaced

- **`routes.test.ts` has a latent flake, and it is not the one the plan warned
  about.** "puts the film at the front of Continue Watching, and finishing takes
  it off" fails roughly one run in twenty under parallel load: two `postResume`
  calls landing in the same millisecond tie on `last_watched_at`, and the tail
  order (`created_at DESC`, then id) can tie behind it, so the shelf comes back
  in an arbitrary order. It predates this round — it reproduces with the refactor
  stashed — and it is a test that does not control for a tie rather than a bug in
  the shelf. Filed rather than fixed here, because editing one of the 288 was the
  one thing this refactor was not allowed to do. Filed as 112, and fixed
  there the same day.

  The flake the plan _did_ warn about — the subtitle `position` swap from
  `4abca01` — never appeared: `routes.test.ts` ran clean on the subtitle blocks
  across roughly forty runs, including the two five-run checks the plan asked for
  after commits 8 and 10.

- **`deleteMovie` remains built, tested and unreachable.** It belongs to the
  feature that ships delete. The feature table now says so in as many words
  rather than carrying one "Edit / delete a movie" row that was half true.

---

## 2026-09-10 — Movie form: add and edit a movie by hand (issues #98–#107)

Twenty commits across issues #98–#107, seven phases against the plan on #97,
built from `docs/design-logs/11-add-movie.md`. **2920 tests pass across 159
files**, up from 2324 across 144. `npm run typecheck` is green, `eslint src
server` is clean.

The library could not be filled. Nine features had shipped against a database
only `npm run db:seed` could write to, and `addMovie` / `updateMovie` /
`deleteMovie` had been built, transactional and tested since #3 with **no route
and no caller** — the same shape the resume writers were in before the player
came for them. This initiative is the one that reaches them, and it is the first
write in the app that is not a `{ value }` POST against a movie that already
exists.

**Add a movie** and **Edit / delete a movie** are _not_ ticked in the feature
table. That is the rule this project keeps: a feature is ✅ when its refactor
closes, not when its build issues do. Delete is also genuinely not built — see
below.

### The initiative began by admitting three documents were wrong

Unusually, the grill's first job was not designing anything. It was resolving
three documents that disagreed with the prototype and with the shipped code, and
none of them could be left standing:

- **CLAUDE.md described "Movie Import — Two Paths, One Form."** The prototype has
  neither path — no mode tabs, no folder-path field. The container was still
  carrying dead `addMode` / `folderPath` / `scanFolder` state that the extracted
  feature never rendered. Folder-path autofill moved to bulk import, where
  `ImportFlow`'s root-path field actually designs it. **That amendment is this
  issue (#108), which means CLAUDE.md was wrong for the entire build** and every
  slice was built against the design log instead.
- **`01-library-core.md` Q17 had chosen reference-in-place over managed copy**, on
  a 12-TB-no-duplication argument. Everything shipped since assumed the opposite:
  `mediaFilePath`, `/api/images` and the seed's own layout all resolve a stored
  path under the managed media root. The decision had been reversed by code
  rather than by anyone deciding to reverse it. **Reference in place** is retired
  in the glossary rather than deleted, so Q17 stays traceable.
- **`02-browse-grid.md` Q4 had handed TMDB to "Add-movie / bulk-import"** as an
  unowned gap. The prototype's form has no lookup, no match-confirm and no poster
  search. TMDB stays with bulk import, where its argument lives.

The lesson worth keeping: **two of those three were reversed by shipping code
long before anyone wrote the reversal down.** A design log is immutable, so the
only place the contradiction could surface was a grill session that happened to
re-read it.

### One constraint decided the entire feature

**A browser cannot tell you where a file is.** `<input type="file">` yields a
`File` — a name and bytes, never a path. Everything else follows:

- There is no folder-path autofill on this form because there _cannot_ be one.
- Managed copy is not a preference the project re-took; it is the only model a
  form running in Chromium can implement. The 12 TB of duplication log 01 Q17
  was avoiding is accepted, because the alternative is a feature that cannot
  exist until Electron does.
- The save is multipart, streamed with `busboy`, so a 12 GB film never sits in
  memory on either end of the wire.

That single sentence settled the storage question more firmly than two design
logs arguing about it had.

### The bug the tests found, which no acceptance criterion asked about

`POST /api/movies` recorded a subtitle's stored path **when its write resolved**
rather than **when its part arrived**. Two subtitle uploads racing meant two
tracks landing with their `position` values swapped — and `position` is what
`preferredSubtitle` falls back through, so the family would silently get the
wrong default track.

It surfaced as an **intermittent failure of an existing test**, roughly one run
in three, and only after the edit slice's tests were added — zero failures in
five runs before them. It was found in the RED commit (`77e871f`), named there,
and deliberately left for the build (`4abca01`) rather than fixed inside a commit
whose point was that the tests fail. The fix takes the slot at arrival. Five
consecutive runs of `routes.test.ts`, 269/269 each.

Worth naming because the test that caught it was not testing for it. It was a
test about editing, and it perturbed the timing enough to expose an ordering
assumption in adding.

### Ten RED commits, ten `--no-verify`

Every `test:` commit in this initiative bypassed the pre-commit hook, each one
citing the last as precedent, back to `5c066c3` from the previous initiative. The
reason is always the same and always legitimate: **`tsc -b` cannot compile a test
written against a module that does not exist yet**, and stopping at RED is the
whole point of the step. Prettier and ESLint were run by hand over the touched
files each time.

This is now a settled pattern rather than an exception, and it has a cost: the
one gate that would catch a genuine type error in a test file is the one that is
routinely skipped on the commits that add test files. `npm run typecheck` had
already been red for six commits once, during the player initiative, for exactly
this reason. **Worth its own issue: the pre-commit hook could typecheck `src` and
`server` but not `tsconfig.spec.json` on a commit whose subject starts `test:`,
which would keep the gate honest without asking it to compile against the
future.** Filed as 111.

### Where the route layer ended up, and why it is the refactor's headline

`server/src/routes/index.ts` went from **786 lines to 1661** — it doubled. It now
holds twenty module-level helpers, and roughly half of them arrived with this
initiative: `readBody`, `onlyField`, `optionalYear`, `optionalText`,
`optionalRating`, `isPosterFilename`, `isSubtitleFilename`, `derivedRuntime`.

CLAUDE.md says the route layer is "HTTP layer only: parse request, call a domain
module, return response." Multipart parsing, per-column coercion, extension
allow-lists and best-effort runtime derivation are each defensible _at_ the route
— but not all of them in one 1661-line file. The domain seam worked exactly as
designed (`media` is injected, and the route never learns there is a filesystem);
it is the request-parsing half that has no home. That is the headline of the
refactor issue, 109, and its plan is in
`docs/refactor-plans/11-movie-form-refactor.md`.

### Deliberately not built

- **Delete.** "Edit / delete a movie" ships its edit half only. The unlink in
  #106 is the app's only deletion of media and it removes **one superseded file
  at a time**, matched by stored path — it is not a movie delete and must not be
  mistaken for the start of one. `deleteMovie` remains built, tested, and
  unreachable, exactly as `addMovie` was before this initiative.
- **The import context banner**, and the labels that go with it. It belongs to
  the feature that can reach it.
- **TMDB**, folder-path autofill, and the Settings page's grouped sections.
- **A backdrop field.** `backdrop_path` stays null and `MoviePage` falls back to
  the gradient, which is the prototype's own answer.
- **A snackbar**, and any progress surface. The prototype's form has neither, and
  a large-file save currently shows only a disabled button reading "Adding…".
  CLAUDE.md asks for "a visible progress indicator, not a spinner" on large-file
  operations; **the form does not have one, and the prototype does not design
  one.** That gap is real and belongs to whoever revisits the prototype.

### Known and deliberately not fixed

- **`renameFolder` has no unit test of its own.** It is required by the route
  tests — busboy will not reach a part that follows a file until that file is
  consumed, buffering is out at 12 GB, and the PRD rules out a staging area — so
  the folder is reserved from whatever fields had arrived and renamed once the
  title is known. It is exercised only through the route. Named in `03761ca` as
  wanting its own test in the refactor round.
- **`useMovieForm` has no test file**, deliberately. The gate, the label and the
  destination are asserted through `MovieForm`, where a maintainer can press
  them. At 352 lines it is now the largest unit in `src/` with no test of its own.
- **`createApiRouter`'s fourth argument is defaulted rather than required.** The
  route tests compose the router over a real sandbox directory with three
  arguments and want the real domain; `main.ts` passes it explicitly anyway, so
  the composition root still says what the app is made of. A default that exists
  for the tests is a seam pointed the wrong way, and it should be looked at.
- **Two prototype deviations, both recorded where they live.** The non-pill field
  corner is `radius.md` rather than the prototype's inline `10px`, because
  COMPONENT-SPEC §1 says every visual value is a token and 10 is not one.
  `Textarea` ships without the `minHeight` prop the prototype declares, because
  nothing passes a non-default.
- **The save gate grew its second half mid-initiative and made eight existing
  tests false rather than failing.** Seven walk-throughs in `App.test.tsx` and one
  gate test now pick a film before pressing Save. No assertion changed meaning,
  but a test that still passes after the thing it asserts has changed is the
  quietest failure mode this project has.
- **The dev seed is still here.** Its stated expiry is unchanged and is _not_ this
  initiative: the commit that ships **bulk import** is the commit that deletes it.
  Add Movie can now fill the library by hand; bulk import is what makes the seed
  redundant.

### `.claude/CLAUDE.md` is gitignored, and this is the second time it has bitten

The previous journal entry flagged it as a follow-up. This issue is the one that
had to amend CLAUDE.md as an acceptance criterion — so **the amendment exists on
disk and is not in the commit**, and a fresh clone still reads "Movie Import —
Two Paths, One Form". The file is the project's own instructions to Claude, it is
cited by every skill in `.claude/skills/`, and it was demonstrably wrong for an
entire initiative without anything being able to catch it. This now wants a
decision rather than a note, and is filed as 110.

### Found while writing this, not fixed here

README's **Component Architecture** section is stale in two ways: it describes a
"four-file shape" with a per-component `index.ts`, which CLAUDE.md's
category-barrel-only rule contradicts and no component in the tree follows; and
its `server/src/` domain list reads "`library/`, `media/`, `import-export/`",
omitting `playback/`, which has been a domain since #83. Both are outside this
issue's acceptance criteria and are listed as out-of-scope on the refactor
issue, 109.

---

## 2026-09-04 — Video player refactor (issue #94)

Twenty-nine commits against the plan in `docs/refactor-plans/10-video-player-refactor.md`,
which found twenty-six things across ten groups. **2299 tests pass across 144 files**, up
from 2181 across 134; `npm run typecheck` is green, `eslint src server` is clean, and
**Built-in video player** and **Watch tracking** are ✅ at last.

The largest thing the biggest build in the project left behind was not a duplication. It
was a **failing gate that reported itself in two commit messages and was carried by six
more commits anyway** — and the reason it could be is that nothing ran the script that
reports it.

### The finding that matters

`npm run typecheck` had been red since issue #87. Two TS2769s, in `PlayerScrubber` and
`VolumeSlider`, both from `useDragScalar` handing back a `RefObject<HTMLElement | null>`
for a styled `div`. The `feat` commits for issues 88 and 89 each say, in their own bodies,
"Two typecheck errors remain in PlayerScrubber and VolumeSlider, both predating this commit
and untouched by it". Then three more commits landed on top.

Nothing was ever going to catch it. `.husky/pre-commit` ran `lint-staged`, and
`.lintstagedrc` runs Prettier and nothing else — no eslint, no `tsc`, no vitest. 2181 green
tests say nothing about a type error, because Vitest does not typecheck.

The fix was a type parameter on the hook, so each slider names the element it actually has
(a cast would have silenced the compiler about something it had correct). The fix that
matters is that `.husky/pre-commit` now runs `tsc -b tsconfig.json`.

**It paid three commits later.** A `614_925_000n` BigInt literal in `mediaDuration`'s new
test does not compile at the server's ES target; the hook stopped it before it landed.

ESLint and the test suite were both considered for the hook and both left out. ESLint is
clean and cheap to run by hand; a fifteen-second suite on every commit is the gate people
route `--no-verify` around, which would take the typecheck down with it.

### What moved

- **Three duplications inside the player.** `percentOf`, byte-identical in two files, is
  `src/utils/toScalarPercent/` with the test CLAUDE.md requires and neither copy had. The
  chrome face of `IconButton`, written out twice with a comment in each pointing at the
  other, is one `ChromeIconButton`. `SKIP_SECONDS` is declared once, in the chrome, where
  the number is written on the buttons' own labels.
- **The read routes got `writeSignal`'s counterpart.** `Unknown movie: <id>` was pasted in
  five routes and `No video file for movie: <id>` in three. Now `movieOr404` and
  `videoFileOr404`, both local to `routes/index.ts` on `writeSignal`'s own recorded
  argument, and `noVideoFile` for the third copy that could not go through the resolver —
  `sendFile`'s failure callback, where the file did resolve and the read failed after.
- **The `Response` fake, in twenty-four files, is in one.** Measured before it was folded:
  `okResponse` had 23 definitions and 22 identical bodies, `serverErrorResponse` 14 and 14,
  `notFoundResponse` 7 with four bodies differing only in the message. So the message is
  the one parameter. `LibraryPage`'s variant builds a whole `HomePayload` and is a
  different thing: it became `homeResponse(rows)`, a thin wrapper over the shared one, and
  was renamed because a factory that means "a home payload" should not be called after the
  status code.
- **`server/src/test-support/` gained two units.** `componentDir` (the fixture
  `ffmpegBinary` and `capabilities` both carried verbatim) and `sandboxRoot`.
- **Four playback modules that nothing named now have tests.** `mediaDuration`, `probe`,
  `ffmpegComponent` and `createPlayback` — 84 tests, and not one of them spawns a binary,
  which is the property CI depends on.
- **`Player.tsx` lost two hooks and 62 lines**, as `useOpeningReads` and `useSubtitles`.

### The rulings, re-taken

- **The temp-directory sandbox, at eight call sites.** #81 declined a shared helper at
  three, because three copies had three ownership models. At eight the measurement comes
  out the other way: five carried one shape and became `sandboxRoot(prefix)`. The other
  three (`db`, `write`, `genre`) mint database _file paths_ in a lazily-created directory
  and their teardown is entangled with closing the connections that hold those files open
  on Windows. They stay, and #81's reasoning still holds for them.
- **File sizes, at 3335 and 1816.** The question was never the number. `routes.test.ts` has
  a real seam — four domains — but it is in `routes/index.ts`, not in its test; splitting
  the test alone would put one unit's tests in four files. `Player.test.tsx`'s candidates
  both drive the same screen through the same harness. The split that was actually
  available in that screen was made in the source instead. Both files now carry the ruling
  in their own header.
- **`useFullscreen`'s unread `fullscreen` goes.** The prototype draws that button with one
  face, unlike the CC pill's two, so there was no pressed state for it to feed — state kept
  against a screen nobody has designed, plus a `fullscreenchange` listener on every player
  mount to maintain it. Its test now asserts `document.fullscreenElement` throughout, which
  is what the rule was always about.
- **`usePlayback` takes an options object**, like every other hook in the feature, and
  `PlaybackSource` collapses into `PlaybackRead` — it restated the same two fields for a
  hook handed the read whole.
- **The volume-persistence effect stays in `Player.tsx`**, and the reason is written where
  it is: the preference is _read_ into `startVolume`, which `usePlayback` needs before it
  can report a volume, and it is that report the effect writes back. A hook could own the
  write but not the read, which is one preference in two files; a hook owning both cannot
  be called before the values it persists exist.

### The prototype and the spec

Four divergences from `docs/handoff/COMPONENT-SPEC.md`, and **all four commits are
docs-only**, because in all four places the code is the half that is right and only the
spec was never told. The spec was written before the player was designed;
`docs/design-logs/10-video-player.md` supersedes it in each.

- ProgressBar is not the scrubber base, and the entry now says why: `overflow: hidden`
  clips a centred knob, a width transition lags a drag, the track colour is wrong over
  film, and a seek bar is a `slider` rather than a `progressbar`.
- The PlayerControls row is the shipped props, with a note recording the composition the
  design log argued for and why each renamed prop is the domain's word.
- `VolumeMuteIcon` → `VolumeMutedIcon`, `CaptionsIcon` → `SubtitlesIcon`, following the
  glossary, where **Subtitles** is canonical and "captions" is an alias to avoid.
- `PlayerNotice`'s one stack where the prototype has two was **settled by looking**, in
  Chrome, both variants side by side at a player-sized frame: caption box 163.42×20 either
  way, same offset from the centre line, same distance down the screen, circle identical.
  Only the stack's own invisible box differs, by exactly the 80px of symmetric padding
  around a centred box. A difference of nothing, and the measurement is on `Stack` so
  nobody re-opens it.

### Follow-ups this round filed

- **95 — the media element is mounted for one frame before the playback read lands.** Both
  flags the guard reads derive from that read, so on the first frame an element really is
  pointed at the stream for a film with no file (404) or one nothing can decode (415). The
  fix is one line in `Player.tsx` and a harness rewrite in `Player.test.tsx`, which takes
  the element on the first render in eighty-two places. The comment now says what the code
  does; the improvement is filed.
- **96 — a conversion that fails to start leaves the buffering notice up forever.** This
  one was pointed at by a comment: "the next slice's error handling is where that is
  caught". No such error handling shipped. ffmpeg exits, no bytes arrive, the element never
  fires `playing`, and the family watches "Getting this film ready…" for the rest of the
  evening. Filed rather than fixed because telling them needs a fifth `PlayerNotice` state,
  and CLAUDE.md's rule is that the prototype is amended first.

### Six comments that outlived their slices

`usePlayback` still called the keyboard "next slice"; `PlayerPage` still said `Player`
would own the chrome "from the next slice"; `mediaDuration` made three claims about a
transcoding path that had since arrived; `Player.tsx` carried a docblock with no
declaration under it, so it read as documentation of the wrong function; and two suites
narrated limitations they now have tests against.

The build narrated itself honestly, phase by phase, and that is worth keeping — but a
sentence about "the next slice" is a claim with an expiry date on it, and nothing expires
it. **The next round should read every "next slice" in the diff before writing it**, or
write "not yet" without saying when.

### What this round is really about

Favorites left six undocumented decisions. Continue Watching left an accrued bill. This
initiative is four times the size of either and left neither — the format policy, the seek
anchoring and the watch coalescing were all decided before a line was written and none
needed revisiting. What it left instead is a **process** finding, and it is the only one of
the twenty-six that changes what the _next_ initiative can get away with.

---

## 2026-09-04 — Built-in video player and watch tracking (issues #83–#93)

Nineteen commits across issues #83–#92, nine phases against the plan on #82,
built from `docs/design-logs/10-video-player.md`. **2181 tests pass across 134
files**, up from 1677 across 104 — the largest single increase the project has
had, and the largest initiative it has run: a fourth backend domain, a frontend
feature with fourteen units in it, three new reads, one new write, four subtitle
parsers, two new `test-support/` doubles, and a seed that now writes files as
well as rows.

The screen that said "Playback for movie a1 lands here" now plays the film.
`setResumePosition` and `markWatched` had existed and been tested since #75 with
**no route and no caller**; the resume shelf, the progress bars and the
in-progress badges were rendering a number only the dev seed could produce. They
have a writer now, which is why the player and watch tracking were one
initiative rather than two.

### The three decisions that were taken before the build and paid off during it

None of these were discovered by building. All three were settled in `grill-me`
or `write-a-prd`, and the build's job was to find out whether they held.

- **The scrubber never asks the element.** `usePlayback` hands back an
  **Absolute position** that is **Stream offset** + element time, and the
  duration comes from the **Playback read**. Because that rule was already in
  place for the _duration_, restart-seeking on a transcode (#90) needed no new
  concept — a drag re-points `video.src` at `?t=`, the offset moves, and the
  scrubber, the subtitle overlay and the watch reporter all keep reading one
  number. **Not one of the three changed in that slice.** That is what a
  decision taken early buys.
- **Absent is a state, not an error.** With no FFmpeg resolvable at all, an MP4
  still direct-plays, everything else answers `cannot-play`, and `capabilities`
  reports Chromium's native set alone. CI is a machine with no FFmpeg on it and
  the whole suite passes there, which is the same property stated twice.
- **Cues are stamped in absolute position.** A native `<track>` is timed against
  _element_ time, so every transcode seek would desync it by exactly the seek
  distance. Parsing server-side into one `{ start, end, text }[]` and rendering
  it ourselves made that failure mode unreachable rather than fixed.

### Four modules the design log did not name

The backend design listed `ffmpegBinary`, `probe`, `choosePlaybackPath`,
`streamMovie`, `capabilities` and the parsers. What shipped has four more, each
for a reason found while building:

- **`createPlayback`** is the injection seam. `streamMovie` as designed would
  have put the spawn in the route's reach; instead `stream()` answers a **plan**
  — send this file, pipe this conversion, 415, or 416 — and the route never
  learns there is an FFmpeg. Every converting arm in `routes.test.ts` is
  exercised through a fake, and no test spawns a binary.
- **`ffmpegComponent`** is what `main.ts` hands over: the domain's view of what
  this machine can be asked to do, rather than which binaries do it.
- **`mediaFilePath`** is the under-media-root check, stated on the _resolved_
  path so a directory symlink that leaves the tree is refused too.
- **`mediaDuration`** was not foreseen at all. The playback read has to answer a
  duration for a direct-play film on a machine with no FFmpeg — which is the
  supported configuration, so "ask ffprobe" is not available. It reads the MP4's
  own `moov`/`mvhd` box. A 32-bit duration of all ones is the container saying
  it does not know, which is not a film that runs for 49 days.

### What the build decided that nothing had ruled on

Recorded here because they are product decisions taken mid-build, not
implementation details:

- **`.sub` is MicroDVD** — frame-based, fps from a leading `{1}{1}rate` record,
  defaulting to 23.976, `|` as the line break. Neither the PRD nor the design log
  pinned the dialect down, and `.sub` names more than one thing.
- **A subtitle file that will not parse answers `200 []`**, not a 404. The row
  was there and the file was there, so there is nothing missing to report; the
  film plays on with no subtitles, and a malformed `.ass` stays distinguishable
  from a deleted one.
- **A present file whose length nothing can determine answers `cannot-play`**,
  not 404. The duration is what a seek clamps against and what the finish
  threshold is a fraction of, so a read with no duration has no playable film. A
  missing file is still a 404.
- **`h264` is listed once in `capabilities`, as native**, though both Chromium
  and the component decode it. Two rows would be two rows for one format, and
  reporting it via-component would cost a transcode that Direct play never
  needed.

### Three tests that were corrected rather than implemented against

Worth naming, because "the test is wrong" is the claim that most needs
justifying in writing:

- **`useWatchReporter`'s coalescing arithmetic.** A test named for the ≥5s tick
  threshold expected ticks at 30/33/36/39 to write `[30, 39]`. Under the rule the
  test is named for they write `[30, 36]` — 36 has already moved six seconds from
  the 30 that was _stored_, and the threshold is measured against the last write
  rather than the last tick. The expectation changed; the rule did not.
- **`SubtitleOverlay` used `toBeEmptyDOMElement`**, a jest-dom matcher this repo
  does not install and has no setup file for. Same claim, restated as
  `container.innerHTML`.
- **`PlayerControls`' "draws no CC pill … later slices"** was Phase 4's guard
  against building Phase 6 early. Phase 6 is that slice, so the guard was removed
  and the CC-pill suite asserts the same surface positively.

`Player.test.tsx` also gained a `localStorage.clear()` per test in Phase 8. Once
the volume genuinely persists, a Phase 4 test that drags the slider to a half and
mutes leaves that standing for every later test in the file. No assertion was
weakened — it is isolation for a resource the suite had not shared before.

### The seed had to stop being a lie

The seed's own doc comment said nothing on disk backs its paths, "which is fine
because nothing plays a seed movie" — a sentence this initiative makes false.
Without a file, every seeded movie renders the `missing-file` notice and the
player becomes the one feature in the app that cannot be checked by looking at
it, which is the exact failure the seed exists to prevent. Ten seconds of colour
bars, H.264 in an MP4, **23KB checked in**, copied under the reserved prefix for
every fixture. Prefix-scoped and idempotent on disk exactly as it already was in
the database, and deleted with the seed when bulk import ships.

Pointing `FAMILYFLIX_MEDIA_PATH` at a real folder of the family's films stays
the only way to exercise remux and transcode against actual MKVs.

### Known and deliberately not fixed

- **`npm run typecheck` has been red since issue #86** — two TS2769s in
  `PlayerScrubber` and `VolumeSlider`, from `useDragScalar` typing its track as
  `RefObject<HTMLElement | null>` against a styled `div`. It was noticed in
  Phase 6, said so in that commit and the next, and **shipped four more times
  after that**. Nothing else catches it: Vitest does not typecheck and ESLint is
  clean, so 2181 green tests say nothing about it. Filed as **94**, along with
  the separate question of whether `typecheck` belongs in the pre-commit hook —
  the mechanism that let it ride is that no gate ran it.
- **The read routes never got `writeSignal`'s counterpart.** The
  `getMovie`-then-404 preamble is written five times in `routes/index.ts` and
  the video-file-then-404 pair three times, all but two of them this build's.
  Also 94.
- **`capabilities` has no route, no `main.ts` wiring and no UI.** Deliberate:
  the mechanism belongs with the format policy, the screen that renders it is
  the Settings initiative's. It is the one thing in the repo built ahead of its
  consumer, and it is covered by ten tests so that the consumer finds it working
  rather than plausible.
- **Hardware encoding is selected but not tested for.** `choosePlaybackPath`
  asks the component what encoder it reports and uses it; whether a given machine
  has one is not something a test can pin, so what is covered is the _selection_,
  given an answer.
- **The dev seed's `lastWatchedAt` stamps are still absolute dates**, carried
  forward from #81 unchanged. Now that the player writes real positions, the
  seeded ones are the ones that will read as wrong first.

### An initiative this size left one defect, and it was one nothing was watching for

Favorites left six undocumented decisions; Continue Watching left an accrued bill
and four comments doing a compiler's job; both were preceded by a `grill-me` that
answered the hard questions first, and both refactor rounds were mostly
scaffolding. This one is four times the size of either and the pattern held —
the format policy, the seek anchoring and the watch coalescing were all decided
before a line was written, and none of the three needed revisiting.

What it did leave is worth more than the tidy findings: **a failing typecheck,
reported honestly in two commit messages and then carried by four more.** Saying
it in a commit body is not the same as a gate refusing the commit, and this is
the first time the project has produced enough commits in a row for that
difference to show.

---

## 2026-08-30 — Continue Watching refactor (issues #80, #81)

Fourteen commits in five groups against
`docs/refactor-plans/09-continue-watching-refactor.md`, with issue 80 folded in
as Group A exactly as 80 asked in writing. **1677 tests pass across 104 files**,
up from 1644 across 98 — every one of the 33 new tests belongs to a helper that
moved onto a test-support rung, and not one existing assertion changed.

Nothing here changes a rendered pixel, an HTTP contract, a stored value, or a
SQL result. No frontend shipping file changed at all, exactly as the build
didn't. Two backend shipping files changed, both in Group C, and both only in
how a SQL string is built rather than in what it produces.

### The bill that had been accruing since #15

`Movie` gained a required `lastWatchedAt` in issue #76, and **sixteen frontend
test files stopped type-checking in the same commit** — each carrying its own
23-field `makeMovie` literal, each needing the identical one-line edit.

It arrived not because #76 was careless but because `Movie` had not gained a
field since the type was split out in #15, so nothing had ever tested what a
change to the library's central record costs. The answer was sixteen edits. Add
Movie, bulk import and the player each add fields to this record, so the same
bill was going to arrive three more times.

Measured before it was fixed: twelve of the sixteen were byte-for-byte
identical, and the other four differed **only in what specimen the file wanted**
— never in the record's shape. That is what an override factory is for. One
`src/test-support/makeMovie/` now holds the shape; the four specimens live at
their call sites as thin local wrappers named for what they build
(`makeStartedMovie`, `makeNorthwind`, `makeQuietHarbor`). The builder never grew
a parameter per specimen, because that would be the same duplication wearing a
different hat.

**The same measurement then found four more, one rung down.** `CardCarousel`,
`GenreRow`, `LibraryGrid` and `FavoritesRow` all build `PosterCardMovie`, three
of them from a byte-identical literal — so `makePosterCardMovie` joined the rung
on the same argument. `ContinueRow`'s `ContinueCardMovie` builder stayed put: one
caller is not duplication, and moving it would be the mirror of the `api/` rule
this codebase already follows.

### The server had the same problem, worse, with nowhere to put the answer

Seven backend test files opened with a **byte-identical forty-line preamble** —
`Closeable`, `closeables`, `track`, `freshStorage`, an `afterEach` teardown, and
a `newMovie` builder — and two of them additionally shared `seedByAge` and
`seedGenre`. The frontend has had a `test-support/` rung since #54. `server/src/`
had none, so the duplication had nowhere to go and was copied file by file.

`server/src/test-support/` is a **documented boundary amendment**, argued in the
plan and landed as a docs-only commit before any code moved. CLAUDE.md keeps
`server/src/` deliberately closed to catch-all folders — but that rule is about
_backend logic_ having a domain home, and test doubles are not backend logic.
They are the category the frontend already gave its own rung and its own
one-line rule.

**No invoice had been delivered on the server yet.** `NewMovie`'s new field was
optional, so nothing broke. The next one might not be.

Two things the move taught, neither of them guessed:

- **A module-scope `afterEach` inside an imported helper registers per importing
  file.** This was verified with a throwaway two-file probe before the harness
  was written, rather than assumed: under Vitest's default isolation each test
  file gets its own module registry, so each gets its own `closeables` array and
  its own teardown. `freshStorage.test.ts` pins it permanently.
- **Splitting one `afterEach` into two exposed an ordering rule.** Vitest runs
  `afterEach` hooks in **reverse** registration order, so a file's own hook runs
  _before_ an imported one — and Windows will not delete a directory holding an
  open database file. `write` and `genre` went red immediately. The harness now
  exports `closeTracked()` for exactly that case. Found by the suite, not by
  reading.

### Four comments doing a compiler's job

The build left four places where a comment held a guarantee the code could hold
itself. All four are now the code's.

- `last-watched`'s `ORDER BY` tail was `recently-added`'s body copied character
  for character, with a comment promising the two stay identical. It is composed
  from the same named constant now, so editing `recently-added`'s tiebreak can
  no longer silently break the unstamped-library guarantee while the comment
  goes on claiming otherwise.
- **"Started but not finished" was written twice in SQL** — the `inProgressOnly`
  `WHERE` term and the middle rank of `unwatched-first` — for the rule the
  Continue Watching row is _defined_ by. One `IN_PROGRESS` constant now. Its
  TypeScript twin `deriveStatus` deliberately did **not** merge: same rule, two
  languages, two jobs, and merging them would put SQL text and TypeScript
  branching in one module. They got a cross-reference instead.
- `home.ts` argued the pinned-order asymmetry in three near-identical paragraphs.
  The inline note at the `listSection` call pair stays — that is where a reader
  meets the two disagreeing arguments — and the other two are pointers at it.
- **Two tests asserted something other than what their names said**, and #78
  papered over both with a six-line caveat rather than renaming them. A test
  whose name has to be corrected by a comment is a test nobody trusts at a
  glance. Renamed; caveats deleted along with the need for them.

### The three conditional commits, and what they decided

The plan made three commits explicitly conditional with a stated escape hatch,
because _a duplication nobody has ruled on gets copied a third time by default_.
All three were measured rather than eyeballed.

- **The five view-model builders (A6): folded, four of five.** Covered above.
- **`tempDbPath` (B7): not moved.** The plan called `write`'s and `genre`'s
  copies byte-identical; they are not. `write` memoises one directory and
  returns many random filenames inside it; `genre` creates a fresh directory per
  call and returns a fixed filename; `db.test.ts` has a third shape again on
  `beforeEach`/`afterEach`. Three ownership models, three lifetimes. A shared
  helper would have to invent a fourth shape satisfying all three, which is
  forcing it, so it was dropped as the plan permitted.
- **Splitting `home.test.ts` (D3): not split.** 1339 lines before, **1269**
  after, against `browse.test.ts`'s 972 and `routes.test.ts`'s 1881. It is not an
  outlier, it now has one helper block instead of two 950 lines apart, and the
  plan was explicit: do not split it to hit a number.

### Known and deliberately not fixed

- **The dev seed's `lastWatchedAt` stamps are absolute dates**, written to the
  week they were authored. "The past few weeks" will age into "months ago" and
  eventually into something that reads as wrong. Harmless while nothing renders
  the timestamp — no screen does — and a trap the day something does.
- **`setResumePosition` still has no HTTP seam.** No route, no caller, until the
  player ships. That was #75's decision and this round did not revisit it; adding
  one now re-creates the dead-code shape two previous rounds refused.
- **Whether `markWatched` should preserve the resume position** stays flagged in
  the glossary for the watch-tracking grill. It changes stored values, which is
  the one thing this plan promised not to do.
- **`routes.test.ts`'s twenty-odd local helpers.** 1881 lines with a fixture
  builder per endpoint group — but those build _HTTP libraries_, not records. A
  genuinely different problem, and its own round if it earns one.

### Two features in a row have left almost nothing behind

Favorites left six undocumented decisions; Continue Watching left one accrued
debt and four comments doing a compiler's job. Both builds were preceded by a
`grill-me` that answered the hard questions in advance — nineteen of them here,
before a line was written — and both refactor rounds spent most of their commits
on scaffolding and prose rather than on repairing the feature. That is a result,
not a gap.

---

## 2026-08-29 — Favorites refactor (issue #73)

Nine commits in six groups against
`docs/refactor-plans/08-favorites-refactor.md`, plus a `test:`/`fix:` pair for
the defect the plan found while being written, which went first under its own
issue (74). 1600 tests pass across 97 files, up from 1593 across 96.

**Favorites left very little behind**, and the plan said so in advance rather
than manufacturing work to look substantial. The feature was assembled from a
column, a route, a client call, a query flag, a molecule and a chrome component
that all already existed; the build added one payload section, one component,
one `RowSection` prop and the wiring between them. So most of this refactor is
**decisions written down**, and two of the six groups were explicitly conditional
— one was taken, one was tried and reverted.

Nothing here changes an HTTP contract, a rendered pixel, or a stored value. The
one commit that changes what a component draws is the defect fix, which is why it
is a `fix:` under a different issue and not a group in this plan.

### The suite was green over a blank page

The browse home rendered **zero bytes of HTML** — no shelf, no heading, no
message — when the last movie on the Favorites shelf was un-hearted and the shelf
was the only populated section. The only way back was a reload.

`HomeRows`' empty guard counted the three sections' raw lengths. For two of them
that is right: `ContinueRow` draws a card per movie it was given, so "holds
nothing" and "draws nothing" are the same condition. **For the shelf they are
not.** `useHomeRows` deliberately never removes an un-hearted movie from
`favorites` — that indirection is what gives a refused save a card to put back,
and #71 shipped it on purpose — so a section of nothing but un-hearted movies has
a non-zero length and draws no cards. The guard read a populated library and
skipped all three messages.

Two general facts fall out of it, both larger than this feature:

- **#71's precedent has a cost nobody priced.** "A row whose rendered contents
  are a derived view of hook state" is a good pattern, and it is what makes the
  revert possible. But it silently breaks every other place that treats section
  length as a proxy for section content, and the guard was the only such place at
  the time. The next derived-view row inherits the same trap. The rule now has a
  name — `shelvedFavorites` — and both the row and the guard read it, so the two
  cannot disagree about what is on screen.
- **1593 passing tests are the specification of what was thought of.** Every
  existing test that empties the shelf serves populated genre rows beside it, so
  the guard was never the thing under test at the moment it mattered.

And the way it was found is worth recording: not by reading the diff, but by
asking what the guard's third term actually counts and then **running the case
rather than reasoning about it**. The reasoning alone produced "probably fine —
`favorites` is a favorites-only section". The run produced an empty document.

### What moved

**`saveFavorite` onto the rung built for it.** `src/api/postValue` exists
because of an argument the Ratings refactor made and wrote into its own
docblock — three saves across two features keep one contract, and neither feature
should import the other's wire. The rung was built and only `postValue` moved
onto it; `saveFavorite`, the one of the three actually called from both sides,
stayed in `features/library/api` with a comment in `useMovieDetail` apologising
for reaching across. **The comment was the tell.** An import that has to explain
itself is the one the shared rung was created to retire.

`saveWatched` and `saveRating` did **not** move. They have one caller each and
are correctly placed today; moving them for symmetry would be churn. The rule is
"a second feature asked for it", not "it looks like its siblings".

**The rung itself got written down.** `src/api/`, `src/App/` and
`src/test-support/` were all real, all undocumented, and both README and
CLAUDE.md still described an `src/` of eleven folders where there are fourteen.
A boundary that exists only in the code is one the next author is entitled to
guess at — and Group A doubled `api/`'s population, making it the answer to a
question the next feature will ask.

**One spelling for one concept.** The molecule rung said `onToggleFav` and the
feature rung said `onToggleFavorite`, so two call sites existed mainly to
translate between them. The prototype spells it both ways — `mol.PosterCard` and
COMPONENT-SPEC abbreviate, `page.MoviePage` and `FamilyFlix.dc.html` do not — so
it does not decide this and the glossary does. The 1:1 rule binds the UI surface,
not the prototype's identifiers, and COMPONENT-SPEC's prop table has been
overridden on the same reasoning once before.

**Two growth points closed.** The empty guard now reads over one list of what
the sections draw rather than a term per section in a chain of `&&`; and
`createHome`'s `listContinueWatching` and `listFavorites`, literal twins
differing by one flag key, collapsed into one `listSection(query, flag)`. Both
were places where forgetting to add something produces a visible bug — which is a
different risk from a place where copying two lines produces two correct lines.

**The deferred question, answered where it was asked.** `07-ratings-refactor`
named this feature, by name, as the place to decide whether the browse screens
migrate onto `useOptimisticEdit`. The answer is **no**, and it is written into
both hooks rather than only into a plan: a hook general enough for both would be
parameterised over what it edits _and_ over how it reverts, and neither caller is
asking for that. Unlike the three bargains `07` did merge, the second example
here is not a third copy of the first.

`useOptimisticSave` was also **wrong about itself**. Its docblock claimed `apply`
was `withFavorite` over genre rows _or_ `withFavoriteInList` over a flat grid;
since #71 its busiest caller writes both, into two sections of one payload inside
a single `setData`. The glossary was updated for that when the design log landed
and the hook was not — a reminder that a docblock arguing its own scope is a
thing that goes stale when the scope moves.

### Three copies of two closures, compared and kept

`GenreRow` and `FavoritesRow` build the same item object character for
character, and `LibraryGrid` writes the same two closures straight onto
`PosterCard`'s props:

```
onOpen: () => onOpenMovie?.(movie.id),
onToggleFavorite: () => onToggleFavorite?.(movie.id, !movie.favorite),
```

Three call sites is this project's own threshold for attempting a
generalisation, so it was attempted rather than declined on sight — written,
compiled, and run green — against the two bars the plan set in advance. **It
failed both, and was reverted.**

The helper was `posterCardItems(movies, onOpenMovie?, onToggleFavorite?)`.

- **A bag of optional handlers.** Every call site passed both handlers
  positionally and unlabelled. Nothing at the call site said what the second and
  third arguments were for, and the two rows ended up reading identically to each
  other while saying nothing about what a card can do.
- **It served the third call site by making it pretend to be the other two.**
  `LibraryGrid` has no carousel, and the extraction had it build a
  `PosterCarouselItem` and spread it onto a card. The two shapes share three
  field names by coincidence, not because they are one concept — and after the
  change the grid's JSX no longer named the props the card receives.

So the count that obliged the attempt is not the count that decides the outcome.
The two closures are the most legible lines in all three files — "open me", and
"save the opposite of what I am now" — and a reader who wants to know what a card
raises should not have to open a fourth file to find out. The extraction cost a
module, a test file and three imports to hide six lines that were never unclear.

Recorded here so the next reader is looking at a decision rather than an
oversight. If a fourth shelf arrives, this is the note to re-read — but a fourth
copy is not on its own an argument, since these three were not either.

### Deliberately not changed

- **`TITLE_SIZE` stays duplicated** in `GenreRow` and `FavoritesRow`. Both files
  carry a comment saying the value is passed explicitly because the difference
  between the three headings is specified in the prototype rather than
  incidental. Sharing the constant would overturn a written decision, not tidy an
  oversight.
- **`FavoritesRow`'s narrowing stays.** It reads like something to simplify and
  must not be: it is the only reason a refused save has a card to put back. The
  defect was in the guard, and fixing it by deleting the narrowing would have
  traded a blank screen for a broken revert.
- **`withFavorite` / `withFavoriteInList` stay two.** One concept over two
  shapes, with a docblock that already argues exactly that, and the pair is what
  makes the two-section edit expressible.
- **`Movie.isFavorite` beside `PosterCardMovie.favorite` stays.** Two spellings
  of two different things, both 1:1 with the prototype's `data-props`. Named in
  the plan and now in the glossary so it is visibly a decision and nobody
  "finishes the job" the rename started.
- **`NO_SECTIONS` stays one frozen value.** Held deliberately so a memoised
  consumer keeps its identity.
- **The write path was not reopened.** Route, `writeSignal`, `setFavorite`, the
  column and its partial index — untouched by the build and untouched here.

### Follow-ups this refactor surfaced

- **README's component shape is stale.** It documents a four-file component
  folder with a per-component `index.ts`; CLAUDE.md documents three files and
  only category barrels, and the code follows CLAUDE.md — no unit folder in
  `src/` has an `index.ts`. Found while amending the same section for `api/` and
  left alone, because rewriting a rung's documented shape is not a Favorites
  refactor. It is a docs-only fix and wants its own small issue.
- **`.claude/CLAUDE.md` is still gitignored**, so the `api/` / `App/` /
  `test-support/` amendment and the ✅ tick exist on disk and not in review.
  Open since `03-card-carousel-refactor`, surfaced again here, still a
  repository-policy question rather than a refactor one.
- **`GenreMovies` still prints two `act()` warnings.** They pre-date Favorites,
  the Ratings refactor noted and left them, and they belong to whoever refactors
  the genre screen. The suite is otherwise silent, which is the state `07` left
  it in deliberately.
- **Issue 67 — no route past the 15th favorite — was closed as not-planned** on
  2026-08-29, after the Favorites build entry below was written calling it open.
  The 15-cap's missing route now lives in the glossary's flagged ambiguities and
  nowhere else. A closed issue is not a decision that the gap does not exist; the
  gap wants a grill-me and a prototype amendment, which is exactly what a
  refactor is the wrong instrument for.

---

## 2026-08-29 — Favorites (issues #68–#72)

**The feature was already built.** `is_favorite` and its partial index and
`setFavorite` shipped in `01-library-core`. `POST /api/movies/:id/favorite` and
`saveFavorite` shipped with the browse grid, along with `PosterCard`'s corner
heart, `withFavorite`, `withFavoriteInList` and `useOptimisticSave` wiring it on
both browse screens. The detail page's heart arrived with `useOptimisticEdit` in
`07-ratings`. `RowSection` was written one feature ago carrying a docblock that
named what was coming: _"the prototype has a third of them coming (Favorites,
22px with a leading icon)"_. CLAUDE.md's "mark from card and detail" had been
done for months.

What did not exist was the shelf. Four build issues, #68–#71, each a `test:`
commit stopping at RED and a `feat:` commit taking it green. 1593 tests pass
across 96 files, up from 1531. Plan: `docs/PRDs/08-favorites-plan.md`.

No migration, no schema change, no new route, no new repository primitive, no
new primitive, molecule or util. One payload section, one feature component, one
`RowSection` prop, and the wiring between them. That is the rarest shape a
feature comes in here, and the reason it was possible is the rest of this entry.

### The flag that waited two months for its only caller

This is the thing about this feature worth remembering, and like the last one it
is a process fact rather than a code one.

`favoritesOnly` went onto `MovieQuery` and was honoured by `browse.listMovies`
in `ff0e97c` — `feat: [library-core] issue #4 add browse query layer`, 29 June.
Its first caller anywhere in the app is `home.ts:104`, in `33b7c7b`, 28 August.
**Two months less a day, six initiatives, and nothing ever called it.**

The design log records this as `02-browse-grid`'s doing (`08-favorites.md:20`),
which is where the flag's _type_ moved when `14ddc70` split the types into topic
files, not where the flag was born. Git says library-core. The log is an
immutable snapshot and stays exactly as written; the correction lives here, and
it makes the point larger rather than smaller — the wait was six initiatives,
not five.

**Why it survived instead of rotting.** A branch nobody calls is normally the
definition of dead code, and this one was not, for two reasons worth separating:

- It was **honoured and tested from the day it landed**. `browse.listMovies`
  applied it, and `curation.test.ts` has asserted the `favoritesOnly` set since
  library-core — a movie entering it when hearted, leaving it when cleared. So
  it was an uncalled branch with a specification, not an unexercised one.
- It was **built for a named future caller**, and the name was right. The row it
  was put there for is the row that eventually called it.

**Why it is still the pattern to watch for.** A flag with no call site is a
design guess that nothing can check. This one happened to be correct, and the
way we know it was correct is that #68 needed one function of four lines to cash
it in — `listFavorites`, the structural twin of `listContinueWatching`, the
caller's whole query spread first and then the flag. Had the guess been wrong,
nothing would have failed for two months; it would simply have been rewritten at
first use, and the two months of carrying it would have bought nothing.

So the rule this suggests is not "never build ahead of the caller". It is that
**building ahead is only free when the thing built is small, tested, and named
for the caller it is waiting on** — all three, not two of them. `RowSection`'s
icon slot passed the same test one feature later and cost one prop.

### What shipped

**One section on an aggregate that was built to take one** (#68). `HomePayload`
gains `favorites: Movie[]`, declared `continueWatching, favorites, rows` — the
order the screen renders them in. Named sections were chosen back in
`02-browse-grid` precisely so a section could join without disturbing the ones
already there, and this is the first time that is cashed in. `GET /api/home`
already forwarded the whole **Library query** and serialised what came back, so
it served the new section unchanged: the only edit to the route was a comment,
recording that the shelf rides this wire rather than an `/api/favorites` of its
own. Five frontend fixtures gained `favorites: []` to keep `tsc` clean — a type
ripple, not feature work.

The invariant that made it a four-line function is `getHome`'s own: spread the
caller's query first, then add only what makes this section that section. The
shelf obeys the search box, the genre dropdown, the rating pill and the sort for
the same reason the continue row does, and neither had to be taught to.

**The shelf** (#69). `FavoritesRow` is `RowSection` at 22px — a genre row's
size, not Continue Watching's 24 — around a poster `CardCarousel`, rendering
`null` when handed nothing. No "View all": the prototype's section has no
trailing action and `docs/handoff/` has no Favorites page behind one.
`useHomeRows` maps the section through the same `view()` a genre row's movies go
through rather than a mapper of its own, and `NO_SECTIONS` stayed one frozen
value with a third empty array on it, so a memoised consumer keeps its identity
across a render with nothing new in it. All three sections still come out of the
one `fetchHomePayload`, so the screen keeps its single ready transition.

`HomeRows`' empty-library guard gained its third term in the same commit. A
**watched, untagged** favorite earns no genre row and no resume tile, so without
it the screen would have printed "Your library is empty" directly above a
populated shelf.

**The heart in the heading** (#70). `RowSection` gains one optional `icon` prop,
dropped into the heading ahead of the title and coloured by nobody; `Title`
becomes inline-flex with a 10px gap, inline-level so `Header` keeps a baseline
for a genre row's "View all" to sit on. The accent lives in
`FavoritesRow.styles.ts` for `currentColor` to pick up, along with the
prototype's 2px optical nudge. `RowSection` references no hearts, no favorites
and no accent anywhere, docblocks included — the promise its docblock made when
it was extracted, kept at the first opportunity to break it.

**Pruning the shelf** (#71). `FavoritesRow` takes `onToggleFavorite` and hands
back the clicked movie's id with the negated value — the same contract a genre
row's cards already use — and renders `movies.filter((m) => m.favorite)` rather
than everything it is handed. `useHomeRows` applies the flag to both sections
inside one `setData`. Three files, no new hook, no new signature.

### The two precedents #71 set

Both are small, both are about the same click, and the next shelf will follow
them rather than rediscover them.

**One optimistic edit reaching two sections of one payload, in a single
`setData`.** `applyFavorite` runs `withFavorite` over the rows _and_
`withFavoriteInList` over the favorites in one update, so the shelf card and
every genre card of one film move on the same render. Two cards of one film
telling a parent different things is not a state we ship, and "the same render"
is the only version of that guarantee worth having — one behind the other is
still a frame in which they disagree. `useOptimisticSave` is called exactly as
before; nothing about the bargain changed, only how many places `apply` writes.

**A row whose rendered contents are a derived view of hook state.** The hook
never removes a movie. An un-favorited film stays in the `favorites` section with
its flag false, and the row filters it out on render. That indirection is what
makes the revert possible: `useOptimisticSave` puts the old value back by
flipping the flag, and a movie spliced out of state has nothing to flip. So the
card leaves the shelf the instant the heart empties — a shelf called Favorites
holding a non-favorite is a lie — and comes back if the save is refused.

It is worth naming because it reads backwards. A list called `favorites`, then
filtered for favorites, looks like something to simplify away, and the empty
guard reads the _filtered_ list for the same reason — a shelf handed only
non-favorites renders nothing rather than a heading over an empty carousel.
Anyone who deletes the filter will find every test still green except the
refused-save ones, which is exactly the shape of a change that gets merged.

### Worth naming

**The heading was naming itself out of its own children, and the heart leaked
into it.** #70's RED tests pinned the region's accessible name using a mark that
carried visible text, and six of them failed on the leaked glyph. The heading
now names itself from `title` via `aria-label` rather than from its content.
Callers are still asked for a hidden mark — `HeartIcon` with no `title` renders
`aria-hidden` — but the guarantee no longer rests on their remembering to, and
the label repeats the visible text exactly so voice control still matches the
words on screen. The alternative, an id-bearing span around the title text, is
ruled out by the test asserting the heading has no element child when no icon is
passed.

The general shape: a slot that accepts arbitrary caller content cannot also
derive its name from its content. Adding the slot is what turned a safe pattern
into an unsafe one, and the tests caught it because they were written against a
mark with text in it rather than against the icon that was actually coming.

**A prop named for the issue that would delete it.** #69 shipped the shelf with
its hearts drawn but inert, because `PosterCarouselItem` requires a handler.
Rather than making the prop optional or leaving a bare `() => {}`, the row
passed `NO_TOGGLE`, named for the issue that would replace it. #71 deleted it. A
placeholder that says when it expires is cheap; the version of this that rots is
the anonymous no-op.

**Three tests green on arrival, reported as guards.** #71 landed 22 tests of
which 19 were RED, and the commit says which three were not and why: keyboard
parity on the heart, the optional toggle callback, and no refetch on a toggle.
All three are ACs the issue asks for that earlier work already satisfied —
`PosterCard` has stopped activation keys propagating since it shipped, and
`useBrowseLoad` reloads on the load key alone. Breaking working components to
manufacture a RED would have been a lie about what the phase owed. Same call
Ratings made at #59 and #60, made the same way.

### Deliberately not built

- **A "View all" and a Favorites page behind it.** The prototype has neither,
  and CLAUDE.md's rule is that the prototype is amended in a grill-me first.
  Filed as **67** and still open: past the 15th favorite there is no route in the
  app, and a genre row's identical cap is safe only because "View all" exists.
  Recorded as a prototype gap, not improvised around mid-build.
- **A favorites filter pill, a `/favorites` route, `favoritesOnly` in a Library
  query.** Favorites is a shelf, not a filter. The flag exists on the
  repository's `MovieQuery` only, where `getHome` sets it — nothing a URL can ask
  for.
- **A `/api/favorites` endpoint.** A second request for one screen is what
  `/home` was built to avoid.
- **A Favorites skeleton.** `LoadingRows`' three skeleton sections already stand
  in for the whole body, and the prototype has no favorites-shaped placeholder.
- **Per-person favorites.** One shared household profile, permanently.
- **Any cross-screen store.** A heart set on one screen reaches the others on
  their next load, as it already did.

### The row this feature did not tick

Favorites stays **🔜 Planned** in both feature lists. The standing rule is that a
feature is Done after steps 7–8 of the workflow — `request-refactor-plan` →
`refactor` — not when its build issues close; `813b546` reverted exactly such a
premature tick on Search + Filter, and the genre page and Ratings both waited the
same way. The refactor issue is filed as **73**, and the tick is its last commit.

Issue 67 does not block that tick. It is a prototype amendment rather than a
refactor, and the plan for 73 says so explicitly so that neither swallows the
other.

The glossary needed no rewriting here. **Favorites row**, **Home section** and
**Row section** were added and **Favorite** and **Home payload** amended when the
design log landed, ahead of the build, and what shipped matches them — including
the two entries that are easiest to drift: the **Optimistic save** entry that now
describes one edit reaching every **Home section** a movie has a card in, and the
flagged ambiguity recording that what the row renders is not what its section
holds. Confirmed rather than rewritten, which is the outcome writing the glossary
first is supposed to produce.

---

## 2026-08-27 — Ratings refactor (issue #65)

Twenty commits in six groups, against
`docs/refactor-plans/07-ratings-refactor.md`. Ratings shipped working and left
behind **the third copy of three different bargains** — the optimistic write, the
wire contract, and the single-signal write route. The plan's argument was that
two examples are not enough to design a generalisation against and three are, so
this cashes that in three times rather than once. All three are written once now.
1511 tests pass, up from 1478.

Nothing here changes an HTTP contract, a rendered pixel, or a stored value. The
1478 existing tests were the specification, and no test file was edited to make a
refactor commit pass — the two that were touched were touched to stop them
printing warnings, before any production code moved.

### The suite was green and noisy, which is worse than it sounds

`vitest run` printed eight `act()` warnings while passing, seven of them this
feature's: four in `RatingPicker.test.tsx`'s `Enter and Space` block, two in
`MovieDetail.test.tsx`'s rating focus tests. One cause for all seven — a raw
`segment(n).focus()` fires the picker's `onFocus`, which sets the **Rating
preview**, which is a React state update outside `act()`. The neighbouring
watched/favorite focus tests do not warn because those buttons have no focus
handler that writes state.

Worth naming as a shape: `@testing-library/user-event` arrived at #60 and the
file uses it correctly in its tab-order tests (`await user.tab()`), then reaches
around it four tests later. **A dependency half-adopted inside one file is the
version of this that is hardest to see**, because the correct idiom is right
there in the same describe block. The fix was the file's own existing `act()`
idiom, not a new one.

This went first so every later group could use "the suite is silent" as its
check rather than "green apart from the known seven". A suite that prints
warnings while passing is a suite where the next real `act()` warning arrives
pre-camouflaged.

`GenreMoviesProvider` still warns twice. It pre-dates Ratings, it is noted in the
commit body that left it, and it belongs to whoever refactors that screen next.

### The favorite route had no tests at all

Not in the plan, found one commit before it mattered. `POST /movies/:id/favorite`
was the only one of the three single-signal writes with **no test at the route
layer** — its two siblings have five each, including the 404-before-write check.
It shipped with the browse shelf's heart in `02-browse-grid` and was never
covered here.

That is the wrong state to be in one commit before all three routes move onto a
shared helper, since "the existing tests are the specification" is the entire
safety argument of this refactor and for that route there were none. Five
characterisation tests went in first, asserting only what the route already did.

**The general shape:** a duplication audit finds missing coverage, because the
thing that makes three copies hard to see — that they are spread across files
nobody reads together — is the same thing that lets one of them go untested. The
sibling routes' tests made the gap look filled.

### What shipped

**One half-star number.** `StarRating` and `RatingPicker` both rounded a percent
to the nearest half star and printed it to one decimal. It was the only
arithmetic in the feature with no test of its own on either side — covered only
through two components' render assertions — and the seam where a rounding change
on one side leaves two controls on the same page disagreeing about what 70% is
called. `src/utils/toStarLabel/` is that rule once, with a table pinning every
half-star point and the ties between them. Both components' rendered output is
byte-identical and neither's tests changed.

**One optimistic bargain** (closes 64). `useOptimisticEdit(movie, editMovie)`
returns a runner each write describes itself to — `next`, `capture`, `apply`,
`restore`, `save`. The reconcile and the revert are written once. The rating
moved first, deliberately: widest value set, and the one restore
`useOptimisticSave` could not express, so a hook that could not hold it would
have failed at the first call site rather than the third. It held.
`useMovieDetail.test.ts` and `MovieDetail.test.tsx` both pass unmodified.

`useOptimisticSave` survives unchanged and stays boolean. Two hooks, two shapes:
it reverts by negating a flag and addresses a movie **by id inside a list**,
where this one is told what to put back and edits **the one movie a page holds**.
Whether the browse screens ever migrate is a Favorites question.

**One wire contract.** `postValue` at `src/api/` — a new shared rung, following
`test-support/`'s precedent of a top-level folder with no barrel. Three saves
across two features kept the same contract, and `useMovieDetail` was already
reaching into `features/library/api` for `saveFavorite` with a comment
apologising for it; the shared rung is where that import had been pointing all
along. The echo guard is a **parameter**, because "a `null` echo is a cleared
rating" is a per-route fact — true of the rating route, nonsense from a flag
route — and inspecting the value's type to decide would make one route's rule
everybody's. That distinction had been defended by a comment in one of three
copies; it is an argument now, with a test either side of it.

The three near-identical throw messages collapsed into `POST ${endpoint} failed:
${status}`, which is the idiom `fetchMovie` and `fetchHomePayload` already use
and names the request that failed. No test asserted the old wording.

**One single-signal write.** `writeSignal` holds lookup → 404 → mutate → echo.
Validation is deliberately **not** in it: the three routes genuinely disagree
about what a valid body is, and the rating's disagreement — a missing `value` key
is a 400 rather than a clear — guards the one write that erases data. Each route
now reads as its validation and its mutation and nothing else.

The argument for this one was never volume. Three routes of ten lines is not much
duplication; the point is that the 404-before-write check is a **correctness
rule** — never write to a movie that is gone — that was written four times in one
file, character for character, and upheld by everyone having remembered to paste
it. That is the class of duplication where the fourth author forgets and nothing
fails loudly.

### Where the plan was wrong, twice

**E1 could not be its own commit.** The plan called for the route helper to land
with its own test, RED first. But its own Testing Decisions section says the
helper is tested _through the router_ with a fake `LibraryStorage`, which is the
only place a route helper's behaviour is observable — so there is no RED to write
that `routes.test.ts` does not already have. A helper committed alone with no
caller leaves an unused-vars warning in a tree the plan requires to lint clean.
E1 and E2 landed together, which is why this is twenty commits and not the
sixteen the plan counted.

**E5 answered itself the other way.** Its condition was "if the helper leaves
`routes/index.ts` meaningfully thinner, extract it to its own folder". It does
not — the file went from 398 lines to 416, because the correctness rule costs
more to explain once than it did to paste three times. The one-folder-per-unit
trigger is companion files, and a helper tested through the router has none.
Both halves point the same way, so `writeSignal` stays local, with the reasoning
written next to it the way `isMovieSort`'s already is.

### Deliberately not done

- **The two star strips do not merge.** The prototype has them differing exactly
  as the code does — `.22` against `.2` on the dim glyph, `--color-text-faint`
  against `--color-text-dim`, a 6px root gap against 14px, a value scaled at
  `size * 0.86` against a fixed 14px. Unifying them is a redesign wearing a
  refactor's clothes, and the rule is that the prototype gets amended in a
  grill-me first or not at all. The shared _arithmetic_ moved; the pixels did not,
  because they are not shared.
- **The raw `rgba(255, 255, 255, …)` literals stay.** 1:1 translations of inline
  prototype values, no token exists for them, and eight style modules already do
  this. A codebase-wide question, not a Ratings one.
- **`parseMinRating` still exists twice** with two different contracts — an
  allow-list of the dropdown's cut-offs in `src/utils/`, a 0–10 range check local
  to the route layer. Both correct, the separation deliberate per the
  `isMovieSort` precedent. Only the shared _name_ is unfortunate, and it reads
  fine until someone greps for it. Left alone; worth a follow-up if it ever bites.
- **`toRatingPercent` / `toRatingUnits` stay two functions.** Pinned against each
  other in both directions already, and collapsing an inverse pair into one
  parameterised function makes the `null` case — the one that must not round —
  harder to read.
- **The picker still speaks percent.** A `components/` unit knowing the stored
  0–10 scale is the boundary the build spent a paragraph avoiding; the conversion
  stays at the `useMovieDetail` seam.
- **No cross-screen rating store, no snackbar, no retry.** Unchanged by anything
  here.

### The row this feature finally ticks

Ratings goes ✅ in README.md and `.claude/CLAUDE.md` with this refactor, closing
issue 63's last acceptance criterion. That criterion was written against 64
specifically, which was the only refactor issue filed at the time — but a feature
is Done after workflow step 8, and step 8 is all of this, not just Group C.

---

## 2026-08-26 — Ratings (issues #57–#63)

The stars have been on screen since `02-browse-grid` and unreachable that whole
time. Thirteen pixels on every **Poster card**, twenty on the **Movie detail
page**, a `4+ stars` **Minimum rating** pill, a `highest-rated` **Sort order** —
and no route, no client call, and no control anywhere that a person could click.
Every rating in the database got there through the dev seed. Six build issues,
#57–#62, each a `test:` commit stopping at RED and a `feat:` commit taking it
green, plus the prototype amendment ahead of all of them. 1478 tests pass, up
from 1352. Plan: `docs/PRDs/07-ratings-plan.md`.

No schema moved and no migration ran. The column has been
`rating INTEGER CHECK(rating BETWEEN 0 AND 10)` with `NULL` meaning **Unrated**
since `01-library-core`, and `storage.setRating(id, units | null)` has been
sitting in the `curation` slice beside `setFavorite` for the same six features.
What this feature built is the path from a click to that mutator, and the
honesty to stop pretending an absence is a zero on the way.

### The project's first prototype amendment

This is the thing about this feature worth remembering, and it is a process fact
rather than a code one.

`page.MoviePage.dc.html` rendered `prim.StarRating`, display-only. The
prototype's only **Rating picker** lives inside `feat.MovieForm` — a 🔜,
unscheduled maintainer screen. So the prototype, read literally, says a
**Rating** is something the maintainer sets in a form that does not exist, while
README and CLAUDE.md both file Ratings under **Browse & discover
(parent-facing)** and `setRating`'s own sibling `setFavorite` is settable from
the detail page today.

CLAUDE.md's rule for this case is exact: "If something seems wrong, raise it in
the grill-me session and amend the prototype first, then build to the amended
prototype." That is what happened, and the commit order is the evidence —
`f8b8f5b` amends `page.MoviePage.dc.html` and `COMPONENT-SPEC.md`, and `8a14170`
is the first line of implementation, after it. Nothing in `src/` or `server/`
moved until the spec said what was being built.

**The precedent is the sequence, not the outcome.** _Raise it in grill-me, amend
the prototype, then build to the amended prototype_ — never _build something
different and reconcile the prototype later_. The second order is how "the
prototype is the spec" quietly becomes "the prototype is where we started",
which is exactly the failure that CLAUDE.md section exists to prevent. The
amendment itself is small — one `dc-import` swapped, one row in
`COMPONENT-SPEC.md`'s page table, two prop tables widened — and its size is the
point: an amendment that has to be argued for and committed on its own is cheap
when it is honest and expensive when it is a redesign in disguise.

The reasoning is on the record in `07-ratings.md` Q2 rather than here, so the
next amendment has a shape to copy rather than a precedent to infer.

### Two deferrals closing, both as deferred halves arriving

Neither of these is a reversal, and it matters that the journal says so. Both
questions were answered correctly for the app as it stood, and both named this
feature as the successor that would change the conditions.

**`04-movie-detail` Q10 — the hidden Meta segment.** An **Unrated** movie showed
no rating **Meta segment** at all, treated as a missing segment under Q9's
interleaving rule. The reason was sound: with `showValue`, five empty stars
print `0.0`, and that is the household asserting it watched the film and scored
it nothing — the opposite of nobody having said anything. Q10 wrote down what
would change it, in those words: "an 'unrated, tap to rate' state wants the
affordance that acts on it." The affordance is here. Empty stars that are
visibly an input, labelled `Not rated`, read as an invitation rather than a
verdict, so the segment comes back and stops being omissible (#62). The movies
most in need of a rating had been precisely the ones offering nothing to click.

**`02-browse-grid` Q10 — unrated as zero on the card.** That log mapped `null` →
0 stars and flagged it in the same sentence as "visually identical to a real 0",
and `ubiquitous-language.md` has carried it as an open ambiguity ever since, to
be "revisit[ed] with the **Ratings** feature". Resolved at #61 by splitting the
tile's two halves rather than choosing between them: the **star row stays**,
because it is fixed furniture in a fixed-height tile and dropping it would leave
cards in a carousel row at uneven heights — which is why Q10 deferred rather
than solved — and the **numeric value goes**. **Unrated** reads `★★★★★`; a movie
scored nought reads `★★★★★ 0.0`.

Both are marked resolved in the glossary rather than deleted from it. The older
design logs still describe the old rules and are left exactly as written.

### What shipped

**One route, the third of a set.** `POST /api/movies/:id/rating`, body
`{ value: number | null }`, echoing `{ value }` — the same shape, the same
404-before-write check and the same echo-is-truth bargain as `/favorite` and
`/watched`. Deliberately not `PATCH /movies/:id`: `updateMovie` is the _form's_
path, it refreshes `updated_at`, and a newly scored 1974 film jumping to the top
of a `recently-added` shelf is the kind of bug nobody would think to look for.
`setRating` is a single-column write and stays one.

**The accepted set is an allow-list, and that is load-bearing.** "Exactly `null`,
or an integer 0–10", not `typeof value !== 'number'` → reject. The second test
lets every non-numeric value through as a clear, and a clear is the one write
that erases data. A body with **no `value` key** is a 400 rather than a clear,
for the same reason: a malformed request and a deliberate `null` must not be the
same wire message.

**`null` is carried, never re-derived.** Four types widened from `number` to
`number | null` — `StarRatingProps.rating`, `PosterCardMovie.rating`,
`toRatingPercent`'s return, and `RatingPickerProps.value`. **Unrated** stopped
being a `value > 0` test at four separate rungs and became a value the whole
path carries. `toRatingPercent` losing its flattening is what forced the rest,
and `view()` needed no code change at all once it went — it had always forwarded
what the mapper handed it. `detailView`'s `movie.rating === null ? null : …`
collapsed to a plain call in the same pass.

**`toRatingUnits` is a util with a test, not an inline `/ 10`.** The pure inverse
of `toRatingPercent`, and the one place the component layer's percent scale meets
the domain's stored units. It exists as its own unit because the `null` case must
not round: erasing a rating and scoring a movie nothing are two different facts,
and a `/ 10` written inline is one keystroke from conflating them. The two are
pinned against each other at every half-star point in both directions.

**The molecule speaks percent in both directions.** `RatingPicker` takes and
emits 0–100, exactly as `StarRating` does. A `components/` unit that is meant to
know nothing about the domain must not start speaking in the 0–10 the column
happens to store, so `useMovieDetail` converts at the seam and nothing below it
ever sees stored units.

**Ten `<button>` segments where the prototype had ten `<div onClick>`.** The
pixels are the prototype's exactly — each star is a span carrying the glyph and
its clipped accent fill, with two 50%-wide segments laid over it — and the hit
areas are real elements with real semantics. Every segment names the rating it
would set, worded grammatically rather than uniformly (`Rate ½ a star`,
`Rate 3½ stars`, `Rate 1 star`), because a parent would otherwise hear "Rate 1
stars". The strip arrives as a `role="group"` called "Your rating" rather than as
ten pieces of loose furniture. Same trade `prim.Toggle` already made with
`role="switch"`: identical pixels, honest semantics.

**Clearing is click-the-current-segment.** No X, no second control, no copy the
prototype does not contain — the same "click it again to turn it off" grammar the
favorite heart and the watched tick already use. It is also the only undo a
mis-click has until MovieForm ships. The segment holding the current value
announces `Clear rating` instead of a rating, so the grammar is spoken rather
than guessed at.

**The Rating preview never leaves the molecule.** Hover and focus preview the
same fill, the label keeps reading the _stored_ value throughout, and nothing
outside the component ever sees an uncommitted rating — so a hover can never look
like a rating that took. The blur is read on the strip rather than on each
segment, because moving between segments inside it is not leaving.

**The seed grew a pair.** `Cold Open` (Action, `rating: 0`) sits beside
`Havoc Line` (Action, unrated) so the two share a shelf row. Phases 3 and 4 exist
precisely to tell those two apart, and without fixtures the distinction was
provable in unit tests and invisible in the running app — which is the one thing
CLAUDE.md says the seed is for. It goes in through the ordinary `LibraryStorage`
interface under the reserved prefix, so a re-run stays idempotent.

### The known cost, taken deliberately

`useMovieDetail` now holds **three** hand-rolled optimistic writes — the watched
tick, the favorite heart and the rating — each keeping the same bargain by hand:
capture what the click cost, apply the new value at once, reconcile against the
route's echo, put the captured value back if the save is refused, all routed
through the `editMovie` guard so a response landing after the page has moved on
is discarded rather than resurrecting a movie the state let go of.

`useOptimisticSave` could not take the third. It is boolean-only by explicit
design and its own comment named this arrival a feature ago: "a save with more
than two values … has to be told what to put back." A rating has eleven values
plus an absence, and `!value` cannot express any of it.

So the duplication is real and it is filed rather than fixed:
**`useOptimisticEdit(previous, apply, save)`**, against all three writes. The
reason for filing rather than generalising mid-build is worth stating plainly —
**two examples were not enough to design the generalisation against, and three
are.** The `04-movie-detail` refactor looked at two and correctly declined; the
genre-page refactor looked at the boolean pair and extracted exactly the boolean
case, no wider. Guessing the shape from two would have produced a hook the third
write then had to be bent into. The cost of waiting is one build cycle carrying a
third copy, which is cheap and visible; the cost of guessing early is an
abstraction nobody can change afterwards.

### Worth naming

**The suite took its first new dependency.** `@testing-library/user-event`, at
#60. jsdom does not synthesise a click from Enter or Space on a `<button>`, so
"the segments activate from the keyboard" is otherwise untestable, and a real tab
walk is what the accessibility AC actually asks for. Recorded because a test
dependency arriving is worth one line in a journal — the next one should have to
justify itself the same way.

**Tests that were green on arrival, reported as green.** Both #59 and #60 landed
tests that passed the moment they were written: tab reach and Enter/Space were
already delivered by #59 promoting the hit areas to real buttons, and several
"still works" clauses restated behaviour an earlier phase had satisfied. The
alternative was breaking the component to manufacture a RED, which would have
been a lie about what the phase owed. They land as regression guards instead, and
the commit messages say which ones and why. A RED phase is a specification
device, not a quota.

**A phase boundary that was visible in a test, and then wasn't.** #59 made the
picker able to clear a rating, but the **Meta line**'s rating segment was still
conditional on a rating existing — so a cleared rating lost its segment rather
than showing `Not rated`. `MovieDetail`'s assertion was narrowed to what that
phase actually owed (no `0.0 / 5` on screen, no segments left, `{ value: null }`
on the wire), and the retraction restored the full claim at #62. The narrowing is
in `5845a4c`'s message with the reason attached, which is what stops a later
reader taking it for a weakened test.

**The picker cannot write a literal `0`.** Its smallest click is half a star, so
`0` arrives only from a TMDB-seeded import. When a person clears, they mean
**Unrated** — the same asymmetry **Minimum rating** already documents, where an
**Unrated** movie shows five empty stars but is excluded by any floor rather than
behaving as a zero.

### Deliberately not built

- **Rating from a Poster card.** The prototype gives the card a heart and nothing
  else, and ten **Half-star segments** on a 210px tile is a mis-click hazard on
  the screen the parents use most.
- **A snackbar when a save is refused.** The snackbar system is its own 🔜
  feature. The revert is the feedback, exactly as it is for the heart and the
  tick.
- **Any cross-screen store.** A rating set on the detail page reaches the browse
  grid on its next load, as **Favorite** and watched already do. Nothing here
  introduces a cache that would let a poster card restyle itself without a
  reload.
- **TMDB seeding and MovieForm's rating field.** Those belong to import-export
  and movie-form respectively. `RatingPicker` lands fully built and tested, so
  MovieForm consumes it later with no rating work of its own.

### The row this feature did not tick

Ratings stays **🔜 Planned** in both feature lists, and issue #63 asks for it
ticked. The standing rule is that a feature is Done after steps 7–8 of the
workflow — `request-refactor-plan` → `refactor` — and not when its build issues
close. `813b546` reverted exactly such a premature tick on Search + Filter, and
the genre page waited the same way one feature ago. The `useOptimisticEdit` issue
is filed; the tick is a separate docs commit once it closes.

---

## 2026-08-24 — Genre page refactor (issue #55)

Twenty commits in eight groups, against
`docs/refactor-plans/06-genre-page-refactor.md`. The genre page shipped working
and left behind a **second browse screen that had re-derived, rather than reused,
the machinery the first one already had** — two copies of the load machine, two
of the optimistic favorite, two skeleton cards, two sets of chrome styles, and
three route handlers that disagreed about what an empty `?sort=` means. All of it
is written once now. 1352 tests pass, up from 1308.

### The suite was not green, and nothing had noticed

`vitest run` had been failing on `src/App/App.test.tsx` in full runs while passing
in isolation. Not a product bug: `GENRE_MOVIES.Action` was a module-level array
of 214 movies, and **six** of that file's twenty tests navigated into that genre
page, each rendering 214 real `PosterCard`s through jsdom and styled-components.
Under 43 parallel workers the two heaviest crossed vitest's default 5000ms
`testTimeout`, which `vite.config.mts` did not override.

A refactor whose safety net is intermittently red is not a safety net, so this
was fixed first. The fixture is a genre of eight now, and the one test that is
genuinely about the number — "opens every movie in the genre, uncapped" — grows
Action to 214 for itself. That file went from 12.5s to 4.9s. An explicit
`testTimeout` was set alongside it as margin, not as the fix.

**Worth naming as a shape rather than an incident:** a fixture grew to 214
because one test needed it, then five more reused it because it was there. That
gets worse rather than better, and the genre page was the first screen in this
codebase with a fixture big enough for it to matter.

**Where the plan was wrong.** It called for the fixture to shrink with _no
assertion changed anywhere_, reasoning that a genre's `total` comes from
`listGenres()` and was never the length of anything the fixture held. True of the
server — but `genreCountLabel` renders `shown === all` as "214 titles" and
anything else as "8 of 214 titles", so a fixture reporting a total of 214 behind
eight movies produces a count line no server could ever send. The decoupling is
visible in product code. Two tests' awaited count text changed instead, and two
more now press "View all" without asserting the number on it, which leaves 214 in
the one test it belongs to. The fixture stays a response the server could
actually produce, which is worth more than an untouched line of text.

### What shipped

**One load machine.** `useBrowseLoad` holds the `attempt` counter, the in-flight
guard, and the **skeleton latch** — the rule that a refetch keeps what is already
painted, and only a load with nothing behind it falls back to the skeleton. That
rule had been a policy stated in two hooks with nothing holding it together; its
docblock is where it lives now. `useHomeRows` and `GenreMoviesProvider` are
substitutions on top of it, and **neither test file was edited** — 52 and 34
tests respectively still pass, which is the evidence that nothing a caller can
see moved.

The hook returns `setData` as well as `data`. That was not in the plan and is
load-bearing: the optimistic favorite writes into the same state the load fills,
so without a setter the two would drift into separate copies of the movie list.
The fetchers map the payload as it lands, so `data` is the render-ready shape and
the heart edits exactly what the grid renders.

**One optimistic save.** `useOptimisticSave` holds the bargain: show the new
value at once, take the route's echo over what was assumed, put the old one back
if the save is refused. It was written verbatim four times across the codebase;
two of those are one line each now. It is typed to a boolean flag deliberately —
the revert is `!value`, and a save with more than two values (a resume position)
has to be told what to put back, which is a parameter to add when one arrives.

**One skeleton card, one retryable failure, one piece of chrome.** The poster
placeholder and the Retry block were byte-identical between the two screens; the
one real difference — the home's card is fixed to `CARD_WIDTH` because it sits in
a strip, the genre's takes its grid track — is kept where it belongs, as the
extension each screen's styles apply. `layouts/chrome.styles.ts` holds the
gradient, the 100vh flex column, the translucent blurred strip and the
`z-index: 40`; both layouts extend it and state only their own differences.
Deliberately **not** `GenreLayout` extending `MainLayout`, which would make one
screen's styles another screen's public surface right before Settings and the
player arrive wanting chrome that is neither.

**`range` went to `src/utils/`, not to the feature.** The plan put it beside the
shared skeleton. It turned out to be written **three** times, the third in
`movie-detail/LoadingDetail` — a different feature, so keeping it inside
`features/library` would have been wrong on the codebase's own rules. It is a
pure helper with a test, which is what `src/utils/` is for.

**Two folders.** `features/library/home/` and `features/library/genre/`, with
what both screens draw on left at the top: `api`, `view`, `withFavorite`,
`CardCarousel`, `LibraryGrid`, `SkeletonCard`, `RetryableFailure`,
`useBrowseLoad` and `useOptimisticSave`. Sixteen flat folders serving two screens
is nine that say which, now. No barrel was added at either — `features/` has
never had one.

### One behaviour change, deliberately

`GET /api/movies?sort=` answered **400** for an empty value, where `/home` and
`/genre/:name` both answered the default order and both had a test saying so. All
three endpoints' comments already claimed the shared rule; only two of them kept
it. It had no test asserting the 400 and no client sends an empty `?sort=`, so it
was a drift rather than a contract. One `parseSort` serves all three now, and the
correction is pinned by a new test — verified failing against the old rule before
it was kept. An unknown sort is still a 400 everywhere. `GET /api/movies` had
**no tests at all** before this; it has three now.

### Retracted from the 2026-08-22 entry

**"The production line bent to suit a test runner" was wrong.** `GenreLayout`'s
`Spacer` was written as `flex-grow` / `flex-shrink` / `flex-basis` longhand,
commented as being that way because jsdom does not expand the `flex` shorthand.
`MainLayout`'s `Spacer` has always been `flex: 1 1 auto`, and `MainLayout.test`
asserts on it with the identical `getComputedStyle(child).flexGrow === '1'`
predicate — and passes. Measured against this repo's jsdom: the shorthand reports
`flexGrow === "1"`, exactly as the longhand does. The shorthand is restored with
**no test change at all**, which is the proof. The claim is retracted rather than
reworded; the paragraph in that entry is marked accordingly.

### Left alone, on purpose

- **`useMovieDetail`** keeps its own load machine and its own two optimistic
  saves. It is the same mechanics around a genuinely different state shape — four
  statuses and a discriminated union, because a 404 and a failure earn different
  buttons. Folding it in would mean expressing `not-found` as a payload value and
  bending a union that exists precisely so the page cannot read `ready` beside an
  absent movie. Two verbatim copies justify an extraction; a third near-miss does
  not.
- **`parseGenreQuery` / `parseLibraryQuery`** stay parallel, per the design log's
  Q12. A shared parser would build a screen that silently honours a hand-edited
  `?rating=7` it has no control to display. #53 already took the shareable half.
- **`GenreMovies` stays a context.** A fixed header and a scrolling body over one
  payload cannot be served by a hook called in both subtrees without making it
  two requests. Only its innards were extracted; its value shape is unchanged.
- **The shared hooks stay at `features/library`'s rung**, not `src/hooks/`, whose
  stated rule is "only hooks used across 2+ features". The promotion trigger is
  recorded: the first consumer outside `features/library` — most likely Favorites
  — is when they move, and that is a one-commit move with no call-site churn.

### Follow-ups

- **The `api/` modules' `fetch` → `!ok` → `throw` → `json` bodies** are four
  copies across three features, and the fourth (`fetchMovie`) resolves `null` on
  a 404 rather than throwing — so they are not four copies of one thing. Noted,
  not done.
- **`GenreLayout`'s header `gap` is `18px`**, which is not on the 4px spacing
  scale (`s5` is 24px). It matches the prototype and was left exactly as it was —
  this refactor changed no design — but a hard-coded pixel gap beside tokenised
  padding is the kind of thing a later reader will assume is a mistake.

---

## 2026-08-22 — Genre page (issues #42–#51)

Closed the last dead end in browse-and-discover. `/genre/:name` had been a
registered placeholder since `03-card-carousel`, and every genre row still ended
in a "View all 214 →" that landed on an `<h1>` and a line of prose. A row caps at
`HOME_ROW_LIMIT`, so for a 214-title genre the other 199 were unreachable by any
route in the app — not by scrolling, not by search, not by any filter. Eight
build issues, #43–#50, each a `test:` commit stopping at RED and a `feat:` commit
taking it green, plus the prototype amendment. 1279 tests pass. Plan:
`docs/PRDs/06-genre-page-plan.md`.

Nothing new is stored and no schema moved. `listMovies` already took every filter
this screen needs and `listGenres` already returned the count "View all 214"
promised, so what this feature built is a second screen over primitives that were
already there — and the header/body split that a screen whose heading depends on
its body's payload forces.

### The decision everything else follows from

**The heading is a fact about what the grid below it loaded.** "12 of 214 titles"
is not something the header can know on its own, and a header that fetches
separately from its body is two requests and two chances to disagree with each
other. `GenreMovies` is the answer: a feature-local provider owning the one
fetch, the `loading` / `ready` / `error` machine, `retry` and the optimistic
`toggleFavorite`, with `useGenreMovies()` as what the heading and the grid both
read. Calling a hook in both subtrees would mean two requests; lifting the fetch
into `GenrePage` would put data logic in a page, which the layer rules forbid.

That shape — a fixed header and a scrolling body over one payload — is the thing
this feature actually contributes to the codebase. Favorites, a flat
search-results page and a collection all copy it rather than re-deriving it.

### What shipped

**One request answers the whole screen.** `GET /api/genre/:name?q=&sort=`, served
by `createGenre(browse)` sitting beside `createHome(browse)` and built the same
way — a composition over the existing `Browse` slice, so no new SQL and no new
repository primitive appeared. `total` is `listGenres()` matched by name; `movies`
is `listMovies({ ...query, genre: name })` with **no cap**, because this screen
_is_ "View all". The rejected alternative — `/movies` for the list plus `/genres`
for the number — is the fan-out `getHome` was built to avoid, and would have
forced `features/library` to import `features/search`'s `useGenreList` so that one
screen could print a number.

**`total` is the genre's unfiltered count, on purpose.** It stays the number the
row's "View all 214" already promised while a search narrows the grid underneath
it, which is what makes "12 of 214 titles" true rather than a tautology. Both the
count label and the grid are built from that one payload, so the header can never
disagree with what is under it.

**The genre travels in the path; the query travels in the URL.** Two parameters,
each omitted at its default, so a plain genre page is a clean `/genre/Drama`.
`parseGenreQuery` and `toGenreQueryParams` are exact inverses carrying the same
round-trip property test their library-query siblings carry, and they share
`isMovieSort` with them. Deliberately **not** a parametrised `parseLibraryQuery`:
one shared parser would build a screen that silently honours a hand-edited
`?rating=7` it has no control to display.

**The rating filter does not apply here at all.** A deliberate deviation from the
prototype's _behaviour_ — `FamilyFlix.dc.html:320`'s `genrePageMovies()` calls
`passRating` — but not from its _surface_, where the genre header has no rating
pill. Reproduce the surface exactly; never port a filter with no control. The
route ignores `genre` and `rating` outright rather than rejecting them, so an old
bookmark still opens.

**A second layout, not a `MainLayout` variant.** `GenreLayout` is a Back pill, a
`heading` slot, a `headerEnd` slot and a `useRestoredScroll` body that is the only
thing on the screen that overflows — so the header stays reachable all the way
down a 214-card shelf. No logo, no gear. Bending `MainLayout` to cover both would
have made it a component with two unrelated modes. `MainLayout` is untouched.

**Two extractions, each switching its existing call site in the same commit**, so
no interim second copy ever existed. `useGoBack` came out of `MoviePage` in the
phase `GenreLayout`'s Back pill became its second consumer — a history step with a
`/` fallback only when `location.key` is the session's first entry, so a
deep-linked genre page never shows a dead button, and a step rather than a link
home is what preserves the library's filters and its restored scroll.
`useSettledText` came out of `LibrarySearch` in the phase `GenreControls` became
_its_ second consumer. `LibrarySearch`'s docblock claimed the debounce "lives here
and nowhere else"; the extraction is what kept that sentence true rather than
letting it quietly become false. Both existing test files are unmodified and still
pass, which is the guard that the extractions changed nothing.

**The two empty states are told apart by the genre's unfiltered total**, not by
whether a search is present. "Nothing here — There are no movies in Action." has
no Retry; "No matches — Nothing in Action matches “lighthouse”." quotes the term
back so a typo is spottable. Keying off the total is what stops a search running
over an already-empty genre being blamed for a miss it did not cause.

**The skeleton does not come back.** Twelve cards on the very first load only; a
refetch on a settled-query change keeps the grid on screen rather than flashing
the skeleton back, the same discipline `useHomeRows` follows. The in-flight latch
covers `retry` as well as a query change, so a stale response can never overwrite
a newer one.

**The carried sort travels through the link, not through hidden state.**
`HomeRows` serializes the order through `toGenreQueryParams` — the same writer the
genre page reads back — and off the _settled_ query rather than the raw URL, so a
stale or unrecognised `?sort=` carries nothing. At the default it writes nothing
and the path stays a clean `/genre/Drama`. The search text stays behind
deliberately: the genre's box is a fresh, narrower search, relabelled
"Search in {genre}".

**`LibraryGrid` reuses the exported `CARD_WIDTH`** rather than declaring a second
magic number, so the uncapped grid and the capped carousels cannot drift apart. A
wide window gets more columns rather than wider cards.

**`withFavorite` gained a flat-list sibling**, with the existing rows variant
expressed in terms of it — one concept, two shapes, one folder.

### Two ordering corrections the plan made against the PRD

Both closed a gap where a phase would otherwise have depended on something
shipping later.

- **`useGoBack` moved from Phase 5 into Phase 3.** `GenreLayout` owns the Back
  pill, so Phase 3 was the rule's first new consumer; extracting in Phase 5 would
  have meant Phases 3–4 carrying an inline second copy of exactly the rule the
  extraction exists to prevent.
- **The prototype amendment moved from Phase 6 into Phase 4.**
  `FamilyFlix.dc.html:490` read "1 titles". CLAUDE.md says amend the prototype
  first, then build to the amended prototype, and `genreCountLabel` singularises
  in Phase 4 — so the amendment opened that phase as `0f19a23` rather than
  trailing the build it governs.

### Deliberately not changed

- **`GET /api/movies` kept its behaviour exactly.** Only its comment changed: it
  stopped claiming to serve the genre page and is now described as the generic
  browse endpoint the CSV exporter will read the library through.
- **`GenreQuery` keeps a required `sort`** because it is the URL contract type and
  a URL always carries an order, even an implicit one. The repository method takes
  a `Partial` of it instead, so a server caller can name only the part it cares
  about and an omitted sort means the default order. Two shapes for two jobs, in
  preference to one optional field pretending to serve both.
- **No client-side re-sorting of a loaded grid, and no client-side filtering of a
  payload already held.** The server owns order and narrowing, as `05` decided.
- **The two query parsers stay separate**, per the reasoning above. Note that this
  was an argument about _vocabulary_, not about mechanics — see the follow-ups.

### The production line bent to suit a test runner

> **Retracted 2026-08-24 (issue #55).** This was wrong. jsdom _does_ report
> `flexGrow === "1"` for the `flex` shorthand — `MainLayout` had always relied on
> exactly that — so the longhand was never needed and no test ever required it.
> The shorthand is restored, with no test change. The paragraph is kept as
> written, below, because the record of a wrong call is worth more than a tidy
> one.

`GenreLayout`'s spacer is `flex-grow` / `flex-shrink` / `flex-basis` longhand
rather than the `flex` shorthand `MainLayout` uses, purely because jsdom does not
expand the shorthand and the test reads `flexGrow` back off the computed style.
It is one line and it is commented where it sits, but it is a stylesheet written
around a limitation of the test environment rather than around the design, and
that is worth naming out loud rather than leaving as a curiosity for whoever next
diffs the two layouts and wonders why they disagree.

A smaller one in the same family: `App.test`'s `posterCards()` helper counted any
labelled button as a card, so the genre header's new Sort pill read as a 215th. It
is now scoped to the scrolling body, where the grid actually is; the two
assertions it feeds are unchanged.

### Follow-ups this feature surfaced

- **The URL-write mechanic is duplicated verbatim.** `useGenreQuery` and
  `useLibraryQuery` hold byte-identical copies of `setParam` — copy the current
  params, set or delete one name, write with `replace: true` — and identical
  `setSearch` and `setSort` on top of it. The design log's argument for keeping the
  two hooks apart was about _vocabulary_: a shared **parser** would let a screen
  accept filters it cannot display. That argument does not reach the **writer**,
  which knows nothing about which parameters exist. Filed as #53.
- **Router and scroll test scaffolding is copied ten and five times.** A
  `LocationProbe` component appears in ten test files (with two different
  `data-testid` values, so an assertion cannot be moved between them), and the
  thirty-line jsdom scroll-metrics stub — `scrollTop` through a `WeakMap`, a fixed
  `scrollHeight`, the `afterEach` that deletes the shadowing own-properties — in
  five, differing only in one number. This feature added four copies of the first
  and one of the second. Filed as #54.
- **The genre page's five units sit flat in `features/library/`** alongside the
  home-row units: `GenreGrid`, `GenreHeading`, `GenreMovies`, `genreCountLabel`
  and `LibraryGrid` next to `GenreRow`, `HomeRows`, `RowSection` and the rest.
  Sixteen folders in one feature, serving two screens. Whether that wants a
  sub-grouping is a judgement call for the refactor rather than a defect.

### The rows this feature did not tick

The genre page is recorded in both feature lists as **🔜 Planned**, not ✅ Done,
and issue #51 asked for it ticked. The standing rule is that a feature is Done
after step 7–8 of the workflow — `request-refactor-plan` → `refactor` — and not
when its build issues close; `813b546` reverted exactly such a tick on Search +
Filter for exactly this reason. No refactor issue exists for the genre page yet,
so the rows go in at 🔜 and the refactor is what flips them. The row did not
previously exist in either list at all, so this is an addition rather than a
deferred tick.

The Sort ✅ correction, which `813b546` also reverted and which _has_ cleared the
bar twice over (#35 built it, #41 refactored it), is deliberately not part of this
entry — it is its own docs commit, tracked as #52.

---

## 2026-08-19 — Search + Filter refactor (issue #41)

Closed the debt the search + filter build left behind. The plan's fifteen commits
landed as fourteen — D1 and D2 were both one-file test fixes on the same theme
and went together — plus a fifteenth ticking the two README rows that `a087304`
had reverted to Planned pending exactly this work. Plan:
`docs/refactor-plans/05-search-filter-refactor.md`.

Nothing here was about behaviour. The feature worked and 956 tests passed; what
it had cost was a **settled query that five modules each knew how to read, write
and name for themselves**. The URL-as-state decision was right and stands — the
router is still the only seam between `features/search` and `features/library`,
and no import crosses between them. What that decision never resolved was where
the shared _vocabulary_ for the seam lives, so each side grew its own copy.

### What shipped

**One sort vocabulary.** `MOVIE_SORTS` is now an `as const` tuple in
`src/types/browse.ts` and `MovieSort` is derived from it, so the union and the
runtime list cannot drift — one is made out of the other. The route layer's
verbatim copy is gone. `DEFAULT_MOVIE_SORT` joins it and collapses six
declarations of `'recently-added'` spanning both build targets.

**One parser, one serializer, and a tested round trip.** `parseLibraryQuery`
moved to `src/utils/`, and `homeUrl()`'s hand-written omit-at-default rules came
out beside it as `toLibraryQueryParams`. The pair are inverses and nothing had
ever checked it; thirteen settled queries now assert the property directly.
Both duplicate readers were deleted rather than bypassed — `useHomeRows` calls
the parser, and `HomeRows` reads its miss copy off the query the hook loaded
for, so the message can no longer name a filter the request ignored.

**The third dropdown got the shape the other two had.** `SORT_LABELS` and
`SORT_ORDER` collapsed into one exhaustive record in `features/search/sortOptions/`,
carrying each order's label _and_ its place in the panel. `LibraryFilters` is now
three near-identical dropdown calls with no vocabulary of its own.

**`HomeQuery` became `LibraryQuery`**, so the glossary's headline term, the hook,
the parser and the type all say the same word.

### The verified finding the next person will need

**A value import crosses the `@/types` boundary safely under both server
runtimes.** All seven of the server's imports from `@/types` were `import type`
and therefore erased, so nothing had ever proven the alias resolves at runtime
for the backend. It does: verified under `tsx` (the dev server and the seed) and
under `vitest` (every server test) before the route layer was allowed to depend
on it. `tsconfig.server.json` includes `src/types/**` and nothing else of the
frontend, so the boundary widens from "shared type vocabulary" to "shared type
and constant vocabulary" — and no further. This is the fact to check first
before sharing anything else across it.

### The rule this settles

**If two features read the same thing out of the URL, the thing that reads it is
a util.** Not new — it is the rule the build already applied twice mid-flight,
when `isMovieSort` and `parseMinRating` were promoted for exactly this reason,
and then stopped applying. Everything in Group B is that same discovery carried
to its conclusion.

A related one, worth its own sentence: **a parser and its inverse are one unit of
correctness even in two folders**, and the round-trip test is what says so.
`useHomeRows` now leans on it directly — its memo is keyed on the query's
canonical serialization, which is what keeps a scroll offset or a sort spelled at
its default from reloading the library, and reading the query back from that
string is only sound because the round trip holds.

### Deliberately not changed

- **The server keeps a local one-line sort guard.** Sharing the type predicate
  would mean widening the server build to include the frontend's `utils/`
  directory. The five-item list was the duplication with teeth; a single
  `.includes()` is not worth coupling two build targets over.
- **The two `parseMinRating` implementations stay different.** The route is a
  general API over the stored 0–10 scale; the client accepts only the three
  cut-offs the dropdown can produce. Not duplication — two different contracts.
- **`HomePayload` and `HomeRow` keep their home names.** A payload really is one
  screen's, where the query narrows the whole library.
- **`LibraryFilters.test.tsx` was not redistributed.** At 880 lines it is the
  largest test file in the feature, and the obvious move after extracting
  `sortOptions` was to move its sort cases down to the new unit. It stays: it is
  now the integration proof above the unit test, and every one of its assertions
  passing unedited is what proved the extraction pure.
- **No behaviour, no request and no pixel changed.** The verification rule for
  every commit was that the existing tests pass unedited — `useHomeRows.test.tsx`
  and `HomeRows.test.tsx` in particular were never opened, and their forty-odd
  URL-to-request assertions are the entire proof of Group B.

### Two things found along the way

- **`npm run typecheck` was red on `main`.** A `TS2488` in
  `MainLayout.test.tsx`: spreading an `HTMLCollection` under an ES2015 target
  without `downlevelIteration`. It sat on the same helper as the repo's only
  three ESLint warnings, so it was fixed with them rather than left as a
  half-clean file. **Nothing in the pre-commit hook or CI runs `typecheck`**,
  which is why a compile error could live on the default branch — that gap is
  the real finding, and it is not this refactor's to close.
- **`App.test.tsx` emits three `act(...)` warnings**, from a `HomeRows` update
  landing after a synchronous render. Pre-existing on `main` and confirmed as
  such against `08013fd`; distinct from the `LibraryFilters` warning the plan
  flagged, which is fixed. Left alone deliberately: it is outside the plan, and
  the repo is otherwise at zero warnings now, which is what makes it visible.

### The guard that could not be committed

The plan's last item was a line in `.claude/CLAUDE.md`'s commit conventions:
never write a closing keyword — `close`, `fix`, `resolve` and their inflections
— before a `#n` for an issue the commit does not close. GitHub's parser accepts
a colon between the two and does not read the sentence around them, so a commit
body saying follow-ups were filed _rather than_ fixed closed one of them on the
spot, with nothing shipped against it. The other survived only because it came
after an "and". The rule is now in that file, and the fix when listing follow-ups
is to write the bare number: "filed as 39 and 40".

**It is not in version control.** `.claude/` is gitignored, so the project's own
instructions live on one disk. That was already flagged in the movie-detail entry
below as a decision worth making deliberately; this is the second time it has
cost something — a rule written to stop a recurrence that no clone of this repo
will ever see. Worth its own issue.

### The pattern worth keeping

The build discovered the right rule halfway through, applied it twice, wrote down
why in this journal — and then left the other five copies standing. A shared unit
with its duplicates still beside it is the situation that produces this debt, not
the fix for it. The deletion is the deliverable; the extraction is the easy half.

---

## 2026-08-19 — Search + Filter + Sort (issues #30–#38)

The browse home's header controls, filling the gap `MainLayout` has carried
since `02-browse-grid`: a search box, a Genre pill, a rating pill and a Sort
pill. Sixteen commits across seven build issues (#31–#37), red tests then green
for each. PRD: `docs/PRDs/05-search-filter.md`; plan:
`docs/PRDs/05-search-filter-plan.md`.

Almost nothing new was stored. `MovieQuery` has carried `search`, `genre`,
`minRating` and `sort` since Library Core, and `buildListQuery` already
assembled every one of them into parameterized SQL. What this feature built was
the path from a header control down to that query — plus the two arms of
`search` the prototype implies and the repository did not have. No migration:
the only new SQL in the whole feature is `countMovies()`, a `SELECT COUNT(*)`.

### The decision everything else follows from

**The query is the URL.** `/?q=&genre=&rating=&sort=` is the entire state of
this feature — no component state above the controls, no context provider. The
controls only ever _write_ it; `useHomeRows`, the pills' own selected values and
`HomeRows`' miss copy only ever _read_ it. That is what lets `features/search/`
and `features/library/` both act on the query without a single import crossing
between them: the router is the seam, and it already existed.

Three consequences worth knowing before touching any of it:

- **Every parameter is omitted at its default**, so an unfiltered home is a
  clean `/`, and "All Genres" / "All ratings" _remove_ their parameter rather
  than writing an empty one.
- **Writes are `replace: true`**, so typing does not stack a history entry per
  keystroke and one Back escapes a search of any length. The price is that each
  settled query mints a fresh history key, which resets scroll to the top —
  right for a reshuffled list, but a consequence rather than a goal. Remember it
  if `useRestoredScroll` is ever revisited.
- **A hostile or stale URL is made safe in exactly one place.**
  `parseLibraryQuery` turns `URLSearchParams` into a `HomeQuery`; an unknown
  sort falls back to the default and an unrecognised rating is dropped, so a
  bookmark from an older build opens rather than crashes.

### What shipped

**Search widened from a title substring to title OR synopsis OR genre name.**
The genre arm reuses the genre filter's `m.id IN (SELECT …)` subquery shape
rather than joining, so a movie matching on several arms — or on several
genres — still comes back exactly once, and `assembleMany` keeps re-running the
`WHERE` as a subquery unchanged. `searchMovies` widened with it, since it is
documented as a `listMovies` call with the `search` filter and should keep
meaning that.

**`getHome` takes a `HomeQuery` and threads it into both `listMovies` calls**,
so the genre rows and the Continue Watching row narrow off one query and the top
of the screen can never disagree with the rest of it. Rows that matched nothing
are dropped — moved forward from the genre slice into Phase 1, because a search
that leaves every genre row standing renders a screenful of empty rows. A
narrowed row's `count` still comes from `listGenres()`, so "View all 24" keeps
saying 24 while the row shows the three that matched.

**Filtering happens on the server, never on the payload already held.**
Filtering 15 of a genre's 40 movies would silently miss the other 25, and every
user-facing symptom of that bug looks exactly like "we don't own that film".

**`GET /api/genres` → `{ total, genres }`, its own endpoint.** Not a field on
`HomePayload`, because it has a different lifetime: it is fetched once per mount
where `/home` refetches per settled query, and the counts must not reshuffle
under a finger already reaching for them. `total` needs `countMovies()` rather
than a sum of genre counts, which would double-count anything tagged twice.
`useGenreList` resolves to an **empty list on failure** — the Genre pill renders
with "All Genres" alone and the other two are untouched, because the prototype
designs no error surface here.

**`FilterDropdown` is built on `Menu`.** The dismissal contract it needs —
Escape, outside pointerdown, select-to-close, focus back to the trigger —
already existed, and taking it buys the prototype's single-open behaviour for
free with no coordinating state anywhere. The deliberate price: the prototype's
`open` / `onToggle` props are **dropped**, because `Menu` owns open state.
`Menu` gained only `MenuItem`'s `selected` and `trailing`, and a scrollable
panel; its existing dismissal tests were not edited and still pass.

**`label` on `FilterDropdown` is always required and always forms the accessible
name**, rather than an `aria-label` a caller can forget. That is what lets the
rating pill wear a ★ with no visible caption and still announce "Minimum rating:
3+ stars".

**The debounce lives in `LibrarySearch` and nowhere else** — local input state
for instant typing, a 250ms debounced URL write. It is the only holder of
un-settled input in the app; everything downstream treats the URL as already
settled and knows nothing about debouncing. That is the deliberate price of
keeping `useHomeRows` free of any import from `features/search`.

**The skeleton does not come back.** Rows already on screen stay put through a
refetch — first load only, because flashing the whole screen every 250ms of
typing would be unreadable. A stale in-flight response cannot overwrite a newer
one.

**`HomeRows` distinguishes three misses, not two.** A search miss quotes the
text back; a filter-only miss talks about genre and rating; "Your library is
empty" still means there are no movies at all. The prototype conflates the first
two into one string that renders as empty quotes when nobody typed anything.

**427 new tests.** The suite went from 519 to 946 written cases — 956 executed,
across 64 files.

### Two shared utils that were not on the plan

`isMovieSort` and `parseMinRating` (with `RATING_CUTOFFS`) landed in
`src/utils/` rather than inside `features/search/`, because the sort and the
minimum arrive from the URL and **two features read them from there
independently**: the search feature parses the settled query and draws the pill,
the library feature builds the home request. A feature-local helper would have
meant one of them importing the other, or — worse — two parsers that could
disagree, which shows up as a screen contradicting itself rather than as a
crash.

`parseMinRating` is also **stricter on the client than the route is**, which was
a build-time discovery rather than a planned one. `/api/home` stays a general
API over the whole stored 0–10 scale and `400`s only what is off it; the client
accepts **only the three cut-offs the dropdown can produce** (8 / 6 / 4). A
hand-edited `?rating=7` would otherwise narrow the library behind a pill still
reading "All ratings". `0` is "All ratings" too, not a floor of nought — a
literal minimum of zero would exclude every unrated movie, the opposite of what
that row promises.

### Deliberately not changed

- **`getHome` still runs one query per genre**, so a library with many genres
  pays a statement each. Sub-millisecond against a local SQLite file, and the
  seam to batch it later is one function.
- **`/api/movies` did not gain `q` or `rating`.** Nothing calls it with them
  until the GenrePage grid exists.
- **The GenrePage header, the Favorites row and persisted filters** are all
  absent from the prototype. Each would have been inventing design at build
  time.
- **Nothing was made "smart".** Substring `LIKE` over three columns — no fuzzy
  matching, no stemming, no ranking. FamilyFlix has no AI, and this is not the
  seam to hide a scoring function behind.
- **`docs/handoff/` is now ignored by ESLint.** Its vendored `support.js` was
  the only thing in the repo `eslint .` had ever failed on, and it is a
  prototype we read rather than a source we own — correcting it would edit the
  visual source of truth. Recorded here because it is a config change made while
  closing out a feature, not part of the feature.

### Follow-ups this feature surfaced

- **Home-row ordering is knowingly inconsistent with the Genre dropdown.** The
  **Browse home** orders its rows alphabetically (`listGenres()` is
  `ORDER BY g.name`); the Genre dropdown orders its options by count descending,
  because that is what the prototype does (`FamilyFlix.dc.html:409`). The
  prototype orders the rows that way too (`:328`), so the rows are the surface
  that is wrong — a pre-existing `02-browse-grid` divergence, not this feature's
  to change silently under a filter. Filed as #39.
- **`Menu` promises more ARIA than it implements.** The trigger says
  `aria-haspopup="menu"`, but the panel carries no `role="menu"` and the items
  are plain buttons with `aria-current` — chosen deliberately, because
  `role="menu"` and `menuitemradio` promise the arrow-key navigation of the full
  ARIA menu pattern, which does not exist here. `aria-current` is valid and
  meaningful without promising it. Promoting the pattern is its own piece of
  work. Filed as #40.
- **`MainLayout.test.tsx` has three non-null assertions** left by the
  header-slot work — ESLint warnings, not errors. Small, but they are the only
  lint noise in `src/` and worth clearing whenever that file is next opened.
- **`LibraryFilters`' tests log an `act(...)` warning.** The suite passes; a
  state update from the genre-list fetch settles outside `act`. Worth tightening
  before the next hook in that feature is written, so a real warning is not lost
  in a familiar one.

---

## 2026-08-13 — Movie Detail refactor (issue #29)

Closed the debt left behind by the shipped movie detail page. Twenty-five
commits, in eight independent groups. Plan:
`docs/refactor-plans/04-movie-detail-refactor.md`.

The page worked and was well tested; it had simply been built as one screen
rather than as a set of parts. `MovieDetail.tsx` held four components plus a
helper in 415 lines, beside a styles file exporting 35 styled components, and
pieces that were obviously reusable had been written where nothing else could
reach them. It now holds one component in 212 lines, beside 14 styled
components, and everything that left it went somewhere another screen can use.

### What shipped

**Six shared units, each with every existing copy migrated onto it.** The
extraction is the easy half; the deliverable is the deletion. A shared unit with
one consumer is the situation that produced this debt, not the fix for it.

- **`prim.IconButton`** — the round icon-only button, now under all seven
  hand-styled ones: the header gear, both carousel arrows, the card's favorite
  heart, the ⋯ overflow trigger, and the detail page's two circles.
- **`mol.Menu`** — the popup, and the whole contract for getting rid of it:
  Escape, an outside press, an activated item, focus back to the trigger every
  time, and the ARIA wiring.
- **`mol.LoadMessage`** — the centred title/body/action block behind all four
  **Load state** screens.
- **`prim.Skeleton`** — the pulsing placeholder surface, previously two copies
  of the same keyframe and base.
- **`prim.Artwork`** — artwork or the **Gradient fallback**, previously three
  hand-written copies of one `linear-gradient`.
- **`prim.Button` gained a router-link form**, so the one bordered control that
  must be an anchor stopped being a fourth copy of the same styling.

**`IconButton` owns behaviour and geometry; chrome comes from
`styled(IconButton)`.** A five-member variant enum was rejected: three of those
five would have existed only because two hand-written CSS blocks picked
different blur radii, and an enum would have frozen that accident into the API.
The spec'd `ghost` and `outline` ship as defaults because the handoff names
those two deliberately.

**`IconButton`'s accessible name is a required `label`, separate from the
optional `title`.** COMPONENT-SPEC's table has one `title` doing both; following
it would have given four call sites a hover tooltip they do not have today and
cost the two toggles their `aria-pressed`. A required `label` also makes an
unnamed icon-only button unrepresentable, which the seven buttons it replaces
could not guarantee.

**The edit menu's hardest behaviour is no longer hoarded.** Escape-close,
outside-pointerdown close, close-on-activation and focus return lived inside
`MovieDetail.tsx` where `FilterDropdown` and the `LibraryHeader` gear menu could
not reach them. They are `mol.Menu`'s now, and the eight existing edit-menu
assertions passed untouched through the move — which is the proof the contract
survived it.

**`MovieDetail.tsx` decomposed last, not first.** Groups A–E removed roughly a
third of the file by moving pieces into shared units, so the split was over what
genuinely remained: `EditMenu`, `MetaLine`, `CreditsRow` and `LoadingDetail`
each got their own folder, test and styles, and the two failure wrappers
disappeared into `LoadMessage` call sites.

### The one moved pixel

`HomeRows.RetryButton` had `border-radius: 10px`. It is now `radius.md` (12px),
which is what COMPONENT-SPEC specifies for `size="md"` and what every other
button in the app already used. The 10px was a hand-typed literal that predated
`prim.Button`. Adding a radius escape hatch to `prim.Button` to preserve it
would have been encoding a typo as API. **Everything else in this refactor moves
nothing.** If something looks different, that is a bug in the refactor.

### Deliberately not changed

- **`MoviePage.BackPill` was not migrated.** It is a labelled pill, not an
  icon-only button, so `IconButton` is the wrong home for it. It keeps its own
  copy of the translucent-over-artwork chrome, now shared with nothing —
  recorded as accepted rather than fixed.
- **No shared "chrome over artwork" treatment.** `BackPill`, `MoreButton`, the
  carousel arrows and `FavButton` differ in alpha, blur radius, border and
  hover. Deciding what they _should_ be is a design question for a grill, not
  something to settle inside a refactor.
- **`IconButton` has no `active` face**, though the prototype draws one. Every
  toggle in the app paints its own on-state, so the face has no caller;
  `pressed` carries the part a screen reader needs.
- **`Menu`'s items are plain buttons, not `role="menuitem"`.** Adding the role
  would have changed the accessibility tree and rewritten the assertions that
  were this refactor's safety net. It is a real question, and it belongs to
  whoever builds the second and third menus.
- **The existing 459 tests were not edited.** They passed before and after every
  one of the twenty-five commits. An untouched test file passing after an
  extraction _is_ the proof the extraction was pure. The suite grew to 520.

### Follow-ups this refactor surfaced

- **The prototype designs no failure or empty states at all.** Searching
  `docs/handoff/` for a retry, an error or an empty state returns nothing —
  which is exactly why the four that exist drifted apart unnoticed, and why this
  refactor had to invent the name `LoadMessage` with no handoff file to check it
  against. Two of these screens will be seen by a parent (an empty library on
  first run, and a failure) and neither has ever been designed. Worth raising at
  the next grill.
- **A `styled(IconButton)` that replaces the hover must replace all of it.**
  Both built-in faces move `background` and `color` on hover, so a call site
  that sets only one inherits the other from underneath, and a bare `&:hover` is
  one selector shorter than the guarded `&:hover:enabled` it is trying to beat.
  Both rules are written at the top of `IconButton.styles.ts`; this is the kind
  of thing that is obvious once and invisible forever after.
- **`Menu`'s panel is hard-coded to hang below-right of the trigger.**
  `FilterDropdown` is the next consumer and may want left alignment. The prop
  was not added speculatively — it is noted here so the next person adds it
  rather than working around it.

---

## 2026-08-09 — Card Carousel refactor (issue #21)

Closed the debt left behind by the shipped card carousel and Continue Watching
row. Seventeen commits, in six independent groups. Plan:
`docs/refactor-plans/03-card-carousel-refactor.md`.

### What shipped

**A committed dev seed (`server/src/db/seed/`, `npm run db:seed`).** The screen
could not be looked at: the database held twelve genres and zero movies, Add
Movie and bulk import are both unbuilt, and nothing writes a resume position
until the player ships, so the browse home rendered "Your library is empty" and
every visual claim about the feature was unverifiable. The seed writes twenty
fixtures through the ordinary `LibraryStorage` interface, covering every state
the home screen can show: an Action row of twelve (so that row overflows and the
carousel arrows actually appear), six in-progress with a known runtime, one with
an unknown runtime, one in-progress with no genre tags (Continue Watching is the
only row that can show it), three watched, three favorites, and one deliberately
unrated.

**Seed rows are marked by a reserved video-path prefix (`__seed__/`), not by
fixed ids.** Fixed ids were the obvious design and are unreachable: `addMovie`
mints its own identifier, so using them would mean widening a production write
interface to serve a development tool. The prefix buys the same two guarantees —
a run is idempotent, and it can never delete a movie that arrived any other way
— using only the interface that already exists. No production module changed for
the seed's benefit.

**The carousel's internals.** One geometry record per variant instead of two
parallel maps, with `CarouselVariant` derived from its keys, so a variant cannot
join the type without also being given a width and an arrow position. The tile
wrapper is written once rather than duplicated across the two render arms. And
the comment claiming the continue tile is 16:9 now says 16:10, which is what the
stylesheet has always said.

**`RowSection`.** `GenreRow` and `ContinueRow` were structural twins — a
`<section>`, a serif heading, a carousel, near-identical styles. Both now
compose one unit that owns the section, the heading and the optional trailing
action. Favorites drops in later without a fourth copy.

**Both cards are keyboard-reachable.** This was the only real defect in the
plan rather than untidiness: both cards hung `onClick` on a bare `<div>`, so
somebody navigating without a mouse could not open a movie at all. `ContinueCard`
holds nothing else interactive, so its root became a real `<button>` and inherits
the platform's Enter/Space handling. `PosterCard` contains the favorite heart, so
a button root would nest a button inside a button; it got an explicit role, a tab
stop, a label and a key handler instead, and the heart now stops activation keys
the way it already stopped clicks.

**One rule extracted, `toRuntimeSeconds`.** "A runtime that is null or
non-positive is unknown" was encoded twice, in opposite polarity, in the continue
mapper and the progress helper.

**Eight devDependencies removed** — `@types/styled-components` (v5 types against
a v6 package that ships its own), the swc toolchain, the Vitest UI, and Nx's
generator-only packages. Each verified by a full typecheck, lint, test and build,
and the Nx one and jiti additionally by starting the dev server.

### Deliberately not changed

- **Nx stays.** Dropping it entirely was the larger dependency win (~10 packages
  rather than 4) but costs a tech-stack amendment, two deleted config files, and
  a hand-rewritten ESLint config, because the flat React preset pulls in four
  ESLint plugins nothing else declares. The workspace scaffold is a listed
  foundation feature. Took the free half of the win.
- **Four ESLint plugins that look unused are load-bearing.** `eslint-plugin-import`,
  `-react`, `-react-hooks` and `-jsx-a11y` appear in no config file and are
  declared by no package in the tree — the Nx flat React preset requires them at
  runtime. `eslint-config-prettier` is likewise a required peer of the Nx ESLint
  plugin. `tslib` is required by `importHelpers`, and `@testing-library/dom` is a
  peer of its React counterpart. **None of these are removable, and all of them
  look removable.** Written down here because the next person doing a dependency
  cleanup will reach for exactly this list.
- **The mappers keep their overlapping calls.** `view()` and `continueView()`
  both derive gradient stops from the id and a progress percent from the same two
  fields. That is incidental similarity between two functions producing two
  different shapes; a shared base would couple them for no gain.
- **The two heading sizes stay different.** Continue Watching is 24px and a genre
  row is 22px in the prototype. `RowSection` parameterises the size; it does not
  harmonise it. The prototype is the spec.
- **The props union keeps its per-variant arm** even though the geometry is now
  one record. The asymmetry is the price of illegal item/variant pairings being a
  compile error, which is worth more than symmetry.
- **No visual change anywhere.** Nothing in this refactor moves a pixel. If
  something looks different, that is a bug in the refactor.

### The seed's end date

The seed is scaffolding, and it has a stated expiry: **the commit that ships bulk
import is the commit that deletes it.** It exists only because Add Movie and bulk
import do not. Once real imports can fill the library, a fixture writer living in
the database folder is dead weight with a delete pass pointed at real data.

### Follow-ups this refactor surfaced

- **`eslint-plugin-jsx-a11y` is installed, loaded, and did not report the
  keyboard defect**, which means its rules are not at error severity under the Nx
  preset. Turning them up is the change that stops this recurring; it would likely
  light up more than this one feature, so it wants its own issue.
- **`ContinueCard`'s Enter/Space test asserts the element, not the keypress.**
  Browsers synthesise a click from Enter and Space on a `<button>`; jsdom does not
  simulate that, and `@testing-library/user-event` (which does) is not installed —
  adding a dependency inside a dependency-cutting refactor was the wrong trade to
  make unilaterally. So the assertion that carries the guarantee is that the
  control really is a `<button>` rather than a div wearing a role. `PosterCard`'s
  handler is hand-written and therefore tested directly, keypress by keypress. If
  `user-event` is ever added for another reason, tighten this test.
- **The rest of the tsconfig scaffolding is untouched.** Decorator metadata, the
  ES2015 target and the legacy `node` module resolution are Nx leftovers in the
  same family as the dead dependencies, but changing compiler settings can move
  emitted output and is not a dependency cleanup. Worth its own small issue. (The
  two `@nx/react/typings` entries went with `@nx/react` in this refactor, because
  they pointed at a package that no longer exists — nothing imports a CSS module
  or an image.)
- **`.claude/CLAUDE.md` is gitignored**, so the amendment naming the dev seed in
  the `db/` boundary and the `FAMILYFLIX_DB_PATH` note exists on disk but is not
  version-controlled. Worth deciding deliberately whether the project's own
  instructions should be tracked.

### Why this file now exists

Five of the six problems in this refactor were known or knowable at build time.
The 16:9 comment was explicitly on the build plan and was skipped. The geometry
sync cost was written into the design log and accepted. The row twins were named
"structural twins" in that same document. None of it was recorded anywhere a
later session would look, so all of it resurfaced as a refactor instead of as a
follow-up. That is the gap this journal is for.
