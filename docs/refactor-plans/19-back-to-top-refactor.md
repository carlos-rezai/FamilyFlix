# Refactor plan: Back-to-top FAB — the props in the prototype's order, one stub two suites wrote, and the docs that close the initiative

> Source initiative: [`back-to-top`, issue #165](https://github.com/carlos-rezai/FamilyFlix/issues/165)
> Shipped by issues 166–167. Design log: `docs/design-logs/19-back-to-top-fab.md`.
> Filed as issue 169. The docs-and-glossary slice filed as 168 is folded in here
> as Group 0 and Group 3, on the precedent of 163 into 164, 156 into 157, 148
> into 149 and 140 into 141, and was closed at filing so the initiative has one
> closing issue rather than two; the feature table ticks ✅ when this one closes.

## Problem Statement

`back-to-top` is the fourth initiative driven end to end by `issue-loop`, and
the smallest FamilyFlix has run: two glyphs, one molecule, one control, one line
in the layout. The maintainer's one instruction was the scope the grill ran
under — _translate the prototype 1:1 into the codebase, in its naming,
conventions, patterns and architecture_ — and the sketch was three rungs deep:
a **FAB** made of the app's button primitive, and a **Back-to-top** made of the
FAB.

What shipped is that. `ArrowUpIcon` and `PlusIcon` are `mol.Fab.dc.html`'s two
SVGs on `IconBase`, stroke 2.2, `currentColor`, named for what they draw. The
**FAB** is one more `styled(IconButton)` face beside the favorite heart, the
carousel arrows, the ⋯ trigger and the detail page's circles: absolute at 28px
from the bottom-right corner at `z-index: 60`, the accent fill under the
prototype's near-black ink, no border, the literal accent shadow, the
`:hover:enabled` lift replacing both `background` and `color` so nothing leaks
up from the ghost face, no `transition`. It is named by a required `label`,
chooses the glyph by `icon` at the molecule's own sizes — 24 for the arrow, 26
for the plus — and owns no state, no listener and no effect. **Back-to-top**
takes the scrolling container as a ref, reads its `scrollTop` on every passive
`scroll` and once on attach, holds one boolean written only when the answer
changes, mounts the FAB past `scrollTop > 420` — strictly — and asks the
container alone for the top, smoothly. `MainLayout` renders it in one line after
the body it already owns, handed the ref `useRestoredScroll` attached, with no
state and no prop; its docblock no longer says the FAB "still lands with the
feature that owns it". Every log-19 ruling was read against the code for this
filing — Q5 the primitive, Q6 the props, Q8–Q10 the face, Q11 no visibility in
the molecule, Q12–Q14 the chrome mounting a `components/` control, Q15–Q18 the
threshold, the read on attach, the press and the mount/unmount entrance — and
each holds, with one exception item 1 names. 4742 tests pass across 246 files,
`tsc -b` and `eslint src server` clean.

Rounds 15, 16 and 18 said the debt an `issue-loop` build leaves is small, of a
kind, and made of what a subagent reading one issue cannot see. This round is
smaller than 18's: nothing moves a pixel, nothing changes a wire, and the one
change to a shipping file reorders four lines of a type.

### 1. `FabProps` is not in the prototype's order

Log 19 Q6 rules the props _"1:1 with the prototype's `data-props`, in its
order"_ — `icon`, `label`, `size`, `onClick` — and the PRD's key model repeats
it in the same words. The build declared `label` first, then `icon`, `size`,
`onClick`, and destructures in the same order. Nothing in the file says why;
the likeliest reason is that a required prop was put ahead of the optional ones,
which is a reasonable instinct and not the convention. The `mol.Snackbar` row
in COMPONENT-SPEC is explicit that the props are _"flat and in the prototype's
order"_, and the prop interface is the `data-props` (log 18 Q23). Four lines
move; no test names the order, so no test changes.

### 2. One stub, written twice, that leaves the document changed

`BackToTop.test.tsx` and `MainLayout.test.tsx` each define a `stubScrollTo`
that is the other one to the character — the same four lines, the same
docblock ("jsdom implements `scrollTo` on no element; give the container one
that records the options form, the only form the control ever calls"). The
PRD said "nothing lands in `test-support/`" and cited the carousel suite's
`scrollBy` stub as the precedent for stubbing per test; that was right when one
suite needed it, and the mount suite copying it two commits later is exactly
the case the rung's rule is for — _shared across features, never imported by
shipping code_ — the same rule that gave the Snackbar round `snackbarStack` for
two suites.

The copy also has a shape the rest of `test-support/` deliberately does not:
it assigns `scrollTo` onto an element and never takes it back. For the
container the test creates and removes that is nothing; for
`document.documentElement` and `document.body`, which both press leaves stub
to prove the control asks _nothing_ of them, the assignment outlives the test.
No leaf in either file reads a stale one — each press leaf re-stubs before it
asserts — but `stubScrollMetrics`, `stubFullscreen`, `stubMediaElement` and
`stubDownload` each exist in part to leave the DOM exactly as they found it,
and say so in their docblocks. jsdom has `scrollTo` on `window` and on no
element (`Element.prototype.scrollTo` is `undefined`), so the honest shape is
the `stubFullscreen` one: installed for a `describe` on the prototype jsdom
leaves empty, recording which element was asked for what, deleted on cleanup.

### 3. Two things the build decided alone, both to keep

The face's styled export is `Circle` where the log's contract sketch wrote
`Root`. The sketch was a sketch; the convention among the five other
`styled(IconButton)` faces is a name for what the thing is — `FavoriteButton`,
`Arrow`, `MoreButton`, `CircleToggle`, `ChromeIconButton` — and `Root` is what
a styles file calls its outermost element when it has several. `Circle` follows
the faces. Kept, and recorded.

The mount suite renders the home as a history entry of its own
(`['/settings', '/']`) rather than as the first entry, because `MemoryRouter`
keys its first entry `default` on every render and `useRestoredScroll`'s
module-level map had already remembered that key at 1240 from the restoration
test above — so a body meant to start at its top was truthfully put back past
the line before the control attached. The workaround is order-independent (the
second entry gets a fresh key whatever ran before), documented at the constant,
and the alternative — a way to reset `useRestoredScroll`'s memory from a test —
is a hook growing an affordance for its tests, the thing round 18 took a
`data-testid` off a provider to end. Kept.

### 4. The docs the initiative owes

Issue 168's list, merged here. CLAUDE.md's folder map names neither
`components/Fab/` nor `components/BackToTop/`, its `Icon/` line names neither
glyph, and its `MainLayout/` line still reads "logo, gear, scrolling body" with
no word of what it mounts over the body; the `hooks/` line beside it lists
`useMediaQuery` and `useTheme`, neither of which exists, and not
`useRestoredScroll`, the hook the new `MainLayout` line has to name. README's
tree is coarser but wrong in the same places. COMPONENT-SPEC's `mol.Fab` row
still says _fixed_, _the page mounts it_ and _~420px_, and its Icons table has
`PlusIcon` under "Add affordances" and no `ArrowUpIcon` at all. The glossary
was written by the grill ahead of the build and — every row of _The Back-to-top
FAB_ and the three relationship lines were read against the code for this
filing — holds as written. The journal has no entry for the build and none for
this round.

## Solution

Four groups, each a working tree after every commit: the record of the build
first, so the journal describes what shipped before this round touches it; the
one change to a shipping file second, so it is early and visible; the test
double third; the docs last, because the folder map has to describe the tree
the earlier groups leave. Eight commits, none of which changes what the family
or the maintainer can see.

## Commits

### Group 0 — the record of what was built

1. **The journal's back-to-top entry.** `docs/dev-journal.md` gets the
   initiative's entry, dated by the last build commit (2026-09-21): what
   shipped across 166–167, slice by slice — the two glyphs and the molecule,
   the control and the mount; that it was the fourth initiative driven wholly
   by `issue-loop` and the smallest, and why it is its own initiative (log 18
   Q5, log 19 Q1); the ladder `IconButton` → **FAB** → **Back-to-top** and why
   the bottom rung is `IconButton` and not `Button` (Q5); why the chrome and
   not a feature, the page or a hook mounts the control (Q12–Q14); the one
   thing not in the prototype — the read on attach, for `useRestoredScroll`'s
   sake (Q16); the judgment calls the subagents made alone that the log did not
   name — `label` first in the props (which this round puts back), `Circle`
   for the face, five suites where the log said three (the PRD's amendment,
   on the `UploadIcon` precedent), the `stubScrollTo` written twice and the
   `FRESH_HOME` entry in the mount suite; what was deliberately not built (a
   FAB on any screen but the home, a `GenreLayout` mount, an opt-out or
   threshold prop, a `useBackToTop` hook, a transition, reduced motion, focus
   management, a fix for the corner shared with the Snackbar stack); what is
   known and deliberately not fixed (the focus drop to `document.body` after
   the press, Q19; the notice-over-FAB corner, Q21; `prefers-reduced-motion`
   now unhonoured across eight motions, Q20); the test count (4742 across 246,
   from 4702 across 242); and the follow-ups — which are this plan, by bare
   number.

### Group 1 — the props in the prototype's order

2. **`FabProps` reads `icon`, `label`, `size`, `onClick`.** The interface and
   the destructuring in `Fab.tsx` take the `data-props` order, per log 19 Q6
   and the `mol.Snackbar` precedent; each prop keeps its docblock, and
   `label`'s keeps its sentence about why it is required. The
   `@ts-expect-error` guard that `label` is required still has an error to
   swallow, so the typecheck stays green. No test changes, no runtime change.

### Group 2 — one stub, leaving the document as it found it

3. **`test-support/stubScrollTo/` — an element can be asked for a position,
   and says who asked for what.** A new test-support unit on `stubFullscreen`'s
   shape: called inside the `describe` that needs it, it installs a `scrollTo`
   on the element prototype jsdom leaves empty for the length of that block,
   recording every request as the element asked and the options it was asked
   for, in order, readable back through what the call returns; cleanup deletes
   what was absent so no later file in the worker meets an element that can
   scroll. `window.scrollTo`, which jsdom has, is not its business — a leaf
   that wants to prove the window was left alone spies it as it does today.
   Its own test file, on `stubFullscreen.test.ts`'s shape: an element asked
   for a position is recorded with what it was asked; two elements asked are
   two requests in order; nothing asked is an empty list; and after the block
   the prototype has no `scrollTo` again. No caller yet in this commit; the
   tree is green.

4. **The two suites read the helper, and the copies go.** `BackToTop.test.tsx`
   and `MainLayout.test.tsx` install the stub for their press `describe`s and
   drop their local `stubScrollTo` and its docblock. The two press leaves keep
   their names and their meaning — the container (the layout's own body) was
   asked for `{ top: 0, behavior: 'smooth' }` exactly once, and nothing on
   `window`, the document element or the body — now read as _one request, and
   it was the container's_, with the `window.scrollTo` spy kept as it is. The
   `vi.restoreAllMocks()` in each `afterEach` stays for the window spy. No
   leaf is added, renamed or removed in either suite.

### Group 3 — the docs that close the initiative

5. **COMPONENT-SPEC's Icons table.** `ArrowUpIcon` joins the inventory —
   stroke, `mol.Fab`'s `arrow-up` glyph, the Back-to-top — and `PlusIcon`'s
   "Add affordances" becomes what is true: `mol.Fab`'s `plus` glyph, shipped
   with the molecule, drawn by no screen yet. The `mol.Fab` row itself waits
   for commit 8, with the tick.

6. **CLAUDE.md's folder map and README's tree.** `components/` gains `Fab/`
   (the molecule 1:1, `styled(IconButton)`, presentational to the last prop)
   and `BackToTop/` (the control: the Scroll threshold, the passive listener,
   the read on attach, the press; two files, no styles, because it draws
   nothing of its own); `Icon/`'s parenthetical gains `ArrowUpIcon` and
   `PlusIcon`; `MainLayout/`'s line says it mounts **Back-to-top** over the
   body and why — the body is where the scrolling happens, so the chrome is
   what knows how far it has gone, and it lends the same ref
   `useRestoredScroll` attached; the `hooks/` line beside it names the two
   hooks that exist, `useGoBack` and `useRestoredScroll`, in place of the two
   that never did — corrected here because the new `MainLayout` line names
   one of them, and a map that contradicts itself two lines apart is worse
   than one that is stale; `test-support/` gains `stubScrollTo/` beside
   `stubScrollMetrics/`. README's tree in the same places. Both files tracked,
   on 141's precedent.

7. **The glossary checked against what shipped.** **FAB**, **Back-to-top** and
   **Scroll threshold**, and the three relationship lines, were read against
   the code for this filing and hold — left as written. A _Flagged
   ambiguities_ entry for the round on 164's shape, recording that the face's
   styled export is `Circle` where log 19's contract sketch wrote `Root`
   (kept, for the faces' convention), and that the build declared `label`
   ahead of `icon` and the refactor put the prototype's order back — so the
   next reader of the sketch knows which of its two differences from the code
   is a decision and which was a slip.

8. **The journal's paragraph, COMPONENT-SPEC's row and the feature tick.** The
   round's entry — what each group changed, the test count before and after,
   what was deliberately left (the decision document below, in prose). COMPONENT-
   SPEC's `mol.Fab` row gains its _what shipped_ note on the `mol.Snackbar`
   precedent: `absolute` over `MainLayout.Root`'s `position: relative` rather
   than the prose's _fixed_, the same box inside a `100vh` root; `label`
   required, not defaulted; the layout, not the page, mounting it, through
   `components/BackToTop/`, which owns the threshold (`scrollTop > 420`,
   strictly, read on every scroll and once on attach) and the press; mount and
   unmount, no transition; the home only — and the `page.LibraryPage` row's
   composition gains "`MainLayout` mounts `BackToTop` over the body". And the
   tick: **Back-to-top FAB** ✅ in README and CLAUDE.md's feature lists and in
   COMPONENT-SPEC's row, per the project's rule that a feature is Done only
   after its refactor. The build-order chain in both files loses step 2, and
   the remaining three keep their numbers and their gates; the Electron
   desktop shell is now "next". Closes this issue; 165 closed by comment
   alongside — by bare number, never a closing keyword. 168 was already closed
   as folded in when this plan was filed. _(The closure is done at closing
   time, not as a commit.)_

## Decision Document

- **The prop interface is the `data-props`, in the `data-props` order.** Log
  18 Q23 made the first half the rule and log 19 Q6 the second; the
  `mol.Snackbar` row already documents it as the convention for a molecule.
  `Fab` follows it. The one deviation on `label` — required, not defaulted —
  is kept, for `IconButton`'s reason: a default right for one icon and wrong
  for the other is not a default, and an icon-only button without a name
  announces as "button".
- **A stub that jsdom lacks belongs in `test-support/` once two suites write
  it, and it leaves the DOM as it found it.** Every unit at the rung exists
  for something jsdom has not got — layout metrics, fullscreen, media
  elements, object URLs, a semantic-less node — and every one restores or
  deletes on cleanup and says so. `scrollTo` on an element is the same kind of
  absence, two suites now need it, and the per-test assignment they copied
  outlives the test on the document. The helper installs on the prototype for
  a block and deletes after, on `stubFullscreen`'s shape, and records requests
  by element so a leaf can say "one request, and it was the container's"
  rather than stub three elements to prove two were left alone. `window`'s
  `scrollTo` is out of its scope: jsdom has one, and spying what exists is
  what `vi.spyOn` is for.
- **The two-line wheel helper is not extracted.** `scrollTo(element, top)` —
  set `scrollTop`, fire `scroll` — appears in `App.test`, `MainLayout.test`
  and now `BackToTop.test`. It is not a stub for something jsdom lacks; it is
  the two things a wheel does, and a name at the call site under its own
  one-line comment reads better than an import. Considered and left, as the
  search refactor left the first two copies.
- **`BackToTop`'s ref beside its state stays.** The control mirrors `past` in
  a ref and compares against the ref before writing state — the prototype's
  `if (show !== this.state.showFab)` made explicit. Dropping the ref and
  leaning on `useState`'s same-value bail-out would rest a leaf that counts
  commits on a React optimisation the test cannot see and React does not
  promise in every case. Kept.
- **`Circle` keeps its name.** The log's contract sketch wrote `Root`; the five
  other `styled(IconButton)` faces are named for what they are, and a styles
  file uses `Root` for the outermost of several parts. The glossary never
  named the export, so nothing is corrected — it is recorded.
- **The mount suite's fresh history entry stays.** `MemoryRouter` keys its
  first entry `default` on every render and `useRestoredScroll` remembers by
  key for as long as the module lives; rendering the home as the second entry
  is the way to a body at its top that needs nothing from the hook. A reset
  affordance on the hook would be the hook carrying something for its tests.
- **The `Fab` test's hover reader stays local.** `hoverDeclarations()` reads
  the injected stylesheet because jsdom has no `:hover`; it is the only suite
  in the app that does. One reader is not a shared unit; if a second face ever
  proves its lift the same way, it graduates then.
- **`BackToTop` imports `Fab` by relative path**, as `FilterDropdown` and
  `SubtitleRow` import `MenuItem` — a molecule composing a sibling reaches it
  directly rather than through the barrel it is itself exported from. Checked;
  holds.
- **The four literals stay literal.** 28px is no spacing token; `#1a1109` is
  ink on the accent fill, which `Button.styles`, `Toggle.styles` and
  `SettingsHeader.styles` each write the same way, and no `--color-*` fits it;
  `tokens.css` declares no shadow token; the prototype writes 60. Inventing a
  token to share four literals is not translating (log 19 Q9). Left.
- **`hooks/`'s line in the folder map is corrected in the docs commit.** It is
  not this initiative's debt, but the commit that writes "the same ref
  `useRestoredScroll` attached" into the line above it cannot leave a line
  naming two hooks that do not exist directly beneath. One parenthetical, in a
  file the commit already edits.
- **No behaviour changes anywhere.** Group 1 reorders a type; Group 2 changes
  how two suites stub one method; Group 3 changes documents. If something
  looks or answers differently, that is a bug in the refactor.

## Testing Decisions

- A good test here asserts what the family can see or what a screen reader is
  told: a circle named _Back to top_ in the corner past 420 and not at 420, gone
  again under the line, already there on a return, and a press that asks the
  body — not the document — for the top. Nothing asserts a private function,
  a listener's handle or a ref's contents; the one leaf that counts commits
  does so through `Profiler`, which is React's own public reading.
- Baseline at filing: **4742 tests across 246 files**, `node_modules/.bin/tsc
-b tsconfig.json` clean, `node_modules/.bin/eslint src server` clean
  (verified for this plan). Expected after: **247 files**, and a leaf count of
  4742 plus whatever `stubScrollTo`'s own file holds. No existing leaf is
  renamed, added or removed; commit 4 changes how two suites stub one method
  and nothing they assert about the press.
- Group 2's new unit gets a test on `stubFullscreen.test.ts`'s shape — a
  double proven by installing it, driving the DOM and asking what it recorded,
  and by checking the prototype is clean once the block is over. The two press
  leaves are the regression check: each reads what the control asked for after
  the helper installs, so a helper that recorded the wrong element or the wrong
  options fails both.
- Group 1 has the compiler as its test: the `@ts-expect-error` guard in
  `Fab.test.tsx` must still have an error to swallow after the reorder, and
  `tsc -b` says whether it does.
- Group 3 has no test; it is read.
- The check for the whole round is the one the last seven rounds used: the
  verbose reporter's leaf names before and after, diffed — none gone, none
  changed, the helper's own added.

## Out of Scope

- **A FAB on any screen but the home**, a `GenreLayout` mount, an opt-out prop,
  a threshold prop, a `useBackToTop` hook. Every one ruled out by log 19 and
  left ruled out; the 214-card shelf wanting one is a grill and a prototype
  amendment first.
- **Focus after the press, `prefers-reduced-motion`, a transition on hover or
  on mount, a fix for the corner shared with the Snackbar stack.** Q19–Q21 and
  log 18 Q14; the reduced-motion pass belongs to `GlobalStyle` and every motion
  at once, now eight of them.
- **A token for the accent ink or the accent shadow.** Four literals of one
  colour are the prototype's, and `tokens.css` is the token set.
- **The carousel suite's `scrollBy` stub.** The same shape as item 2, one
  suite, horizontal; it joins the new unit if a second suite ever needs it.
- **The wheel helper** in three suites — two lines, not a stub.
- **The Electron desktop shell**, step 3. This round's last commit makes it
  "next"; it does not start it.
- **Any change to the prototype.** The `.dc.html` files are translated as
  written, and COMPONENT-SPEC's note records what shipped rather than amending
  what was drawn.

## Further Notes

- **Order of the groups.** The journal's build entry is written first so the
  entry describes the tree the build left — `label` first, the stub twice —
  and this round's paragraph, last, describes what moved. The same split rounds
  15, 16 and 18 used.
- **The plan's own precedent, fifth time.** Folding the docs issue into the
  refactor is now 140→141, 148→149, 156→157, 163→164 and 168→169. Round 18's
  note said that a fifth would be the signal for `prd-to-issues` to stop filing
  the docs slice as its own issue and fold it at planning time. This is the
  fifth. The skill amendment is a process change with its own small issue, not
  a commit in this round; it should be filed before the Electron shell's PRD is
  broken into issues, so the shell is the first initiative planned under the
  amended rule.
- **What the round does not re-derive.** Q5's `IconButton`, Q8's `absolute`,
  Q9's four literals, Q10's no transition, Q11's stateless molecule, Q13's
  component over a hook, Q14's two files, Q15's strict 420, Q16's read on
  attach, Q17's container-only press, Q18's mount/unmount, Q22's no opt-out —
  every one was checked against the code for this filing and holds. The
  decision document names them so the next round can read that they were
  checked rather than check them again.
