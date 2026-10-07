# Refactor plan: Codecs page — the Codecs row at the prototype's padding, a molecule its callers place, one suite per thing it proves, and the docs that close it

> Source initiative: [`codecs-page`, issue #243](https://github.com/carlos-rezai/FamilyFlix/issues/243)
> Shipped by issues 244–246. Design log: `docs/design-logs/26-codecs-page.md`.
> Filed as issue 247. No separate docs-and-filing slice was filed this time: #246 carried the
> close's docs itself, so the remaining docs work is Group 0 and Group 4 here.
> The maintainer approved every recommendation in advance, with one standing
> instruction: _keep the codebase consistent with the same naming and code
> conventions, patterns and architecture._

## Problem Statement

`codecs-page` is the smallest renderer-only initiative since the FAB. The
**Codec report** moved off the Settings hub onto the **Codecs page** at
`/settings/codecs`. `CodecManager` now draws its own maintainer header over two
Settings groups, _Playback component_ and then _Formats_. The Playback card
opens with a **Codecs row** whose line is the **Codec summary**. The Codecs row
and the _Sync metadata & posters_ row now both draw through `NavigationRow`, as
log 26 Q14 asked. Every log-26 ruling was read against the code for this filing.
Q3 (the literal path), Q4–Q7 (page, header, Back, words), Q8 (the order), Q10
(no molecule changes), Q12–Q13 (the line, two reads) and Q11 (the row's
anatomy) all hold, except where item 1 says otherwise.

Earlier rounds found that the debt an `issue-loop` build leaves is small, all of
one kind, and made of what a subagent reading one issue can't see. This round
fits that pattern. It has one real visual defect, one test that locks the defect
in, and some leftovers from a graduation that happened two commits after the
copy it replaced.

### 1. The Codecs row isn't drawn at the prototype's padding

The amended `page.SettingsPage.dc.html` gives the Codecs row `padding: 4px 4px 0`.
It's the first thing in its card, so the card's 20px is all it needs above it.
The _Sync metadata & posters_ row gets `padding: 15px 4px 4px` because it sits
under a divider at the card's end. #245's commit body says the row was copied
"rule for rule… No difference from the Sync row was needed". That's true of
everything except the padding. The row sits 11px lower and 4px taller than the
prototype draws it.

Log 26 Q14 said the two rows would graduate into one molecule _"if the two match
character for character"_. They match everywhere except where they're placed.
#246 graduated them with the Sync row's padding baked in, so the drift is now
the molecule's default.

The prototype is the spec, and the fix follows `LoadMessage`'s precedent: the
molecule forwards `className` because _"Set by `styled(LoadMessage)`, which is
how a caller places the block"_. `NavigationRow` keeps everything the two rows
share (the inset, the tile, the text, the chevron). Each caller places it at its
own prototype's vertical padding through a `styled(NavigationRow)` extension,
the way `MovieDetail`, `SeriesDetail` and `SeasonEpisodes` place `LoadMessage`.

### 2. A test that locks the drift in

`PlaybackSection.codecsRow.test.tsx` ends with _"matches the Sync metadata &
posters row rule for rule"_. It renders both sections and asserts that every
computed property of all six parts is equal. It was written to force #246's
graduation. Now that one molecule draws both rows, the equality holds by
construction for everything but placement, and for placement the test asserts
the wrong thing. It has to go before item 1 can be fixed. Each row's own padding
gets one leaf in its own section's suite instead.

### 3. A molecule whose tests live in its callers

The Codecs row suite was written in #245 against a bespoke row. The molecule
came in #246, and nothing moved into its suite. So the molecule's own behaviour
is proven through one caller only:

- Being a real button: _pushes on Enter after Tab_ and _on Space after Tab_.
- Having a chevron at its end.

The Sync row's suite, written in #206, proves none of it. These leaves belong
in `NavigationRow.test.tsx`, which already proves name, glyph, line, blank line
and push. Each caller's suite should keep only what that caller hands the
molecule: its label, its glyph, its line's faces and its destination. That's
how `ActionRow`'s callers and `ActionRow.test.tsx` already split it.

The same suite also has _"takes only the read from useCapabilities, never a
write"_, which greps `PlaybackSection.tsx` for the names `upload`,
`installComponent` and `removeComponent`. That's an implementation detail.
Destructuring under a different name would pass it, and a write could slip past
it. The leaf beside it, _"sends nothing to the component route"_, proves the
same rule by behaviour. The structural guards elsewhere (`interactionStates`,
`shippingSources`) guard cross-cutting rules that no single behaviour can show.
This rule has a behaviour, and its leaf already exists.

### 4. Small leftovers in two shipping files

- **Docblocks over the measure.** #245 and #246 each spliced a clause into an
  existing docblock: `PlaybackSection`'s first paragraph and its last, and
  `NetworkSection`'s sync paragraph. Prettier doesn't reflow comments, so three
  lines now run well past 80 columns while every other docblock in the folder
  is wrapped.
- **`GroupCard` spells the group gap again.** `CodecManager.styles.ts` extends
  `Card`, which already sets the 32px group gap. It then writes
  `margin-bottom: 32px` again for every card but the last. `AboutCard` is the
  precedent for the last card: it states only the `0`. With `$last`, the
  extension should state only what is its own. No pixel moves.

### 5. The docs the initiative still owes

#246 closed the docs it was asked to: both trees, the Settings Hub section, the
tick, a journal entry and the glossary's Codecs row. Four things are left.

- **The glossary has no term for `NavigationRow`.** Its siblings have terms:
  `ActionRow` is **Action row**, and the Codecs row's own entry names
  `NavigationRow`. Q14 called the shape "navigation row" in lower case and the
  journal repeats it, so the term exists in prose but not in the table.
- **A stale glossary relationship.** One line still reads _"The Settings hub
  draws four Settings groups… the other three are one Section card each"_ and
  lists _Software update_ among the controls not drawn. Network made it five
  groups, and step 9 drew the update row. Both changes predate this
  initiative, but this initiative rewrote the paragraph's neighbour and left
  the line untouched.
- **COMPONENT-SPEC's page table** has `page.SettingsPage ✅` and a
  `page.CodecsPage` row with no tick.
- **The journal's build entry is a single paragraph.** It records no test
  count, none of the judgement calls above and no follow-ups. Every other
  initiative's build entry has all three.

### 6. The tick that came early

#246 ticked the Codecs page ✅ in README and CLAUDE.md, in the build order and
both feature tables, when its build issue closed. The standing rule is that a
feature is ✅ only after its refactor closes (log 26 Q17 restates it). The
recommendation is to **leave the tick standing**. Reverting it here and
re-applying it in this plan's last commit would be two commits of churn that
end where they started. What the round owes is the record: Group 0 notes it as
a deviation, and this issue closing (with #243) is what makes the tick true.

## Solution

Five groups, each leaving a working, green tree after every commit:

1. **The record.** The build's journal entry comes first, so it describes what
   shipped before this round touches anything.
2. **The two shipping tidies.** No pixel and no behaviour changes.
3. **The suites.** The leaves move to where they belong, and the leaf that
   locks the drift goes, so that Group 3 can fix the drift.
4. **The placement.** The one visible change: the Codecs row moves up 11px and
   loses 4px of height.
5. **The docs.** These come last because they describe the tree the earlier
   groups leave.

That's eleven commits. Only commit 8 changes what the maintainer sees.

## Commits

### Group 0 — the record of what was built

1. **The journal's codecs-page build entry, completed.** The existing
   2026-10-06 entry is extended in place, not duplicated. It keeps its
   paragraph and adds:
   - what shipped slice by slice across 244–246;
   - the prototype amendments riding #244's commit (already said);
   - the judgement calls the subagents made alone that the log didn't name:
     - the Codecs row given the Sync row's padding (item 1);
     - the _rule for rule_ leaf (item 2);
     - the molecule's behaviour proven through one caller (item 3);
     - the source-grep leaf (item 3);
     - the `GroupCard` margin (item 4);
     - the ✅ ticked at #246 rather than at the refactor (item 6);
   - what was deliberately not built: everything log 26 _Not built_ lists;
   - the test count and file count at the end of the build, measured at
     `301a7ae`;
   - the follow-ups, which are this plan, by bare number.

   Docs only.

### Group 1 — two shipping files tidied, nothing moved

2. **The three docblocks rewrapped.** `PlaybackSection`'s first and last
   paragraphs and `NetworkSection`'s sync paragraph are rewrapped to the
   folder's measure. No word changes. Comments only, no test.

3. **`GroupCard` states only its own margin.** The extension stops re-spelling
   `Card`'s 32px. `$last` writes the `0` and nothing else, and the docblock
   says why, quoting `AboutCard`'s reason (the last card carries no group gap).
   The two cards' computed margins don't change. `CodecManager.test.tsx` has no
   leaf on margins, so one characterization leaf lands **first in the same
   commit**: the _Playback component_ card keeps the 32px gap and the _Formats_
   card has none, read through `getComputedStyle`. It's green before the style
   edit and green after.

### Group 2 — one suite per thing it proves

4. **The molecule's suite takes the keyboard and the chevron.**
   `NavigationRow.test.tsx` gains three leaves, each green on arrival because
   the molecule already behaves this way:
   - it pushes its destination on Enter after Tab;
   - it pushes its destination on Space after Tab;
   - its last child holds the `ChevronRightIcon` at 18, compared by `innerHTML`
     the way the Codecs row suite compares its glyph today.

   Nothing else in the molecule's suite changes.

5. **The Codecs row suite keeps what `PlaybackSection` hands the molecule.**
   - Removed from `PlaybackSection.codecsRow.test.tsx`: _on Enter after Tab_
     and _on Space after Tab_ (now the molecule's); the chevron half of
     _carries the microchip glyph in its tile and a chevron at its end_, which
     is renamed _carries the microchip glyph in its tile_; and _takes only the
     read from useCapabilities, never a write_, along with its `readFileSync`
     and `withoutComments` imports, once nothing else in the file reads them.
   - Kept: _no report on Settings_; one button named Codecs; the line's four
     faces (landed, no component, pending, refused); _pushes /settings/codecs
     on a click_; the Subtitles half under the row; _sends nothing to the
     component route_; and, for now, _the Codecs row is the Sync row_, which
     goes in commit 8 with the change it forbids.
   - The suite's docblock stops calling the row "a copy of" the Sync row and
     says it is drawn through `NavigationRow`.

   No shipping change.

6. **The Sync row suite proves its own placement.**
   `NetworkSection.sync.test.tsx` gains one characterization leaf: the row sits
   at the prototype's `15px 4px 4px`, read through `getComputedStyle` on the
   button. It's green on arrival, and it's the safety net for commit 7.

### Group 3 — a molecule its callers place

7. **`NavigationRow` forwards `className`, and both callers place it.**
   - `NavigationRowProps` gains an optional `className`, last, with
     `LoadMessage`'s docblock sentence: _set by `styled(NavigationRow)`, which
     is how a caller places the row_. It goes on the button.
   - The molecule's `Row` drops its vertical padding and keeps the 4px inset
     both prototypes share (`padding: 0 4px`).
   - The component docblock says the caller places the row, citing
     `LoadMessage`.
   - `NetworkSection.styles.ts` gains `SyncRow = styled(NavigationRow)` at
     `15px 4px 4px`.
   - `PlaybackSection.styles.ts` gains `CodecsRow = styled(NavigationRow)`,
     **also at `15px 4px 4px` in this commit**, so the tree draws exactly what
     it drew before.
   - The two sections render their extension in place of the bare molecule.
     The extensions are named for the glossary's own nouns, the Codecs row and
     the sync row, the way the `LoadMessage` placements are named for their
     screens.
   - `NavigationRow.test.tsx` gains one leaf: a `className` handed in lands on
     the button.
   - The guard _"the two rows it replaced"_ narrows its pattern from
     `Row|Tile|Text|Label|Desc|Chevron` to the five inner parts. Each section
     now legitimately declares a `…Row`, which is a placement and not a copy.
     It also gains one assertion: each section's styles extend
     `styled(NavigationRow)` and declare no `styled.button`.
   - Every leaf in every suite stays green, and commit 6's padding leaf proves
     the Sync row didn't move. Without the caller's extension, the molecule has
     no vertical padding of its own.

8. **The Codecs row at the prototype's `4px 4px 0`.**
   - `CodecsRow` takes the padding `page.SettingsPage.dc.html` draws.
   - The Codecs row suite gains the matching leaf.
   - _The Codecs row is the Sync row_ is removed in the same commit, along with
     the `resolved` and `partsOf` helpers, the `NetworkSection` and
     `SnackbarProvider` imports, and the summary fixture and `/api/enrichment`
     and `/api/tmdb/key` branches in its fetch mock, once nothing else reads
     them.
   - This is the round's one visible change: the row moves up 11px and gets 4px
     shorter, matching the prototype.

### Group 4 — the docs that close the initiative

9. **The glossary.**
   - **Navigation row** (new) goes beside **Action row**: a Settings group's
     bare button row (a glyph in the accent tile, the label, a line, a chevron)
     that pushes a destination, drawn by `NavigationRow` and placed by its
     caller. It names its two instances and its distinction from an **Action
     row**: on a card versus bare, a glyph character versus a node, owning its
     press versus handed one. _Avoid_: settings link, link row.
   - The **Codecs row** entry says it draws through the **Navigation row**.
   - The stale relationship line becomes _five_ **Settings groups**, the
     Library group's Action rows and four Section cards, with _Software update_
     removed from the not-drawn list and only _Change…_ left there.

   Docs only.

10. **COMPONENT-SPEC, CLAUDE.md, README.**
    - `page.CodecsPage` gets its ✅ in the page table.
    - CLAUDE.md's `NavigationRow/` line adds _placed by its caller through
      `styled(NavigationRow)`, `LoadMessage`'s precedent_.
    - README's settings tree line is read against the result and changed only
      if it no longer describes the tree. Its wording already holds, so it's
      expected to stay.
    - Build order step 10 and both feature tables stay ✅ (item 6).

    Docs only.

11. **The journal's refactor entry.** A new top entry, _Codecs page refactor
    (issue 247)_, using the earlier rounds' sections:
    - what each group changed;
    - leaves added, removed and moved, by name;
    - the test and file counts before and after;
    - that `tsc -b` and `eslint src server electron .husky` are clean;
    - the one visible change and why it's the prototype's;
    - the tick left standing and why;
    - anything the round surfaced, by bare number.

    It closes #243 and this issue together.

## Decision Document

- **The prototype wins over the graduation's equality test.** Log 26 Q14's
  "character for character" was a condition for extracting one molecule, not
  a reason to make two prototype paddings one. The molecule owns what both rows
  share, and each caller owns where its row sits.
- **Placement through `className`, on `LoadMessage`'s precedent**, not a prop.
  A `padding` or `placement` prop would be an API the prototype's `data-props`
  doesn't have, and would freeze two literals into an enum. `IconButton`
  forwards `className` for the same reason. The molecule's default is the inset
  both share (`0 4px`), so a bare `NavigationRow` sits flush and a caller states
  its vertical padding in full.
- **The extensions are named `CodecsRow` and `SyncRow`**, after the glossary's
  nouns, in each section's own styles file. The guard that forbade a section
  declaring a `…Row` narrows to the five inner parts, because a placement isn't
  a copy.
- **`NavigationRow` stays in `features/settings/`.** Both callers are still
  Settings groups. No third caller has appeared, so it doesn't graduate to
  `components/`.
- **`NavigationRow` and `ActionRow` stay two molecules.** They differ in their
  pixels (card versus bare), in what the glyph is (a character versus a node)
  and in who owns the press (handed one versus pushing its own). The enrichment
  refactor declined the same merge for the same reason.
- **No interaction states on the navigation row.** Log 21 Q2 kept `ActionRow`
  and every hover the revision didn't touch as drawn, and the prototype draws
  the Codecs and Sync rows with no hover or focus state. Adding one would be a
  §2a amendment and a prototype revision, not a refactor.
- **`GroupCard` keeps `$last`**, on `PlaybackSection`'s `Row` precedent in the
  same folder, but writes only the override.
- **Test ownership follows `ActionRow`'s split.** The molecule's suite proves
  what every row is: a button, its name, decorative tile, line, chevron, push
  on click, Enter and Space, and the forwarded `className`. Each caller's suite
  proves what it hands the molecule: label, glyph, line faces, destination and
  placement.
- **A rule with an observable behaviour is tested by the behaviour.** "Settings
  writes nothing to the component" is proven by _sends nothing to the component
  route_. The source-grep leaf goes. Structural guards stay for rules no
  behaviour can show.
- **The ✅ stays where #246 put it** (item 6). The deviation is recorded, not
  re-enacted.
- **No route, wire, type, hook or server change.** `useCapabilities`,
  `codecView`, `CodecRow`, `ComponentDropZone`, `zoneFace`, `CodecsPage`, the
  route table and the two reads (log 26 Q13) are untouched.

## Testing Decisions

- **A good test here asserts what the maintainer can see or do**: the row's
  name, its line, where a press lands, the computed padding the prototype
  draws, and the requests made or not made. It doesn't assert source text when
  a behaviour can prove the rule, and it doesn't assert that two components are
  equal when the spec says they differ.
- **Characterization before change.** Commit 3's margin leaf and commit 6's
  Sync padding leaf are green before the shipping edit they guard. Commit 7 is
  a pure refactor and must leave every leaf green. Commit 8 is the only commit
  whose new leaf asserts a changed value.
- **Modules tested:** `NavigationRow` (+4 leaves: Enter, Space, chevron,
  `className`; one guard narrowed and extended); `PlaybackSection`'s Codecs row
  suite (−4 leaves: Enter, Space, the source grep, the rule-for-rule; +1:
  padding; one renamed); `NetworkSection`'s sync suite (+1: padding);
  `CodecManager` (+1: the two cards' gaps). `CodecsPage`, `App`, `SettingsPage`,
  `PlaybackSection.test.tsx` and `CodecRow`'s suites don't change.
- **Prior art:** `ActionRow.test.tsx` and `LibrarySection.test.tsx` for the
  molecule/caller split; `LoadMessage`'s suite and the `styled(LoadMessage)`
  placements for `className`; the Codecs row suite's own glyph leaf for the
  chevron comparison; `PlaybackSection.test.tsx`'s typography leaves for
  `getComputedStyle` reads of one property; the back-to-top and snackbar rounds
  for moving a leaf between suites without renaming its meaning.
- **Coverage is sufficient.** The area has 810 lines of `CodecManager` leaves,
  the page suite, two App round trips, the molecule's suite and both callers'
  suites. The gaps this round fills are placement (no leaf read any padding
  except through the rule-for-rule equality) and the last card's margin.

## Out of Scope

- **Hover, press or focus states on `NavigationRow` or `ActionRow`.** Log 21
  Q2. That needs its own §2a amendment and prototype revision.
- **Merging `NavigationRow` and `ActionRow`.** They have different pixels and
  different glyph and press contracts (Decision Document).
- **Moving `NavigationRow` to `components/`.** It has no non-Settings caller.
- **A shared cache of the Codec report**, a `codecsPath` util, a header
  action, a Video/Audio split, or anything else log 26 _Not built_ lists.
- **Reverting and re-applying the ✅** (item 6).
- **`CodecManager.test.tsx`'s size.** At 810 lines it's long, but its
  `describe`s map one-to-one onto log 26's sections and log 16's flows.
  Splitting it would be a reshuffle with no defect behind it.
- **Any server, route, type or wire change.**

## Further Notes

- Commit 8's description, under the commit-message rule, is short: _the Codecs
  row at the prototype's padding_.
- If commit 7's extension turns out to lose to the molecule's own `Row` in the
  cascade, stop and record it rather than raise specificity. Commit 6's leaf
  will go red in that case. It shouldn't happen: `styled-components` injects
  the extension after the base because the base is created first, which is
  what every `styled(LoadMessage)` placement already relies on.
