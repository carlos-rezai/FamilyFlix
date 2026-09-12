# Refactor plan: Delete a movie — one containment rule, the prototype's own values, and the tests read by behaviour

> Source initiative: [`delete-movie`, issue #114](https://github.com/carlos-rezai/FamilyFlix/issues/114)
> Shipped by issues 115–119. Design log: `docs/design-logs/12-delete-movie.md`.
> Journal entry: `docs/dev-journal.md`, 2026-09-12.
> Filed as issue 121. Refined 2026-09-12 by a second `request-refactor-plan`
> pass read with a 1:1 lens: one duplicate the first pass missed, one commit
> that turned out to be already true, one import out of the siblings' order.

## Problem Statement

The `delete-movie` initiative was small on purpose — four buildable slices,
one new molecule, one new `Media` method, one route — and it was the first
initiative driven end to end by `issue-loop`, with a fresh subagent per step and
nobody watching between commits. The code that came out is close to the log's
design and every acceptance criterion holds. What a read-through finds is the
kind of debt an unattended loop leaves rather than the kind a rushed one does:
nothing wrong, four things written twice or written in build order.

### 1. The containment rule is now spelled three times on the server

`mediaFilePath` states the rule once, for a file: resolve the root and the
candidate through `realpathSync`, refuse an absolute stored path before
resolving anything, and test containment on the two real paths. `removeFile`
and `openFolder` ask it directly, and the `media` domain's docblock says why:
"the containment rule is `mediaFilePath`'s own rather than a second spelling of
it."

The initiative added `containedFolder` to `createMedia` — the same rule, asked
of a directory: resolve, refuse the root itself and anything outside it, and
answer `null` for anything not there. That is the right helper for
`removeMovieFolder`, which removes a folder by the name its stored path's first
segment gives it, whether or not the file is still in it.

But `removeFolder`, the rollback the form wrote a fortnight earlier, still
carries its own inline copy of exactly that check — `realRoot`, `realpathSync`,
the `target === root || !target.startsWith(root + sep)` test — one screen above
the helper that now exists for it. Two spellings of one rule in one file, and
the second one arrived after the first was already there to be reused.

### 2. Two radii and two keyframes the app already has

`Modal.styles.ts` writes the icon tile's corner as `border-radius: 12px` and the
✕'s as `border-radius: 8px`. `radius.md` is `12px` and `radius.sm` is `8px`, and
the same file reads `theme.radius.lg` for the card one block up. The other
literal corners in `components/` and `primitives/` are the `6px` and `7px` that
`mol.SubtitleRow` and `RemoveButton` draw, which no token holds; a corner the
scale has a step for is written through the token everywhere else, and the
movie-form rounds set the rule for the case: "the values it does share with the
scale are written as tokens." The two literals are what a 1:1 translation of
`mol.Modal`'s inline `border-radius: 12px` produces before anyone asks whether
a token exists.

The danger tint on the **Danger row** (`rgba(201, 122, 106, 0.12)`) is not one
of these: log 12 Q5 chose the literal over a `dangerSoft` token on purpose and
`Menu.styles.ts` says so beside it.

The same file also defines its own `fade` and `pop` keyframes — `translateY(8px)`
in, `scale(0.96)` in — and animates the scrim and the card with them. Those are
`ffFade` and `ffPop` from `docs/handoff/tokens.css`, body for body, and
`GlobalStyle` already registers both under those names as "the code-side of the
keyframes in `tokens.css`". The prototype writes `animation: ffFade 0.18s ease`
and `animation: ffPop 0.2s ease`; `ProgressBar` shows what the 1:1 translation
of that line is — `animation: ffIndeterminate 1.25s ease-in-out infinite`, by
name, no local `keyframes` call. `Modal` redefines what the global stylesheet
already has, which is the radius finding again in a different property.

### 4. One import out of the siblings' order

`useDeleteMovie.ts` imports the feature's own `../api/api` before
`@/hooks/useGoBack/useGoBack`. Every other hook in `features/` — `useMovieDetail`,
`useOptimisticEdit`, the player's `useWatchReporter` — reads React, a blank line,
the `@/` imports, then the relative ones. One line, and the only place in the
initiative where the shape of a file does not match its neighbours.

### 3. Tests grouped by the slice that wrote them

`DeleteMovieDialog.test.tsx` has seven top-level blocks. The first three are the
tracer bullet's (the copy, the two buttons, afterwards); the next four are the
in-flight slice's (in flight, dismissed mid-flight, failure, and "the heading
holds any title"). Read by behaviour, that last block belongs beside "the copy",
and the four blocks about what happens after Delete movie is pressed — it
navigates, it reads Deleting…, it survives a dismissal, it re-enables on a
refusal — are one story about confirming. This is the same shape the form's
test had before round two regrouped it, at a fifth of the size.

`routes.test.ts` describes `DELETE /api/movies/:id` twice: once for the row
(Phase 2) and once "— the bytes" (Phase 3). One route, one block.
`createMedia.test.ts` heads its new section with a banner reading `12 — Delete
movie, Phase 3: "the bytes" (issue #117)`, in a file whose older banners already
read the same way — the convention is the file's, and is left alone; the point
here is only that the two `DELETE` blocks are one behaviour split by a build
boundary.

## Solution

Three groups, each a working tree after every commit, in the order above:
the server fold first because it is the one with a real duplicate on the wire,
the prototype's own values second because every commit there is one or two
lines that resolve to the same pixel, the test regroup last because it moves
the most text and changes no assertion. Nine commits.

## Commits

### Group 1 — one containment rule

1. **`removeFolder` asks `containedFolder`.** Replace the inline resolve-and-
   contain in `removeFolder` with a call to `containedFolder`, passing the
   folder it was given — `resolve(root, absolute)` answers the absolute path,
   so the reserved folder's absolute path goes in unchanged; a `null` answer is
   the same early return it makes today. The `rmSync` stays as it is and keeps
   throwing — `removeFolder` is a rollback, before any commit, and the log's
   rule that it does not swallow is unchanged. `containedFolder`'s docblock
   loses "asked of a folder rather than a file" as the thing that distinguishes
   it and gains the two callers. All five `removeFolder` tests and all six
   `removeMovieFolder` tests unchanged.

   _(The first pass's second commit, moving `containedFolder` to follow
   `realRoot`, is dropped: it already does.)_

### Group 2 — the prototype's own values

2. **The icon tile's corner is `radius.md`.** `Modal.styles.ts`, `IconTile`:
   `border-radius: ${({ theme }) => theme.radius.md}`. Same pixel.

3. **The ✕'s corner is `radius.sm`.** `Modal.styles.ts`, `CloseButton`:
   `border-radius: ${({ theme }) => theme.radius.sm}`. Same pixel. Both checked
   in the browser against `mol.Modal`.

4. **The scrim and the card animate by name.** `Modal.styles.ts` drops its
   local `fade` and `pop` and the `keyframes` import with them; `Scrim` reads
   `animation: ffFade 0.18s ease` and `Card` reads `animation: ffPop 0.2s ease`
   — the prototype's lines, resolved by the `@keyframes` `GlobalStyle` already
   registers, on `ProgressBar`'s precedent. Same motion. Checked in the browser:
   the card still pops, the scrim still fades, and nothing in `Modal.test.tsx`
   asserts an animation.

5. **`useDeleteMovie` reads like its siblings.** Swap the two import lines so
   `@/hooks/useGoBack/useGoBack` comes before `../api/api`. `eslint` and `tsc`
   are the whole check.

### Group 3 — tests read by behaviour

6. **The heading test joins the copy.** In `DeleteMovieDialog.test.tsx`, the
   "the heading holds any title" block's tests move into "the copy", which is
   the block about what the dialog says. Leaf names unchanged.

7. **Confirming is one block.** "afterwards", "in flight", "dismissed
   mid-flight" and "failure" become nested blocks under one
   `DeleteMovieDialog — confirming`, in that order, with the shared
   `confirmButton` / `cancelButton` helpers staying at the top of the file.
   The verbose reporter before and after shows the same leaf names with only
   their paths moved.

8. **One `DELETE` block.** In `routes.test.ts`, the "— the bytes" block's tests
   move into `DELETE /api/movies/:id` after the row tests, under one nested
   block named for what they check (the folder goes, another movie's stays,
   a locked file leaves the `204`). Leaf names unchanged.

9. **The journal and the feature table.** `docs/dev-journal.md` gets the
   round's paragraph; README and CLAUDE.md tick **Delete a movie** ✅, because
   the rule is that a feature is Done when its refactor closes, not when its
   build issues do. Closes 121.

## Decision Document

- **`removeFolder` inherits `containedFolder`'s directory check.** The helper
  answers `null` for a path that resolves to a plain file, where the inline
  copy would have handed it to `rmSync`. No caller can produce that — the
  rollback is given the folder `reserveFolder` made — and "a folder inside the
  root" is what the method's name and docblock already promise, so the fold
  tightens the contract to what it says rather than changing it.
- **`removeFolder` keeps its throw.** Three removals with three stated
  contracts is the log's decision (Q17, Q18) and this round does not touch it:
  a rollback throws, `removeFile` and `removeMovieFolder` swallow. Only the
  containment check is shared.
- **The cross-domain import stays.** `media/` importing `mediaFilePath` from
  `playback/` predates this initiative (`openFolder` and `removeFile` both use
  it) and is the reason `containedFolder` lives in `createMedia` rather than
  beside `mediaFilePath`: lifting the rule into a shared module that both
  domains import is a domain question for a round that owns both, not a fold.
- **The hook's rejection is its API.** `useDeleteMovie.deleteMovie` rejects on
  a refused delete; `DeleteMovieDialog` catches it at the button and does
  nothing, because the prototype designs no error state on this screen. The
  catch is one line and it sits where the "no error surface" decision was
  made. Moving the swallow into the hook would make a hook that hides a
  network failure from any future caller to spare a dialog one `.catch`. Left.
- **`Menu` and `Modal` keep separate dismissal contracts.** Both listen for
  Escape on the document while open and both return focus on close, and the
  overlap is about ten lines. Where they differ is what matters: `Menu` returns
  focus to its trigger and closes on a pointerdown outside its slot; `Modal`
  returns focus to whatever had it and closes on a click that lands on the
  scrim. A shared `useEscape` would save six lines and add a third place to
  read. Left, and named so nobody re-derives it.
- **`focusablesIn` stays in `Modal.tsx`.** It is a DOM query with one caller,
  and the Export dialog will use `Modal` rather than the helper. A `utils/`
  folder for it is ceremony until a second component traps focus.
- **The danger tint stays a literal**, per log 12 Q5.
- **Keyframes are written by name, not redefined.** `GlobalStyle` is the code
  side of `tokens.css` and already carries `ffFade`, `ffPop`, `ffBar`,
  `ffSnackIn` and `ffIndeterminate` under the prototype's own names; a styled
  file that needs one writes the prototype's `animation:` line as it stands.
  A local `keyframes` call is for a motion the prototype does not name — and
  `Modal`'s two were not that. This round applies the rule to the file the
  initiative wrote; the two older files that break it are named under Out of
  Scope.
- **`IconTile` stays one element.** The prototype nests a 22px span inside the
  44px tile; the build flattened it and said why in the docblock (the tile's
  grid already centres the glyph, and the size, line-height and ink are the
  same either way). A 1:1 surface, one fewer node, and the log's Q7 tile
  unchanged. Left.

## Testing Decisions

- A good test here asserts what the family or the maintainer can see: a folder
  gone from a real sandbox directory, a dialog that reads Deleting…, a route
  that answers `204`. None of the seven commits changes what any test asserts,
  and the check for that is the one the movie-form rounds used: the verbose
  reporter's leaf names before and after, diffed.
- Group 1 is covered by the eleven existing `removeFolder` / `removeMovieFolder`
  tests against a real sandbox — the escape, the root-itself and the
  already-gone cases are each asserted for both methods.
- Group 2 has no automated test, on the same footing as every other pixel
  commit in the movie-form rounds: a token that resolves to the same string is
  not a behaviour, and neither is a keyframe reached by name rather than by
  reference. Checked in the browser; the import swap is checked by `eslint`
  and `tsc`.
- Group 3 changes nothing but the path of each test's name.

## Out of Scope

- **A `Modal` for the Export dialog.** `Modal` was built as the shell the 🔜
  Export feature draws on; whether its prop surface fits is that feature's
  grill-me.
- **Surfacing a Stranded folder.** Named in the log's trade-offs as the 🔜
  Storage section's job.
- **`routes/index.ts` at 1211 lines.** Round one brought it down from 1661;
  the `DELETE` handler is nine lines and adds nothing to the case. Whatever the
  next cut is, it is not a delete-movie refactor.
- **A shared fetch double.** Thirty test files stub `fetch` with the same
  `vi.fn` / `stubGlobal` preamble, the two new ones included. A `stubFetch` in
  `test-support/` would be a project-wide round, not this one.
- **One leftover sentence of slice narration** in `routes/index.ts`'s `PATCH`
  handler comment ("the whole acceptance criterion this slice is demoable on")
  is the movie-form initiative's, missed by round two because that round was
  scoped to `src/`. One line for whoever next opens the file.

- **The two older files that redefine a named keyframe.** `Menu.styles.ts`
  animates every menu panel with a local `translateY(-4px)` pop where the
  prototype writes `ffPop .14s` for all three of them (`page.MoviePage`,
  `mol.FilterDropdown`, `mol.SubtitleRow`) — a visible deviation, not just a
  duplicate — and `PlayerNotice.styles.ts` redefines `ffPop` at `scale(0.9)`
  and `ffSpin` locally, while `GlobalStyle` does not register `ffSpin` at all.
  The movie-detail and player rounds own those files; the rule this round
  applies to `Modal` is the same one, and they are filed together with the
  `999px` below as one fidelity sweep (issue 122) so the next person
  does not re-find them.
- **`FilterDropdown`'s `999px`** is `radius.pill` written out, in a file the
  search-filter round owns; `ProgressBar`'s conditional `'999px'` is the same
  token. Same rule, different initiative; noted, filed with the sweep above,
  not taken here.

## Further Notes

The first `issue-loop` initiative shipped four slices in under four hours with
every RED commit through the typecheck gate and no `--no-verify`. The three
groups above are what four fresh contexts each doing exactly their slice
produce: nobody was holding the whole feature in their head to notice that
the helper the third slice wrote was one the first initiative's rollback
already needed.

The second pass, read with the prototype open beside the code, found the
keyframes for the same reason: `mol.Modal` was lifted verbatim from
`feat.ExportModal`, and its `animation: ffFade` line is a name the prototype
resolves through `tokens.css`. The build translated the pixel and re-derived
the name — which is exactly what "translate, don't redesign" produces when the
translator has not seen `GlobalStyle`. The rule that comes out of it is one
line: a keyframe the prototype names is written by that name.
