# Refactor plan: Snackbar system — the stack found by its geometry, a rationale the code never carried, two comments that still schedule, and the docs that close the initiative

> Source initiative: [`snackbar`, issue #158](https://github.com/carlos-rezai/FamilyFlix/issues/158)
> Shipped by issues 159–162. Design log: `docs/design-logs/18-snackbar.md`.
> Filed as issue 164. The docs-and-glossary slice filed as 163 is folded in here
> as Group 0 and Group 3, on the precedent of 156 into 157, 148 into 149 and 140
> into 141, and was closed at filing so the initiative has one closing issue
> rather than two; the feature table ticks ✅ when this one closes.

## Problem Statement

`snackbar` is the third initiative driven end to end by `issue-loop`, and the
first in FamilyFlix that ships with no caller — by design, not by accident: log
18 Q2–Q4 ruled that a component specified to the word by a named consumer (the
**Update offer snackbar**, log 17's copy table) is not a speculative one, that
none of the six screens which refused a snackbar on their own merits would be
reopened to give it work, and that its own tests are the whole proof until the
**Software update** flow lands three initiatives from now. The maintainer's one
instruction was the scope the grill ran under: _translate the prototype 1:1
into the codebase, in its naming, conventions, patterns and architecture_.

What shipped is that. The **Snackbar** molecule is `mol.Snackbar.dc.html` cell
for cell — the 360px card on `surface2` under the prototype's literal shadow,
the 4px accent bar, the glyph seated 1px down, the 15/600 title over the
14px dim message, the bordered action written in the variant's colour, the
28px ✕ pulled into the padding, `ffSnackIn` on entry — read against the
prototype for this filing with the two deviations the log rules: `error` reads
`danger` because the prototype's own map does, and the flat `role="status"` is
amended to `status` for `info`/`success` and `alert` for `warning`/`error`.
The **Snackbar stack** is the container's host at `position: fixed` (Q20),
`column-reverse` so an array appended to puts the newest nearest the corner,
`pointer-events: none` with each card's wrapper taking them back, always
mounted, no portal, no cap, no dedupe. The one timing rule is in one place: a
notice with an `action` arms no timer and persists; every other notice dies at
5s; pressing the action takes its own notice off first and then runs. `notify`
and `dismiss` never change identity. The hook throws outside the provider,
naming itself. The four glyphs are atoms in `currentColor`, named for what they
draw. 4699 tests pass across 241 files, `tsc -b` and `eslint src server` clean.

Rounds 15 and 16 said the debt an `issue-loop` build leaves is small, of a
kind, and made of what a subagent reading one issue cannot see. This round is
the smallest yet — nothing moves a pixel, nothing changes a wire — and it is
of the same kind, plus one thing the earlier rounds did not have: a design
rationale that the code never carried, written into the glossary as if it had.

### 1. The stack carries a `data-testid`, the only one in shipping code

`SnackbarProvider` renders its `Stack` with `data-testid="snackbar-stack"`, and
`SnackbarProvider.test.tsx` and `App.test.tsx` both read it through
`getByTestId`. Every other `data-testid` in `src/` is in a test file or in
`test-support/LocationProbe`, which exists to be read by tests. This is the
first attribute a shipping component carries for its tests' convenience and
nothing else's.

The reason it is there is real: the stack is a `<div>` with no role — Q9 puts
the roles on the cards and the provider's own test asserts the stack has none —
so when it is empty there is nothing semantic to find it by, and four leaves
need it empty (the node is present and paints nothing; its geometry; it is no
portal; App mounts it on every route). But the answer to "how do I find a node
with no semantics" already exists in this initiative's own molecule test:
`accentBar()` finds the bar as "the one thing in the card that is 4px wide —
reached by its geometry rather than a class, because the geometry is the
prototype's". The stack's geometry is the prototype's too — a fixed,
bottom-right, reversed column — and it is what makes it the stack.

### 2. A rationale written into the glossary that the code never carried

Log 18 Q19 keeps the stack mounted when empty, "because a live region that
already exists when content is inserted into it is announced far more reliably
than one that appears carrying its content". The glossary's **Snackbar stack**
row repeats it: _"Always mounted, empty or not, so a live region precedes its
content."_

The stack is not a live region. The roles — the live regions — are on the cards
(Q9, the prototype's own `role="status"`), each of which mounts carrying its
content, which is exactly the case Q19's sentence warns about. The provider's
docblock says so plainly ("carries no live region and no role of its own: the
roles are on the cards alone") and a leaf asserts it. So the always-mounted
stack is kept for a reason that is true — an empty flex column paints nothing,
and a conditional mount is a branch with nothing behind it — and described by a
reason that is not. Issue 163's rule for the glossary is that where the code
and the glossary disagree, the code wins. The gap the sentence was reaching for
is real and is recorded, not fixed: a card inserted with its content may be
announced less reliably than a persistent region would announce an insertion.
That is an accessibility pass over every live region in the app, not a
refactor's change to one.

### 3. Two comments that still schedule

`Snackbar.test.tsx`'s banner: "the thing that unmounts it is the **Snackbar
stack**, which the next slice builds". The next slice built it two commits
later. Round 15's rule is that a docblock which schedules is corrected by the
round that touches the file.

`App.tsx`'s docblock, in the file this initiative wired the provider into:
"`/movie/:id` and `/genre/:name` are the browse home's two destinations and both
real screens; `/movie/:id/play` and `/add` are placeholders." The player shipped
in round 10 and the form in round 11; `/settings` and `/import` are not named at
all. The sentence about the URLs being the stable part — each screen landing
behind the link already pointed at it — was true and is still worth keeping; the
list of which are placeholders is not. Nobody amended it because nobody opened
`App.tsx` for anything but a mount since round 9.

### 4. Two places the build diverged from the log's sketch, both to keep

The log's Q10 names the glyphs `InfoIcon`, `CheckCircleIcon`, `WarningIcon`,
`CrossCircleIcon` and rules them "named for what they draw, because a primitive
knows nothing about the domain". The build named them `InfoCircleIcon`,
`CheckCircleIcon`, `BangTriangleIcon`, `CrossCircleIcon` — which follows the
rule better than the rule's own examples: `WarningIcon` names the notice it sits
on, `BangTriangleIcon` names the picture. Q10 also says "No tests — `Icon/` is
flat and untested but for the three that earned one"; the build gave all four a
test, on the precedent of the three most recent glyphs (`DownloadIcon`,
`MicrochipIcon`, `UploadIcon`), each asserting the prototype's own path data,
the `currentColor` ink, the 24×24 frame and the decorative default. Both are
kept; the docs describe what shipped, and the decision document records why.

### 5. The docs the initiative owes

Issue 163's list, merged here. COMPONENT-SPEC's `mol.Snackbar` row still
describes the prototype's flat `role="status"` and sketches the provider/hook
split in the future tense; its Icons table has none of the four glyphs; its
`page.SettingsPage` row says the About card has "no _Software update_ — the
Snackbar system's", which is no longer the thing it waits on. CLAUDE.md's
folder map names neither `App/SnackbarProvider/` nor `App/useSnackbar/` nor
`components/Snackbar/`, its `Icon/` line names none of the four glyphs, its
Settings Hub section says the same "the Snackbar system" of the update row, and
nothing records that none of the six refusing screens was reopened. README's
tree is coarser but wrong in the same places. The glossary was written by the
grill ahead of the build and — every row of _The Snackbar system_ was read
against the code for this filing — holds, with the one exception item 2 names.
The journal has no entry for the build and none for this round.

## Solution

Four groups, each a working tree after every commit: the record of the build
first, so the journal describes what shipped before this round touches it; the
test hook second, because it is the one change to a shipping file and should be
early and visible; the two comments third; the docs last, because the folder
map has to describe the tree the earlier groups leave. Nine commits, none of
which changes what the family or the maintainer can see.

## Commits

### Group 0 — the record of what was built

1. **The journal's snackbar entry.** `docs/dev-journal.md` gets the
   initiative's entry, dated by the last build commit (2026-09-20): what
   shipped across 159–162, slice by slice — the prototype amendment
   (`checkForUpdates()`'s confirmation `4000` → `5000`, log 17's amendment 2
   inherited), the four glyphs and the molecule, the stack and the hook and
   the mount, the actionable notice; that it was the third initiative driven
   wholly by `issue-loop` and the first to ship with no caller, and why (log
   17 Q32, log 18 Q2–Q4); the judgment calls the subagents made alone that the
   log did not name — the glyph names, the four icon tests, `SnackbarApi` for
   the hook's answer where the log sketched `Snackbars`, the `data-testid`
   this round removes; what was deliberately not built (a caller in any of the
   six refusing screens, `duration`, `dismissible` on the notice, a cap, a
   dedupe, a portal, an exit animation, reduced-motion, Escape); what is known
   and deliberately not fixed (the live-region gap of item 2, the stack unseen
   under a fullscreen player per Q33); the test count (4699 across 241, from
   4603 across 234); and the follow-ups — which are this plan, by bare number.

### Group 1 — the stack found by its geometry

2. **`test-support/snackbarStack/` — the stack, reached by what the prototype
   draws.** A new test-support unit on `comesBefore`'s shape: `snackbarStack()`
   answers the one element in the document whose computed style is
   `position: fixed` and `flex-direction: column-reverse` — the container's
   host as `FamilyFlix.dc.html` draws it and Q20 rules it — and throws, naming
   itself, when there is none. Its own test file renders a fixed reversed
   column and finds it, renders none and sees the throw, and renders a fixed
   column that is not reversed and sees the throw too. No caller yet in this
   commit; the tree is green.

3. **The two suites read the helper, and the attribute goes.**
   `SnackbarProvider.test.tsx`'s `stack()` and `App.test.tsx`'s four
   `getByTestId('snackbar-stack')` become `snackbarStack()`;
   `data-testid="snackbar-stack"` is removed from `SnackbarProvider`. Every
   leaf keeps its name and its assertions — the geometry leaf still asserts
   `right`, `bottom`, `z-index`, `gap` and `align-items`, which the helper does
   not select by. One attribute gone from shipping code, no other change to it.

### Group 2 — the comments that still schedule

4. **`Snackbar.test.tsx`'s banner stops scheduling.** "which the next slice
   builds" becomes what is true: the stack is `App/SnackbarProvider/`, and
   dismissing on action is wired there. Comment only.

5. **`App.tsx`'s docblock names seven real screens.** The placeholder sentence
   goes; the routes are listed as what they are, and the paragraph about the
   URLs being the stable part — each screen landing behind the link already
   pointed at it — is kept in the past tense it has earned. The Snackbar
   sentence added in 161 stays. Comment only.

### Group 3 — the docs that close the initiative

6. **COMPONENT-SPEC says what shipped.** The `mol.Snackbar` row: the molecule's
   flat props in the prototype's order, the role by variant as an amendment of
   the prototype's flat `role="status"`, `error` reading `danger`, the card's
   own ✕ rather than `RemoveButton`, no timer and no effect in it; then the
   provider/hook split as it is — `App/SnackbarProvider/` owning the queue, the
   ids, the timers, the fixed reversed column and the dismiss-then-run action,
   `App/useSnackbar/` owning the context, the hook and `SnackbarNotice`; the
   one timing rule; no caller yet and which one is designed. The Icons table
   gains `InfoCircleIcon`, `CheckCircleIcon`, `BangTriangleIcon` and
   `CrossCircleIcon`. The `page.SettingsPage` row's "no _Software update_ — the
   Snackbar system's" becomes what the row now waits on: the Electron shell
   and the packaging.

7. **CLAUDE.md's folder map and README's tree.** `App/` gains its two units
   with a line each; `components/` gains `Snackbar/`; `Icon/`'s parenthetical
   gains the four glyphs; `test-support/` gains `snackbarStack/` and the
   `comesBefore` line it sits beside; the Settings Hub section's "_Software
   update_ (the Snackbar system)" becomes "(the Electron shell and the
   packaging)"; and a line under Settings Hub or beside the folder map records
   that the stack ships first and empty and that none of the six screens that
   refused a snackbar was reopened — the sentence the glossary's relationship
   already carries, put where the next builder reads. README's tree in the same
   places. Both files tracked, on 141's precedent.

8. **The glossary checked against what shipped.** The **Snackbar stack** row
   loses "so a live region precedes its content" and says why the node stays
   instead — invisible either way, and one branch fewer; **Snackbar**,
   **Snackbar variant**, **Snackbar notice** and **Actionable snackbar** read
   against the code for this filing and left where they hold; the three
   relationship lines the same. A _Flagged ambiguities_ entry for the round on
   157's shape — "One sentence the code never carried (resolved by the snackbar
   refactor, 164)" — naming the correction, the glyph names, and that
   `SnackbarApi` is the hook's answer where the log wrote `Snackbars`.

9. **The journal's paragraph and the feature tick.** The round's entry — what
   each group changed, the test count before and after, what was deliberately
   left (the decision document below, in prose), the live-region gap named as
   known and not fixed — and the tick: **Snackbar system** ✅ in README and
   CLAUDE.md's feature lists and in COMPONENT-SPEC's row, per the project's
   rule that a feature is Done only after its refactor. The build-order chain
   in both files loses step 1, and the remaining four keep their numbers and
   their gates; the Back-to-top FAB is now "next". Closes this issue; 158
   closed by comment alongside — by bare number, never a closing keyword. 163
   was already closed as folded in when this plan was filed. _(The closure is
   done at closing time, not as a commit.)_

## Decision Document

- **The stack's handle is its geometry, not an attribute.** A `data-testid` is
  the app carrying something for its tests, and this project's tests reach
  everything else by what a person can see or a screen reader can hear. The
  stack has no semantics on purpose, so the honest handle is what makes it the
  stack: the fixed, reversed column in the corner, which is the prototype's
  own drawing. `accentBar()` in the molecule's test is the precedent; the
  helper lives in `test-support/` because two suites read it, on
  `comesBefore`'s rule. The geometry leaf keeps asserting the properties the
  helper does not select by, so it is still a test and not a tautology.
- **The always-mounted stack stays, on the reason that holds.** Q19's ruling
  is kept — an empty flex column paints nothing, `sc-if hasSnackbars` exists
  in the prototype only because the simulation re-renders a whole app from one
  state object, and a conditional mount is a branch with nothing behind it.
  Its live-region sentence goes from the glossary because the roles are on the
  cards (Q9, the prototype), the stack carries none, and a leaf asserts that.
  No `aria-live` is added to the stack: it is a behaviour change off the
  prototype, and an `alert` card inside a polite region is a nesting screen
  readers disagree about. The reliability gap the sentence was reaching for is
  recorded in the journal as known and not fixed, for an accessibility pass
  over every live region in the app rather than this one.
- **The glyph names and their tests stay as built.** `InfoCircleIcon` and
  `BangTriangleIcon` follow Q10's rule — named for what they draw — more
  faithfully than Q10's own `InfoIcon` and `WarningIcon`, the second of which
  names the notice. The four tests follow the three most recent glyphs; Q10's
  "no tests" described the older half of `Icon/`, and leaving the four newest
  glyphs the only recent ones without a test would be the odd convention out.
- **`SnackbarApi` keeps its name.** The log's contract sketch wrote
  `Snackbars` for the hook's answer. A plural of the molecule's name reads as a
  list of cards, and `{ notify, dismiss }` is not one; the glossary never named
  the type, so nothing is corrected — it is recorded.
- **`App.tsx` stays where it is.** Q16 already ruled against `src/App/App/`,
  and the two units joining `App/` do not change that: `App.tsx` and
  `App.test.tsx` are co-located, which is what the one-folder-per-unit rule
  asks for, and `App/` is simultaneously the category they join. No barrel
  either; both units are imported by path on `api/`'s precedent.
- **The stack reads spacing tokens where the molecule writes literals.** `24px`
  and `12px` are on the scale and read `space.s5` and `space.s3`; `14px`,
  `18px`, `360px` and `28px` are not and stay literal. Fifty reads of
  `theme.space` across the styles files say both spellings are the codebase's;
  on-scale values reading the token is the more common one. Kept.
- **`variantColour` stays exported from the styles file.** The molecule's test
  reads the theme directly rather than the helper, so the export has no reader
  outside its own file; it costs nothing, and the styles file is the one place a
  variant becomes a colour. Considered and left.
- **The molecule keeps `dismissible`.** Q23's ruling holds: the prop is the
  prototype's `data-props`, and the prop interface is the `data-props`. The
  notice does not carry it and the stack never passes `false`.
- **The four icon tests and the molecule's `it.each` over variants are not
  folded.** The molecule's variant leaves each assert one thing per variant —
  the glyph, the role, the colour on three surfaces — and a fold would be one
  leaf asserting twelve. Round 15's rule was about leaves that count the same
  button twice, and none here does.
- **No behaviour changes anywhere.** Groups 1–3 remove one attribute the
  family never sees and change comments and documents. If something looks or
  answers differently, that is a bug in the refactor.

## Testing Decisions

- A good test here asserts what the family can see or what a screen reader is
  told: a card in the corner saying _Saved._, gone at five seconds and not
  before; an offer still there ten minutes later; a ✕ named _Dismiss_; a
  `status` for a confirmation and an `alert` for a refusal. Nothing asserts a
  private function, a timer's handle, or which branch of the provider ran — and
  after this round, nothing asserts an attribute the app carries for the test.
- Baseline at filing: **4699 tests across 241 files**, `node_modules/.bin/tsc -b
tsconfig.json` clean, `node_modules/.bin/eslint src server` clean (verified
  for this plan). Expected after: **242 files**, and a leaf count of 4699 plus
  whatever `snackbarStack`'s own file holds. No existing leaf is renamed,
  added or removed; commit 3 changes how two suites find one node and nothing
  they assert about it.
- Group 1's new unit gets a test on `comesBefore.test.ts`'s shape — a helper
  over the DOM, proven by rendering markup and asking. The provider's and
  App's existing leaves are the regression check: every one of them reads what
  is on screen after the helper finds the stack, so a helper that found the
  wrong node fails all of them.
- Groups 2 and 3 have no test; they are read.
- The check for the whole round is the one the last six rounds used: the
  verbose reporter's leaf names before and after, diffed — none gone, none
  changed, the helper's own added.

## Out of Scope

- **A caller.** Not in ratings, add, delete, import, export or the codec
  manager. Six logs refused one each on the prototype's evidence, and the
  prototype still draws none there. The first caller is the **Software
  update** flow, three initiatives away.
- **`aria-live` on the stack, or any change to which element is the live
  region.** Item 2 records the gap; the fix is an accessibility pass over the
  app, not this round.
- **`prefers-reduced-motion`, an exit animation, Escape-to-dismiss,
  hover-to-pause, a cap, a dedupe, coalescing, per-notice `duration`, a
  portal, a `types/snackbar.ts`, a test double for the stack.** Every one
  ruled out by log 18 and left ruled out.
- **The Back-to-top FAB.** Step 2, its own prototype file, its own log. This
  round's last commit makes it "next"; it does not start it.
- **Any change to log 17's copy table or the update flow's interface.** They
  arrive with the row and the bridge.
- **The older half of `Icon/` getting tests.** Q10's "flat and untested but
  for the three that earned one" describes twenty-odd glyphs that predate the
  convention; giving them tests is its own housekeeping round, if ever.

## Further Notes

- **Order of the groups.** The journal's build entry is written first so the
  entry describes the tree the build left — a `data-testid` and two stale
  comments included — and this round's paragraph, last, describes what moved.
  The same split rounds 15 and 16 used.
- **The plan's own precedent.** Folding the docs issue into the refactor is
  now the fourth time (140→141, 148→149, 156→157, 163→164). If a fifth
  initiative does the same, the `prd-to-issues` skill should stop filing the
  docs slice as its own issue and fold it at planning time instead.
- **What the round does not re-derive.** Q19's always-mounted stack, Q20's
  `fixed`, Q23's `dismissible` on the molecule alone, Q24's one rule with no
  knob, Q25's dismiss-then-run, Q26's no cap — every one was checked against
  the code for this filing and holds. The decision document names them so the
  next round can read that they were checked rather than check them again.
