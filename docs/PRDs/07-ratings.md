## Problem Statement

I can see every movie's rating. I cannot set one.

Stars are everywhere in FamilyFlix already — thirteen pixels on every **Poster
card**, twenty on the **Movie detail page**'s **Meta line**, a `4+ stars`
**Minimum rating** pill on the browse home, and a `highest-rated` **Sort
order**. The column has been in the schema since `01-library-core`
(`rating INTEGER CHECK(rating BETWEEN 0 AND 10)`, `NULL` meaning **Unrated**),
the `curation` slice has exposed `setRating(id, units | null)` since the same
feature, and the design prototype has had a `mol.RatingPicker` since the
handoff.

None of it is reachable. There is no route that writes a rating, no client call
that asks for one, and no control anywhere in the app that a person can click.
Every rating currently in the database got there through the dev seed. If I
disagree with one, or if a movie arrives with none, there is nothing I can do
about it from inside the app.

Two earlier decisions made this worse on purpose, both explicitly waiting on
this feature:

- `04-movie-detail` Q10 hid the star **Meta segment** _entirely_ when a movie is
  **Unrated**, because five empty stars printing `0.0` read like a verdict —
  "we watched it and scored it nothing" — rather than an absence. That was the
  right call for a display-only row, and it means the movies most in need of a
  rating are precisely the ones showing no stars at all.
- `02-browse-grid` Q10 mapped **Unrated** to `0` on the **Poster card**, noted
  that this is "visually identical to a real 0", and left it in the glossary as
  an open ambiguity to be "revisit[ed] with the **Ratings** feature".

So the honest statement of the problem is three-part: the write path does not
exist, the control that would drive it exists only as a prototype file with no
call site, and **Unrated** is still being faked as a zero at two different rungs
because nothing has ever needed to tell them apart on screen.

## Solution

**The stars on the detail page become the thing you click.**

The **Meta line**'s rating segment stops being a `StarRating` and becomes a
**Rating picker** — same position, same 20px size, same place in the line
between the runtime and the Watched badge. Hover a star and it fills to show
what you would get; move away and it snaps back to what is stored. Click and it
saves. The label beside it reads `4.0 / 5`, or `Not rated` when there is none.

Ten **Half-star segments** span the row, so the left half of the third star is
`2.5` and the right half is `3.0`. Clicking the segment that already holds the
current value clears the rating back to **Unrated** — the same "click it again
to turn it off" grammar the favorite heart and the watched tick already use, and
the only undo a mis-click has until the maintainer's form ships.

**An unrated movie now shows five empty, clickable stars** instead of nothing.
`04-movie-detail` Q10's omission is retracted, exactly as Q10 itself predicted
it would be: empty stars that print `0.0` sound like a judgement, but empty
stars you can _click_, labelled `Not rated`, read as an invitation. On the
**Poster card**, where there is no picker and the star row is fixed furniture in
a fixed-height tile, the five empty stars stay but the numeric value goes — so
**Unrated** reads `★★★★★` and a real zero reads `★★★★★ 0.0`, and the ambiguity
`02-browse-grid` left open is closed.

Behind it, `POST /api/movies/:id/rating` takes `{ value: number | null }` and
echoes what it stored — the third sibling of `/favorite` and `/watched`, same
conventions, same optimistic bargain: show the new value at once, take the
route's echo over what was assumed, put the old value back if the save is
refused.

This is a deliberate amendment to the prototype, which puts its only picker in
`feat.MovieForm` — an unscheduled maintainer screen. README and CLAUDE.md file
Ratings under **Browse & discover (parent-facing)**, and a parent-facing feature
reachable only through the maintainer's Add-Movie form contradicts its own
placement. The prototype is amended first, then built to.

## User Stories

### Rating a movie

1. As a parent, I want to see a row of stars on the movie detail page that
   responds when I move the mouse over it, so that I can tell it is something I
   can use rather than a label.
2. As a parent, I want to click a star and have that become the movie's rating,
   so that I can record what I thought of it without opening any kind of form.
3. As a parent, I want the rating I just set to appear instantly, so that the
   click feels like it did something rather than like a request I have to wait
   on.
4. As a parent, I want to click the left half of a star to give it a half
   rating, so that I can say "three and a half" rather than being forced to
   round.
5. As a parent, I want hovering over a segment to preview exactly the fill I
   would get, so that I can aim at three-and-a-half without guessing where the
   boundary is.
6. As a parent, I want the preview to disappear and the stored rating to come
   back when I move the mouse away, so that hovering never changes anything by
   accident.
7. As a parent, I want the number beside the stars to read `4.0 / 5`, so that I
   know what scale I am on.
8. As a maintainer, I want the rating I set to still be there after I reload the
   page or come back tomorrow, so that it is a record and not a session
   decoration.
9. As a maintainer, I want a rating I set on the detail page to show on that
   movie's poster card the next time the library loads, so that the two screens
   agree.

### Changing my mind

10. As a parent, I want to click a different star to change a rating I already
    set, so that a first impression is not permanent.
11. As a parent, I want clicking the segment that already holds the current
    rating to clear it back to unrated, so that a mis-click is recoverable
    without a second control on screen.
12. As a parent, I want the label to change back to `Not rated` when I clear it,
    so that I can see the clear actually took.
13. As a maintainer, I want a cleared rating to become genuinely unrated in the
    database rather than a zero, so that "I haven't scored this" and "I scored
    this nothing" stay different facts.
14. As a maintainer, I want the picker to be unable to set a flat zero at all,
    so that clearing is unambiguous — its smallest click is half a star, and a
    literal `0` can only ever arrive from a seeded import.

### The unrated movie

15. As a parent, I want an unrated movie to show five empty stars I can click,
    so that the movies most in need of a rating are the ones offering me the
    control.
16. As a parent, I want an unrated movie's label to read `Not rated` rather than
    `0.0`, so that it does not look like we watched it and hated it.
17. As a maintainer, I want the rating segment to be present on the meta line
    for every movie without exception, so that I never have to wonder whether a
    missing control means unrated or means broken.
18. As a parent, I want an unrated movie's poster card to show five empty stars
    with no number beside them, so that I can tell it apart at a glance from a
    movie somebody actually rated zero.
19. As a maintainer, I want a genuinely zero-rated movie's card to still read
    `★★★★★ 0.0`, so that the seeded zero is not silently reclassified as
    unrated.
20. As a parent, I want unrated movies to keep their star row on the card rather
    than losing it, so that the grid's tiles stay the same height and the rows
    do not jump.

### The rest of the meta line

21. As a parent, I want the year, runtime, rating and Watched badge to keep the
    same order and the same bullet separators they have now, so that nothing
    about the page appears to have moved.
22. As a maintainer, I want a movie with no year and no runtime to show the
    picker with no dangling bullet in front of it, so that the line still reads
    correctly when it is the only segment left.
23. As a maintainer, I want a movie with a year but no runtime to still get
    exactly one bullet between the two surviving segments, so that the existing
    interleaving keeps working now that one segment is permanent.

### Keyboard and assistive technology

24. As a keyboard user, I want to reach each half-star with Tab, so that rating
    a movie does not require a mouse.
25. As a keyboard user, I want focusing a segment to preview the same fill that
    hovering it would, so that I get the same feedback a mouse user gets.
26. As a keyboard user, I want Enter or Space on a focused segment to set that
    rating, so that the control behaves like the button it is.
27. As a screen-reader user, I want each segment announced as what it would set
    — "Rate 3½ stars" — so that I know what I am about to commit before I commit
    it.
28. As a screen-reader user, I want the segment holding the current value
    announced as "Clear rating" instead, so that the clear behaviour is
    discoverable rather than a trick you have to know.
29. As a screen-reader user, I want the strip announced as a group called "Your
    rating", so that ten adjacent buttons have a context rather than arriving as
    loose furniture.
30. As a keyboard user, I want the preview to reset when focus leaves the strip
    entirely, so that a stale preview does not persist after I tab away.

### When the save fails

31. As a parent, I want a rating that could not be saved to visibly go back to
    what it was, so that the screen never claims something is stored when it is
    not.
32. As a maintainer, I want a failed save to cost me the rating and nothing else
    — the page stays, the movie stays, no error screen — so that a flaky write
    does not throw away what I was reading.
33. As a maintainer, I want a save that lands after I have navigated to a
    different movie to be discarded, so that a slow response cannot write itself
    onto the wrong page.
34. As a maintainer, I want the value the server echoes to win over the one I
    assumed, so that the screen shows what is actually stored if the two ever
    differ.
35. As a maintainer, I want no snackbar or toast on failure yet, so that this
    feature does not smuggle in the notification system ahead of its own issue.

### The route

36. As a maintainer, I want a dedicated `POST /api/movies/:id/rating` endpoint,
    so that the third household signal follows the same shape as the two that
    shipped before it.
37. As a maintainer, I want the route to echo the value it stored, so that the
    client has something authoritative to reconcile against.
38. As a maintainer, I want `{ value: null }` accepted explicitly as "clear
    this", so that unrated is expressible on the wire and not just absence.
39. As a maintainer, I want a non-integer, a negative, or anything above 10
    rejected with a 400, so that the stored scale cannot be corrupted by a
    hand-made request.
40. As a maintainer, I want a body with no `value` key at all rejected with a
    400 rather than silently treated as a clear, so that a malformed request and
    a deliberate clear are not the same thing.
41. As a maintainer, I want an unknown movie id to answer 404, so that the route
    matches its two siblings rather than pretending to write.
42. As a maintainer, I want rating a movie to leave `updated_at` alone, so that
    scoring an old film does not jump it to the top of "recently added".
43. As a maintainer, I want the route to go through `setRating` rather than
    `updateMovie`, so that the single-column write stays a single-column write.

### The molecule

44. As a developer, I want `RatingPicker` to take a 0–100 percent, so that a
    component that is meant to know nothing about the domain does not start
    speaking in stored units.
45. As a developer, I want its value to be `number | null` rather than a
    `value > 0` test, so that unrated is carried rather than re-derived at every
    rung.
46. As a developer, I want a `size` prop defaulting to the prototype's 30px, so
    that the meta line can ask for 20 and MovieForm can later take the default
    with no changes.
47. As a developer, I want the gaps and hit areas to scale off `size`, so that
    the 20px instance is a smaller picker rather than a broken one.
48. As a developer, I want the hover preview kept as local state inside the
    molecule, so that nothing outside it ever sees an uncommitted rating.
49. As a developer, I want `RatingPicker` to land fully built and tested even
    though it has one call site today, so that MovieForm consumes it later with
    no rating work of its own.
50. As a developer, I want the picker's pixels to match the prototype exactly —
    star size, 5px gaps, 14px dim label, accent fill — so that the amendment is
    to _where_ it lives, not to what it looks like.

### Not on the card

51. As a parent, I want the poster card to keep offering only the heart, so that
    ten half-star hit areas on a 210px tile cannot ambush me on the screen I use
    most.
52. As a maintainer, I want rating to require opening the movie, so that a
    rating is a deliberate act rather than something a scroll can do.

### Keeping the prototype honest

53. As a maintainer, I want `page.MoviePage.dc.html` amended to show the picker
    before any code is written, so that "the prototype is the spec" is still
    true while the feature is being built.
54. As a maintainer, I want `COMPONENT-SPEC.md` updated in the same change, so
    that the spec's component table does not keep pointing MoviePage at
    `StarRating`.
55. As a maintainer, I want this first amendment recorded as an amendment, so
    that the precedent is "change the prototype, then build" rather than "build
    something different and reconcile later".
56. As a maintainer, I want Ratings ticked ✅ in README and CLAUDE.md only after
    the follow-up refactor closes, so that the feature list keeps meaning the
    same thing it has meant for the six features before it.

## Implementation Decisions

### Vocabulary

Already recorded in `docs/ubiquitous-language.md` by the grill-me session:
**Rating picker**, **Half-star segment**, **Rating preview**, and the updated
**Rating**, **Unrated**, **Meta segment** and **Optimistic save** entries. The
two resolved ambiguities — the card's unrated stars, and the retracted unrated
**Meta segment** — are recorded there too.

### The prototype amendment comes first

Before any implementation, two handoff documents change:

- `page.MoviePage.dc.html` — the meta line's `prim.StarRating` import becomes
  `mol.RatingPicker` at `size=20`, wired to the detail's rate handler, and stops
  being conditional on a rating existing.
- `COMPONENT-SPEC.md` — `RatingPicker` gains the `size` prop and the
  `number | null` value; `StarRating`'s row records `number | null`; the
  `page.MoviePage` row lists RatingPicker instead of StarRating.

This is the project's first prototype amendment and sets the precedent CLAUDE.md
describes: raise it in grill-me, amend the prototype, then build to the amended
prototype.

### Types

- `RatingPickerProps` — `value: number | null` (0–100 percent, `null` unrated),
  `size?: number` defaulting to 30, `onChange: (value: number | null) => void`.
- `StarRatingProps.rating` widens from `number` to `number | null`. `null`
  renders five empty stars and suppresses the numeric value even when
  `showValue` is set.
- `PosterCardMovie.rating` widens from `number` to `number | null`.
- `toRatingPercent` widens its return from `number` to `number | null` — it
  stops flattening unrated to zero, which is the change that lets everything
  above it tell the two apart.
- `toRatingUnits` is new: the inverse, percent (or `null`) to stored 0–10 units
  (or `null`).
- `useMovieDetail` gains `rate: (percent: number | null) => void` beside
  `toggleWatched` and `toggleFavorite`.
- `saveRating(id, units: number | null): Promise<number | null>` in the
  movie-detail api module, beside `saveWatched`.

### Server

One new route on the existing router: `POST /movies/:id/rating`.

- Body `{ value: number | null }`, echoed back as `{ value }` on success.
- `null` is validated explicitly — a `typeof value !== 'number'` check alone
  would let anything non-numeric through as a clear, so the accepted set is
  "exactly `null`, or an integer 0–10".
- A missing `value` key is a 400, not a clear.
- Anything else — a float, a negative, above 10, a string, a boolean — is a 400
  with the same message shape the existing `?rating=` rejection uses.
- Unknown id is a 404, checked with `getMovie` before writing, exactly as
  `/favorite` and `/watched` do.
- Dispatches to `storage.setRating`, which already exists and is already a plain
  single-column update that does not touch `updated_at`. No storage or schema
  change is needed at all — this feature adds no migration.

### Why a dedicated route rather than `PATCH /movies/:id`

`setRating` is a documented dedicated mutator in the `curation` slice, and both
existing single-signal writes have dedicated routes. `updateMovie` is the
_form's_ path and arrives with movie-form.

### Frontend modules

**New — `components/RatingPicker/`** (`.tsx` / `.test.tsx` / `.styles.ts`, plus
one line in `components/index.ts`). The deep module of this feature: everything
about half-star geometry, hover and focus preview, the clear-on-current-segment
rule, and the label lives behind three props. Its ten hit areas are
`<button type="button">` rather than the prototype's bare `<div onClick>`, each
with an `aria-label` — `Rate 3½ stars`, or `Clear rating` on the segment holding
the current value — with `onFocus` mirroring `onMouseEnter`, and `role="group"`
plus `aria-label="Your rating"` on the strip. Identical pixels, real semantics.

**New — `utils/toRatingUnits/`** (`.ts` / `.test.ts`, plus the barrel line). The
percent-to-units inverse, `null` in and `null` out. Pure and trivially testable,
which is the point: the one place the domain's 0–10 scale meets the component
layer's percent.

**Modified — `primitives/StarRating/`**: accepts `null`, renders empty stars,
suppresses the value.

**Modified — `utils/toRatingPercent/`**: returns `number | null`.

**Modified — `features/library/view/view.ts`**: stops flattening `null` to `0`
when building the card view model.

**Modified — `features/movie-detail/`**:

- `MetaLine/` renders `RatingPicker` at 20px, unconditionally, and takes a rate
  callback. The `metaSegments` interleaving survives unchanged — `year` and
  `runtimeLabel` stay nullable, so the no-dangling-separator machinery still
  earns its place; only the rating segment stops being omissible.
- `detailView/detailView.ts` — the `movie.rating === null ? null : …`
  special-case collapses into a plain `toRatingPercent` call now that the util
  carries `null` itself.
- `api/api.ts` — gains `saveRating`.
- `useMovieDetail/` — gains `rate()`.

### `rate()` is hand-rolled, not `useOptimisticSave`

`useOptimisticSave` is boolean-only by explicit design, and its own comment names
this arrival: a save with more than two values has to be told what to put back.
`rate()` keeps the same bargain hand-rolled — capture the previous
`ratingPercent`, apply the new one immediately, reconcile against the route's
echo, restore the captured value on rejection — and routes through the existing
`editMovie` guard so a response landing after the page has moved on is discarded.

Three hand-rolled optimistic writes in one hook is then real duplication. It is
filed as a **refactor candidate** (`useOptimisticEdit(previous, apply, save)`)
for step 7 of the workflow, deliberately not generalised mid-build from two
examples.

### Data flow

`MetaLine` → `RatingPicker.onChange(percent | null)` → `useMovieDetail.rate()` →
`toRatingUnits` → `saveRating` → `POST /api/movies/:id/rating` →
`curation.setRating(id, units | null)`. The echo comes back up the same path and
reconciles the optimistic value.

No cross-screen store is introduced. The browse grid sees a new rating on its
next load, exactly as favorite and watched behave today.

### Phasing

1. **Thinnest end-to-end slice.** The route (+ tests), `saveRating`,
   `toRatingUnits` (+ test), and `rate()` wired to a `RatingPicker` in the meta
   line at its stored value. Rated movies only; unrated still omits the segment.
   A click persists and survives a reload.
2. **The molecule in full.** `RatingPicker` to prototype pixels: `size`, ten
   labelled `<button>` segments, hover and focus preview, the `4.0 / 5` /
   `Not rated` label, click-the-current-segment to clear.
3. **The unrated retraction.** Widen `StarRating` and `toRatingPercent`;
   `detailView`'s special case collapses; the meta line's rating segment becomes
   unconditional; `MetaLine` tests updated.
4. **The poster card resolution.** `PosterCardMovie.rating` widens, `view()`
   stops flattening, `StarRating` omits the value when `null`.
5. **Docs.** Dev journal; feature lists ticked only after the refactor issue
   closes.

The prototype amendment lands before phase 1.

## Testing Decisions

A good test here states something a person could notice. It clicks the segment a
parent would click and asserts the label they would read; it posts the body a
client would post and asserts the status and the echo. It does not assert that
`toRatingUnits` was called, that state was set once rather than twice, or that a
particular styled-component received a particular prop. If a test would still
pass after the feature stopped working, or fail after a rename that changed
nothing, it is testing the wrong thing.

All six areas below get tests.

### Server (prior art: `routes.test.ts` `POST /api/movies/:id/watched`, `curation.test.ts` — real SQLite temp files, nothing mocked)

- Stores a rating and echoes the value it stored.
- Stores `null` and echoes `null`; a subsequent read shows the movie unrated.
- Overwrites an existing rating.
- Accepts both ends of the scale, `0` and `10`.
- 400 on a float, a negative, `11`, a string, a boolean, and on a body with no
  `value` key — each leaving the stored rating untouched.
- 404 on an unknown id, with nothing written.
- Rating a movie does not change `updated_at`, and does not move it in a
  `recently-added` ordering.

### Pure modules (prior art: `toRatingPercent.test.ts`, `view.test.ts`)

- `toRatingUnits`: `null` → `null`; `100` → `10`; `50` → `5`; `0` → `0`; the
  half-star points round-trip against `toRatingPercent`.
- `toRatingPercent`: `null` → `null` (the changed case), integers unchanged.
- `view()`: an unrated movie maps to `rating: null` rather than `0`; a
  zero-rated movie maps to `0`.

### Components (prior art: `PosterCard.test.tsx`, `FilterDropdown.test.tsx` — RTL, user-facing queries, `userEvent`)

`RatingPicker`:

- Renders ten segments, each an accessible button.
- Clicking the fourth star's right half emits `80`; its left half emits `70`.
- Clicking the segment holding the current value emits `null`.
- Hovering a segment shows that fill; leaving the strip restores the stored
  value; no `onChange` fires from hover alone.
- Focusing a segment shows the same preview hovering it does; blurring the strip
  restores.
- Enter and Space on a focused segment emit the same value a click does.
- Label reads `4.0 / 5` when rated, `Not rated` when `null`.
- The current value's segment is labelled `Clear rating`; the others are
  labelled with what they would set.
- The strip is a group named `Your rating`.
- `size` changes the rendered geometry; the default is the prototype's.

`StarRating`:

- `null` renders empty stars and no numeric value even with `showValue`.
- `0` with `showValue` still renders `0.0` — the distinction the card depends on.

`PosterCard`:

- An unrated movie's card shows stars and no number.
- A zero-rated movie's card shows `0.0`.

`MetaLine`:

- The rating segment is present for a rated movie, a zero-rated movie, and an
  unrated one.
- Year present, runtime absent → exactly one separator.
- Year and runtime both absent → the picker with no leading separator.
- Choosing a rating calls the callback with the percent.

### Hooks (prior art: `useMovieDetail.test.ts` — the shipped `toggleWatched` / `toggleFavorite` cases)

- `rate()` shows the new rating before the request settles.
- The echoed value replaces the assumed one when they differ.
- A rejected save restores the previous rating, including restoring `null` when
  the movie was unrated.
- `rate(null)` clears optimistically and sends `null` to the route.
- A response arriving after the hook has moved to another movie is discarded.
- `rate()` on a hook that is not `ready` is a no-op.

### Client api (prior art: `api.test.ts` `saveWatched`)

- `saveRating` posts `{ value }` to the rating endpoint with the id encoded.
- Returns the echoed value; falls back to the sent value when the response
  carries none.
- Rejects on a non-ok response.
- Sends and returns `null` correctly.

## Out of Scope

- **Rating from a poster card.** The prototype gives the card a heart only, and
  ten half-star segments on a 210px tile is a mis-click hazard on the screen the
  parents use most.
- **Setting a literal `0`.** The picker's smallest click is half a star. A
  stored `0` arrives only from a seeded import, and this feature reads it
  correctly without being able to write it.
- **A snackbar on a refused save.** The snackbar system is its own planned
  feature. The revert is the feedback, as it is for the heart and the tick.
- **TMDB seeding of ratings.** Stays with import-export.
- **`updateMovie` and MovieForm's rating field.** Arrives with movie-form, which
  will consume the `RatingPicker` this PRD ships.
- **Any cross-screen cache** that would let a poster card restyle itself without
  a reload.
- **Star display itself** — shipped, tested and refactored in earlier features.
  Only the two `null`-carrying widenings touch it.
- **`useOptimisticEdit`.** Filed as a refactor candidate; not built here.
- **Per-person ratings.** Single shared household profile, permanently.
- **Rating history or timestamps.** A rating is one nullable column.

## Further Notes

**This is the first prototype amendment.** Every feature so far has been a 1:1
translation of `docs/handoff/`. This one moves a component to a screen the
prototype does not put it on, for reasons argued in the design log: README and
CLAUDE.md file Ratings as parent-facing; `setFavorite` and `setRating` are
described in the code as "the two single-column household signals" and favorite
is already settable from this page; and building a molecule with no call site is
speculative work this codebase otherwise refuses. The amendment lands in
`docs/handoff/` before the build starts, so the rule stays "the prototype is the
spec" rather than quietly becoming "the prototype is where we started".

**Two deferred questions close here.** `04-movie-detail` Q10's hidden segment is
retracted — Q10 named this feature as its successor, so this is the deferred half
arriving rather than a reversal — and `02-browse-grid` Q10's card ambiguity is
resolved by keeping the star row and dropping the number. Both retractions are
already written into the glossary with their reasoning.

**The schema does not change.** `rating INTEGER CHECK(rating BETWEEN 0 AND 10)`
nullable, and `setRating`, have both been in place since `01-library-core`. This
feature is a route, a molecule, a util, and four `number` → `number | null`
widenings.

**`useMovieDetail` gets its third hand-rolled optimistic write.** That is a known
cost, taken deliberately: two examples were not enough to design
`useOptimisticEdit` against, three are, and the refactor is filed rather than
guessed at mid-build.
