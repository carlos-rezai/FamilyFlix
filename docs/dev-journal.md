# Dev Journal

Running record of what shipped, what was deliberately left alone, and what a
later session should know before touching something. Design logs are immutable
snapshots of a decision at a moment; PRDs and refactor plans describe intent
before the work. This file is the thing in between — written _after_ the work,
and the place a known-but-not-yet-fixed problem goes so that it surfaces as a
follow-up rather than as somebody's later surprise.

Newest entry first.

---

## 2026-08-19 — Search + Filter refactor (issue #41)

Closed the debt the search + filter build left behind. Fourteen commits in five
groups. Plan: `docs/refactor-plans/05-search-filter-refactor.md`.

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
