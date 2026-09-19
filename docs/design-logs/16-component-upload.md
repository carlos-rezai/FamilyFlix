# 16 — Playback component upload

> **Initiative:** `component-upload`
> **PRD:** to follow this log
> **Plan:** to follow the PRD

This log is the `grill-me` session that settled the feature before the PRD was
written, run against the prototype and the code as they stood on 2026-09-18,
the same day the Settings hub's refactor closed (#149). It is an immutable
snapshot of that moment. The session ran with every recommendation accepted in
advance by the maintainer, whose one instruction was the scope: _translate the
prototype 1:1 into the codebase, in its naming, conventions, patterns and
architecture_. The working name handed to the session was
`codec-manager-playback`; Q2 is where it became `component-upload`.

## Background

The **Codec report** is built and true (`15-settings-hub`): `CodecManager` owns
`useCapabilities`, draws the **Codec summary** over one `CodecRow` per
catalogued codec, and reads `GET /api/playback/capabilities` off the one
component `main.ts` composed. Two things the prototype draws on that surface
were held back, on log 13 Q2's rule that a control whose mechanism does not
exist is not drawn:

- the dashed **_Add a codec pack_** zone under the rows
  (`feat.CodecManager.dc.html`, the `onBrowse` button: an accent arrow, the
  title, and the line log 10 amended to _Drop a playback component (ffmpeg)
  here, or browse_); and
- the per-row **size** and **✕** (`c.size`, `c.onRemove` behind
  `c.notBuiltIn`, and a 32px spacer on built-in rows).

Log 15 Q7 and Q9 said what those become: the ✕ "returns with the upload
initiative as the _component's_ remove, in whatever geometry that session
amends the prototype to", the size cell "is a column of dashes until the upload
initiative decides what a component's size means on a row", and the zone is
"a writable slot under user-data ahead of the installer's in the resolution
order, a component that can be swapped while the app runs, a two-file upload
(ffmpeg and ffprobe ship together, and `ffmpegBinary` resolves them together)
validated by running it, and the drop-zone states — busy, refused, replaced —
the prototype does not draw and a grill has to design". This is that grill.

The container's simulation (`FamilyFlix.dc.html`): `uploadCodec()` appends a
canned row (_DTS Audio · 2.3 MB_, _ProRes · 9.4 MB_ …) and sets
`codecJustAdded`, which nothing draws; `removeCodec(id)` filters the row out.
CLAUDE.md's rule is to reproduce the surface and never the simulation.

What exists to build on:

- `server/src/playback/ffmpegBinary/`: `ffmpegBinary(env)` — the named slot,
  then `PATH`, then absent — and `pairIn(directory)`, the rule that half a
  component is not a component. `FfmpegEnvironment` is taken as an argument so
  a test can ask about a machine other than its own.
- `server/src/playback/ffmpegComponent/`: `PlaybackComponent` — the seam every
  fake stands in for — composed over a pair, with `decoders()` asked afresh on
  every call "so the day the live component is replaced the next read
  describes the new one". `createPlayback` decides per request and memoises
  nothing, for the same stated reason. The code was written expecting this
  initiative.
- `server/src/routes/readBody/`: `busboy` streaming, parts handed to a route
  as they arrive, every part consumed. `Media.storeUpload` is the precedent
  for a part piped to disk.
- `primitives/FilePicker`: a `<label>` over a visually hidden
  `<input type="file">` — the one way a click opens a file dialog.
  `primitives/RemoveButton`: the prototype's exact ✕ — 32px, 7px corner,
  danger on hover — with its name built from what it removes.
- `features/import-export/ImportSetup`: a route's `400 { error }` drawn as a
  13px danger line under the field it refused — the app's one precedent for
  server copy on screen.
- `utils/formatBytes`, `src/types/playback.ts` (`PlaybackCapabilities` with
  `component: boolean`), the settings feature's `api.ts` and `useSettings`
  (the read and the write of one state in one hook).
- Nothing under `electron/`: no native dialog, no `userData` path yet. The
  slot is an environment variable with a repo-local default, like the other
  three.

## Problem

A screen whose last two controls act on something the app only ever resolved
once, at startup, from a read-only place. The questions are where an uploaded
component lives so it survives an update and can be taken back out; how two
binaries arrive as one gesture and are known to be what they claim; how the
live component is swapped under a server that may be converting a film with
it — on Windows, where a running executable cannot be overwritten; what a
row looks like for the one thing on the screen that genuinely has a size and
a remove; and what the zone shows while it works, when it refuses, and when
it is done, none of which the prototype draws.

## Questions and Answers

1. **What is `component-upload`?** ✅ The _Add a codec pack_ zone wired to a
   real **Playback component upload**: a writable **Component slot** under
   user-data, resolved ahead of the installer's; a two-file upload verified by
   running it; the live component swapped while the app runs; and the
   component's own size and remove drawn on a **Component row** in the
   prototype's row geometry. Everything the Codec report held back, and
   nothing else. ❌ A per-row ✕ or size (Q9). ❌ A zip upload (Q4). ❌ An
   Electron folder dialog for the "browse" — the browser's own file dialog
   is what "browse" opens on the Movie form too.

2. **Name and log?** ✅ Initiative **`component-upload`**, log
   `16-component-upload.md`. The glossary has called this initiative the
   **Playback component upload** since log 15, and the feature table's row is
   _Codec manager — add a playback component_. ❌ `codec-manager-playback`,
   the working name: "codec manager" is what the glossary retired the day the
   screen became a report, and the name would put it back in every commit.
   ❌ `playback-component-upload`: too long for the one-line commit rule.

3. **Where does an uploaded component live?** ✅ A new **`FAMILYFLIX_COMPONENT_PATH`**
   — the **Component slot**'s directory, default `./playback-component`,
   which Electron main will set to `app.getPath('userData')/playback-component`
   the way it sets the other two paths. The **Uploaded component** is the pair
   at `<slot>/current/`; the slot is read **first**, ahead of
   `FAMILYFLIX_FFMPEG_PATH` and `PATH`, so an upload wins over the bundled
   build and a remove falls back to it. ❌ Overwriting the installer's binary
   in place (log 10 Q20's "the slot an uploaded component will occupy",
   superseded by log 15 Q9): the installer's directory is read-only in a
   packaged app, is replaced wholesale on update, and once overwritten there
   is nothing to fall back to. ❌ Under the **Managed media directory**:
   `spaceUsed` walks it, and the Storage card would count `94 MB` of ffmpeg
   as movies.

4. **What is uploaded, and how do two files arrive as one gesture?** ✅ **The
   two binaries, in one drop or one pick** — the zone's hidden input takes
   `multiple` — and the server tells them apart **by filename**: a pure
   **`componentBinary(filename)`** in `server/src/playback/componentBinary/`
   answers `'ffmpeg'` for `ffmpeg` / `ffmpeg.exe`, `'ffprobe'` for its pair,
   case-insensitively, and `null` for anything else. Every part travels under
   the one field name `component`; the client sorts nothing. A part that is
   neither, a second of either, or a body with only one of the two is refused
   (Q8), and the bytes are stored under the platform's own names — `ffmpeg`
   plus `.exe` on Windows — never the client's. ❌ A zip: a dependency, and
   an archive-layout question (`bin/ffmpeg.exe`) the maintainer should not
   have to get right. ❌ One file at a time: a state machine with a
   half-uploaded component in it. ❌ ffmpeg alone with ffprobe optional:
   `ffmpegBinary`'s own rule is that half a component is not a component,
   and a path chosen without a probe is a guess.

5. **Validated how?** ✅ **By running it** — **`verifyComponent(pair)`** in
   `server/src/playback/verifyComponent/`: `ffmpeg -version` and
   `ffprobe -version` both exit `0` with stdout opening `ffmpeg version` /
   `ffprobe version`. A `.dll` dropped by a parent who read the old
   prototype, a text file renamed `ffmpeg.exe`, a build for the wrong
   platform — all fail the same way, before the live component is touched.
   Once installed it is composed through `ffmpegComponent` like any other,
   so `-encoders` and `-decoders` are read off it the way they always were.
   The route runs what the maintainer dropped, on the maintainer's own
   machine, over `localhost` — the same trust `FAMILYFLIX_FFMPEG_PATH`
   already extends, and no wider. ❌ Trusting the names. ❌ Probing the
   fixture video: `test-support/` in shipping code.

6. **How is the live component swapped under a running server?** ✅ The
   **Component slot** — `createComponentSlot(slotDir, env, verify)` in
   `server/src/playback/componentSlot/` — owns resolution and the swap:
   - `current(): PlaybackComponent | null` — the live component: the pair at
     `<slot>/current/` composed through `ffmpegComponent`, else
     `ffmpegBinary(env)`'s, else `null`. Resolved when the slot is created
     and again after every install and remove, never per call —
     `hardwareEncoder` costs a spawn.
   - `info(): PlaybackComponentInfo | null` — `{ source, bytes, files }`:
     `'uploaded'` or `'default'`, the pair's bytes summed, the two basenames.
   - `receive(): IncomingComponent` — an upload begun: an emptied
     `<slot>/incoming/`. `take(binary, bytes)` pipes one part to its name
     (`0o755` on POSIX); `install()` verifies and swaps; `discard()` removes
     the folder.
   - `remove(): RemoveOutcome` — the uploaded pair taken out, the default
     resolved again.

   **The swap is a directory rename, never a file overwrite**: `current/` →
   `previous/`, `incoming/` → `current/`, `previous/` removed. On Windows a
   directory holding a running executable cannot be renamed, so the first
   rename fails with nothing moved and the outcome is **`in-use`** — the
   route answers `409` and the zone says _stop the film that's playing_. A
   remove is the first rename alone. A leftover `incoming/` or `previous/`
   from a crash is cleared when the slot is created. ❌ Overwriting the two
   files in place: the second overwrite can fail after the first succeeded,
   leaving a mixed pair. ❌ Killing running conversions to free the lock: a
   family movie night stopped by the maintainer's upload; refusing and saying
   so is the honest answer, and in a one-window app the player is unmounted —
   its conversion killed — before Settings is on screen anyway.

7. **How does playback see the new one, and how do the routes reach it?** ✅
   **`createPlayback(mediaPath, slot)`** takes the slot where it took a
   component, and reads `slot.current()` inside `decide`, `duration` and
   `stream` — the per-request decision the code already makes, now over a
   component that can change between requests. `Playback` gains
   **`receiveComponent()`** and **`removeComponent()`**, thin over the slot,
   and `capabilities()` becomes `{ component: slot.info(), codecs:
capabilities(slot.current()) }` — the pure `capabilities(component)` now
   answers the rows alone. Nothing new is injected into `createApiRouter`;
   the route layer still never learns there is an FFmpeg. The thirty-odd
   `createPlayback(dir, component)` calls in tests become
   `createPlayback(dir, fixedSlot(component))` over a new
   **`server/src/test-support/fixedSlot/`** — a slot that answers one
   component, `info()` for it, and refuses to receive or remove. ❌ The slot
   as a sixth argument to the router. ❌ A thunk `() => component` beside a
   separately injected slot: two objects for one thing.

8. **The wire?** ✅ Two routes and one type change:
   - **`POST /api/playback/component`** — `multipart/form-data`, every file
     part named `component` → `200 PlaybackCapabilities`, the report after
     the swap, on the echo precedent every write in the app keeps. `400` for
     a body that is not multipart, a part that is not a **Component binary**
     (`Only ffmpeg and ffprobe can be added.`), or a body missing one
     (`ffmpeg and ffprobe go together — add both.`); `422` when the pair will
     not run (`That isn’t a working ffmpeg build.`); `409` when the live one
     is locked (`The playback component is in use. Stop the film that’s
playing and try again.`). Every refusal discards the incoming folder.
   - **`DELETE /api/playback/component`** → `200 PlaybackCapabilities`, the
     report after the fall-back; `404` when nothing is uploaded (the default
     component is not removable — it is not the maintainer's); `409` in use.
   - `PlaybackCapabilities.component` goes from `boolean` to
     **`PlaybackComponentInfo | null`** — `{ source: 'default' | 'uploaded',
bytes, files }`. `codecSummary` reads `!== null` where it read truthiness.

   ❌ `204` on the delete: the screen needs the report after the fall-back,
   and a second GET is a second chance to disagree with the swap.

9. **The per-row size and ✕ — where do they go?** ✅ A **Component row**: the
   prototype's row template drawn **once more, last**, for the one thing on
   the screen that has a size and can be removed. The microchip tile, the
   name **Playback component**, the two binaries' basenames as the mono chips
   (`ffmpeg.exe` `ffprobe.exe`), the pair's bytes through `formatBytes` in
   the size cell (`94.3 MB`), a **Status pill** reading **Default** (the
   faint colouring, the prototype's built-in one) or **Uploaded** (the green,
   the prototype's installed one), and — exactly the prototype's rule for
   which rows get a ✕ — `RemoveButton` on an uploaded component and the 32px
   spacer on a default one. No component, no row. The codec rows keep their
   `—` and their spacer: log 15 Q7 stands, and this is the geometry it
   deferred to. ❌ A ✕ on every Installed row removing the whole component:
   log 15's trap. ❌ The component's size on every Installed row: six rows
   saying `94 MB`. ❌ A Remove button inside the zone: geometry the prototype
   does not have, when it has a row template with a ✕ in it.

10. **How does `CodecRow` draw both?** ✅ `CodecRow` becomes the prototype's
    row 1:1 — its `data-props` were `name, exts, size, statusLabel,
statusStyle, onRemove, notBuiltIn`. `CodecRowModel` reshapes to
    `{ key, name, chips, size, status, removable }` with `status: 'built-in'
| 'installed' | 'default' | 'uploaded'` (the four pill words; two
    colourings), `codecView` gains **`componentRow(report)`**, and the
    molecule takes `{ row, onRemove? }`, drawing the ✕ when a handler is
    given. `codecRows` and `codecSummary` are unchanged in meaning — the
    summary counts formats, not the row about the component. ❌ A second
    `ComponentRow` molecule: two copies of one template.

11. **Does the ✕ confirm?** ✅ **No dialog** — the prototype's `onRemove`
    removes at once. It is reversible by a drop, the files are the
    maintainer's own download, and the default component comes back
    underneath. ❌ A Delete-style dialog: that one guards a film.

12. **The zone?** ✅ **`ComponentDropZone`** in `features/settings/` — the
    feature's own molecule, `ProblemRow`'s precedent: a `<label>` over a
    visually hidden `<input type="file" multiple>` (the `FilePicker` trick,
    with the clipping rule moved to **`src/styles/visuallyHidden.ts`** so
    both spell it once), `dragover`/`drop` on the label taking
    `dataTransfer.files`, drag-over drawn as the prototype's hover
    (`accentLine` border, `accentSoft` fill), and a new **`UploadIcon`** in
    `primitives/Icon/` (the prototype's arrow-over-bar at stroke 1.8,
    `currentColor`, the zone colouring it accent). Props
    `{ upload: UploadState, onFiles(files: File[]) }`; an empty drop or a
    cancelled dialog reports nothing. ❌ Generalising `FilePicker`: its 42px
    single-line box is a different surface. ❌ A primitive: one caller.

13. **The faces the prototype does not draw?** ✅ **Three, in the zone's own
    geometry** — log 10 Q16's move, and a prototype amendment made first:
    - **idle** — as drawn.
    - **busy** — the title _Adding the playback component…_ over _Copying it
      in and checking it runs_, or _Removing the playback component…_ over
      _The formats it added go with it_; the input `disabled`, no hover,
      default cursor.
    - **refused** — the title as drawn, and **the line in the danger ink
      carrying the reason** — the Setup step's danger line, in the zone's
      12.5px slot. It stays until the next attempt replaces it.

    **Replaced and removed are not faces**: the route answers the new report
    and the screen redraws from it — rows appear or go, the Component row's
    pill flips and its ✕ appears or gives way to the spacer. `codecJustAdded`
    is in the simulation's model and drawn by nothing, so there is no success
    flash, and the Snackbar system is its own initiative. ❌ A progress bar:
    `fetch` exposes no upload progress, and a copy from one local disk to the
    same disk is seconds. ❌ Silence on a refusal, the Delete and Export rule:
    a `.dll` dropped by a parent who read the old copy would do nothing at
    all, which is the trap this screen exists to avoid.

14. **Whose copy is the reason?** ✅ **The server's `error`** on `400`, `409`
    and `422`, through a `ComponentRefusedError` carrying it (the
    `ImportRefusedError` precedent); a fixed line for anything else —
    _Couldn’t add the playback component._ / _Couldn’t remove the playback
    component._ — so a `500` is not silence either.

15. **Which hook?** ✅ **`useCapabilities` grows** — `{ capabilities, upload,
installComponent(files), removeComponent() }` — the `useSettings`
    precedent: the read and the writes of one state in one hook, because both
    writes answer the same report the read holds. `upload` is the
    **Upload state**, `idle | busy(action) | refused(reason)`; a call while
    busy is ignored; an answer landing after unmount redraws nothing. Neither
    write rejects. `installComponent` and `removeComponent` go in
    `features/settings/api/` — one caller each — sending `FormData` with one
    `component` part per file. ❌ A second hook handed `setCapabilities`.

16. **The words on screen.** ✅ The zone's title stays **_Add a codec pack_**
    and the Codecs lede keeps _add a pack only if a movie won’t play_ — log
    10 Q5 changed only the drop-zone line, log 15 kept the lede for exactly
    this day, and "pack" is the family's word for what they drop. The code,
    the wire, the glossary and the row say **Playback component**. ❌
    Re-titling the zone: a copy amendment the prototype's author did not
    make.

17. **The feature table afterwards?** ✅ **Codec manager — add a playback
    component** ✅, ticked after the initiative's refactor, per the project's
    rule. The **Playback component upload** initiative in the glossary
    becomes this log.

## Design

### Types — `src/types/playback.ts` (grows)

```ts
/** Where the live **Playback component** came from. */
export type ComponentSource = 'default' | 'uploaded';

/** The live component described: its origin, its bytes, its two files. */
export interface PlaybackComponentInfo {
  source: ComponentSource;
  bytes: number;
  /** The two binaries' basenames — `ffmpeg.exe`, `ffprobe.exe` — the Component row's chips. */
  files: string[];
}

export interface PlaybackCapabilities {
  /** `null` for a machine with no component at all. */
  component: PlaybackComponentInfo | null;
  codecs: CodecCapability[];
}
```

### Backend

```
server/src/playback/
├── componentBinary/     ← pure: componentBinary(filename): 'ffmpeg' | 'ffprobe' | null
├── verifyComponent/     ← verifyComponent(pair: FfmpegBinaries): boolean — both `-version`s answer
├── componentSlot/       ← createComponentSlot(slotDir, env, verify = verifyComponent): ComponentSlot
├── ffmpegBinary/        ← pairIn exported; otherwise untouched
├── capabilities/        ← capabilities(component): CodecCapability[] — the rows alone
└── createPlayback/      ← createPlayback(mediaPath, slot); + receiveComponent(), removeComponent()
server/src/test-support/
└── fixedSlot/           ← fixedSlot(component: PlaybackComponent | null): ComponentSlot
server/src/main.ts       ← COMPONENT_PATH = env.FAMILYFLIX_COMPONENT_PATH ?? './playback-component'
```

```ts
// componentSlot
export type ComponentBinary = 'ffmpeg' | 'ffprobe';

export type InstallOutcome =
  | { ok: true }
  | { ok: false; reason: 'incomplete' | 'not-a-component' | 'in-use' };
export type RemoveOutcome =
  | { ok: true }
  | { ok: false; reason: 'nothing-uploaded' | 'in-use' };

/** An upload begun: `<slot>/incoming/`, emptied. */
export interface IncomingComponent {
  take(binary: ComponentBinary, bytes: Readable): Promise<void>;
  /** Verify the pair and swap it in, or say why not. Discards on refusal. */
  install(): InstallOutcome;
  discard(): void;
}

export interface ComponentSlot {
  current(): PlaybackComponent | null;
  info(): PlaybackComponentInfo | null;
  receive(): IncomingComponent;
  remove(): RemoveOutcome;
}

// createPlayback — Playback gains
receiveComponent(): IncomingComponent;
removeComponent(): RemoveOutcome;
```

The slot's directory:

```
<FAMILYFLIX_COMPONENT_PATH>/
├── current/     ← the Uploaded component: ffmpeg[.exe], ffprobe[.exe]
├── incoming/    ← one upload in progress; cleared on create and on refusal
└── previous/    ← the pair on its way out; cleared on create
```

```mermaid
flowchart LR
  A[POST parts] --> B[incoming/ take ×2]
  B --> C{verifyComponent}
  C -- no --> D[discard → 422]
  C -- yes --> E{rename current/ → previous/}
  E -- EBUSY/EPERM --> F[discard → 409 in-use]
  E -- ok --> G[rename incoming/ → current/]
  G --> H[rm previous/ · recompose current() → 200 report]
```

### Routes — `server/src/routes/index.ts`

```
POST   /api/playback/component   → 200 PlaybackCapabilities   parts `component` by filename → slot.receive().take(); install()
                                   400 { error }               not multipart · a stray part · a missing half
                                   422 { error }               not-a-component
                                   409 { error }               in-use
DELETE /api/playback/component   → 200 PlaybackCapabilities   slot.remove()
                                   404 { error }               nothing-uploaded
                                   409 { error }               in-use
```

Nothing new is injected into `createApiRouter`.

### Frontend

```
src/styles/visuallyHidden.ts            ← the clipping rule FilePicker and the zone share
src/primitives/Icon/UploadIcon.tsx      ← the zone's arrow
src/features/settings/
├── codecView/                          ← CodecRowModel reshaped; + componentRow(report)
├── CodecRow/                           ← the prototype's row 1:1: { row, onRemove? }; RemoveButton or the spacer
├── ComponentDropZone/                  ← the zone: idle / busy / refused; drag-over; hidden multiple input
├── useCapabilities/                    ← + upload, installComponent, removeComponent
├── CodecManager/                       ← summary, codec rows, the Component row, the zone
└── api/                                ← + installComponent(files), removeComponent(); ComponentRefusedError
```

```ts
// codecView
export type RowStatus = 'built-in' | 'installed' | 'default' | 'uploaded';
export interface CodecRowModel {
  key: string;
  name: string;
  chips: string[];
  /** `—` on a codec row; the component's bytes formatted on its own. */
  size: string;
  status: RowStatus;
  removable: boolean;
}
export function codecRows(report: PlaybackCapabilities): CodecRowModel[];
export function componentRow(
  report: PlaybackCapabilities
): CodecRowModel | null;
export function codecSummary(report: PlaybackCapabilities): string; // unchanged

// CodecRow
export interface CodecRowProps {
  row: CodecRowModel;
  /** Given for the one removable row; the ✕ is drawn iff it is. */
  onRemove?: () => void;
}

// useCapabilities
export type UploadState =
  | { kind: 'idle' }
  | { kind: 'busy'; action: 'install' | 'remove' }
  | { kind: 'refused'; reason: string };
export interface CapabilitiesState {
  capabilities: PlaybackCapabilities | null;
  upload: UploadState;
  installComponent: (files: File[]) => Promise<void>; // never rejects
  removeComponent: () => Promise<void>; // never rejects
}

// ComponentDropZone
export interface ComponentDropZoneProps {
  upload: UploadState;
  onFiles: (files: File[]) => void;
}

// api
export class ComponentRefusedError extends Error {}
export function installComponent(files: File[]): Promise<PlaybackCapabilities>;
export function removeComponent(): Promise<PlaybackCapabilities>;
```

The **Codec report** after this initiative, top to bottom, inside the
prototype's 14px column: the summary; the codec rows in catalogue order; the
Component row (when there is a component); the zone.

### Prototype amendments (make first, then build)

1. `FamilyFlix.dc.html` — the `codecs` model gains the **Component row** as
   its last entry (`name: 'Playback component'`, `exts: ['ffmpeg.exe',
'ffprobe.exe']`, `size: '94.3 MB'`, a `source` of `'default'` /
   `'uploaded'`), drawn `Default` in the built-in colouring or `Uploaded` in
   the installed one, with the ✕ only when uploaded. `uploadCodec()` flips it
   to uploaded and `removeCodec` on it flips it back; the canned codec rows
   the simulation appends stay the simulation's. The codec rows' `size` stays
   `—`. Geometry unchanged.
2. `feat.CodecManager.dc.html` — the zone reads `cdc.zoneTitle` and
   `cdc.zoneLine` instead of literals, with `cdc.zoneBusy` (no hover, no
   pointer) and `cdc.zoneRefused` (the line in `--color-danger`), so the busy
   and refused faces are on the prototype the way the player's buffering and
   unavailable states are. Idle copy unchanged. Geometry unchanged.

### Not built

Per-row ✕ and size on codec rows (ruled out for good, not deferred); a zip
upload; an Electron folder dialog; a confirm on remove; a progress bar; a
success flash or snackbar; memoising `decoders()`; killing running
conversions to free a locked binary.

## Implementation Plan

1. **The slot, end to end on the server.** `componentBinary`,
   `verifyComponent`, `createComponentSlot` with the rename swap and the
   `in-use` outcome, `fixedSlot`, `PlaybackComponentInfo` and the type change,
   `capabilities(component)` answering rows alone, `createPlayback(mediaPath,
slot)` with `receiveComponent` / `removeComponent`, the thirty-odd test
   call sites migrated, `main.ts` and the env docs, and the two routes. The
   thinnest slice that makes `curl -F component=@ffmpeg.exe -F
component=@ffprobe.exe` change what the next `GET /playback` answers.
2. **The zone.** `visuallyHidden`, `UploadIcon`, `ComponentDropZone` with its
   three faces and drag-over, `ComponentRefusedError` and `installComponent`,
   `useCapabilities`' `upload` and `installComponent`, `CodecManager`
   composing the zone under the rows. The first thing the maintainer can see
   work: drop the pair, watch Installed rows appear.
3. **The Component row and its ✕.** `codecView`'s reshaped model and
   `componentRow`, `CodecRow` 1:1 with `onRemove`, `removeComponent` on the
   wire and in the hook, `CodecManager` drawing the row last and wiring the
   ✕. `codecSummary` unchanged.
4. **Docs and refactor.** COMPONENT-SPEC's `CodecManager` and `CodecRow`
   rows and the Icons table, the glossary, CLAUDE.md's folder map and env
   section, README's tree, the feature tick (Q17), the journal; the refactor
   pass.

## Trade-offs

**Easier.** The component seam and `createPlayback`'s per-request decision
were written for this, so a swapped component is honoured by the next Play
with no cache to invalidate. The report's echo on both writes means the screen
never re-fetches to learn what it just did. The rename swap makes "in use"
a single failing syscall rather than a state to track. The row template was
already 1:1; the component row exercises the two props of it that were idle.

**Harder.** `createPlayback`'s signature changes and thirty-odd test sites
move with it — mechanical, but the widest edit the initiative makes.
`hardwareEncoder` is re-read on every install, one more spawn on the
maintainer's action. A locked component refuses rather than queues; the
maintainer stops the film and drops again. The dev machine's PATH ffmpeg
wears the **Default** pill, which is true of it and of the installer's build
alike but says less than "bundled" would on the family's machine. The zone
has designed copy in three faces the prototype's author never wrote.

**Ruled out of scope.** A per-row ✕ or size on codec rows; a zip; the Electron
dialog and `userData` path (the env var is the slot until then); a confirm on
remove; upload progress; snackbars; killing conversions; a version string
parsed off `ffmpeg -version` for the row's name.
