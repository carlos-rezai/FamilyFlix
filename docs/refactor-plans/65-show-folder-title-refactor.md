# Refactor plan: Show folder title, one prefill rule spelled once beside the rows it fills, one tail strip, a docblock that says why the hyphen stays, and the docs that close step 48

> Source initiative: `show-folder-title`, issue 628 (step 48).
> Shipped by issues 629 to 631: three slices, RED and GREEN each
> (`afc1a667` to `d303d818`).
> Design log: `docs/design-logs/65-show-folder-title.md`.
> PRD: `docs/PRDs/65-show-folder-title.md` (628). Plan:
> `docs/PRDs/65-show-folder-title-plan.md`.
> Handoff: `docs/handoff/feat.MovieForm.dc.html` (one comment amended).
> This is the initiative's closing round. It ticks **Show folder title** and
> closes 628. Filed as issue #632.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._ The maintainer approved every recommendation in advance.

## Problem Statement

`show-folder-title` shipped every phase of its plan. The **Show folder
read** answers the picked folder's **Folder key** as `title` and `year`
(`folderKeyOf`, the scan's own reader), `useMovieForm`'s `prefillFolderKey`
fills the title and the year each by the picked-or-empty rule, and
`titleGuess` is gone from `titleKey`.

At `d303d818` the full suite has **12249 tests across 817 files, all
passing** (one skipped). `tsc -b --force` is clean. `eslint src server
electron` reports **1 error and 137 warnings**, as the rescan-a-folder
round closed on: the build added none.

The design held; the round is small. What is left is what three slices
built one after another leave behind: a pure rule written inline in a
913-line hook, a field-text spelling written twice, a loop written twice, a
docblock the last slice made untrue, test headers and a prototype comment
that still say **Title guess**, and the documents. Every finding below was
checked against the code at `d303d818`. They fall into four families.

### 1. A pure rule inline in the hook

- **The prefill rule lives in `useMovieForm`'s callback.** `prefillFolderKey`
  defines a local `yearOf`, then decides `takesTitle` and `takesYear` in a
  `setValues` updater. It reads no state, no ref and no effect: it is a pure
  function of the current values, the read's key and the picked one. Every
  other pure value builder of the form (`movieFormValues`, `movieAddValues`,
  `showFolderRows`, the very rows this pick fills) lives in `formValues/`,
  each with its table in `formValues.test`.
- **One rule is written twice, two ways.** The title is taken when it is
  empty or `=== picked?.title`; the year when it is empty or
  `picked !== null && === yearOf(picked.year)`. It is the same rule (log 65
  Q7: _the title's rule, field by field_) over two field texts, and the
  second spelling hides that.
- **The year's field text is spelled twice.** `yearOf` in the hook and
  `movieFormValues`' `movie.year === null ? '' : String(movie.year)` are one
  rule: the field is text, and no year is an empty box.
- **`PickedKey` lives in the hook and is imported by the form.** It is the
  shape the pure rule reads; the hook already imports `showFolderRows` from
  `formValues/`.

### 2. `titleKey` after the guess left

- **The tail strip is written twice.** `titleKey` strips the tail forms
  with its own inline loop; `stripTails`, written for `titleGuess` and now
  serving `searchQuery` alone, is the same loop. The glossary's **Search
  query** row (amended by the build) already calls it _the **Title key**'s
  tail strip_.
- **`SPACE_SEPARATORS`' docblock gives a reason that isn't so.** Issue 631
  rewrote it to say a hyphen stays _because `Spider-Man` is a title and TMDB
  is asked it as one_, but `searchQuery` turns every non-letter, non-digit
  into a space, the hyphen with it. The hyphen stays because **Release
  noise** is spelled with one (`WEB-DL`, `Blu-ray`): read as a space before
  the noise cut, `WEB-DL` would no longer be a noise word.

### 3. Words the build left behind

- **Four test headers and one test name still say **Title guess** for a
  picked folder**: `readShowFolder.seasonFolder.test`'s header,
  `MovieForm.showFolder.test`'s header and its _fills an empty title with
  the Title guess_, `MovieForm.showFolderTitle.test`'s header (_a second
  pick replaces a picked title with its own **Title guess**_). The two
  `MovieForm.test` blocks that say Title guess mean `titleFromFilename` and
  are right.
- **`useShowFolderPick`'s docblock ends _and the title the first pick filled
  in_**: since 630 it is the title and the year.
- **`readShowFolder.test`'s Folder key table asserts the read's whole key
  set in every row.** The six names each re-assert that the read carries
  `title` and `year` and no `titleGuess`, a fact about the shape, not the
  name; `routes.showFolder.test` asserts the same shape on the wire.
- **The prototype container's simulation comment still says _an empty title
  takes the Title guess_** (`FamilyFlix.dc.html`, `addShowFolder`). Log 65
  Q2 amended the same sentence in `feat.MovieForm.dc.html` and missed its
  copy in the container. The simulation itself is right: its yearless
  `Harbor Lights` fills an empty title and no year, as a Folder key does.

### 4. The documents

- **The feature checklist's row reads _Show folder title_, ⬜ Planned**, and
  step 48 is ⬜.
- **The README** says what a show folder pick does with episodes, and
  nothing of the title and year it now fills.
- **The release checklist's linked series add** smoke picks a show folder
  and checks only that its episodes play.
- **The journal has no entry for the initiative**: its build had no walk
  and documents slice, so this round writes the one entry.

## Solution

One round in four groups, each commit leaving the suite green and the
typecheck clean:

1. **The prefill rule beside the rows it fills**: `PickedKey` and a pure
   `folderKeyValues` in `formValues/`, one private `takesPick` rule for both
   fields and one private `yearText` for both year spellings.
2. **`titleKey` with one tail strip** and a true docblock for
   `SPACE_SEPARATORS`.
3. **Words**: the test headers, the hook's docblock, one shape assertion,
   and the container's comment.
4. **The docs that close step 48**, then the journal.

No behaviour changes. No wire, schema, route, setting, copy, drawn pixel or
prototype state changes; the only prototype edit is a comment, in the words
log 65 Q2 already settled.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [show-folder-title] issue #632 …`, except where a commit is
named `test:` or `docs:`.

### Group 1: the prefill rule beside the rows it fills

1. **`PickedKey` moves to `formValues/`.** The type and its docblock move
   beside `showFolderRows`, the other half of what a pick hands the form.
   `useShowFolderPick` imports it from `formValues/` with `showFolderRows`;
   `useMovieForm` imports it from there, not from the hook. Types only.
   Guarded by `useShowFolderPick.test` and the `MovieForm.showFolder*`
   suites, unchanged.
2. **`yearText`, one spelling of a year as field text.** A private
   `yearText(year: number | null): string` in `formValues/`, `''` for
   `null`, takes the comment `movieFormValues` holds today (_the field is
   text, so a year is text … an empty box rather than the word "null"_).
   `movieFormValues` calls it. `problemFormValues`' `row.year === undefined`
   reads a Sheet row's optional year and stays as it is. Guarded by
   `formValues.test`'s `movieFormValues` and round-trip tables, unchanged.
3. **`folderKeyValues(current, key, picked)`.** An exported pure function in
   `formValues/` answering the form's values after a pick offers `key`:
   each of title and year replaced when `takesPick` says so, else kept. A
   private `takesPick(field, picked)` holds the one rule (_empty, trimmed, or
   still what the earlier pick filled_), called once with the title and the
   picked title, once with the year's text and the picked year's text
   (`undefined` before any pick). Its docblock takes the hook comment's
   sentence and names log 65 Q7. `useMovieForm`'s `prefillFolderKey` becomes
   `setValues((current) => folderKeyValues(current, key, picked))` under a
   one-line comment pointing at it; `yearOf`, `takesTitle` and `takesYear`
   go. `formValues.test` gains a `folderKeyValues` table beside
   `showFolderRows`': an empty form filled; a typed title and a typed year
   kept; each field decided apart; a picked title and year replaced; a
   yearless key emptying a picked year and leaving an empty one empty; a
   field cleared to spaces counting as empty. Guarded too by
   `MovieForm.showFolderTitle.test` and `MovieForm.showFolderYear.test`,
   unchanged.

### Group 2: `titleKey` with one tail strip

4. **`titleKey` strips by `stripTails`.** `stripTails` moves up beside
   `TAIL`, whose docblock already says _stripped from the end for as long as
   one is there_; `titleKey`'s inline loop becomes a call to it, after the
   case and separator fold as now. `SPACE_SEPARATORS`' docblock says why the
   hyphen stays: **Release noise** is spelled with one (`WEB-DL`,
   `Blu-ray`), so it must still be whole when the noise is cut; `searchQuery`
   turns it into a space afterwards like any other mark. Guarded by every
   `titleKey`, `searchQuery` and `RELEASE_NOISE` table in `titleKey.test`,
   the export-list test, the **Search ladder** suites and the importer's
   matching suites, unchanged.

### Group 3: words

5. **`test: [show-folder-title] issue #632 the tests say the Folder
key`.** Comments and one test name, assertions unchanged:
   `readShowFolder.seasonFolder.test`'s header says a picked Season folder
   is named by its Show folder's **Folder key**; `MovieForm.showFolder.test`'s
   header says an empty title takes the read's title, and its test reads
   _fills an empty title with the read's title_;
   `MovieForm.showFolderTitle.test`'s header says a second pick replaces a
   picked title with its own read's title. In `readShowFolder.test` the key
   set moves out of the six-row table into one test of its own (_answers
   `title` and `year`, and no `titleGuess`_), so each row asserts only its
   title and year.
6. **`useShowFolderPick`'s docblock** ends _and the title and year the first
   pick filled in, never a typed one_. Comments only.
7. **`docs: [show-folder-title] issue #632 the container says the folder's
title`.** `FamilyFlix.dc.html`'s `addShowFolder` comment reads, as log 65
   Q2 worded `feat.MovieForm.dc.html`'s: _an empty title takes the folder's
   title, and an empty year its year, both read as a scan reads the
   folder's name (log 65)_. Comment only; no state, simulation or copy.

### Group 4: the docs

8. **`docs: [show-folder-title] issue #632 the docs know the pick's
title`.**
   - **Feature checklist**: the row reads _Show folder title: a pick reads
     its Folder key_, ✅; step 48 goes ✅ in step 47's shape (_Built in
     issues 629 to 631; the closing round in issue #632_). Step 49 stays
     ⬜.
   - **README**: line 54's sentence on the show folder pick adds that it
     names the show and its year as a scan reads the folder.
   - **Release checklist**: the linked series add smoke names its show
     folder with a running range (`Smoke Show (2022–)`), and before adding
     it under **Link** checks the Title field reads _Smoke Show_ and the
     Year field _2022_.
   - **Glossary**: checked against the round; **Show folder read**, **Show
     folder pick** and **Title guess** (log 65) already say what the code
     does. `folderKeyValues` is a unit name, not a term.
9. **`docs: [show-folder-title] issue #632 the journal`.** A newest-first
   entry in `docs/dev-journal.md`, the initiative's only one, in the last
   refactor entry's shape: what the build shipped (629 to 631), what each
   group changed, where the round left the plan, the test count and lint
   against `d303d818`, and the follow-ups (none expected). The commit
   closes 628 in words, not with a keyword, and this issue with one.

## Decision Document

- **The prefill rule is pure and lives in `formValues/`**, beside
  `showFolderRows`, as `folderKeyValues(current, key, picked):
MovieFormValues`. Named in the file's noun shape (`movieAddValues`,
  `problemFormValues`): the values a Folder key leaves the form with.
  `useMovieForm` keeps `prefillFolderKey` as the hook input's name (log 65
  Q9); only its body changes.
- **One rule, two fields.** A private `takesPick(field, picked)` decides a
  field over its text; the year is compared as text, so a picked `null`
  year (`''`) and an empty field agree, which the old
  `picked !== null &&` guard spelled out by hand.
- **`PickedKey` is `formValues/`'s**, still
  `Pick<ShowFolderRead, 'title' | 'year'>` and still named as log 65 Q9
  named it.
- **`yearText` is private to `formValues/`**, for a `number | null` year.
  A Sheet row's `undefined` year is a different input and keeps its own
  line.
- **`titleKey` and `searchQuery` share `stripTails`.** No change to `TAIL`,
  `SEPARATORS`, `SPACE_SEPARATORS`, `RELEASE_NOISE` or `DASHES`, or to what
  any of them match; the export list stays `DASHES`, `RELEASE_NOISE`,
  `searchQuery`, `titleKey`.
- **The container's comment follows log 65 Q2's wording.** That grill-me
  settled the sentence; this round copies it to the one place it missed.
- **Nothing on the wire, the schema, the routes, the sheet, the drawn
  screens or the prototype's state changes.**

## Testing Decisions

- **A good test asserts what the maintainer or a caller sees**: what the
  Title and Year fields read after a pick, what the read answers for a
  folder name, what TMDB is asked for a title. It never asserts which
  helper ran or what a ref holds.
- **The initiative's suites carry every refactor commit**:
  `readShowFolder.test` and its `layout`, `oneReader`, `seasonFolder` and
  `seasonOne` suites; `routes.showFolder.test`; `useShowFolderPick.test`;
  `MovieForm.showFolder`, `showFolderEdges`, `showFolderPaths`,
  `showFolderTitle` and `showFolderYear`; `formValues.test` and
  `formValues.seasonGuess.test`; `titleKey.test`; `titleFromFilename.test`.
- **One new table**: `folderKeyValues` in `formValues.test`, since it is an
  export of a unit whose every export has its `describe`. Prior art:
  `showFolderRows`' and `movieAddValues`' tables in the same file. Its
  rows restate the rule the `MovieForm.showFolderYear` suite already
  proves through the screen; neither replaces the other.
- **`stripTails` and `takesPick` and `yearText` stay private**, driven
  through `titleKey`, `searchQuery`, `folderKeyValues` and
  `movieFormValues`.
- **One suite changes shape, not meaning**: `readShowFolder.test`'s key-set
  assertion moves out of the table into one test (commit 5).
- **Prior art for the rhythm**: the rescan-a-folder round (issue 625).

## Out of Scope

- **A series' year as a span.** The Year field of a series edit spells
  `2022–2025` (`spellYearSpan`), while a pick of `Severance (2022–2025)/`
  fills `2022`, as log 65 Q6 decided (the key's year, a range's first).
  Filling a span from a range is a behaviour question for a grill-me.
- **`titleFromFilename`** (log 65 Q1) and its own `SPACE_SEPARATORS`, a
  client copy of the server's: the two build targets share no helper by
  design.
- **The glossary's older per-log rows** (logs 48, 54) that still name
  `titleGuess`: snapshots by the glossary's own convention.
- **Step 49, Missing videos.**
- **The lint error and the warnings that predate the initiative.**

## Further Notes

- **Commit 3 depends on commits 1 and 2.** Commit 4 is independent of
  group 1; group 3 of everything.
- **Commit 5 is the only `test:` commit**, and it is green: comments, one
  test name and one moved assertion.
