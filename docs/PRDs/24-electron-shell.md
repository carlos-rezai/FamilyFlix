## Problem Statement

I am the maintainer, and my parents are the people who use this app. Today,
running FamilyFlix means a terminal, `npm run dev`, and a browser tab pointed
at `localhost:4200`. My parents can't do any of that. For them the app does not
exist yet: they have nothing to double-click, no window, and nothing in the
taskbar.

Much of the code already expects a desktop shell, but none exists:

- **`electron/` holds only a `.gitkeep`.** There is no `electron` dependency,
  no main process and no window.
- **The server listens on every interface.** `app.listen(PORT)` with no host
  means anyone on the family's Wi-Fi can reach the library's write routes, and
  any web page open in the family's browser can send a simple `POST` to it.
- **Its paths wait on the environment.** `FAMILYFLIX_DB_PATH`,
  `FAMILYFLIX_MEDIA_PATH` and `FAMILYFLIX_COMPONENT_PATH` are each documented
  as "Electron main sets this", and nothing sets them.
- **Shutdown is a bare `server.close()`.** A film playing in the window holds
  a streaming connection open, and `close()` waits for it. The import and sync
  in flight are not cancelled first.
- **The fonts need the internet.** Source Serif 4, Hanken Grotesk and
  JetBrains Mono come from Google's CDN, so on an offline machine the wordmark
  falls back to Georgia.
- **The app has no icon.** The favicon is the Nx scaffold's default. The
  prototype draws no square mark, only the **Wordmark**.
- **A reload breaks.** `BrowserRouter` fails on a `file://` reload, as flagged
  in `04-movie-detail` Q14 and left to this step.

This is step 7 of the build order. Packaging (step 8) and Software update
(step 9) both wait on it.

## Solution

**FamilyFlix becomes one Windows desktop window over its own server, and it
works with the network cable out.** The renderer is not rewritten. The window
loads the server's own origin, so every relative `/api` call, every `<video>`
and `<img>` source and `BrowserRouter` work unchanged.

- **One window, one server.** The **Desktop shell** (`electron/`) forks the
  Express server as a `utilityProcess`, waits for the **Shell handshake**'s
  `ready`, and opens a single maximized window on `#14110d` (no white flash).
  A second launch focuses the first window.
- **One origin.** The installed server serves the built renderer beside
  `/api` on `http://127.0.0.1:41720/`, the **Shell port**. The port is fixed
  because `localStorage` (the volume, and later the **Seen version**) belongs
  to an origin. A reload on `/series/3/season/2` stays there.
- **Only the machine itself can reach the server.** It binds `127.0.0.1`
  everywhere, including standalone runs. The **Loopback guard** answers `403`
  to a foreign `Host` or `Origin`. A Content Security Policy covers the served
  renderer.
- **It stops cleanly.** Closing the window runs the **Ordered shutdown**. It
  cancels the **Current run** and the **Current enrichment run**, drops open
  connections, closes the database with no `-wal` left behind, and exits.
  After 5 s the shell kills it.
- **It fails politely.** If the server can't start, a dialog says _FamilyFlix
  couldn't start._ and offers Quit or Show data folder. If the server dies
  later, _FamilyFlix stopped unexpectedly._ offers Restart or Quit. If the
  renderer crashes, the window reloads once. The **Installed app** keeps a
  **Shell log** that the maintainer can ask for.
- **The page can only be FamilyFlix.** The page cannot navigate away from its
  origin. `window.open` hands an `https:` link to the default browser and
  drops anything else. The only permission granted is fullscreen. An export
  lands in Downloads with no dialog, as log 14 promised.
- **It looks like itself.** The **App mark** is the wordmark's two F's in its
  two colours on the app background. It lands first as a prototype amendment,
  then appears on the window, the taskbar, Alt+Tab and the favicon.
- **It works offline.** The fonts are self-hosted through `@fontsource`, and
  the `<title>` reads **FamilyFlix**.
- **Development keeps its speed.** `npm run dev` stays exactly as it is.
  `electron:dev` opens the window over Vite. `electron:start` runs the
  installed shape without an installer. Both unpackaged runs use the repo's
  own library. Vitest never runs under Electron's native ABI, so running
  Electron never turns the test suite red.

## User Stories

### The family

1. As a parent, I want to double-click FamilyFlix and see the library in a big window, so that I never touch a terminal or a browser address bar.
2. As a parent, I want the window to open maximized every time, so that the posters are big without me resizing anything.
3. As a parent, I want the window to open straight onto the dark app background, so that it doesn't flash white first.
4. As a parent, I want the window's title to read FamilyFlix, so that I can find it among my other windows.
5. As a parent, I want the FamilyFlix mark in the taskbar, in Alt+Tab and in the title bar, so that I recognise the app at a glance.
6. As a parent, I want a pinned taskbar shortcut to keep the FamilyFlix mark, so that it doesn't turn into Electron's stock icon.
7. As a parent, I want a second double-click to bring the open window forward instead of starting another copy, so that I don't end up with two libraries on screen.
8. As a parent, I want no File / Edit / View menu, so that the window holds only the app.
9. As a parent, I want the library to look the same with the internet down, fonts included, so that nothing changes when the router is off.
10. As a parent, I want my volume setting remembered between launches, so that I don't turn the sound up every evening.
11. As a parent, I want closing the window mid-film to just close, without hanging, so that I can turn the computer off.
12. As a parent, I want my place in a film kept when I close the window, so that Continue Watching picks it up next time.
13. As a parent, I want fullscreen in the player to fill the screen, so that a film looks like television.
14. As a parent, I want a link that leaves the app to open in my normal browser, so that the app window always stays FamilyFlix.
15. As a parent, I want a clear message and a Restart button if the app stops, so that I'm not left looking at a blank screen with nothing to press.
16. As a parent, I want the window to recover by itself if the page crashes, so that I don't have to restart the app.

### The maintainer

17. As the maintainer, I want the installed app's library, media, playback component and logs under `%APPDATA%\FamilyFlix\`, so that backups are one folder and Program Files is never written to.
18. As the maintainer, I want that folder named FamilyFlix, not the package's npm name, so that I can find it on my parents' machine.
19. As the maintainer, I want a log file on my parents' machine that tags each line `[main]` or `[server]`, so that I can debug remotely by asking for one file.
20. As the maintainer, I want the log rolled over at 5 MB when the app starts, so that it never grows without bound.
21. As the maintainer, I want a startup failure to show the error and a button that opens the data folder, so that the call from my parents gives me something to go on.
22. As the maintainer, I want startup to give up after 15 s with that same dialog, so that a hung server doesn't leave the family staring at nothing.
23. As the maintainer, I want an import or a Sync in progress to be cancelled cleanly when the window closes, so that no half-copied Movie folder survives a shutdown.
24. As the maintainer, I want the database closed with its WAL checkpointed on every exit, so that no `-wal` file is left behind.
25. As the maintainer, I want the server killed if it hasn't exited 5 s after shutdown, so that quitting always ends.
26. As the maintainer, I want the server reachable only from this machine, so that nobody on the home Wi-Fi can reach the library.
27. As the maintainer, I want a web page open in the family's browser to be refused by the server, so that a malicious site can't delete a film with a simple POST.
28. As the maintainer, I want a DNS-rebinding request refused because its `Host` isn't trusted, so that a hostile domain can't pose as loopback.
29. As the maintainer, I want the served renderer under a strict Content Security Policy that still allows TMDB candidate posters, so that the Enrichment review still draws.
30. As the maintainer, I want an export to land in Downloads as `family-library (1).csv` when the name is taken, so that nothing is overwritten and no Save As dialog appears.
31. As the maintainer, I want a reload on any route in the installed shape to stay on that route, so that deep links survive.
32. As the maintainer, I want the app to keep working when port 41720 is taken, falling back to another port for that launch, so that a port collision is an inconvenience, not an outage.
33. As the maintainer, I want the standalone server to still fail loudly on a taken port, so that a port clash in development isn't silently hidden.
34. As the maintainer, I want the App mark to come from the prototype's wordmark and be recorded in the handoff before any code uses it, so that the prototype stays the spec.
35. As the maintainer, I want the icons rebuilt from the SVG by one script, and the `.ico` guarded by a test that it holds all seven sizes, so that a blurry taskbar icon is caught.
36. As the maintainer, I want the favicon to be the App mark as well, so that `npm run dev` in a browser tab looks like the app.

### The developer

37. As a developer, I want `npm run dev` unchanged, so that renderer work keeps its fast browser loop.
38. As a developer, I want `electron:dev` to open the window over Vite with the server forked from source on 3001, so that I can see the shell with HMR.
39. As a developer, I want `electron:start` to run the installed shape (the served renderer, the bundled server and the Shell port) over the repo's library, so that I can smoke-test the installed app without an installer.
40. As a developer, I want unpackaged runs to use their own `userData` (`FamilyFlix (dev)`), so that a dev window never shares a lock, a profile or storage with an installed copy.
41. As a developer, I want Electron's `better-sqlite3` binding fetched once, beside Node's, by `electron:native`, so that Vitest is never red after an Electron run.
42. As a developer, I want unpackaged runs to keep the default menu and open DevTools, so that I can inspect the renderer.
43. As a developer, I want main and the server built by esbuild from one script, with no `npx` and no shell, so that the build steals no focus and has no CJS duplicate to maintain.
44. As a developer, I want `electron/` typechecked as its own shipping project and covered by the commit gate's `test:` narrowing, so that a type error in main is caught.
45. As a developer, I want Electron's logic in small units whose world is injected, so that main's behaviour is tested without launching Electron.
46. As a developer, I want Vite's proxy to target `127.0.0.1`, so that Node's `localhost` → `::1` resolution never misses the IPv4-only listener.

## Implementation Decisions

Every decision below is design log 24's; the log's question numbers are in
parentheses.

### Scope (Q1–Q4)

- One initiative, `electron-shell`. Packaging, `electron-builder`, bundling
  FFmpeg and the release workflow belong to step 8, and the updater to step 9.
- _Change…_ is **not built**. It becomes a Roadmap item, **Move the media
  folder**. The "folder-path autofill in the Movie form" line is struck from
  CLAUDE.md's step 7 entry: CLAUDE.md itself forbids it, and the prototype
  draws no native picker.
- **No preload and no `window.familyflix`.** With one origin the renderer
  needs nothing from main. Step 9 creates both, with `updates` as the first
  member. The API base URL is never among them.

### The server process (Q5–Q9)

- Main runs Express with **`utilityProcess.fork()`**, on Electron's own Node.
- **Shell handshake**, typed once in a shared types module that both sides
  import: `ServerMessage = { type: 'ready'; port } | { type: 'fatal';
message }` and `ShellCommand = { type: 'shutdown' }`.
- **`shellHandshake`**, the server's half, sits in a new `shell/`
  infrastructure folder beside `db/` (it is not a domain). It posts `ready`
  with the **bound** port once listening, posts `fatal` when opening the
  library or listening throws, and runs the shutdown on `shutdown`. When
  `process.parentPort` is absent it does nothing, so `dev:server` is unchanged
  and keeps its signal handlers.
- Main waits **15 s** for `ready`, then shows the startup dialog.
- **Ordered shutdown** is one function that serves both the `shutdown` message
  and `SIGINT`/`SIGTERM`. It cancels the **Current run** (the importer's
  `cancel()` already rolls back the folder in flight) and the **Current
  enrichment run**, calls `closeAllConnections()` **before** `close()`, closes
  the database, and exits `0`. Main sends `shutdown` on `before-quit` and waits
  5 s through `awaitExitOrKill` before killing.
- If the server exits unexpectedly after `ready`, main shows _"FamilyFlix
  stopped unexpectedly."_ with **Restart** (`app.relaunch()` then exit) and
  **Quit**.

### One origin (Q10–Q14)

- The window loads `http://127.0.0.1:<port>/`, served by the server. The 47
  relative call sites, every media source and `BrowserRouter` stay as they
  are. There is no CORS, because there is only one origin.
- **Shell port** `41720` in the installed shape. If it is taken, the server
  under the shell listens on port 0 and reports the port it actually bound in
  `ready`. That launch starts with empty storage. Standalone, a taken port
  still throws. `electron:dev` uses `3001`.
- The server binds **`127.0.0.1` always**, and Vite's proxy target becomes
  `http://127.0.0.1:3001`.
- **`loopbackGuard`** is middleware mounted in front of everything. It answers
  `403` when `Host` is not a **Trusted host**, or when an `Origin` is present
  and is not a trusted origin. The trusted hosts are `127.0.0.1:<bound>`,
  `localhost:<bound>` and `FAMILYFLIX_TRUSTED_HOSTS` (comma-separated; default
  `localhost:4200`; empty in the installed app). It receives the bound port
  after `listen`. A request with no `Origin` from a trusted `Host` passes.
- **CSP**, sent as a response header on the served renderer only:
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://image.tmdb.org; media-src 'self' blob:;
font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'`.

### The renderer (Q15–Q16)

- **`rendererRouter`** is mounted only when `FAMILYFLIX_RENDERER_PATH` is set.
  It serves static files from the built renderer, sends the CSP, and answers
  `index.html` for any GET outside `/api`. When the variable is unset nothing
  is mounted. `/api` routes are never shadowed, and an unknown `/api` path is
  still the API's own 404.
- `electron:dev` loads Vite at `http://localhost:4200`, retrying until it
  answers.
- Fonts come from `@fontsource` (Source Serif 4, Hanken Grotesk and JetBrains
  Mono, at the weights the tokens use), imported once at the renderer's entry.
  The Google Fonts `<link>`s and `preconnect`s are removed. `<title>` becomes
  `FamilyFlix`.

### Data and paths (Q17–Q20)

- **Packaged only:** main sets `FAMILYFLIX_DB_PATH`, `FAMILYFLIX_MEDIA_PATH`
  and `FAMILYFLIX_COMPONENT_PATH` under `userData` (`%APPDATA%\FamilyFlix\`),
  beside `logs\`. `package.json` gains `"productName": "FamilyFlix"`.
- **Unpackaged:** none of the three are set, so the repo's `./familyflix.db`,
  `./media` and `./playback-component` are used. `userData` is redirected to
  `FamilyFlix (dev)`.
- **`better-sqlite3`:** the database opener passes the library's own
  `nativeBinding` option when `FAMILYFLIX_SQLITE_BINDING` is set.
  `electron:native` fetches the Electron-ABI prebuild into a gitignored
  `electron/.native/`, and unpackaged runs point the variable at it. Nothing
  is ever rebuilt in place.
- FFmpeg is untouched. `FAMILYFLIX_FFMPEG_PATH` stays unset here.

### The window (Q21–Q26)

- One `BrowserWindow`: titled FamilyFlix, `backgroundColor: '#14110d'`,
  `show: false` until `ready-to-show`, then maximized. Minimum size 1024×640,
  default frame, no remembered bounds, and the App mark as its icon in every
  run. `webPreferences`: `contextIsolation`, `sandbox` and `webSecurity` on,
  `nodeIntegration` off, no preload.
- Menu: `Menu.setApplicationMenu(null)` when installed. Unpackaged runs keep
  the default menu and open DevTools.
- `requestSingleInstanceLock()`: a second launch restores and focuses the
  first window, then exits.
- **`windowPolicy`**, pure:
  - `isAppUrl` blocks navigation off the app's origin.
  - `openExternalAllowed` lets `https:` go to `shell.openExternal` and drops
    everything else; `window.open` is always denied.
  - `permissionAllowed` grants `fullscreen` only.
- **`downloadPath`**, pure: `(dir, filename, exists) → a free path`,
  deduplicated the way Chromium does it (`name (1).ext`). `will-download` sets
  the save path in `app.getPath('downloads')` with no dialog.
- `render-process-gone` reloads the window once.

### Failure and logs (Q27–Q28)

- **Startup dialog**, _"FamilyFlix couldn't start."_, with the error as its
  detail and **Quit** / **Show data folder**. It covers `fatal`, the 15 s
  timeout and a crash before `ready`.
- **`shellLog`**: in the installed app, main's output and the server's
  stdout/stderr append to `logs\familyflix.log`, tagged `[main]` and
  `[server]`. At startup a file over 5 MB is renamed to `familyflix.old.log`,
  replacing the previous one. Unpackaged runs print the same tagged lines to
  the terminal. The file system is injected.

### The App mark (Q29–Q30)

- A **prototype amendment first**: `familyflix-mark.svg` in the handoff's
  brand folder. It shows **F** in `#f3ece0` and **F** in `#d97a4e`, Source
  Serif 4 at 700 with the glyphs outlined to paths, on a `#14110d` square with
  22% corner radius. COMPONENT-SPEC registers it as a brand asset, with
  preview PNGs at 256, 512 and 1024 beside it.
- A build-icon script uses `sharp` (a devDependency) to render
  `electron/assets/icon.ico` at 16, 24, 32, 48, 64, 128 and 256,
  `public/favicon.ico`, and the PNGs. It is run by hand when the mark changes,
  and its outputs are committed. Outlining is a one-off done in a scratch
  directory and adds no dependency.
- **`appIdentity`**: `APP_USER_MODEL_ID = 'io.github.carlosrezai.familyflix'`,
  set before the window is created.

### Build and tooling (Q31–Q34)

- **esbuild** is an explicit devDependency, driven by a build-electron script
  through its API. It emits two CJS bundles: main, with `electron` external,
  and the server, with `better-sqlite3` external. `package.json` gains
  `"main"` pointing at the main bundle. The server's bundle excludes
  `seriesSeed`, the one file that reads `import.meta`, because main never
  imports it.
- **Scripts:**
  - `electron:dev`: `concurrently` Vite, esbuild watching main, and
    `electron .`. The server is forked from source with `--import tsx`.
  - `electron:start`: `nx build`, build-electron, then `electron .` with
    **`FAMILYFLIX_SHELL_PROD=1`**.
  - `electron:native`: fetches the Electron-ABI binding.

  Every tool is called by path. `npm run dev` is unchanged.

- **`tsconfig.electron.json`**, a fourth project in the solution file, covers
  `electron/**/*.ts` minus tests, with types `node` and `electron`. Tests go
  in `tsconfig.spec.json`. The commit gate's `test:` narrowing builds app,
  server **and electron**. Vitest's `include` gains `electron/**` (those suites
  declare the node environment), and ESLint covers `electron/`.
- **Main is a composition root with no logic.** Its units:

  | Unit              | Role                                                                                                                   |
  | ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
  | `serverLaunch`    | pure: `(isPackaged, prodFlag, userData, cwd)` → `{ entry, execArgv, env }`                                             |
  | `serverHandle`    | fork injected: `start() → { port }`, rejecting on fatal, timeout or early exit; `shutdown(ms)`; `onExit` after `ready` |
  | `awaitExitOrKill` | waits for the exit, and kills at the deadline                                                                          |
  | `rendererUrl`     | pure: dev → `localhost:4200`, otherwise `127.0.0.1:<port>`                                                             |
  | `windowPolicy`    | pure; see _The window_                                                                                                 |
  | `downloadPath`    | pure; see _The window_                                                                                                 |
  | `shellLog`        | file system injected; see _Failure and logs_                                                                           |
  | `appIdentity`     | the App User Model ID                                                                                                  |

### Environment (additions)

| Variable                    | Set by                                        | Meaning                                                              |
| --------------------------- | --------------------------------------------- | -------------------------------------------------------------------- |
| `PORT`                      | main: `41720` installed, `3001` dev           | Unchanged. Under the shell, a taken port falls back to ephemeral     |
| `FAMILYFLIX_RENDERER_PATH`  | main when `FAMILYFLIX_SHELL_PROD` or packaged | The built renderer the server serves; unset mounts nothing           |
| `FAMILYFLIX_TRUSTED_HOSTS`  | main: empty when installed                    | Extra **Trusted hosts**; default `localhost:4200`                    |
| `FAMILYFLIX_SQLITE_BINDING` | main when unpackaged                          | The Electron-ABI `better_sqlite3.node`; unset uses the package's own |
| `FAMILYFLIX_SHELL_PROD`     | `electron:start`                              | Main only: run the installed shape unpackaged                        |

### Build order (Implementation Plan)

1. **The window over the server.** The handshake, the `127.0.0.1` bind, the
   proxy target, `serverLaunch`, `serverHandle`, `awaitExitOrKill`,
   `rendererUrl`, main over Vite, the single-instance lock, the ordered
   shutdown, `electron:native` and `electron:dev`.
2. **The App mark.** The amendment, the icon script, the `.ico`, the favicon,
   the window icon and `appIdentity`.
3. **The installed shape.** `rendererRouter` and its CSP, build-electron, the
   Shell port and its fallback, `userData` paths, `productName` and
   `electron:start`.
4. **Offline.** `@fontsource`, the CDN links removed, the `<title>`.
5. **The window's rules and failures.** `loopbackGuard`, `windowPolicy`,
   `downloadPath`, the menu, `render-process-gone`, the dialogs and
   `shellLog`.
6. **Docs.** CLAUDE.md (environment, the folder map, the commit gate's three
   shipping projects, step 7's line, and the Roadmap's **Move the media
   folder**) and the README's scripts.

## Testing Decisions

- **A good test here exercises a unit's contract through its public
  interface, with its world injected.** That means a fake `fork` whose child
  posts messages, a fake file system, an `exists` predicate, or a request
  through supertest. Electron is never launched in a test. Each phase ends in
  a manual smoke instead: a film plays and closing mid-film exits within 5 s
  leaving no `-wal`; the taskbar shows the mark; a reload on a deep route
  stays; the volume survives a relaunch; with the network off the wordmark is
  still Source Serif; an export lands in Downloads with no dialog; killing
  the server offers Restart.
- **Tested units, Electron side** (the node environment): `serverLaunch`
  (every combination of packaged, prod flag and dev: the entry, the
  `--import tsx` argument, which path variables are set and which are left
  unset, the ports, trusted hosts, renderer path and SQLite binding),
  `serverHandle` (ready resolves with the reported port, fatal rejects with
  its message, the 15 s timeout, exit before ready, exit after ready calls
  `onExit`, shutdown sends the command), `awaitExitOrKill` (exits in time,
  killed at the deadline), `rendererUrl`, `windowPolicy` (same origin versus
  another port, host or scheme; `https:` versus `http:`, `file:` and
  `javascript:`; fullscreen versus the rest), `downloadPath` (free name,
  `(1)`, `(2)`, no extension, dotted names), `shellLog` (tagging, the roll
  over 5 MB, no roll under it, replacing an old log, terminal mode), and
  `appIdentity`.
- **`iconSizes`**: reads the committed `.ico` header and asserts the seven
  sizes.
- **Tested units, server side:**
  - `shellHandshake`: inert without a parent port; `ready` carries the bound
    port; `fatal` on a throw; `shutdown` runs the ordered shutdown.
  - The **ordered shutdown**: cancels the run and the sync, drops connections
    before closing, closes the database, exits `0`. An open streaming response
    does not delay it.
  - `loopbackGuard`: trusted `Host` passes; foreign `Host` gets `403`; the
    `localhost` spelling of the bound port passes; a foreign `Origin` on a
    trusted `Host` gets `403`; a trusted `Origin` passes; no `Origin` passes;
    the variable's list is honoured, including an empty one.
  - `rendererRouter`: a static file is served; a deep route gets `index.html`;
    the CSP header is present on the renderer and absent on `/api`; `/api` is
    not shadowed; nothing is mounted when unset.
  - The database opener passes `nativeBinding` only when the variable is set.
  - The listen step: binds `127.0.0.1`, falls back to ephemeral under the
    shell, and throws standalone.
- **The commit gate**: `commitTypecheck`'s tests say the `test:` narrowing
  builds the three shipping projects.
- **Prior art:** Horizon's `serverHandle`, `awaitExitOrKill` and
  `resolveServerEntry` suites for the Electron units; the routes' supertest
  suites for the guard and the renderer router; `componentSlot`'s injected
  `rename`/`verify` and `spaceUsed`'s sandbox for the file-system seams;
  `commitTypecheck.test.ts` for the gate.

## Out of Scope

- The installer, `electron-builder`, code signing, bundling FFmpeg and the
  release workflow: step 8, **Desktop packaging**.
- The preload, `window.familyflix`, the updater and the About card's
  _Software update_ row: step 9.
- _Change…_ in the Storage group: the Roadmap's **Move the media folder**.
- Native file or folder pickers anywhere, including folder-path autofill in
  the Movie form and a Browse button on Import setup.
- A tray icon, a custom title bar, an application menu, remembered window
  bounds, and auto-launch at login.
- macOS and Linux.
- Backups and restore.

## Further Notes

- Design log: `docs/design-logs/24-electron-shell.md`. Glossary: _The Electron
  shell_ section of `docs/ubiquitous-language.md` (**Desktop shell**, **Shell
  handshake**, **Ordered shutdown**, **One origin**, **Shell port**,
  **Loopback guard**, **Trusted host**, **Installed app**, **Unpackaged run**,
  **Shell log**, **App mark**). Say **Desktop shell** for Electron, never a
  bare "shell", which also names CLAUDE.md's Settings shell.
- This PRD settles `04-movie-detail` Q14 (`BrowserRouter` stays) and replaces
  `17-software-update` Q13's parenthetical: the preload never carries an API
  base URL.
- The **Save to computer** glossary entry's "under Electron, the shell's save
  dialog" is now wrong: there is no dialog, and the file goes straight to
  Downloads. The docs phase corrects it.
- Horizon's lessons, deliberately not repeated: a CJS preload duplicating ESM
  code; two `FORCE_*` flags; `electron-rebuild` toggling `better-sqlite3`
  between ABIs; no log file; a `file://` renderer that forced `HashRouter`,
  CORS `*` and a runtime API URL.
- **Electron desktop shell** is ticked ✅ in README and CLAUDE.md only after
  its refactor (Q35).
