# Refactor plan: Default poster — the docblocks the build orphaned, one builder per view model, a guard that guards a name, and the docs that close it

> Source initiative: [`default-poster`, issue #253](https://github.com/carlos-rezai/FamilyFlix/issues/253)
> Shipped by issues 254–257. Design log: `docs/design-logs/28-default-poster.md`.
> Plan: `docs/PRDs/28-default-poster-plan.md`.
> Filed as issue 259. This plan absorbs issue 258, the plan's Phase 5 (_the close_), so the
> initiative has one refactor issue: its docs are Group 4 here.
> The maintainer approved every recommendation in advance, with one standing
> instruction: _keep the codebase consistent with our naming and code
> conventions, patterns and architecture._

## Problem Statement

`default-poster` shipped in four slices. #254 added the `Wordmark` primitive
(with the header's logo and the About card's brand row adopting it),
`Artwork`'s `poster` prop, its size container and the url layered over the
gradient, and the Poster card passing `poster`, with the prototype amendments
riding its `feat:` commit. #255 renamed `hasArtwork` to `hasPoster` on both
detail pages. #256 extracted `imageUrl`, gave `ContinueCardMovie` a
`posterUrl` and drew it on the Continue card at `center 25%`. #257 carried the
series' `posterPath` on each `EpisodeContinueEntry` and hashed the episode
card's gradient from the series. Every log-28 ruling was read against the code
for this filing. Q1–Q7 (what the Default poster is, drawn, the Wordmark,
centred, scaled by `cqmin`, unannounced, never stored), Q8–Q10 (the poster
surfaces, the layered url, the caption on `hasPoster`), Q11–Q12 (the `poster`
prop, the `Wordmark` primitive), Q13–Q17 (the Continue card's poster, its
crop, the series' art, the wire, the view model) and Q18–Q20 (`imageUrl`, the
glossary, the prototype) all hold, except where the items below say otherwise.

The pattern earlier rounds found holds again. The debt an `issue-loop` build
leaves is small, and it comes from what a subagent reading one issue can't
see: here, comments a mechanical replace left behind, docblocks that still
describe the tile before this initiative, a fixture rule the build outgrew,
one style line that restates its primitive, one guard that guards a name
rather than a rule, and the paperwork.

### 1. Five docblocks orphaned over the wrong declaration

#256 deleted six `IMAGE_ROUTE` constants and left five of their docblocks in
place. `/** Path prefix for the Express route that streams managed … */` now
sits in `view`, `seriesCardView`, `detailView`, `seriesView` and `Player`
directly above a different declaration's docblock. In `detailView` and
`seriesView` it sits above `MISSING_CREDIT`. In `view` and `seriesCardView` it
sits above the mapper's own docblock. In `Player` it sits above the stream
url's. An editor's hover shows whichever block is nearest, so those
declarations are now documented as the image route. The route's one docblock
belongs to `imageUrl`, which already has it. (`seasonView`'s copy had no
docblock, so it left nothing behind.)

### 2. Docblocks still describing a tile with no art

Log 28 Q17 retired _"the tile carries no artwork"_. The build retired the
`ContinueCard`'s and `Artwork`'s copies of it, but four more remain:

- **`ContinueCardMovie`** still says _"The tile carries no artwork, so
  `g1`/`g2` are always the deterministic gradient stops."_ This is the exact
  sentence Q17 names.
- **`EpisodeContinueEntry`** still says _"the series' id and title"_. It now
  carries the series' poster too, and that is why it exists in this shape
  (Q16).
- **`PosterCard`** still calls its no-poster face _"a deterministic gradient
  placeholder with the title overlaid"_. That face is now the **Default
  poster**.
- **`Artwork`** still introduces itself as _"the poster on a card, the poster
  on the detail page, and the backdrop behind it"_. It is now drawn on the
  Continue card, the Season card, the episode thumbnail, the Up next card,
  the player and the Enrichment candidates as well. The glossary now names the
  split the `poster` prop draws: the **Poster surface** and everything else.

`view`'s docblock says a missing poster resolves to _"`null` → gradient
fallback"_. That is still true of the url, but the card now draws the Default
poster over it. It gets the same one-word fix.

### 3. Lines the build wrote past the measure

The build added six comment lines past 80 columns, which Prettier doesn't
wrap:

- `ContinueCard`'s docblock (96 columns);
- `Artwork`'s `url` prop (91);
- `MainLayout.styles`' `LogoMark` (82);
- `ContinueCardMovie.posterUrl` (85);
- the two `hasPoster` field comments in `viewModels` (89 each).

Every earlier round has rewrapped its own initiative's docblocks.

### 4. `ContinueCardMovie.posterUrl` sits where `PosterCardMovie`'s doesn't

Q17 gave the field _"the same name and type as `PosterCardMovie.posterUrl`"_.
`PosterCardMovie` declares `id, title, posterUrl, g1, g2, …`. The build
appended `posterUrl` to the end of `ContinueCardMovie`, after `progress`, and
both mappers' literals follow that order. The two card view models are read
side by side in `viewModels.ts`, so the same field should sit in the same
place in both: beside the title, before the gradient it is layered over.

### 5. `ContinueCard`'s `Art` restates its primitive

`Art = styled(Artwork)` declares `background-position: center 25%` and
`background-size: cover`. Since #254, `Artwork`'s `Root` already declares
`background-size: cover` for every caller. `styled(Artwork)` is the extension
point for what a caller changes, and every other extension states only that:
`ContentFrame`'s rule, written last round, and the detail pages' `Backdrop`.
The crop is the one thing the card changes.

### 6. A fixture rule the build outgrew

`makePosterCardMovie`'s docblock says: _"`ContinueCardMovie` deliberately has
no builder here: one file renders it, and a shape with one caller stays at its
call site."_ That is no longer true. Three suites build the shape:
`ContinueCard.test.tsx` (a `const movie`), `CardCarousel.test.tsx`
(`makeContinueMovie`) and `ContinueRow.test.tsx` (`makeMovie`). Two of them are
the same literal down to the specimen. #256 had to add `posterUrl: null` to
all three, which is the cost `makePosterCardMovie` was created to end (issue
80's bill, _"accruing here one rung down"_). The rule its docblock states is
the rule that now calls for a builder.

### 7. A guard that guards a name, not a rule

`detailView.test.ts` gained a _"hasArtwork is gone"_ describe block. It walks
every shipping source for `\bhasArtwork\b`. The codebase's other structural
guards each hold a **rule** that no behaviour can show:

- `imageUrl`'s _"the one shipping file that spells the image route"_;
- the motion literals and the press;
- the single **Reduced motion** block;
- `useGoBack`'s _no `navigate(-1)`_;
- the `@fontsource` importers.

This one holds a **spelling** that has no reason to come back. The field is
already gone from `MovieDetailModel` and `SeriesPageModel`, so `tsc -b`
refuses any read of it. The rule the rename served, that the caption follows
the poster alone, is proven by the `hasPoster` leaves in `detailView`,
`seriesView`, `MovieDetail` and `SeriesDetail`. A guard for every retired name
would grow forever and prove nothing a typecheck doesn't. The guard also sits
in a unit's suite and walks the whole tree, which is the codecs-page round's
"one suite per thing it proves" rule broken.

### 8. The docs the initiative owes — issue 258, merged

The plan's Phase 5, filed as 258, is moved here in full, because the standing
rule makes the close the refactor's last commit anyway:

- **CLAUDE.md.**
  - The folder tree's `primitives/` doesn't name `Artwork/` (with the Default
    poster) or `Wordmark/`.
  - `utils/` doesn't name `imageUrl/`.
  - The types line's `series.ts` doesn't say `EpisodeContinueEntry` carries
    the series' `posterPath`.
  - `test-support/` doesn't name the builder this round adds.
  - Step 12 and the _Default poster_ feature line are still 🔜, and _(next)_
    is still on 12.
- **README.** The same ✅ and _(next)_.
- **The dev journal.** It has no entry for the build, and none for this round.
  The build's entry must record that log 03 Q6's open item, real artwork on
  the Continue card, is closed.
- **The glossary** was written with the log (`7b0a798`) and was read against
  the final tree for this filing. **Default poster**, **Poster surface**,
  **Gradient fallback**, **Poster URL**, **Continue card**, **Continue view
  model**, **Wordmark** and the relationships all describe what shipped, so it
  gets no commit.
- **`COMPONENT-SPEC.md`** carries the Default poster note, the Poster card's
  no-poster state and the Continue card's `posterUrl`, with the `11cqmin`,
  `.9` and shadow the build used. It needs no commit either.

## Solution

Five groups, each leaving a working, green tree after every commit:

0. **The record.** The build's journal entry comes first, so it describes what
   shipped before this round changes anything.
1. **The comments.** The orphaned docblocks go, the stale ones are rewritten,
   and the long lines are rewrapped. No code changes.
2. **The shipping tidies.** One field moved to its sibling's place and one
   restated declaration dropped. No pixel and no behaviour changes.
3. **One builder per view model, one guard per rule.** `makeContinueCardMovie`
   joins `makePosterCardMovie`, its three callers adopt it, and the name guard
   goes.
4. **The docs.** These come last, because they describe the tree the earlier
   groups leave. They close 253, 258 and this issue.

That's ten commits. None changes what the family sees.

## Commits

### Group 0 — the record of what was built

1. **The journal's default-poster build entry.** A new top entry, _Default
   poster (issues #254–#257)_, using the earlier build entries' sections:
   - What shipped, slice by slice:
     - the `Wordmark` primitive and its two adopters;
     - `Artwork`'s `poster`, its size container and the layered url, for
       every caller;
     - the Poster card;
     - `hasPoster` on both detail pages;
     - `imageUrl` and its six replaced copies;
     - the movie's Continue card at `center 25%`;
     - the series' `posterPath` on the wire, and the episode card in its
       series' poster and gradient.
   - The prototype amendments (`mol.PosterCard`, `mol.ContinueCard`,
     `page.MoviePage`, `page.SeriesPage` and the `COMPONENT-SPEC` note) riding
     #254's `feat:` commit, as the plan said, and the numbers they set:
     `11cqmin`, `opacity: .9`, the title overlay's shadow.
   - Log 03 Q6's open item, real artwork on the Continue card, closed.
   - The judgement calls the subagents made alone that the log didn't name:
     - the five orphaned docblocks (item 1);
     - `posterUrl` appended rather than placed beside the title (item 4);
     - `Art` restating `background-size` (item 5);
     - three local `ContinueCardMovie` literals extended rather than a builder
       (item 6);
     - the `hasArtwork` name guard (item 7);
     - the About card's size leaves reading the mark's `font-size` on the
       word's parent, because jsdom doesn't cascade inherited properties into
       `getComputedStyle` (kept);
     - the `Wordmark`'s gap left to each caller through `styled(Wordmark)`, 2px
       in the header and 1px in the About card, as each drew it before
       (kept).
   - What was deliberately not built: everything log 28 _Not built_ lists.
   - The test and file counts at the end of the build, **6943 tests across 406
     files**, measured at `0ed5279`.
   - The follow-ups, which are this plan, by bare number.

   Docs only.

### Group 1 — the comments, nothing else

2. **The five orphaned route docblocks go.** The leftover _"Path prefix for
   the Express route…"_ line is deleted from `view`, `seriesCardView`,
   `detailView`, `seriesView` and `Player`. Each declaration under it is then
   documented by its own block again. Comments only, no test.

3. **The docblocks that still describe a tile with no art.**
   - `ContinueCardMovie`: _"The tile carries no artwork…"_ becomes the
     **Poster URL** layered over the gradient stops, `null` for the **Default
     poster**. This is the sentence log 28 Q17 retired.
   - `EpisodeContinueEntry`: _"the series' id, title and poster"_.
   - `PosterCard`: the 2:3 poster is _"real art or the **Default poster**,
     with the title overlaid"_.
   - `Artwork`: it names the **Poster surfaces** that pass `poster` and the
     surfaces that draw the plain **Gradient fallback**, instead of listing
     three callers.
   - `view`: a missing poster resolves to `null`, which the card draws as the
     Default poster.

   Comments only, no test.

4. **The six over-measure lines rewrapped.** `ContinueCard`'s docblock,
   `Artwork`'s `url` prop, `LogoMark`'s docblock, and the three `viewModels`
   field comments (`ContinueCardMovie.posterUrl` and the two `hasPoster`
   lines) are rewrapped to 80 columns with no change of words, except where
   commit 3 already rewrote them. Comments only, no test.

### Group 2 — shipping tidies, nothing moved on screen

5. **`posterUrl` beside the title, as `PosterCardMovie` has it.**
   - `ContinueCardMovie` declares `id, title, posterUrl, g1, g2, resumeLabel,
progress`.
   - `continueView`'s and `episodeContinueView`'s literals follow the same
     order.
   - The three suites' literals are left alone, because commit 7 replaces
     them.

   Field order isn't observable. `tsc -b` and the full run, unchanged, are the
   proof.

6. **`Art` states only the crop.** `ContinueCard`'s `styled(Artwork)` drops
   `background-size: cover`, which `Artwork`'s `Root` already declares, and
   keeps `background-position: center 25%`. Its docblock says it moves the
   crop, and nothing else.

   The characterization is already in place. _"crops that poster to the key
   art, covering the tile at center 25%"_ reads both properties through
   `resolvedStyle`, which walks every rule that matches the element, so it
   reads the primitive's rule as well. The leaf is green before the edit and
   after, and no leaf is added. If it goes red, the cascade disagrees with
   this reading, and the line stays.

### Group 3 — one builder per view model, one guard per rule

7. **`makeContinueCardMovie`, with its suite.**
   - A new folder in `test-support/`, beside `makePosterCardMovie`.
   - `makeContinueCardMovie(overrides)` returns a full `ContinueCardMovie`:
     - the specimen is the shared one from `ContinueCard` and `CardCarousel`
       (`Comet Season`, `Resume · 1:13 of 1:55`, `64`);
     - `posterUrl` is `null`;
     - the fields are in commit 5's order.
   - The suite mirrors `makePosterCardMovie.test.ts`:
     - every key the type declares, written out;
     - nothing it doesn't declare;
     - an override replaces only its field.
   - `makePosterCardMovie`'s docblock loses the sentence that said
     `ContinueCardMovie` deliberately has no builder. In its place, a
     sentence points to its sibling.
   - There are no callers yet.

8. **Its three callers adopt it.**
   - `ContinueCard.test.tsx`: `const movie = makeContinueCardMovie()`.
   - `CardCarousel.test.tsx`: `makeContinueMovie` goes, and its callers call
     the builder.
   - `ContinueRow.test.tsx`: the local `makeMovie` goes, and the builder is
     called with that suite's own `Resume · 25:00 of 1:40:00` and `25`
     wherever its leaves read them.

   Every leaf keeps its name and its assertions, and the three suites pass
   unchanged in count. This mirrors issue 80's adoption of `makePosterCardMovie`.

9. **The `hasArtwork` name guard goes.** The _"detailView — hasArtwork is
   gone"_ describe block and its now-unused `shippingSourcesMatching` import
   leave `detailView.test.ts`. The `hasPoster` leaves in `detailView`,
   `seriesView`, `MovieDetail` and `SeriesDetail` keep the rule. `tsc -b`
   keeps the name gone. `imageUrl`'s route guard stays, because it holds a
   rule.

### Group 4 — the docs that close the initiative (issue 258's scope)

10. **CLAUDE.md, README and the journal's refactor entry.** Docs only. This
    commit closes 253, 258 and this issue together.
    - CLAUDE.md's folder tree:
      - `primitives/` names `Artwork/`: the **Gradient fallback**, the url
        layered over it, and the **Default poster** with `poster`.
      - `primitives/` names `Wordmark/`: _Family_ and _Flix_, sized by the
        parent, drawn by the header, the About card and the Default poster.
      - `utils/` names `imageUrl/`, the one spelling of the image route.
      - `test-support/` names `makeContinueCardMovie/` beside the builders it
        lists.
    - CLAUDE.md's types line: `series.ts`'s `EpisodeContinueEntry` carries the
      series' `posterPath`.
    - CLAUDE.md: build order step 12 ✅, _(next)_ moves to step 13 (**Add a
      series**), and the Maintainer tools line _Default poster_ ✅.
    - README: the same ✅ in the feature table and the build order, and
      _(next)_ on 13.
    - The journal's refactor entry, a new top entry, _Default poster refactor
      (issue 259)_, using the earlier rounds' sections:
      - what each group changed;
      - leaves added, removed and moved, by name;
      - the test and file counts before (6943 across 406) and after;
      - that `tsc -b` and `eslint src server electron .husky` are clean;
      - that no commit changed a pixel;
      - that 258 was merged into this plan, and why;
      - that the glossary and `COMPONENT-SPEC` were read against the final
        tree and left alone;
      - anything the round surfaced, by bare number.

    Prettier runs over the changed docs.

## Decision Document

- **The image route's one docblock is `imageUrl`'s.** The five leftovers are
  deleted, not moved. Each mapper's own docblock already says it resolves a
  path through the image route.
- **"The tile carries no artwork" is retired everywhere.** Q17 named the
  sentence. Commit 3 finds its last copy and the neighbours that described the
  same world.
- **The same field sits in the same place in sibling view models.**
  `ContinueCardMovie.posterUrl` follows `PosterCardMovie.posterUrl`: after the
  title, before the gradient it is layered over.
- **A `styled()` extension states only what it changes.** `Art` keeps the
  crop. The cover is `Artwork`'s, for every caller.
- **A view model with three test callers gets a builder.** This is
  `makePosterCardMovie`'s own rule, and its docblock is corrected to say so.
  The builder lives in `test-support/` with its suite, takes overrides, and
  its specimen is the one its callers already share. `ContinueRow` keeps its
  own label and percent as overrides, because its leaves read them.
- **A structural guard holds a rule, not a retired name.** Retired names are
  the typecheck's job. The behaviour a rename served is proven by behaviour
  leaves. `imageUrl`'s guard is a rule, _the route is spelled once_, and it
  stays.
- **The close is merged.** 258's acceptance criteria are commit 10's, and its
  journal entry is commits 1 and 10. One refactor issue closes the initiative.
- **No route, schema, wire, server or prototype change.** `GET /api/series`,
  `EpisodeContinueEntry`'s fields, `Artwork`'s props, `Wordmark`, `imageUrl`,
  the `11cqmin` mark, the `center 25%` crop and every surface's look all stay
  as built.

## Testing Decisions

- **A good test here asserts what the family can see or what the wire
  carries.** That means a tile's computed background and crop, whether the
  Wordmark is drawn and hidden from the accessibility tree, the caption's
  text, the url a view model holds and the entry the route answers. A
  builder's suite asserts the shape a caller gets. A structural guard asserts
  a rule about the source that no behaviour can show, and nothing else.
- **Characterization before change.**
  - Commits 2–4 are comments, so `tsc -b` and `eslint` guard them.
  - Commit 5 is guarded by the typecheck and the unchanged run.
  - Commit 6 is guarded by the `center 25%` leaf already in place, which
    reads `background-size` too.
  - Commit 8 is a pure fixture move, proven by three suites passing with every
    leaf's name and count unchanged.
- **Modules tested:**
  - `makeContinueCardMovie`: new, three leaves on `makePosterCardMovie`'s
    shape.
  - `detailView`: one guard leaf removed.
  - `ContinueCard`, `CardCarousel`, `ContinueRow`: fixtures restated, leaves
    unchanged.
  - Every other suite the build touched (`Artwork`, `Wordmark`, `PosterCard`,
    `MovieDetail`, `SeriesDetail`, `seriesView`, `continueView`,
    `episodeContinueView`, `imageUrl`, `AboutSection`, `MainLayout`, the
    series browse and route suites): unchanged.
- **Prior art:**
  - `makePosterCardMovie` and its suite, and issue 80's adoption, for the
    builder.
  - `ContentFrame.styles.ts` for an extension that states only its change.
  - `interactionStates.test.tsx`, `GlobalStyle.test.tsx` and
    `imageUrl.test.ts` for what a structural guard holds.
- **Coverage is sufficient.** Every log-28 ruling has a behaviour leaf:
  - the layered url and the `poster` switch (`Artwork`);
  - the mark's inks and face (`Wordmark`);
  - each poster surface with and without art (`PosterCard`, `MovieDetail`,
    `SeriesDetail`, `ContinueCard`);
  - the caption's rule (`detailView`, `seriesView`);
  - the route spelled once (`imageUrl`);
  - the series' poster on the wire (browse and route suites);
  - the series' gradient (`episodeContinueView`).

  The Wordmark's scaling is the running app's check, as log 28 accepted.

## Out of Scope

- **A shared helper for _"the Wordmark is hidden from the accessibility
  tree"_.** Four suites spell
  `getByText('Flix').closest('[aria-hidden="true"]')`. It is one readable line
  that names what it asserts, and a helper would hide that.
- **Restructuring `ContinueCard.test.tsx`'s `art()` reader**, which reaches
  the layer as the tile's first child. The layer has no role or name to reach
  it by, which is `snackbarStack`'s precedent.
- **Widening `imageUrl` to take `undefined`.** The player's
  `movie?.posterPath ?? null` is the one optional caller, and the util keeps
  the **Stored path**'s own type.
- **The glossary's Continue card relationship (_"opens the Movie detail page,
  not the player"_)**, which predates this initiative. It isn't touched here.
- **Anything log 28 _Not built_ lists:** art on the Season card, the episode
  thumbnails or the Up next card; a Wordmark on a backdrop or behind the
  player; `onError`; a stored Default poster; the backdrop or Still as
  Continue art.
- **Prettier-governed long lines in tests and imports.** Test names and
  import paths aren't wrapped by Prettier, and every earlier round has left
  them.
- **Lines past the measure that predate this initiative** (`series.ts`'s
  header, `browse.ts`, `Player.tsx`, `utils/index.ts` and the rest the
  filing's scan found). Each round rewraps its own.
- **Steps 13–15 of the build order, and the Roadmap's Move the media
  folder.**

## Further Notes

- Commit descriptions stay under the one-line rule. For example, commit 2 is
  _the orphaned route docblocks_, commit 7 is _the makeContinueCardMovie
  builder_, and commit 9 is _the hasArtwork name guard goes_.
- Commit 5 reorders a type's fields, so `tsc -b` runs first. Field order is
  not part of the type's identity, so nothing should fail. A grep at filing
  time found `continueView`, `episodeContinueView` and the three suites the
  only builders of the literal.
- Commit 10's body closes 253 and 258 with this issue. No other commit body
  carries a closing keyword, and the journal lists follow-ups by bare number.
