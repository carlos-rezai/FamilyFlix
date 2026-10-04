## Problem Statement

I am the maintainer, and my parents are the people who use this app. Step 8
put FamilyFlix on their PC as an installer I run by hand. Every fix after that
means another trip — in person or over the phone — to download a new
`FamilyFlix-Setup-<v>.exe` and click through SmartScreen again. My parents
should never have to administer software, and I should not have to drive over
to ship a bug fix.

The app also has no way to say what version it is relative to anything. The
About card draws the brand row alone. The prototype's **Software update** row
above it — _You're up to date_, **Check for updates**, _Version 1.1.0 is
available to install_, **Update now** — was held back by log 15 Q21, because a
row that says _You're up to date_ with no updater behind it would be a lie.

Three things stand between here and a working update:

- **The window has no bridge.** The shell is sandboxed with no preload, so the
  renderer cannot reach anything in main. `window.familyflix` was handed to
  this step by log 24 Q4 and does not exist.
- **The Installer names no feed.** `builderConfig.json` carries
  `"publish": null`, so 0.1.0 has no `app-update.yml`. **0.1.0 can never
  update itself.**
- **There is no release mechanism.** `.github/` does not exist, `package.json`
  has no `repository`, and a release is me running `electron:package` by hand.
  `docs/release-checklist.md` says every release is ticked against it, but
  nothing enforces that.

This is step 9 of the build order, and the last one.

## Solution

**FamilyFlix updates itself from GitHub Releases, and the family never has to
do anything.**

- **Once per launch, silently,** the installed app asks the **Release feed**
  whether there is something newer. If there is, it downloads it in the
  background. If the machine is offline or the feed doesn't answer, nothing
  happens and nothing is drawn — the library opens and the film plays.
- **Closing FamilyFlix installs it.** With `autoInstallOnAppQuit` on, the
  family's update path is to close the app as they always do. Next time they
  open it, it is the new version, and an info snackbar says _FamilyFlix
  updated to 0.2.1._ That is the one time the app tells them it worked.
- **Or install it now.** Once the bytes are on disk, an **Update offer
  snackbar** appears anywhere in the app — _Update available · FamilyFlix
  0.2.1 is ready to install._ with **Update now**. It persists until pressed
  or dismissed. It is safe to show the family, because ignoring it only means
  waiting for the next quit.
- **The About card gets its first row back,** 1:1 with the (amended)
  prototype, in four faces:
  - _offered_ — _Version 0.2.1 is available to install._ in the accent, over
    **Update now** (primary);
  - _installing_ — _Installing and restarting…_, over a disabled `Updating…`;
  - _checking_ — _You're up to date._ with its label, over a disabled
    `Checking…`;
  - _idle_ — _You're up to date. Last checked 3 minutes ago_, over **Check for
    updates** (secondary).
- **A pressed check always answers.** _You're on the latest version._
  (success), _FamilyFlix couldn't check for updates._ (error), or — in an
  unpackaged run — _Updates are only available in the installed app._ (info).
  A check that finds a release says nothing; the offer follows when the
  download lands.
- **Update now is safe mid-run.** It first runs the server's **Ordered
  shutdown** — cancelling an Import or an Enrichment exactly as closing the
  window would, and closing the database — and only then hands over to the
  installer. An update can never interrupt a database write.
- **A release is a tag, a draft and a smoke.** `npm version minor|patch` →
  `git push --follow-tags`. A GitHub workflow on the tag typechecks, runs the
  suite, packages, and uploads the Installer, `latest.yml` and the blockmap to
  a **Draft release**, which the updater cannot see. I run the **Package
  smoke** against the draft's Installer. **Publishing the draft is the
  release.**
- **The first Release is v0.2.0.** It is installed by hand on the parents' PC,
  replacing 0.1.0, and every version after it arrives on its own.

## User Stories

### The family

1. As a parent, I want FamilyFlix to update itself when I close it, so that I never have to install anything.
2. As a parent, I want the app to open normally when the internet is down, so that a missing connection never stops a film.
3. As a parent, I want no error or warning when an update check fails, so that I'm never shown a problem I can't fix.
4. As a parent, I want a short note the first time I open a new version, saying what it updated to, so that I know something changed on purpose.
5. As a parent, I want that note shown once and never again, so that it doesn't nag me.
6. As a parent, I want no update note the first time the app is installed, so that I'm not told about an update that never happened.
7. As a parent, I want to be able to dismiss the update offer, so that I can carry on watching.
8. As a parent, I want ignoring the update offer to be harmless, so that leaving it alone still gets me the update when I close the app.
9. As a parent, I want pressing Update now to tell me the app is about to restart, so that the window closing doesn't look like a crash.
10. As a parent, I want the app to come back on its own after Update now, so that I'm not left wondering how to reopen it.
11. As a parent, I want no confirmation dialogs and no installer screens during an update, so that there are no questions to answer.
12. As a parent, I want the offer snackbar to disappear once an install has started, so that I'm not offered something already happening.

### The maintainer

13. As the maintainer, I want the About card to show whether this machine is up to date, so that I can check over the phone.
14. As the maintainer, I want the row to say when the last successful check was, so that I can tell a fresh answer from a stale one.
15. As the maintainer, I want _Last checked_ to advance only on a check that got an answer, so that it never means "last tried".
16. As the maintainer, I want no _Last checked_ label until a check has answered, so that the row doesn't invent a time.
17. As the maintainer, I want a Check for updates button that always answers when I press it, so that a press is never met with silence.
18. As the maintainer, I want _You're on the latest version._ when there is nothing new, so that I know the check reached the feed.
19. As the maintainer, I want _FamilyFlix couldn't check for updates._ when the feed can't be reached, so that I can tell offline from up to date.
20. As the maintainer, I want the button disabled and labelled `Checking…` while a check runs, so that I can't start two at once and can see it working.
21. As the maintainer, I want a check that finds a release to say nothing until the download lands, so that "offered" always means the bytes are already on disk.
22. As the maintainer, I want the row to show the offered version and an Update now button when one is waiting, so that I can install it right away.
23. As the maintainer, I want the offered version kept separate from the running version in the brand row, so that the two numbers never get mixed up.
24. As the maintainer, I want the row to show an offer that arrived while I was elsewhere in the app, so that leaving Settings and coming back doesn't hide it.
25. As the maintainer, I want the row to show _Installing and restarting…_ whether I pressed Update now there or on the snackbar, so that the two surfaces never disagree.
26. As the maintainer, I want a launch check that answers while I'm on Settings to update the row, so that I'm not reading a stale label.
27. As the maintainer, I want Update now to wait for the server's Ordered shutdown before the installer starts, so that an update can't corrupt the database mid-write.
28. As the maintainer, I want a running Import or Enrichment cancelled on Update now exactly as closing the window would, so that there's one rule for leaving the app.
29. As the maintainer, I want the installer to run silently and relaunch the app, so that my parents see FamilyFlix again and not a wizard.
30. As the maintainer, I want an unpackaged run (`electron:dev`, `electron:start`) to draw the row and answer a press with _Updates are only available in the installed app._, so that the button never silently does nothing where I develop.
31. As the maintainer, I want no launch check in an unpackaged run, so that development never reaches the feed.
32. As the maintainer, I want every updater error written to the Shell log as one `[main]` line, so that I can find out why an update never arrived on my parents' machine.
33. As the maintainer, I want an updater error never to crash the app, so that a network blip on launch doesn't take FamilyFlix down.
34. As the maintainer, I want the updater's own info, warn and error output in the Shell log, so that the log tells the whole story of a download.
35. As the maintainer, I want a release made by `npm version minor|patch` and `git push --follow-tags`, so that the tag and the version always agree.
36. As the maintainer, I want the version-bump commit to read `chore: [release] v<version>`, so that releases are easy to find in the history and pass the commit gate.
37. As the maintainer, I want a workflow on every `v*` tag that typechecks, runs the suite and packages on Windows, so that nothing untested is uploaded.
38. As the maintainer, I want the workflow to upload to a draft Release, so that nothing reaches my parents until I have smoked it.
39. As the maintainer, I want publishing the draft to be the release, so that the Package smoke is a gate rather than a promise.
40. As the maintainer, I want a local `electron:package` never to upload anything, so that building an Installer to test can't publish one.
41. As the maintainer, I want the release ritual and the update round-trip written in the release checklist, so that I can do it again in six months without rediscovering it.
42. As the maintainer, I want the checklist to include checking for updates with the network off, so that the refusal path is proven on a real install.
43. As the maintainer, I want the first updatable Release to be v0.2.0, installed by hand, so that I know which install on the parents' PC is the last manual one.
44. As the maintainer, I want an unsigned update accepted without a signature check, so that a free project needs no certificate.
45. As the maintainer, I want no token or secret inside the Installer, so that a public repo's feed needs no credentials.
46. As the maintainer, I want the first publish to wait for the Sandbox blank-window bug to be fixed, so that the first release isn't one the smoke can't prove.

### The developer

47. As a developer, I want the update state machine to be one injected unit in main, testable without launching Electron, so that start, check, install and errors are proven in Vitest.
48. As a developer, I want main to only wire IPC to that unit, so that `main.ts` stays a composition root.
49. As a developer, I want the preload to be wiring only, passing channels through, so that there is nothing in it to test.
50. As a developer, I want the IPC channel names declared once in the shared types, so that the preload and main can never spell a channel differently.
51. As a developer, I want `window.familyflix` typed once and optional, so that no reader casts and the browser's `undefined` is a state the types know about.
52. As a developer, I want the bridge read in exactly one place, so that "no bridge" is answered once instead of at every call site.
53. As a developer, I want the About card unchanged when there is no bridge (`npm run dev`, a browser), so that the web build keeps working.
54. As a developer, I want the row's face computed by a pure function of status, checking and now, so that every face and label is tested without a DOM.
55. As a developer, I want the whole status pushed on every change, so that both surfaces derive from one stream and can't drift.
56. As a developer, I want a fake bridge in test-support that can emit statuses and answer checks, so that the row and the notice are tested without Electron.
57. As a developer, I want the offer pushed once per renderer load even under StrictMode, so that development doesn't show it twice.
58. As a developer, I want "none" told from "found" by the updater's own `isUpdateAvailable`, so that we never compare version strings ourselves.
59. As a developer, I want `electron-updater` bundled into `main.js` as a devDependency, so that `dependencies` stays empty and the Packaged layout gets no `node_modules`.
60. As a developer, I want the preload built as a third CJS bundle and packed in the asar, guarded by the existing tests, so that the layout and the build can't drift.
61. As a developer, I want the packaging guard to assert the feed names this repo as a draft GitHub provider, and that update signature checks are off, so that neither drifts with a default.
62. As a developer, I want the four prototype amendments made before any code reads them, so that the build is 1:1 with a prototype that already shows every face.

## Implementation Decisions

Every decision below comes from design log 17, both sessions. The second
session (Q33–Q58) supersedes the first wherever the log's ⚠️ pointers say so.
The log's question numbers are in parentheses.

### Scope (Q1–Q3, Q31–Q33, Q58)

- One initiative, `software-update`. It covers the updater in main, the
  preload and `window.familyflix`, the About card's row, the offer and the
  congratulation, and the **Release feed**: the `publish` block,
  `repository`, the tag workflow and `npm version`.
- The Snackbar system it needs already shipped (log 18). The shell (log 24)
  and the installer (log 25) are prerequisites, both done.
- **Software update** is ticked in README, CLAUDE.md and COMPONENT-SPEC's
  `page.SettingsPage` row **after the refactor**. CLAUDE.md's build-order
  chain then has no step left, and says so.

### Prototype amendments — phase 1's first commit (Q18, Q22, Q44–Q46)

1. `page.SettingsPage.dc.html`: the `updating` line becomes _Installing and
   restarting…_. With auto-download on, the bytes are already on disk, so
   _Downloading_ is untrue.
2. `page.SettingsPage.dc.html`: the raw 42px `Updating…` button becomes
   `prim.Button variant="primary" size="md" disabled`, so the row doesn't
   shrink by 8px during an install.
3. `page.SettingsPage.dc.html`: a `checking` face — the idle line and label
   over a disabled `Checking…` `prim.Button size="md"`. `FamilyFlix.dc.html`
   gains `checking` in its state and in `checkForUpdates()`.
4. `FamilyFlix.dc.html`: `checkForUpdates()`'s confirmation `duration: 4000`
   becomes `5000`, matching the one auto-dismiss rule.

### The mechanism (Q4–Q11, Q28)

- `electron-updater` against **GitHub Releases** of the public
  `carlos-rezai/FamilyFlix`. No token at runtime, and no secret in the
  Installer.
- **Once per launch**, after the window opens, and again on every press.
  There is no timer.
- **`autoDownload` on.** On every surface, **offered** means the bytes are
  already on this disk. A release that has been found but not downloaded
  draws no face.
- **`autoInstallOnAppQuit` on.** This is the family's update path. **Update
  now** only means _install now instead of at the next quit_.
- No auto-download toggle and no preference store of any kind.
- A launch check that fails is **silent**. A pressed check always answers.
  `lastCheckedAt` advances **only** on a check that got an answer.
- An offline machine is not an error state. Nothing waits on the check.
- Unsigned: `win.verifyUpdateCodeSignature: false`, stated in the config and
  guarded rather than left to a default.

### The contract — shared types (Q35–Q37)

- A new shared types module carries:
  - `UPDATE_CHANNELS`: four `as const` channel names — `current` (invoke →
    status), `check` (invoke → outcome), `install` (send), and `status` (main
    → renderer on every change). This follows the `shell.ts` precedent: one
    file both sides of a seam import.
  - `UpdateCheck`: `'none' | 'found' | 'refused' | 'unavailable'`.
  - `UpdateStatus`: `{ offered: string | null; lastCheckedAt: string | null;
installing: boolean }`. `lastCheckedAt` is an ISO string.
  - `UpdateBridge`: `current(): Promise<UpdateStatus>`,
    `onStatus(listener): () => void`, `check(): Promise<UpdateCheck>`,
    `install(): void`.
- A global declaration file, the `appVersion.d.ts` precedent, declares
  `Window.familyflix?: { updates: UpdateBridge }`. It is **optional**
  because a browser has none. It is included in the electron tsconfig beside
  `shell.ts`.
- **Push and pull.** Main holds the status. The renderer reads `current()` on
  mount and subscribes to the **whole status** pushed on every change. One
  stream lets both surfaces show the same install, whichever surface started
  it. `checking` stays local to the renderer, because only the row can start
  a pressed check.

### The preload (Q34)

- One flat, wiring-only file beside `main.ts`.
  `contextBridge.exposeInMainWorld('familyflix', { updates })` over
  `ipcRenderer`. Each member passes one channel through and holds no state.
  It has no suite, and the smoke proves it.
- Built as a **third CJS bundle** with `electron` external, beside `main.js`
  and `server.js`. The build-script suite asserts three bundles.
- The asar's `files` gain the preload (five files), and the packaging guard
  follows.
- `webPreferences` gain `preload`. `sandbox`, `contextIsolation` and
  `nodeIntegration: false` stay exactly as log 24 Q21 set them.

### `createUpdates` — the main-process injected domain (Q29, Q38, Q40–Q43)

- A top-level electron unit, like `serverHandle`: `createUpdates(world):
Updates`.
- `UpdatesWorld`:
  - `updater` — the slice of `autoUpdater` used: `autoDownload`,
    `autoInstallOnAppQuit`, `logger`, `checkForUpdates()` resolving
    `{ isUpdateAvailable, updateInfo: { version } } | null`,
    `quitAndInstall(isSilent, isForceRunAfter)`, and `on('update-downloaded'
| 'error')`;
  - `enabled` — main passes `mode === 'installed'`, so `electron:start`
    answers `unavailable` like `electron:dev`;
  - `now()`;
  - `shutdown()` — `serverHandle.shutdown` with `SHUTDOWN_MS` bound by main;
  - `onStatus(status)` — main forwards it to `webContents.send` on the status
    channel;
  - `log(text)` — the **Shell log**'s `main` writer.
- `Updates`:
  - `start()` — the launch check. It never rejects, is silent on refusal, and
    does nothing when disabled.
  - `current()` — the status now.
  - `check()` — the pressed check. `unavailable` when disabled. `refused` on a
    rejection or a `null` result, with `lastCheckedAt` unchanged. Otherwise
    `none` or `found` by `isUpdateAvailable` (never a version comparison), and
    `lastCheckedAt = now()` either way.
  - `install()` — a no-op with no offer. Otherwise it sets `installing` and
    pushes, awaits `shutdown()`, then `quitAndInstall(true, true)`.
- `update-downloaded` sets `offered` and pushes. Every status change pushes
  the whole status.
- **An `error` listener is always registered.** An `error` event with no
  listener throws in main. Each error logs one `[main]` line and is otherwise
  silent.
- `updater.logger` writes `info`, `warn` and `error` to the Shell log and
  drops `debug`.
- **Install against the quit gate (Q38).** `quitAndInstall` spawns the NSIS
  installer **before** it calls `app.quit()`. Run bare, the one-click
  installer's app-running check would find the server still alive in the
  quit gate and kill it, possibly mid-write. With the Ordered shutdown done
  first, the gate's own `shutdown` resolves immediately and the quit goes
  straight through. The family's quit path needs no new code: the
  quit-time install runs on `quit`, which the gate already orders after the
  shutdown.
- **A run in flight (Q39)** is cancelled by the Ordered shutdown, as closing
  the window would cancel it. No confirm.
- `electron-updater` is a **devDependency, bundled into `main.js`** by
  esbuild. The `dependencies: {}` guard is unchanged (Q43).
- `main.ts` wires it: build the unit, three `ipcMain` handlers, the status
  send to the window, and `start()` after the window opens. No logic.

### The renderer (Q14–Q17, Q19, Q23–Q25, Q30, Q54–Q56)

- A new feature folder, `software-update`. `AboutSection` mounts its
  organism, the `LibrarySection` → `ExportModal` precedent.
- **`updateBridge`** — the one place `window.familyflix?.updates` is read.
  It returns `null` in a browser, and that is a state, not an error.
- **`useSoftwareUpdate`** → `{ status: UpdateStatus | null; checking:
boolean; check(): Promise<UpdateCheck>; install(): void }`. It reads
  `current()` on mount and subscribes to `onStatus`. `status` is `null` until
  `current()` lands. Never rejects.
- **`updateFace(status, checking, now)`** — pure, the `zoneFace` precedent.
  It returns `{ line, tone: 'offer' | 'dim' | 'faint', button: { label,
variant, disabled } }`:

  | face       | when                      | line                                           | button                            |
  | ---------- | ------------------------- | ---------------------------------------------- | --------------------------------- |
  | offered    | `offered`, not installing | `Version <v> is available to install.` (offer) | **Update now** · primary          |
  | installing | `installing`              | `Installing and restarting…` (dim)             | `Updating…` · primary, disabled   |
  | checking   | `checking`                | `You're up to date.` + label (faint)           | `Checking…` · secondary, disabled |
  | idle       | otherwise                 | `You're up to date.` + label (faint)           | **Check for updates** · secondary |

  Every button is `Button size="md"`, and a disabled one is its `:disabled`
  face. Nothing is styled locally.

- **_Last checked_ label**: `Last checked just now` under a minute, then
  `N minutes ago`, `N hours ago`, `N days ago`. It is absent when
  `lastCheckedAt` is `null`. It is computed at render and **does not tick**
  (Q54).
- **`SoftwareUpdateRow`** — the About card's first row and **the full-bleed
  hairline under it**. It returns `null` with no bridge or before `status`
  lands, taking the hairline with it, so the card renders exactly as today.
  It is the UploadIcon tile, the title, the line and the button. It pushes the
  **answers to a press** through `useSnackbar()`:

  | outcome       | variant | message                                            |
  | ------------- | ------- | -------------------------------------------------- |
  | `none`        | success | `You're on the latest version.`                    |
  | `refused`     | error   | `FamilyFlix couldn't check for updates.`           |
  | `unavailable` | info    | `Updates are only available in the installed app.` |
  | `found`       | —       | nothing; the offer follows                         |

- **`AboutSection`'s geometry (Q15)**: the card becomes `overflow: hidden`
  with no padding. The row insets itself at `18px 20px`, a full-bleed hairline
  follows (local to this card, not `section.styles`' 22px-margin `Divider`),
  then the brand row at `16px 20px`.
- **The brand row keeps the App version** (`__APP_VERSION__`, what is
  running). The **Offered version** appears only in the row's line and the
  offer snackbar (Q19).
- **`SoftwareUpdateNotice`** — headless, mounted once in `App` inside the
  `SnackbarProvider`. It does nothing when `updateBridge()` is `null`.
  - **The offer:** info, title _Update available_, message `FamilyFlix <v>
is ready to install.`, action **Update now** → `install()`. It persists.
    It is pushed **once per renderer load**, held by a ref so StrictMode
    can't double it: when `current()` lands with `offered` set, or when
    `onStatus` first brings one. The ref also holds the notice id.
  - **The retraction:** when a status arrives with `installing` true, the
    notice `dismiss`es its offer (log 18 Q25's case: the row installed).
  - **The congratulation:** success, `FamilyFlix updated to <v>.`, on the
    first load where the **Seen version** differs from `__APP_VERSION__`.
    Never on a fresh install, where there is no Seen version.
- **`seenVersion`** — the `volumePreference` precedent: read and write the
  version this machine last ran in `localStorage`, wrapped in try/catch.
- Two subscribers to one stream, with no shared update context (Q23).

### The release feed (Q26–Q27, Q47–Q53)

- `package.json` gains `"repository": "github:carlos-rezai/FamilyFlix"`.
- `builderConfig.json`:
  - `publish: null` becomes `{ provider: 'github', owner: 'carlos-rezai',
repo: 'FamilyFlix', releaseType: 'draft' }`;
  - `win.verifyUpdateCodeSignature: false` is added.

  The packaging guard's _names no release feed_ leaf becomes _names the
  release feed_: provider `github`, owner/repo equal to `repository`, release
  type `draft`, signature verification off. A local package now writes
  `app-update.yml` too, which is correct.

- `packageApp` gains `--publish`, which passes `publish: 'always'`. The
  default stays `'never'`.
- `.github/workflows/release.yml` on `push: tags: ['v*']`, `windows-latest`,
  `permissions: contents: write`, Node 22 with the npm cache: `npm ci` →
  `npm run typecheck` → vitest by path → `packageApp --publish` with
  `GH_TOKEN` from the workflow's own `GITHUB_TOKEN`. Not on pushes to `main`.
- `.npmrc` sets `message=chore: [release] v%s`. CLAUDE.md's _Commit Messages_
  gains the release line, the one shape with no `issue #<n>`.
- **Drafts (Q48).** The workflow uploads to a **Draft release**, which
  `electron-updater` does not read. Publishing it after the smoke is the
  release.
- **The first Release is v0.2.0 (Q47)**, by `npm version minor`. 0.1.0 has no
  feed and is never published. The proof cycle: 0.2.0 installed by hand →
  0.2.1 published → offered, installed and congratulated on that install.
- `docs/release-checklist.md` gains a _Publish_ section and an _Update
  round-trip_ section:
  - the offer snackbar from the previous version, **Update now**,
    _Installing and restarting…_, the relaunch, _FamilyFlix updated to …_,
    and the About card's version;
  - the quit path on the next version;
  - **Check for updates** with the network off;
  - the Sandbox `.wsb` if Q49 needs it.

### Gate on the first publish (Q49)

- In the step 8 smoke, the installed window painted nothing in Windows
  Sandbox. That is a **`desktop-packaging` fix issue, to be filed**. It is
  diagnosed with `--disable-gpu` and a `.wsb` with `<vGPU>Disable</vGPU>`.
- Phases 1–2 don't wait on it. Phase 3's first **publish** does, because the
  smoke is the release.

### Phases

1. **The bridge and the row, fully voiced.** The four amendments first. Then
   the shared types and the global, `createUpdates`, the preload (the third
   bundle and the fifth asar file) and `main.ts`'s wiring, `updateBridge`,
   `useSoftwareUpdate`, `updateFace`, `SoftwareUpdateRow`, the About card's
   geometry, `fakeUpdateBridge`, and the three pressed-check answers. Proof:
   the suites, then `electron:start`, where **Check for updates** answers
   _Updates are only available in the installed app._
2. **Install and the offer.** `install()` over the Ordered shutdown,
   `SoftwareUpdateNotice` in `App`, the offer once and retracted on
   `installing`, `seenVersion` and the congratulation. Proof: the suites,
   with both surfaces driven through `fakeUpdateBridge`.
3. **The release feed** (HITL at its end). The `publish` block and its
   guard, `verifyUpdateCodeSignature`, `repository`, `packageApp --publish`,
   `release.yml`, `.npmrc`, and the checklist's two sections. Then, once the
   Sandbox fix is in, v0.2.0 → draft → smoke → publish → installed by hand,
   and v0.2.1 → draft → smoke → publish → the round-trip on the 0.2.0
   install.
4. **Docs and refactor.** CLAUDE.md (folder map: the preload,
   `createUpdates`, `features/software-update/`, `.github/`; the release
   commit line; the closed chain), README, COMPONENT-SPEC, the glossary
   (Q57's two corrections), the journal. Then the refactor, then the tick.

## Testing Decisions

A good test here drives a unit through its public interface and asserts what
an observer sees: the status pushed, the outcome returned, the line and button
drawn, the snackbar pushed or retracted, the file in the config. It never
asserts private state or call order that nobody outside could notice. Every
dependency comes in through the unit's world or a test-support double. No
suite launches Electron, touches the network, or reads the real
`autoUpdater`.

- **`createUpdates`** — the deepest unit and the most thorough suite, the
  `serverHandle` / `quitAfterShutdown` precedent of a `…World` built from
  fakes. It covers:
  - `start()` checks once when enabled and never when disabled, and never
    rejects on a refusal;
  - `check()`'s four outcomes, with `lastCheckedAt` advancing on `none` and
    `found` only;
  - `null` and rejection both read as `refused`;
  - `none` vs `found` by `isUpdateAvailable`;
  - `update-downloaded` sets `offered` and pushes the whole status;
  - `install()` is a no-op with no offer, and otherwise pushes `installing`
    before `shutdown()` and calls `quitAndInstall(true, true)` only after
    `shutdown()` resolves;
  - an `error` event logs one line and changes nothing;
  - the logger drops `debug`;
  - `autoDownload` and `autoInstallOnAppQuit` are left on.
- **`updateFace`** — pure, the `zoneFace` / `importView` precedent: every
  face, the precedence of installing over offered over checking, and every
  _Last checked_ boundary (59 s, 1 minute, 59 minutes, 1 hour, 1 day, `null`).
- **`updateBridge`** — `null` with no global, the member when the global is
  installed.
- **`useSoftwareUpdate`** — `null` until `current()` lands, then follows
  `onStatus`. `checking` is true only for the life of a check. It
  unsubscribes on unmount.
- **`SoftwareUpdateRow`** — through `@testing-library/react` under a real
  `SnackbarProvider`, the snackbar suites' precedent:
  - each face's line and button;
  - absent, with its hairline, with no bridge;
  - each pressed outcome's snackbar, or none for `found`;
  - **Update now** calls `install()`.
- **`SoftwareUpdateNotice`** — the offer pushed once on `current()` or the
  first `onStatus`, never twice under StrictMode, and retracted when
  `installing` arrives. Its **Update now** calls `install()`. The
  congratulation is shown on a changed Seen version, never on a fresh one or
  an unchanged one. It does nothing with no bridge.
- **`seenVersion`** — read and write over `localStorage`, and a throwing
  storage tolerated: the `volumePreference` suite's shape.
- **`AboutSection`** — its existing suite extended: the row mounted above the
  brand row with a bridge; exactly today's card without one.
- **Packaging guard** — the existing config suite: the feed names
  `repository` as a draft GitHub provider, `verifyUpdateCodeSignature` is
  false, and `files` holds five entries including the preload.
- **Build script** — the existing suite asserts three bundles.
- **`fakeUpdateBridge`** in `src/test-support/` installs a controllable
  `window.familyflix.updates`: `current()` and `check()` answers set by the
  test, `emit(status)`, `install()` recorded, and removal after the block.
  This follows `stubDownload` and `stubScrollTo`.
- **Not unit-tested:** `main.ts` and the preload (wiring only, proven by the
  smoke), and `release.yml` (proven by the first tag).

## Out of Scope

- An auto-download toggle or any preference store, and `electron-store`.
- A download progress bar or percentage.
- Release notes or a "what's new" face.
- Release channels or prereleases.
- Rollback.
- An update check on a timer, and a ticking _Last checked_.
- A snackbar suppressed by route.
- A confirm or a run-in-flight warning before **Update now**.
- An error face on the row (a refusal is a snackbar).
- A version-string comparison of our own.
- Code signing and certificates (packaging's, settled unsigned).
- CI on pushes to `main`.
- Publishing 0.1.0.
- Diagnosing the Sandbox blank window inside this initiative: it is a
  `desktop-packaging` fix that gates phase 3's first publish.

## Further Notes

- Design log: `docs/design-logs/17-software-update.md`. Two sessions. The
  second (2026-10-04, at `639c78c`) fits the first onto the shell and the
  installer as they shipped.
- Horizon's auto-update was the reference. This one deliberately differs in
  having no toggle (Q7), in pushing the whole status (Q37), in running the
  shutdown before install (Q38), and in draft releases (Q48).
- **Risks.**
  - CI on `windows-latest` runs the whole suite on a machine that has never
    run it, so the first tag may find environment assumptions the local
    commit gate never met.
  - Bundling `electron-updater` into `main.js` is unproven until the first
    packaged check.
  - `localStorage` becomes load-bearing for the congratulation. If it fails,
    the only loss is one missing snackbar.
- **The cost of v0.2.0.** The parents' PC needs one more manual install (and
  one more SmartScreen click). After that, they never need another.
