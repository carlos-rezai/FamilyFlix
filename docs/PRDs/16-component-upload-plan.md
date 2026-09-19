# Plan: Playback component upload — the Component slot, the zone and the Component row

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/150

The Codec report is a screen that tells the maintainer what is wrong and gives
no way to fix it. `15-settings-hub` held back the two controls the prototype
draws on that surface — the dashed _Add a codec pack_ zone, and the per-row
size and ✕ — on the rule that a control whose mechanism does not exist is not
drawn. This initiative builds the mechanism: a writable **Component slot** that
is read ahead of `FAMILYFLIX_FFMPEG_PATH` and ahead of `PATH`, a two-file
upload verified by running it, a swap that is a directory rename, and the
**Component row** carrying the size and the remove the codec rows never had.

The slicing puts the slot's **read** half and the row it feeds first, then the
slot's **write** half on the wire, then the zone that drives it, then the
removal that undoes it:

**the prototype amended** (Phase 0) → **the slot resolves what is live, and it
has a row** (Phase 1) → **an upload changes what the next Play decides**
(Phase 2) → **the zone** (Phase 3) → **the ✕ takes it back** (Phase 4) → **docs
and the refactor filing** (Phase 5).

Every phase but the first and the last is checked by looking at the Settings
page. Phase 1 puts a _Default_ Component row under the codecs with the pair's
real size on it; Phase 2 is checked with `curl` before a pixel of the zone
exists; Phase 3 makes a drop turn that row _Uploaded_ and grow the rows above
it; Phase 4 makes the ✕ on it put the machine back.

## Four things settled in Phase 1 rather than later

- **The slot is injected, not a component.** `createPlayback(mediaPath, slot)`
  reads `slot.current()` inside `decide`, `duration` and `stream` rather than
  closing over one component at composition time. That is the whole of what
  makes a swapped component honoured by the next Play with nothing to
  invalidate, and it is a change to shipped playback code — so it lands in the
  first phase, with `fixedSlot` carrying the thirty-four existing call sites
  across on the same commit, rather than being retrofitted once the upload
  route exists and the tests have been written twice.

- **`PlaybackCapabilities.component` stops being a boolean in the first
  phase.** It becomes `PlaybackComponentInfo | null`, because the `component`
  half of that shape is the slot's answer — a source, a size and two basenames
  — and not something `capabilities` can know. `capabilities(component)`
  narrows to `CodecCapability[]`, the rows alone, so the report is assembled in
  one place. Both build targets read the change at once, which is why the row
  that draws it ships in the same phase and not a phase later.

- **`CodecRow` becomes the prototype's row 1:1 before anything can be
  removed.** The optional `onRemove` lands in Phase 1 unused, and Phase 4 hands
  it a handler. A second `ComponentRow` molecule would be two copies of one
  template; a `CodecRow` reshaped twice would be its test suite written twice.

- **Blank-until-it-lands is unchanged, and so is the summary.** Every read on
  this page is `null` until it lands and `null` still if it never does. The
  **Codec summary** counts the codec rows only — the Component row never enters
  the count — and reads `component !== null` where it read truthiness.

---

## Architectural decisions

Durable decisions that apply across all phases.

- **Routes.** Two, under the existing `/api` router, beside the capability read
  the Settings hub already has. **Nothing new is injected into
  `createApiRouter`**: both reach the slot through the `playback` the router
  already holds.

  ```
  POST   /api/playback/component   -> 200 PlaybackCapabilities
    multipart/form-data               400 { error }   not multipart · a stray part · a second of either · a missing half
    every file part named               422 { error }   not a working ffmpeg build
    `component`                         409 { error }   in use

  DELETE /api/playback/component   -> 200 PlaybackCapabilities
                                      404 { error }   nothing uploaded
                                      409 { error }   in use
  ```

  Both writes **echo the whole report** after the swap, on the echo precedent
  every write in the app keeps: the screen redraws from truth rather than
  re-fetching, and the two reads cannot disagree. A `204` on the delete was
  rejected for that reason. The `404` says the **Default component** is not
  removable, which is a fact about ownership rather than an error. Every
  refusal discards the incoming folder.

- **The filesystem.** A new `FAMILYFLIX_COMPONENT_PATH`, default
  `./playback-component`, read in `main.ts` beside the other three; the
  Electron shell will set it to `app.getPath('userData')/playback-component`.

  ```
  <FAMILYFLIX_COMPONENT_PATH>/
  ├── current/     ← the Uploaded component: ffmpeg[.exe], ffprobe[.exe]
  ├── incoming/    ← one upload in progress; cleared on create and on refusal
  └── previous/    ← the pair on its way out; cleared on create
  ```

  **The swap is a directory rename, never a file overwrite** — `current/` →
  `previous/`, `incoming/` → `current/`, `previous/` removed. A mixed pair is
  therefore impossible: either both binaries moved or neither did. When a
  conversion holds the pair the **first** rename fails with nothing moved, and
  that single failing syscall is the whole of "is the component in use?". No
  schema change: nothing about a component belongs in the library's database.

- **Key models.** One deep module and two pure units, all in `playback/`:

  - `createComponentSlot(slotDir, env, { verify, rename })` → `ComponentSlot`
    with `current()`, `info()`, `receive()` and `remove()`. **`current()` is
    resolved when the slot is created and again after every install and remove,
    never per call** — `hardwareEncoder` costs a spawn, and only those two
    writes change the fact. Outcomes are values, never throws:
    `{ ok: true } | { ok: false; reason: 'incomplete' | 'not-a-component' | 'in-use' }`
    for an install, `'nothing-uploaded' | 'in-use'` for a remove. The route maps
    reason to status; nothing above the slot reasons about errno.
  - `componentBinary(filename): 'ffmpeg' | 'ffprobe' | null` — what may be
    added, case-insensitively and `.exe` or not. This feature's security
    boundary, the way `fileKinds` is media's. The bytes are stored under the
    **platform's** own names, never the client's.
  - `verifyComponent(pair, run)` — both binaries exit `0` and open with
    `ffmpeg version` / `ffprobe version`, **before the live component is
    touched**.

  Two injected seams, both for the reason `ffmpegComponent`'s `Listing` seam
  exists — a unit that spawns or renames must be assertable on a machine that
  is not the one being described: `VersionRun` on `verifyComponent`, and
  `rename` on the slot, so the `in-use` arm can be asserted on CI and on POSIX
  where the lock cannot be reproduced.

- **Types.** `PlaybackCapabilities.component` goes from `boolean` to
  `PlaybackComponentInfo | null` —
  `{ source: ComponentSource; bytes: number; files: string[] }`, with
  `ComponentSource = 'default' | 'uploaded'` — in `src/types/playback.ts`,
  which both build targets read. `null` is a machine with no component at all.

- **Resolution order.** The slot is read **first**, ahead of
  `FAMILYFLIX_FFMPEG_PATH` and ahead of `PATH`. An upload therefore wins over
  the installer's bundled build, and a remove falls back to it. The installer's
  binary is never overwritten, which is exactly what makes falling back
  possible and the **Default component** un-removable.

- **The Upload state.** Three cases — `idle | busy(action) | refused(reason)` —
  owned by `useCapabilities` beside the report it reads, on the `useSettings`
  precedent. _Replaced_ and _removed_ are **absences** from the machine, not
  entries in it: both writes echo the report and the screen redraws from it. No
  success flash, no snackbar. **Neither write rejects**, so the organism draws
  a refusal from state and never from a caught exception.

---

## Phase 0: The prototype amended

**User stories**: 50

### What to build

The prototype is the spec, so it is amended before anything is built — the
Component row into the container's model, and the zone's busy and refused faces
onto the CodecManager screen, so the three faces this initiative designed live
on the prototype the way the player's buffering and unavailable notices do.

In `FamilyFlix.dc.html`, the `codecs` model gains the Component row as its
**last** entry — the name _Playback component_, the two binaries' basenames as
the chips, a size, and a `source` of `'default'` or `'uploaded'` — drawn
_Default_ in the prototype's built-in colouring or _Uploaded_ in its installed
one, with the ✕ only when uploaded. `uploadCodec()` flips it to uploaded and
`removeCodec` on it flips it back. The canned codec rows the simulation appends
stay the simulation's, and the codec rows' size stays `—`.

In `feat.CodecManager.dc.html`, the zone reads `cdc.zoneTitle` and
`cdc.zoneLine` instead of literals, with `cdc.zoneBusy` (no hover, no pointer)
and `cdc.zoneRefused` (the line in `--color-danger`). Idle copy unchanged.

### Acceptance criteria

- [ ] The prototype's codec list ends with a Component row carrying two mono
      chips, a size and a _Default_ pill, and no ✕
- [ ] Simulating an upload flips that row to _Uploaded_ and gives it a ✕;
      removing flips it back
- [ ] The codec rows still show `—` in the size cell and the 32px spacer where
      a ✕ would sit
- [ ] The zone's title and line come from model values, with a busy face
      (no hover, no pointer) and a refused face drawing the line in
      `--color-danger`
- [ ] Geometry unchanged in both files — the same grid, spacing and tokens as
      before the amendment

---

## Phase 1: The slot resolves what is live, and it has a row

**User stories**: 4, 5, 8, 9, 13, 14, 29, 30, 31, 36, 37, 38, 43, 45, 47

### What to build

The tracer bullet: the component the player uses stops being a value resolved
once at startup and becomes **whatever the slot says is live at the moment of
the call**, and the screen grows the one row that has a size and a source.

`createComponentSlot(slotDir, env, …)` answers `current()` — the pair in
`current/` composed through `ffmpegComponent`, else `ffmpegBinary(env)`'s, else
`null` — and `info()`, the source, the pair's summed bytes and their basenames.
A leftover `incoming/` or `previous/` from a crashed run is cleared when the
slot is created. `ffmpegBinary` exports `pairIn` so the slot finds the pair by
the same rule the resolver uses.

`capabilities(component)` narrows to the rows alone;
`Playback.capabilities()` answers `{ component: slot.info(), codecs }`.
`createPlayback(mediaPath, slot)` reads `slot.current()` inside `decide`,
`duration` and `stream`. `fixedSlot(component)` lands in
`server/src/test-support/` and carries the thirty-four existing call sites
across four test files and `main.ts`. `main.ts` reads
`FAMILYFLIX_COMPONENT_PATH`, composes the slot over it and `process.env`, and
hands it where it handed a component — `ffmpegBinary` and `ffmpegComponent` are
now called **by the slot**.

On the screen, `CodecRowModel` reshapes to
`{ key, name, chips, size, status, removable }` with the four pill words,
`componentRow(report)` answers the Component row or `null`, `CodecRow` becomes
the prototype's row 1:1 taking an optional `onRemove` (nothing passes one yet),
and `CodecManager` draws the Component row **last**.

### Acceptance criteria

- [ ] `GET /api/playback/capabilities` answers
      `{ component: { source, bytes, files } | null, codecs }`, and the
      Settings page draws a Component row last, named _Playback component_,
      with the two basenames as chips and the pair's size through `formatBytes`
- [ ] That row reads **Default** on a machine resolving ffmpeg from
      `FAMILYFLIX_FFMPEG_PATH` or `PATH`, and carries the 32px spacer, no ✕
- [ ] A machine with no FFmpeg at all draws the native rows, **no Component
      row**, and a summary ending _no playback component_
- [ ] No codec row has a size or a ✕ — every one still shows `—` and the spacer
- [ ] The **Codec summary** counts the codec rows only; the Component row never
      enters the count
- [ ] Nothing is drawn while the report is `null`, and nothing still on a
      refused read
- [ ] A slot whose `current/` holds a pair resolves that pair ahead of
      `FAMILYFLIX_FFMPEG_PATH` and ahead of `PATH`
- [ ] `current()` is resolved once and not per call — a second `current()` does
      not re-read the machine's hardware encoder
- [ ] `read`, `duration` and `stream` decide over `slot.current()` **at the
      time of the call**: a slot whose component changes between two calls
      answers `cannot-play` then `converted` for the same file
- [ ] Every existing playback, route and importer test passes through
      `fixedSlot`, whose own contract — answers one component, refuses to
      receive or remove — is asserted once
- [ ] `createApiRouter`'s signature is unchanged
- [ ] `FAMILYFLIX_COMPONENT_PATH` is read in `main.ts` with `./playback-component`
      as its default

---

## Phase 2: An upload changes what the next Play decides

**User stories**: 18, 19, 20, 21, 22, 23, 24, 25, 27, 28, 33, 40, 41, 42, 44

### What to build

The slot's write half and the route over it — the whole of the hard part,
checked with `curl` before a pixel of the zone exists.

`componentBinary(filename)` says what may be added. `verifyComponent(pair, run)`
runs both binaries and requires both to exit `0` with the right banner.
`receive()` answers an `IncomingComponent` over an emptied `incoming/`, whose
`take(binary, bytes)` pipes one part to the platform's name for it (`0o755` on
POSIX), whose `install()` verifies and swaps or says why not, and whose
`discard()` removes the folder. The swap is the three renames; a first rename
failing with `EBUSY`, `EPERM` or `EACCES` is classified `in-use` inside the
slot, with **nothing moved**.

`POST /api/playback/component` reads the body through the existing `readBody`,
with every file part named `component` and told apart by `componentBinary` —
every part consumed, handled or not, on the `Media.storeUpload` precedent. A
stray part, a second of either, or a body that closed with only one half is a
`400`; a pair that will not run is `422`; a locked slot is `409`. Every refusal
discards `incoming/`. Success re-resolves `current()` and answers the whole
report.

### Acceptance criteria

- [ ] `curl -F component=@ffmpeg.exe -F component=@ffprobe.exe` answers `200`
      with the full report, and the rows in it include what the new component
      decodes
- [ ] The next `read`/`stream` decides over the new component with no restart
      and nothing cached to clear, and a newly-derived runtime uses it too
- [ ] A file the upload called `ffmpeg-7.1.exe` is stored as the platform's own
      `ffmpeg[.exe]` and resolves as a component afterwards
- [ ] One half alone → `400`, _ffmpeg and ffprobe go together — add both._
- [ ] An unrelated file, a `.dll`, or a second of either → `400`, _Only ffmpeg
      and ffprobe can be added._
- [ ] A body that is not multipart → `400`
- [ ] A pair that will not run — wrong platform, a renamed text file, a
      non-zero exit, a banner that is not the right word, a binary that will not
      start at all → `422`, _That isn't a working ffmpeg build._, **with the
      live component untouched**
- [ ] A first rename throwing `EBUSY` → `409`, _The playback component is in
      use. Stop the film that's playing and try again._, with nothing moved,
      `incoming/` discarded and `current()` still the old component; the same
      for `EPERM` and `EACCES`, and an unrelated errno is not `in-use`
- [ ] Every refusal leaves `incoming/` gone, so a retry is a fresh attempt
- [ ] A leftover `incoming/` or `previous/` from a crash is cleared when the
      slot is created and does not block the next upload
- [ ] Uploading the same pair twice simply replaces the live one
- [ ] `verifyComponent` and the slot's rename are both assertable with no
      FFmpeg on the machine and no lock to reproduce

---

## Phase 3: The zone

**User stories**: 1, 2, 3, 6, 7, 15, 16, 17, 32, 34, 35, 46, 48, 49

### What to build

The prototype's dashed zone, wired to the route Phase 2 built — the first thing
the maintainer can actually use.

`src/styles/visuallyHidden.ts` lifts the clipping rule `FilePicker.styles.ts`
spells inline (clipping rather than `display: none`, so the input stays in the
accessibility tree and reachable from a keyboard).
`primitives/Icon/UploadIcon.tsx` draws the prototype's arrow-over-bar on
`IconBase`. `ComponentDropZone` in `features/settings/` is a `<label>` over a
visually hidden `<input type="file" multiple>`, with `dragover`/`drop` on the
label taking `dataTransfer.files` and drag-over drawn as the prototype's own
hover. Three faces: **idle** as drawn, **busy** reading _Adding the playback
component…_ over _Copying it in and checking it runs_ with the input disabled,
and **refused** keeping the title and putting the reason in the danger ink.

`installComponent(files)` posts one `component` part per file and rejects
`400`, `409` and `422` with a `ComponentRefusedError` carrying the server's own
`error`, on the `ImportRefusedError` precedent; anything else rejects plainly
and the hook substitutes _Couldn't add the playback component._
`useCapabilities` grows `{ capabilities, upload, installComponent }`.
`CodecManager` composes the zone under the rows.

The zone's title stays _Add a codec pack_ and the Codecs lede stays _add a pack
only if a movie won't play_: "pack" is the family's word for what they drop.

### Acceptance criteria

- [ ] Dropping an ffmpeg and an ffprobe on the zone in one gesture installs
      them, and the _Installed_ rows appear without a reload
- [ ] Clicking the zone opens the browser's file dialog and picking both
      binaries does the same
- [ ] The zone takes keyboard focus and Enter or Space opens the dialog
- [ ] The **Codec summary** recounts itself after the upload, so the line and
      the rows below it never disagree
- [ ] The Component row's pill flips to **Uploaded** from the echoed report,
      with no re-fetch and no success flash
- [ ] While the copy and the check run the zone reads _Adding the playback
      component…_ over _Copying it in and checking it runs_, the input is
      disabled, and a second drop or pick reports nothing
- [ ] A refusal draws the server's own reason on the second line in the danger
      ink, keeps the title, leaves the rows as they were, and stays until the
      next attempt replaces it
- [ ] A `500` or an unreadable body draws _Couldn't add the playback
      component._ rather than nothing
- [ ] A cancelled dialog and an empty drop do nothing at all
- [ ] Dragging over the zone draws the prototype's hover and dragging out
      removes it
- [ ] Leaving the Settings page mid-upload breaks nothing — the answer redraws
      nothing
- [ ] `installComponent` does not reject out of the hook: the zone draws the
      refusal from state

---

## Phase 4: The ✕ takes it back

**User stories**: 10, 11, 12, 26

### What to build

The other half of the Component row: the ✕ the prototype draws on an uploaded
pack, and the fall-back under it.

The slot's `remove()` takes the uploaded pair out and resolves the default
again, answering `ok`, `nothing-uploaded` or `in-use`.
`DELETE /api/playback/component` maps those to `200` with the fallen-back
report, `404` and `409`, and echoes the same shape the capability read answers.
`removeComponent()` on the wire rejects the three the same way
`installComponent` does; the hook gains it with `busy('remove')` and the zone's
removing copy — _Removing the playback component…_ over _The formats it added
go with it_. `CodecManager` passes `onRemove` to the Component row exactly when
the report says the component is removable.

No confirmation dialog: the action is reversible by a drop, the files are the
maintainer's own download, and the default comes back underneath.

### Acceptance criteria

- [ ] An uploaded Component row carries a ✕ whose accessible name says what it
      removes; a **Default** row carries the 32px spacer and no ✕
- [ ] Pressing it removes immediately, with no confirmation dialog
- [ ] The rows the component added disappear, the summary recounts, and the
      Component row's pill reads **Default** again — all from the echoed report
- [ ] Removing on a machine whose only component was the upload leaves the
      native rows and a Component row reading **Default**, or no row at all when
      there is no default either
- [ ] A removal attempted while a film is converting → `409` and the same in-use
      line the upload gives, with the pair still live
- [ ] A slot with nothing uploaded → `404`, _Default component is not
      removable_ in substance: the row that offers no ✕ and the route that
      refuses agree
- [ ] The zone reads the removing copy while the write is in flight and ignores
      a second press
- [ ] `removeComponent` does not reject out of the hook

---

## Phase 5: Docs and the refactor filing

**User stories**: none directly — the initiative's close, as #148 was for the
Settings hub and #135 for bulk import.

### What to build

`docs/handoff/COMPONENT-SPEC.md`'s `CodecManager` and `CodecRow` rows and its
Icons table; the **Playback component upload** section of
`docs/ubiquitous-language.md` checked against what actually shipped; CLAUDE.md's
folder map (the three new `playback/` units, `test-support/fixedSlot/`, the new
settings units, `src/styles/visuallyHidden.ts`) and its env section
(`FAMILYFLIX_COMPONENT_PATH`); README's tree; the dev journal paragraph. Then
`request-refactor-plan` over the round.

**The feature table's _Codec manager — add a playback component_ row is ticked
✅ when the refactor closes, not here.**

### Acceptance criteria

- [ ] COMPONENT-SPEC describes `CodecRow`'s `{ row, onRemove? }` and
      `CodecManager`'s zone, and lists `UploadIcon`
- [ ] The glossary's Playback component upload section names the **Component
      slot**, the **Uploaded** and **Default component**, the **Component row**,
      the **Component binary** and the **Upload state**, checked against the code
- [ ] CLAUDE.md's folder map and env section, and README's tree, match what
      shipped
- [ ] The dev journal carries the round's paragraph
- [ ] A refactor issue is filed by `request-refactor-plan`, and the feature
      table's tick waits for it
