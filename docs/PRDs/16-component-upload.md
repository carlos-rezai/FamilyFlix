## Problem Statement

I am the maintainer of this library, and the **Codec report** is a screen that
tells me what is wrong and gives me no way to fix it.

The Playback group's codec list is true: it reads
`GET /api/playback/capabilities` off the one **Playback component** `main.ts`
composed, so what it says and what pressing Play does cannot disagree. A family
member asks "will this one play?" and the answer is on the screen. But the
prototype draws two more things on that surface, and `15-settings-hub` held
both back on the rule that a control whose mechanism does not exist is not
drawn:

- the dashed **_Add a codec pack_** zone under the rows, with its accent arrow
  and the line _Drop a playback component (`ffmpeg`) here, or browse_; and
- the per-row size and ✕ — a `—` in the size cell of every row today, and a
  32px spacer where the ✕ would sit.

So when a film will not play, the screen says so honestly and then stops. The
only remedy the app actually has is one I have to perform outside it: set
`FAMILYFLIX_FFMPEG_PATH` to a better FFmpeg build and restart the server, or
re-run an installer. The component is resolved **once, at startup, from a place
the packaged app cannot write to** — the installer's directory is read-only and
is replaced wholesale on update. There is nothing in the app that can put a
component somewhere, and nothing that can take one back out.

The size cell and the ✕ are the same problem read from the other end. Log 15
established the honest reason no codec row has either: there is **one pack**,
and every _Installed_ row comes and goes with it. A ✕ on the HEVC row that
silently removed AV1, AC-3 and everything else would be a lie about what the
row is. But the thing that genuinely does have a size, and genuinely can be
removed, is right there and has no row at all — so the prototype's two idle
props stay idle and the geometry stays a promise.

And the hard part is not the upload. It is that a component can be replaced
while the app is running, and the app may be converting a film with the pair
being replaced. On Windows a running executable cannot be overwritten and the
directory holding it cannot be renamed. A screen that answered "done" and left
a mixed pair of binaries behind — a new ffmpeg beside an old ffprobe — would
break playback in a way nothing on the screen could explain.

## Solution

The prototype's zone and row geometry wired to a real **Playback component
upload**: a writable **Component slot**, a two-file upload verified by running
it, a swap that is a directory rename, and the **Component row** carrying the
size and the remove the codec rows never had.

**Where a component lives.** A new `FAMILYFLIX_COMPONENT_PATH` — the **Component
slot**'s directory, defaulting to `./playback-component`, which the Electron
shell will set to `app.getPath('userData')/playback-component` the way it will
set the other two paths. The **Uploaded component** is the pair at
`<slot>/current/`, and **the slot is read first** — ahead of
`FAMILYFLIX_FFMPEG_PATH` and ahead of `PATH`. An upload therefore wins over the
installer's bundled build, and a remove falls back to it. The installer's binary
is never overwritten, which is exactly what makes falling back possible and what
makes the **Default component** un-removable: it is not mine to take away.

**What arrives, and how.** The zone's hidden input takes `multiple`, so both
binaries travel in one drop or one pick, under the one field name `component`.
The server tells them apart **by filename**: a pure `componentBinary(filename)`
answers `'ffmpeg'`, `'ffprobe'` or `null`, case-insensitively, `.exe` or not.
The client sorts nothing. A stray part, a second of either, or a body carrying
only one half is refused as a whole — `ffmpegBinary`'s own rule is that half a
component is not a component, and a conversion path chosen without a probe is a
guess. The bytes are stored under the **platform's** own names, never the
client's.

**Validated by running it.** `verifyComponent(pair)` runs `ffmpeg -version` and
`ffprobe -version` and requires both to exit `0` with stdout opening
`ffmpeg version` / `ffprobe version`. A `.dll` dropped by a parent who read the
prototype's older copy, a text file renamed `ffmpeg.exe`, a macOS build on a
Windows machine — all fail the same way, **before the live component is
touched**. This is the same trust `FAMILYFLIX_FFMPEG_PATH` already extends: the
route runs what the maintainer dropped, on the maintainer's own machine, over
localhost, and no wider.

**The swap is a directory rename, never a file overwrite.** `current/` →
`previous/`, `incoming/` → `current/`, `previous/` removed. When a conversion
holds the pair, the **first** rename fails with nothing moved, and the outcome
is **`in-use`**: `409`, and the zone says to stop the film that is playing. A
refusal rather than a kill — the family's movie night is not ended by my drop,
and in a one-window app the player is unmounted (its conversion killed) before
Settings is even on screen. A leftover `incoming/` or `previous/` from a crash
is cleared when the slot is created.

**How playback sees the new one.** `createPlayback(mediaPath, slot)` takes the
slot where it took a component and reads `slot.current()` inside `decide`,
`duration` and `stream`. The per-request decision the code already makes is now
made over a component that can change between requests, so the next Play after a
swap decides over the new component with **nothing cached to clear**.
`Playback.capabilities()` becomes
`{ component: slot.info(), codecs: capabilities(slot.current()) }`. Nothing new
is injected into `createApiRouter` — the route layer still never learns there is
an FFmpeg.

**The Component row.** The prototype's row template drawn once more, **last**,
for the one thing on the screen with a size and a remove: the microchip tile,
the name _Playback component_, the two binaries' basenames as the mono chips
(`ffmpeg.exe` `ffprobe.exe`), the pair's bytes through `formatBytes`
(`94.3 MB`), a **Status pill** reading **Default** in the prototype's built-in
colouring or **Uploaded** in its installed one, and — exactly the prototype's
own rule for which rows get a ✕ — `RemoveButton` on an uploaded component, the
32px spacer on a default one. No component, no row. The codec rows keep their
`—` and their spacer: log 15 Q7 stands, and this is the geometry it deferred to.
`CodecRow` becomes the prototype's row 1:1 rather than gaining a sibling
molecule.

**The zone, in three faces.** `ComponentDropZone` in `features/settings/`: a
`<label>` over a visually hidden `<input type="file" multiple>`, with
`dragover`/`drop` on the label taking `dataTransfer.files` and drag-over drawn
as the prototype's own hover. **idle** is the prototype as drawn. **busy** reads
_Adding the playback component…_ over _Copying it in and checking it runs_ (or
_Removing the playback component…_ over _The formats it added go with it_), with
the input disabled and no hover. **refused** keeps the title and puts **the
reason in the danger ink** on the second line — the Setup step's danger line in
the zone's 12.5px slot — and stays until the next attempt replaces it. The
reason is **the server's own `error`** on `400`, `409` and `422`, carried by a
`ComponentRefusedError` on the `ImportRefusedError` precedent, with a fixed line
for anything else so a `500` is not silence.

**Replaced and removed are not faces.** Both routes echo the report after the
swap, and the screen redraws from it: rows appear or go, the Component row's
pill flips, its ✕ appears or gives way to the spacer. No success flash, no
snackbar — the Snackbar system is its own initiative, and `codecJustAdded` is in
the simulation's model and drawn by nothing.

**The words stay the family's.** The zone's title is still _Add a codec pack_
and the Codecs lede still reads _add a pack only if a movie won't play_. "Pack"
is the family's word for what they drop; the code, the wire, the glossary and
the row all say **Playback component**.

## User Stories

1. As the maintainer, I want to drop an ffmpeg and an ffprobe onto the Settings
   page in one gesture, so that a film that would not play starts playing
   without me editing an environment variable and restarting the server.
2. As the maintainer, I want to click the dashed zone and pick both binaries in
   a file dialog, so that the control works for me when dragging is awkward.
3. As the maintainer, I want to keyboard-focus the zone and open the dialog with
   Enter or Space, so that the one control that adds a component is not
   mouse-only.
4. As the maintainer, I want the uploaded component to take precedence over the
   installer's bundled build, so that dropping a better build actually changes
   what happens when the family presses Play.
5. As the maintainer, I want the installer's build left where it is, so that
   removing my upload puts the app back to how it shipped rather than to
   nothing.
6. As the maintainer, I want the new **Installed** rows to appear the moment the
   upload finishes, so that I can see the formats I just enabled without
   reloading the page.
7. As the maintainer, I want the **Codec summary** above the rows to recount
   itself after an upload, so that the line and the rows below it never
   disagree.
8. As the maintainer, I want a **Component row** at the bottom of the list
   showing the two file names, the pair's total size and where it came from, so
   that the one thing on the screen that has a size and a remove has a row.
9. As the maintainer, I want that row to read **Default** when the component is
   the installer's or the dev machine's `PATH` build, so that I can tell at a
   glance whether what is live is mine.
10. As the maintainer, I want that row to read **Uploaded** and carry a ✕ once I
    have dropped a component, so that the row that says it is mine is the row
    that lets me take it back.
11. As the maintainer, I want the ✕ to remove immediately with no confirmation
    dialog, so that a reversible action over my own download does not cost me a
    modal.
12. As the maintainer, I want the removal to fall back to the default component
    and redraw the rows, so that I see what the app can do without my upload.
13. As the maintainer, I want the ✕ absent from a **Default** row, so that I am
    never offered a removal the app cannot honour.
14. As the maintainer, I want no ✕ and no size on any codec row, so that I am
    never invited to remove HEVC and silently lose AV1 and AC-3 with it.
15. As the maintainer, I want the zone to tell me it is working while the copy
    and the check run, so that a multi-second upload does not look like a dead
    control.
16. As the maintainer, I want the zone to refuse a second drop while it is busy,
    so that two uploads cannot race into the same slot.
17. As the maintainer, I want a refusal explained in the zone in the danger ink,
    so that I learn what was wrong instead of watching nothing happen.
18. As the maintainer, I want dropping one binary alone refused with _ffmpeg and
    ffprobe go together — add both._, so that I am told what is missing rather
    than left with half a component.
19. As the maintainer, I want dropping an unrelated file refused with _Only
    ffmpeg and ffprobe can be added._, so that a poster or a `.dll` is named as
    the wrong thing.
20. As a parent who read an older copy of the screen and dropped a `.dll`, I
    want to be told it is not a component, so that the app does not quietly do
    nothing at all.
21. As the maintainer, I want a pair that will not run refused with _That isn't
    a working ffmpeg build._ before anything is swapped, so that a
    wrong-platform or corrupt download cannot take working playback away from
    me.
22. As the maintainer, I want the refusal to leave the live component exactly as
    it was, so that a failed upload costs me nothing.
23. As the maintainer, I want an upload attempted while a film is converting
    refused with _The playback component is in use. Stop the film that's playing
    and try again._, so that I know the remedy is to stop the film rather than
    to try harder.
24. As a family member watching a film, I want the maintainer's upload to be
    refused rather than to kill my playback, so that movie night is not ended by
    somebody else's housekeeping.
25. As the maintainer, I want an in-use refusal to leave both the old component
    and my incoming files in a clean state, so that retrying after the film ends
    is a fresh attempt and not a repair.
26. As the maintainer, I want a removal attempted while a film is converting
    refused the same way, so that the two writes behave alike.
27. As the maintainer, I want the app to tolerate a crash mid-upload, so that a
    leftover staging folder does not block the next attempt or half-replace the
    live pair.
28. As the maintainer, I want an upload stored under the platform's own binary
    names, so that a file I happened to call `ffmpeg-7.1.exe` still resolves as
    a component afterwards.
29. As the maintainer, I want the next film I play after a swap decided over the
    new component, so that I do not have to restart the app for the upload to
    take effect.
30. As the maintainer, I want the runtime a newly-added film derives to use the
    new component too, so that the whole app agrees about what is installed.
31. As the maintainer, I want the Codecs area blank until the report lands, so
    that the screen never shows a half-true report — the rule every read on this
    page keeps.
32. As the maintainer, I want an empty drop or a cancelled dialog to do nothing
    at all, so that closing a dialog is not an action.
33. As the maintainer, I want a drop of the same pair twice to simply replace the
    live one, so that re-dropping after a doubt is harmless.
34. As the maintainer, I want to leave the Settings page while an upload is in
    flight without the app breaking, so that an answer landing after the screen
    has gone is simply discarded.
35. As the maintainer, I want the zone's drag-over state drawn as the prototype's
    hover, so that the surface tells me it will accept what I am holding.
36. As the maintainer on a machine with no FFmpeg at all, I want the report to
    show the native rows, no Component row and the zone ready, so that the screen
    says exactly what is true and what I can do about it.
37. As the maintainer, I want _no playback component_ in the summary line on that
    machine, so that the line and the missing row say the same thing.
38. As a developer, I want the component slot injected into `createPlayback`
    rather than a component, so that every playback decision is made over
    whatever is live at that moment with nothing to invalidate.
39. As a developer, I want no new argument on `createApiRouter`, so that the
    route layer still never learns there is an FFmpeg.
40. As a developer, I want `componentBinary` and `verifyComponent` to be their
    own units, so that "what may be added" and "what counts as working" are each
    testable without a filesystem or a binary.
41. As a developer, I want `verifyComponent` to take the version run as an
    injected seam, so that its rule can be asserted on a machine that has no
    FFmpeg on it.
42. As a developer, I want the slot's directory moves behind an injected
    operation, so that the `in-use` arm can be asserted on CI and on POSIX where
    the lock cannot be reproduced.
43. As a developer, I want a `fixedSlot` test double in
    `server/src/test-support/`, so that the thirty-odd existing `createPlayback`
    call sites migrate to one named thing rather than to an object literal
    repeated thirty times.
44. As a developer, I want both component routes to echo the full report, so that
    the screen never re-fetches to learn what it just did and the two reads
    cannot disagree.
45. As a developer, I want `capabilities(component)` to answer the rows alone, so
    that the shape of `PlaybackCapabilities` is assembled in one place rather
    than in two.
46. As a developer, I want the visually-hidden clipping rule written down once in
    `src/styles/`, so that `FilePicker` and the zone do not each spell out seven
    properties for the same trick.
47. As a developer, I want `CodecRow` to be the prototype's row 1:1 with an
    optional `onRemove`, so that the component's row is the same template rather
    than a second copy of it.
48. As a developer, I want the read and both writes of the report in one hook, so
    that the state the writes echo is the state the read holds — the
    `useSettings` precedent.
49. As a developer, I want neither write to reject, so that the organism draws a
    refusal from state and never from a caught exception.
50. As the maintainer, I want the prototype amended with the Component row and
    the zone's busy and refused faces before any of this is built, so that the
    prototype stays the spec rather than becoming a document the code has
    outgrown.

## Implementation Decisions

### The slot is the deep module

Everything hard about this feature — resolution order, staging, verification,
the rename swap, the Windows lock, the fall-back — lives behind one object with
four members. `createComponentSlot(slotDir, env, { verify, rename })` answers a
`ComponentSlot`:

- `current(): PlaybackComponent | null` — the live component: the pair at
  `<slot>/current/` composed through `ffmpegComponent`, else
  `ffmpegBinary(env)`'s, else `null`. **Resolved when the slot is created and
  again after every install and remove, never per call** — `hardwareEncoder`
  costs a spawn, and a component is a fact about the machine that only these two
  writes change.
- `info(): PlaybackComponentInfo | null` — `{ source, bytes, files }`:
  `'uploaded'` or `'default'`, the pair's two files' bytes summed, their
  basenames.
- `receive(): IncomingComponent` — an upload begun: an emptied
  `<slot>/incoming/`. `take(binary, bytes)` pipes one part to the platform's
  name for it (`0o755` on POSIX); `install()` verifies and swaps or says why not;
  `discard()` removes the folder.
- `remove(): RemoveOutcome` — the uploaded pair taken out, the default resolved
  again.

Outcomes are values, never throws: `{ ok: true }` or
`{ ok: false; reason: 'incomplete' | 'not-a-component' | 'in-use' }` for an
install, and `'nothing-uploaded' | 'in-use'` for a remove. The route maps reason
to status; nothing above the slot reasons about errno.

The directory:

```
<FAMILYFLIX_COMPONENT_PATH>/
├── current/     ← the Uploaded component: ffmpeg[.exe], ffprobe[.exe]
├── incoming/    ← one upload in progress; cleared on create and on refusal
└── previous/    ← the pair on its way out; cleared on create
```

### Two injected seams

Both amend the design log's third argument from a bare `verify` into a small
options bag, and both exist for the reason the `Listing` seam exists in
`ffmpegComponent`: a unit that spawns or renames must be assertable on a machine
that is not the one being described.

- **`verifyComponent(pair, run = spawnVersion)`** where
  `VersionRun = (binary: string) => { code: number; stdout: string } | null`.
  The rule — both exit `0`, both open with the right word — is asserted over
  canned output. `null` is every way of not starting at all.
- **`createComponentSlot(slotDir, env, { verify, rename })`** where `rename`
  defaults to the synchronous directory rename. A test makes the first rename
  throw `EBUSY` and asserts that nothing moved, `incoming/` was discarded, the
  outcome was `in-use`, and `current()` is still the old component. A pure
  classification of which errno codes mean "locked" (`EBUSY`, `EPERM`,
  `EACCES`) sits inside the slot.

### The environment

`FAMILYFLIX_COMPONENT_PATH`, default `./playback-component`, read in `main.ts`
alongside the other three and documented in CLAUDE.md's env section. Electron
main will set it to `app.getPath('userData')/playback-component`. `main.ts`
composes the slot over that path and `process.env` and hands it to
`createPlayback` where it handed a component; `ffmpegBinary` and
`ffmpegComponent` are called **by the slot**, not by `main.ts`.

### Modules built or changed — server

- **`playback/componentBinary/`** (new, pure) —
  `componentBinary(filename): 'ffmpeg' | 'ffprobe' | null`. This feature's
  security boundary, the way `fileKinds` is for media.
- **`playback/verifyComponent/`** (new) — the seam above; the only test applied
  before a swap.
- **`playback/componentSlot/`** (new) — the deep module above.
- **`playback/ffmpegBinary/`** — `pairIn(directory)` exported so the slot finds
  the pair in `current/` by the same rule the resolver uses. Otherwise
  untouched.
- **`playback/capabilities/`** — `capabilities(component): CodecCapability[]`,
  the rows alone. It no longer builds `PlaybackCapabilities`, because the
  `component` half of that shape is now the slot's answer and not a boolean this
  function can know.
- **`playback/createPlayback/`** — `createPlayback(mediaPath, slot)`, reading
  `slot.current()` inside `decide`, `duration` and `stream`. `Playback` gains
  `receiveComponent(): IncomingComponent` and `removeComponent(): RemoveOutcome`,
  thin over the slot, and `capabilities()` returns
  `{ component: slot.info(), codecs: capabilities(slot.current()) }`.
- **`test-support/fixedSlot/`** (new) — `fixedSlot(component)`: a slot that
  answers one component, an `info()` for it, and refuses to receive or remove.
  The thirty-odd `createPlayback(dir, component)` call sites across four test
  files become `createPlayback(dir, fixedSlot(component))`. Mechanical, and the
  widest edit the initiative makes.
- **`main.ts`** — the new path, the slot, `createPlayback(MEDIA_PATH, slot)`.

### The wire

```
POST   /api/playback/component   → 200 PlaybackCapabilities
                                   400 { error }   not multipart · a stray part · a missing half
                                   422 { error }   not-a-component
                                   409 { error }   in-use
DELETE /api/playback/component   → 200 PlaybackCapabilities
                                   404 { error }   nothing-uploaded
                                   409 { error }   in-use
```

`POST` is `multipart/form-data` read through the existing `readBody`, with every
file part named `component` and told apart by `componentBinary(filename)` — the
`Media.storeUpload` precedent for a part piped to disk, and the same "every part
is consumed, handled or not" guarantee. A part that is not a **Component
binary** is a `400`; so is a second of either, and so is a body that closed with
only one of the two. **Every refusal discards the incoming folder.** Both routes
answer the report after the write on the echo precedent every write in the app
keeps — a `204` on the delete was rejected, because the screen needs the report
after the fall-back and a second GET is a second chance to disagree with the
swap. The `404` on delete says the **Default component** is not removable, which
is a fact about ownership rather than an error.

Nothing new is injected into `createApiRouter`: the routes reach the slot
through `playback.receiveComponent()` and `playback.removeComponent()`.

### Types

`PlaybackCapabilities.component` goes from `boolean` to
`PlaybackComponentInfo | null` —
`{ source: 'default' | 'uploaded'; bytes: number; files: string[] }` — with a
new `ComponentSource`. `codecSummary` reads `!== null` where it read
truthiness. `null` is a machine with no component at all.

### Modules built or changed — frontend

- **`src/styles/visuallyHidden.ts`** (new) — the clipping rule
  `FilePicker.styles.ts` currently spells inline, lifted so both spell it once.
  Clipping rather than `display: none`, because the input must stay in the
  accessibility tree and reachable from a keyboard.
- **`primitives/Icon/UploadIcon.tsx`** (new) — the prototype's arrow-over-bar on
  `IconBase`, stroke 1.8, `currentColor`, coloured accent by the zone.
- **`features/settings/codecView/`** — `CodecRowModel` reshapes to
  `{ key, name, chips, size, status, removable }` with
  `status: 'built-in' | 'installed' | 'default' | 'uploaded'` — the four pill
  words in the prototype's two colourings. New
  `componentRow(report): CodecRowModel | null`. `codecRows` and `codecSummary`
  are unchanged in meaning: **the summary counts formats, not the row about the
  component.**
- **`features/settings/CodecRow/`** — the prototype's row 1:1, taking
  `{ row, onRemove? }` and drawing `RemoveButton` exactly when a handler is
  given, the 32px spacer otherwise. One molecule, not two: a second
  `ComponentRow` would be two copies of one template.
- **`features/settings/ComponentDropZone/`** (new) — the zone and its three
  faces, `{ upload, onFiles }`. A feature molecule on `ProblemRow`'s precedent
  rather than a primitive: one caller, and `FilePicker`'s 42px single-line box is
  a different surface that should not be generalised into this one.
- **`features/settings/useCapabilities/`** — grows to
  `{ capabilities, upload, installComponent(files), removeComponent() }` on the
  `useSettings` precedent. `upload` is the **Upload state**:
  `idle | busy(action) | refused(reason)`. A call while busy is ignored; an
  answer landing after unmount redraws nothing; **neither write rejects**.
- **`features/settings/CodecManager/`** — the summary, the codec rows, the
  Component row last, the zone under them.
- **`features/settings/api/`** — `installComponent(files)` and
  `removeComponent()` beside the three calls already there (this feature keeps
  one `api.ts` rather than one folder per call), plus `ComponentRefusedError`
  carrying the server's `error` on `400`, `409` and `422`. Anything else rejects
  plainly, and the hook substitutes a fixed line — _Couldn't add the playback
  component._ / _Couldn't remove the playback component._ — so a `500` is not
  silence either.

### Prototype amendments — made first, then built

1. **`FamilyFlix.dc.html`** — the `codecs` model gains the Component row as its
   last entry (`name: 'Playback component'`,
   `exts: ['ffmpeg.exe', 'ffprobe.exe']`, `size: '94.3 MB'`, a `source` of
   `'default'` / `'uploaded'`), drawn _Default_ in the built-in colouring or
   _Uploaded_ in the installed one, with the ✕ only when uploaded.
   `uploadCodec()` flips it to uploaded; `removeCodec` on it flips it back. The
   canned codec rows the simulation appends stay the simulation's, and the codec
   rows' `size` stays `—`. Geometry unchanged.
2. **`feat.CodecManager.dc.html`** — the zone reads `cdc.zoneTitle` and
   `cdc.zoneLine` instead of literals, with `cdc.zoneBusy` (no hover, no
   pointer) and `cdc.zoneRefused` (the line in `--color-danger`), so the busy and
   refused faces are on the prototype the way the player's buffering and
   unavailable states are. Idle copy unchanged. Geometry unchanged.

### Phasing

1. **The slot, end to end on the server.** `componentBinary`, `verifyComponent`,
   `createComponentSlot`, `fixedSlot`, `PlaybackComponentInfo` and the type
   change, `capabilities` answering rows alone, `createPlayback(mediaPath, slot)`,
   the call-site migration, `main.ts` and the env docs, and the two routes. The
   thinnest slice that makes
   `curl -F component=@ffmpeg.exe -F component=@ffprobe.exe` change what the next
   capabilities read answers.
2. **The zone.** `visuallyHidden`, `UploadIcon`, `ComponentDropZone` with its
   three faces and drag-over, `ComponentRefusedError` and `installComponent`, the
   hook's `upload` and `installComponent`, `CodecManager` composing the zone
   under the rows. The first thing visible: drop the pair, watch _Installed_ rows
   appear.
3. **The Component row and its ✕.** The reshaped model and `componentRow`,
   `CodecRow` 1:1 with `onRemove`, `removeComponent` on the wire and in the hook,
   `CodecManager` drawing the row last and wiring the ✕.
4. **Docs and refactor.** COMPONENT-SPEC's `CodecManager` and `CodecRow` rows and
   the Icons table, the glossary, CLAUDE.md's folder map and env section,
   README's tree, the feature tick, the journal; then the refactor pass.

## Testing Decisions

A good test asserts **external behaviour** — what a route answers, what a pure
function returns, what an outcome value says, what is on screen, what a hook
hands back — never how it was reached. **Every unit gets its co-located test**,
the project's standing rule. The precedents: `routes.test.ts` (a real listener
over a real migrated in-memory database, a fake component handed to
`createPlayback`), the `capabilities` and `ffmpegComponent` tests (an injected
listing rather than a machine), `ffmpegBinary`'s tests over `componentDir` and
`sandboxRoot`, the `codecView` and `preferredSubtitle` tests (pure in, pure
out), the `useExport` / `ExportModal` pair (a hook and the organism that owns it,
read through what is on screen), and the `fakeResponse` client tests.

**`componentBinary`**: `ffmpeg`, `ffmpeg.exe`, `FFMPEG.EXE` → `'ffmpeg'`;
`ffprobe` and its variants → `'ffprobe'`; a poster, a `.dll`, an empty string,
`ffmpeg.dll`, `myffmpeg.exe` → `null`.

**`verifyComponent`**: both runs exit `0` with stdout opening `ffmpeg version` /
`ffprobe version` → `true`; a non-zero code on either → `false`; stdout that
does not open with the right word (a renamed text file, a `.dll`'s garbage) →
`false`; a run answering `null` (would not start at all) → `false`; ffprobe's
answer is not accepted for ffmpeg or vice versa.

**`createComponentSlot`** — over a `sandboxRoot` directory, with an injected
`verify` and an injected `rename`:

- `current()` with an empty slot answers `ffmpegBinary(env)`'s component; with a
  pair in `current/` it answers that one; with neither it answers `null`.
- `info()` answers `'uploaded'` with the pair's summed bytes and their basenames
  for an uploaded pair, `'default'` for the resolver's, and `null` for no
  component at all.
- `receive()` empties an `incoming/` left behind by a previous attempt; `take`
  writes each binary under the platform's name whatever the client called it;
  `discard()` removes the folder.
- `install()` with only one half → `incomplete`, incoming discarded, `current/`
  untouched; with a pair `verify` refuses → `not-a-component`, same; with a
  verified pair → `ok`, `current/` is the new pair, `previous/` is gone, and
  `current()` recomposed answers the new one.
- `install()` when the first rename throws `EBUSY` → `in-use`, **nothing
  moved**, incoming discarded, `current()` still the old component. The same for
  `EPERM` and `EACCES`; an unrelated errno is not `in-use`.
- `remove()` with an uploaded pair → `ok` and `current()` falls back to the
  resolver's; with none → `nothing-uploaded`; with the rename locked → `in-use`
  and the pair still live.
- A leftover `incoming/` and `previous/` are cleared when the slot is created.
- `current()` is resolved once and not per call: a slot whose component's
  `hardwareEncoder` was read once does not read it again on a second `current()`.

**`capabilities(component)`**: the existing cases re-pointed at a
`CodecCapability[]` return — `null` answers the native rows alone; a listing
answers native ∪ the parsed video and audio decoders; a codec in both is
reported once as native; a component answering `null` adds no rows; the legend
line is not a codec; a name beginning with a digit is not a row.

**`Playback.capabilities()`**: answers `{ component: slot.info(), codecs }` over
the slot it was composed with — an uploaded slot's `info`, a default slot's, and
`null` for a slot with no component.

**`createPlayback` over a slot**: `read`, `duration` and `stream` decide over
`slot.current()` **at the time of the call** — a slot whose component changes
between two calls gives a `cannot-play` then a `converted` for the same file,
which is the whole point of the change. `receiveComponent` and `removeComponent`
forward to the slot. Every existing case unchanged through `fixedSlot`.

**`fixedSlot`**: answers the component it was given, an `info()` for it, and
refuses to receive or remove — asserted once so the double's own contract is
written down.

**The routes** (in `routes.settings.test.ts`, over a fake slot):
`POST /api/playback/component` with both parts answers `200` and the report
after the swap, with the new rows in it; a body that is not multipart → `400`; a
stray part → `400` with _Only ffmpeg and ffprobe can be added._; one half alone →
`400` with _ffmpeg and ffprobe go together — add both._; a pair the slot refuses
→ `422` with _That isn't a working ffmpeg build._; a locked slot → `409` with the
in-use line. Every refusal discarded the incoming folder.
`DELETE /api/playback/component` answers `200` and the fallen-back report; a slot
with nothing uploaded → `404`; a locked one → `409`. Both echo the same shape
`GET /api/playback/capabilities` answers.

**`codecView`**: `codecRows` is unchanged in behaviour under the reshaped model —
catalogue order, uncatalogued decoders absent, a catalogued codec the report
lacks absent, `chips` carried, `size` `—`, `status` `'built-in'` /
`'installed'`, `removable` false on every codec row. `componentRow` answers a row
with the name _Playback component_, the two basenames as chips, `formatBytes` of
the summed bytes, `'default'` or `'uploaded'`, `removable` only when uploaded;
and `null` for a report whose component is `null`. `codecSummary` counts the
codec rows only — the Component row never appears in the count — with the
`no playback component` form when the component is `null`.

**`CodecRow`**: the name, each chip, the size cell's text, the four pill words;
`RemoveButton` rendered exactly when `onRemove` is given and the handler called
on press, with the accessible name built from what it removes; the spacer and no
button when it is not.

**`ComponentDropZone`**: idle draws the title and the line from the prototype; a
pick of two files reports both as a `File[]`; a drop reports
`dataTransfer.files`; a cancelled dialog and an empty drop report nothing;
drag-over adds the hover face and dragging out removes it; busy draws the install
title and the remove title by action, disables the input and reports nothing on a
pick; refused draws the reason and keeps the title.

**`useCapabilities`**: `null` until the read lands, the payload after, `null`
kept on refusal (the existing cases); `installComponent` sets `busy('install')`
and then the echoed report with `idle`; a `ComponentRefusedError` leaves the
previous report and sets `refused` with the server's reason; a plain error sets
the fixed line; `removeComponent` the same with `busy('remove')`; a call while
busy is ignored; **neither write rejects**; an answer landing after unmount
redraws nothing.

**`installComponent` / `removeComponent`** (client): the `POST` carries one
`component` part per file to `/api/playback/component` and resolves the report;
`400`, `409` and `422` reject with `ComponentRefusedError` carrying the body's
`error`; a `500` and an unreadable body reject plainly; the `DELETE` resolves the
report and rejects `404` and `409` the same way.

**`CodecManager`**: nothing while the report is `null`; once it lands, the
summary, one row per catalogued codec, the Component row **last**, and the zone;
the Component row absent when the component is `null`; the ✕ present only on an
uploaded component and its press calling through to a redrawn report; a refusal
drawn in the zone with the rows still there; nothing on a refused read.

**`UploadIcon`**: renders its path at the size given — `MicrochipIcon`'s test.

**`visuallyHidden`**: no test of its own; it is a style fragment, and the two
callers that use it are tested through what is reachable.

No new frontend `test-support/` unit is anticipated: `fakeResponse` covers the
client calls, and a `File` is constructible in jsdom. On the server,
`componentDir` and `sandboxRoot` cover the slot's fixtures, and `fixedSlot` is
the one new double.

## Out of Scope

- **A per-row ✕ or size on codec rows.** Ruled out for good rather than
  deferred: there is one pack, every _Installed_ row comes and goes with it, and
  the size and the remove belong to the Component row.
- **A zip upload.** A dependency, and an archive-layout question
  (`bin/ffmpeg.exe`) the maintainer should not have to get right.
- **One file at a time.** A state machine with a half-uploaded component in it.
- **ffmpeg alone with ffprobe optional.** Half a component is not a component.
- **An Electron folder dialog for "browse".** The browser's own file dialog is
  what "browse" opens on the Movie form too; the native dialog and the
  `userData` path belong to the Electron shell initiative, and the environment
  variable is the slot until then.
- **A confirm dialog on remove.** Reversible by a drop, the files are the
  maintainer's own download, and the default comes back underneath. The Delete
  dialog guards a film.
- **A progress bar.** `fetch` exposes no upload progress, and a copy from one
  local disk to the same disk is seconds.
- **A success flash or a snackbar.** The report both routes echo is the feedback;
  the Snackbar system is its own initiative.
- **Memoising `decoders()`.** Asked afresh on every call, which is what makes a
  swapped component describable by the next read.
- **Killing running conversions to free a locked binary.** Refusing and saying so
  is the honest answer.
- **A version string parsed off `ffmpeg -version` for the row's name.** The row
  says _Playback component_; the verification reads the banner and throws it
  away.
- **Overwriting `FAMILYFLIX_FFMPEG_PATH`'s binary in place.** Read-only in a
  packaged app, replaced on update, and once overwritten there is nothing to fall
  back to.
- **Removing the default component.** It is not the maintainer's; the `404` says
  so.
- **_Change…_ under the storage path and _Software update_.** Still the Electron
  shell's and the Snackbar system's.

## Further Notes

**The seam was written for this day.** `ffmpegComponent`'s `decoders()` is asked
afresh on every call with the comment "so the day the live component is replaced
the next read describes the new one", `createPlayback` decides per request and
memoises nothing for the same stated reason, and `ffmpegBinary` takes its
environment as an argument rather than reading `process.env`. The consequence is
that a swapped component is honoured by the next Play with no cache to
invalidate — the feature's hardest-sounding requirement is the one that costs
nothing.

**The rename is the design.** Making the swap a directory rename rather than two
file overwrites turns "is the component in use?" from a state to track into a
single failing syscall, and makes a mixed pair impossible: either both binaries
moved or neither did. The Windows lock, which reads as the platform's
obstruction, is what gives the feature its clean refusal.

**The report's echo is why there are no success states.** Both writes answer the
whole `PlaybackCapabilities`, so the screen redraws from truth rather than
celebrating. That is what lets _replaced_ and _removed_ be absences from the
state machine rather than entries in it, and it keeps the **Upload state** down
to three cases.

**The widest edit is the dullest.** Thirty-five `createPlayback(` call sites
across four test files and `main.ts` move to a slot. `fixedSlot` exists so that
migration is one name repeated rather than an object literal repeated, and so the
next person reading those tests sees "a slot that answers this component" rather
than a shape they have to decode.

**What the dev machine will say.** A machine resolving ffmpeg off `PATH` wears
the **Default** pill, which is true of it and of the installer's build alike,
even though "bundled" would say more on the family's machine. Accepted: the
pill's job is to say whether what is live is the maintainer's, and on both
machines the answer is no.

**`hardwareEncoder` costs one more spawn per install.** The slot re-resolves
`current()` after every write, which re-reads `ffmpeg -encoders`. It happens on
the maintainer's deliberate action, once, and the alternative — a component whose
encoder was detected on the binary it replaced — is a wrong argv on the next
transcode.

**The prototype is amended before anything is built**, per CLAUDE.md: the
Component row into the container's model, and `zoneTitle` / `zoneLine` /
`zoneBusy` / `zoneRefused` into the CodecManager screen, so the three faces this
grill designed live on the prototype the way the player's buffering and
unavailable notices do rather than only in the code.

The feature table's _Codec manager — add a playback component_ row is ticked ✅
after this initiative's **refactor** closes, not when its build issues do.

---

Design log: `docs/design-logs/16-component-upload.md`
Glossary: the **Playback component upload** section of
`docs/ubiquitous-language.md`
