# Plan: Desktop packaging — one Windows installer, the App mark on every surface

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/227

Step 7 gave FamilyFlix a window, but only from the repo. This is build step 8:
`npm run electron:package` turns the repo into one file,
`FamilyFlix-Setup-0.1.0.exe`, that the maintainer double-clicks on the parents'
PC. Step 9 (Software update) waits on it.

**Nothing here launches Electron or runs an NSIS install in a test.** Every
unit's world is injected — plain strings for Electron's three locations, a
buffer and an expected digest, the committed JSON read as data — and each
installer phase ends in the **Package smoke** in Windows Sandbox.

The slicing follows the PRD's five-step build order, with its first step split
in two because the paths and the dependencies do not depend on each other:

**the installed shape's paths** (Phase 1, the tracer) → **no `node_modules` to
ship** (Phase 2) → **the first Installer** (Phase 3) → **FFmpeg on board**
(Phase 4) → **hardening** (Phase 5) → **docs** (Phase 6, docs-only).

## Architectural decisions

These apply across all phases:

- **Target.** Windows x64 only. Nothing is published: `publish`,
  `repository`, `release.yml` and `npm version` are step 9's.
- **The packager.** `electron-builder`, a devDependency, driven through its JS
  API `build()` from `packageApp.mjs`, never through its CLI shim. Every step
  of `electron:package` is called by path with no shell (the `npx` rule):
  `nx build` → `buildElectron.mjs` → `fetchNative.mjs` → `fetchFfmpeg.mjs` →
  `build()` with NSIS x64 and `publish: 'never'`. `--dir` stops at
  `release/win-unpacked/`. No typecheck and no tests run inside it.
- **Config home.** `electron/packaging/` holds `builderConfig.json`,
  `ffmpegPin.json` and `packagingConfig.test.ts`. JSON, so the guard needs no
  parser; no `build` key in `package.json`. Step 9 adds `publish` to the same
  file.
- **The Installer.** NSIS, `oneClick: true`, `perMachine: false`,
  `runAfterFinish: true`, desktop and Start-menu shortcuts named `FamilyFlix`,
  installed to `%LOCALAPPDATA%\Programs\FamilyFlix\` with no UAC prompt.
  `deleteAppDataOnUninstall: false`, stated rather than defaulted.
  `artifactName: FamilyFlix-Setup-${version}.${ext}`, output to `release/`.
- **The Packaged layout.**

  | Where                                  | What                                                               |
  | -------------------------------------- | ------------------------------------------------------------------ |
  | `resources\app.asar`                   | `package.json`, the main bundle, the server bundle, `icon.ico`     |
  | `resources\renderer\`                  | the built renderer                                                 |
  | `resources\native\better_sqlite3.node` | the Electron-ABI binding `electron:native` fetches                 |
  | `resources\ffmpeg\`                    | `ffmpeg.exe`, `ffprobe.exe`, `LICENSE.txt`, `README.txt` (Phase 4) |

  No `asarUnpack` globs, no `node_modules`.

- **`shellPaths`.** One pure unit:
  `shellPaths(mode, { appPath, resourcesPath, userData }) →
{ app, icon, serverEntry, renderer, sqliteBinding, ffmpeg, serverCwd }`, read
  once in main beside `shellMode`. Unpackaged (`dev`, `start`), `appPath` is
  the repo, every path is today's, `ffmpeg` is `null` and `serverCwd` is the
  repo. Installed, the icon and both bundles come from `appPath` (inside
  `app.asar`), the renderer, the binding and `ffmpeg.exe` from
  `resourcesPath`, and `serverCwd` is `userData`.
  `serverLaunch(mode, userData, paths)` is built on it.
- **The installed server's environment.** Log 24's, plus
  `FAMILYFLIX_SQLITE_BINDING` (`resources\native\…`) and
  `FAMILYFLIX_FFMPEG_PATH` (the shipped `ffmpeg.exe`), both set only in
  `installed`. The binding seam is now the same in every Shell mode;
  `npmRebuild: false`, and the repo's `node_modules` is never rebuilt in place.
- **FFmpeg, the Default component.** gyan.dev's _release essentials_, Windows
  x64, one exact version, GPL with `libx264` and the NVENC/QSV/AMF encoders.
  The **FFmpeg pin** is `{ version, url, sha256 }`. The Component slot's
  precedence is unchanged: slot `current/`, then `FAMILYFLIX_FFMPEG_PATH`,
  then `PATH`.
- **Identity.** `appId` is `io.github.carlosrezai.familyflix`, equal to
  `APP_USER_MODEL_ID`. `"version": "0.1.0"` by hand, `"author": "Carlos
Rezai"`, `copyright: "Copyright © 2026 Carlos Rezai"`, `productName`
  `FamilyFlix`. Unsigned; `signAndEditExecutable: true` stays, because it is
  the rcedit step.
- **The App mark.** One `electron/assets/icon.ico` for `win.icon`,
  `nsis.installerIcon`, `nsis.installerHeaderIcon`, `nsis.uninstallerIcon`
  and the window (through `shellPaths`). The shortcuts, Start and the
  uninstall entry's `DisplayIcon` use the exe's own.
- **Fuses.** `runAsNode: false`, `enableNodeOptionsEnvironmentVariable: false`,
  `enableNodeCliInspectArguments: false`, `onlyLoadAppFromAsar: true`. Not
  `enableEmbeddedAsarIntegrityValidation`.
- **Vocabulary.** The file is the **Installer**, the installed tree the
  **Packaged layout**. The shipped FFmpeg is the **Default component**, never
  "bundled".

---

## Phase 1: Tracer — the installed shape's paths, unpackaged

**User stories**: 17, 18, 34, 35, 36

### What to build

Every path the shell and the server need comes from one pure unit per Shell
mode, and main stops reading `process.cwd()`. `shellPaths` answers the icon,
both bundles, the renderer, the SQLite binding, FFmpeg and the server's working
directory from Electron's three locations. `serverLaunch` takes `ShellPaths`
instead of a `cwd`, and its `installed` branch gains
`FAMILYFLIX_SQLITE_BINDING` pointing at `resources\native` — superseding log
24 Q19's "packaging rebuilds for Electron". `nativeBindingPath` folds into
`shellPaths`. Main loses its `ICON` constant; the window icon is `paths.icon`
and the fork's `cwd` is `paths.serverCwd`.

No installer yet. The proof is that nothing a developer runs has changed.

### Acceptance criteria

- [ ] `shellPaths` is tested in `dev`, `start` and `installed` for every field
- [ ] Unpackaged paths equal today's paths under the repo; `ffmpeg` is `null`;
      `serverCwd` is the repo
- [ ] Installed paths split between `appPath` and `resourcesPath` as the
      layout table says; `serverCwd` is `userData`
- [ ] `serverLaunch`'s entry is `paths.serverEntry` and its renderer path is
      `paths.renderer` in every mode
- [ ] `installed` sets `FAMILYFLIX_SQLITE_BINDING` from `ShellPaths`; `dev`
      and `start` keep the repo's `.native` binding
- [ ] `main.ts` no longer reads `process.cwd()` and has no `ICON` constant
- [ ] Manual smoke: `electron:dev` and `electron:start` open the library
      exactly as before, with the App mark on the window

---

## Phase 2: No `node_modules` to ship

**User stories**: 33, 37, 38

### What to build

The server bundle stops treating `better-sqlite3` as external, so its JS is
bundled like every other package; its lazy `bindings` require never runs,
because every Shell mode passes `nativeBinding`. Every package in
`dependencies` moves to `devDependencies`, leaving `dependencies: {}`, and a
guard test holds it there so a package added later cannot ship silently in the
Installer.

### Acceptance criteria

- [ ] The esbuild server bundle no longer lists `better-sqlite3` as external
- [ ] `package.json`'s `dependencies` is `{}`, guarded by a test
- [ ] Manual smoke: `electron:start` opens the library on the bundled
      `better-sqlite3` and the Electron-ABI binding
- [ ] `npm run dev` and Vitest still run on the package's own binding, green

---

## Phase 3: The first Installer

**User stories**: 1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14, 15, 16, 25, 26, 27, 28, 39, 40, 41, 42, 43, 44, 45

### What to build

`npm run electron:package` produces `release/FamilyFlix-Setup-0.1.0.exe`, a
one-click, per-user NSIS Installer that wears the App mark on the setup file,
its progress window, the exe, the shortcuts, the taskbar, a pin, Alt+Tab, Task
Manager, the uninstaller and _Settings → Apps_. `packageApp.mjs` runs the
build chain by path through `electron-builder`'s JS API with
`builderConfig.json`; `--dir` writes only `release/win-unpacked/`. The asar
holds only the manifest, the two bundles and the icon; the renderer and the
binding go to `extraResources`, with `npmRebuild: false` so the repo's
`node_modules` is never touched. `package.json` gains `0.1.0`, `author` and
the scripts; the About card, the Installer's file name and the exe's file
version all read the version. Uninstalling leaves `%APPDATA%\FamilyFlix\`.

The Electron binding and the Electron runtime are read from the same installed
`electron` version.

No FFmpeg ships yet: an MP4 direct-plays, anything else answers `cannot-play`
on a clean machine.

### Acceptance criteria

- [ ] `packagingConfig.test.ts`: `appId` equals the imported
      `APP_USER_MODEL_ID`
- [ ] The guard: all four icon fields name `electron/assets/icon.ico`
- [ ] The guard: `oneClick: true`, `perMachine: false`,
      `deleteAppDataOnUninstall: false`, `npmRebuild: false`
- [ ] The guard: each `extraResources` `to` is the directory `shellPaths`
      reads under `resourcesPath`
- [ ] `electron:package --dir` writes `release/win-unpacked/` with the
      Packaged layout and no `node_modules`
- [ ] `electron:package` writes `release/FamilyFlix-Setup-0.1.0.exe`, with no
      console window flashing during the run
- [ ] About reads `0.1.0`; the exe carries the icon, the version and
      FileDescription `FamilyFlix`
- [ ] Package smoke step 1: SmartScreen once, the one-click window with the
      mark, the app opens maximized
- [ ] Package smoke step 2: the mark on the shortcuts, the taskbar, Alt+Tab, a
      pin and _Settings → Apps_ (publisher Carlos Rezai, version 0.1.0); Task
      Manager says FamilyFlix; the pin and the window are one button
- [ ] Package smoke step 4: uninstall leaves `%APPDATA%\FamilyFlix\`; a
      reinstall shows the same library
- [ ] A direct-played MP4 plays in the installed app
- [ ] Back on the dev machine, Vitest is green right after a package

---

## Phase 4: FFmpeg on board

**User stories**: 6, 9, 19, 20, 21, 22, 23, 24

### What to build

The Installer carries the pinned FFmpeg build as the **Default component**.
`ffmpegPin.json` holds `{ version, url, sha256 }`. `electron:ffmpeg`
downloads the pinned archive, refuses it through a pure `verifyDigest` when the
SHA-256 does not match, extracts only `ffmpeg.exe`, `ffprobe.exe` and the
licence into a gitignored `electron/.ffmpeg/`, writes a `README.txt` naming the
build, its version and where its source is published, and skips everything
when the extracted copy already matches. `packageApp.mjs` runs it before the
packager, and the build config ships it to `resources\ffmpeg\`. `shellPaths`
answers the shipped `ffmpeg.exe` when installed, and `serverLaunch` sets
`FAMILYFLIX_FFMPEG_PATH` to it — in `installed` only, so dev runs keep the
FFmpeg on `PATH`. The Component slot is unchanged: an upload still overrides
the Default component on the next Play, and removing it falls back.

### Acceptance criteria

- [ ] `verifyDigest`: a matching digest passes; a mismatch refuses with both
      digests in the message
- [ ] The guard: the pin's `sha256` is 64 hex characters and its `url` is
      `https:`
- [ ] The guard: the `resources\ffmpeg` `extraResources` target matches
      `shellPaths`
- [ ] `shellPaths` answers `ffmpeg` under `resourcesPath` when installed,
      `null` unpackaged
- [ ] `serverLaunch`: `installed` sets `FAMILYFLIX_FFMPEG_PATH`; `start` and
      `dev` set none
- [ ] `electron:ffmpeg` skips the download when the extracted copy matches the
      pin, and works offline then
- [ ] The Packaged layout's `resources\ffmpeg\` holds exactly `ffmpeg.exe`,
      `ffprobe.exe`, `LICENSE.txt` and `README.txt` — no `ffplay.exe`
- [ ] Package smoke step 3: import the fixture; an `.mkv` remuxes and plays;
      the Codec report shows **Default**; About reads `0.1.0`
- [ ] Uploading a pair overrides the Default component on the next Play, and
      the ✕ falls back to it

---

## Phase 5: Hardening

**User stories**: 30, 31

### What to build

The four Electron fuses close the run-as-Node doors and pin the app to its
asar: `runAsNode`, `enableNodeOptionsEnvironmentVariable` and
`enableNodeCliInspectArguments` off, `onlyLoadAppFromAsar` on. The server's
`utilityProcess` reads none of them, so the installed app still forks its
server.

### Acceptance criteria

- [ ] The guard holds the four fuse values, and that
      `enableEmbeddedAsarIntegrityValidation` is not set
- [ ] Package smoke steps 1–4 pass again on the hardened Installer
- [ ] `ELECTRON_RUN_AS_NODE=1 FamilyFlix.exe` opens the app, not a Node prompt;
      `NODE_OPTIONS` and `--inspect` have no effect
- [ ] A stray `app` folder beside the asar does not replace the code

---

## Phase 6: Docs

**User stories**: 29, 32

### What to build

The written record of the step, docs-only. CLAUDE.md gains the two installed
environment variables (`FAMILYFLIX_SQLITE_BINDING` in every mode,
`FAMILYFLIX_FFMPEG_PATH` when installed), `shellPaths` and
`electron/packaging/` in the folder map, _Desktop Build_'s packaging line, and
step 8's entry. README gains `electron:package`, installing on a new machine,
and the one SmartScreen click. The **Package smoke** is written down as the
release checklist. COMPONENT-SPEC's **App mark** row registers the packaged
exe, the Installer and the uninstaller as consumers — a registration, not a
pixel change. **Desktop packaging** is not ticked ✅ until its refactor.

### Acceptance criteria

- [ ] CLAUDE.md: environment variables, folder map, _Desktop Build_ and step 8
      updated; no ✅ yet
- [ ] README: `electron:package`, installing on a new machine, SmartScreen's
      _More info → Run anyway_
- [ ] The Package smoke is written step by step: install, every icon surface,
      an `.mkv`, the Codec report, About, uninstall and reinstall
- [ ] COMPONENT-SPEC's App mark row names the new consumers
