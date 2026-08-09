# 03 — Card Carousel: close the shipped-feature debt, and make the screen visible

## Problem Statement

The card carousel shipped and works. Every unit is tested, the `continue`
variant renders a real tile, and the Continue Watching row is on the home
screen. But four things are wrong with the code, one thing is wrong with the
markup, and one thing makes the whole feature impossible to actually look at.

**I cannot see a single card.** `familyflix.db` holds zero movies and twelve
genres. Add Movie is 🔜, bulk import is 🔜, and nothing writes a resume
position until the player ships. So running the app shows "Your library is
empty" — not a poster row, not a continue tile, nothing. The design log's
answer to this (Q17) was "seed it from a throwaway script in the scratchpad",
and that answer is exactly why the problem came back: the script is gone, and
the next person to want to eyeball this screen writes it again from scratch.
Every visual claim about this feature is currently unverifiable by looking.

**The carousel's internals carry the seams of how it was built.** The comment
describing the continue tile says 16:9 when the tile is 16:10 — the build plan
said to fix it and it never happened, so the first thing a reader learns about
the tile is false. The two render arms duplicate the tile wrapper entirely;
only the card inside them differs. And the two geometry maps are keyed by
variant while the props branch as a discriminated union, so the type and the
geometry are two separate hand-maintained lists of the same variants — the
design log accepted this as a cost, but it is a cost that can simply be paid
off.

**The two rows are structural twins.** `GenreRow` and `ContinueRow` are both a
`<section>`, a serif heading, and a carousel, with near-identical styles. The
prototype has a third of these coming — Favorites, at 22px with a leading icon
— so this is three copies of one shape, not two.

**The cards are not keyboard-reachable.** Both `ContinueCard` and `PosterCard`
hang `onClick` on a bare `<div>`. There is no tab stop, no key handler, no
role. Someone navigating this app without a mouse cannot open a movie at all.
`eslint-plugin-jsx-a11y` is installed and did not catch it.

**And the dependency list is full of things nothing uses.** Nx scaffolding left
behind an swc toolchain, generator-only packages, a Vitest UI with no script to
launch it, and — worst — `@types/styled-components` at v5 sitting against
styled-components v6, which ships its own types.

## Solution

Nine changes, in five independent groups, none of which changes what the screen
looks like.

**Make the screen visible.** A committed dev seed writes a fixture library —
some in-progress, some watched, some unwatched, one deliberately untagged —
through the existing storage interface, so `npm run db:seed && npm run dev`
puts real cards on screen. It is idempotent and it never touches movies added
any other way: seed rows are recognisable by a reserved video-path prefix, and
a run deletes exactly those before writing them again. This is scaffolding with
a stated end date — the day bulk import lands, the seed's job is done.

**Collapse the carousel's internals.** One geometry record per variant, with
the variant type derived from its keys, so a new variant cannot be added to the
type without also giving it a width and an arrow height. One tile wrapper,
rendered once, branching only on the card inside it. And the aspect-ratio
comment corrected to match the stylesheet.

**Extract the row section.** One unit owning the `<section>`, the heading, and
the slot the carousel goes into, parameterised by heading size and an optional
trailing action. `ContinueRow` and `GenreRow` both compose it; Favorites drops
in later without a fourth copy. The 24px/22px difference is preserved, because
the prototype means it.

**Give both cards a keyboard.** `ContinueCard` has no nested control, so its
root becomes a real `<button>`. `PosterCard` contains the favourite heart, so a
button root would nest a button inside a button; it gets an explicit role, a
tab stop, and an Enter/Space handler instead. Both end up openable without a
mouse; the pixels do not move.

**Cut the dependencies that nothing loads.** Eight devDependencies go, verified
one group at a time against a full typecheck, lint, test and build. Nx stays —
it keeps running the targets — but its generator-only packages go with it.

## Commits

Each commit leaves the app running and the suite green. The groups are
independent; the order within each group is not.

### Group 1 — the seed, first, so everything after it can be looked at

**1. Add the dev seed script.**
Add a seed module under the database folder. It opens the library through the
existing storage factory at the same path the server uses, deletes every movie
whose video path starts with the reserved seed prefix, then adds the fixture
set back. Fixtures use only genres the migration already creates, carry no
poster or backdrop paths (so the cards render their gradient placeholder, which
is what they are specified to do without artwork), and cover every state the
home screen can show: several in-progress with a known runtime, one in-progress
with an unknown runtime, one watched, several unwatched, one in-progress movie
with no genre tags at all, and enough movies in one genre to make that row
overflow so the carousel arrows appear. It reports what it wrote on stdout and
closes the connection. Ship its test in the same commit.

**2. Wire the seed to a script and document it.**
Add the `db:seed` npm script, running the seed through `tsx` the way the dev
server already runs. Amend the CLAUDE.md line that says the database folder
holds only the connection and schema/migrations, so it also names the dev seed
— and say plainly that the seed is temporary scaffolding for a library that has
no other way to be filled yet. Add the reserved prefix to the environment
section if it ends up configurable.

_Everything below this line is now verifiable by looking at the app._

### Group 2 — the carousel's internals

**3. Correct the continue tile's aspect comment.**
16:9 → 16:10, matching the stylesheet. One line. It is its own commit because
it is a factual correction, not a refactor, and it should be readable as one in
the history.

**4. Merge the two geometry maps into one record.**
Replace the separate arrow-height and item-width maps with a single record
holding both per variant, and derive the variant type from that record's keys
rather than declaring it separately. Adding a variant to the type now forces
its geometry to exist. No behaviour change — the same numbers reach the same
two styled props.

**5. Render the tile wrapper once.**
Collapse the two render arms into one pass over the items, with the wrapper
emitted once and only the card inside it chosen by variant. The discriminated
union on the props stays exactly as it is — this changes how the component
renders, not how it is typed. The existing "illegal combinations do not
compile" tests must still fail the typecheck when the union is broken.

### Group 3 — the row section

**6. Add the row section component, with its tests (RED first).**
Write the failing tests, then the component: a labelled section, a heading at a
caller-chosen size, an optional trailing action beside the heading, and
children. No domain knowledge, no data. It lives beside the two rows that use
it rather than in the shared component barrel, because no other feature has
asked for it and the prototype never specified it as a component.

**7. Compose the continue row from it.**
Replace the continue row's own section and heading with the new unit at 24px
and no trailing action. Delete its now-empty styles file. The row's own tests
must pass untouched — they assert a labelled region with a heading, which is
still exactly what it renders.

**8. Compose the genre row from it.**
Same, at 22px, passing the "View all {count}" control as the trailing action.
The genre row keeps only the styles for that control. Its tests, again,
untouched.

### Group 4 — the keyboard

**9. Add the failing keyboard tests for both cards (RED).**
For each card: it exposes an accessible control named for the movie, that
control is reachable by tab, and Enter and Space both open the movie. For the
poster card additionally: the heart is still separately reachable, and
activating the heart still does not open the card.

**10. Make the continue tile a real button.**
Its root becomes a button element labelled with the movie title. It contains no
other interactive element, so this needs no role juggling — the browser gives
it the tab stop and the Enter/Space handling for free. Reset the button's
default styling so the rendered pixels are unchanged.

**11. Give the poster card a keyboard path.**
It cannot become a button, because the favourite heart inside it is one. Its
root gets an explicit button role, a tab stop, a label naming the movie, and a
key handler for Enter and Space. The heart already stops propagation on click;
make sure it does the same for keys, so opening the heart never also opens the
card.

### Group 5 — the mapper rule and the dependencies

**12. Extract the unknown-runtime rule (RED first, then the change).**
The continue mapper and the progress helper each encode "a runtime that is null
or non-positive means unknown", in opposite polarity, in two places. Add one
pure helper that converts a runtime in minutes to seconds or to null when it is
unknown, with its test, and have both callers use it. This is the only
duplication between the two mappers worth removing — see the Decision Document
for why the rest is left alone.

**13. Drop the stale styled-components types.**
Remove `@types/styled-components`. It is v5 types against a v6 package that
ships its own; the theme augmentation resolves through the real package.
Verify: typecheck, lint, test, build.

**14. Drop the swc toolchain.**
Remove `@swc/cli`, `@swc/core`, `@swc/helpers`. Nothing in any config
references swc; the React plugin compiles through Vite. Verify as above.

**15. Drop the Vitest UI.**
Remove `@vitest/ui`. There is no script that opens it. Keep the coverage
provider, which the Vite config names. Verify as above.

**16. Drop the Nx generator-only packages.**
Remove `@nx/react`, `@nx/web`, `@nx/js`, `@nx/workspace`, and the Nx config's
generators block, which only configured the React generator. Nx itself and the
three plugins that infer the targets stay. Verify as above, and additionally
confirm serve still starts.

**17. Test whether jiti is still needed, and drop it if not.**
It is an optional peer of both ESLint and Vite. The ESLint config is `.mjs` and
Vite loads its own `.mts` config, so it may be dead — but this is the one
removal that must be proven rather than reasoned. If lint, build and serve all
survive without it, drop it; if not, leave it and say so in the commit that
does not happen.

### Group 6 — the record

**18. Record the refactor in the dev journal.**
It is currently empty, which is why none of this was flagged before it became a
refactor. Note what shipped, what was deliberately not changed and why, and the
seed's end date.

## Decision Document

**The seed marks its rows by video path, not by a fixed id.** Stable seed ids
were the obvious design, and they are not reachable: the storage layer's add
operation mints its own identifier, so fixed ids would mean widening a
production write interface to serve a development tool. A reserved video-path
prefix achieves the same two guarantees — a run is idempotent, and it can never
delete a movie that arrived any other way — using only the interface that
already exists. No production module changes for the seed's benefit.

**The seed goes in the database folder, and CLAUDE.md is amended to say so.**
That folder is currently specified as holding only the connection and
schema/migrations. The seed belongs with the infrastructure it drives rather
than in a new top-level scripts directory, which would be precisely the
catch-all folder the architecture rules argue against elsewhere. One amended
line is cheaper than one new convention.

**The seed reports through the info channel, not `console.log`.** The code
rules ban `console.log` outright; the environment section already establishes
the info channel as the accepted one for the SQL tracing flag. A script whose
entire job is to tell you what it wrote needs an output channel, and that is
the one with precedent.

**Nx stays; its generator packages go.** Dropping Nx entirely was the larger
dependency win — around ten packages instead of four — but it costs a tech-stack
amendment, deleting two config files, and rewriting the ESLint config by hand,
because the flat React preset currently pulls in four ESLint plugins that
nothing else declares. The workspace scaffold is a listed foundation feature.
Trimming the generator-only packages takes the free part of that win and leaves
the stack claim true.

**Four ESLint plugins that look unused are load-bearing.** The import, React,
React-hooks and jsx-a11y plugins appear in no config file and are declared as a
dependency by no package in the tree — they are required at runtime by the Nx
flat React preset. `eslint-config-prettier` is likewise a required peer of the
Nx ESLint plugin despite never being named in the config. `tslib` is required
by the compiler's import-helpers setting, and the Testing Library DOM package
is a peer of its React counterpart. None of these are removable; all of them
would look removable to a reader doing this cleanup again, so they are written
down here.

**The variant type is derived from the geometry, not declared beside it.** This
closes the hand-sync cost the design log accepted. It closes it in one
direction only: a variant in the type must now have geometry, but a card shape
still needs its own arm on the props union. That asymmetry is deliberate — the
union is what makes illegal item/variant combinations a compile error, and that
guarantee is worth more than symmetry.

**The row section lives with the library feature, not in the shared component
barrel.** By the strict reading of the atomic rules it is a molecule: composed
presentational chrome, no domain knowledge. But the component spec derives the
shared barrel from prototype files, and this unit has no prototype file — it is
an internal extraction serving three rows in one feature. Putting it in the
shared barrel would advertise a reusability nothing has asked for.

**The two heading sizes stay different.** Continue Watching is 24px and genre
rows are 22px in the prototype, and Favorites is 22px with a leading icon. The
extraction parameterises the size; it does not harmonise it. The prototype is
the spec.

**The two cards get different keyboard treatments, on purpose.** The continue
tile contains nothing interactive, so it becomes a real button and inherits
correct behaviour from the platform. The poster card contains the favourite
heart; a button root would nest one interactive element inside another, so it
gets an explicit role and an explicit key handler instead. The inconsistency is
the honest reflection of a real difference between the two cards.

**The mappers keep their overlapping calls.** Both view mappers derive gradient
stops from the id and a progress percent from the same two fields. That is two
lines of incidental similarity between two functions producing two different
shapes, and a shared base would couple them for no gain. What is genuinely
duplicated is one _rule_ — what counts as an unknown runtime — expressed twice
in opposite polarity. That rule is extracted; the rest is left, deliberately.

**Nothing about the API contract changes.** The home payload keeps its named
sections, the endpoints are untouched, and no view model gains or loses a
field. This refactor is entirely internal.

## Testing Decisions

**What a good test asserts here.** External behaviour only: what the screen
shows, what a click or a keypress does, what a module returns. Not which
component rendered it, not how the styles were composed. The existing suite is
already written this way and it is why most of these commits can move code
without touching a test — the row tests assert "a labelled region with this
heading and these movies", which stays true whether the section markup lives in
the row or in an extracted unit. If a refactor commit in this plan forces a
test change, that is a signal the test was asserting structure, and the test
should be fixed rather than the refactor bent around it.

**Modules gaining tests.** The seed module (a first run writes the fixtures; a
second run leaves the same set rather than doubling it; a movie that is not a
seed row survives a run). The extracted row section (renders its heading at the
given size, exposes a labelled region, renders its children, renders the
trailing action only when given one). The runtime helper (a known runtime
converts, null is unknown, zero and negative are unknown). Both cards gain
keyboard tests.

**Modules whose tests should not move.** The carousel, both rows, the home
rows, both mappers, and the home aggregate. All three carousel commits and all
three row commits are behaviour-preserving; their existing tests are the proof.
The carousel's two compile-time guard tests are load-bearing and must keep
failing the typecheck when the props union is broken — a suppression comment
with no error to swallow is itself an error, which is what stops that guard
rotting.

**Prior art to follow.** The seed's test follows the server-side convention
already used across the library slices: a real in-memory database, exercised
through the public storage interface, no mocking of SQLite. The row section's
test follows the existing row tests — render inside the theme provider, query
by role and accessible name. The runtime helper follows the existing pure-helper
tests, which is also what satisfies the rule that every helper has one. The
keyboard tests follow the existing favourite-heart tests, which already assert
accessible names and that the heart does not open the card.

**Verification for the dependency commits is not a unit test.** Each removal is
verified by a full typecheck, lint, test and build, and the Nx one additionally
by starting the dev server. A package that only breaks at serve time will not
be caught by the suite.

## Out of Scope

- **Dropping Nx.** Considered and declined; the reasoning is in the Decision
  Document. If the workspace never grows a second project it is worth revisiting.
- **The Favorites row.** It is the third user of the extracted row section and
  the reason the extraction earns itself, but it is its own listed feature with
  a second surface that has no page yet.
- **Real artwork on the continue tile.** Still blocked on amending the
  prototype, which has no image slot on that card. Unchanged from the design log.
- **A recently-watched sort.** Still has no writer behind it. The continue row
  stays in recently-added order until the player reports positions.
- **The rest of the tsconfig scaffolding.** Decorator metadata, the ES2015
  target and the legacy module resolution are all Nx leftovers in the same
  family as the dead dependencies, but changing compiler settings can move
  emitted output and is not a dependency cleanup. Worth its own small issue.
- **Replacing the seed with real imports.** The seed exists because Add Movie
  and bulk import do not. It is scaffolding, and the commit that ships bulk
  import should be the one that deletes it.
- **Any visual change.** Nothing in this plan moves a pixel. If something looks
  different after it, that is a bug in the refactor.

## Further Notes

The dev journal being empty is not a neutral fact — five of the six problems in
this plan were known or knowable at build time. The 16:9 comment was explicitly
on the build plan and was skipped. The geometry sync cost was written down in
the design log and accepted. The row twins were called "structural twins" in
that same document. None of them were recorded anywhere a later session would
look, so they surfaced as a refactor instead of as a follow-up. The last commit
in this plan starts the journal for that reason.

The keyboard defect is the one nobody wrote down, and it is the only one in
this plan that is a real defect rather than untidiness. `eslint-plugin-jsx-a11y`
is installed and loaded and did not report it, which means its rules are not at
error severity under the Nx preset. Turning them up is not in this plan — it
would likely light up more than this feature — but it is the follow-up that
stops this recurring, and it belongs on the same issue list.
