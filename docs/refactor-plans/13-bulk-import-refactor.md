# Refactor plan: Bulk import — each rule spelled once, each wire call with its caller, and the docs that close the initiative

> Source initiative: [`bulk-import`, issue #123](https://github.com/carlos-rezai/FamilyFlix/issues/123)
> Shipped by issues 124–133. Design log: `docs/design-logs/13-bulk-import.md`.
> Filed as issue 135. The docs-and-glossary slice filed as 134 is
> folded in here as Group 0 and Group 5, so the initiative has one closing
> issue rather than two, and ticks ✅ when this one closes.

## Problem Statement

Bulk import was the largest initiative so far — ten slices, a new server
domain, three new `media/` units, a new molecule, a feature with eight units,
a third job for the Movie form, and the seed's removal — and the second driven
end to end by `issue-loop`, one fresh subagent per step. It works: a sheet and
a folder tree become movies on the browse home, every acceptance criterion
holds, and #133's twenty-eight edge tests passed on arrival. What a
read-through with the earlier rounds' rules in hand finds is the same kind of
debt the delete-movie round found, at the scale of a ten-slice initiative:
nothing wrong, several things spelled twice because two slices each needed
them and neither saw the other, two wire calls living in the wrong feature,
and one invisible byte.

### 1. The runtime derivation is spelled twice, and the code says so

`routes/derivedRuntime` derives a film's runtime from the bytes that just
landed — `playback.videoFile`, then `playback.duration`, rounded, never
throwing. The importer needs exactly that after every copy, and could not
import it: a domain must not reach into the HTTP layer. So `createImporter`
carries `runtimeMinutes`, the same eleven lines, with a docblock that ends
"lifting the one helper into `playback/` is the refactor step's, not this
slice's". This is that step.

### 2. Three lists of what a file may be called, in two folders

`routes/uploadKinds` holds the poster and subtitle extension lists behind
`isPosterFilename` and `isSubtitleFilename`, with a security docblock about
why the store decides rather than the client. `media/scanMovieFolder` holds
the same two lists again — `IMAGE_EXTENSIONS` is `POSTER_EXTENSIONS` value
for value, `SUBTITLE_EXTENSIONS` is spelled with the same comment ("the same
four `parseSubtitle/` dispatches on") — plus the video list that only the
scanner needs, and its own `hasExtension`. The scanner could not import the
route unit for the same reason the importer could not import
`derivedRuntime`. CLAUDE.md gives "subtitle detection" to `media/`; the lists
belong there, and the route reads them from there as it already reads `Media`.

### 3. The subtitle pairing is spelled twice in `routes/index.ts`

The edit route reads its tracks "pairwise off two fields with the parts
threaded through them": the i-th language belongs to the i-th `subtitlePath`,
an empty path is a row whose file arrived as bytes, `picked.shift()` takes the
next stored part. The resolve route reads its tracks with the same twenty
lines, one `slot()` call different. `movieFormBody` is where "the file half of
a Movie form body, which the add and the edit read identically" already lives,
and the pairing is that half's last piece still inline.

### 4. One byte nobody can see

`filmKey` — the title key and the year, joined, that the already-in-library
skip compares — joins them with a literal U+0000 typed into the template
string. `grep` answers "Binary file matches" for the whole of
`createImporter.ts`, `file` calls it `data`, and an editor that normalises
control characters would silently change the key. The separator is a sound
choice (a title key holds letters, digits and spaces, so nothing can collide
with it); its spelling is not. `'\0'` says the same thing visibly.

### 5. Two wire calls in the wrong feature, and one that two features share

`features/import-export/api` exports `fetchProblem`, `resolveProblem` and
`ProblemGoneError`, and their one caller is `movie-form/useMovieForm`. To make
the resolve body, `import-export/api` imports `movieFormData` from
`movie-form/formValues`. So the two features import each other's wire in both
directions — exactly what the `api/` rule exists to prevent. By that rule as
CLAUDE.md states it: a call with one caller stays with the feature that makes
it, so the two problem calls belong beside `createMovie` and `updateMovie`
where `movieFormData` is a local import; and `dismissProblem`, which
`useImportRun`'s Skip and `useMovieForm`'s Skip this one both send, is the one
call that has earned `src/api/`.

### 6. The Maintainer's header and field spelled three times

`MovieForm.styles.ts` and `ImportFlow.styles.ts` each define `HeaderRow`,
`Heading` and `Lede` — character for character the same, down to the lede's
`0 0 28px 58px`. `SettingsHeader.styles.ts` defines the first two a third
time, a pixel and a `flex: 1` apart. `MovieForm.styles.ts` and
`ImportSetup.styles.ts` each define `Field` (the `label` with the
focus-within accent line on the `TextField` box) and `FieldLabel` (the
prototype's `labelStyle`, 13px/600/0.2px) — again verbatim. In the prototype
these are one `labelStyle` and one header the container hands to both
features. `layouts/chrome.styles.ts` and `components/fileRow.styles.ts` are
the precedent for a rung's furniture: "written twice, character for
character", so lifted to a flat styles file at the rung, which each unit
extends and neither owns.

### 7. Two pixels and a premise

`Button`'s new `sm` size spells its corner as four longhands, with a comment
that jsdom "never expands the shorthand, and the review rows' tests read a
corner". `TextField`'s tests read `borderRadius` off a shorthand and pass, and
so does `Button`'s own `sm` test once it reads `borderRadius` — verified
before this plan was written: shorthand in, three suites green, reverted.
The longhands are a test-shaped deformation of shipping code with a false
premise; `md` and `lg` one block down show the right spelling.

`PhaseStepper` writes the ink on a coloured dot as `DOT_INK = '#14110d'` with
a comment saying it is `bg`. It is: `colors.bg` is `#14110d`. `Button`'s
`#1a1109` is the precedent for a literal — kept because "no `--color-*` fits
it" — and this one has a token that fits.

### 8. The form's copy as four tables

`MovieForm` holds `ADD`, `EDIT`, `IMPORT` and `IMPORT_EDIT`, four objects
over three keys, chosen by a nested ternary over `resolving` and `editing`.
The heading depends on the job alone (Add a movie / Edit details) and the
Save label on the context alone (Save & continue in import, else the job's);
the four tables are the product of two independent axes written out.

### 9. Shipping code narrating slices

`useMovieForm`'s docblock and comments carry "(#130)", "(#131, story 102)",
"(#132)", "story 94", "(#132, story 93)"; `MovieForm` carries "(#132)" and
"story 82's fixed phrasing"; `formValues` carries "from #130"; the importer
"story 84"; the scanner "the `no-video` Problem of the review slice". The
movie-form round's rule (its commit `02d20da`) is that shipping code says
what is true, not which slice made it true — the git log has the slices. The
PATCH handler's "the whole acceptance criterion this slice is demoable on",
which round 12 left for "whoever next opens the file", is picked up here
because this round opens the file.

### 10. Two suites each wrote the same two test doubles

`createImporter.test.ts` and `routes.import.test.ts` each build a sandbox by
copying the importer's fixture tree and sheet under a `sandboxRoot`, and each
write a `Media` seam that holds one copy until the test lets it go
(`holdCopyOf` and `gatedSeam`). The two seams differ in one thing that
matters: the importer's forwards every argument, so the cancel signal reaches
the real copy; the route's calls `real.copyIn(folder, source)` and drops it.
`server/src/test-support/` exists for exactly this.

Beside that, the split-by-slice blocks the delete round regrouped: the route
test describes `GET /api/import/current/problems/:id` twice (Phase 5, then "—
a no-row problem" from the next slice), the importer test describes `problem`
twice the same way, and `api.test.ts` ends with a block of `expectTypeOf`
assertions over `src/types/import.ts` — a test of a type file's shape,
sitting in a feature's wire test, whose runtime `expect`s compare a literal to
itself. Every other suite that builds an `ImportRun` already pins that shape,
and the typecheck pins the rest.

### 11. The docs the initiative owes

Issue 134's list, merged here: the journal entry; CLAUDE.md's folder map and
README's tree, neither of which yet names `LogConsole`, the
`features/import-export/` units, `LibrarySection`, `ImportPage`, the
`import-export/` domain's units, the `media/` scanners, `Media.copyIn`, the
import types, or `TextField`'s `mono`; the glossary, which says **Copy-in** is
`fs.copyFile` where the build chose a stream so a 12 GB copy can be stopped,
says **Title key** folds "dots and underscores" where the code also folds
hyphens and a quality tag, and says a **Match** is one key-equal folder where
the matcher also requires exactly one video; and COMPONENT-SPEC's
`LibrarySection` row, which gives it `{ onAdd, onImport }` where the section
shipped owning its routes on `SettingsHeader`'s precedent.

## Solution

Six groups, each a working tree after every commit: the server first, because
its duplicates are the ones with a docblock asking for the fold; the frontend's
wire calls and furniture second; the pixels and the narration third; the test
doubles and regroups fourth; the docs last, because the folder map has to
describe the tree the earlier groups leave. The journal entry for the build
itself goes first of all, so it records what shipped before this round moves
it. Twenty-nine commits.

## Commits

### Group 0 — the record of what was built

1. **The journal's bulk-import entry.** `docs/dev-journal.md` gets the
   initiative's entry, dated by the last build commit (2026-09-14): what
   shipped across #124–#133, what was deliberately not built (the fifth
   `importRun/` unit the log sketched, see the decision document; the
   backdrop on a resolve; `isUnder` as a lexical check), and the follow-ups —
   which are this plan, by bare number.

### Group 1 — the server: one rule spelled once

2. **`derivedRuntime` moves to `playback/`.** `git mv` the unit and its test
   from `routes/derivedRuntime/` to `playback/derivedRuntime/`; the two
   routes that call it import the new path. Its docblock loses nothing — it
   is a function over `Playback`, and `playback/` is where a function over
   `Playback` lives. Test unchanged.

3. **The importer asks `derivedRuntime`.** `createImporter` drops
   `runtimeMinutes` and `SECONDS_PER_MINUTE`, and both call sites read
   `derivedRuntime(playback, path)`. The one branch the importer's copy did
   not have — an empty stored path answers `null` — is unreachable from a
   path `copyIn` just answered. Every importer test unchanged.

4. **`ImportField` is a shared type.** `'sheet' | 'root'` — the field a
   refusal names on the wire — moves from `createImporter.ts` and
   `features/import-export/api/api.ts`, where each spells it, to
   `src/types/import.ts`, re-exported from the barrel; both sides import it.
   The wire body `{ error, field }` is what the two already agree on.

5. **`filmKey`'s separator is spelled.** The raw U+0000 in the template
   string becomes `'\0'`, joined explicitly. Same string, same key; `grep`
   and `file` stop calling the source binary. The already-in-library tests
   are the check.

6. **`uploadKinds` becomes `media/fileKinds`.** `git mv` the unit and its
   test to `media/fileKinds/`; `isPosterFilename` is renamed
   `isImageFilename` — the predicate is about the file, and a backdrop is an
   image the poster slot never sees — and the routes' body reader imports
   both predicates from `media/`, as the routes already import `Media`. The
   security docblock moves whole: the store deciding what it will hold is the
   media domain's concern before it is the route's. Test leaf names unchanged.

7. **The scanner reads `fileKinds`.** `isVideoFilename` and
   `VIDEO_EXTENSIONS` move from `scanMovieFolder` into `fileKinds`, with the
   scanner's note on why the video list is not the form's video slot's;
   `scanMovieFolder` drops its three lists and its `hasExtension` and reads
   the three predicates. `walkLibraryRoot` imports `isVideoFilename` from
   its new home. One `hasExtension`, `extname`-based, for all three. The
   scanner's and walker's tests unchanged.

8. **`subtitleRows` in `movieFormBody`.** Extract the pairwise read from the
   edit route as `subtitleRows(fields, uploads, languages)`: one entry per
   row that named a path or sent bytes, each `{ language, stored?, path? }`
   — `stored` the part this request wrote, `path` the field as it arrived —
   with `DEFAULT_SUBTITLE_LANGUAGE` moving in beside it. The edit route maps
   `stored ?? path`. The edit's subtitle tests unchanged; `movieFormBody`
   gains the pairing's own cases (a mixed list keeps its order, an empty
   path is a row from bytes, a row with neither is no track).

9. **The resolve route reads `subtitleRows`.** Its twenty lines become a map
   from each row to a `ResolveFile` — `stored` when the part arrived, `found`
   from the path otherwise. Resolve's subtitle tests unchanged.

10. **The add route reads `subtitleRows`.** `movieFormData` sends an empty
    `subtitlePath` for every picked track on the add as on the edit, so the
    add's `forEach` over upload slots is the same read with the path column
    always empty. The add's subtitle tests unchanged — this is the commit to
    watch, and the one to drop if any of them moves.

### Group 2 — the frontend: each wire call with its caller, the furniture once

11. **`dismissProblem` moves to `src/api/`.** One folder with its test,
    imported by path from `useImportRun` and `useMovieForm`, on
    `saveFavorite`'s precedent: two features send the same `DELETE`. Its
    tests move with it.

12. **`fetchProblem` and `resolveProblem` move to `movie-form/api`.** With
    `ProblemGoneError`, beside `createMovie` and `updateMovie`; `movieFormData`
    is now a local import, so `import-export/api` no longer reaches into
    `movie-form` and `useMovieForm` no longer reaches into `import-export`.
    Their tests move with them. `resolveProblem` stays its own function rather
    than a third `sendMovie` — the `404` it turns into `ProblemGoneError` is
    the third parameter `sendMovie`'s docblock says would force the
    extraction.

13. **`features/maintainer.styles.ts`: the header.** `HeaderRow`, `Heading`
    and `Lede` lifted verbatim from `MovieForm.styles.ts` and
    `ImportFlow.styles.ts`, which import them; the docblock on
    `chrome.styles.ts`'s pattern (each feature extends the furniture, neither
    owns it). Same pixels; checked in the browser on `/add` and `/import`.

14. **The field joins the furniture.** `Field` (the focus-within label) and
    `FieldLabel` lifted from `MovieForm.styles.ts` and `ImportSetup.styles.ts`.
    `MovieForm`'s `Field` becomes `styled(Field)` adding its `flex: 1`;
    `NarrowField` and `WideField` extend that as they do now. Same pixels.

15. **`SettingsHeader` extends the same furniture.** Its `Heading` becomes
    `styled(Heading)` adding `flex: 1`; its `HeaderRow` becomes
    `styled(HeaderRow)` with the prototype's own 6px margin. Same pixels;
    checked on `/settings`.

### Group 3 — the prototype's own values, and what the code says

16. **`Button` `sm` writes its corner once.** The four longhands and their
    comment become `border-radius: ${theme.radius.sm}`, as `md` and `lg`
    spell theirs; `Button.test.tsx` reads `borderRadius`. Verified green
    before filing, with `ProblemRow` and `ImportReview`.

17. **The stepper's dot ink is `colors.bg`.** `DOT_INK` goes; the two `css`
    arms read `theme.colors.bg`. Same pixel.

18. **The form's copy on two axes.** `ADD`, `EDIT`, `IMPORT` and
    `IMPORT_EDIT` become a heading chosen by `editing` and a save pair chosen
    by `resolving`, then `editing`. Same strings on screen; `MovieForm`'s
    label tests are the check.

19. **Shipping code stops narrating slices.** The issue and story numbers in
    `useMovieForm`, `MovieForm`, `formValues` (and its one over-long docblock
    line), `createImporter` and `scanMovieFolder` are dropped or reworded to
    say what is true; the PATCH handler's leftover sentence goes with them.
    Comments only. `eslint` and `tsc` are the check.

### Group 4 — tests read by behaviour, doubles written once

20. **`server/src/test-support/heldCopy/`.** The seam both suites wrote: a
    `Media` whose first copy — or the first of a named file — waits until
    released and says when it was reached, forwarding every argument so the
    signal reaches the real copy. `createImporter.test.ts` and
    `routes.import.test.ts` read it; the route suite's `gatedSeam`, which
    dropped the signal, goes. A unit test of its own, as `freshStorage` has.

21. **`server/src/test-support/libraryFixture/`.** The importer's fixture
    tree and sheet copied under a `sandboxRoot`, answering `{ root, sheet }`;
    both suites read it in place of their own `cpSync` pairs. The fixture
    files stay where they are, under `createImporter/`, because they are the
    importer's.

22. **One `GET …/problems/:id` block; one `problem` block.** In
    `routes.import.test.ts`, the "— a no-row problem" block's tests move into
    `GET /api/import/current/problems/:id` under a nested block named for the
    kind; in `createImporter.test.ts`, "problem: a no-row opening" joins
    "problem: the detail Resolve prefills from" the same way. Leaf names
    unchanged; the verbose reporter before and after, diffed.

23. **The types block goes.** `api.test.ts` loses "the shared import types":
    its `expectTypeOf`s are the `spec` typecheck's job and its `expect`s
    compare literals to themselves. Six tests fewer, none of them a
    behaviour.

### Group 5 — the docs that close the initiative

24. **COMPONENT-SPEC says what shipped.** The `LibrarySection` row: no props;
    the section owns its two routes as `SettingsHeader` owns its one. The
    `ImportFlow` row already says the organism owns the hook and the steps.

25. **CLAUDE.md's folder map and README's tree.** `components/LogConsole`;
    `features/import-export/`'s units (the organism, the three steps, the
    three molecules, the run hook, the pure view, its `api/`);
    `features/settings/`'s `LibrarySection` and `ActionRow`;
    `features/maintainer.styles.ts`; `pages/ImportPage`; `api/dismissProblem`;
    `server/src/import-export/`'s four units and the fixture; `media/`'s
    `walkLibraryRoot`, `scanMovieFolder`, `detectSubtitleLanguage`,
    `fileKinds` and `Media.copyIn`; `playback/derivedRuntime`; the two new
    `test-support/` units; `types/import.ts`; `TextField`'s `mono` and the
    two glyphs; `Button`'s `sm`. The **Bulk Import / Export** section's
    prose checked against the build (copy by a stoppable stream; four units,
    not five).

26. **The glossary checked against what shipped.** **Copy-in**: a stream
    piped under the cancel signal, not `copyFile`, and why. **Title key**:
    hyphens fold too, and the tail forms include a quality tag. **Match**:
    exactly one video as well as exactly one folder. The session-entry rows
    for **Library root**, **Source folder**, **Problem**, **Found file**,
    **Stored path**, **Import context**, **Activity log**, **Warning line**
    and **Needs attention** read against the code and left where they hold.

27. **The journal's paragraph for the round.** What each group changed,
    the test count before and after, what was deliberately left (the
    decision document below, in prose).

28. **The feature table ticks.** README and CLAUDE.md tick **Bulk import** and
    **Import progress console** ✅ — the project rule is that a feature is
    Done when its refactor closes, not when its build issues do. Closes 135.

29. **Issue 134 closed as folded in**, by comment, referencing this issue by
    bare number. _(Done at filing time, not as a commit.)_

## Decision Document

- **`importRun/` is not extracted.** The log and the plan sketched five
  units for the domain; the build made four, with the run's state machine
  (`execute`, `importMatch`, the log and problem writers) as closures inside
  `createImporter` over the run, the sources map and the abort controller.
  Pulling it out would mean passing all three across a seam nobody else
  uses, to be tested through the same `start` → `current` walk it is tested
  through now. The docs say four units, and why.
- **`isUnder` stays lexical, and is named.** The resolve route's containment
  check uses `path.relative` rather than `realpathSync`, so a symlink under
  the library root pointing outside it would be copied from. `mediaFilePath`
  and `containedFolder` resolve real paths. Tightening it is a behaviour
  change with its own test, not a fold, and it is the delete round's own
  ruling again: lifting the containment rule into one module both domains
  import is a round that owns both. Filed as a follow-up in the journal.
- **`derivedRuntime` is a unit in `playback/`, not a method on `Playback`.**
  A method would change the domain's interface and every double of it; a unit
  over the interface changes nothing but two import paths, and is what the
  importer's docblock asked for.
- **`fileKinds` lives in `media/`, security docblock and all.** The route
  layer may import from a domain; a domain may not import from the route
  layer; and the argument in the docblock — the store decides what it holds
  because `express.static` serves whatever is under it — is about the media
  root, which is the media domain's. The video list sits beside the other
  two with its own note: the form's video slot deliberately does not consult
  it.
- **`subtitleRows` answers both columns and lets the caller decide.** The
  edit reads a path as a Stored path and the resolve reads it as a Found
  file; the pairing does not know which and should not. The add reads the
  same shape with the path column always empty.
- **The wire rule is applied exactly as CLAUDE.md states it.** One caller →
  the feature that makes the call; two callers → `src/api/`. `dismissProblem`
  is the third call to earn the folder after `saveFavorite`, `fetchMovie` and
  `saveWatched`; `startImport`, `fetchCurrentImport` and `cancelImport` stay
  in `import-export/api` with their one caller.
- **Furniture at the features rung, on the two precedents.** A flat
  `maintainer.styles.ts` beside the feature folders, as `chrome.styles.ts`
  sits beside the layouts and `fileRow.styles.ts` beside the molecules; each
  feature extends it and states only what is its own. Not a molecule: the
  prototype has no `mol.*` for a labelled field or a page header — they are
  container-level styles handed to two features, which is what a furniture
  file is.
- **A literal is kept only when no token fits.** `#1a1109` on the accent
  fill stays (`Button`'s precedent); `#14110d` on the stepper's dot goes,
  because it is `colors.bg`. The `99px` dot radius, the `50%` stepper circle,
  the `9px` glyph tile and the `10px` field corner all stay: each is the
  prototype's own literal and none is a token's value.
- **The language pool stays spelled on both sides.** The seven names live in
  `MovieFormFiles` for the dropdown and in `detectSubtitleLanguage` for the
  tag table, and `'English'` as the default is spelled in three places. One
  shared `as const` list in `src/types/` would let TypeScript hold the two in
  agreement — but the server imports only types from `src/` today, and a
  runtime import across build targets is a new kind of dependency to take
  deliberately, when the settings hub's subtitle preference makes the pool a
  wire value. Named, not folded.
- **The phase banners in the test files stay.** Round 12's ruling on
  `createMedia.test.ts`: the top-of-file `// 13 — Bulk import, Phase n` banner
  is the file's convention. What this round regroups is behaviour split
  across two `describe`s by a build boundary, not the banners.
- **`useMovieForm` keeps its four-way save.** The nested ternary over
  `resolving` and `editing` chooses among four writes and four destinations;
  it is one expression, each arm one line, and a table would be the same four
  arms with a name. The copy tables in `MovieForm` are different: two axes
  written out as their product.

## Testing Decisions

- A good test here asserts what the maintainer can see or what the wire
  answers: a movie on the browse home after a run, a `400` naming the field, a
  row gone from the review after Skip, a corner measured off a rendered
  button. None of the commits above changes what any test asserts; the check
  is the one the last three rounds used — the verbose reporter's leaf names
  before and after, diffed — with two deliberate exceptions: commit 8 adds
  the pairing's own cases to `movieFormBody.test.ts`, and commit 23 removes
  six that were never behaviour. Baseline at filing: **3857 tests across 199
  files**, `npm run typecheck` green, `eslint src server` clean.
- Group 1 is covered end to end by `createImporter.test.ts` (the fixture
  becomes two movies, with runtimes), `routes.import.test.ts` (resolve with
  found and picked subtitles), `routes.test.ts` (the edit's mixed subtitle
  lists), and the moved units' own tests, which travel with them under
  `git mv`. Commit 10 is the one to watch: the add's subtitle tests must pass
  unchanged or the commit is dropped and the add keeps its `forEach`.
- Group 2's moves are checked by the moved tests passing at their new paths
  and by `eslint`'s import rules; the furniture commits have no automated
  test, on every pixel round's footing — a styled block reached by import
  rather than by definition is not a behaviour — and are checked in the
  browser on `/add`, `/import` and `/settings`.
- Group 3: commit 16 was run before filing (`Button`, `ProblemRow`,
  `ImportReview` green with the shorthand); 17 is a token resolving to the
  same string; 18 is held by `MovieForm.test.tsx`'s label and heading tests
  across all three contexts; 19 is comments.
- Group 4 changes nothing but where a double is defined and where a test's
  name sits. `heldCopy` gets a unit test of its own, on `freshStorage`'s
  precedent: that the copy waits, that `reached` resolves when it is held,
  and that the signal it is handed reaches the real copy — the one thing the
  route suite's copy got wrong.
- Group 5 has no test; it is read.

## Out of Scope

- **A backdrop on a resolved movie.** The problem detail carries
  `files.backdrop`, the form has no backdrop slot, `ResolveForm` has no
  backdrop, and the resolve route reads none — so a film the run would have
  given a backdrop loses it when resolved by hand. A behaviour gap, not a
  refactor: named in the journal for the user to file.
- **`isUnder`'s symlink leniency** — see the decision document.
- **A shared listening-API harness.** `routes.test.ts` and
  `routes.import.test.ts` each build an Express app on an ephemeral port with
  their own `servers` array and `afterEach`; the second followed the first.
  A `test-support` unit for it would be a project-wide round, like the fetch
  double the delete plan declined.
- **A shared fetch double.** Still thirty-some files; still not this round.
- **`routes/index.ts` at 1480 lines.** This round takes ~40 lines out of it
  (the pairing) and adds none. The next cut is a routes round.
- **Any keyframe, corner or gap the prototype writes literally.** The round
  reaches into `Button` and `PhaseStepper` for the two rules it states and
  nothing else.
- **Export.** Its own grill.

## Further Notes

The delete round's note holds at ten times the size: four fresh contexts
each did exactly their slice, and the duplicates are the seams between them.
Two are worth naming as patterns rather than instances. The domain-cannot-
import-routes rule produced two copies (`derivedRuntime`, the extension
lists) because the shared thing had been filed under `routes/` by the first
initiative that needed it; the fix each time is to move it down to the domain
it is about, and the tell is a docblock that says "spelled here rather than
imported because". And the feature-cannot-import-feature rule was broken in
both directions by one slice that needed the form's encoding from the
import's wire — the tell is a relative import with two `..`s in it, which
`eslint` could be taught to refuse.

The NUL byte is the one finding no rule predicts. A subagent chose an
unambiguous separator and typed it as the character rather than the escape,
and nothing in the toolchain objected: TypeScript accepts it, Prettier keeps
it, the tests pass. Only `grep` noticed. Worth a `no-control-regex`-style lint
for string literals, if one exists; worth remembering either way.
