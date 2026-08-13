## Problem Statement

Every poster and every resume tile on the **Browse home** is clickable, and every
one of them lands on the same dead end. `/movie/:id` has been a real route since
02, but `MoviePage` renders the routed id and a sentence promising a screen later.
Nothing about a movie beyond its poster, title, stars, and watch badge is visible
anywhere in the app.

That gap is bigger than it looks. Most of what the library actually knows about a
movie — its **Synopsis**, its **Director**, its **Cast**, its runtime, its year,
its full **Genre** list, its **Backdrop** — is already on the canonical `Movie`
record and already assembled by `getMovie(id)`. It has simply never had a surface.
A parent standing in front of the home screen can see that a film exists and
roughly how they felt about it, but cannot find out what it _is_ before committing
two hours to it.

There is a second, structural problem underneath. Three of the five affordances
the prototype's detail screen renders belong to features that have not shipped:
Playback, Favorites, and Edit/delete. The screen cannot wait for all three — the
**Browse home** is finished and its cards go nowhere — but it also cannot honestly
render five buttons when two of them have nothing behind them. And the seed, which
exists precisely so that UI work can be checked by looking at it, populates none
of the fields below the fold: every movie in a seeded library has a null
**Synopsis**, no **Director**, and an empty **Cast**, so the lower two-thirds of
this screen would render blank on all twenty-one fixtures.

## Solution

Build the **Movie detail page** as a 1:1 translation of `page.MoviePage.dc.html`
against real data: the full-bleed **Backdrop** area under its three-stop scrim, the
300px **Poster**, the 48px serif title, the **Meta line**, the genre **Chips**, the
primary action row, the clamped-and-expandable **Synopsis**, and the **Credits row**.

The action row ships honest. **Play** and **Edit details** navigate to
**Placeholder routes** — the same device that made `/movie/:id` itself an honest
link for the last two features. **Watched** and **Favorite** are real, optimistic,
and reconcile against what the server actually stored. **Delete** does not ship at
all: the prototype never implemented it (its `onClick` merely closes the menu) and
no confirm dialog is designed anywhere in the handoff, so shipping it would mean
porting the simulation on the one control whose non-effect a user cannot verify.

A new `GET /api/movies/:id` gives the page its movie by URL rather than by
navigation state, so a reload, a deep link, and a click from a row all produce the
same screen. The page distinguishes four **Load states**, and the distinction earns
itself on the _affordance_ rather than the copy: a failure gets **Retry**, an
unknown id gets **Back to library**, because Retry on a 404 is a button that can
never work.

This is also the first screen to drop `MainLayout`. COMPONENT-SPEC §6 already ruled
that each page owns its own header; the ⋯ trigger's fixed slot is exactly where
`MainLayout` puts the gear, and the translucent `backdrop-filter: blur(10px)`
treatment on the Back pill is only legible floating over artwork.

Three of the handoff's most-reused pieces come out of this work as shared units:
`prim.Button`, `prim.Chip`, and `mol.ExpandableText`. Every remaining screen in the
prototype needs at least one of them.

The **seed** grows `synopsis`, `director`, and `cast`, with deliberately varied
synopsis lengths — several overflowing four lines, at least one comfortably under —
so that `ExpandableText`'s toggle is observable rather than theoretical. It does
**not** grow poster or backdrop paths: a stored path with no file behind it 404s
through `/api/images/`, which the seed's own docblock already refuses for that
reason.

## User Stories

1. As a parent, I want clicking any poster to open a page about that movie, so
   that the card is a door rather than a decoration.
2. As a parent, I want the movie's title large and unmistakable at the top, so
   that I know I opened the one I meant to.
3. As a parent, I want the year and the running time next to the title, so that I
   can judge whether I have time for it tonight.
4. As a parent, I want the running time written as "2h 8m" rather than in minutes,
   so that I don't have to do arithmetic.
5. As a parent, I want the star rating on the same line, so that everything I need
   to decide with sits in one glance.
6. As a parent, I want a plot summary, so that I can find out what a film is about
   without opening a browser.
7. As a parent, I want a long summary trimmed to a few lines with a "Read more",
   so that the page doesn't become a wall of text before I reach the buttons.
8. As a parent, I want a short summary shown whole with no "Read more" at all, so
   that I am not offered a button that does nothing.
9. As a parent, I want the director and the cast listed, so that I can recognise a
   film by who is in it when the title means nothing to me.
10. As a parent, I want the genre tags shown as chips, so that I can see at a
    glance what kind of film it is.
11. As a parent, I want a big Play button as the most obvious thing on the screen,
    so that watching is never more than one click from deciding.
12. As a parent, I want that button to say "Resume · 52:00" when I'm part-way in,
    so that I know clicking it continues rather than restarts.
13. As a parent, I want to mark a movie watched from this page, so that I can
    record having seen it without going back to the shelf.
14. As a parent, I want the watched mark to fill in immediately when I click it,
    so that the page feels like it responded to me.
15. As a parent, I want to un-mark something I marked by mistake, so that a
    mis-click isn't permanent.
16. As a parent, I want to add a movie to Favorites from here, so that I can act
    on the film I'm currently looking at.
17. As a parent, I want the favorite heart to already be filled if I favorited it
    on the shelf, so that the two screens agree with each other.
18. As a parent, I want a Back button that returns me to exactly where I was —
    same row, same scroll position — so that browsing doesn't restart every time
    I look at something.
19. As a parent, I want Back to still work when I opened the page from a link or a
    reload, so that I am never stranded on a screen with no way out.
20. As a parent, I want a "Watched" badge next to the meta line on a film I've
    finished, so that the page tells me I've seen it before I start it again.
21. As a parent, I want a movie with no artwork to still look designed — the same
    colours as its card — so that a missing poster reads as a style rather than a
    broken image.
22. As a parent, I want the page to fill in while it loads rather than flashing
    empty, so that opening a movie feels instant.
23. As a parent, I want a clear message and a Retry if the movie fails to load, so
    that a hiccup isn't a dead screen.
24. As a parent, I want a movie that no longer exists to tell me so and offer me
    the library, so that a stale link doesn't trap me.
25. As a maintainer, I want Edit reachable from the movie I'm looking at, so that
    fixing a typo starts from the thing that has the typo in it.
26. As a maintainer, I want a movie with no year to show its runtime and stars
    with no dangling separator, so that a gap in my metadata doesn't put a
    floating bullet on my parents' screen.
27. As a maintainer, I want a movie with no year _and_ no runtime to just show the
    stars, so that an incomplete record still reads as a finished page.
28. As a maintainer, I want a 42-minute film to say "42m" and a 120-minute film
    "2h", so that no movie ever claims to be "0h 42m" or "2h 0m".
29. As a maintainer, I want an **Unrated** movie to show no stars at all rather
    than an empty row reading "0.0", so that "nobody has scored this" never looks
    like "we scored it zero".
30. As a maintainer, I want a movie with no synopsis to show no synopsis block at
    all, so that an empty clamped box with no toggle never reads as a bug.
31. As a maintainer, I want a movie missing only its director to show "—" under
    Director and keep the cast beside it, so that the block doesn't reshuffle
    between movies.
32. As a maintainer, I want the whole Credits row omitted when both the director
    and the cast are missing, so that I'm not shown two empty labelled columns.
33. As a maintainer, I want the ⋯ menu to hold only Edit details for now, so that
    I'm not offered a Delete that looks real and does nothing.
34. As a maintainer, I want the ⋯ menu to close on Escape and on a click outside,
    so that it behaves like every other menu I use.
35. As a maintainer, I want keyboard focus to return to the ⋯ button when the menu
    closes, so that the page is usable without a mouse.
36. As a maintainer, I want the seed to give movies real synopses of varying
    length, so that I can _see_ that the clamp and its toggle work.
37. As a maintainer, I want a movie's backdrop rendered behind the title when one
    exists, so that the importer lights this screen up with no frontend change.
38. As a maintainer, I want the poster's title-and-tag overlay drawn only when
    there is no real poster, so that artwork is never covered by text duplicating
    the heading beside it.
39. As a maintainer, I want to know that marking a movie watched clears its resume
    position, so that the round trip's behaviour is a documented decision rather
    than a surprise.
40. As a developer, I want the page to load its movie from the URL rather than
    from navigation state, so that a reload, a deep link, and a click all render
    the same screen.
41. As a developer, I want "not found" and "failed to load" to be separate states
    offering different actions, so that the screen never shows a button that
    cannot possibly work.
42. As a developer, I want every "what if this field is missing" rule made in one
    pure mapper, so that the component has no display conditionals worth arguing
    about.
43. As a developer, I want both toggles to revert when the save fails and to trust
    the server's echo over what they assumed, so that the page never claims
    something is saved that isn't.
44. As a developer, I want the watched route to dispatch to the same mutators
    every other caller uses, so that this page doesn't invent its own watch
    semantics to dodge a documented convention.
45. As a developer, I want `Button`, `Chip`, and `ExpandableText` built as shared
    units rather than inline on this page, so that the four screens that need them
    next inherit them.
46. As a developer, I want the page to scroll inside its own container, so that
    the backdrop's height doesn't change with the length of the synopsis.
47. As a developer, I want Play and Edit to point at registered placeholder
    routes, so that no link in the app is a lie and the real screens land without
    a link changing.

## Implementation Decisions

**Scope: the full visual surface, with the actions honest.** Every pixel of
`page.MoviePage.dc.html` is translated. **Watched** and **Favorite** are wired for
real; **Play** and **Edit** navigate to **Placeholder routes**; **Delete** is not
built. Rejected: a read-only page — the action row is the visual anchor above the
fold, and favorite/watched already work on the very card the user just clicked, so
a read-only detail page is a _regression_ from the tile that opened it.

**A new feature folder, `features/movie-detail/`,** mirroring the shape of
`features/library/`. Rejected: folding into `features/library/` — that folder is
the _browse home's_ domain, and adding a second screen's endpoint, view model, and
mutation turns it into exactly the catch-all CLAUDE.md's "no generic
`services/`/`lib/`" rule exists to prevent.

**`GET /api/movies/:id` → 200 full `Movie` | 404 `{ error }`.** The page gets its
movie by id from the URL. Rejected: passing the movie down through router state
from the card click — it dies on reload (normal in an Electron shell), and home
rows are capped at 15 per genre so most of the library was never in the payload; a
page that only renders when you arrived by clicking is a modal wearing a URL.
Rejected: an id filter on `MovieQuery` — it duplicates `getMovie` and returns an
array to unwrap.

**`POST /api/movies/:id/watched` → `{ value: boolean }`, echoing what was stored.**
It dispatches to `markWatched` / `markUnwatched`, the dedicated mutators, and the
echo is what lets the optimistic toggle reconcile against what actually persisted
— exactly as the favorite route already does. Both handlers stay thin
parse-call-serialize.

**Marking watched clears the resume position, and that is accepted here.** A movie
at _Resume · 52:00_, marked watched then unmarked, comes back as **Play** from
0:00. Rejected: reaching for `updateMovie(id, {watched})` to dodge it — that would
give this page _different watched semantics than every other caller_ purely to
escape a convention the repository documents in its own interface. If the
convention is wrong it is wrong for everyone; it is **flagged for the
watch-tracking grill** and recorded in the ubiquitous language.

**Four **Load states**: `loading | ready | not-found | error`.** The distinction is
carried by the affordance — `error` offers **Retry**, `not-found` offers **Back to
library**. This extends the `HomeRows` convention, which already treats "library is
empty" as its own situation rather than a failure.

**`MovieDetailModel` carries nullable values, not finished strings.** The **Meta
line** cannot collapse into one string because `StarRating` sits _in the middle_ of
it. The `resumeLabel` precedent ("so the molecule stays logic-free") does not
transfer — that kept a _molecule_ pure, and `MovieDetail` is a feature organism,
the rung that owns logic; interleaving three bullets is not business logic.
Rejected: a discriminated segment array (`{kind:'text'} | {kind:'rating'}`) —
marginally better tested, but abstraction with no payoff for three fixed slots, and
the model stops describing a movie. Every _decision_ still lives in the mapper.

**`detailView()` owns every absent-field rule.** The **Meta line** assembles from
surviving **Meta segments** with separators generated _between_ survivors, so a
dangling `·` is unrepresentable rather than merely avoided. The **Runtime label**
drops zero units — "42m", "2h", never "0h 42m" or "2h 0m", which is what the
prototype's expression yields, never having been fed an edge case. A null synopsis
produces no `ExpandableText` at all. Credits show "—" for a missing one, and the
row is omitted only when **both** are missing — rejected: hiding each credit
independently, which makes the surviving one jump across the page between movies.

**Unrated hides the star segment entirely** on this page, treated as a missing
**Meta segment**. With `showValue` on, an unrated movie would otherwise print
"0.0" — the household asserting it scored the film zero, the opposite of "nobody
has rated this". Rejected: empty stars plus the word "Unrated" — copy the prototype
does not contain, and it belongs with the 🔜 Ratings feature, where an "unrated,
tap to rate" state gets the affordance that acts on it. **`PosterCard` is
deliberately left unchanged** (unrated still reads as 0 stars there): its star row
is fixed furniture in a fixed-height tile, and dropping it would make cards in a
row uneven.

**Backdrop and poster are wired now, with the gradient as fallback.** The overlays
(topTag, title) render **only** on the fallback, following `PosterCard`'s existing
rule. This does not contradict 03's refusal to give `ContinueCard` artwork:
`mol.ContinueCard` has no image slot at all, whereas this area _is_ one — a
full-bleed art area under a three-stop scrim, and a scrim exists to keep text
legible over _photography_. Rejected: backdrop → poster → gradient — a 2:3 poster
stretched across a 62%-height area crops badly and blurs, while the gradient is
deterministic, shares the poster tile's stops, and reads as designed.

**`MainLayout` is dropped for this route.** COMPONENT-SPEC §6 already ruled it
("each page owns its header rather than sharing a `MainLayout` chrome"); the ⋯
button's fixed slot (`top:24px; right:24px`) is precisely where `MainLayout` puts
the gear; and the translucent blur treatment is only legible over artwork.
Accepted: there is no Settings route from this page — **Back** is the designed
escape hatch and returns to a screen that has the gear. The app now carries two
chrome models, and the player and import screens will follow this one.

**Scrolling happens in an inner container** (`height: 100vh; overflow-y: auto;
position: relative`), matching both the prototype's geometry and `MainLayout`'s own
inner-scrolling body. Rejected: document scroll — the art area's 62% would resolve
against _content_ height, so a movie with a two-line synopsis and one with ten
lines would get differently-sized backdrops.

**Back is `navigate(-1)`, falling back to `/` when `location.key === 'default'`.**
This is the faithful translation of the prototype's `detailReturn` flag, which is a
hand-rolled history stack covering the only two origins it had; React Router's real
stack covers those plus search, Favorites, Continue, and future collections.
Rejected: hardcoding `navigate('/')` — it breaks the exact case `detailReturn` was
written for, a parent browsing "Action", opening a movie, and losing their scrolled
place in the row. The choice is router-agnostic: it behaves identically under
`BrowserRouter`, `HashRouter`, and `MemoryRouter`, so **the Electron router
decision is not blocked on this** and is flagged for the shell grill.

**The scroll position that Back returns to is restored by `useRestoredScroll`,
attached to whichever element overflows** (issue #28). `navigate(-1)` was
necessary but not sufficient: the document never scrolls in this app, so the
browser's `history.scrollRestoration` — which only ever restores _document_
scroll — never touched `MainLayout`'s body, and React Router's
`<ScrollRestoration>` needs a data router this app does not use. The hook
remembers one offset per `location.key`, so Back lands where the parent was
while a deliberate trip home is a new entry that starts at the top; it re-reaches
for the offset across a short window, because a container that is still waiting
on its fetch can only scroll to 0. `MainLayout` wires it once for every screen it
wraps; this page wires it itself, being the one screen that owns its container.
Rejected: saving on unmount — a screen left before its content arrived is still
at 0, and storing that erases the position the next visit is owed.

**A carousel's horizontal offset is explicitly out of scope.** A **Genre row**
revisited by Back starts at its first card even when the parent had paged along
it. The vertical position is what "same row" means to a parent — the row they
were looking at is back on screen — and per-carousel offsets are a second
storage key per row on every screen, for a gesture that is one arrow press to
redo. Revisit when search and Favorites add rows worth paging deep into.

**Two new **Placeholder routes**: `PlayerPage` at `/movie/:id/play` and
`AddMoviePage` at `/add`.** Edit navigates to `/add?movie=<id>`. COMPONENT-SPEC §6
lists no `/edit` route — the prototype's `editMovie()` pre-fills the form and jumps
to the add screen with `addContext: 'edit'`. Rejected: inventing `/movie/:id/edit`,
a route the spec does not list, decided mid-build. The query param is
**provisional**; the movie-form grill owns the real contract. **Play writes
nothing** — only the player writes playback state.

**`saveFavorite` is imported from `features/library/api/`, with a comment marking
it for re-homing.** CLAUDE.md already assigns the Favorites feature both surfaces
("mark from card and detail"), so both call sites move together, once. Rejected:
duplicating it — two copies of the subtle echo-reconcile contract is two places to
diverge on failure behaviour. Rejected: hoisting to a new `src/api/` — that
organizes by I/O purity, the exact thing CLAUDE.md rules out server-side, and it is
not analogous to `server/src/db/` (one shared connection vs. per-domain calls that
merely travel over HTTP).

**Three shared units ship: `prim.Button`, `prim.Chip`, `mol.ExpandableText`,** plus
`MoreIcon` and `CheckIcon`. Button and Chip are built to their **full
COMPONENT-SPEC surface** — Button with `primary|secondary|ghost|danger`, `md|lg`,
`icon`, `fullWidth`, `disabled`; Chip with `sm|md`, `selected`, optional `onClick`
— even though this page renders one combination of each. These are the two
most-reused primitives in the handoff (MovieForm, SettingsPage, ImportFlow,
ExportModal all need them) and the spec tables are already written, so building
once beats four later widening commits. Note the prototype's own `data-props`
declares only three Button variants and no boolean props; the spec table is taken
as the fuller statement of the same component.

**`ExpandableText` measures while clamped** — `scrollHeight > clientHeight` on
mount and on resize — and renders its toggle **only** when the text actually
overflows. Clamping is `-webkit-line-clamp`, which cuts at a line boundary.

**Four buttons stay hand-styled, and `prim.IconButton` is deliberately not built.**
Its spec'd surface (size default 46, `ghost|outline`, no shape prop) was written
against call sites that do not exist yet — back-arrows on MovieForm, SettingsPage,
ImportFlow — and none of this page's four buttons match it: the two toggles are
58px circles with an accent-soft pressed fill, the Back pill and ⋯ are 44px
translucent-over-artwork. No rule is breached: "never build a one-off styled `<div>`
when a primitive exists" is about primitives that _already exist_. Flagged for
`request-refactor-plan` once three real screens can be compared.

**The ⋯ **Edit menu** ships with one item.** Delete lands beside it with its own
feature. Rejected: porting Delete as the prototype has it — a red destructive row
that closes the menu and does nothing. Rejected: a disabled Delete row —
permanently greyed with nothing to explain it, reading as "this movie can't be
deleted" rather than "not built yet". The menu is real `<button>`s with
`aria-haspopup` / `aria-expanded`, closing on Escape, outside pointerdown, and
activation, returning focus to the trigger.

**The seed grows `synopsis`, `director`, and `cast`,** with synopsis lengths chosen
so several overflow four lines and at least one does not. Rejected: adding
`posterPath` / `backdropPath` — a stored path with no file behind it 404s through
`/api/images/`, and the seed's docblock already refuses them for that reason.
Accepted, pre-existing: re-seeding re-mints every movie id, so gradients shift and
any open `/movie/:id` 404s — this is the first screen where that is visible.

**`MoviePage` is composition-only,** per the pages rule: no `MainLayout`, the
scroll container, and `MovieDetail`.

## Testing Decisions

A good test here asserts what a parent or a caller can observe — the text on the
screen, which button is offered, what the endpoint returns — and never how it was
produced. No test should assert a styled-component's class name, a mapper's
intermediate value, or that a particular helper was called. Rendering tests drive
the component the way a user does (query by role and text, click the button, press
Escape) so that a refactor preserving behaviour keeps its tests green.

Prior art already in the repo, to follow rather than reinvent: the pure-unit tests
beside `view` and `continueView`; the hook test beside `useHomeRows` (load states,
optimistic toggle, revert-on-failure, stale-response guarding); the api-client test
beside `features/library/api`; the component tests beside `PosterCard` and
`ContinueCard`; the load-state tests beside `HomeRows`; and the repository tests in
the `library/` domain modules, which open a **real `:memory:` SQLite database** and
assert through the public storage interface rather than mocking the driver.

**Tested modules:**

- **`detailView`** — the mapper, and the densest test in this slice, because every
  absent-field decision lives here. Covers: the **Runtime label**'s three wordings
  (`2h 8m`, `42m`, `2h`) and a null runtime; **Unrated** producing a null rating
  percent, distinct from a stored 0; the **Play label** switching to
  `Resume · 52:00` for an **In-progress** movie; `hasCredits` false only when both
  director and cast are absent, and the "—" substitution when only one is;
  backdrop and poster path resolution to `/api/images/` URLs and to `null`; the
  gradient stops being deterministic from the id; `topTag` composed only for the
  fallback case.
- **The two routes**, against real `:memory:` SQLite. `GET /api/movies/:id` returns
  the fully-assembled movie for a known id and 404s an unknown one.
  `POST /api/movies/:id/watched` dispatches to `markWatched` for `true` (and the
  resume position is observably zeroed afterwards) and `markUnwatched` for `false`,
  echoes the stored value, 400s a non-boolean body, and 404s an unknown id —
  matching the favorite route's existing shape.
- **`useMovieDetail`** — the four **Load states** reached from their real causes: a
  404 producing `not-found`, a rejected fetch producing `error`, and `retry`
  re-running the load. Both optimistic toggles show the new value immediately,
  revert when the save rejects, and take the server's echo when it differs from
  what was assumed. A retry landing while an earlier load is in flight must not let
  the stale response overwrite it.
- **`MovieDetail`** — the organism. The **Meta line** renders no dangling separator
  when a segment is missing, and renders stars alone when only the rating survives.
  No synopsis means no `ExpandableText` in the tree at all. The **Credits row** is
  absent when both credits are, and shows "—" when one is. `not-found` offers a
  library link and **no** Retry; `error` offers Retry. The **Edit menu** opens,
  exposes one item, closes on Escape and outside click, and returns focus to the
  trigger. Clicking Play and Edit navigates; clicking the toggles raises their
  handlers.
- **`prim.Button`** — every variant and size renders, `icon="play"` adds the glyph,
  `disabled` blocks the click, `fullWidth` is applied, and the click handler fires.
- **`prim.Chip`** — label renders; `selected` is reflected; with `onClick` it is an
  activatable control and without it a static tag.
- **`mol.ExpandableText`** — the toggle appears only when the text overflows and
  not when it fits; toggling switches the label between "Read more" and "Show
  less" and unclamps the copy. Note: jsdom reports `scrollHeight` and
  `clientHeight` as 0, so the overflow measurement must be driven by stubbing those
  layout reads — the test asserts the _decision_ ("did a toggle appear"), never the
  measurement mechanism.
- **`api`** — `fetchMovie` resolves the parsed movie, distinguishes a 404 from
  other failures (this is what makes `not-found` reachable), and `saveWatched`
  returns the echoed value and rejects on a non-2xx.

`MoviePage` is not separately tested beyond the composition it performs — it is
composition-only by the pages rule, which is the reason for choosing that seam. The
placeholder `PlayerPage` and `AddMoviePage` are documented stubs and carry no
tests, following the precedent `MoviePage` itself set in 02.

## Out of Scope

- **Delete movie** — never implemented in the prototype (its handler only closes
  the menu) and no confirm dialog is designed anywhere in the handoff. It ships
  with its own feature, beside Edit in the same menu.
- **The player** — Play navigates to a **Placeholder route** and writes nothing.
  Only the player writes playback state.
- **The Add / Edit form** — Edit navigates to a placeholder; `?movie=<id>` is a
  **provisional** contract and the movie-form grill owns the real one.
- **`prim.IconButton`** — deferred until three real call sites exist to compare;
  none of this page's four buttons match its spec'd surface.
- **Interactive rating** — the 🔜 Ratings feature owns the half-star picker and any
  explicit "Unrated" affordance.
- **Changing `PosterCard`'s unrated rendering** — resolved for the detail page
  only; the card's fixed-height tile is a different constraint, and the ambiguity
  stays open in the ubiquitous language.
- **Migrating `HomeRows`' hand-rolled `RetryButton` to the new `prim.Button`** — a
  change to shipped, tested code for no user-visible gain. Refactor fodder.
- **The Electron router decision** — `navigate(-1)` and the `location.key` fallback
  are router-agnostic; the shell grill picks between `HashRouter`, serving the
  renderer over the bundled Express process, and `MemoryRouter`.
- **Poster and backdrop files in the seed** — a stored path with no file behind it
  404s; the importer is what lights the artwork paths up.
- **Search, filter, sort, the snackbar system, and the back-to-top FAB** — still
  their own features, still absent from this screen.
- **Any redesign of the detail screen** — this is a translation of
  `page.MoviePage.dc.html`, not a reinterpretation of it.

## Further Notes

This slice closes a loop opened two features ago. `/movie/:id` was registered as a
**Placeholder route** in 02 specifically so the browse home's cards would have
honest destinations; 03 fixed the **Continue card** to open the movie rather than
the player. Neither link changes here — the real screen simply lands behind the URL
they already point at, which is the whole argument for having registered them
early. This slice creates two more placeholders on the same principle.

The **Meta line** is the most instructive part of the design. The prototype hard-
codes year `·` runtime `·` stars because it was only ever fed complete sample data;
fed a real record with a missing year it renders a bullet floating with nothing on
either side of it. Generating separators _between survivors_ rather than after
segments makes that state unrepresentable instead of merely unlikely, and it is why
`detailView` returns nullable values rather than a pre-joined string.

Two decisions here are knowingly imperfect and recorded as such. Marking a movie
**Watched** destroys its **Resume position** — correct for finishing a film, wrong
for "I've seen this before", and unfixable at this layer because it is a documented
repository convention shared by every caller. And `?movie=<id>` is a placeholder
contract invented to avoid inventing a route the spec does not list. Both are
flagged in `docs/ubiquitous-language.md` for the grills that own them.

The backdrop and poster code paths ship **untested against real files** until the
importer exists — the same bargain `PosterCard.posterUrl` already took, and the
reason the seed still carries no artwork. Wiring them now means the TMDB importer
lights this screen up with no frontend change at all.
