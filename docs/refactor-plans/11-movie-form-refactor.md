# Refactor plan: Movie form — the route layer, and four debts the build named

> Source initiative: [`movie-form`, issue #97](https://github.com/carlos-rezai/FamilyFlix/issues/97)
> Shipped by issues 98–107. Design log: `docs/design-logs/11-add-movie.md`.
> Journal entry: `docs/dev-journal.md`, 2026-09-10.
> Filed as issue 109. Follow-ups: 110, 111.

## Problem Statement

The `movie-form` initiative doubled the route layer. `server/src/routes/index.ts`
went from **786 lines to 1661**, and two of its handlers account for a third of
that on their own: `POST /api/movies` is 273 lines and `PATCH /api/movies/:id`
is 261.

Those two handlers are **near-literal copies of each other**. Both open a
multipart body with `readBody`, both dispatch parts three ways with the same
`part.resume()` guards, both reserve a slot in a subtitle array so `position`
survives concurrent writes, both coerce the same eight fields, both check the
same **Genre pool**, and both call `rollback()` before each of six identical 400
replies. What differs between them is genuinely small — where the **Movie
folder** comes from, and whether a refusal removes a whole folder or the
individual files this request wrote — and it is buried inside 530 lines of
agreement.

Around them sit **twenty module-level helpers**, roughly half of them added by
this initiative: `readBody`, `onlyField`, `optionalYear`, `optionalText`,
`optionalRating`, `isPosterFilename`, `isSubtitleFilename`, `derivedRuntime`.
None has a test of its own; all are exercised only through the 288 tests in
`routes.test.ts`. `optionalRating` is the sharpest example — it exists to tell
an absent field, an empty field and a posted `0` apart, because `Number('')` is
`0` and confusing the three would silently **score** a film rather than drop a
word. That is a pure function carrying a real trap, and it is reachable only by
starting a listener and sending a multipart body.

CLAUDE.md says the route layer is "HTTP layer only: parse request, call a domain
module, return response." The domain seam held perfectly — `media` arrives
injected and the route never learns there is a filesystem. It is the _parse
request_ half that has outgrown the file.

Three smaller debts were named during the build and are picked up here because
they are in the same code:

- **`renameFolder` has no test of its own.** It exists because busboy will not
  reach a part that follows a file until that file is consumed; buffering is out
  at 12 GB and the PRD rules out a staging area, so the folder is reserved from
  whatever fields had arrived and renamed once the title is known. It is the one
  method in `createMedia` reachable only through the route. `03761ca` named it as
  wanting its own test in this round.
- **`useMovieForm` has no test file.** At 352 lines it is the largest unit in
  `src/` with no test of its own. That was deliberate — the gate, the label and
  the destination are asserted through `MovieForm`, where a maintainer can press
  them — and it should stay deliberate rather than remain unexamined.
- **`createApiRouter`'s fourth argument is defaulted rather than required.**
  `media: Media = createMedia(mediaPath)`. The default exists so route tests can
  compose the router over a sandbox directory with three arguments; `main.ts`
  passes it explicitly anyway. `playback`, the seam this one was modelled on, is
  required. A default that exists for the tests is a seam pointed at the tests.

## Solution

Give request parsing a home, and leave the handlers holding only what a handler
should hold.

**One new sub-unit under `routes/`**, following the project's existing
one-folder-per-unit-with-its-test shape and taking no category barrel (the same
call `api/` and `test-support/` already made). Parsing a request _is_ the route
layer's job, so the helpers do not leave it — they stop being loose functions at
the top of a 1661-line file and become units with tests.

Then **one shared read of a Movie form body**, parameterised over the two things
the POST and the PATCH actually disagree about: how the **Movie folder** is
resolved, and what a rollback takes back. Both handlers call it and are left
with their own job — creating a record, or amending one.

Nothing about the wire changes. No route gains, loses or renames a field, no
status code moves, and no response body is reshaped. **If a single one of the
288 route tests has to be edited to describe different behaviour, the refactor
has gone wrong** — the only edits they should need are import paths.

## Commits

Each commit leaves the suite green and the app working. Run
`node_modules/.bin/vitest run`, `npm run typecheck` and
`node_modules/.bin/eslint src server` on every one.

### Group 1 — the pure coercers get folders and tests (no behaviour change)

Each of these moves one function into `server/src/routes/<name>/<name>.ts`,
writes its test, and leaves `routes/index.ts` importing it by path. Start here
because these are the cheapest possible steps and they build the pattern the
later groups follow.

1. **Move `onlyField`.** The "last value wins" read that `title` and `year` use.
   Its test states the thing its name does not: a repeated field keeps the last
   value, an absent one is `undefined`, and an empty one is `''` rather than
   absent.
2. **Move `optionalYear`.** Test the empty field, a non-numeric year, and a
   genuinely posted year.
3. **Move `optionalText`.** Test that a cleared field becomes `undefined` and not
   `''` — the detail page draws "—" from `null` and an empty gap from `''`, which
   is the whole reason this function exists separately from `onlyField`.
4. **Move `optionalRating` and `INVALID_RATING` together.** The most valuable
   test in this group: an absent field, an empty field and a posted `0` are three
   different answers, and off-scale, fractional and non-numeric values are the
   sentinel. This is the trap named in the problem statement, tested directly for
   the first time.
5. **Move `isPosterFilename` and `isSubtitleFilename`** into one `uploadKinds/`
   unit, or two units if they read better apart — decide when you see them. Test
   each extension in each allow-list, plus a bare name, an uppercase extension,
   and a double extension (`poster.png.html`). These are a security boundary:
   `/api/images` is `express.static` over the media root, so a stored `.html` is
   a page served from the app's own origin.

### Group 2 — the body reader gets a folder and a test

6. **Move `readBody`** into its own unit unchanged, with a test that drives it
   over a real `FormData` on a real listener — the seam `routes.test.ts` already
   uses, so there is prior art to copy rather than a new harness to invent. Test
   that a repeated name keeps every value in arrival order, that a part nobody
   handles is drained rather than left pending (a hung request is worse than an
   ignored file), and that a non-multipart body rejects.
7. **Move `derivedRuntime`** into its own unit with a test over a fake
   `Playback`. Test the probe answering, the probe failing and the header
   answering, neither answering, rounding to the nearest minute, and a positive
   duration under thirty seconds storing `null`.

### Group 3 — the shared body read

This is the group that shrinks the file. Take it one step at a time and keep the
suite green between each.

8. **Extract the part handler alone**, still called from both handlers, taking
   the folder resolution as a parameter. Both handlers keep their own field
   validation for now. This is the largest single reduction and the one most
   worth doing on its own so a failure is unambiguous.
9. **Extract the field validation** — title, rejected poster, rejected subtitle,
   year, director, description, rating, cast, genres and the **Genre pool**
   check — into the same unit, returning either a parsed record or a refusal
   (a status and a message) that the caller replies with. Do not have it write
   to `res`: a parser that sends responses cannot be tested without a listener,
   and this is the step that makes the whole thing a unit.
10. **Collapse the two call sites** to their differences: the folder resolver and
    the rollback. The POST reserves from the title and removes the folder; the
    PATCH opens the existing movie's folder and removes file by file.
11. **Delete whatever is now unreachable** in `routes/index.ts` and re-read the
    file top to bottom. Expect it back near its pre-initiative size.

### Group 4 — the three named debts

12. **Test `renameFolder` directly** in `createMedia.test.ts`, against the real
    sandbox directory the rest of that file uses. Assert that the stored paths it
    hands back re-anchor to the new folder, that it is a no-op when the name is
    unchanged, and that a collision with an existing folder does not destroy what
    is already there.
13. **Make `createApiRouter`'s fourth argument required**, and have the route
    tests construct `createMedia(dir)` themselves — one line at each composition
    site. `main.ts` already passes it. This is a small commit and a clarifying
    one: the composition root becomes the only place that decides what the app is
    made of.
14. **Decide `useMovieForm`'s test story and write it down.** Either give it a
    test file, or record in the file's own header why it does not have one and
    what asserts its behaviour instead. Either outcome is acceptable; leaving the
    question unasked is not. Prefer the header note if `MovieForm.test.tsx`'s 129
    tests genuinely cover the hook's behaviour, which they appear to.

## Decision Document

- **The parsing helpers stay inside the route layer.** Parsing a request is the
  route's own job per CLAUDE.md; the problem is that they are loose functions in
  one large file, not that they are in the wrong layer. Moving them to
  `server/src/media/` was considered and rejected — it would stop the route
  learning about parsing only by teaching the media domain about HTTP, which
  trades a file-size problem for a boundary violation.
- **One folder per unit with its test, no category barrel.** The same shape
  `api/` and `test-support/` already use, and the same reason: a barrel over a
  handful of functions nobody imports as a set is ceremony. Import by path.
- **The shared body read returns a value, never a response.** It answers either a
  parsed record or a refusal; the handler decides what to send. This is what
  makes it testable without a listener, and it keeps the status codes visible in
  the handler where a reader looks for them.
- **The two handlers are parameterised over exactly two things** — folder
  resolution and rollback — because those are the only two things they genuinely
  disagree about. If a third parameter appears, that is a signal the extraction
  is being forced and should be re-examined rather than widened.
- **No wire change of any kind.** No field added, renamed or removed; no status
  code moved; no response body reshaped. The **Stored file** / **Picked file**
  passthrough, the arrival-order subtitle slotting and the folder-never-renamed
  rule all survive exactly as they are.
- **The subtitle slot is taken at part arrival, not at write resolution.** This
  is not incidental — it is the fix from `4abca01` for an intermittent bug that
  swapped two tracks' `position` values. Any extraction must preserve it, and the
  test that covers it must not be weakened.

## Testing Decisions

**What makes a good test here.** Every test in this refactor asserts behaviour
through a public interface: the value a pure function returns, or the response a
real listener sends to a real `FormData`. None asserts that a particular helper
was called, and none reaches inside the modules being moved. The measure of
success is that the 288 existing route tests keep passing **unedited except for
import paths** — they were written against the wire, so they are the refactor's
safety net, and needing to change one is evidence of a behaviour change rather
than of a stale test.

**Modules gaining direct tests:** `onlyField`, `optionalYear`, `optionalText`,
`optionalRating`, `isPosterFilename`, `isSubtitleFilename`, `readBody`,
`derivedRuntime`, the new shared body read, and `renameFolder`.

**Prior art to copy rather than invent:**

- For the pure coercers — `server/src/playback/choosePlaybackPath/` is the
  project's model for a pure function with a table of cases.
- For `readBody` and the shared body read — `routes.test.ts` already drives a
  real listener with a real `FormData` and real SQLite, including a helper that
  orders parts so the rollback path is reachable. Reuse that harness.
- For `renameFolder` — `createMedia.test.ts` already asserts against a real
  sandbox directory rather than a mocked `fs`, because what is being claimed is
  what is on disk afterwards. Same approach.
- For `derivedRuntime` — the existing `Playback` doubles in
  `server/src/test-support/`.

**Coverage is already strong**, which is why this refactor is safe to take on:
288 route tests, 30 on `createMedia`, 129 on `MovieForm`, 26 on `formValues`.
The gaps are all in _directness_, not in _presence_.

## Out of Scope

- **The frontend units.** `movie-form`'s eight units, `FileField`, `SubtitleRow`
  and `Textarea` came out of the build clean and at reasonable sizes. Touching
  them would be churn for its own sake. `useMovieForm` is in scope only for the
  question in commit 14, not for restructuring.
- **Any wire or UI change.** Not one pixel and not one field.
- **Delete.** `deleteMovie` remains built, tested and unreachable. It belongs to
  the feature that ships delete, not to this refactor.
- **The two prototype deviations** (`radius.md` over the inline `10px`, and
  `Textarea` without `minHeight`). Both are recorded where they live and both are
  deliberate.
- **The dev seed.** Its expiry is unchanged: the commit that ships bulk import is
  the commit that deletes it.
- **The two process debts**, filed separately as 110 and 111 — the gitignored
  `.claude/CLAUDE.md` decision, and the `--no-verify` pattern on RED commits.
- **The stale README sections** found while writing the journal (the "four-file
  shape" with a per-component `index.ts`, and the `server/src/` domain list
  omitting `playback/`). Listed as follow-ups, not fixed here.

## Further Notes

**Why the file grew this way is worth understanding before changing it.** The
initiative's plan deliberately made `POST /api/movies` multipart from Phase 1,
so the wire contract was settled once rather than written in Phase 1 and
demolished in Phase 3. That call was right and the tests written against it
survived six phases. The cost is that every subsequent slice — the poster, the
subtitles, the edit, the runtime — added to the same two handlers, and no phase
ever owned tidying them. This refactor is that phase.

**The one thing most likely to break.** The subtitle ordering. `position` is what
`preferredSubtitle` falls back through, the slot is taken at part arrival for
that reason, and the bug it fixes was intermittent at roughly one run in three.
After commit 8 and again after commit 10, run `routes.test.ts` five consecutive
times and confirm 288/288 each, exactly as `4abca01` did.
