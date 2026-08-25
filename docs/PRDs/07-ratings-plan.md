# Plan: Ratings (the half-star picker, the write path, and the Unrated retraction)

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/56

Closes the oldest one-way street in the library. `rating INTEGER CHECK(rating
BETWEEN 0 AND 10)` has been in the schema since `01-library-core`,
`curation.setRating(id, units | null)` has been beside `setFavorite` since the
same feature, `mol.RatingPicker` has been in `docs/handoff/` since the handoff,
and stars are drawn on every poster card, every meta line, a `4+ stars` filter
pill and a `highest-rated` sort. Not one of those is reachable from a click.
Every rating in the database arrived through the dev seed.

**No migration, and no new storage primitive.** This feature is a route, a
molecule, a util, four `number` → `number | null` widenings, and one retraction
of a display decision that named this feature as its successor. `setRating`
already exists, already writes a single column, and already leaves `updated_at`
alone — the whole server slice is validation and a dispatch.

Phase 1 is a tracer bullet in the strict sense: it cuts the route, the client
call, the unit conversion, the hook's third optimistic write and a clickable
control in one pass, and it is demoable by clicking a star and reloading the
page. Phase 2 deepens the molecule to the prototype's pixels and semantics
without touching a layer below it. Phases 3 and 4 carry `null` through the two
screens that have been faking it as zero. Phase 5 closes the docs.

**Two ordering changes against the PRD's own phasing sketch**, both closing a
gap where a phase would otherwise need scaffolding a later phase deletes:

- **Its phases 3 and 4 swap — the card lands before the detail-page
  retraction.** Widening `toRatingPercent` to return `number | null` _is_ what
  stops `view()` flattening; do the detail page first and
  `PosterCardMovie.rating: number` stops type-checking, so that order needs a
  temporary `?? 0` in the view mapper that the next phase deletes. Swapped, each
  slice is self-contained: the card phase carries both `null`-widenings
  (`toRatingPercent` and `StarRating`), which are its own concern now that the
  detail page renders a picker rather than the primitive, and the detail phase's
  `movie.rating === null ? null : …` collapse becomes a one-line simplification
  on top of a widening already in place.
- **The prototype amendment opens Phase 1 rather than standing as its own
  phase.** The same call the genre-page plan made for `genreCountLabel`: it lands
  before any code in the phase, which is what CLAUDE.md asks for, without a phase
  that ships no behaviour. Story 55's "recorded as an amendment" is satisfied by
  the commit and the dev-journal entry, not by a separate phase.

**One addition the PRD does not specify.** The dev seed currently holds no
unrated and no zero-rated movie — zero of each. Phases 3 and 4 exist precisely
to tell those two apart, and without fixtures the distinction is provable in
unit tests and invisible in the running app; story 19's seeded zero would never
be checkable by looking, which is the one thing CLAUDE.md says the seed is for.
Phase 3 adds one `rating: null` and one `rating: 0` fixture.

## Architectural decisions

Durable decisions that apply across all phases:

- **Route**: `POST /api/movies/:id/rating`, body `{ value: number | null }`,
  echoing `{ value }` on success. The third sibling of `/favorite` and
  `/watched` — same shape, same 404-before-write check, same echo-is-truth
  bargain. Deliberately **not** `PATCH /movies/:id`: `updateMovie` is the
  _form's_ path and arrives with `movie-form`, and both existing single-signal
  writes already have dedicated routes.
- **The accepted set is "exactly `null`, or an integer 0–10".** Stated as an
  allow-list rather than a `typeof value !== 'number'` rejection, because that
  test alone lets every non-numeric value through as a clear. A body with **no
  `value` key** is a 400, not a clear — a malformed request and a deliberate
  clear must not be the same wire message. Floats, negatives, `11`, strings and
  booleans are 400s with the message shape the `?rating=` rejection already uses.
- **Schema: unchanged.** No migration. `setRating` is already a plain
  single-column `UPDATE` that does not touch `updated_at`, so rating an old film
  cannot move it in a `recently-added` ordering. The route dispatches to it
  rather than to `updateMovie`, keeping a single-column write single-column.
- **The component layer speaks percent; the domain speaks units.** `RatingPicker`
  takes and emits a 0–100 percent, exactly as `StarRating` does — a molecule that
  is meant to know nothing about the domain must not start speaking in stored
  0–10 units. `toRatingUnits` is the one place the two scales meet, the pure
  inverse of `toRatingPercent`, `null` in and `null` out.
- **`null` is carried, never re-derived.** Four types widen from `number` to
  `number | null` — `StarRatingProps.rating`, `PosterCardMovie.rating`,
  `toRatingPercent`'s return, and `RatingPickerProps.value`. Unrated stops being
  a `value > 0` test at every rung and becomes a value the whole path carries.
  This is the change that lets "I haven't scored this" and "I scored this
  nothing" stay different facts on screen.
- **Clearing is click-the-current-segment.** No second control, no X button —
  the same "click it again to turn it off" grammar the favorite heart and the
  watched tick already use, and the only undo a mis-click has until the
  maintainer's form ships. The picker's smallest click is half a star, so it
  cannot write a flat `0` at all; a stored `0` arrives only from a seeded import
  and this feature reads it correctly without being able to write it.
- **`rate()` is hand-rolled, not `useOptimisticSave`.** That hook is boolean-only
  by explicit design and its own comment names this arrival: "a save with more
  than two values has to be told what to put back". `rate()` keeps the identical
  bargain by hand — capture the previous `ratingPercent`, apply the new one
  immediately, reconcile against the route's echo, restore the captured value on
  rejection — and routes through the existing `editMovie` guard so a response
  landing after the page has moved on is discarded. Three hand-rolled optimistic
  writes in one hook is then real duplication, filed as a refactor candidate
  (`useOptimisticEdit(previous, apply, save)`) in Phase 5 rather than generalised
  mid-build from two examples.
- **No cross-screen store.** A rating set on the detail page reaches the browse
  grid on its next load, exactly as favorite and watched do today. Nothing here
  introduces a cache that would let a poster card restyle itself without a
  reload.
- **The prototype is amended, then built to.** This is the project's first
  amendment. `page.MoviePage.dc.html` and `COMPONENT-SPEC.md` change in Phase 1
  before any implementation, so "the prototype is the spec" stays true rather
  than quietly becoming "the prototype is where we started".

---

## Phase 1: The write path, end to end

**User stories**: 2, 3, 8, 9, 10, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41,
42, 43, 44, 46, 53, 54, 55

### What to build

The amendment opens the phase. `page.MoviePage.dc.html`'s meta line stops
importing `prim.StarRating` and imports `mol.RatingPicker` at `size=20`, wired
to a rate handler; `COMPONENT-SPEC.md` records `RatingPicker`'s `size` prop and
`number | null` value, widens `StarRating`'s row to `number | null`, and points
the `page.MoviePage` row at `RatingPicker`. Nothing is implemented until both
have landed.

Then one thin cut through every layer. The new route validates its body against
the allow-list, 404s an unknown id before writing, dispatches to `setRating`,
and echoes what it stored. `saveRating` posts to it and returns the echo,
falling back to the sent value when the route answers without one.
`toRatingUnits` converts percent to stored units. `useMovieDetail` gains
`rate(percent | null)`, keeping the optimistic bargain by hand through
`editMovie`. The meta line renders a `RatingPicker` in place of its
`StarRating`, at the same 20px, in the same position, driving `rate()`.

The picker at this phase is deliberately provisional: whole stars, no half-star
segments, no hover preview. It is a control that persists a rating — everything
that makes it _the_ picker arrives next phase. The rating segment stays
conditional on a rating existing, so an unrated movie still shows nothing; that
retraction is Phase 4's.

### Acceptance criteria

- [ ] `page.MoviePage.dc.html` shows `mol.RatingPicker` at `size=20` in the meta
      line, unconditional, and `COMPONENT-SPEC.md` matches — both committed
      before any `src/` or `server/` change in this phase
- [ ] `POST /api/movies/:id/rating` stores a rating and echoes the value it
      stored
- [ ] `{ value: null }` is accepted as an explicit clear, echoes `null`, and a
      subsequent read shows the movie unrated
- [ ] Both ends of the scale, `0` and `10`, are accepted, and an existing rating
      can be overwritten
- [ ] A float, a negative, `11`, a string, a boolean, and a body with no `value`
      key each answer 400 and leave the stored rating untouched
- [ ] An unknown id answers 404 with nothing written
- [ ] Rating a movie leaves `updated_at` alone and does not move it in a
      `recently-added` ordering
- [ ] `toRatingUnits` maps `null` → `null`, `100` → `10`, `50` → `5`, `0` → `0`,
      and round-trips the half-star points against `toRatingPercent`
- [ ] `saveRating` posts `{ value }` with the id encoded, returns the echo,
      falls back to the sent value when the response carries none, sends and
      returns `null` correctly, and rejects on a non-ok response
- [ ] `rate()` shows the new rating before the request settles; the echo replaces
      the assumed value when they differ; a rejected save restores the previous
      rating, including restoring `null`; `rate(null)` clears optimistically and
      sends `null`; a response arriving after the hook has moved to another movie
      is discarded; `rate()` on a hook that is not `ready` is a no-op
- [ ] A failed save costs the rating and nothing else — no error screen, no
      snackbar, the page and the movie stay
- [ ] Clicking a star on a rated movie's detail page persists it across a reload,
      and the new value shows on that movie's poster card on the next library
      load

---

## Phase 2: The molecule in full

**User stories**: 1, 4, 5, 6, 7, 11, 12, 13, 14, 24, 25, 26, 27, 28, 29, 30, 45,
47, 48, 49, 50, 51, 52

### What to build

`RatingPicker` becomes the component the prototype draws and the component an
assistive-technology user can actually operate. Ten **Half-star segments** span
the row — the left half of the third star is `2.5`, the right half is `3.0`.
Hovering a segment previews exactly the fill it would set; leaving the strip
restores the stored value; hovering alone never emits anything. Clicking the
segment that already holds the current value emits `null`. The label beside the
stars reads `4.0 / 5`, or `Not rated` when the value is `null`.

The prototype's bare `<div onClick>` hit areas become `<button type="button">`,
each with an `aria-label` naming what it would set — `Rate 3½ stars`, or
`Clear rating` on the segment holding the current value — with `onFocus`
mirroring `onMouseEnter` so a keyboard user gets the same preview a mouse user
gets, and the preview resetting when focus leaves the strip entirely. The strip
is a `role="group"` labelled `Your rating`. Identical pixels, real semantics.

`size` defaults to the prototype's 30px, with gaps and hit areas scaling off it,
so the meta line's 20px instance is a smaller picker rather than a broken one and
`MovieForm` can later take the default with no rating work of its own. The hover
preview stays local state inside the molecule — nothing outside it ever sees an
uncommitted rating. The picker ships complete despite having one call site
today; the poster card deliberately keeps offering only the heart, because ten
half-star hit areas on a 210px tile is a mis-click hazard on the screen the
parents use most.

### Acceptance criteria

- [ ] Ten segments render, each an accessible button
- [ ] The fourth star's right half emits `80`; its left half emits `70`
- [ ] Clicking the segment holding the current value emits `null`
- [ ] Hovering a segment shows that fill; leaving the strip restores the stored
      value; no `onChange` fires from hover alone
- [ ] Focusing a segment shows the same preview hovering it does; blurring the
      strip restores the stored value
- [ ] Enter and Space on a focused segment emit the same value a click does
- [ ] Every segment is reachable with Tab
- [ ] The label reads `4.0 / 5` when rated and `Not rated` when `null`, and
      changes back to `Not rated` the moment a rating is cleared
- [ ] The segment holding the current value is labelled `Clear rating`; the
      others are labelled with what they would set
- [ ] The strip is a group named `Your rating`
- [ ] `size` changes the rendered geometry and defaults to the prototype's 30px;
      star size, 5px gaps, 14px dim label and accent fill match the prototype
- [ ] `value` is `number | null` — unrated is carried, not re-derived from
      `value > 0`
- [ ] Clearing a rating on a real movie leaves it genuinely unrated in the
      database, not zero
- [ ] The picker cannot set a flat `0` — its smallest click is half a star
- [ ] The poster card still offers only the heart

---

## Phase 3: The card stops faking Unrated as zero

**User stories**: 18, 19, 20

### What to build

`02-browse-grid` Q10 mapped unrated to `0` on the **Poster card**, noted it is
"visually identical to a real 0", and left it in the glossary to be revisited
with this feature. It is revisited here.

`toRatingPercent` stops flattening: its return widens to `number | null` and
`null` passes straight through. That widening is what forces the rest —
`PosterCardMovie.rating` widens, and `view()` stops turning an unrated movie into
a zero-rated one when it builds the card model. `StarRating` accepts `null`,
renders five empty stars for it, and suppresses the numeric value even when
`showValue` is set.

So an unrated card reads `★★★★★` and a genuinely zero-rated card reads
`★★★★★ 0.0` — the ambiguity is closed by dropping the number, not the stars, so
the tiles keep their height and the grid rows do not jump.

The dev seed gains one `rating: null` fixture and one `rating: 0` fixture, so
both cases are visible side by side in the browse grid rather than existing only
in unit tests. Without them the seeded zero of story 19 is untestable by looking,
which is the reason CLAUDE.md gives for the seed existing at all.

### Acceptance criteria

- [ ] `toRatingPercent(null)` returns `null`; integer ratings are unchanged
- [ ] `StarRating` given `null` renders empty stars and no numeric value even
      with `showValue` set
- [ ] `StarRating` given `0` with `showValue` still renders `0.0`
- [ ] `view()` maps an unrated movie to `rating: null` rather than `0`, and a
      zero-rated movie to `0`
- [ ] An unrated movie's poster card shows five stars and no number
- [ ] A zero-rated movie's poster card shows `★★★★★ 0.0`
- [ ] Unrated cards keep their star row — tile heights and row alignment are
      unchanged
- [ ] The dev seed contains one unrated and one zero-rated movie, and a re-run
      stays idempotent
- [ ] The glossary's open ambiguity from `02-browse-grid` Q10 is marked resolved

---

## Phase 4: The Unrated retraction on the detail page

**User stories**: 15, 16, 17, 21, 22, 23

### What to build

`04-movie-detail` Q10 hid the star **Meta segment** entirely for an unrated
movie, because five empty stars printing `0.0` read like a verdict rather than
an absence — and named this feature as the point that would be revisited. This
is the deferred half arriving, not a reversal: empty stars you can _click_,
labelled `Not rated`, read as an invitation rather than a judgement, and the
movies most in need of a rating stop being the ones offering no control.

`detailView`'s `movie.rating === null ? null : toRatingPercent(movie.rating)`
collapses to a plain `toRatingPercent(movie.rating)` now that the util carries
`null` itself. The meta line's rating segment becomes unconditional — present for
a rated movie, a zero-rated movie and an unrated one alike, so a missing control
can never mean "unrated" _or_ "broken".

The `metaSegments` interleaving survives unchanged and keeps earning its place:
`year` and `runtimeLabel` stay nullable, so the machinery that makes a dangling
bullet unrepresentable is still doing work — only the rating segment stops being
omissible.

### Acceptance criteria

- [ ] `detailView`'s rating special case is gone, replaced by a plain
      `toRatingPercent` call
- [ ] The rating segment is present on the meta line for a rated movie, a
      zero-rated movie, and an unrated one
- [ ] An unrated movie shows five empty, clickable stars labelled `Not rated`
- [ ] Year, runtime, rating and the Watched badge keep the same order and the
      same bullet separators
- [ ] Year present and runtime absent → exactly one separator between the two
      surviving segments
- [ ] Year and runtime both absent → the picker with no leading bullet
- [ ] Choosing a rating on the meta line calls the rate callback with the percent
- [ ] Rating an unrated movie from the detail page persists, and its card shows
      the new rating on the next library load

---

## Phase 5: Docs and the refactor filing

**User stories**: 56

### What to build

The dev-journal entry, recorded as what it is: the project's first prototype
amendment, and the precedent that the sequence is _raise it in grill-me, amend
the prototype, then build to the amended prototype_ — not _build something
different and reconcile later_. It also records the two deferred questions that
close here, `04-movie-detail` Q10 and `02-browse-grid` Q10, as deferred halves
arriving rather than as reversals.

The `useOptimisticEdit(previous, apply, save)` refactor issue is filed against
`useMovieDetail`'s three hand-rolled optimistic writes — a known cost taken
deliberately, because two examples were not enough to design the generalisation
against and three are.

Ratings is ticked ✅ in README and CLAUDE.md **only after that refactor issue
closes**, so the feature list keeps meaning what it has meant for the six
features before it.

### Acceptance criteria

- [ ] `docs/dev-journal.md` records the feature, the amendment and the two
      closed deferrals
- [ ] `docs/ubiquitous-language.md` reflects the shipped vocabulary — **Rating
      picker**, **Half-star segment**, **Rating preview**, and the updated
      **Rating**, **Unrated**, **Meta segment**, **Optimistic save** entries
- [ ] A `useOptimisticEdit` refactor issue exists, describing the three writes it
      would replace
- [ ] README and CLAUDE.md are ticked ✅ for Ratings only once that issue is
      closed
