# Refactor plan: Motion & interaction states — one press every extension inherits, one cascade reader, and the docs that close the initiative

> Source initiative: [`motion`, issue #180](https://github.com/carlos-rezai/FamilyFlix/issues/180)
> Shipped by issues 181–185. Design log: `docs/design-logs/21-motion-interaction-states.md`.
> Filed as issue 187. The docs-and-checks slice filed as 186 is folded in here
> as Group 0 and Group 3, on the precedent of 176 into 177, 168 into 169, 163
> into 164, 156 into 157, 148 into 149 and 140 into 141, and was closed at
> filing so the initiative has one closing issue rather than two. The feature table ticks ✅
> when this one closes.

## Problem Statement

`motion` is step 4 of the build order. It is the first initiative that changed
how existing surfaces _feel_ rather than what they do, and it went ahead of
Series so that `SeasonCard` and `EpisodeRow` could be built on the contract
from the start rather than fitted to it later. The maintainer's standing
instruction set the scope — _translate the prototype 1:1 into the codebase, in
its naming, conventions, patterns and architecture_ — and COMPONENT-SPEC §2a
put that in one sentence: _do not invent per-component variations_.

What shipped is what the log settled. `tokens/motion.ts` spells the four motion
values and nothing else spells them. `utils/accentScale/` derives the accent's
five derivatives, and `createTheme(accent)` spreads them over `colors`, so
`colors.ts` spells one accent. `GlobalStyle` carries the one reduced-motion
block. `styles/interactionStates/` holds three fragments: `controlStates(press)`
for the colour vocabulary, and `cardLift` and `cardFocus` for the elevation
vocabulary. `Button`, `Chip`, `IconButton` and the Filter dropdown compose the
first, and `PosterCard` and `ContinueCard` compose the other two. A structural
guard over `shippingSources` means that no file but the tokens spells a
duration or the curve, and no file but the fragment spells a press. The six
surfaces outside the revision (`Toggle`, `TextField`, `Textarea`, the menus, the
Modal's ✕, the Snackbar, the Back pill, `SettingsHeader`) have zero changed
lines since `ef1dc27`. That was checked for this filing, not assumed.

Every log-21 ruling was checked against the code and holds. Q1–Q3 scope, Q4
the tokens, Q5 no press token, Q6–Q8 the scale and the factory, Q9 reduced
motion, Q10 `ffSpin` kept, Q11–Q12 the fragments, Q13 each surface as drawn, Q14
the files over §2a's prose, Q15 the extensions, Q17 nothing else. There is one
exception, Q16, and it is item 3 below.

4920 tests pass across 255 files, and `tsc -b` and `eslint src server` are
clean.

What is left is the usual kind of cleanup: one value written five times, one
guard spelled two ways, one test double that four suites wrote before it
existed, and one deviation from the plan that nobody has recorded.

### 1. The IconButton press is spelled five times

Log 21 Q15 is explicit: _press, focus ring and transition are the primitive's
and every extension inherits them_. What shipped is that `IconButton` writes
`scale(.94)`, and then `Fab`, `MoreButton`, `CircleToggle` and
`ChromeIconButton` each write `&:active:enabled { transform: scale(0.94) }`
again. They have to, because of the cascade. An extension's
`&:hover:enabled` has the same specificity as the primitive's press and comes
later in the stylesheet. So a hover that writes `transform` (even `none`) keeps
holding through the press unless the extension restates the press.
`IconButton`'s docblock rule 3 explains the trap at length. A rule that every
future extension has to remember is a per-component variation in all but name,
and Series is about to add more `styled(IconButton)`s.

Two extensions have a press of their own, and those are the only ones that
should need to write one. The poster heart presses at `scale(.92)`. The
carousel `Arrow` composes the press onto its centring:
`translateY(-50%) scale(.94)`.

### 2. The disabled guard is spelled two ways

Q13 moved `Button` from `:enabled` to `:not(:disabled)` because an anchor never
matches `:enabled`. `controlStates` uses the new spelling everywhere. Yet
`IconButton`'s two faces, all six extensions and both of their own presses
still write `:enabled`, and docblock rule 1 tells the next extension to do the
same. An `IconButton` is always a `<button>`, so neither spelling is wrong
today, and the two have equal specificity. It is still two spellings of one
rule in one vocabulary, one of which exists only because it was written first.

### 3. Four suites read stylesheets with their own copy, beside the double that replaced them

The PRD's testing decision said _the six surfaces' suites gain nothing they
cannot observe_ and ruled out `toHaveStyleRule`. The build did not follow it.
Starting with #182, every surface suite asserts its hover, press and focus
rules, about 700 lines of them. At #184 the build added
`test-support/resolvedStyle/`, which runs the cascade by hand for a named state
(`!important`, then specificity, then order) and has a suite of its own. The
first three slices had already written their own readers before it existed:

- `interactionStates.test.tsx`: `squash`, `renderedRules`, `declarations`,
  `restingBody`
- `Button.test.tsx`: `rulesOf`, `state`, `norm`, `squash`
- `Chip.test.tsx`: the same four, copied
- `FilterDropdown.test.tsx`: `parse`, `rulesOf`, `rulesFor`, `state`, `norm`

Each one collects every declaration written under a matching selector. None of
them can say which declaration _wins_, and winning is exactly what item 1 and
Q15 are about. The later suites ask `resolvedStyle` and get the winner. This is
the shape #164, #169 and #177 have already resolved three times: when suites
hand-roll the same double, they read the shared one.

There are two reasons the earlier suites could not simply be moved over, and
both are real gaps in the double:

- **`resolvedStyle` treats `:focus` as `:focus-visible`.** A click focuses
  without making `:focus-visible` match, and the double has no way to express
  that. `interactionStates`' leaf _draws no ring for a click_ is the one
  assertion that needs the difference. A double that cannot represent the case
  under test is misleading.
- **It rejects every selector with a combinator.** The Filter dropdown's option
  rows get their transition through `${Item}` inside `Root`, which is a
  descendant selector. The double returns "does not apply" for it, and that
  answer is false.

`GlobalStyle.test.tsx` is a fifth reader and is different in kind. Its subject
is an `@media` block, and a global's rules never reach jsdom's document in this
build of styled-components. It keeps its `ServerStyleSheet` read.

### 4. Nobody has recorded the deviation

Nothing in the log, the PRD, the journal or the glossary records that the
surfaces' suites came to hold rule assertions after all, or why that turned out
to be right. The rejection in the log was aimed at a _dependency_ that checks
CSS says what the CSS file says. What the build wrote checks the cascade:
whether a hover out-ranks a press, and whether an extension's transform
survives the primitive's. No other test could catch the trap in item 1, and
this refactor relies on those assertions to make the change safely.

### 5. The documents that close the initiative (issue 186, folded in here)

- COMPONENT-SPEC §2a's table still says buttons get _no lift_ and that
  _buttons never lift_. Q14 ported `prim.Chip`'s 1px rise and
  `prim.IconButton`'s 1.06 swell, and deferred correcting the table to this
  round.
- `ffSpin` is a known gap between the prototype and the code. The revision
  dropped it from `tokens.css`, and `PlayerNotice`'s spinner still turns on it.
  Log 21 Q10 already records it. The log is an immutable snapshot, so this
  round records the gap in the glossary and the journal, where the player's
  next revision will find it, and does not edit the log.
- The glossary's _Motion & interaction states_ rows have not been checked
  against the shipped code, and after Group 1 its **Press** row and its
  extension relationship line would be out of date.
- CLAUDE.md's folder map and README's tree name none of the following:
  `tokens/motion.ts`, `createTheme`, `utils/accentScale/`,
  `styles/interactionStates/` or `test-support/resolvedStyle/`.
- The journal has no entry for the initiative. The feature row still reads
  `🔜 step 4 — next` in both files, which is correct, because a feature is Done
  only after its refactor.

## Solution

Four groups, each leaving a working tree after every commit.

1. **The build's record.** This comes first, so the journal describes what
   shipped before this round changes it.
2. **Shipping code.** One press that every extension inherits, and one
   spelling of the guard. The surface suites already assert what these
   changes must preserve, so they are the proof.
3. **Tests.** The double learns the two cases it currently gets wrong, and then
   the four hand-rolled readers are removed one suite at a time.
4. **Documents.** They come last, because the map and the glossary have to
   describe the tree the earlier groups leave behind.

Fourteen commits in all. Nothing the family or the maintainer can see changes:
every surface resolves to the same hover, press and ring it does today.

## Commits

### Group 0 — the record of what was built

1. **The journal's motion entry.** `docs/dev-journal.md` gets the initiative's
   entry, dated by the last build commit (2026-09-23). It covers:
   - What shipped across 181–185, slice by slice: the tokens, scale, factory
     and reduced motion; the control fragment and its guard on `Button`; `Chip`
     and the Filter dropdown; `IconButton` and its five extensions; the card
     fragments on both cards.
   - That the prototype was amended during the grill session, so `tokens.css`
     carries the derived hover, press and ring (Q8).
   - That `Button`'s link face gained a hover it had lacked since it shipped.
   - That the Fab's lift now eases instead of snapping, as Q15 ruled against
     log 19.
   - That `ffSpin` was kept (Q10).
   - The judgment calls the subagents made on their own: `resolvedStyle` at
     #184, against the PRD's testing decision; the four extensions restating a
     press they should have inherited; and the option rows' transition
     reaching them through the dropdown's slot rather than through `Menu`'s
     `Item`, because the ⋯ menu is outside the contract.
   - What was deliberately not built, per Q17.
   - The test count: 4920 across 255.
   - The follow-ups, listed by bare number.

### Group 1 — one press, one guard

2. **The Control's press out-ranks any hover.** In `controlStates`, the press
   rule is written at doubled specificity (`&&:active:not(:disabled)`), and its
   docblock says why: a press is always also a hover, and it has to win against
   a hover that writes `transform`, including an extension's. The same commit
   moves the two extensions whose press genuinely differs up to the same rank:
   the poster heart's `scale(.92)` and the carousel `Arrow`'s
   `translateY(-50%) scale(.94)`. Without that move they would lose to the
   primitive. No test changes. Every surface suite already resolves the press
   it expects, and each one stays green.

3. **The four extensions inherit the press.** `Fab`, `MoreButton`,
   `CircleToggle` and `ChromeIconButton` drop their own
   `transform: scale(0.94)` press. Their suites' press leaves are unchanged and
   stay green, which shows the press now comes from the primitive. Their
   docblocks stop citing "rule 3". `IconButton`'s docblock rule 3 is rewritten
   to say: the press is the primitive's and cannot be out-ranked by a hover; an
   extension whose press differs (the heart), or that positions with
   `transform` (the Arrow, which also restates it on hover), writes its press
   at the same doubled rank.

4. **One spelling of the guard.** `IconButton`'s two faces, the six extensions'
   hovers and the two remaining presses move from `:enabled` to
   `:not(:disabled)`, the spelling `controlStates` and `Button` already use.
   Docblock rule 1 says the same. The specificity is equal, so no winner moves,
   and no test changes.

### Group 2 — one cascade reader

5. **`resolvedStyle` tells a click from a keyboard.** `StyleState` gains
   `focus`, meaning an element focused by a click: `:focus` matches and
   `:focus-visible` does not. `focusVisible` still implies `:focus`, the way a
   browser works, so no current caller changes. The suite gains leaves for both
   directions: a `:focus` rule applies under either state, and a
   `:focus-visible` rule applies only under keyboard focus.

6. **`resolvedStyle` reads a combinator whose ancestors carry no state.** A
   selector with combinators applies when:
   - its last compound matches the element in the named state, and
   - the part before it matches the element's ancestors or siblings, checked
     with the DOM's own `matches`.

   The specificity is the sum of the two parts. A state pseudo-class on an
   ancestor (`.row:hover .overlay`) is still not modelled and still returns
   "does not apply", and the docblock says so. Series' `EpisodeRow` overlay is
   where that case will first be needed. The suite gains leaves for three
   cases: a descendant rule that applies, one whose ancestor is absent, and one
   whose ancestor carries a state.

7. **`interactionStates`' suite reads the double.** The fragment tests render
   their `Probe` into the document and ask `resolvedStyle` in the named state.
   `squash`, `renderedRules`, `declarations` and `restingBody` are removed.
   _Draws no ring for a click_ becomes `{ focus: true }` resolving no ring. The
   three structural-guard blocks are untouched, and no leaf's name or meaning
   changes.

8. **`Button`'s suite reads the double.** `rulesOf`, `state`, `norm` and
   `squash` are removed. Each variant × size case renders the button (and the
   link face under its `MemoryRouter`) and resolves hover, press and keyboard
   focus. Each assertion gets stronger: it moves from "declared under that
   selector" to "wins in that state". Leaf names are unchanged.

9. **`Chip`'s suite reads the double.** Same change. The selected-chip leaf now
   proves that the accent-soft fill survives a hover by resolving it, instead
   of noticing that no `surface2` was written.

10. **The Filter dropdown's suite reads the double.** `parse`, `rulesOf`,
    `rulesFor`, `state` and `norm` are removed. The triggers resolve as the
    other surfaces do, and the option rows' transition resolves through the
    descendant selector added in commit 6. `GlobalStyle.test.tsx` keeps its
    `ServerStyleSheet` read. A sentence is added to its docblock saying why:
    it is the one suite whose subject is an at-rule on a global, which the
    double deliberately does not read.

### Group 3 — the documents that close the initiative

11. **COMPONENT-SPEC §2a says what shipped.** The table's first row is renamed
    from "Buttons" to "Controls". Its hover column becomes: fill (and border)
    shift, no shadow; `Chip` rises 1px and `IconButton` swells to 1.06, the
    files' own. The sentence "Buttons never lift" becomes "a Control never
    takes a shadow or the accent edge; a Card never recolours its fill". Those
    are the two things that actually keep the vocabularies separate. The heart's
    `.92` already falls inside the table's `.92–.94`. Nothing else in the
    handoff changes.

12. **The glossary checked against what shipped.** The motion section's ten
    rows and three relationship lines are read one by one against the code.
    - **Press** and the extension line are updated for Group 1. An extension
      inherits the press; one whose press differs, or that positions with
      `transform`, writes its own at the primitive's rank.
    - The existing _"Buttons never lift" against two files that do_ entry in
      _Flagged ambiguities_ is changed to past tense: §2a was corrected here.
    - The list gains the round's entries:
      - `resolvedStyle` against the PRD's _nothing they cannot observe_, and
        why the cascade was worth asserting (item 4).
      - `ffSpin`, dropped by the prototype and kept by the code, for the
        player's next revision (Q10).
      - The Fab's lift easing where log 19 said it snaps.

13. **CLAUDE.md's folder map and README's tree.**
    - `tokens/` gains `motion.ts`.
    - `styles/` names `theme.ts` as the factory, `createTheme(accent)` with the
      **Accent scale** spread over `colors`, and gains `interactionStates/`
      (`controlStates(press)`, `cardLift`, `cardFocus`, and the structural
      guard in its test).
    - `utils/` gains `accentScale/`.
    - `test-support/` gains `resolvedStyle/`: the cascade by hand for a named
      state, with `normCss` beside it.

    README's tree gets the same four changes.

14. **The journal's paragraph and the tick.** The round's own journal entry:
    what each group changed, the test count before and after, and what was
    deliberately left out, in the shape the decision document below gives.
    Then the tick:
    - **Motion & interaction states** ✅ in README's and CLAUDE.md's feature
      lists.
    - The build-order chain in both files loses step 4 ("steps 1–4 … are
      done"). The remaining five keep their numbers and their gates.
    - **Series (TV)** becomes "next".

    This commit closes this issue. 180 is closed by a comment at the same time,
    by bare number and never with a closing keyword. 186 was already closed as
    folded in when this plan was filed. _(The closure happens at closing time,
    not as a commit.)_

## Decision Document

- **The press belongs to the primitive, and the cascade has to say so.** Q15
  ruled that extensions inherit the press. The build made them restate it,
  because an extension's hover out-ranked it. The fix goes where the rule
  lives: the fragment's press is written at doubled specificity (`&&`,
  styled-components' own idiom for it). No extension can out-rank it by
  accident, and one that means to (the heart, the Arrow) does so explicitly at
  the same rank. The press is spelled once for all four extensions that share
  it.
- **The whole fragment gets the doubled press, not only `IconButton`.** This
  keeps the vocabulary to one rule. `Button`'s variants press only
  `background` and `Chip`'s hover `transform` already loses to its press, so
  neither changes what it resolves to. A per-primitive rank would be the
  per-component variation §2a forbids.
- **One guard spelling: `:not(:disabled)`.** It is what the contract's own
  fragment writes, and the only spelling that holds for an anchor. `:enabled`
  was only ever the first spelling.
- **The cascade is worth asserting. Hand-rolled readers of it are not.** The
  PRD ruled out a dependency that checks CSS against itself. `resolvedStyle`
  checks which rule wins, which is the property Q15's trap and this round's
  Group 1 depend on. It stays, and every surface suite reads it. The one
  exception is `GlobalStyle`, whose subject the double deliberately does not
  model.
- **A test double is extended when it gets a case wrong, and only as far as
  that case.** A click's focus and a stateless ancestor are cases the current
  suites need. A state on an ancestor is not needed yet. Series' `EpisodeRow`
  will need it and will extend the double then.
- **The files over §2a's prose, and §2a corrected to the files.** This is Q14,
  carried out. The spec's table is the summary, and it is brought into line
  with the components it summarises.
- **Design logs are not edited.** Issue 186 asked for `ffSpin` to be recorded
  in log 21. Q10 already records it, and the log is an immutable snapshot. The
  glossary and the journal are the living records, and the gap goes there.
- **Nothing the maintainer or the family can see changes.** Every surface
  resolves to the same hover, press and ring before and after. If something
  resolves differently after this round, that is a bug in the round.

## Testing Decisions

- **A good test here asserts what a surface resolves to in a state, not what
  its stylesheet happens to contain.** jsdom enters no `:hover`, `:active` or
  `:focus-visible`, so the state is named and the cascade is run by
  `resolvedStyle`. The question is always which value wins, never whether a
  value was written. The four hand-rolled readers could only answer the
  second question. The migration keeps every leaf and makes each one stricter.
- **Group 1 changes no test.** The surface suites already resolve the press
  and hover each extension must keep. They are the proof that the doubled
  press and the removed restatements change nothing. A red leaf in Group 1
  means the refactor is wrong, not the test.
- **The double's two new cases get their own leaves, written before any suite
  relies on them.** Prior art: `shippingSources`' suite over a sandbox (#177),
  and `resolvedStyle`'s own suite, which builds its stylesheet by hand so the
  cascade under test is the one written there.
- **The structural guard is untouched.** Its three blocks keep their
  patterns. Group 1 adds no duration, curve or press literal, so the guard has
  nothing new to catch.
- **Prior art.** `stubScrollTo` (#169), `snackbarStack` (#164) and
  `shippingSources` (#177) are the precedent for moving suites onto a shared
  double once it exists. The extension suites of #184 are the precedent for
  asserting a press through `resolvedStyle`.
- **The round is finished when `node_modules/.bin/vitest run`,
  `node_modules/.bin/tsc -b tsconfig.json` and
  `node_modules/.bin/eslint src server` are all clean.** The test count should
  move only by the double's new leaves.

## Out of Scope

- **States on the surfaces the revision did not touch.** `Toggle`,
  `TextField`, `Textarea` focus; `Menu` items, `SubtitleRow`, `ActionRow`,
  _View all_, the Modal's ✕, `Snackbar`, the Back pill, `SettingsHeader`. They
  were verified unchanged since `ef1dc27`, and they stay that way (Q2, Q17).
- **Removing `ffSpin`.** It is recorded, not removed. The player's next
  revision owns it.
- **Tokenising the literals outside the contract.** `Toggle`'s `.18s ease`,
  `ProgressBar`'s `.2s ease`, `ffPop .14s ease` and the player chrome's fade
  stay as they are (Q3).
- **A press token, an accent picker, `jest-styled-components`.** These were
  ruled out at grill time and are not reopened.
- **`accentScale` accepting anything but a six-digit hex.** Its only caller is
  `colors.accent`. A picker would widen it when a picker exists.
- **Trimming the surface suites' fragment assertions.** Each extension suite
  checks the ring and the press on itself. That is not duplication of the
  fragment's suite: it proves that no rule of the extension's own out-ranks
  them, which is the cascade question this round cares about.
- **A state on an ancestor in `resolvedStyle`.** This is `EpisodeRow`'s case,
  for Series.
- **`SeasonCard` and `EpisodeRow`.** These are step 5, built on `cardLift` and
  `cardFocus` as they stand.

## Further Notes

- **What the next initiative inherits.** After this round:
  - one press that every `IconButton` extension inherits without writing it
  - one guard spelling
  - one cascade reader that handles a click's focus and a plain descendant
  - a §2a that matches the files

  Series is the first real test of this. It adds two cards that should
  compose `cardLift` and `cardFocus` and add nothing else, and an episode
  row whose hover overlay is the first ancestor-state selector the double
  will need to learn.

- **Why the extensions restated the press in the first place.** Each slice of
  #184 was given one extension and a failing press leaf, and restating the
  press was the smallest change that made the leaf pass. The fact that five
  slices had written the same line, and that one rank change in the fragment
  would remove four of them, is only visible when looking at the initiative as
  a whole.
