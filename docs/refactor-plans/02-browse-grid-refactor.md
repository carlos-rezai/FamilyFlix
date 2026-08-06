# 02 — Browse Grid: pay down the first-frontend-feature conventions debt

## Problem Statement

`browse-grid` was the first frontend feature, so it stood up the whole
`src/` tree from an Nx welcome scaffold: tokens, theme, primitives,
the first molecule, the first feature, routing, and the first HTTP
route layer. It shipped in four phases and the suite is green (18
files, 152 tests). But standing up a tree and standing it up to the
project's own conventions are two different things, and five gaps are
now visible:

1. **The `@/` import alias documented in CLAUDE.md was never wired.**
   CLAUDE.md's Atomic Design section states imports should read
   `import { Button } from '@/primitives'`. `tsconfig.json` has an
   empty `paths` map, and the codebase has 23 imports that climb three
   or more levels (`../../../types`, `../../../../src/types`). Every
   file move is therefore a rename-plus-rewrite instead of a rename.

2. **The backend reaches up into the frontend tree, and nothing
   type-checks it.** Twelve modules under `server/src/` import the
   shared types via `'../../../../src/types'`. Worse, `server/**` is
   covered by no tsconfig include at all — `tsconfig.app.json` and
   `tsconfig.spec.json` both scope to `src/**`, and the server only
   ever runs through `tsx` and Vitest, which transpile without
   checking. The entire backend is currently unverified by the
   compiler.

3. **`src/types/index.ts` is one 200-line file holding three different
   contracts.** The canonical domain record (`Movie`, `Genre`,
   `Subtitle`, `WatchStatus`), the repository's browse and write
   contracts (`MovieQuery`, `MovieSort`, `GenreCount`, `HomeRow`,
   `NewMovie`, `MoviePatch`), and the frontend's view models
   (`PosterCardMovie`, `GenreRowModel`) all live in one leaf. CLAUDE.md
   permits `types/` to stay flat precisely because its members are
   "single leaves of shared interfaces" — that reasoning describes
   several small files, not one growing monolith.

4. **`useHomeRows` does three jobs in one file.** It owns fetch
   plumbing (two hardcoded endpoint strings, `response.ok` checks,
   response parsing), the load state machine, and the optimistic
   favorite mutation — plus two pure helpers, `toGenreRow` and
   `withFavorite`, declared inline. CLAUDE.md says a feature's
   non-component modules get their own folder with a co-located test
   (the existing `view/` module is the precedent); these two have
   neither.

5. **Tests sit with the wrong units, and three components have none.**
   `LibraryPage.test.tsx` holds nine tests for skeleton / empty /
   error / retry behaviour that `GenreRows` owns — while CLAUDE.md
   says a page is composition only. `GenreRows.test.tsx` holds eight
   optimistic-favorite tests that `useHomeRows` owns. Meanwhile
   `CardCarousel` (which has real branching: arrow visibility,
   edge tolerance, per-variant widths, the poster-variant guard),
   `GenreRow`, and `MainLayout` have no test file at all, breaking the
   three-file shape the convention requires of every component.

Two things that look like defects on first read were checked and are
**not** defects, and this refactor deliberately leaves them alone:

- **The flat `primitives/Icon/` folder is correct.**
  `docs/handoff/COMPONENT-SPEC.md` §3a prescribes exactly this shape,
  and CLAUDE.md's "single-file modules stay flat" exception covers it
  — the icons have no test and no styles, so there are no companion
  files to co-locate and nothing for a folder to hold together. The
  only real problems there are narrow: `IconBase` (the internal SVG
  frame, not an atom) is exported from the public primitives barrel,
  and one icon is named `SettingsIcon` where the spec inventory calls
  it `GearIcon`.
- **`PosterCardMovie` belongs in `src/types/`.** COMPONENT-SPEC §5
  explicitly says to promote it there. It moves within `types/` during
  the split, but it does not move out.

Alongside these, three Nx scaffold leftovers remain: `src/styles.css`
(an empty stub still linked from `index.html` even though
`GlobalStyle` owns the reset), `src/app/` (a rung CLAUDE.md's folder
structure does not define), and stale `.gitkeep` files in `src/pages/`
and `src/layouts/`, both of which now hold real code.

## Solution

Pay the five gaps down in seven phases of tiny, individually-green
commits, ordered so the riskiest work happens last and behind the
strongest safety net.

The ordering principle is **make moves cheap first, then move**:

- **Phase A — config foundation.** Add a `tsconfig.server.json`
  covering `server/**` (wired into the root references) plus a
  `typecheck` script, then add the `@/*` → `src/*` path mapping. Both
  are additive: nothing imports through the alias yet, and the server
  config was probed against the current tree and compiles clean today.
  After this the compiler actually watches the backend.
- **Phase B — alias sweeps.** Two mechanical commits converting `src/`
  and then `server/` to `@/` imports. Every server import of the shared
  types is `import type`, so the alias is erased before runtime and no
  runtime path resolution is needed there; the frontend already loads
  `nxViteTsPaths()` in the Vite config, which serves both the dev
  server and Vitest. From here, moving a file no longer means editing
  its importers.
- **Phase C — structure moves.** Flatten the app root out of the
  undefined `app/` rung, and delete the scaffold leftovers.
- **Phase D — types split.** Break the monolith into four flat topic
  files behind the existing barrel. Because Phase B routed everyone
  through `@/types`, this commit touches no consumer.
- **Phase E — icons.** Rename to the spec's name, and drop the
  internal frame from the public barrel.
- **Phase F — tests to their seams.** Relocate the misplaced tests and
  fill the three missing ones. This lands _before_ the hook surgery on
  purpose: the new `useHomeRows` test file is the safety net that
  Phase G is refactored against.
- **Phase G — decompose `useHomeRows`.** Extract the HTTP calls into a
  feature `api` module and the two pure helpers into their own folders,
  each with a co-located test, leaving the hook as state orchestration.

The hook keeps both loading and the favorite mutation. Splitting them
into two hooks was considered and rejected: the optimistic value and
the loaded rows are literally the same state, so a second hook would
have to receive and write back the first one's rows — moving the
coupling to the call site rather than removing it.

## Commits

Each bullet is one commit leaving the whole suite green (`nx test`),
and from Phase A onward also type-clean (`npm run typecheck`).
Substitute the real issue number for `#<n>`.

### Phase A — config foundation (additive, no source changes)

1. **`chore: [browse-grid] issue #<n> add server tsconfig`**
   Add a `tsconfig.server.json` extending the root config, including
   `server/**/*.ts` and the shared types, with `noEmit` and the
   `node` and `vitest` type packages. Register it in the root config's
   `references` array alongside the app and spec configs. This was
   probed against the current tree and compiles with zero errors, so
   no source fixes ride along. The backend is now compiler-checked for
   the first time. Green.

2. **`chore: [browse-grid] issue #<n> add typecheck script`**
   Add an npm `typecheck` script that builds all three project
   references, so the coverage gap cannot silently reopen. Does not
   touch the pre-commit hook (which stays Prettier-only — see Out of
   Scope). Green, and the new script passes.

3. **`chore: [browse-grid] issue #<n> add @/ path alias`**
   Add `"@/*": ["src/*"]` to the root config's `paths` map. Purely
   additive — no import changes yet, so this commit's only job is to
   prove the alias resolves under the app, spec, and server configs and
   under Vitest (which already resolves tsconfig paths through the
   `nxViteTsPaths` plugin the Vite config loads). Green.

### Phase B — alias sweeps (mechanical; tests are the guard)

4. **`refactor: [browse-grid] issue #<n> use @/ imports across src`**
   Rewrite every cross-folder import under `src/` to the alias:
   `../../types` → `@/types`, `../../primitives` → `@/primitives`,
   `../../../components` → `@/components`, and so on. Sibling imports
   inside a unit's own folder (a component's `.styles` file, an icon's
   `IconBase`) stay relative — the alias is for crossing rungs, not for
   pointing at the file next door. No behaviour change; the 152 tests
   and the typecheck are the proof. Green.

5. **`refactor: [browse-grid] issue #<n> use @/types in server`**
   Replace all twelve `'../../../../src/types'` / `'../../../src/types'`
   imports under `server/src/` with `@/types`. Every one is a type-only
   import, so nothing survives to runtime and `tsx watch` needs no path
   plugin. The server tsconfig from commit 1 is what verifies this.
   Green.

### Phase C — structure moves

6. **`refactor: [browse-grid] issue #<n> move App to src/App`**
   Move the app root and its test out of the undefined `app/` rung to
   `src/App/`, a root-level unit beside the entrypoint. Update the
   entrypoint's import; delete the now-empty `app/` folder. Nothing
   else references it. Green.

7. **`chore: [browse-grid] issue #<n> remove Nx scaffold leftovers`**
   Delete the empty scaffold stylesheet and its `<link>` in
   `index.html` (`GlobalStyle` already supplies the reset), and drop
   the `.gitkeep` files from `pages/` and `layouts/` now that both hold
   real code. Keep every `.gitkeep` still guarding a genuinely empty
   folder (`hooks/`, the unbuilt feature stubs, the unbuilt server
   domains). Green.

### Phase D — types split

8. **`refactor: [browse-grid] issue #<n> split types into topic files`**
   Break the single types leaf into four flat files under the same
   folder, keeping the barrel as the only entry point:
   - the canonical domain record and its parts (`Movie`, `Genre`,
     `Subtitle`, `WatchStatus`),
   - the browse/read contracts (`MovieSort`, `MovieQuery`,
     `GenreCount`, `HomeRow`),
   - the write contracts (`NewMovie`, `NewSubtitle`, `MoviePatch`),
   - the frontend view models (`PosterCardMovie`, `GenreRowModel`).

   Every doc comment travels with its interface unchanged. The barrel
   re-exports all four, so — thanks to Phase B — not one consumer in
   `src/` or `server/` changes. Files stay flat inside the folder, per
   CLAUDE.md's `types/` exception. Green.

### Phase E — icons

9. **`refactor: [browse-grid] issue #<n> rename SettingsIcon to GearIcon`**
   Rename the icon file, its exported component, its barrel entry, and
   its one usage in the layout chrome, matching COMPONENT-SPEC §3a's
   inventory name. The gear button's `aria-label` stays "Settings" —
   that labels the _action_, not the glyph, and the routing tests
   assert it. Green.

10. **`refactor: [browse-grid] issue #<n> unexport IconBase from barrel`**
    Drop the `IconBase` / `IconProps` re-export from the primitives
    barrel. `IconBase` is the shared SVG frame icons render _through_,
    not an atom a consumer composes with; a grep confirms nothing
    outside the icon folder imports either name, and the icons already
    import it relatively from the file next door. A one-line deletion
    that stops the barrel advertising an internal. Green.

### Phase F — tests to the seams that own them

> This phase relocates existing assertions and fills gaps. It changes
> no production code, and it lands before Phase G so the hook has a
> direct test before it is taken apart.

11. **`test: [browse-grid] issue #<n> move load-state tests to GenreRows`**
    Move the row-rendering, skeleton, empty-library, error, non-OK, and
    retry-recovery cases out of the page test and into the `GenreRows`
    test, which is the unit that actually branches on load state. They
    move as-is (same `fetch` stubbing, same assertions); only the
    rendered subject changes from the page to the rows. The "View all
    {count} shows the true total" case is held back for commit 15,
    where it lands on `GenreRow` itself. Green.

12. **`test: [browse-grid] issue #<n> thin LibraryPage to composition`**
    Reduce the page test to what a composition-only page owns: that it
    renders the layout chrome and mounts the genre rows, and that the
    chrome survives loading, failure, and success. Everything else
    already moved in commit 11. Green.

13. **`test: [browse-grid] issue #<n> move favorite tests to useHomeRows`**
    Create a `useHomeRows` test driving the hook directly and move the
    optimistic-fill, server-echo, revert-on-rejection,
    revert-on-non-OK, and same-movie-across-rows cases into it,
    asserting on the rows the hook returns. Add the two cases the hook
    has never had: that the initial load maps the payload into rows and
    reports `ready`, and that a response arriving after the effect has
    been torn down does not overwrite newer state (the in-flight guard,
    currently untested). Keep exactly one favorite case in the
    `GenreRows` test — clicking a heart in a row fills it — so the
    wiring from DOM to hook stays covered end to end. Green.

14. **`test: [browse-grid] issue #<n> add CardCarousel test`**
    The missing test for the component with the most branching. Cover:
    one card rendered per item; the poster variant renders poster cards
    while the continue variant renders none (the Continue Watching
    feature will own that card); both arrows hidden when the row does
    not overflow; the right arrow appearing once it does; the left
    arrow appearing only after scrolling away from the start; and both
    hidden again at the end. jsdom reports zero for every layout
    measurement and does not implement smooth scrolling, so the test
    stubs the scroller's scroll metrics and scroll method — noted as
    the one real difficulty in this phase. Green.

15. **`test: [browse-grid] issue #<n> add GenreRow test`**
    Cover the row's own prop-shaping: the genre title renders as the
    region's accessible name; "View all {count}" shows the count it is
    given rather than the number of cards (the case held back from
    commit 11); opening the row's link and opening a card raise their
    callbacks; and the heart raises the _intended_ value — a
    non-favorite asks to become a favorite and vice versa, since the
    row inverts the card's current value on the way out. Green.

16. **`test: [browse-grid] issue #<n> add MainLayout nav test`**
    Cover the chrome's own behaviour: the logo navigates home and the
    gear navigates to settings, and the body it is handed renders under
    the header. Move these two navigation assertions down from the app
    routing test, which keeps the assertions that are genuinely about
    the route table (each URL rendering its screen, the parameterized
    URLs echoing their param, and a genre name surviving encoding).
    Green.

### Phase G — decompose `useHomeRows` (behind the Phase F net)

17. **`refactor: [browse-grid] issue #<n> extract library api module`**
    Create an `api` module in the library feature owning both HTTP
    calls: loading the home aggregate and saving one movie's favorite.
    It owns the endpoint strings, the URL encoding of the movie id, the
    non-OK-response throw, and the parsing of the echoed saved value.
    Its co-located test asserts the request shape (URL, method,
    content-type, body) and the throw. The hook imports the two
    functions and keeps its own `fetch`-stubbing tests, which still
    pass through the real module — the extraction is invisible to
    them, which is the point. Green.

18. **`refactor: [browse-grid] issue #<n> extract toGenreRow mapper`**
    Move the payload-row-to-render-row mapper into its own folder with
    a test, mirroring the existing `view` module. Its test asserts each
    movie is mapped through `view` and the genre and true-total count
    pass through untouched. Green.

19. **`refactor: [browse-grid] issue #<n> extract withFavorite helper`**
    Move the favorite-setting helper into its own folder with a test.
    Its test asserts the named movie's flag is set in every row it
    appears in, that other movies are untouched, and that the input
    rows are not mutated. After this the hook is state orchestration
    only: status, rows, retry, and the optimistic sequencing around two
    api calls and two pure helpers. Green.

## Decision Document

- **Nothing in this refactor changes behaviour.** Every commit is a
  move, a rename, a config addition, or a test relocation. The 152
  passing tests are the contract; no acceptance criterion from the
  browse-grid plan is weakened, and no user-visible surface changes.

- **The alias is `@/` mapped to the frontend source root**, exactly as
  CLAUDE.md's Atomic Design section already documents. It is used for
  crossing rungs (a feature reaching for a primitive, the server
  reaching for a shared type) and deliberately _not_ for a unit's own
  companion files, which stay relative so a folder remains
  self-contained and movable.

- **The alias works in all four toolchains without new dependencies.**
  The frontend build and the test runner both resolve it through the
  Nx tsconfig-paths plugin the Vite config already loads. The backend
  needs no runtime resolution at all, because every backend import of
  the shared types is type-only and therefore erased. This was
  verified, not assumed.

- **The backend gets its own project reference.** A server tsconfig
  covering the backend tree plus the shared types, registered in the
  root config's references and reachable from a `typecheck` script. It
  compiles clean against the tree as it stands today (probed before
  planning), so adopting it costs no source fixes.

- **The shared types stay shared, and stay flat.** The backend
  continues to consume the same types the frontend does, now through
  the alias rather than a four-level climb. They are split into four
  topic files — domain record, browse contracts, write contracts, view
  models — all flat inside the types folder, per CLAUDE.md's explicit
  exception, and all re-exported from the single existing barrel so the
  public entry point never changes.

- **The view models stay in the shared types folder.** Moving them into
  the components that render them was considered and rejected:
  COMPONENT-SPEC §5 states the card view model should be promoted to
  the shared types, and the form, import, and player models are slated
  to join it. Fighting that now would only have to be undone.

- **The icon folder stays flat, and its layout is not a defect.** It
  matches COMPONENT-SPEC §3a and satisfies CLAUDE.md's single-file
  exception: no test, no styles, nothing to co-locate. Only two narrow
  fixes apply — the internal SVG frame stops being re-exported from
  the public barrel, and one icon takes the spec's name.

- **The frame's prop type is unexported along with the frame.** No
  consumer needs it today. If one ever writes an icon wrapper, it can
  be re-exported then — the barrel should not advertise an internal on
  speculation.

- **The app root leaves the undefined rung.** CLAUDE.md's folder
  structure defines tokens, primitives, components, features, layouts,
  pages, hooks, types, and utils. The app root belongs to none of them,
  so rather than invent a rung it becomes a root-level unit beside the
  entrypoint, keeping its existing job: theme provider, global style,
  and the route table, with the router itself still supplied from
  outside so tests can mount at any URL.

- **The hook keeps both of its concerns; only its plumbing leaves.**
  Two hooks were considered and rejected — the optimistic favorite
  value and the loaded rows are the same state, so a mutation hook
  would have to take the loaded rows and hand back replacements,
  relocating the coupling instead of dissolving it. What leaves is the
  HTTP plumbing (into a feature api module) and the two pure row
  helpers (each into its own folder with a test), matching the
  precedent already set by the feature's view mapper.

- **The feature api module owns endpoints, not policy.** It is the one
  place that knows the two URLs, that a non-OK response is a failure,
  and how to read the echoed saved value. It holds no state, no
  retries, and no optimism — those stay in the hook.

- **Commit ordering is chosen so moves are cheap and risk is last.**
  Config before sweeps (so aliases exist), sweeps before moves (so a
  move edits one file, not its importers), the types split after the
  sweeps (so it touches zero consumers), and the tests before the hook
  surgery (so the surgery has a direct safety net rather than an
  indirect one).

- **No schema change, no migration, no route change.** The API surface
  — the home aggregate, the generic browse endpoint, the favorite
  toggle, and the static image route — is untouched, as is the database
  schema and its version.

## Testing Decisions

- **What makes a good test here:** drive the unit's public surface and
  assert what a user or a caller can observe — rendered text, accessible
  roles and names, raised callbacks, returned values, requests actually
  issued. Never assert on internals: which module holds a function,
  which hook a component calls, how many renders happened, or the shape
  of internal state. The whole of Phase G must be invisible to the tests
  written in Phase F — if extracting a helper forces a test edit, that
  test was measuring the wrong thing.

- **Every test in this refactor already exists or fills a documented
  gap.** Phases A–E add no tests: they are config, sweeps, renames, and
  a split, all guarded by the existing suite plus the newly-enabled
  backend typecheck. Phase F relocates assertions and adds the three
  missing files. Phase G adds one test per extracted module.

- **Modules that gain a test file:** the carousel, the genre row, the
  layout chrome, the home-rows hook, the feature api module, and the two
  extracted row helpers. That closes every three-file-shape violation in
  the browse-grid feature except the three placeholder pages — see Out
  of Scope.

- **Modules whose tests move:** the browse home page sheds its load-state
  assertions to the rows component and keeps only composition; the rows
  component sheds its optimistic-favorite assertions to the hook and
  keeps one end-to-end wiring case; the app routing test sheds its logo
  and gear assertions to the layout chrome and keeps the route table.

- **Deliberate, minimal overlap.** One favorite case stays at the DOM
  level after the rest move to the hook, because "the heart in a row is
  actually wired to the hook" is a distinct claim from "the hook is
  optimistic and reverts." Likewise the api module's request-shape test
  overlaps slightly with the hook's, because the hook's tests stub the
  network rather than the module — keeping them behaviour-level and
  refactor-proof is worth one duplicated assertion.

- **Prior art:** the existing rows and page tests are the model for the
  frontend — a real render under the theme provider and a memory router,
  a stubbed global fetch with a helper that rejects any request the
  screen should not be making, queries by role and accessible name, and
  `waitFor` for anything asynchronous. The card test is the model for
  callback assertions. On the backend, the co-located repository tests
  are the model: a real in-memory database per test, no mocks,
  assertions through the public interface.

- **The one hard test to write is the carousel's.** jsdom reports zero
  for every layout measurement and does not implement smooth scrolling,
  so arrow visibility cannot be observed without stubbing the scroller's
  scroll metrics and its scroll method. The test asserts the arrows the
  user would see, not the internal can-scroll flags.

- **The backend typecheck becomes part of the safety net.** From the
  first commit onward, "green" means the suite passes _and_ all three
  project references compile — which is what makes the alias sweep and
  the types split safe to do mechanically.

## Out of Scope

- **Any behaviour change.** No new states, no copy changes, no visual
  changes, no API or query changes. If a commit needs a test edited to
  stay green, that commit has left this refactor's scope.
- **The five neighbouring features the prototype draws on the same
  screen** — search, filter, sort, the Continue Watching row, the
  Favorites row, and the back-to-top FAB. Still owned by their own
  features; the browse home stays deliberately partial.
- **The deferred primitives and molecules** the prototype specifies but
  no shipped feature needs yet. They arrive with their owners.
- **The three placeholder screens** for a movie, a genre, and settings.
  They render a routed parameter and a sentence, the routing test already
  asserts exactly that, and each is replaced wholesale by its real
  feature. Adding a test file per placeholder now would test scaffolding
  that is designed to be deleted. Documented gap, revisited when each
  real screen lands.
- **The pre-commit hook.** It stays Prettier-only. Wiring lint,
  typecheck, or tests into it is a workflow decision, not part of this
  refactor.
- **Lint rules to enforce the new boundaries** — an import-boundary rule
  that forbids climbing out of a rung, or forbids the backend importing
  frontend paths. Worth considering once the alias is in place, but
  enforcing a convention is a separate change from adopting it.
- **The TMDB metadata layer, the media scan-and-reference layer, and the
  Electron shell.** All still unbuilt and unaffected.
- **Any schema migration.** The database version does not move.

## Further Notes

- **Suggested gating:** Phases A–E are pure structure and config and
  review as one "no behaviour change" unit. Phase F is worth its own
  review pass, since relocating tests is where coverage can silently be
  lost — the reviewer's check is that the total case count only grows.
  Phase G is small and well-guarded by then, and can trail as a separate
  pull request without blocking anything.
- **The alias sweep is the largest diff and the least interesting one.**
  It should be reviewed by running the typecheck and the suite, not by
  reading every line.
- **Enabling the backend typecheck is the highest-value commit here** and
  it is nearly free, since the backend already compiles clean. It is
  ordered first so that everything after it is verified rather than
  merely transpiled.
- **The unrated-versus-zero-stars ambiguity on a card is not addressed
  here.** It was flagged during the browse-grid grill as a design
  question for the movie-detail and edit sessions, and it stays flagged
  — it needs a design decision, not a refactor.
