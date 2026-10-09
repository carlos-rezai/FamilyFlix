# Refactor plan: Backdrop veil — one reading of what a layer paints, the page tests on the screen, the series prototype's art made one, and the docs that close it

> Source initiative: [`backdrop-veil`, issue #288](https://github.com/carlos-rezai/FamilyFlix/issues/288)
> Shipped by issue 289 (`15607c3` RED, `6712655` GREEN). Design log:
> `docs/design-logs/34-backdrop-veil.md`. Plan:
> `docs/PRDs/34-backdrop-veil-plan.md`.
> Filed as issue 290.
> The maintainer approved every recommendation in advance, with one standing
> instruction: _keep the codebase consistent with our naming and code
> conventions, patterns and architecture._

## Problem Statement

`backdrop-veil` shipped as one `feat:` slice, as log 34 Q9 ruled. It built
`components/DetailBackdrop/` (the sticky, `100vh` `ArtArea` and the two-layer
`Veil`), added its barrel line, swapped `MovieDetail` and `SeriesDetail` onto
it, deleted both features' `ArtArea` and `Scrim`, rewrote both page
`Scroller` docblocks, revised `page.MoviePage.dc.html` and
`page.SeriesPage.dc.html`, and added the molecule's row to
`COMPONENT-SPEC.md`. The glossary rows (**Detail backdrop**, **Backdrop
veil**, the invariant and the _scrim_ note) were written with the log.

Every log-34 ruling was read against the code for this filing. Q1–Q9 hold:
one molecule named `DetailBackdrop` with `ArtArea` and `Veil` inside it,
sticky with the negative margin and the coupling comment, the gradient over
`theme.colors.accentSoft` at `.65 / .85 50% / bg`, no `mol.*` file, the
loading and failure faces untouched, and the molecule's suite reading
`getComputedStyle`. What the slice left behind is small and of four kinds.

### 1. The import lists the slice appended to

Both callers import from `@/components` in alphabetical order —
`CreditsRow, ExpandableText, SeasonCard` — and the slice appended
`DetailBackdrop` at the end of each list rather than in its place. The
barrel's own line is appended last, which is that file's convention (it is
chronological), and stays.

### 2. One reading of _what a layer paints_, written three times

The molecule's suite has a `backgrounds(root)` helper: every element under a
root, its `background`, `backgroundImage` and `backgroundColor` as resolved.
The two feature suites each spell the same walk inline, fifteen lines apiece,
character for character. Three suites in three folders read one thing, which
is what `test-support/` is for (`resolvedStyle`, `comesBefore`,
`stubScrollMetrics`). The molecule's suite also types its theme argument as
`ReturnType<typeof createTheme>` where `styles/theme` already exports that
type as `Theme`.

### 3. Two leaves that read a module, not the screen

Each feature suite ends with _keeps no art area or scrim of its own_, which
imports the feature's `.styles` module and asserts that `ArtArea` and `Scrim`
are not among its export names. It is the only place in `src/` a suite reads
a styles module's keys. It tests a file's shape, not the page: an unused
export named anything else would pass it, and a rename of a styled part would
fail it with nothing on screen changed. The rule it was written for is in the
glossary's invariants — _each detail page draws exactly one **Detail
backdrop**_ — and that is a thing the rendered page can be asked.

### 4. The series prototype still draws its own art

`page.SeriesPage.dc.html` draws the art layer's image as
`{{ sr.backdropStyle }}`, and `FamilyFlix.dc.html` defines that style as a
120° gradient under `filter: blur(2px)` and `transform: scale(1.05)`. The
movie prototype draws `{{ detail.posterStyle }}`, the 155° **Gradient
fallback** the `Artwork` primitive paints. The code never blurred the series
art, and log 32 Q2b and log 34 Q7 rule out a blur. The slice rewrote the
container and the veil in both prototypes but left this, so the two
prototypes still draw one molecule two ways — the drift log 34 Q4 named as
the reason for one molecule.

### 5. The docs the initiative owes

- **The dev journal.** No entry for the build and none for this round.
- **CLAUDE.md.** The folder tree's `components/` has no `DetailBackdrop/`
  line. Step 17 and its Browse & discover entry are 🔜.
- **README.** Step 17 and its status row are 🔜.

## Solution

Five groups. The tree is working and green after every commit:

0. **The record.** The build's journal entry first, so it describes what
   shipped before this round changes anything.
1. **The code's tidy.** The two import lists in order. No behaviour changes.
2. **The tests' tidies.** One `paintedBackgrounds` in `test-support/`, and
   the two module-reading leaves replaced by a leaf about the screen.
3. **The prototype.** The series page's art drawn as the movie page's is.
4. **The docs.** Last, because they describe the tree the earlier groups
   leave. They close 288 and this issue.

That's nine commits. No wire, schema, type or pixel changes in the app.

## Commits

### Group 0: the record of what was built

1. **The journal's backdrop-veil build entry.** A new top entry,
   _Backdrop veil (issue #289)_, using the earlier build entries' sections:
   - What shipped: the molecule and its suite, the barrel line, both features
     swapped and their twins deleted, the two `Scroller` docblocks, both page
     prototypes and the `COMPONENT-SPEC` row — one slice, one RED and one
     GREEN commit, as Q9 ruled.
   - The two RED-suite fixes the GREEN commit made and its message names (the
     `soft()` regex's lost escapes, `artworkImage()` found by angle because
     the resolved style spells `hsl()` as `rgb()`), neither relaxing an
     assertion.
   - The judgement calls left for this round: the import order (item 1), the
     walk written three times (item 2), the module-reading leaves (item 3),
     the series prototype's `backdropStyle` (item 4).
   - What was deliberately not built: everything log 34 rules out.
   - The test and file counts at the end of the build, measured at
     `6712655`.
   - The follow-ups, which are this plan, by bare number.

   Docs only.

### Group 1: the code's tidy

2. **The callers import the molecule in its place.** `MovieDetail` reads
   `CreditsRow, DetailBackdrop, ExpandableText` and `SeriesDetail` reads
   `CreditsRow, DetailBackdrop, ExpandableText, SeasonCard`, the order every
   other name in both lists keeps. Both suites pass unchanged.

### Group 2: the tests' tidies

3. **`paintedBackgrounds` in `test-support/`.** A new unit,
   `test-support/paintedBackgrounds/`, with its own test, on `comesBefore`'s
   shape: given a root, every element from the root down, each read as its
   resolved `background`, `backgroundImage` and `backgroundColor` joined into
   one line. The molecule's `backgrounds()` is the source; it moves rather
   than being rewritten. Its leaves: a root with no children answers one
   line; a child's background image is in the answer; document order is kept.
   Test only.

4. **The three suites read through it.**
   - `DetailBackdrop.test` drops its local `backgrounds()` and imports the
     unit; its theme argument is typed `Theme` from `@/styles/theme` in place
     of `ReturnType<typeof createTheme>`.
   - `MovieDetail.test`'s and `SeriesDetail.test`'s _Detail backdrop_ leaves
     replace their inline walk with the unit, whitespace still stripped
     before the `accentSoft` comparison.

   Test only; every touched suite passes unchanged, leaf count included.

5. **Each page is asked for its one Detail backdrop, not its module's
   names.** In both feature suites, _keeps no art area or scrim of its own_
   becomes _draws exactly one Detail backdrop_: rendered with a backdrop,
   exactly one element paints the backdrop's url, and it sits inside the one
   `aria-hidden` layer the accent-wash leaf already finds. The `await
import('./….styles')` goes with it. The leaf reads the glossary's
   invariant, the way the accent-wash leaf beside it reads the **Backdrop
   veil**'s row. Test only; the leaf count is unchanged.

### Group 3: the prototype

6. **The series prototype draws the Gradient fallback the movie prototype
   draws.** `page.SeriesPage.dc.html`'s art layer draws `{{ sr.posterStyle
}}`, as `page.MoviePage.dc.html` draws `{{ detail.posterStyle }}`, and
   `FamilyFlix.dc.html`'s series model drops `backdropStyle` — its 120°
   gradient, `blur(2px)` and `scale(1.05)` — which nothing else reads. This
   moves the prototype onto the code and onto log 32 Q2b, not the code onto
   the prototype: the app has drawn the `Artwork` primitive's 155° fallback,
   unblurred, since the series page shipped. `COMPONENT-SPEC`'s row already
   says _No motion, no blur_ and is unchanged. Docs only.

### Group 4: the docs that close the initiative

7. **CLAUDE.md.** Docs only.
   - The folder tree's `components/` gains `DetailBackdrop/`: _the **Detail
     backdrop**, graduated when both detail pages drew it: the art sticky at
     the top of the page's scroller and a full viewport tall, under the
     **Backdrop veil** — a gradient over `accentSoft`; its `100vh` coupled to
     both pages' `Scroller`_. It sits after `CreditsRow/`, the molecule that
     graduated the same way.
   - Step 17 and the Browse & discover entry ✅.

8. **The README.** Step 17 and its status row ✅. Docs only.

   Ticked here, in the refactor's docs, not when 289 closed.

9. **The journal's refactor entry, closing the initiative.** A new top
   entry, _Backdrop veil refactor (issue 290)_: what each group changed,
   the test and file counts after the round against the build's,
   `tsc -b --force` and `eslint` clean, and what was left (see Out of
   Scope). Its commit closes 288 and this issue.

## Decision Document

- **The molecule is unchanged.** `DetailBackdrop`, its props
  (`url`, `g1`, `g2`), `ArtArea`, `Veil`, the stops, the sticky geometry and
  both docblocks stay as built. Log 34 Q1–Q5 hold in the code.
- **Import lists are alphabetical; the barrel is chronological.** The two
  callers are put in order; the barrel's appended line stays where it is,
  which is how every other molecule joined it.
- **`paintedBackgrounds` joins `test-support/`**, one folder with its test,
  no barrel, imported by path — the rung's own rule. Three suites in three
  folders read it, which is the bar `test-support/` sets. The name says what
  it answers, on `resolvedStyle`'s precedent; `backgrounds` alone would read
  as a list of CSS values.
- **No suite reads a styles module's export names.** The page suites ask the
  rendered page; the glossary invariant is the rule they hold.
- **The prototype follows the code where the log already ruled.** The series
  prototype's blur was never built and is ruled out twice; removing it is a
  correction of the spec to its own decisions, not a redesign. No new
  prototype file.
- **No type, wire, server or pixel change.** Nothing the app draws moves.
- **One refactor issue closes the initiative.** The docs commits tick step
  17, on the rule that a feature is done only after its refactor.

## Testing Decisions

- **A good test here asserts what the page paints**, read through
  `getComputedStyle` as the browser resolves it, never a styled component's
  name or a module's exports. Commit 5 exists to bring the two page suites
  onto that rule.
- **The molecule's suite** (`DetailBackdrop.test`) is the proof for commits
  2–4: the root `aria-hidden`, sticky at `top: 0` and `100vh`; the url over
  the Gradient fallback and the fallback alone for `null`; the wash in the
  theme's own `accentSoft` under `createTheme('#3a7bd5')`.
- **The page suites** (`MovieDetail.test`, `SeriesDetail.test`) keep the
  accent-wash leaf and gain _draws exactly one Detail backdrop_ in place of
  the module-reading leaf.
- **`paintedBackgrounds.test`** gives the new unit its own leaves;
  `comesBefore.test` and `resolvedStyle.test` are the prior art.
- **Commits 3–5 are test-only** and are proven by every touched suite
  passing, leaf count unchanged.
- **Commit 6 is checked by eye** in the prototype: the series page's art is
  the movie page's gradient, unblurred, under the same veil.
- After the round: the full `vitest run`, `tsc -b --force` and
  `eslint src server electron .husky`, with the counts in the journal.

## Out of Scope

- **The `Scroller`s' `position: relative`.** Nothing is placed absolutely
  against either `Scroller` any more — the art is sticky, the Back controls
  and the ⋯ menu are fixed — so the declaration no longer does what the old
  docblock said. Removing it is a CSS change with no visible effect, in a
  page's styles, in a round that moves no pixel. The journal names it.
- **A token for `bg` with an alpha.** `rgba(20, 17, 13, …)` is spelled in
  ten shipping files, the veil's two stops among them, and log 34 Q4 kept
  that spelling. A token is a theme change across the app, not this
  initiative's tidy.
- **The two `Scroller` docblocks' near-twin wording.** Each names its own
  page's content, and pages do not share styles.
- **`COMPONENT-SPEC`'s other molecules without a `mol.*` file.** Log 34 Q6
  followed `CreditsRow`; no change.
- Everything log 34 rules out: a blur, parallax or any motion of the art, a
  veil on the Season page, stops tuned per image brightness.

## Further Notes

- Commit subjects follow `refactor: [backdrop-veil] issue #290 …` for
  commit 2, `test:` for commits 3–5 and `docs:` for 1 and 6–9. Commits 3–5
  are `test:` commits over shipping code that already compiles, so the
  commit gate's narrowed typecheck is enough; `tsc -b --force` runs before
  commit 9.
- No closing keyword appears in a commit body for any issue but 288 and this
  one, and only in commit 9.
