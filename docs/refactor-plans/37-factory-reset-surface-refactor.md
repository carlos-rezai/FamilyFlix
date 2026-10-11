# Refactor plan: Factory reset — the surface's tidies, the docs that describe it, and the ticks that close the initiative

> Source initiative: [`factory-reset`, issue #297](https://github.com/carlos-rezai/FamilyFlix/issues/297)
> Shipped by issue 299 (`1b807f0` prototype, `22b54ca` RED, `ccabe64` GREEN),
> after the wire (issue 298) and its refactor (issue 300).
> Design log: `docs/design-logs/37-factory-reset.md`. Plan:
> `docs/PRDs/37-factory-reset-plan.md`.
> This is the initiative's closing round: it ticks step 20 and closes 297.
> Filed as issue 301.

## Problem Statement

Issue 299 shipped the surface of **Factory reset**: the prototype revision,
`factoryReset`, `useFactoryReset`, `ResetDialog`, the Storage card's row, and
`src/test-support/stubLocation/`. The full suite is green at 7844 tests across
473 files. Every acceptance criterion holds. What the build left behind is
small:

- **Two docblocks over the line.** In the settings feature's `api`, the
  `namesAReason` docblock (widened when the reset began reading refusals
  through it) and the `FactoryResetOutcome` docblock run past 80 columns,
  where every other docblock in the file wraps.
- **One style written twice.** The Storage card's styles hold `OpenFolder` and
  `ResetButton`, two `styled(Button)` with the same one rule, `flex: 0 0 auto`:
  a button that holds its width beside text that may shrink.
- **One field documented loosely.** `useFactoryReset`'s `resetting` says
  "false before and after a refusal". It is true from a press until an answer
  that is not a reset, and a reset leaves it true while the page goes.
- **Two "two Fresh homes".** The glossary's **Leaving** entry and CLAUDE.md's
  Back navigation entry still count two **Fresh homes**. The glossary's own
  **Fresh home** entry already counts three, the reset's reload among them.
- **CLAUDE.md's tree** has no `ResetDialog/`, no `useFactoryReset/`, no
  `factoryReset` in the settings `api/` line, no reset row in the
  `StorageSection/` line, and no `stubLocation/` in `src/test-support/`. The
  Settings Hub section has no line for the reset.
- **The record.** The dev journal has no entry for the build. Step 20, the
  Settings hub entry and the README's two rows are still 🔜.

## Solution

Three groups, the tree working and green after every commit:

0. **The record.** The build's journal entry, written before anything moves.
1. **The code.** The docblocks wrapped, the one held-width button, the hook's
   field said precisely. No behaviour, pixel or copy changes.
2. **The docs.** The glossary's **Leaving**, CLAUDE.md's descriptions, then the
   ticks in CLAUDE.md and the README, and the round's journal entry.

## Commits

### Group 0: the record

1. **The journal's surface build entry.** A new top entry, _Factory reset —
   the row and the dialog (issue #299)_: what shipped (the prototype revision
   and its spec entry, the wire call, the hook, the dialog, the row,
   `stubLocation` and why jsdom needed it), the build's calls (the curly
   apostrophe in _This can’t be undone._, the two page-level button counts
   raised, `namesAReason` shared), the counts at `ccabe64`, and what is left
   for this round. Docs only.

### Group 1: the code

2. **The settings api's docblocks wrapped.** `namesAReason`'s and
   `FactoryResetOutcome`'s docblocks wrapped to the file's measure. Words
   unchanged. Every leaf passes unchanged.

3. **One held-width button on the Storage card.** `OpenFolder` and
   `ResetButton` become one styled button, named for what it does rather than
   for one caller, used by _Open folder_ and _Reset…_. Its docblock names both.
   A pure rename and merge: every leaf passes unchanged.

4. **`resetting` said precisely.** `useFactoryReset`'s field docblock reads:
   true from a press until an answer that is not a reset; a reset leaves it
   true while the page goes. Comment only.

### Group 2: the docs

5. **The glossary's Leaving counts three Fresh homes.** "the two **Fresh
   homes**" becomes "the three **Fresh homes**". The dialogue quoted from an
   earlier session stays as it was said.

6. **CLAUDE.md describes the surface.** The settings feature's tree gains
   `ResetDialog/` and `useFactoryReset/`; the `StorageSection/` line gains the
   reset row; the settings `api/` line gains `factoryReset`;
   `src/test-support/` gains `stubLocation/`. The Settings Hub section gains
   one bullet for the Factory reset row and `POST /api/reset`. The Back
   navigation entry counts three **Fresh homes**, the reset's reload the third.
   No ticks yet. Docs only.

7. **CLAUDE.md ticks step 20.** Step 20 and the Settings hub entry become ✅;
   the build-order line reads steps 16–20 done, 21–23 planned. Docs only.

8. **The README ticks step 20.** The status row and the build-order step
   become ✅. Docs only.

9. **The round's journal entry.** _Factory reset — the surface's refactor_:
   what each group changed, the counts, and that the initiative is closed.
   Docs only. Closes this issue, then 297.

## Decision Document

- **No behaviour, copy, pixel, wire or prototype changes.** Every commit in
  Group 1 leaves every leaf passing unchanged.
- **One style, one name.** A `styled(Button)` with one rule shared by two
  buttons on the same card is one style, named for the rule.
- **The glossary's dialogue is a quotation.** It records what was said when
  there were two Fresh homes, and stays.
- **Ticks last.** Step 20 is ticked only after every other commit has landed,
  per the rule that a feature is Done after its refactor.

## Testing Decisions

- A good test checks what the maintainer sees and what the wire carries, not
  how a style is named. No leaf is added or changed: the merge and the
  comments are invisible to every suite.
- Every code commit runs the settings suites, `tsc -b --force`, ESLint and
  Prettier. The full suite runs before the docs group.

## Out of Scope

- **The `held()` request double** written in several settings suites. It
  predates this initiative; a shared double is its own question.
- **Folding the dialog's two lists into one table.** Two lists read plainly
  as they are.
- **A tone for `Modal`'s icon tile.** The reviewed prototype draws the accent
  tile; a danger tone would be a prototype change first.
- Steps 21–23.
