# Plan: Electron desktop shell — one window over its own server, offline

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/215

Today FamilyFlix is a terminal, `npm run dev` and a browser tab. This is build
step 7: the **Desktop shell** that gives the family something to double-click.
Packaging (step 8) and Software update (step 9) both wait on it.

**The renderer is not rewritten.** The window loads the server's own origin,
so the 47 relative `/api` call sites, every `<video>` and `<img>` source and
`BrowserRouter` work unchanged. Electron is never launched in a test: every
unit's world is injected, and each phase ends in a manual smoke.

The slicing follows the PRD's six-step build order, with three of those steps
split so that every phase can be demoed on its own:

**the window over the server** (Phase 1, the tracer) → **the ordered
shutdown** (Phase 2) → **the App mark, amended** (Phase 3, HITL) → **the App
mark, shipped** (Phase 4) → **the installed shape** (Phase 5) → **offline**
(Phase 6) → **the Loopback guard** (Phase 7) → **the window's rules**
(Phase 8) → **failures and logs** (Phase 9) → **docs** (Phase 10).

The splits:

- PRD step 1 becomes Phases 1 and 2. Closing the window mid-film is its own
  demo.
- PRD step 2 becomes Phases 3 and 4. The prototype amendment is a docs-only
  HITL issue, so `issue-loop` stops before it rather than inside it.
- PRD step 5 becomes Phases 7, 8 and 9. The server's guard, the window's
  policy and the failure handling do not depend on one another.

## Architectural decisions

These apply across all phases:

- **Process shape.** Main forks the Express server with
  `utilityProcess.fork()` on Electron's own Node. Main is a composition root
  with no logic of its own. Its logic lives in small units under `electron/`,
  each with its world injected.
- **Shell handshake.** It is typed once in a shared types module that both
  sides import:
  - `ServerMessage = { type: 'ready'; port } | { type: 'fatal'; message }`
  - `ShellCommand = { type: 'shutdown' }`

  The server's half lives in a new `server/src/shell/` infrastructure folder
  beside `db/`. It is not a domain. Without `process.parentPort` it does
  nothing, so `dev:server` keeps its own signal handlers.

- **One origin.** The window loads `http://127.0.0.1:<port>/`. The server
  serves the built renderer beside `/api`. There is no CORS, no preload, no
  `window.familyflix`, and no runtime API base URL.
- **Bind.** The server always binds `127.0.0.1`, standalone included. Vite's
  proxy targets `http://127.0.0.1:3001`.
- **Ports.**

  | Run                     | Port                                                                                 |
  | ----------------------- | ------------------------------------------------------------------------------------ |
  | Installed shape         | **Shell port** `41720`; if it is taken, port `0`, and `ready` reports the bound port |
  | `electron:dev`          | `3001`                                                                               |
  | Standalone `dev:server` | `PORT`; a taken port still throws                                                    |

- **Data paths.**
  - Packaged: main sets `FAMILYFLIX_DB_PATH`, `FAMILYFLIX_MEDIA_PATH` and
    `FAMILYFLIX_COMPONENT_PATH` under `%APPDATA%\FamilyFlix\`, beside
    `logs\`.
  - Unpackaged: all three stay unset, so the repo's own library is used, and
    `userData` becomes `FamilyFlix (dev)`.
  - `package.json` gains `"productName": "FamilyFlix"` and `"main"`.
- **Environment additions.**
  - `FAMILYFLIX_RENDERER_PATH`: the built renderer to serve. When unset,
    nothing is mounted.
  - `FAMILYFLIX_TRUSTED_HOSTS`: comma-separated. The default is
    `localhost:4200`; the installed app sets it empty.
  - `FAMILYFLIX_SQLITE_BINDING`: the Electron-ABI `better_sqlite3.node`,
    passed as the library's `nativeBinding`.
  - `FAMILYFLIX_SHELL_PROD`: read by main only; it runs the installed shape
    unpackaged.
- **CSP.** Sent on the served renderer only, never on `/api`:
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://image.tmdb.org; media-src 'self' blob:;
font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'`.
- **Window.** One `BrowserWindow`:
  - Title FamilyFlix, `backgroundColor: '#14110d'`, and `show: false` until
    `ready-to-show`, then maximized.
  - Minimum size 1024×640, default frame, no remembered bounds.
  - `contextIsolation`, `sandbox` and `webSecurity` on; `nodeIntegration`
    off; no preload.
- **Identity.** `APP_USER_MODEL_ID = 'io.github.carlosrezai.familyflix'`,
  set before the window exists.
- **Scripts.** Every tool is called by path, with no `npx` and no shell.
  `npm run dev` is unchanged. Three scripts are added: `electron:dev`,
  `electron:start` and `electron:native`.
- **Typecheck.** `tsconfig.electron.json` is a fourth project in the
  solution file. The commit gate's `test:` narrowing builds app, server and
  electron. Electron's tests go in `tsconfig.spec.json` and declare the node
  environment.

---

## Phase 1: Tracer — the window over the server

**User stories**: 1, 2, 3, 4, 7, 26 (the bind), 37, 38, 40, 41, 42, 44, 45, 46

### What to build

`npm run electron:dev` opens one maximized FamilyFlix window over Vite, and
the library in it works end to end.

1. Main forks the server from source (`--import tsx`) on `3001` and waits
   for the Shell handshake's `ready`.
2. Once `ready` arrives, main opens the window onto `#14110d` with no white
   flash. It loads `localhost:4200`, retrying until Vite answers.
3. A second launch restores and focuses the first window, then exits.

The unpackaged run keeps the default menu and opens DevTools. Its
`userData` is `FamilyFlix (dev)`.

This phase also makes the rest possible:

- The server binds `127.0.0.1`, and Vite's proxy follows it.
- The database opener passes `nativeBinding` when
  `FAMILYFLIX_SQLITE_BINDING` is set. `electron:native` fetches the
  Electron-ABI prebuild into a gitignored `electron/.native/`, so Vitest,
  still on Node's ABI, is never turned red.
- esbuild, called through its API from one script, watches main.
- `electron/` becomes its own typecheck project, is covered by the commit
  gate, Vitest and ESLint, and holds its first units: `serverLaunch` (dev
  only for now), `serverHandle`, `rendererUrl`.

### Acceptance criteria

- [ ] `npm run electron:dev` shows the library in a maximized window titled
      FamilyFlix, with no white flash. HMR works in it.
- [ ] A second `electron .` focuses the first window and exits.
- [ ] `npm run dev` is byte-for-byte unchanged in behaviour.
- [ ] The standalone server listens on `127.0.0.1` only. Vite's proxy
      reaches it.
- [ ] The shell handshake:
  - [ ] Without a parent port, `shellHandshake` is inert.
  - [ ] Under one, it posts `ready` with the bound port.
  - [ ] It posts `fatal` when opening the library or listening throws.
- [ ] `serverHandle`, with fork injected:
  - [ ] `ready` resolves with the reported port.
  - [ ] `fatal` rejects with its message.
  - [ ] It rejects at the 15 s timeout.
  - [ ] Exit before `ready` rejects.
  - [ ] Exit after `ready` calls `onExit`.
- [ ] `serverLaunch` covers the dev combination: the source entry,
      `--import tsx`, port `3001`, the SQLite binding set, and none of the
      three path variables set.
- [ ] `rendererUrl` returns `localhost:4200` in dev and
      `127.0.0.1:<port>` otherwise.
- [ ] The database opener passes `nativeBinding` only when the variable is
      set.
- [ ] After `electron:native` and an Electron run, `vitest run` is still
      green.
- [ ] `commitTypecheck`'s tests say a `test:` commit builds app, server and
      electron. The full typecheck includes `tsconfig.electron.json`.

---

## Phase 2: Ordered shutdown

**User stories**: 11, 12, 23, 24, 25

### What to build

Closing the window mid-film just closes: the resume position is kept, and no
`-wal` file is left behind.

The **Ordered shutdown** is one server function. It serves both the
handshake's `shutdown` command and `SIGINT`/`SIGTERM`, and runs in this order:

1. Cancel the **Current run** (the importer's `cancel()` rolls back the
   folder in flight).
2. Cancel the **Current enrichment run**.
3. `closeAllConnections()`, **before** `close()`.
4. Close the database, checkpointing the WAL.
5. Exit `0`.

On `before-quit`, main sends `shutdown` and waits through `awaitExitOrKill`,
killing the server at 5 s.

### Acceptance criteria

- [ ] The ordered shutdown:
  - [ ] It cancels the import and the sync.
  - [ ] It drops connections before closing.
  - [ ] It closes the database and exits `0`.
  - [ ] An open streaming response does not delay it.
- [ ] `shellHandshake`'s `shutdown` runs the ordered shutdown. The standalone
      server's signal handlers run the same function.
- [ ] `awaitExitOrKill` resolves when the child exits in time, and kills it
      at the deadline.
- [ ] `serverHandle.shutdown(ms)` sends the command.
- [ ] Smoke: close the window during playback.
  - [ ] The app exits within 5 s.
  - [ ] No `familyflix.db-wal` remains.
  - [ ] Continue Watching resumes at the right place on the next launch.
- [ ] Smoke: close the window during an import. No half-copied Movie folder
      survives.

---

## Phase 3: The App mark — prototype amendment (HITL)

**User stories**: 34

### What to build

The prototype draws only the **Wordmark**. The **App mark** is added to the
handoff before any code uses it.

`familyflix-mark.svg` goes in the handoff's brand folder:

- **F** in `#f3ece0` and **F** in `#d97a4e`.
- Source Serif 4 at 700, with the glyphs outlined to paths (a one-off in a
  scratch directory, adding no dependency).
- On a `#14110d` square with a 22% corner radius.

Preview PNGs at 256, 512 and 1024 go beside it. COMPONENT-SPEC registers the
mark as a brand asset. This phase is docs only and needs the maintainer's
eye.

### Acceptance criteria

- [ ] `familyflix-mark.svg` exists in the handoff's brand folder, with
      outlined paths and no `<text>` or font reference.
- [ ] The 256, 512 and 1024 preview PNGs sit beside it.
- [ ] COMPONENT-SPEC registers the App mark as a brand asset.
- [ ] The maintainer approves the mark.

---

## Phase 4: The App mark in the app

**User stories**: 5, 6, 35, 36

### What to build

The mark appears everywhere the app is seen: the title bar, the taskbar,
Alt+Tab, a pinned shortcut, and the browser tab under `npm run dev`.

A build-icon script uses `sharp` (a devDependency) to render, from the
amended SVG:

- `electron/assets/icon.ico` at 16, 24, 32, 48, 64, 128 and 256.
- `public/favicon.ico`.
- The PNGs.

It is run by hand when the mark changes, and its outputs are committed.

The window uses the icon in every run. `appIdentity` sets the App User Model
ID before the window is created, so a pinned shortcut keeps the mark instead
of Electron's.

### Acceptance criteria

- [ ] `iconSizes` reads the committed `.ico` header and asserts all seven
      sizes.
- [ ] `appIdentity` exposes `io.github.carlosrezai.familyflix`, and main sets
      it before creating the window.
- [ ] The favicon under `npm run dev` is the App mark.
- [ ] Smoke: the taskbar, Alt+Tab and the title bar show the mark, and a
      pinned shortcut keeps it.

---

## Phase 5: The installed shape

**User stories**: 10, 17, 18, 29, 31, 32, 33, 39, 43

### What to build

`npm run electron:start` runs the app as it will be installed, without an
installer:

1. `nx build` builds the renderer.
2. build-electron emits two CJS bundles with esbuild: main, with `electron`
   external, and the server, with `better-sqlite3` external and `seriesSeed`
   excluded.
3. Main forks the bundled server with `FAMILYFLIX_SHELL_PROD=1` and
   `FAMILYFLIX_RENDERER_PATH` set.

When the renderer path is set, the server mounts `rendererRouter`. It serves
the built files under the CSP and answers `index.html` for any GET outside
`/api`. `/api` is never shadowed, and an unknown `/api` path is still the
API's own 404.

The server listens on the **Shell port** `41720`, so `localStorage` (the
volume) survives a relaunch. Under the shell, a taken port falls back to an
ephemeral one, reported in `ready`. Standalone, a taken port still throws.

`serverLaunch` learns the packaged combination: the three path variables
under `userData` (`%APPDATA%\FamilyFlix\`, named by `productName`), and
`FAMILYFLIX_TRUSTED_HOSTS` set empty. Unpackaged runs, `electron:start`
included, still use the repo's library.

### Acceptance criteria

- [ ] `rendererRouter`:
  - [ ] A static file is served.
  - [ ] A deep route gets `index.html`.
  - [ ] The CSP header is present on the renderer and absent on `/api`.
  - [ ] `/api` is not shadowed, and an unknown `/api` path is a 404.
  - [ ] Nothing is mounted when the variable is unset.
- [ ] The listen step:
  - [ ] It binds `127.0.0.1`.
  - [ ] Under the shell, a taken port falls back to ephemeral and `ready`
        carries the bound port.
  - [ ] Standalone, a taken port throws.
- [ ] `serverLaunch` covers every combination of packaged, prod flag and dev:
  - [ ] The entry and whether `--import tsx` is passed.
  - [ ] The port.
  - [ ] Which path variables are set.
  - [ ] Trusted hosts, the renderer path and the SQLite binding.
- [ ] build-electron runs with no `npx` and no shell, and emits the two
      bundles. `package.json` has `"main"` and `"productName": "FamilyFlix"`.
- [ ] Smoke under `electron:start`:
  - [ ] A reload on `/series/3/season/2` stays there.
  - [ ] The volume survives a relaunch.
  - [ ] A film plays.
  - [ ] Enrichment's TMDB candidate posters still draw under the CSP.

---

## Phase 6: Offline

**User stories**: 9

### What to build

The library looks the same with the network cable out. Source Serif 4,
Hanken Grotesk and JetBrains Mono come from `@fontsource`, at the weights the
tokens use, imported once at the renderer's entry. The Google Fonts `<link>`s
and `preconnect`s are removed, and the page's `<title>` reads **FamilyFlix**.

### Acceptance criteria

- [ ] `index.html` has no Google Fonts link or preconnect, and its `<title>`
      is `FamilyFlix`.
- [ ] Every family and weight the typography tokens name is imported from
      `@fontsource`.
- [ ] `font-src 'self'` in the CSP is satisfied: no font request leaves the
      origin.
- [ ] Smoke: with the network off, the wordmark is Source Serif, not
      Georgia.

---

## Phase 7: The Loopback guard

**User stories**: 26, 27, 28

### What to build

Only the machine itself can talk to the server, and only through
FamilyFlix's own origin. `loopbackGuard` is middleware mounted in front of
everything. It answers `403` in two cases:

- `Host` is not a **Trusted host**.
- An `Origin` is present and is not a trusted origin.

The trusted hosts are `127.0.0.1:<bound>`, `localhost:<bound>` and whatever
`FAMILYFLIX_TRUSTED_HOSTS` lists. The guard receives the bound port after
`listen`. A request with no `Origin` from a trusted `Host` passes, which is
what keeps `<video>`, `<img>` and the Vite proxy working.

### Acceptance criteria

- [ ] `loopbackGuard`, through supertest:
  - [ ] A trusted `Host` passes.
  - [ ] A foreign `Host` gets `403`, including a DNS-rebinding name.
  - [ ] The `localhost` spelling of the bound port passes.
  - [ ] A foreign `Origin` on a trusted `Host` gets `403`.
  - [ ] A trusted `Origin` passes.
  - [ ] No `Origin` passes.
  - [ ] The variable's list is honoured, the default `localhost:4200`
        included.
  - [ ] An empty list trusts only the bound port.
- [ ] Smoke: `npm run dev`, `electron:dev` and `electron:start` all still
      work, and a `POST` from a page on another origin is refused.

---

## Phase 8: The window's rules

**User stories**: 8, 13, 14, 30

### What to build

The window can only ever be FamilyFlix.

- **`windowPolicy`**, pure:
  - `isAppUrl` blocks navigation off the app's origin.
  - `openExternalAllowed` sends `https:` links to the default browser and
    drops anything else. `window.open` is always denied.
  - `permissionAllowed` grants `fullscreen` only.
- **`downloadPath`**, pure: `(dir, filename, exists) → a free path`,
  deduplicated as Chromium does it (`name (1).ext`). `will-download` saves
  into Downloads with no dialog.
- **Menu:** the installed app has none (`Menu.setApplicationMenu(null)`).
  Unpackaged runs keep theirs.

### Acceptance criteria

- [ ] `windowPolicy`:
  - [ ] The same origin is an app URL; another port, host or scheme is not.
  - [ ] `https:` is allowed out; `http:`, `file:` and `javascript:` are not.
  - [ ] `fullscreen` is granted and every other permission is refused.
- [ ] `downloadPath` covers a free name, `(1)`, `(2)`, a file with no
      extension, and dotted names.
- [ ] Smoke:
  - [ ] An export lands in Downloads as `family-library.csv`, then
        `family-library (1).csv`, with no dialog.
  - [ ] Player fullscreen fills the screen.
  - [ ] The installed shape shows no menu bar.

---

## Phase 9: Failures and logs

**User stories**: 15, 16, 19, 20, 21, 22

### What to build

When something breaks, the family always has something to press, and the
maintainer has one file to ask for.

- **Startup dialog.** _FamilyFlix couldn't start._, with the error as its
  detail and **Quit** / **Show data folder**. It covers a `fatal`, the 15 s
  timeout and a crash before `ready`.
- **Unexpected exit.** If the server exits after `ready`, _FamilyFlix
  stopped unexpectedly._ offers **Restart** (`app.relaunch()` then exit) and
  **Quit**.
- **Renderer crash.** `render-process-gone` reloads the window once.
- **`shellLog`**, file system injected.
  - In the installed app, main's output and the server's stdout/stderr
    append to `logs\familyflix.log`, tagged `[main]` and `[server]`.
  - At startup, a file over 5 MB is renamed to `familyflix.old.log`,
    replacing the previous one.
  - Unpackaged runs print the same tagged lines to the terminal.

### Acceptance criteria

- [ ] `shellLog`:
  - [ ] Lines are tagged `[main]` and `[server]`.
  - [ ] A file over 5 MB is rolled; one under 5 MB is not.
  - [ ] An old log is replaced.
  - [ ] Terminal mode writes no file.
- [ ] Each of the three startup failures (fatal, timeout, early exit)
      reaches the startup dialog. Show data folder opens `userData`.
- [ ] Smoke:
  - [ ] Killing the server process offers Restart, and Restart brings the
        library back.
  - [ ] Crashing the renderer (`chrome://crash` from DevTools) reloads the
        window once.

---

## Phase 10: Docs

**User stories**: none directly. This phase closes the initiative's promises
to the next reader.

### What to build

CLAUDE.md:

- The environment section, with the five additions.
- The folder map, with `electron/` and its units and `server/src/shell/`.
- The commit gate's three shipping projects.
- Step 7's line, with the folder-path autofill clause struck.
- The Roadmap's new **Move the media folder**, which takes over _Change…_.

Elsewhere:

- The README's scripts: `electron:dev`, `electron:start` and
  `electron:native`.
- The **Save to computer** glossary entry now says the file goes straight to
  Downloads, with no dialog.
- `04-movie-detail` Q14 is marked settled (`BrowserRouter` stays).
- `17-software-update` Q13's parenthetical now says the preload never
  carries an API base URL.

**Electron desktop shell** is **not** ticked ✅ here. That waits for the
initiative's refactor.

### Acceptance criteria

- [ ] CLAUDE.md's environment, folder map, commit gate section, step 7 entry
      and Roadmap match what shipped.
- [ ] The README documents the three `electron:*` scripts.
- [ ] The glossary's **Save to computer** entry is corrected.
- [ ] Design logs 04 and 17 point at this initiative's answer.
- [ ] Step 7 is still 🔜 in README and CLAUDE.md.
