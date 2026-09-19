# Refactor plan: Playback component upload — the prototype's own ✕, the zone's faces as a table, the refusal nobody asserted, and the docs that close the initiative

> Source initiative: [`component-upload`, issue #150](https://github.com/carlos-rezai/FamilyFlix/issues/150)
> Shipped by issues 151–155. Design log: `docs/design-logs/16-component-upload.md`.
> Filed as issue 157. The docs-and-glossary slice filed as 156 is folded in here as Group 0 and
> Group 5, on the precedent of 148 into 149 and 140 into 141, so the initiative
> has one closing issue rather than two and the feature table ticks ✅ when this
> one closes.

## Problem Statement

`component-upload` is the second initiative driven end to end by `issue-loop`,
and the first whose subject is a file on disk that the app both runs and
replaces. The maintainer's one instruction was the scope the grill ran under:
_translate the prototype 1:1 into the codebase, in its naming, conventions,
patterns and architecture_.

What shipped is that. The **Component slot** is a writable directory read ahead
of `FAMILYFLIX_FFMPEG_PATH` and ahead of `PATH`, so an upload beats the
installer's build and a remove falls back to it. A drop is two **Component
binaries** told apart by filename alone, staged in `incoming/`, run before
anything moves, and sworn in by three directory renames — so a Windows lock on
a running `ffmpeg.exe` fails the first rename with nothing moved and answers the
**In-use refusal** rather than leaving a mixed pair behind. `createPlayback`
takes the slot rather than a component and reads it per request, so the next
press of Play decides over whatever is live with nothing cached to clear. The
two routes echo the whole **Codec report** after the write, so the screen
redraws from the echo. The **Component row** is the prototype's row template
drawn once more for the one thing on the screen that genuinely has a size and a
remove, and the **Component drop zone** has the three faces the prototype's
author never drew.

The surface was read against `feat.CodecManager.dc.html` and the container's
amended model, cell by cell, for this filing. It is the prototype's — the same
flex, the same paddings, the same inks, every literal the prototype's own — with
**one** exception, and it is the kind round 15 found too: a control built
locally where an atom for it already existed.

Round 15 said the debt an `issue-loop` build leaves is small, of a kind, and
made of what a subagent reading one issue cannot see: it does not read _back_.
This round is the same shape, plus one thing round 15 did not have — a refusal
invented mid-build that nothing ever asserted.

### 1. The Component row builds its own ✕ beside the atom for it

`primitives/RemoveButton` is the prototype's ✕, extracted in the movie-form
round: a 32px square on a 7px corner, `textFaint` until hover, then `danger` over
`rgba(201,122,106,.1)`, with `type="button"` and both the accessible name and the
`title` built from one string. The design log's own "what exists to build on"
names it — "`primitives/RemoveButton`: the prototype's exact ✕ … with its name
built from what it removes" — and Q9 says the **Component row** gets
"`RemoveButton` on an uploaded component". The glossary's **Component row** row
says the same.

`CodecRow.styles.ts` declares a second one. It is the primitive's rule
character for character, plus `font-family: sans` and `font-size: 13px` — two
properties the prototype writes on neither its `CodecManager` ✕ nor its
`FileField` ✕, both of which are the same inline block byte for byte. The
button therefore draws its glyph at 13px sans where the prototype draws it at the
UA default, and it carries no `title`, so the one row on the page with a
destructive control is the one place the hover tooltip is missing. One
pixel-level deviation on a screen otherwise 1:1, an atom duplicated, and a
glossary line that describes the code that was not written.

The prototype's own ✕ carries `title="Remove codec"`, a literal from before
`16`'s amendment made the component the only removable row. It says the wrong
word about the only row that can reach it.

### 2. A docblock that stopped scheduling

`PlaybackSection`'s docblock reads: "The lede keeps both of the prototype's
sentences though the _Add a codec pack_ zone the second one points at is not
drawn — so the copy does not move when the **Playback component upload**
lands." It landed, two issues later, in the card this docblock is on. Nobody
amended the sentence because nobody opened `PlaybackSection` in #154 — the same
failure round 15 found in `LibrarySection`, in the same feature, one round
apart.

### 3. The zone's three faces are a nested ternary and three guarded lines

`ComponentDropZone` derives `busy`, `refused` and `removing` from the **Upload
state**, then writes the title as a ternary inside a ternary and the second line
as three separate `{cond && <Line/>}` blocks. Six pieces of copy and one danger
flag, spelled as control flow in the middle of markup. The app already has the
answer for this shape one feature over: `importView` is "pure: an `ImportRun` →
headline, stat line, percent, elapsed, ETA", and `ImportProgress` reads it. The
faces are a table; the molecule should draw one.

### 4. A refusal invented during the build, and asserted by nothing

The design log's `InstallOutcome` has three reasons. The build added a fourth —
`failed`, for a swap stopped by something that is neither the lock nor the pair
— and documented it well: it is a value rather than a throw "because an install
that threw would be the one outcome the route could not answer", and it is not
`in-use` "because sending the maintainer to stop a film that is not the problem
would be worse than saying nothing useful". `RemoveRefusal` gained the same
fourth, and `routes/index.ts` maps both to `500` with a sentence each.

Nothing asserts any of it. `grep failed` over `componentSlot.test.ts` and
`routes.settings.test.ts` is empty. The two leaves that get nearest are the
install's and the remove's `does not call an unrelated errno in use`, and they
assert what the outcome **is not**:

- the remove's says `toMatchObject({ ok: false })` and then
  `not.toEqual({ ok: false, reason: 'in-use' })`;
- the install's wraps `install()` in a `try/catch`, assigns the caught error to
  the same variable, and asserts only `not.toEqual({ ok: false, reason:
'in-use' })` — **which passes if `install()` throws.** The one leaf covering
  the path whose whole design decision is "a value, never a throw" is the one
  leaf that cannot tell a value from a throw.

Two more paths are unasserted beside it. The swap's rollback — a second rename
that fails after `current/` has already moved, where the code renames
`previous/` back because "the live component is the one thing that must be back
where it was" — has no leaf; `lockedRename` only ever fails the first call. And
the two `500`s: the route fakes' outcome unions are written `'incomplete' |
'not-a-component' | 'in-use'` and `'nothing-uploaded' | 'in-use'`, so the
`failed` arm of both refusal tables is unreachable from a route test.

The `rename` seam exists precisely so these are cheap. It was injected "for the
reason the environment is — a unit that spawns or renames must be assertable on
a machine that has neither an FFmpeg on it nor a Windows lock to reproduce", and
then used for the lock alone.

### 5. Mid-file phase banners, again

Round 15's ruling: the top-of-file banner keeps the history and mid-file ones
fold into it. Five files this initiative touched carry a second or third dated
banner — `CodecManager.test.tsx` (a Phase 3 docblock at line 331, after a top
banner that already names Phase 1 twice), `useCapabilities.test.ts` (Phase 3 and
Phase 4), the settings feature's `api.test.ts` (Phase 3 and Phase 4),
`ComponentDropZone.test.tsx` (Phase 4), and `routes.settings.test.ts` (a Phase 4
note over the remove section). `componentSlot.test.ts` carries the same dating
inside two section banners that are otherwise worth keeping — the write half and
the remove half are real divisions of that file, and only the "Phase 2." /
"Phase 4." sentences opening them are the slice showing through.

Three top banners have gone stale with it. `CodecManager.test.tsx` still says "A
report, not a manager: no _Add a codec pack_ zone and no ✕ until the **Playback
component upload** ships", and then, in the Phase 1 half, "Still no zone and
still no ✕: nothing passes a remove handler until Phase 4". Both shipped.

### 6. Leaves that count the zone twice, and two that count the buttons twice

`CodecManager.test.tsx`'s `offers the zone under the rows, and no ✕ on a default
component` was written in Phase 1 to say the zone was absent, amended in Phase 3
when it arrived, and is now two assertions, the first of which
`draws the zone last, under the Component row` makes in a stronger form (it
asserts the order). Its one distinct query is the `✕` that is not there on a
default component, which belongs in the describe about the ✕.

`CodecRow.test.tsx` has `draws no button when no handler is given` (with a
comment saying "the component's ✕ is Phase 4's", which it no longer is) and
`draws no link and nothing else clickable on a codec row`, whose first
assertion is the whole of the first leaf.

### 7. Two spellings of what an executable is called

`ffmpegBinary` exports `EXE` — this initiative exported it — with the docblock
"what a pair is, and what a platform calls its halves, is one answer rather than
the resolver's and the slot's". `test-support/componentDir` declares its own
`EXE` with the same comment on it, and `componentSlot.test.ts` imports the
test-support copy. Three files, one Windows difference, two declarations of it.

### 8. The docs the initiative owes

Issue 156's list, merged here. `COMPONENT-SPEC.md`'s `CodecManager` row still
says "No _Add a codec pack_ drop zone and no per-row ✕ until the **Playback
component upload** initiative" and gives `CodecRow` the props `{ row:
CodecRowModel }`; there is no `ComponentDropZone` row, and the Icons table has
no `UploadIcon`. CLAUDE.md's folder map names none of `componentBinary/`,
`verifyComponent/`, `componentSlot/`, `test-support/fixedSlot/`,
`ComponentDropZone/`, `src/styles/visuallyHidden.ts` or `Icon/UploadIcon`, and
its `createPlayback`, `capabilities` and `CodecManager`/`CodecRow`/`codecView`
lines describe the shapes from before the slot; its Settings Hub section still
lists the zone and the ✕ among the controls "whose mechanism does not exist".
README's tree is coarser but wrong in the same places. The glossary was written
by the grill ahead of the build and mostly holds — every row was read against
the code for this filing — with three exceptions the code wins: **Incoming
component** lists three install refusals where there are four; **Component
slot** writes `createComponentSlot(slotDir, env, verify)` where the third
argument is a seams object carrying `verify` and `rename`; and **Component
binary** says "case-insensitively, `.exe` or not" without the rule that actually
makes a downloaded build work — a `-` and whatever the build called itself.
**Component row** says `RemoveButton`, which Group 1 makes true rather than
corrects.

## Solution

Six groups, each a working tree after every commit: the record of the build
first, so the journal describes what shipped before this round moves it; the
prototype amendment and the atom second, because the one pixel should be early
and visible; the zone's table third; the leaves the build never wrote fourth,
since they are the only group that adds behaviour coverage and should be green
before the test files are rearranged; the test reading fifth; the docs last,
because the folder map has to describe the tree the earlier groups leave.
Sixteen commits.

## Commits

### Group 0 — the record of what was built

1. **The journal's component-upload entry.** `docs/dev-journal.md` gets the
   initiative's entry, dated by the last build commit (2026-09-19): what shipped
   across #151–#155, slice by slice — the prototype amended first, then the slot
   end to end with the type change and the thirty-odd call sites moved onto
   `fixedSlot`, the upload on the wire, the zone, and the ✕; that it was the
   second initiative driven wholly by `issue-loop`; the judgment calls the
   subagents made alone that the log did not name — the fourth `failed` refusal
   on both outcome unions, `componentBinary` accepting a `-` suffix so a build
   downloaded as `ffmpeg-7.1.exe` resolves, `EACCES` joining `EBUSY`/`EPERM` in
   the lock set, the `rename` seam beside `verify`, and the swap's rollback of
   a first rename that succeeded; the manual acceptance criteria no subagent
   could exercise (drop a real pair and watch the Installed rows appear; press ✕
   and watch them go; start a transcode and drop mid-conversion on Windows for
   the **In-use refusal**); what was deliberately not built (a zip, an Electron
   dialog, a confirm, a progress bar, a success flash); and the follow-ups —
   which are this plan, by bare number.

### Group 1 — the prototype's own ✕

2. **The prototype's row ✕ is named for what it removes.**
   `docs/handoff/feat.CodecManager.dc.html`'s `title="Remove codec"` becomes
   `title="Remove playback component"`. Since #151's amendment the component row
   is the only row the ✕ is drawn on, and "codec" is the word that row exists to
   stop the screen saying. The prototype is amended first, then built to.
   Geometry unchanged, and no `data-props` change.

3. **`CodecRow` draws the `RemoveButton` primitive.** The local styled
   `RemoveButton` goes from `CodecRow.styles.ts`; the molecule renders
   `<RemoveButton removes={row.name} onClick={onRemove} />`, which builds the
   same accessible name it built by hand and adds the `title` the prototype
   draws. `Spacer` stays. The two properties the local copy added — 13px, sans —
   go with it, which is the one pixel this round moves and moves it onto the
   prototype. Every `CodecRow` and `CodecManager` leaf passes unchanged: the ✕ is
   still the last cell, still a `<button>`, still named _Remove Playback
   component_.

4. **`PlaybackSection`'s docblock stops scheduling.** The sentence about the
   zone "not drawn … so the copy does not move when the **Playback component
   upload** lands" becomes what is true: the lede's two sentences are the
   prototype's, and the second points at the zone `CodecManager` now draws under
   the rows. Comment only.

### Group 2 — the zone's three faces as a table

5. **`zoneFace/` — pure: an `UploadState` → the face the zone draws.** A new unit
   in `features/settings/`, `importView`'s precedent and shape: `zoneFace(upload)`
   answers `{ title, line, refused }` — _Add a codec pack_ over the invitation,
   _Adding_ / _Removing the playback component…_ over their busy lines, and the
   title kept with the route's reason under it when refused. `ComponentDropZone`
   reads it and draws one `<Line>`; the nested ternary and the three guarded
   blocks go, and `busy` stays on the component because it is what disables the
   input and kills the hover, which is behaviour rather than copy. The
   invitation's `ffmpeg` keeps its `<Mono>` span, so the invitation's line is the
   one face the molecule still composes — recorded on the prop, not hidden. New
   test file for the unit; the zone's own leaves pass unchanged, because every
   one of them reads what is on screen.

### Group 3 — the refusal nobody asserted

6. **The slot's two `failed` leaves say what the outcome is.** The install's
   `does not call an unrelated errno in use` loses its `try/catch` and asserts
   `{ ok: false, reason: 'failed' }`; the remove's asserts the same in place of
   `toMatchObject({ ok: false })` and the negative. A throw now fails the test,
   which is the contract both docblocks claim. Test-only; no shipping code
   changes.

7. **A swap stopped after `current/` moved puts the live pair back.** A leaf
   over a `rename` that succeeds once and then fails: the outcome is `failed`,
   `current/` still holds the pair that was live, `incoming/` is gone, and
   `slot.current()` is the component it was before. The seam already takes a
   function; this is the second thing it is asked.

8. **The two component routes answer `500` for a slot that failed.** The
   `uploadableSlot` and `removableSlot` fakes' outcome unions widen to the
   `InstallRefusal` and `RemoveRefusal` the slot actually declares — imported
   rather than re-spelled, which is what stops the next arm going untested the
   same way — and one leaf each asserts the `500` and its sentence. The
   `REFUSALS` and `REMOVE_REFUSALS` tables are then exhaustively covered.

### Group 4 — the tests read by behaviour

9. **Mid-file phase banners fold into their files' top banners.**
   `CodecManager.test.tsx`, `useCapabilities.test.ts`, the settings feature's
   `api.test.ts`, `ComponentDropZone.test.tsx` and `routes.settings.test.ts`:
   each file's top banner names every slice that touched it, and the sections
   under it keep whatever they say about the subject and lose the dating.
   `componentSlot.test.ts`'s two section banners keep their headings and their
   prose and lose the "Phase 2." / "Phase 4." sentences. Comments only.

10. **Three top banners stop describing what has since shipped.**
    `CodecManager.test.tsx`'s "no zone and no ✕ until the **Playback component
    upload** ships" and "Still no zone and still no ✕ … until Phase 4", and the
    stale half-sentences beside them in `CodecRow.test.tsx` and
    `codecView.test.ts`, become what the files now assert. Comments only, and
    the last of the scheduling prose in this feature.

11. **`CodecManager.test.tsx` counts the zone once.** `offers the zone under
the rows, and no ✕ on a default component` folds: the zone half is what
    `draws the zone last, under the Component row` already asserts in a stronger
    form, and its distinct `queryByText('✕')` moves into the ✕ describe as its
    negative half. One leaf fewer, no assertion lost.

12. **`CodecRow.test.tsx`'s two "nothing clickable" leaves fold into one.**
    `draws no button when no handler is given` goes; `draws no link and nothing
else clickable on a codec row` already makes its assertion and keeps the
    `link` query beside it. The comment about the ✕ being "Phase 4's" goes with
    it. One leaf fewer, no assertion lost.

13. **`componentDir` reads `EXE` from `ffmpegBinary`.** The test-support copy
    and its comment go; the helper re-exports the resolver's so its callers'
    imports are untouched. What a platform calls a binary is one answer, which
    is the rule `pairIn`'s and `EXE`'s own docblocks already claim.

### Group 5 — the docs that close the initiative

14. **COMPONENT-SPEC says what shipped.** The `CodecManager` row: no props, owns
    `useCapabilities`, composes the **Codec summary** over one `CodecRow` per
    catalogued codec, then the **Component row** last, then
    `ComponentDropZone` — the zone and the ✕ built, and the copy that held them
    back removed. The `CodecRow` row: `{ row, onRemove? }`, the ✕ drawn exactly
    when a handler is given and the 32px spacer when not, the four **Status
    pill** words over two colourings, and the ✕ as the `RemoveButton` atom. A
    `ComponentDropZone` row: `{ upload, onFiles }`, a `<label>` over a clipped
    multiple file input, the three faces, drag-over as the prototype's hover.
    The Icons table gains `UploadIcon`.

15. **CLAUDE.md's folder map and env section, and README's tree.** The three new
    `playback/` units and `test-support/fixedSlot/`; `createPlayback`'s
    `(mediaPath, slot)` with `capabilities()`, `receiveComponent()` and
    `removeComponent()` on it; `capabilities/` reading the slot's live component;
    `ffmpegBinary`'s exported `pairIn` and `EXE`; `features/settings/`'s
    `ComponentDropZone/` and `zoneFace/`, and the amended `CodecManager`,
    `CodecRow`, `codecView`, `useCapabilities` and `api/` lines;
    `src/styles/visuallyHidden.ts`; `Icon/UploadIcon`; `types/playback.ts`'s
    `ComponentSource` and `PlaybackComponentInfo`; the two routes in the
    Settings Hub section, whose "not drawn" list loses the zone and the ✕ and
    keeps _Change…_ and _Software update_; the Tech Stack paragraph's "Settings'
    codec pack replaces this binary", now true. README's tree in the same
    places. Both files tracked, on 141's precedent. _(The env section's
    `FAMILYFLIX_COMPONENT_PATH` line was written in #152 and holds.)_

16. **The glossary checked against what shipped, the journal's paragraph, and
    the feature tick.** **Incoming component** gains the fourth install refusal;
    **Component slot** takes a seams object; **Component binary** gains the `-`
    suffix rule. Every other row of _The Playback component upload_ — **Uploaded
    component**, **Default component**, **Verified component**, **Component
    swap**, **In-use refusal**, **Component info**, **Component row**,
    **Component drop zone**, **Upload state** — and the updated **Playback
    component**, **Codec report**, **Codec row** and **Playback component
    upload** rows read against the code for this filing and left where they
    hold; a session entry for this round naming the three amendments by bare
    number. Then the journal's paragraph for the round — what each group
    changed, the test count before and after, what was deliberately left (the
    decision document below, in prose) — and the tick: **Codec manager — add a
    playback component** ✅ in both README and CLAUDE.md, per the project's rule
    that a feature is Done only after its refactor. Closes this issue; 150
    closed by comment alongside, 156 closed as folded in — by bare number, never
    a closing keyword. _(The closures are done at closing time, not as
    commits.)_

## Decision Document

- **The atom, not the copy, and the prototype amended first.** `RemoveButton`
  exists because two molecules were each writing the button around the glyph;
  `CodecRow` is the third, and the reason it is worth a commit rather than a
  note is that the copy is not identical — it is the prototype's rule plus two
  properties the prototype does not write, which is a pixel deviation dressed
  as a duplicate. The prototype's `title` is amended in its own commit ahead of
  the code, on the initiative's own rule: amend, then build to the amendment.
- **`zoneFace` is a feature unit, not part of `codecView`.** `codecView` is the
  **Format catalogue** and the two row mappers; the zone's copy is neither a row
  nor a codec. `importView`'s precedent is a view mapper per organism, in its
  own folder with its test, and that is what this is.
- **`busy` stays on the molecule.** `zoneFace` answers copy. Whether the input
  is disabled, whether the hover paints and whether a drop reports anything are
  behaviour, and a face object carrying a `disabled` flag would be the mapper
  deciding what a control does.
- **The route keeps its own "both halves" check.** `taken.size < 2` at the door
  and `pairIn(incomingDir) === null` in `install()` are the same rule in two
  places, and the route's is redundant — dropping it would produce the same
  `400` and the same sentence through `REFUSALS.incomplete`. It stays anyway:
  the route's check is the sibling of `stray`, which only the route can make,
  and removing it would push the rule into the route suite's fake slots, which
  would then have to model `pairIn` to keep the leaf that asserts it. One rule
  written twice beats one rule written once and simulated in a double. Recorded
  so the next round does not re-derive it; both docblocks already name the
  other.
- **`routes.settings.test.ts` keeps both initiatives' routes.** Round 15's rule
  was one suite per initiative, and its actual reasoning was that a second
  listener, `freshApi` and sandbox for routes that share a page is scaffolding
  duplicated for nothing. The two component routes are the Settings page's wire,
  read by the screen the settings routes serve, composed over the same
  `playback`. At 1120 lines the file is a third of `routes.test.ts`. A
  `routes.component.test.ts` would copy ~130 lines of setup to move ~460 of
  leaves. It stays; the banner already says what it holds.
- **`useCapabilities` keeps its three guards.** `wanted` in the read effect,
  `onScreen` as a ref, and `inFlight` as a second ref are three mechanisms for
  two questions, and `useExport` answers both with one epoch ref. They stay:
  `wanted` is the shape every fetch-once hook on this page uses and reads the
  same as `useStorageReport`'s and `useSettings`'; `inFlight` cannot be state
  because the callback closes over the render it was made in; and `onScreen` is
  what makes a write landing after the page has gone redraw nothing, which the
  epoch would answer only by also being bumped per write. Considered and kept.
- **`bytesOf` and `spaceUsed` stay two.** One sums two known files synchronously
  in `playback/`, the other walks a tree asynchronously in `media/`, and the
  only thing they share is swallowing a stat that fails. A shared summer would
  be a helper with a walk flag.
- **`componentSlot.ts` stays one unit.** It is 340 lines and owns resolution,
  staging, verification-dispatch and the swap, which is exactly what the log
  said it would own: "everything hard about replacing a **Playback component**
  … lives behind this one object, so that nothing above it reasons about
  directories or errno". Splitting the swap out would put the rename
  classification on one side of a seam and the recomposition on the other.
- **The four `readBody` catches keep their one sentence.** `readBody` rejects
  both for a body that is not multipart and for a file part whose write failed,
  and all four call sites answer `400 Body must be multipart/form-data`. The
  component route follows the precedent exactly, so this is a project-wide
  characteristic rather than this initiative's debt, and it belongs with the
  routes round. Named in _Further notes_ so it is a decision and not an
  oversight.
- **Per-test `File` fixtures stay per-test.** Four suites each spell
  `new File(['MZ'], 'ffmpeg.exe')`. A shared fixture is two lines saved and a
  cross-rung import added; the shared-fetch-double and shared-listening-harness
  rounds named since round 13 are where this family of consolidation goes.
- **The fakes' unions are imported, not widened by hand.** Commit 8 types the
  route doubles' outcomes as `InstallRefusal` / `RemoveRefusal` rather than
  re-listing the reasons, which is what makes the next reason added to either
  union a compile error in the suite that has to cover it. The whole of this
  group exists because a hand-copied union silently excluded one.
- **No behaviour changes anywhere.** Groups 1–4 move one glyph's font onto the
  prototype's, add a tooltip the prototype draws, and otherwise change no pixel
  and no wire. If something looks or answers differently, that is a bug in the
  refactor.

## Testing Decisions

- A good test here asserts what the maintainer can see or what the wire answers:
  a ✕ named for what it removes, a line in the danger ink, an `Installed` row
  that was not there a moment earlier, a status and a sentence, a pair still on
  disk after a refused swap. Nothing asserts a private function, a rename call
  count, or which branch of `zoneFace` ran.
- Baseline at filing: **4597 tests across 233 files**, `node_modules/.bin/tsc -b
tsconfig.json` clean, `node_modules/.bin/eslint src server` clean (verified
  for this plan). Expected after: **234 files**, and a leaf count of 4598 plus
  whatever `zoneFace`'s own file holds — Group 3 adds three (the rollback and
  the two route `500`s; the two ENOSPC leaves are rewritten rather than added),
  and commits 11 and 12 each remove one.
- Group 1's pixel has no test, on round 14's rule that nothing reads a glyph's
  font; the check is the prototype beside the row, and the `CodecRow` and
  `CodecManager` leaves passing unchanged is the check that the button is still
  the same button.
- Group 2's new unit gets a test per face plus the refused reason carried
  through, in `importView.test.ts`'s shape — a pure function over a state, no
  render. The zone's existing leaves are the regression check: every one of them
  reads text on screen, so a mapper that changed a word fails them.
- Group 3 is the only group that adds coverage. Its leaves go beside the ones
  they complete — the install's and the remove's `failed` in
  `componentSlot.test.ts`'s existing in-use describes, the rollback in the
  component-swap describe, and the two `500`s in the route suite's
  `what the slot refuses` describes.
- Group 4 changes nothing but where a test's name sits and two folds, on the
  delete, bulk-import, export and settings rounds' precedent. The check is the
  one the last five rounds used: the verbose reporter's leaf names before and
  after, diffed — two names gone, none changed.
- Group 5 has no test; it is read.

## Out of Scope

- **The Electron shell** — `FAMILYFLIX_COMPONENT_PATH` pointing at
  `app.getPath('userData')/playback-component`, and the native dialog. Its own
  initiative; the env var with a repo-local default is the slot until then.
- **_Change…_ and _Software update_** — still the Electron shell's and the
  Snackbar system's, and still not drawn.
- **A success flash or snackbar after a swap** — ruled out for good by log 16
  Q13, not deferred: the redrawn rows are the feedback.
- **A per-row ✕ or size on codec rows** — ruled out for good by log 15 Q7 and
  log 16 Q9.
- **A zip upload, a confirm on remove, upload progress, a version string parsed
  off `ffmpeg -version`** — all ruled out in the log's _Not built_.
- **Memoising `decoders()` or `capabilities()`** — the component is asked afresh
  on purpose, so the report and the next Play cannot disagree.
- **`routes/index.ts` at 1666 lines** — the routes round, named since round 13
  and still its own.
- **The `readBody` refusal sentence** — four call sites, project-wide, with the
  routes round.
- **A shared read hook, a shared JSON-GET helper, a shared listening-API
  harness, a shared fetch double, a shared `File` fixture** — project-wide
  rounds, still not this one.
- **Any pixel but one.** The row, the zone and the pill were read against
  `feat.CodecManager.dc.html` cell by cell; commit 3 is the only change that
  moves one.

## Further Notes

Round 15 found that an `issue-loop` build does not read back, and every finding
in Groups 1, 2 and 4 is that again: #154 amended the card `PlaybackSection`
describes and never opened it; #152 built a ✕-shaped hole and #155 filled it
without looking for the atom the design log's own background section names;
each of the last three slices wrote its banner under the last one's rather than
into it. That is the same class of debt, in the same feature, one round later,
which is the argument for the refactor round surviving contact with a loop that
makes the build cheap.

Group 3 is the new thing, and the more interesting one. The `failed` refusal is
good engineering that no issue asked for: a subagent building the swap saw that
`renameSync` can fail for reasons that are neither the lock nor the pair,
decided a throw would be the one outcome the route could not answer, added a
fourth reason to both unions, mapped both to `500`, and wrote two paragraphs
explaining why. It then wrote no test for any of it, because the acceptance
criteria it was working from named three refusals. The two leaves nearest to it
assert a negative — `not in-use` — which is precisely the shape a test takes
when the author knows a path exists and has no stated expectation to assert
against it; and one of those is written so a throw passes.

The lesson for `prd-to-issues` and for `tdd`: **an issue's acceptance criteria
are a floor, and a build that adds a state must add its leaf in the same
commit.** The RED step cannot cover a state that does not exist until GREEN, so
the only place it can be caught is the build writing its own. Worth a line in
the `build` skill.

One smaller note for the same file: the route fakes hand-copied their outcome
unions instead of importing `InstallRefusal` and `RemoveRefusal`, which is what
let the fourth arm be unreachable from a route test without `tsc` saying a word.
Commit 8 imports them, and that is the durable half of this group — the next
reason added to either union will not compile in the suite until it is covered.
