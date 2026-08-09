# Dev Journal

Running record of what shipped, what was deliberately left alone, and what a
later session should know before touching something. Design logs are immutable
snapshots of a decision at a moment; PRDs and refactor plans describe intent
before the work. This file is the thing in between — written _after_ the work,
and the place a known-but-not-yet-fixed problem goes so that it surfaces as a
follow-up rather than as somebody's later surprise.

Newest entry first.

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
