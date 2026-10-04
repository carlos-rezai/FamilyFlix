# Plan: Software update — FamilyFlix updates itself from GitHub Releases

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/235

Step 9 of the build order, and the last one. Step 8 put FamilyFlix on the
parents' PC as an Installer run by hand; this step makes that the last manual
install. The installed app asks the **Release feed** once per launch, downloads
in the background, and installs on the next quit — or now, through **Update
now** on the About card's row or the **Update offer snackbar**.

**Nothing here launches Electron, reaches the network or reads the real
`autoUpdater` in a test.** The updater's state machine is one injected unit in
main, built from a `…World` of fakes like `serverHandle`; the renderer is driven
through a fake bridge in `src/test-support/`; `main.ts` and the preload are
wiring only, proven by the smoke.

The slicing follows the PRD's four phases, with two of them split so every
slice is demoable on its own:

**the bridge and the row's idle answer** (Phase 1, the tracer) → **offered and
installing on the row** (Phase 2) → **the offer snackbar and the
congratulation** (Phase 3) → **the release feed's config** (Phase 4) → **the
first release and the round-trip** (Phase 5, HITL) → **docs and refactor**
(Phase 6, docs-only).

## Architectural decisions

These apply across all phases:

- **The mechanism.** `electron-updater` against GitHub Releases of the public
  `carlos-rezai/FamilyFlix`, no token at runtime and no secret in the
  Installer. A devDependency **bundled into `main.js`** by esbuild — the
  `dependencies: {}` guard is unchanged and the Packaged layout gets no
  `node_modules`. `autoDownload` on, `autoInstallOnAppQuit` on, no toggle, no
  preference store, no timer: one check after the window opens, and one per
  press.
- **Offered means on disk.** A release found but not yet downloaded draws no
  face on any surface. "None" is told from "found" by the updater's own
  `isUpdateAvailable`, never a version comparison of ours.
- **Enabled only when installed.** The updater is enabled when the **Shell
  mode** is `installed`; `electron:dev` and `electron:start` never reach the
  feed and answer a pressed check `unavailable`.
- **The contract — one shared types module**, the `shell.ts` precedent, read by
  `electron/` and `src/`, in `tsconfig.electron.json` too:
  - `UPDATE_CHANNELS` — four `as const` channel names: `current` (invoke →
    status), `check` (invoke → outcome), `install` (send), `status` (main →
    renderer on every change).
  - `UpdateCheck` — `'none' | 'found' | 'refused' | 'unavailable'`.
  - `UpdateStatus` — `{ offered: string | null; lastCheckedAt: string | null;
installing: boolean }`, `lastCheckedAt` an ISO string.
  - `UpdateBridge` — `current(): Promise<UpdateStatus>`,
    `onStatus(listener): () => void`, `check(): Promise<UpdateCheck>`,
    `install(): void`.
- **The global.** A declaration file on the `appVersion.d.ts` precedent:
  `Window.familyflix?: { updates: UpdateBridge }` — **optional**, because a
  browser has none.
- **Push and pull.** Main holds the status. The renderer reads `current()` on
  mount and subscribes to the **whole status** pushed on every change, so the
  row and the snackbar derive from one stream. `checking` is the renderer's
  alone — only the row can start a pressed check.
- **The preload.** One flat, wiring-only file beside `main.ts`:
  `contextBridge.exposeInMainWorld('familyflix', { updates })`, each member one
  channel passed through. A **third CJS bundle** (`electron` external) beside
  `main.js` and `server.js`, the asar's fifth file. `webPreferences` gain
  `preload`; `sandbox`, `contextIsolation` and `nodeIntegration: false` are
  untouched.
- **`createUpdates(world): Updates`** — a top-level electron unit, the
  main-process injected domain. Its world: `updater` (the slice of
  `autoUpdater` used), `enabled`, `now()`, `shutdown()` (the **Ordered
  shutdown** with `SHUTDOWN_MS` bound by main), `onStatus(status)` (main
  forwards to `webContents.send`), `log(text)` (the **Shell log**'s `main`
  writer). Its face: `start()`, `current()`, `check()`, `install()`. An
  `error` listener is **always** registered; every error is one `[main]` line
  and nothing else. The updater's logger writes `info`, `warn`, `error` and
  drops `debug`.
- **Install against the quit gate.** `install()` sets `installing` and pushes,
  awaits the Ordered shutdown, and only then `quitAndInstall(true, true)` —
  silent, relaunching. The gate's own shutdown then resolves at once. The
  family's quit path needs no new code.
- **The renderer's feature.** `features/software-update/`. `updateBridge` is
  the **one** reader of `window.familyflix?.updates` and returns `null` in a
  browser — a state, not an error. `AboutSection` mounts the row organism (the
  `LibrarySection` → `ExportModal` precedent); `App` mounts the headless notice
  inside `SnackbarProvider`. Two subscribers to one stream, no shared update
  context.
- **The row's four faces**, one pure function of `(status, checking, now)`, the
  `zoneFace` precedent; precedence installing → offered → checking → idle:

  | face       | line                                           | button                            |
  | ---------- | ---------------------------------------------- | --------------------------------- |
  | offered    | `Version <v> is available to install.` (offer) | **Update now** · primary          |
  | installing | `Installing and restarting…` (dim)             | `Updating…` · primary, disabled   |
  | checking   | `You're up to date.` + label (faint)           | `Checking…` · secondary, disabled |
  | idle       | `You're up to date.` + label (faint)           | **Check for updates** · secondary |

  Every button `Button size="md"`, nothing styled locally. _Last checked_ is
  `just now` under a minute, then `N minutes` / `N hours` / `N days ago`,
  absent while `lastCheckedAt` is `null`, computed at render, never ticking.

- **Two version numbers.** The brand row keeps the **App version**
  (`__APP_VERSION__`, what is running); the **Offered version** appears only on
  the row's line and in the offer snackbar.
- **The release feed.** `package.json` `"repository":
"github:carlos-rezai/FamilyFlix"`; `builderConfig.json`'s `publish` becomes
  `{ provider: 'github', owner: 'carlos-rezai', repo: 'FamilyFlix',
releaseType: 'draft' }` and `win.verifyUpdateCodeSignature: false`, both
  guarded. `electron:package` publishes `'never'` unless `--publish`.
  `.github/workflows/release.yml` on `v*` tags only. A release commit reads
  `chore: [release] v<version>`. **Publishing the Draft release is the
  release.** The first Release is **v0.2.0**; 0.1.0 is never published.

---

## Phase 1: The bridge and the row's idle answer

**User stories**: 13, 14, 15, 16, 17, 18, 19, 20, 30, 31, 32, 33, 34, 47, 48,
49, 50, 51, 52, 53, 54, 55, 56, 58, 59, 60, 62

### What to build

The tracer bullet: a press of **Check for updates** travels from the About
card through the bridge to main and back as a snackbar, in every Shell mode.

First commit: the four prototype amendments in `docs/handoff/` — the
_Installing and restarting…_ line, the `updating` button as a disabled
`prim.Button` primary `md`, the new `checking` face, and the confirmation's
`duration: 5000`. Nothing is built until the prototype draws every face.

Then the contract (the shared types module and the optional global), and
`createUpdates` with `start()`, `current()` and `check()`: disabled answers
`unavailable` and never checks on launch; enabled, a launch check is silent on
refusal and never rejects; a pressed check is `refused` on a rejection or a
`null` result with `lastCheckedAt` unchanged, otherwise `none` or `found` by
`isUpdateAvailable` with `lastCheckedAt = now()`. The `error` listener and the
logger are in from the start, because an unlistened `error` throws in main.

The preload as the third bundle and the fifth asar file, and `main.ts` wiring
the unit to three `ipcMain` handlers, the status send, and `start()` after the
window opens.

In the renderer: `updateBridge`, `useSoftwareUpdate` (`null` until `current()`
lands, then following `onStatus`; `checking` true for the life of a check;
unsubscribing on unmount; never rejecting), `updateFace` with all four faces
and every label boundary (the pure function is whole now even though only idle
and checking can be reached), and the row — the UploadIcon tile, title, line
and button, with the full-bleed hairline under it — inside the About card's new
geometry (`overflow: hidden`, no padding, the row at `18px 20px`, the hairline,
the brand row at `16px 20px`). The row's three answers through `useSnackbar()`:
`none` success, `refused` error, `unavailable` info, `found` nothing. With no
bridge the row returns `null` and takes its hairline with it.

`fakeUpdateBridge` in `src/test-support/`: `current()` and `check()` answers
set by the test, `emit(status)`, `install()` recorded, removed after the block.

### Acceptance criteria

- [ ] The prototype draws the amended `updating` line and button, the
      `checking` face, and a 5000ms confirmation, committed before any code
- [ ] `createUpdates`' suite proves: launch check once when enabled and never
      when disabled, never rejecting; the four outcomes; `null` and rejection
      both `refused`; `lastCheckedAt` advancing on `none` and `found` only; an
      `error` event logs one line and changes nothing; the logger drops `debug`;
      `autoDownload` and `autoInstallOnAppQuit` left on
- [ ] The build script's suite asserts three bundles; the packaging guard
      asserts five asar files including the preload
- [ ] `updateFace` covers every face, the precedence, and the _Last checked_
      boundaries (59 s, 1 minute, 59 minutes, 1 hour, 1 day, `null`)
- [ ] `updateBridge` is `null` with no global and the member with one
- [ ] The row draws idle and checking faces, pushes each outcome's snackbar (or
      none for `found`), and is absent with its hairline without a bridge
- [ ] `AboutSection`'s suite: the row above the brand row with a bridge,
      exactly today's card without one
- [ ] `npm run dev` in a browser shows today's About card
- [ ] Under `electron:start`, **Check for updates** shows `Checking…` and then
      _Updates are only available in the installed app._

---

## Phase 2: Offered and installing on the row

**User stories**: 21, 22, 23, 25, 26, 27, 28, 29

### What to build

The row learns the rest of what main knows. `update-downloaded` sets `offered`
and pushes the whole status; the row draws the _offered_ face — the version in
the accent over **Update now** — whether the download landed before Settings
was opened or while it is on screen. **Update now** calls `install()`, which is
a no-op with no offer, and otherwise pushes `installing`, awaits the Ordered
shutdown — cancelling a running Import or Enrichment exactly as closing the
window would, and closing the database — and only then calls
`quitAndInstall(true, true)`. The row draws _Installing and restarting…_ over a
disabled `Updating…` from the pushed status, not from its own press, so a
later install started elsewhere shows the same face.

### Acceptance criteria

- [ ] `createUpdates`' suite: `update-downloaded` sets `offered` and pushes the
      whole status; `install()` with no offer does nothing; with one it pushes
      `installing` before `shutdown()` and calls `quitAndInstall(true, true)`
      only after `shutdown()` resolves
- [ ] The row draws the offered face from an emitted status, the installing
      face from an emitted `installing`, and **Update now** calls `install()`
- [ ] A status emitted while the row is mounted redraws it (a launch check
      answering while Settings is open)
- [ ] The offered version never appears in the brand row

---

## Phase 3: The offer snackbar and the congratulation

**User stories**: 1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 24, 57

### What to build

The family's surface. A headless notice, mounted once in `App` inside the
`SnackbarProvider`, doing nothing with no bridge. The **offer**: info, title
_Update available_, `FamilyFlix <v> is ready to install.`, action **Update
now** → `install()`, persisting until pressed or dismissed. It is pushed **once
per renderer load** — when `current()` lands with `offered` set or when
`onStatus` first brings one — held by a ref that also keeps the notice id, so
StrictMode cannot double it. The **retraction**: a status with `installing`
true dismisses the offer, so pressing **Update now** on the row takes the
snackbar away. The **congratulation**: success, `FamilyFlix updated to <v>.`,
on the first load where the **Seen version** differs from `__APP_VERSION__`,
and never on a fresh install where there is none. `seenVersion` reads and
writes the version this machine last ran in `localStorage` under try/catch, the
`volumePreference` precedent.

### Acceptance criteria

- [ ] The offer is pushed once on `current()` or on the first `onStatus`, never
      twice under StrictMode, and persists
- [ ] Its **Update now** calls `install()`; an emitted `installing` retracts it
- [ ] The congratulation shows on a changed Seen version, never on an absent
      or unchanged one, and the Seen version is then the running version
- [ ] `seenVersion` reads and writes over `localStorage` and tolerates a
      throwing storage
- [ ] With no bridge the notice pushes nothing

---

## Phase 4: The release feed's config

**User stories**: 35, 36, 37, 38, 39, 40, 41, 42, 44, 45, 61

### What to build

Everything a release needs that can be written and guarded without making one.
`repository` in `package.json`; the `publish` block as a draft GitHub provider
and `win.verifyUpdateCodeSignature: false` in `builderConfig.json`, with the
packaging guard's _names no release feed_ leaf becoming _names the release
feed_ — provider `github`, owner/repo equal to `repository`, release type
`draft`, signature verification off. `electron:package` gains `--publish`
(passing `publish: 'always'`), defaulting to `'never'` so a local package
uploads nothing — it now writes `app-update.yml`, which is correct.
`.github/workflows/release.yml` on `push: tags: ['v*']` only: `windows-latest`,
`contents: write`, Node 22 with the npm cache, `npm ci` → typecheck → vitest by
path → package with `--publish` and `GH_TOKEN` from the workflow's own token.
`.npmrc` sets the release commit message, and CLAUDE.md's _Commit Messages_
gains the release line, the one shape with no `issue #<n>`. The release
checklist gains its _Publish_ and _Update round-trip_ sections: the offer from
the previous version, **Update now**, _Installing and restarting…_, the
relaunch, the congratulation and the About card's version; the quit path on
the next version; **Check for updates** with the network off; the Sandbox
`.wsb` if needed.

### Acceptance criteria

- [ ] The packaging guard asserts the draft GitHub feed against `repository`
      and `verifyUpdateCodeSignature: false`
- [ ] `electron:package` without `--publish` passes `'never'`; with it,
      `'always'` (the build script's suite)
- [ ] `release.yml` triggers on `v*` tags only and never on pushes to `main`
- [ ] `.npmrc` makes `npm version`'s commit read `chore: [release] v<version>`,
      and the commit gate accepts that subject
- [ ] `docs/release-checklist.md` carries the _Publish_ and _Update
      round-trip_ sections

---

## Phase 5: The first release and the round-trip (HITL)

**User stories**: 2, 3, 43, 46

### What to build

The proof on a real install. **Gated** on the `desktop-packaging` fix for the
Sandbox blank window (diagnosed with `--disable-gpu` and a `.wsb` with
`<vGPU>Disable</vGPU>`) — an issue still to be filed, because the smoke is the
release and a smoke that paints nothing proves nothing.

`npm version minor` → v0.2.0 → `git push --follow-tags` → the workflow's
Draft release → the Package smoke against the draft's Installer → publish →
installed by hand on the parents' PC, replacing 0.1.0, the last manual install.
Then `npm version patch` → v0.2.1 → draft → smoke → publish, and the
round-trip on the 0.2.0 install, ticked against the checklist.

### Acceptance criteria

- [ ] The Sandbox blank-window fix is closed before the first publish
- [ ] The v0.2.0 tag's workflow typechecks, tests, packages and uploads the
      Installer, `latest.yml` and the blockmap to a Draft release
- [ ] v0.2.0 passes the Package smoke, is published, and installed by hand
- [ ] On 0.2.0, launching offline opens the library with nothing drawn, and a
      pressed check answers _FamilyFlix couldn't check for updates._
- [ ] v0.2.1 published: the 0.2.0 install is offered it, **Update now**
      relaunches into 0.2.1 with _FamilyFlix updated to 0.2.1._ once, and the
      About card reads 0.2.1
- [ ] The quit path is proven on the next version

---

## Phase 6: Docs and refactor

**User stories**: — (closes the initiative)

### What to build

CLAUDE.md's folder map (the preload, `createUpdates`,
`features/software-update/`, `.github/`, the new shared types and global), its
Settings Hub and Desktop Build sections, and the build-order chain closed with
no step left. README, COMPONENT-SPEC's `page.SettingsPage` row, the glossary
(log 17 Q57's two corrections), and the dev journal. Then the refactor, then
**Software update** ticked ✅ in README, CLAUDE.md and COMPONENT-SPEC.

### Acceptance criteria

- [ ] CLAUDE.md, README, COMPONENT-SPEC and the glossary describe what shipped
- [ ] The build-order chain says there is no step left
- [ ] The refactor round is done before the tick
