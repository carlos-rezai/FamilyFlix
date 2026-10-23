# Refactor plan: Subtitle picker, the picker named as its sibling is, track order spelled once, two menus held honestly, and the docs that close the initiative

> Source initiative: `subtitle-picker`, issue 434 (step 33).
> Shipped by issues 435–441. The prototype revision is 435 `b00c7b32` and
> 436 `4fff7747`/`85de0cb0`; the build slices, RED and GREEN each, are 437
> `b7e28ff1`/`837f58f2`, 438 `5d9923af`/`19b8c0f0`, 439
> `bf8f77f9`/`9e189849`/`f18a1d5b`, 440 `bd166337`/`d74fb41f`, 441
> `791643ad`/`03bfe99b`.
> Design log: `docs/design-logs/50-subtitle-picker.md`. PRD:
> `docs/PRDs/50-subtitle-picker.md` (434). Plan:
> `docs/PRDs/50-subtitle-picker-plan.md`.
> This is the initiative's closing round. It ticks **Subtitle picker** and
> closes 434. Filed as issue 442.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._

## Problem Statement

`subtitle-picker` shipped every slice of log 50's implementation plan. At
`03bfe99b` the full suite has **10723 tests across 647 files, all passing**.
`tsc -b --force` is clean. `eslint src server electron` reports one error and
149 warnings, against one and 148 when Start on Series closed. The new
warning is in a suite this initiative touched (section 4).

The design held: the CC pill becomes `SubtitleMenu` from two **Subtitles**
and stays the toggle with one; `c` stays a toggle; the **Subtitle choice** is
`string | null`, held on the unkeyed `PlayerScreen` beside the **Audio
choice**; `preferredSubtitle` reads it ahead of the preference, as
`preferredAudio` does; the **Cue lists** are held per track; nothing on the
server, the wire or Settings moved.

The build slices were written one at a time by agents that each saw one
slice, and the seams show in small places. Nothing below is a bug a household
would see in ordinary use; one is a latent one (section 3). Every finding was
checked against the code for this plan. They fall into four families.

### 1. The picker's names drift from its sibling and from the glossary

- **`SubtitleMenu`'s `track` prop is not the hook's `track`.** `useSubtitles`
  answers `track`: the **Subtitle track**, non-null on any film with rows,
  whether or not the box shows. `SubtitleMenu` takes a prop also called
  `track` that means something else: the row showing, or `null` while off.
  `PlayerControls` converts one into the other (`subtitlesOn ? subtitleTrack
: null`), so the same word changes meaning across one line. The sibling has
  already solved this: `AudioMenu`'s prop is `playing`, "the track playing
  now". The subtitle twin of _playing_ is _showing_, the word every docblock
  the initiative wrote already uses ("the showing track", "the showing one
  marked").
- **`choice` names a `Subtitle | null` in three signatures.** `SubtitleMenu`'s
  `onChoose: (choice: Subtitle | null)`, `PlayerControls`'
  `onChooseSubtitle: (choice: Subtitle | null)` and the suite's `vi.fn` type
  all name the parameter `choice`. In the glossary, the **Subtitle choice**
  is a language (`string | null`), the thing `PlayerScreen` holds; a row is a
  **Subtitle**. `useSubtitles`' own `choose` calls it `row`, and the PRD
  spells it `choose(subtitle: Subtitle | null)`. `AudioMenu`'s twin is
  `onChoose: (track: AudioTrack)`.
- **`useSubtitles`' state and setter disagree.** The hand's on/off is held as
  `const [handOn, setSubtitlesOn]`: the value is named for being a hand
  action, the setter for the derived `subtitlesOn` it is not.
- **`useSubtitles` holds a whole row as the pick.** It stores the picked
  `Subtitle` and then looks it up again by id among the rows. Its sibling,
  `useAudioTracks`, holds the pick as the track's key (`picked: number |
null`, an index) and looks that up. The subtitle row's key is its id.
- **The hook's docblock was edited mid-sentence and never rewrapped**: one
  line runs to 104 columns ("household's **Preferred subtitle language**,
  then track order. `choose(row)` shows that row and turns subtitles on;").
  The same paragraph says a Cue list is "held for the session"; the PRD,
  the log (Q13) and the glossary say "per open", and "session" is the word a
  reader would take for the sitting, which this hook does not outlive.

### 2. Track order is spelled six times

`[...subtitles].sort((a, b) => a.position - b.position)` is written in six
places across two features:

- in the player: `useSubtitles` (the answer's `subtitles`),
  `preferredSubtitle`, `subtitleLabel` and `SubtitleMenu`, three of them new
  in this initiative;
- in the movie form: `formValues`, twice (a film's rows and an episode's).

The server already answers rows `ORDER BY position`; every client sort is the
documented defence against arrival order ("Track order, not arrival order"),
and each pure unit's suite pins it. The rule is right; it has six spellings.
CLAUDE.md: a pure helper two features use lives in `src/utils/`, with its own
test.

`SubtitleMenu` also sorts what it is handed although its one caller hands it
`useSubtitles`' answer, already in track order. `AudioMenu`, its sibling,
lists its tracks "in the order the menu lists them" and sorts nothing.

### 3. Two menus share one flag

- **`Player` holds one `menuOpen` and lets both menus write it.** Log 50 Q7
  asked for one flag "fed by both menus' `onOpenChange`", and that is what
  was built: `onAudioMenuChange={setMenuOpen}` and
  `onSubtitleMenuChange={setMenuOpen}`. It is right only while at most one
  menu is open at a time.
- **Both can be open at once.** `Menu` shuts on Escape and on a pointerdown
  outside, not when focus leaves it. A keyboard user can open the Audio
  picker, Tab to the CC pill and open the Subtitle picker. Picking a
  subtitle then reports `false`, and the chrome is free to hide while the
  Audio picker's panel is still open over it. With a mouse it cannot happen,
  only because the outside pointerdown shuts the first menu before the click
  opens the second: the flag's correctness rests on event order. The suite
  pins that order ("stays up from the Subtitle menu straight into the Audio
  menu" fires pointerdown, then click), not the two-open case.

### 4. Tests and prose

- **One new lint warning.** `Player.audio.test.tsx` no longer uses `screen`
  since 439 replaced its one CC click with the `c` key (the film has two
  files now, so CC is the picker), but still imports it.
  `no-unused-vars` flags it.
- **Eight em dashes were added to code** after the rule against them: three
  new suite headers (`50 — Subtitle picker, Phase n`) and five new
  `describe` titles (`Player — picking a subtitle`, `Player — keys inside
the open Subtitle menu`, `Player — the chrome while a menu is open`,
  `PlayerControls — the Subtitle picker`, `PlayerScreen — the Subtitle
choice lasts the sitting`). The initiative's own other suites already
  write `SubtitleMenu: the trigger` and `useSubtitles: the picker`, so it
  disagrees with itself.
- **The documents.**
  - The feature checklist's _Subtitle picker_ row is 🔜, and step 33 has no
    entry.
  - The README's `player/` line still says only "subtitles (useSubtitles
    reads the preferred language)".
  - The glossary's _Subtitle picker_ section still says "Planned (🔜)".

## Solution

One round, in five groups, each commit leaving the suite green and the
typecheck clean:

1. **The picker's names.** `SubtitleMenu` takes `showing`, `AudioMenu`'s
   `playing` twin; every `Subtitle | null` parameter is a `subtitle`;
   `useSubtitles` holds `handOn` with `setHandOn` and the pick as an id, as
   `useAudioTracks` holds an index; its docblock is rewrapped and says "per
   open".
2. **Track order, once.** `inTrackOrder` in `src/utils/`, with its own test,
   is the one spelling, used by the player's three pure readers and the movie
   form; `SubtitleMenu` lists what it is handed, as `AudioMenu` does.
3. **Two menus, two flags.** `Player` holds one flag per menu and derives
   `menuOpen` from both, so the chrome is held while either is open,
   whatever order the events arrive in. The round's one behaviour change, a
   `fix:`.
4. **Tests and prose.** The unused import goes; the eight em dashes are
   rewritten in the initiative's own colon form.
5. **The docs that close the initiative**, and the journal.

No wire, schema, Settings or prototype change. Nothing a household sees
changes, except the chrome staying up in the two-menus case.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [subtitle-picker] issue #442 …`, except where a commit is named
`fix:`, `test:` or `docs:`.

### Group 1: the picker's names

1. **`SubtitleMenu` takes `showing`, and a `subtitle`.**
   - `SubtitleMenuProps.track` becomes `showing: Subtitle | null`, "the
     Subtitle showing now, or `null` while subtitles are off", `AudioMenu`'s
     `playing` twin. The trigger's lit face reads `showing !== null`; the
     marks read `showing`.
   - `onChoose`'s parameter is named `subtitle`, as `AudioMenu`'s is named
     `track`.
   - `PlayerControls` passes `showing={subtitlesOn ? subtitleTrack : null}`.
     Its `onChooseSubtitle` parameter is named `subtitle`. Its
     `subtitleTrack` prop keeps its name: it is the hook's **Subtitle
     track**, which is why the conversion lives here.
   - `SubtitleMenu.test.tsx`'s harness overrides `{ track: … }` become
     `{ showing: … }`, and its `vi.fn` type names `subtitle`. A prop rename
     can only be followed by its suite; no assertion changes.
2. **`useSubtitles` names what it holds.**
   - `const [handOn, setHandOn]`.
   - The pick is held as the row's id, `string | null`, as `useAudioTracks`
     holds the track's index; the track is "the row with the picked id, else
     `preferredSubtitle`'s answer". A picked row that leaves the record
     still falls to the rule, as today.
   - `choose`'s parameter, in the implementation and in the `Subtitles`
     interface, is named `subtitle`, the PRD's spelling.
   - The docblock is rewrapped. "Held for the session" becomes "held for
     this open", the log's and the glossary's word; the rest of its
     sentences stay.
   - Guarded by `useSubtitles.test.ts`' picker, Cue-list and choice blocks,
     unchanged.

### Group 2: track order, once

3. **`inTrackOrder` is the one spelling of track order.**
   - A new util, `src/utils/inTrackOrder/`, exports
     `inTrackOrder<T extends { position: number }>(rows: readonly T[]): T[]`:
     a new array, ascending `position`, the input untouched. Its docblock
     carries the reason every call site now spells in its own words: track
     order is `position`, never the order the rows arrived in. Generic over
     `position` so the form's and the player's rows both fit without a cast.
   - Exported from the `utils/` barrel.
   - `inTrackOrder.test.ts` is born with four rows: rows out of order come
     back in order; rows already in order come back equal; the input array is
     not reordered; `[]` is `[]`. Prior art: `range.test.ts` and
     `sortOptions`' suite for a small pure util.
   - Nothing calls it yet.
4. **The player reads track order through it.**
   - `useSubtitles`' memoised `subtitles`, `preferredSubtitle`'s
     `byPosition` and `subtitleLabel`'s place all call `inTrackOrder`.
     `preferredSubtitle`'s inline "Track order, not arrival order" comment
     goes; the util's docblock says it once.
   - `preferredSubtitle` and `subtitleLabel` keep ordering for themselves:
     they are pure units with callers of their own, and their suites pin
     "not by the order the rows arrive in".
   - Guarded by `preferredSubtitle.test.ts`, `subtitleLabel.test.ts` and
     `useSubtitles.test.ts`' "chooses by track order" leaf, unchanged.
5. **`SubtitleMenu` lists what it is handed.**
   - The menu's own sort goes. Its `subtitles` prop says "listed in the
     order handed: track order, as `useSubtitles` answers them", `AudioMenu`'s
     contract. The labels still read the whole list, so ties are counted the
     same.
   - `PlayerControls`' `subtitles` prop says it is in track order.
   - Guarded by `SubtitleMenu.test.tsx` (its rows are handed in track order
     already), `PlayerControls.test.tsx` and `Player.subtitlePicker.test.tsx`,
     unchanged. If any case hands rows out of order, it is handed them in
     track order in this commit, with the reason in the body: the contract
     moved to the caller.
6. **The movie form reads track order through it.**
   - `formValues`' two sorts, a film's subtitle rows and an episode's, call
     `inTrackOrder`. Their comment shortens to why the form cares (the order
     the family already has).
   - The util now has its second feature, which is why it is in
     `src/utils/`.
   - Guarded by `formValues`' suite and the form's subtitle-row suites,
     unchanged.

### Group 3: two menus, two flags

7. **`fix: [subtitle-picker] issue #442 the chrome stays up while either menu is open`.**
   - `Player` holds `audioMenuOpen` and `subtitleMenuOpen`, each written by
     its own menu's `onOpenChange`, and derives
     `menuOpen = audioMenuOpen || subtitleMenuOpen` for
     `useControlsVisibility`. The comment says why it is two flags: a menu
     shuts on Escape or a press outside, not when focus leaves it, so both
     can be open.
   - `Player.subtitlePicker.test.tsx`'s "the chrome while a menu is open"
     block gains one case: open the Audio picker and the Subtitle picker by
     their triggers alone (no pointerdown, the keyboard's path), pick a
     subtitle, and the chrome is still up while the Audio menu is open; shut
     it, and the chrome hides on the usual timer. The case is red before the
     change and green after, in the same commit.
   - Log 50 Q7's intent, "an open menu holds the chrome up", is kept; its
     mechanism, one flag both menus write, is corrected. The body says so.

### Group 4: tests and prose

8. **`test: [subtitle-picker] issue #442 the audio suite lints clean`.**
   - `Player.audio.test.tsx` drops the unused `screen` import. The
     `no-unused-vars` warning goes. No assertion changes.
9. **The initiative's em dashes go.**
   - The three suite headers read `50, Subtitle picker, Phase n`, the
     previous round's form.
   - The five new `describe` titles take a colon (`Player: picking a
subtitle`, and so on), the form `SubtitleMenu` and `useSubtitles`'
     new blocks already use. Their older neighbours in the same files keep
     theirs until the repo-wide pass.
   - No code changes; every suite passes with the same count.

### Group 5: the docs

10. **`docs: [subtitle-picker] issue #442 the docs know the subtitle picker shipped`.**
    - **Feature checklist**: the _Subtitle picker_ row goes ✅. Step 33 gains
      an entry in step 32's shape, under a line saying where it came from
      (the brief: some films carry two subtitle files, and the player only
      ever showed one): with two or more subtitle files, CC opens a menu,
      _Off_ then each file by its language; one file keeps the plain toggle;
      `C` still turns subtitles on and off; what you last did carries to the
      next episode for the evening, and a fresh open starts off.
    - **README**: the folder tree's `player/` line names the Subtitle picker
      (`SubtitleMenu`, `subtitleLabel`) and the Subtitle choice held by
      `PlayerScreen`, beside the Audio picker; the `utils/` line gains
      `inTrackOrder`.
    - **Glossary**: the _Subtitle picker_ section's "Planned (🔜)" becomes
      "Shipped (✅)". The relationship line's reference to track order is
      unchanged; no term is renamed. The dialogue sections are snapshots and
      stay as they are.
    - **CLAUDE.md** is unchanged: its layout names no unit this round adds,
      and its Playback line already describes the player as it is.
11. **`docs: [subtitle-picker] issue #442 the journal`.** A newest-first
    entry in `docs/dev-journal.md`, in the last entry's shape:
    - what shipped;
    - what each group changed;
    - where the round left the plan;
    - what was deliberately not changed;
    - the follow-ups.

    The commit closes 434 in words, not with a keyword, and this issue with
    one.

## Decision Document

- **`showing`, not `track`, on the menu.** The **Subtitle track** is the row
  the hook would show, non-null on any film with rows; the menu needs the row
  showing now, `null` while off. Two meanings get two words. `showing` is
  `AudioMenu`'s `playing`, said of subtitles, and the word the initiative's
  docblocks already use. `PlayerControls` keeps `subtitleTrack` and makes the
  conversion, because it holds both `subtitleTrack` and `subtitlesOn`.
- **A `Subtitle | null` parameter is a `subtitle`.** **Subtitle choice** is
  the glossary's name for the sitting's language, never for a row. The hook's
  local `rows` for the record's array stays: it is a local, and it reads
  well beside `subtitles` in track order.
- **The pick is an id.** `useAudioTracks` holds the track's index; the
  subtitle row's key is its id. A whole object held in state and found again
  by id is the shape neither sibling should have.
- **`inTrackOrder` lives in `src/utils/`.** Two features read track order
  (player and movie form). It is generic over `{ position: number }`, the one
  field the rule reads. It returns a new array; no caller sorts in place
  today and none should. Name: the glossary already says "track order" in
  every row that orders Subtitles, so the util is named for that phrase.
- **Pure units order for themselves; components do not.** `preferredSubtitle`
  and `subtitleLabel` are pure functions any caller may hand rows to, and
  their suites pin arrival-order independence, so each calls `inTrackOrder`.
  `SubtitleMenu` is a presentational organism with one caller that hands it
  the hook's answer; like `AudioMenu`, it lists what it is given.
- **Two flags, one derived `menuOpen`.** The name log 50 Q7 chose is kept for
  what `useControlsVisibility` is handed. Each menu writes its own flag, so
  the result does not depend on which menu's event lands last. No new hook:
  two `useState`s and an `||` in `Player`, beside the audio picker's state.
- **The one behaviour change is the chrome in the two-menus case.** It ships
  as a `fix:` with its own case. Every other commit moves names and rules,
  not behaviour.
- **Nothing on the wire, the server, the schema, Settings or the prototype
  changes.** `Subtitle`, `Subtitles` (but for `choose`'s parameter name),
  `SubtitlesOptions` and `PlayerScreen` keep their shapes. `SubtitleMenuProps`
  renames `track` to `showing`.

## Testing Decisions

- **A good test asserts what a caller or a household sees**: the items drawn
  and marked, the line on screen, the requests made, the choice reported, the
  chrome up or hidden. It never asserts which helper ran, how a hook holds
  its state, or the order of calls inside it.
- **The initiative's suites are thorough and behavioural**, and carry almost
  every commit unchanged: `preferredSubtitle`, `subtitleLabel`,
  `useSubtitles` (the deep module, 37 cases), `SubtitleMenu`,
  `PlayerControls`, `Player.subtitlePicker` and `PlayerScreen.subtitleChoice`.
- **Characterization before change.** Groups 1 and 2 change no assertion.
  Commit 1 follows a prop rename in its own suite's harness. Commit 5 may
  hand a case its rows in track order, if one does not already. A suite that
  has to change anywhere else is reading an implementation detail, and is
  fixed in the same commit with the reason in the body.
- **New suites and cases:**
  - `inTrackOrder`: four rows. Prior art: `range.test.ts`,
    `isLibraryTab.test.ts` for a small util born in a refactor round.
  - The two-menus case in `Player.subtitlePicker.test.tsx`. Prior art: that
    block's "stays up from the Subtitle menu straight into the Audio menu"
    case, which pins the mouse's order (pointerdown, then click), and
    `Player.audioPicker.test.tsx`'s "stays up while the menu is open,
    however long it is left".
- **The gate:** the full suite at the end of each commit; `tsc -b --force`
  (an incremental build can miss a spec file) and `eslint src server
electron` at the end of each group. The round ends at one error and 148
  warnings, the one this initiative added gone.

## Out of Scope

- **The CC face spelled twice**, as the toggle in `PlayerControls` and as the
  trigger in `SubtitleMenu`. Log 50 Q5 chose one face with two semantics
  (`aria-pressed` against `aria-haspopup`); each spelling is five lines over
  the shared `SubtitleButton` style, and `AudioMenu` spells its trigger in
  the same place. A shared face component for two call sites in one feature
  would cost more than it saves.
- **`hasSubtitles` decided in `Player` (`track !== null`) while
  `hasSubtitlePicker` comes from the hook.** It predates the initiative, it
  is the shape the audio refactor matched `hasAudioTracks` to for the key and
  the button together, and `track !== null` is the C key's rule too.
- **`Subtitles` / `SubtitlesOptions` beside `AudioTracksState` /
  `AudioTracksOptions`.** The subtitle names predate the audio hook; renaming
  them is its own round.
- **The per-suite harnesses** in the player's suites (`answerWith`,
  `renderScreen`, `settled`, `emit`), spelled again in the two new suites.
  That is the shared test-helper follow-up the last two journal entries
  already carry.
- **Em dashes older than this initiative**, including the older `describe`
  titles beside the renamed ones. That is the repo-wide pass.
- Anything log 50 put out of scope: embedded subtitle streams, auto-on
  subtitles, a per-title memory, writing the choice to the preference, a
  subtitle-style setting.

## Further Notes

- Group 1 and Group 2 are the round's reason to exist: the picker named as
  its sibling and the glossary name things, and a rule spelled once. Group 3
  is the one change a keyboard user could see.
- Commit 3 must land before commits 4 to 6, and commit 4 before commit 5, so
  the hook answers track order before the menu stops ordering for itself.
- Follow-ups this plan already sees, each for the journal, not this round:
  - a shared held-response and player-harness test helper;
  - the repo-wide em dash pass;
  - from earlier entries: the sandbox teardown flake, and the lint error in
    `EnrichmentReview.test.tsx`.
