## Problem Statement

I am the maintainer, and my parents are the people who use this app. Step 7
gave FamilyFlix a desktop window, but it only runs from the repo:
`npm run electron:start` in a terminal, on a machine with Node, the repo's
`node_modules`, and FFmpeg on `PATH`. My parents' PC has none of those. For them
the app still does not exist. There is nothing to download, nothing to
double-click, and nothing in the Start menu.

The shell already has an **Installed app** branch, but no installer has ever
taken it, and the code makes assumptions that an installer would break:

- **`process.cwd()` is assumed to be the repo.** Main builds the window's icon
  from it. `serverLaunch` builds the server bundle's path and the renderer's
  path from it too. In an installed app, `cwd` is wherever the shortcut started,
  and those files sit inside `resources\`.
- **The SQLite binding is left to a rebuild.** The `installed` branch sets no
  `FAMILYFLIX_SQLITE_BINDING`, because log 24 Q19 assumed packaging would
  rebuild `better-sqlite3` for Electron. `electron-builder`'s default rebuild
  does that **in place** in the repo's `node_modules`. That is Horizon's
  papercut: Vitest goes red after every package.
- **`dependencies` lists eleven packages.** Vite or esbuild bundles every one
  of them except `better-sqlite3`, yet a packager would ship them all as a
  `node_modules` tree.
- **No FFmpeg ships.** CLAUDE.md says the installer bundles FFmpeg as the
  **Default component**. Nothing sets `FAMILYFLIX_FFMPEG_PATH`. On a clean
  machine, every `.mkv` and `.avi` in the family folder would answer
  `cannot-play`.
- **The App mark stops at the window.** The exe, the installer, the
  uninstaller, the shortcuts and _Settings → Apps_ would all show Electron's
  stock icon.
- **The version is `0.0.0`.** There is no `author`, so Windows lists no
  publisher.

This is step 8 of the build order. Step 9 (Software update) waits on it.

## Solution

**`npm run electron:package` turns the repo into one file,
`FamilyFlix-Setup-0.1.0.exe`.** The maintainer double-clicks it on the
parents' PC and FamilyFlix is installed.

- **One click, no questions.** The setup is a one-click, per-user NSIS
  installer. It shows no wizard and no UAC prompt. It installs to
  `%LOCALAPPDATA%\Programs\FamilyFlix\`, creates a desktop shortcut and a
  Start-menu shortcut, both named **FamilyFlix**, and opens the app when it
  finishes.
- **It wears the App mark everywhere Windows draws an icon.** That covers the
  setup file, its progress window, the exe, the shortcuts, Start, the taskbar,
  a pin, Alt+Tab, Task Manager, the uninstaller and _Settings → Apps_. All of
  them come from the one `icon.ico` the SVG is rendered into. The taskbar
  groups the shortcut, the window and a pin as one button, because the
  installer's `appId` and the process's App User Model ID are the same string,
  and a test holds them together.
- **It plays everything the family owns.** The installer carries a pinned GPL
  FFmpeg build with `libx264` as the **Default component**, verified by
  SHA-256 before it is packed. On a machine with no FFmpeg, an `.mkv` remuxes
  and plays, and the Codec report shows **Default**. An uploaded component
  still overrides it on the next Play.
- **The parents' films survive an uninstall.** Uninstalling removes the
  **Packaged layout** and never touches `%APPDATA%\FamilyFlix\`. That folder
  holds the database, the managed media, the **Component slot** and the
  **Shell log**. A reinstall opens on the same library, and a test pins the
  flag rather than trusting the default.
- **Packaging never touches the repo's `node_modules`.** The Electron-ABI
  binding that `electron:native` already fetches ships as
  `resources\native\better_sqlite3.node`, through the same
  `FAMILYFLIX_SQLITE_BINDING` seam the unpackaged runs use. Nothing is rebuilt
  in place, and Vitest is green straight after a package.
- **The installer ships no `node_modules` at all.** `dependencies` is emptied,
  `better-sqlite3`'s JS is bundled into the server, and the asar holds only
  `package.json`, the two bundles and the icon.
- **Nothing can turn the exe into Node.** Four Electron fuses close the
  run-as-Node doors.
- **It has a real identity.** The version is `0.1.0`, and the About card, the
  installer's file name and the exe's file version all read it. The publisher
  is **Carlos Rezai**, and Task Manager says **FamilyFlix**, not _Electron_.
- **It is unsigned, on purpose.** The first install meets SmartScreen once and
  the maintainer clicks _More info → Run anyway_. Updates installed by step 9
  are not prompted again.

## User Stories

### The family

1. As a parent, I want FamilyFlix on my desktop and in the Start menu, so that I open it the way I open everything else.
2. As a parent, I want the shortcut called FamilyFlix with the FamilyFlix mark, so that I recognise it among my other icons.
3. As a parent, I want the app to open by itself the first time it is installed, so that I see the library straight away.
4. As a parent, I want a pinned taskbar button to keep the FamilyFlix mark and to be the same button as the running window, so that I don't see two icons or Electron's stock one.
5. As a parent, I want Task Manager and Alt+Tab to say FamilyFlix, so that nothing on my screen calls it Electron.
6. As a parent, I want my `.mkv` films to play on my own PC with nothing else installed, so that the whole family folder works, not just the MP4s.
7. As a parent, I want the app to open fast and quietly with no setup questions, so that installing it is not my job.
8. As a parent, I want my library to still be there if the app is ever reinstalled, so that no film or watch history is lost.
9. As a parent, I want hardware video encoding used when my PC has it, so that a converted film doesn't strain the machine.

### The maintainer

10. As the maintainer, I want one command that builds the installer, so that a release is not a checklist I can get wrong.
11. As the maintainer, I want the installer named `FamilyFlix-Setup-<version>.exe` in `release/`, so that I can tell versions apart in my Downloads folder.
12. As the maintainer, I want a one-click, per-user install with no UAC prompt, so that it works on my parents' standard account and step 9 can update it silently.
13. As the maintainer, I want the setup file and its progress window to show the App mark, so that the download looks like the app it installs.
14. As the maintainer, I want _Settings → Apps_ to list FamilyFlix with its mark, its version and me as the publisher, so that the entry is recognisable when I uninstall or check the version over the phone.
15. As the maintainer, I want the uninstaller to show the App mark, so that every Windows surface is consistent.
16. As the maintainer, I want uninstalling to leave `%APPDATA%\FamilyFlix\` untouched, guarded by a test, so that the only copy of the managed media can never be deleted by a default someone changed.
17. As the maintainer, I want the installed app to find its bundles, renderer, binding and FFmpeg from where the installer put them, whatever directory the shortcut starts in, so that a shortcut with an odd working directory can't break startup.
18. As the maintainer, I want the installed server to run with its working directory in `userData`, so that a relative path never resolves inside an asar or Program Files.
19. As the maintainer, I want the installer to carry one exact, pinned FFmpeg build, so that rebuilding the same version gives the same installer.
20. As the maintainer, I want the FFmpeg download refused when its SHA-256 doesn't match the pin, so that a tampered or corrupted binary never ships.
21. As the maintainer, I want the FFmpeg download skipped when the extracted copy already matches the pin, so that repeat packages are fast and work offline.
22. As the maintainer, I want only `ffmpeg.exe`, `ffprobe.exe`, the build's licence and a README naming the build and where its source is published, so that the installer is no bigger than it must be and honours the GPL.
23. As the maintainer, I want the bundled FFmpeg to be the Default component exactly as the Codec report already describes it, so that uploading a pair and removing it again behaves as it does today.
24. As the maintainer, I want the installer's FFmpeg used only by the installed app, so that my dev runs keep the FFmpeg on my `PATH`.
25. As the maintainer, I want the version set to `0.1.0`, so that the About card, the installer and the exe agree on the first release, and step 9 has a version to offer an update over.
26. As the maintainer, I want `FamilyFlix.exe` stamped with the icon and version even though it is unsigned, so that skipping a certificate doesn't mean shipping Electron's atom icon.
27. As the maintainer, I want no code-signing certificate bill and no root certificate planted on my parents' machine, so that a free project stays free and their trust store stays clean.
28. As the maintainer, I want a `--dir` build that writes only the unpacked layout, so that I can check what lands in `resources\` without waiting for NSIS.
29. As the maintainer, I want a written smoke in Windows Sandbox covering install, every icon surface, an `.mkv`, the Codec report, About, uninstall and reinstall, so that every release is proven on a clean machine like my parents'.
30. As the maintainer, I want `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` and `--inspect` to have no effect on `FamilyFlix.exe`, so that nothing on the machine can use the app as a Node interpreter.
31. As the maintainer, I want the app to load only from its asar, so that a stray `app` folder beside it can't replace the code.
32. As the maintainer, I want README to explain installing on a new machine, including the one SmartScreen click, so that I can do it again in a year without rediscovering it.

### The developer

33. As a developer, I want Vitest green straight after a package, so that packaging never costs a reinstall of `node_modules`.
34. As a developer, I want `electron:dev` and `electron:start` to behave exactly as before once main stops reading `process.cwd()`, so that the shell's paths change without changing its runs.
35. As a developer, I want every path the shell needs to come from one pure unit per mode, so that the installed layout is tested without installing anything.
36. As a developer, I want the same SQLite binding seam in every Shell mode, so that there is one way the server finds its native module.
37. As a developer, I want `dependencies` empty and guarded by a test, so that a package added later cannot ship silently in the installer.
38. As a developer, I want `better-sqlite3`'s JS bundled into the server like everything else, so that the asar needs no `node_modules`.
39. As a developer, I want the packager driven through its JS API from a script, with every step called by path, so that a package flashes no console windows and steals no focus.
40. As a developer, I want the packaging config in its own JSON file under `electron/packaging/`, so that `package.json` stays a manifest and the guard needs no YAML parser.
41. As a developer, I want a test that the installer's `appId` equals the shell's App User Model ID, so that the Horizon pin bug can't come back.
42. As a developer, I want a test that every icon field in the config names the one `icon.ico`, so that no surface quietly falls back to a default.
43. As a developer, I want a test that every `extraResources` target is a directory the shell reads, so that the layout and the code can't drift apart.
44. As a developer, I want the Electron binding and the Electron runtime read from the same installed `electron` version, so that the two cannot disagree.
45. As a developer, I want the config to have the shape step 9 extends by adding `publish`, so that the updater adds a block instead of restructuring.

## Implementation Decisions

Every decision below comes from design log 25. The log's question numbers are
in parentheses.

### Scope (Q1–Q2)

- One initiative, `desktop-packaging`. It covers the `electron-builder` config,
  the installer, the packaged layout, the bundled FFmpeg, the bundled
  Electron-ABI binding and the first version.
- **Windows x64 only.**
- It publishes nothing. The release feed (`publish`, `repository`,
  `release.yml`, `npm version`) stays with step 9 (log 17 Q3/Q26/Q27).

### The installer (Q3–Q6)

- **`electron-builder`**, a devDependency, is driven through its JS API
  `build()` from a script and never through its CLI shim.
- **NSIS, one-click, per-user:** `oneClick: true`, `perMachine: false`,
  `runAfterFinish: true`, desktop and Start-menu shortcuts named
  `FamilyFlix`. It installs to `%LOCALAPPDATA%\Programs\FamilyFlix\` with no
  UAC prompt.
- **`deleteAppDataOnUninstall: false`** is stated explicitly and guarded by a
  test.
- `artifactName: FamilyFlix-Setup-${version}.${ext}`, output to `release/`,
  which is already gitignored.

### The Packaged layout (Q7–Q9)

- **`app.asar`** holds only `package.json`, the main bundle, the server bundle
  and `icon.ico`.
- **`extraResources`**, outside the asar, holds everything the server serves,
  spawns or `dlopen`s:
  - `resources\renderer\`, from the built renderer;
  - `resources\ffmpeg\`, holding `ffmpeg.exe`, `ffprobe.exe`, `LICENSE.txt`
    and `README.txt`;
  - `resources\native\better_sqlite3.node`.

  `asarUnpack` globs were rejected.

- **`dependencies` becomes `{}`.** Every package moves to `devDependencies`.
  The esbuild build stops treating `better-sqlite3` as external, so its JS is
  bundled into the server. Its lazy `bindings` require never runs, because
  every Shell mode passes `nativeBinding`.

### The SQLite binding (Q10, Q12)

- `npmRebuild: false`. The package script runs `electron:native` and ships its
  one file.
- `serverLaunch`'s `installed` branch now sets `FAMILYFLIX_SQLITE_BINDING` to
  `resources\native\better_sqlite3.node`. This **supersedes log 24 Q19's last
  sentence** and corrects the PRD 24 environment table's "main when
  unpackaged" to "main in every mode".

### `shellPaths`, a new pure unit (Q11)

- Signature: `shellPaths(mode, { appPath, resourcesPath, userData }) →
{ app, icon, serverEntry, renderer, sqliteBinding, ffmpeg, serverCwd }`.
- It is read once in main, beside `shellMode`.
- **Unpackaged** (`dev`, `start`): `appPath` is the repo, and every path is
  today's.
  - `ffmpeg` is `null`, so `PATH` stands in.
  - `serverCwd` is the repo.
- **Installed:**
  - The icon and both bundles come from `appPath` (inside `app.asar`).
  - The renderer, the binding and `ffmpeg.exe` come from `resourcesPath`.
  - `serverCwd` is `userData`, because a fork cannot run with its working
    directory inside an asar.
- `serverLaunch(mode, userData, cwd)` becomes
  `serverLaunch(mode, userData, paths)`. `nativeBindingPath(cwd)` folds into
  `shellPaths`.
- `main.ts` loses `process.cwd()` and its `ICON` constant. The window icon is
  `paths.icon`, and the fork's `cwd` is `paths.serverCwd`.

### The installed server's environment (Q12)

- Log 24's environment, plus two variables, both set **only** in `installed`:
  - `FAMILYFLIX_SQLITE_BINDING`;
  - `FAMILYFLIX_FFMPEG_PATH`, the bundled `ffmpeg.exe`.
- `dev` keeps the repo's `.native` binding and `PATH`'s FFmpeg, as today.
  `start` does the same.

### FFmpeg, the Default component (Q13–Q15)

- **A pinned build:** gyan.dev's _release essentials_ for Windows x64, one
  exact version. It is GPL, with `libx264` (`choosePlaybackPath`'s software
  fallback) and the NVENC, QSV and AMF encoders `ffmpegComponent` probes.
- **The pin** is `{ version, url, sha256 }` in `ffmpegPin.json`, under
  `electron/packaging/`.
- **`electron:ffmpeg`** (`fetchFfmpeg.mjs`):
  - downloads the pinned archive;
  - **refuses on a SHA-256 mismatch**, through a pure `verifyDigest`;
  - extracts only `ffmpeg.exe`, `ffprobe.exe` and the licence into a
    gitignored `electron/.ffmpeg/`, and writes the `README.txt` naming the
    build, its version and its source;
  - skips everything when the extracted copy already matches the pin;
  - never ships `ffplay.exe`.
- **GPL:** FFmpeg ships as a separate spawned program, so the app is an
  aggregate beside it. The licence and the source pointer travel with the
  binaries.
- **The Component slot is unchanged.** The precedence is still the slot's
  `current/`, then `FAMILYFLIX_FFMPEG_PATH`, then `PATH`. The bundled build is
  the **Default component**: not removable, pill **Default**. An upload
  overrides it on the next Play.
- Rejected: binaries committed to git, an unpinned "latest" URL, and an LGPL
  build.

### Electron (Q16–Q17)

- **`electronFuses`:**
  - `runAsNode: false`;
  - `enableNodeOptionsEnvironmentVariable: false`;
  - `enableNodeCliInspectArguments: false`;
  - `onlyLoadAppFromAsar: true`.

  `utilityProcess` reads none of them.

- **Not** `enableEmbeddedAsarIntegrityValidation`, because on Windows it needs
  a signed exe.
- The Electron version is whatever `node_modules/electron` holds, and
  `electron:native` reads the same one. Pinning `electron` is not this
  initiative's business.

### The App mark on every surface (Q18–Q20)

- One `electron/assets/icon.ico` feeds every surface:
  - `win.icon`, which rcedit stamps into the exe;
  - `nsis.installerIcon` and `nsis.installerHeaderIcon`;
  - `nsis.uninstallerIcon`;
  - the uninstall entry's `DisplayIcon`, which is the exe;
  - the shortcuts and Start, which use the exe's own icon;
  - the window icon, through `shellPaths`.
- `signAndEditExecutable` stays `true`. It is the rcedit step, and it runs
  with no certificate.
- `appId` is `io.github.carlosrezai.familyflix`, which equals
  `APP_USER_MODEL_ID`.
- COMPONENT-SPEC's **App mark** row gains the consumers _the packaged exe, the
  installer and the uninstaller, through `electron/packaging/`_. It is a
  registration, not a pixel change.
- No NSIS sidebar artwork, because a one-click installer has none.

### Trust and identity (Q21–Q23)

- **Unsigned.** There is no OV or EV certificate and no self-signed root.
- `package.json` gains `"author": "Carlos Rezai"`. `copyright` reads
  `Copyright © 2026 Carlos Rezai`. `productName` stays `FamilyFlix`, which is
  also the exe's FileDescription.
- **`"version": "0.1.0"`**, set by hand. `npm version` is step 9's.

### The build (Q24–Q25)

- **`npm run electron:package`** runs `packageApp.mjs`. Every step is called
  by path with no shell, in this order:
  1. `nx build`;
  2. `buildElectron.mjs`;
  3. `fetchNative.mjs`;
  4. `fetchFfmpeg.mjs`, which skips when the pin already matches;
  5. `electron-builder`'s `build()` with `builderConfig.json`, NSIS x64 and
     `publish: 'never'`.
- `--dir` builds `release/win-unpacked/` only.
- It runs no typecheck and no tests. Those belong to the commit gate and to
  step 9's CI.
- **`electron/packaging/`** holds `builderConfig.json`, `ffmpegPin.json` and
  `packagingConfig.test.ts`. The config is JSON so the guard needs no parser,
  and there is no `build` key in `package.json`. Step 9 adds `publish` to the
  same file.

### Module map

| Unit                                    | Kind           | Role                                                                                                |
| --------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------- |
| `shellPaths`                            | new, pure      | mode + Electron's three locations → every path the shell and the server need                        |
| `serverLaunch`                          | modified, pure | takes `ShellPaths`; `installed` adds `FAMILYFLIX_SQLITE_BINDING` and `FAMILYFLIX_FFMPEG_PATH`       |
| `main.ts`                               | modified       | wiring only: `shellPaths` once, beside `shellMode`; no `cwd`, no `ICON`                             |
| `buildElectron.mjs`                     | modified       | `better-sqlite3` bundled, no longer external                                                        |
| `verifyDigest` / `fetchFfmpeg.mjs`      | new            | the pure digest check, and the download → verify → extract script (`electron:ffmpeg`)               |
| `packageApp.mjs`                        | new            | the five-step `electron:package`, with `--dir`                                                      |
| `builderConfig.json` / `ffmpegPin.json` | new, data      | the installer's config and the FFmpeg pin                                                           |
| `packagingConfig.test.ts`               | new, guard     | holds the config, the pin, `package.json` and `shellPaths` to each other                            |
| `package.json`                          | modified       | `0.1.0`, `author`, `dependencies: {}`, `electron-builder`, `electron:package` and `electron:ffmpeg` |

### Build order (Implementation Plan)

1. **The installed shape, unpackaged.**
   - `shellPaths`, with `serverLaunch` built on it.
   - `main.ts` stops reading `cwd`.
   - `better-sqlite3` is bundled and `dependencies` is emptied.
   - Proof: `electron:dev` and `electron:start` are unchanged, and Vitest is
     green.
2. **The first installer.**
   - `electron-builder`, with `builderConfig.json` and its guard.
   - The App mark on the exe, the installer and the uninstaller.
   - `packageApp.mjs` with `--dir`.
   - The binding in `resources\native`.
   - `0.1.0` and `author`.
   - Smoke: Sandbox steps 1, 2 and 4, plus a direct-played MP4.
3. **FFmpeg on board.**
   - The pin, `fetchFfmpeg.mjs` with `verifyDigest`, and `resources\ffmpeg`.
   - `FAMILYFLIX_FFMPEG_PATH` when installed.
   - Smoke: Sandbox step 3.
4. **Hardening.**
   - The four fuses.
   - Smoke: Sandbox steps 1–4 again, plus `ELECTRON_RUN_AS_NODE=1` opening
     the app rather than a Node prompt.
5. **Docs.**
   - CLAUDE.md: the environment variables, the folder map, _Desktop Build_'s
     packaging line, and step 8's entry.
   - README: `electron:package`, installing on a new machine, and the
     SmartScreen click.
   - COMPONENT-SPEC's App mark row.
   - The ✅ waits for the refactor (Q27).

## Testing Decisions

- **A good test here checks a unit's contract through its public interface,
  with its world injected.** That means plain strings for the three Electron
  locations, a buffer and an expected digest, or the committed JSON files read
  as data. Electron is never launched in a test, and no test runs an NSIS
  install.
- **`shellPaths`** (node environment):
  - every field in `dev`, `start` and `installed`;
  - unpackaged paths equal today's paths under the repo;
  - installed paths split between `appPath` and `resourcesPath` as the log's
    table says;
  - `ffmpeg` is `null` unpackaged;
  - `serverCwd` is `userData` when installed.
- **`serverLaunch`**, extending its suite:
  - `installed` now sets `FAMILYFLIX_SQLITE_BINDING` and
    `FAMILYFLIX_FFMPEG_PATH` from `ShellPaths`;
  - `start` and `dev` still set no `FAMILYFLIX_FFMPEG_PATH`;
  - the entry is `paths.serverEntry` in every mode;
  - the renderer path is `paths.renderer`.
- **`verifyDigest`:**
  - a matching digest passes;
  - a mismatch refuses with both digests in the message.
- **`packagingConfig`**, the guard:
  - `appId` equals the imported `APP_USER_MODEL_ID`;
  - all four icon fields name `electron/assets/icon.ico`;
  - `oneClick`, `perMachine`, `deleteAppDataOnUninstall` and `npmRebuild` hold
    the values above;
  - each `extraResources` `to` is the directory `shellPaths` reads under
    `resourcesPath`;
  - `package.json`'s `dependencies` is `{}`;
  - the pin's `sha256` is 64 hex characters and its `url` is `https:`.
- **Not unit-tested,** but proven by the **Package smoke** in Windows Sandbox
  (Q26):
  1. Install: SmartScreen, then the one-click window with the mark, then the
     app opens maximized.
  2. The mark is on the shortcuts, the taskbar, Alt+Tab, a pin and _Settings →
     Apps_. Task Manager says FamilyFlix.
  3. Import the fixture: an `.mkv` remuxes and plays, the Codec report shows
     **Default**, and About reads `0.1.0`.
  4. Uninstall leaves `%APPDATA%\FamilyFlix\`, and a reinstall shows the same
     library.
  5. Back on the dev machine, Vitest is green right after a package.

  The fuses get their own check (slice 4).

- **Prior art:**
  - `serverLaunch.test.ts` and `shellMode.test.ts` for pure mode-by-mode
    tables;
  - `iconSizes.test.ts` for a test over a committed artifact;
  - `componentBinary` for a security boundary as a pure function;
  - `commitTypecheck.test.ts` for a guard that mostly says what must _not_
    relax.

## Out of Scope

- The release feed: `publish`, `repository`, `release.yml`, `npm version` and
  `electron-updater` (step 9, log 17).
- Code signing of any kind, and asar integrity validation.
- arm64, macOS and Linux.
- An assisted installer, a directory picker, installer artwork, and portable
  or MSI builds.
- Auto-launch at login and a tray icon.
- Backing up or migrating an existing library on install. The maintainer
  imports it once.
- Pinning the `electron` version exactly.
- Running typecheck or tests inside `electron:package`.

## Further Notes

- Design log: `docs/design-logs/25-desktop-packaging.md`. Glossary: the
  _Desktop packaging_ section of `docs/ubiquitous-language.md` (**Installer**,
  **Packaged layout**, **FFmpeg pin**, **Package smoke**, and the updated
  **Installed app**, **App mark**, **App version** and **Default component**).
  Call the file the **Installer** and the installed tree the **Packaged
  layout**. Never call the Default component "bundled".
- This PRD supersedes log 24 Q19's _"the installed app needs none of it,
  because packaging rebuilds for Electron"_, and PRD 24's environment row for
  `FAMILYFLIX_SQLITE_BINDING`.
- It answers what log 17 left to packaging: NSIS, unsigned rather than
  self-signed (Q11), and the App version leaving `0.0.0`.
- The trade-off that is accepted: bundling `better-sqlite3`'s JS relies on its
  `bindings` require staying lazy. A future version that loads eagerly would
  fail the first smoke, not a unit test.
- **Desktop packaging** is ticked ✅ in README and CLAUDE.md only after its
  refactor (Q27).
