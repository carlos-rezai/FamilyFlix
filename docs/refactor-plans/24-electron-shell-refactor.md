# Refactor plan: Electron desktop shell — one fork path, a main with no logic, the log's placements, and the docs that close the initiative

> Source initiative: [`electron-shell`, issue #215](https://github.com/carlos-rezai/FamilyFlix/issues/215)
> Shipped by issues 216–224. Design log: `docs/design-logs/24-electron-shell.md`.
> Filed as issue 226.
> The docs-and-refactor-filing slice filed as 225 is folded in here as Group 0
> and Group 5, on the precedent of 213 into 214, 200 into 201, 186 into 187,
> 176 into 177, 168 into 169, 163 into 164, 156 into 157, 148 into 149 and 140
> into 141. It is closed at filing so the initiative has one closing issue
> rather than two. The feature table ticks ✅ when this one closes.

## Problem Statement

`electron-shell` is step 7 of the build order and the first step that needs
Electron. It shipped as 53 files and about 5,000 lines across nine slices
(216–224), one of them a prototype amendment (218, the **App mark**). The
maintainer's standing instruction set the scope: _translate the prototype 1:1
into the codebase, in its naming, conventions, patterns and architecture_. The
prototype draws no shell of its own, so here "the prototype" is the **App
mark** it was amended with, the `--color-bg` the window opens on, the fonts it
names, and the **Wordmark**. All of those shipped as drawn.

What shipped is what the log settled, and it works end to end:

- the **Server process** in a `utilityProcess`, and the **Shell handshake**
  typed once in `src/types/shell.ts`
- the **Ordered shutdown**, one path for the `shutdown` command and the signals
- the `127.0.0.1` bind, the **Shell port** and its ephemeral fallback
- **One origin**: the built renderer served beside `/api` under its CSP
- the **Loopback guard** and the **Trusted hosts**
- the window: `#14110d`, maximized, sandboxed, no menu when installed, one
  instance, the window's rules, downloads straight to Downloads, a crashed
  renderer reloaded once
- the two failure dialogs and the **Shell log**
- the **App mark** as the window icon, the taskbar identity and the favicon
- the three font families self-hosted, and the `<title>` corrected
- `tsconfig.electron.json`, the commit gate's three shipping projects, and a
  second `better-sqlite3` binding that never turns Vitest red

6608 tests pass across 378 files. `tsc -b` is clean, and
`eslint src server electron .husky` reports no errors and one warning.

What is left is the usual shape of a round built one slice at a time. Each
slice made the smallest change that turned its leaf green, and several of
those changes only look wrong when the initiative is read as a whole.

### 1. Dev forks the server a second way, through a shim nobody tests

Log 24 Q32 settled that `electron:dev` forks the server **from source** with
`--import tsx`. What the log did not know is that a `utilityProcess` ignores
`--import` in its `execArgv`. Slice 216 found out, and shipped
`electron/serverBoot.mjs`: an untested module that re-implements Node's preload
step by hand, resolving each `--import` from the working directory and then
importing the entry. `serverLaunch` carries an `execArgv` field that exists
only to be decoded by it, and `fork` in `main.ts` passes
`[launch.entry, ...launch.execArgv]` as arguments to it.

Meanwhile `buildElectron.mjs --watch`, which `electron:dev` already runs,
builds and rebuilds **both** bundles, the server's included. The dev window
has had a fresh `electron/dist/server.js` beside it the whole time. So there
are two ways to start the server under the shell, one of them through a shim,
where the bundle `electron:start` and the **Installed app** run is already
there to fork.

### 2. `main.ts` has logic of its own

Q34 made `main.ts` "a composition root with no logic, the router's rule: it
wires Electron's events to units that take their world as arguments". Four
pieces of state and decision shipped inline, untested:

- **Which shape this run is.** `app.isPackaged` is read four times (the
  `userData` redirect, the menu, the log file, the launch) and
  `FAMILYFLIX_SHELL_PROD` once, into a `dev` flag. `serverLaunch` then decides
  the same question again from `(isPackaged, prodFlag)`, and main hands it
  `!dev` as the prod flag, which is true for a packaged run too. The glossary
  already names the three shapes — the **Installed app**, and an **Unpackaged
  run** that is either `electron:dev` or `electron:start` — but no unit does.
- **The quit gate.** `before-quit` is prevented, the **Ordered shutdown** is
  run once through a `stopping ??=` memo, and a `stopped` flag lets the second
  `app.quit()` through. Three variables in a closure, and the one path that
  decides whether the family's library closes cleanly.
- **The renderer's one reload.** A `reloaded` flag inside `openWindow` decides
  that a crashed renderer is reloaded once and a second crash is left as it
  is (Q26).
- **Loading until Vite answers.** `load()` retries every 500 ms until
  `loadURL` resolves or the window is gone (Q15).

And one piece of wiring that is a rule: main wraps `showMessageBox` inside
`whenReady` so the startup dialog's text reaches the **Shell log**, while the
_stopped unexpectedly_ dialog goes unlogged. What a dialog told the family is
exactly what the maintainer needs to read back from the parents' machine
(Q28), and it is written once for one dialog of two.

### 3. The server's half hands its shutdown across a mutable variable

`shellHandshake(parentPort, startup, shutdown?)` takes the startup and, as an
optional third argument, the shutdown. `server/src/main.ts` cannot know the
shutdown until the startup has run, so it declares
`let shutdown = () => Promise.resolve()`, reassigns it from inside the startup
callback, and passes `() => shutdown()` to the handshake. The optional
parameter exists for the handshake's own suite, and the reassignment exists
for the ordering. `start()` already builds a `Started { server, shutdown }` —
it is the value the handshake should be handed.

The bound port is read twice, each time as `server.address() as AddressInfo`:
once in `main.ts` for `guard.bind`, once in `shellHandshake` for `ready`.

### 4. Two HTTP units are not where the log put them

Q13 placed the **Loopback guard** at `server/src/routes/loopbackGuard/` and Q15
the renderer at `server/src/routes/rendererRouter/`. Both shipped under
`server/src/shell/`. That folder is, in the log's and the PRD's words, "the
server's half of a seam" — infrastructure like `db/`, for the process
lifecycle. The guard runs standalone too (the `127.0.0.1` bind is "always,
standalone included", Q12), and neither unit talks to the shell: both are
Express middleware in front of the API, which is what `routes/` is for.
`listen` and `orderedShutdown` are the process lifecycle, and belong where
they are.

### 5. `npm run dev` is not exactly today's

Q15: "Unset, nothing is mounted and `npm run dev` is exactly today's." With
`FAMILYFLIX_RENDERER_PATH` unset, `mountRenderer` mounts a middleware on every
request that replaces `res.setHeader` with a wrapper dropping any
`Content-Security-Policy`. It exists so that Express's own not-found page, which
carries `default-src 'none'`, carries no policy either — and the suite's
_sends no CSP anywhere_ leaf asserts that. The same patch runs on every `/api`
request when the renderer is mounted. It is a monkey-patch of Node's response
on every request, standalone included, to hide a header nobody reads on a
`404`. The log's rule is narrower and already holds without it: the
**renderer's** policy is sent on the renderer and never on `/api`.

### 6. Three suites each build their own server child

`awaitExitOrKill`, `serverHandle` and `shellDialogs` each declare a
`FakeChild extends EventEmitter` — `kill`, `postMessage`, `post(message)`,
`exit(code)` — three times over. `server/src/test-support/` and
`src/test-support/` exist for exactly this; `electron/` has no rung for it yet.

### 7. Small drift

- `electron:start` calls `nx build` by name. `electron:dev`, beside it, calls
  `concurrently` by path, the way CLAUDE.md asks of everything spawned on our
  behalf.
- `windowPolicy.test.ts` writes a literal `javascript:` URL, which is the one
  eslint warning in the tree. It is a test that the URL is refused.

### 8. The documents that close the initiative (issue 225, folded in here)

- CLAUDE.md's environment section names none of `FAMILYFLIX_RENDERER_PATH`,
  `FAMILYFLIX_TRUSTED_HOSTS`, `FAMILYFLIX_SQLITE_BINDING` or
  `FAMILYFLIX_SHELL_PROD`, nor `PORT`'s **Shell port** behaviour, and its three
  path variables still say "Electron main will set" them.
- The folder map names no `electron/` unit, no `server/src/shell/`, and no
  `src/types/shell.ts`.
- _The commit gate_ still says a `test:` commit builds two projects.
- Step 7's line still carries "folder-path autofill in the **Movie form**",
  which Q3 struck, and _Change…_ has no Roadmap home (Q2: **Move the media
  folder**).
- README documents `electron:dev` as "browser + hot reload", names an
  `npm run release` that does not exist, and does not document
  `electron:native` or `electron:icon`.
- The glossary's **Save to computer** says "under Electron, the shell's save
  dialog". Q25 settled the opposite. The _Electron shell_ section has not been
  checked against the shipped code.
- `04-movie-detail` Q14 still reads as flagged for this grill, and
  `17-software-update` Q13 still says the global "will carry the API base URL
  before it carries anything else". Q4 settled both.
- The journal has no entry for the build.

## Solution

Six groups, each leaving a working tree after every commit.

0. **The build's record.** This comes first, so the journal describes what
   shipped before this round changes it.
1. **The shared double.** One fake server child in a new
   `electron/test-support/`, before the units that use it are touched.
2. **The main process.** One fork path: dev forks the watched bundle and
   `serverBoot.mjs` goes. One reading of the run's shape. The quit gate, the
   one reload and the retrying load as units with suites. Every dialog logged
   by the dialogs themselves. `main.ts` is then wiring and nothing else.
3. **The server's half.** The handshake is handed what the startup built. One
   reading of the bound port. The guard and the renderer where the log put
   them, and nothing mounted when the renderer path is unset.
4. **The drift.** `nx` by path, and the eslint warning.
5. **Documents.** They come last, because the map and the glossary have to
   describe the tree the earlier groups leave behind.

Seventeen commits in all. **Nothing changes on screen**, and nothing changes
for the family. Two things change for the maintainer, and each is the log's
own rule:

- `electron:dev` runs the bundled server the watcher rebuilds, not the source
  through tsx. A server change still means restarting the script, as Q32 said.
- The **Shell log** records the _stopped unexpectedly_ dialog as it already
  records the startup one.

## Commits

### Group 0 — the record of what was built

1. **The journal's shell entry.** `docs/dev-journal.md` gets the build's entry,
   dated by the last build commit (2026-09-30). It covers:
   - What shipped across 216–224, slice by slice, and the prototype amendment
     (218) that landed before the icon was used.
   - The judgment calls the slices made on their own:
     - `serverBoot.mjs`, because a `utilityProcess` ignores `--import`
     - `loopbackGuard` and `rendererRouter` placed in `shell/` rather than
       `routes/`
     - `listen` and `orderedShutdown` given units of their own, where the log
       left both in `main.ts`; that was right, and they stay
     - `withoutCsp`, to keep Express's `404` policy off
     - `shellDialogs` and `startServer`, a unit the log did not name; that was
       right, and it stays
     - the build scripts under `electron/scripts/` in camelCase, where the log
       named `scripts/build-electron.mjs`, `build-icon.mjs` and
       `electron-sqlite.mjs`, and the bundles as `electron/dist/main.js` and
       `server.js` where it named `.cjs` files in two folders; both are the
       repo's own conventions, and they stay
     - `electron:icon`, a fourth script
   - What was deliberately not built, per Q2, Q3, Q4 and the Trade-offs: the
     installer and FFmpeg bundling, the preload and `window.familyflix`,
     _Change…_, any native picker, a tray, a custom title bar, remembered
     bounds, macOS and Linux.
   - The manual smokes each phase ran, and anything they found.
   - The test count: 6608 across 378.
   - The follow-ups, listed by bare number.

### Group 1 — the shared double

2. **One fake server child.** `electron/test-support/fakeServerChild/` is added
   with its suite, following `server/src/test-support/`'s rule (never imported
   by shipping code, one folder per unit, no barrel). It is a `ServerChild`:
   - `postMessage` and `kill` recorded
   - `post(message)` delivering a **Shell handshake** message to main
   - `exit(code)` emitting the exit

   `tsconfig.electron.json` excludes `electron/test-support/`, so the shipping
   project cannot see it, and `tsconfig.spec.json` takes it in. The
   `awaitExitOrKill`, `serverHandle` and `shellDialogs` suites move onto it,
   and their three local copies go. No leaf is added, removed or renamed.

### Group 2 — the main process

3. **One reading of the run's shape.** `electron/shellMode/` is added with its
   suite. It is pure: `shellMode(isPackaged, env)` → `'dev' | 'start' |
'installed'`, named for what runs it — `electron:dev`, `electron:start`, and
   the **Installed app**. The prod flag is read in one place. A packaged run is
   `'installed'` whatever the flag says.

   `main.ts` reads the mode once: `'installed'` for the menu, the log file and
   no `userData` redirect; `'dev'` for DevTools and the Vite URL.
   `serverLaunch(mode, userData, cwd)` takes the mode in place of its two
   booleans, and `rendererUrl` takes it in place of `dev`. The `serverLaunch`
   suite's three describes become the three modes, with every leaf kept. The
   `rendererUrl` suite's leaves are kept over the mode.

4. **Dev forks the bundle.** `serverLaunch` answers `electron/dist/server.js`
   for every mode, and the `execArgv` field leaves `ServerLaunch`. In `'dev'`
   it still answers port `3001` and the Electron-ABI binding, and no renderer
   path. `fork` in `main.ts` forks the entry directly, and
   `electron/serverBoot.mjs` is deleted.

   The `serverLaunch` suite's _forks the server from its source entry_ and
   _runs the source through tsx_ become _forks the bundle the watcher builds_
   and _passes no Node flags_. The `serverHandle` suite's launch fixture loses
   its `execArgv`. `buildElectron.test.ts` already asserts both bundles are
   emitted. The smoke: `electron:dev`, the library opens, a server edit
   followed by a restart of the script is picked up.

5. **The quit gate is a unit.** `electron/quitAfterShutdown/` is added with its
   suite: given the server's `shutdown(ms)`, the budget and `quit`, it answers
   the `before-quit` listener. The suite covers:
   - the first `before-quit` prevented and the shutdown run
   - a second `before-quit` while stopping prevented, with no second shutdown
   - `quit` called once the shutdown resolves, and that quit let through
   - a server that had to be killed at the budget still quitting

   `main.ts` loses `stopping` and `stopped`.

6. **A crashed renderer is reloaded once, by a unit.**
   `electron/reloadOnce/` is added with its suite: given `reload` and
   `isGone()`, it answers the `render-process-gone` listener. The first crash
   reloads; a second does not; a destroyed window is left alone. `main.ts`
   keeps the log line and loses `reloaded`.

7. **Loading until Vite answers is a unit.** `electron/loadRenderer/` is added
   with its suite, on fake timers: `loadRenderer(target, url)` calls `loadURL`,
   asks again every 500 ms while it rejects, and stops asking once it resolves
   or the window is destroyed. The retry interval moves out of `main.ts` with
   it.

8. **Every dialog is logged by the dialogs.** `DialogWorld` gains
   `log(text)`. `startupFailed` and `stoppedUnexpectedly` each log their
   message, and the startup dialog its detail, before the box is shown. The
   wrapper inside `whenReady` goes, and main hands `log.main` in. The
   `shellDialogs` suite gains a leaf per dialog.

   After this commit `main.ts` is wiring: adapters for Electron's `fs`,
   `dialog`, `shell` and `app`, the window's options, and each event handed to
   a unit. The journal records its line count before and after.

### Group 3 — the server's half

9. **The handshake is handed what the startup built.** `shellHandshake`
   becomes `shellHandshake(parentPort, startup)`, where `startup` answers
   `{ server, shutdown }` — `Started`, which moves out of `server/src/main.ts`
   into the handshake's module as its input type. Once `ready` is posted, the
   `shutdown` command runs the `shutdown` it was handed, and the handshake
   answers the same `Started`. `server/src/main.ts` loses its reassigned
   `let shutdown` and registers the signals on what the handshake answers:
   `.then(({ shutdown }) => shutdownOnSignals(process, shutdown))`.

   The handshake suite's fixtures answer a `Started`, and every leaf is kept.
   Its _runs the ordered shutdown when main sends shutdown, and not before_
   leaf is the proof.

10. **One reading of the bound port.** `listen/` gains `boundPort(server)`.
    `main.ts`'s `guard.bind` and the handshake's `ready` both read it, and both
    `as AddressInfo` casts go. `listen`'s suite gains the leaf: the port it
    answers is the one a request reaches.

11. **The Loopback guard is a route unit.** `server/src/shell/loopbackGuard/`
    moves to `server/src/routes/loopbackGuard/`, as Q13 placed it. A move:
    no leaf changes.

12. **The renderer is a route unit.** `server/src/shell/rendererRouter/` moves
    to `server/src/routes/rendererRouter/`, as Q15 placed it. A move: no leaf
    changes.

13. **Nothing is mounted when the renderer path is unset.** `withoutCsp` goes.
    With the path unset, `mountRenderer` mounts nothing, as Q15 settled. With
    it set, an `/api` request is passed on by `next('router')` before the
    renderer's policy is ever set, as it already is.

    Two leaves are restated to the log's rule, which is about the renderer's
    policy and not about Express's own:
    - _never sends the CSP on /api_ becomes _never sends the renderer's policy
      on /api_
    - _sends no CSP anywhere_ becomes _sends the renderer's policy nowhere_

    The suite gains one leaf: with the path unset, the app's middleware stack
    is the API's alone. Every other leaf is kept.

### Group 4 — the drift

14. **`nx` by path, and the eslint warning.**
    - `electron:start` calls `node node_modules/nx/dist/bin/nx.js build`, the
      way `electron:dev` calls `concurrently`. `buildElectron.test.ts`'s
      _calling no npx_ leaf gains the assertion that no tool in either
      `electron:*` script is called by bare name.
    - `windowPolicy.test.ts`' `javascript:` literal carries an
      `eslint-disable-next-line no-script-url` with its reason: the leaf is
      that such a URL is refused. `safeFilename`'s `no-control-regex` disable
      is the precedent. `eslint src server electron .husky` is clean.

### Group 5 — the documents that close the initiative (issue 225)

15. **CLAUDE.md and README.**
    - _Environment Variables_ gains `FAMILYFLIX_RENDERER_PATH`,
      `FAMILYFLIX_TRUSTED_HOSTS`, `FAMILYFLIX_SQLITE_BINDING` and
      `FAMILYFLIX_SHELL_PROD`, each with who sets it (the log's table). `PORT`
      gains the **Shell port** under the shell and its fallback, `3001` under
      `electron:dev`. The three path variables say main sets them **when
      installed**, and that unpackaged runs use the repo's own library.
    - The folder map gains:
      - `electron/` and every unit, with a line each: `main.ts`, `shellMode`,
        `serverLaunch`, `serverHandle`, `awaitExitOrKill`,
        `quitAfterShutdown`, `reloadOnce`, `loadRenderer`, `rendererUrl`,
        `windowPolicy`, `downloadPath`, `shellDialogs`, `shellLog`,
        `appIdentity`, `assets/` with its guard, `scripts/` with its three
        scripts, `test-support/fakeServerChild/`, and the gitignored `.native/`
        and `dist/`
      - `server/src/shell/` — `shellHandshake`, `listen`, `orderedShutdown` —
        as infrastructure beside `db/`, the server's half of a seam
      - `routes/loopbackGuard/` and `routes/rendererRouter/`
      - `src/types/shell.ts` in the `types/` line
      - `db/`'s `nativeBinding` under `FAMILYFLIX_SQLITE_BINDING`
    - _The commit gate_ says a `test:` commit builds the **three** shipping
      projects, `app`, `server` and `electron`, and that `electron` is the
      shell's shipping code.
    - _Desktop Build_ says what shipped: one window over the **Server
      process**, **One origin**, the **Shell port**, and data under
      `%APPDATA%\FamilyFlix\` when installed.
    - Step 7's entry, in the build order and in _Foundation_, loses "folder-path
      autofill in the **Movie form**" (Q3). _Change…_ moves to a new Roadmap
      item, **Move the media folder** (Q2).
    - README's run section documents `npm run dev` (the browser loop, the fast
      one), `electron:dev`, `electron:start` (the **Installed app**'s shape
      over the repo's library), `electron:native` (run once, and again after
      an Electron upgrade) and `electron:icon` (run by hand when the mark
      changes). `npm run release` goes: the installer is step 8's. README's
      tree gets the same changes as the map, and its `electron/` line loses
      "preload", which is step 9's.

16. **The glossary and the two log pointers.**
    - **Save to computer** says the file goes straight to Downloads with no
      dialog, deduplicated as Chromium does, in a browser and in the shell
      alike (Q25).
    - The _Electron shell_ section is read row by row against the code, and
      each of **Desktop shell**, **Server process**, **Shell handshake**,
      **Ordered shutdown**, **One origin**, **Shell port**, **Loopback guard**,
      **Trusted host**, **Installed app**, **Unpackaged run**, **Shell log**,
      **Wordmark** and **App mark** is confirmed or corrected:
      - **Server process** says it runs the bundled server in every shape.
      - **Loopback guard** names `routes/loopbackGuard/`.
    - It gains **Shell mode**: `dev`, `start` or `installed`, read once.
    - `04-movie-detail` Q14 and `17-software-update` Q13 each gain a one-line
      ⚠️ pointer, the way `10-video-player` Q13 carries _Superseded by Q19_:
      Q14 is settled by log 24 Q10 (`BrowserRouter` stays, served over the
      bundled Express process); Q13's parenthetical is superseded by log 24 Q4
      (the preload never carries an API base URL). The answers themselves are
      not rewritten.

17. **The journal's paragraph and the tick.** The round's own journal entry
    covers what each group changed, `main.ts`'s size before and after, the test
    count before and after, and what was deliberately left out, in the shape
    the decision document below gives. Then the tick:
    - **Electron desktop shell** ✅ in README's and CLAUDE.md's feature lists.
    - The build-order chain in both files loses step 7 ("steps 1–7 … are
      done"). **Desktop packaging** becomes "next", and step 9 keeps its
      number and its gates.

    This commit closes this issue. 215 is closed by a comment at the same
    time, by bare number and never with a closing keyword. 225 was already
    closed as folded in when this plan was filed. _(The closure happens at
    closing time, not as a commit.)_

## Decision Document

- **One fork path.** Every shell mode forks the bundled server. The watcher
  `electron:dev` already runs rebuilds it, so dev loses nothing Q32 promised —
  a server change always meant restarting the script — and gains running the
  exact bundle the **Installed app** runs. This departs from Q32's "from
  source (`--import tsx`)" for a reason the log could not know: a
  `utilityProcess` ignores `--import`, and the only way around it was a shim
  that re-implements Node's preload. `npm run dev:server` still runs the
  source through tsx; that is the fast loop for server work.
- **`main.ts` is a composition root with no logic** (Q34). Each decision it
  held becomes a unit that takes its world as arguments: `shellMode`,
  `quitAfterShutdown`, `reloadOnce`, `loadRenderer`. What stays is adapters
  and wiring. Electron is still only ever run in a manual smoke.
- **The run's shape is read once.** `shellMode` answers the three shapes the
  glossary already names, and every other unit is handed the mode rather than
  `isPackaged` and a flag.
- **Every dialog the family sees is in the Shell log.** The dialogs log
  themselves, so a third dialog cannot be added unlogged.
- **The handshake is handed a `Started`.** The startup builds the server and
  its shutdown together, and the handshake registers the command on what it
  was handed. No mutable variable crosses the seam, and no parameter is
  optional for a suite's sake.
- **The bound port is read one way.** `boundPort(server)` in `listen/`.
- **`routes/` holds the HTTP units, `shell/` the process lifecycle.** The
  **Loopback guard** and the renderer are Express middleware in front of the
  API and run standalone too, so they are `routes/`' (Q13, Q15).
  `shellHandshake`, `listen` and `orderedShutdown` are the server's half of the
  shell seam and its lifecycle, infrastructure beside `db/`.
- **The renderer's policy is the rule, not every CSP.** The renderer's CSP is
  sent on the renderer and never on `/api`. Express's own `404` page keeps its
  own `default-src 'none'`, which is stricter and harmless. Nothing is patched
  onto Node's response, and with the renderer path unset nothing is mounted
  (Q15).
- **`electron/` gets a `test-support/` rung.** The same one-line rule as the
  other two: never imported by shipping code, and excluded from the shipping
  project so the typecheck enforces it.
- **The build scripts stay where they shipped.** `electron/scripts/`,
  camelCase, and the two bundles in `electron/dist/` as `.js`, which is CJS
  because `package.json` has no `"type": "module"`. The log's names were
  sketches; the repo's conventions won, and the docs record the shipped names.
- **Design logs gain pointers, not edits.** Q14 of log 04 and Q13 of log 17
  each get the one-line ⚠️ pointer log 10 set the precedent for. Their answers
  are left as they were written.
- **Nothing changes on screen.** Anything that renders differently after this
  round is a bug in the round. The two changes for the maintainer — dev runs
  the bundle, and the second dialog is logged — are the log's own rules.

## Testing Decisions

- **A good test asserts behaviour through the unit's own seam.**
  - A pure unit (`shellMode`, `serverLaunch`, `rendererUrl`): what it answers
    for what it is handed.
  - A unit over an injected world (`quitAfterShutdown`, `reloadOnce`,
    `loadRenderer`, `shellDialogs`): what it asks the world to do, and in what
    order, over fakes and fake timers.
  - An Express unit (`loopbackGuard`, `rendererRouter`, `listen`): what a real
    request through supertest or a real socket answers.

  No test reaches into another unit's internals, and none launches Electron.

- **Pure moves change no leaf.** Commits 2, 11 and 12 move code under suites
  that already assert its behaviour, and commits 3, 9 and 10 change a
  signature under leaves that are kept. A red leaf in any of them means the
  refactor is wrong, not the test.
- **Restated leaves are named.** Commit 4 restates two `serverLaunch` leaves
  to the one fork path, and commit 13 restates two `rendererRouter` leaves to
  the log's rule. Each is the only leaf that changes in its commit.
- **New suites for the units that had none:**
  - `fakeServerChild`
  - `shellMode`
  - `quitAfterShutdown`
  - `reloadOnce`
  - `loadRenderer`

  Each is written in the commit that creates the unit. `serverBoot.mjs` had no
  suite and is deleted rather than given one.

- **Prior art.**
  - `server/src/test-support/fixedSlot` and `heldCopy` for `fakeServerChild`.
  - `serverLaunch.test.ts` and `rendererUrl.test.ts` for `shellMode`.
  - `awaitExitOrKill.test.ts` and `serverHandle.test.ts`' fake timers for
    `quitAfterShutdown` and `loadRenderer`.
  - `shellDialogs.test.ts` for `reloadOnce` and the dialogs' log leaves.
  - `listen.test.ts` for `boundPort`.
- **The manual smoke is run once, after Group 3.** `electron:dev` opens the
  library and a film plays. `electron:start` reloads on `/series/3/season/2`
  and stays there. Closing the window during playback exits inside 5 s and
  leaves no `-wal`. Killing the server process offers Restart, and the
  **Shell log** records the dialog. The journal records the result.
- **The round is finished when `node_modules/.bin/vitest run`,
  `node_modules/.bin/tsc -b tsconfig.json` and
  `node_modules/.bin/eslint src server electron .husky` are all clean.**
  Commit 14 makes eslint clean of warnings too.

## Out of Scope

- **The installed app's paths.** `main.ts` and `serverLaunch` join the icon,
  the bundles and the renderer onto `process.cwd()`, which is the repo in every
  shape this initiative can run. A packaged app's resources live elsewhere;
  finding them is step 8's, with the installer that puts them there.
- **One spelling of the native binding's path.** `serverLaunch`'s
  `nativeBindingPath` and `fetchNative.mjs` each spell
  `electron/.native/better_sqlite3.node`. A `.mjs` script run by Node cannot
  import a `.ts` unit without a loader, and the path is gitignored scratch. The
  two stay, each saying where the other is.
- **Tests for the build scripts beyond `buildElectron`.** `buildIcon.mjs` and
  `fetchNative.mjs` are run by hand and their outputs are checked in or
  gitignored; the `.ico` guard is `iconSizes.test.ts`.
- **`orderedShutdown`'s idempotence.** The `stopping ??=` memo stays in the
  server's `start()`, beside what it closes. Folding it into the unit would make
  it hold state for one caller.
- **The guard's `bind(port)`.** A callable carrying a method is a cast, but it
  is the shape that lets the guard be mounted first and learn the port after
  `listen`. A getter would move the same mutable cell into the caller.
- **`dev`'s bare `concurrently`.** `npm run dev` predates this initiative and
  is "exactly today's" by Q15.
- **Everything the log ruled out**: the installer, `electron-builder`, signing,
  bundling FFmpeg and the release workflow (step 8); the preload,
  `window.familyflix` and the updater (step 9); _Change…_ (Roadmap: **Move the
  media folder**); native pickers; a tray, a custom title bar or an application
  menu; remembered bounds; macOS and Linux; backups; auto-launch.

## Further Notes

- **What the next initiative inherits.** After this round:
  - one fork path, so packaging bundles and forks exactly what `electron:start`
    already runs
  - a `main.ts` that is wiring, and a unit for every decision in it
  - a sandboxed window with no preload, which step 9 adds to
  - `routes/` holding every HTTP unit and `shell/` the lifecycle
  - `shellMode`, which packaging's path resolution can be handed rather than
    re-deriving `isPackaged`

- **Why the slices built it this way.** Every item above was the smallest
  change that made a slice's leaf pass:
  - `serverBoot.mjs` because the log's `--import tsx` did not reach a utility
    process, and the smoke had to open a window that day.
  - The inline state in `main.ts` because each slice added one event and its
    handler, and no single slice held more than one.
  - The optional `shutdown` because the handshake's suite was written before
    the ordered shutdown existed.
  - `shell/` for the guard and the renderer because it was the new folder the
    slice was already in.
  - `withoutCsp` because the leaf was written as "no CSP", not "not the
    renderer's".

  That these add up to a second fork path and a composition root with logic is
  only visible when the initiative is read as a whole.
