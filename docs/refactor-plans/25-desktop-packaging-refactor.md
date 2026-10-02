# Refactor plan: Desktop packaging — the guard the log asked for, one spelling of the name, a zip reader with a suite, the Package smoke run, and the docs that close the initiative

> Source initiative: [`desktop-packaging`, issue #227](https://github.com/carlos-rezai/FamilyFlix/issues/227)
> Shipped by issues 228–232. Design log: `docs/design-logs/25-desktop-packaging.md`.
> Filed as issue 234.
> The docs-and-refactor-filing slice filed as 233 is folded in here as Group 0
> and Group 4, on the precedent of 225 into 226, 213 into 214, 200 into 201,
> 186 into 187, 176 into 177, 168 into 169, 163 into 164, 156 into 157, 148
> into 149 and 140 into 141. It is closed at filing so the initiative has one
> closing issue rather than two. The feature table ticks ✅ when this one
> closes.

## Problem Statement

`desktop-packaging` is step 8 of the build order. It turns the repo into one
file, `FamilyFlix-Setup-0.1.0.exe`, that the maintainer double-clicks on the
parents' PC. It shipped as 21 files across five slices (228–232):

- `shellPaths`, read once by main, and `serverLaunch` built on it
- the server bundle carrying `better-sqlite3`'s JS, and `dependencies: {}`
- `electron-builder` behind `packageApp.mjs`, `builderConfig.json` and its
  guard, version `0.1.0` and `author`
- the **FFmpeg pin**, `fetchFfmpeg.mjs` and `verifyDigest`, and
  `FAMILYFLIX_FFMPEG_PATH` when installed
- the four fuses

The prototype draws no installer. Here "the prototype" is the **App mark**,
and every surface the log listed (Q18) is pointed at the one `icon.ico`.

What shipped is what the log settled, and everything a machine can check is
green. `electron:package --dir` wrote the **Packaged layout** with no
`node_modules`. `electron:package` wrote the **Installer**. The exe reads
FileDescription `FamilyFlix`, FileVersion `0.1.0` and CompanyName
`Carlos Rezai`. The real pin downloaded, verified and extracted in five
seconds. The fuse wire read back from the exe matches the config. Vitest was
green straight after a package. 6693 tests pass across 387 files, `tsc -b` is
clean, and `eslint src server electron .husky` reports no errors and no
warnings.

What is left is the usual shape of a round built one slice at a time, plus one
thing no earlier round has had: **the proof of this initiative was never run.**

### 1. The Package smoke has not been run

The log's proof of an Installer (Q26) is the **Package smoke** in Windows
Sandbox. None of 230, 231 or 232 ran any of it, because a slice runs
unattended and an install cannot. Every slice closed with its manual items
listed as outstanding:

- **230:** SmartScreen, the one-click window, the app opening maximized; the
  mark on the shortcuts, the taskbar, Alt+Tab, a pin and _Settings → Apps_;
  Task Manager; the pin and the window as one button; uninstall and reinstall
  keeping the library; a direct-played MP4; no console window flashing during
  a package.
- **231:** `resources\ffmpeg\` holding exactly four files; an `.mkv` remuxed
  and played; the Codec report saying **Default**; an upload overriding it and
  the ✕ falling back.
- **232:** all of the above again on the hardened exe; `ELECTRON_RUN_AS_NODE`,
  `NODE_OPTIONS` and `--inspect` with no effect; a stray `app` folder beside
  the asar ignored.

So nothing has yet proven that the installed app opens at all on a machine
with no Node. Until it does, step 8 is not done, whatever its issues say.

### 2. The guard leaves out two of the log's promises

`packagingConfig.test.ts` holds everything Q25 listed. It does not hold two
things the log said elsewhere, and both fail silently if they drift:

- **Q7, the asar's contents.** The asar holds only `package.json`, the two
  bundles and the icon. `files` says so, and the 230 smoke confirmed it. But no
  leaf asserts it. A glob added to `files` would ship whatever it matched,
  which is the same silent-shipping risk Q9's `dependencies: {}` guard exists
  to stop.
- **Q18, `signAndEditExecutable: true`.** The log calls this out by name:
  turning it off "to skip signing" ships Electron's atom icon on the exe. The
  guard's own `BuilderConfig` interface declares the field, and no leaf reads
  it.

The guard also ties each `extraResources` **`to`** to the directory
`shellPaths` reads when installed, but never ties a **`from`** to anything.
The binding's `from`, `electron/.native`, is spelled three times: in the
config, in `shellPaths`' unpackaged branch, and in `fetchNative.mjs`. Only the
first two can be compared in a test.

### 3. Two spellings that need not be two

- **`productName`** is `FamilyFlix` in `package.json`, where it names
  `userData` (`%APPDATA%\FamilyFlix`) and is guarded by `buildElectron.test`.
  It is `FamilyFlix` again in `builderConfig.json`, unguarded.
  `electron-builder` reads `package.json`'s `productName` when the config
  carries none. A rename in one place would give the exe one name and the
  family's data folder another.
- **`ShellPaths.app`** is answered in every mode, asserted by two leaves, and
  read by nothing. Q11 sketched it as "`package.json`'s directory". In the
  shipped code, every consumer reads a path derived from it (`icon`,
  `serverEntry`, `renderer`) rather than the root itself.

### 4. A zip reader inside a script, tested on the path the real archive does not take

`fetchFfmpeg.mjs` is 174 lines with three jobs: the pin and its README mark,
the download, and a hand-written zip reader (the central directory, then each
entry stored or deflated). That last choice was right, because it keeps the
script free of any dependency. But its suite builds a **stored** zip, and
gyan.dev's archive is **deflated**. The branch that every real run takes, along
with the _not a zip_, _damaged entry_ and _unknown method_ refusals, has run
once: by hand, on the pin, during 231.

`verifyDigest` already set the precedent for a pure unit beside the scripts:
erasable TypeScript in its own folder with its own suite, imported by the
`.mjs` under Node's type stripping.

### 5. Every run of `electron:ffmpeg` prints a warning

Node prints `MODULE_TYPELESS_PACKAGE_JSON` when `fetchFfmpeg.mjs` imports
`verifyDigest.ts`. The root `package.json` has no `"type"`, and it cannot
have one, because the two bundles in `electron/dist/` are CJS named `.js`. 231
noted the warning as harmless. It lands in every package log, and a second
typed unit beside the scripts (§4) would print it twice.

### 6. The documents that close the initiative (issue 233, folded in here)

- **CLAUDE.md.**
  - _Tech Stack_ says FFmpeg is "bundled by the installer". The glossary calls
    "bundled" an alias to avoid for the **Default component**.
  - `FAMILYFLIX_SQLITE_BINDING` still says main sets it "for unpackaged runs".
    It is now set in every mode.
  - `FAMILYFLIX_FFMPEG_PATH` still calls itself "the slot the installer
    fills", and does not say main sets it when installed.
  - The folder map has no `shellPaths/`, no `packaging/`, no `verifyDigest/`,
    none of the three new scripts, and no `.ffmpeg/`.
  - _Desktop Build_'s packaging line says "step 8, not yet built".
  - Step 8's entries in the build order and in _System_ still read 🔜.
- **README.**
  - Its stack line says "not built yet".
  - _The installer_ section says "Not built yet".
  - It documents neither `electron:package` nor `electron:ffmpeg`, nor
    installing on a new machine, nor the one SmartScreen click.
- **The Package smoke** exists only as five lines of the log's Q26. It is not
  written anywhere as the checklist a release is run against.
- **COMPONENT-SPEC**'s **App mark** row names `icon.ico` and `favicon.ico` as
  consumers, but not the exe, the Installer or the uninstaller (Q20).
- **The glossary**'s _Desktop packaging_ section has not been checked against
  the shipped code.
- **Two logs** state what log 25 settled, and neither carries a pointer to it:
  - log 24 Q19's last sentence, "packaging rebuilds for Electron" (log 25
    Q10)
  - log 17 Q11's "a self-signed certificate in Trusted Root is packaging's
    call" (log 25 Q21)
- **The journal** has no entry for the build.

## Solution

Five groups. Each commit leaves a working tree.

0. **The build's record.** This comes first, so the journal describes what
   shipped before this round changes it.
1. **The guard.** The two promises it leaves out, and the binding's `from`
   tied to `shellPaths`. These are characterization leaves: green on arrival,
   because the config is already right.
2. **The units.** One spelling of the product name, no `ShellPaths.app`, the
   guard's one installed reading, the zip reader as a unit with a suite over
   the deflated path, and no warning from the scripts' typed units.
3. **The Package smoke.** Written down as the release checklist, then **run by
   the maintainer in Windows Sandbox** against an Installer built from the
   tree Groups 1–2 leave behind. This is the one hands-on step, and the round
   stops there until it is run. Anything it finds is fixed before Group 4.
4. **Documents.** They come last, because the map and the glossary have to
   describe the tree the earlier groups leave behind, and the tick has to
   follow a smoke that passed.

Fourteen commits in all, plus the smoke. **Nothing changes on screen, and
nothing changes in the Installer**: the exe, the layout, the shortcuts and the
data folder are what 232 built. One thing changes for the maintainer:
`electron:ffmpeg` prints no warning.

## Commits

### Group 0 — the record of what was built

1. **The journal's packaging entry.** `docs/dev-journal.md` gets the build's
   entry, dated by the last build commit (2026-10-01). It covers:
   - What shipped across 228–232, slice by slice. 229 was split out of the
     log's first step, as the plan said, because the paths and the
     dependencies do not depend on each other.
   - The judgment calls the slices made on their own:
     - `verifyDigest` placed at `electron/scripts/verifyDigest/` and imported
       by the `.mjs` under Node's type stripping. This disproves the reason the
       `electron-shell` refactor gave for leaving the binding's path spelled
       twice ("a `.mjs` script run by Node cannot import a `.ts` unit without a
       loader"). The entry says so.
     - the README's digest as `fetchFfmpeg`'s "already matches" mark, rather
       than hashing two binaries on every package
     - the zip read by hand, so the script needs no dependency
     - the NSIS x64 target and `electronVersion` supplied by `packageApp.mjs`
       rather than written in the config, because `--dir` swaps the target and
       the version is read off `node_modules/electron` (Q17). Both stay.
     - the pin at gyan.dev's 9.0.2 from the GyanD GitHub release, with its
       digest checked against the one GitHub publishes
     - `nativeBindingPath` folded into `shellPaths`, as the plan said
   - What was verified unattended: the `--dir` layout, the exe's version
     resource, the real pin's run, the fuse wire read back, and Vitest green
     after a package.
   - What was **not** run: the Package smoke. It is listed item by item from
     the three closing comments and marked as this refactor's Group 3.
   - What was deliberately not built, per Q1, Q2, Q16, Q21 and the Trade-offs:
     - the release feed, `publish`, `release.yml` and `npm version` (step 9)
     - signing of any kind, and asar integrity validation
     - arm64, macOS and Linux
     - an assisted installer, a directory picker, installer artwork, a
       portable build or an MSI
     - auto-launch, a tray, and backup on install
   - The test count after the build, and the follow-ups by bare number.

### Group 1 — the guard

2. **The asar holds only what main requires.** The guard gains a leaf: `files`
   is exactly `package.json`, `electron/dist/main.js`,
   `electron/dist/server.js` and `electron/assets/icon.ico`, in any order, and
   no entry is a glob (Q7). It is green on arrival.

3. **The exe is stamped with the mark.** The guard gains a leaf:
   `win.signAndEditExecutable` is `true`, with the log's reason as the leaf's
   comment. It is rcedit, the step that writes the icon and the version into
   an unsigned exe (Q18). It is green on arrival.

4. **The binding's source is the directory the unpackaged shell reads.** The
   guard gains a leaf: the `extraResources` entry whose `to` is the installed
   binding's directory has a `from` that, joined onto a repo, is
   `dirname(shellPaths('start', …).sqliteBinding)`. The config, `shellPaths`
   and the slot `electron:native` fills now agree by test. `fetchNative.mjs`
   keeps its own spelling (see _Out of Scope_). It is green on arrival.

### Group 2 — the units

5. **One spelling of the product name.** `productName` leaves
   `builderConfig.json`, and `electron-builder` reads `package.json`'s, the
   same one that names `userData`. The guard's _versioned 0.1.0, by Carlos
   Rezai_ leaf gains the assertion that the config carries no `productName`.
   Smoke: `electron:package --dir` still writes
   `release/win-unpacked/FamilyFlix.exe`, and its version resource still reads
   FileDescription `FamilyFlix`.

6. **`ShellPaths` answers only what is read.** The `app` field leaves
   `ShellPaths`, along with its doc comment. In `shellPaths.test.ts`, _answers
   the repo as the app_ and its installed counterpart go. They are the only
   leaves that change. Every derived path is asserted already.

7. **The guard reads the installed layout once.** `packagingConfig.test.ts`'s
   two copies of the installed `shellPaths(…)` call over the same three
   locations become one `installed()` helper at the top of the suite. A move:
   no leaf changes.

8. **The zip reader is a unit.** `electron/scripts/zipEntries/` is added with
   its suite, on `verifyDigest`'s precedent:
   - pure, erasable TypeScript only, with a header comment saying so
   - `zipEntries(zip)` → the entries off the central directory
   - `entryBytes(zip, entry)` → one entry's bytes, stored or deflated
   - the three refusals as throws, each naming the entry

   The suite builds its archives with `node:zlib` and covers:
   - a stored entry
   - **a deflated entry, which is what gyan.dev's archive carries**
   - a buffer that is not a zip
   - a damaged local header
   - an unknown method

   `fetchFfmpeg.mjs` imports the unit by path with its `.ts` extension, and
   loses `entries` and `contents`. Its suite is unchanged, and every leaf
   stays green. That is the proof the move kept the behaviour.

9. **No warning from the scripts' typed units.** `electron/scripts/` gains a
   one-line `package.json`, `{ "type": "module" }`, with no name and no
   scripts. It scopes the two typed units the `.mjs` imports as ESM, so Node
   stops guessing. The root manifest keeps no `"type"`, and the bundles stay
   CJS. `fetchFfmpeg.test.ts` gains one leaf: a run's output carries no
   `MODULE_TYPELESS_PACKAGE_JSON`.

   Before committing, check two things:
   - `node node_modules/nx/dist/bin/nx.js show projects` lists the same
     projects as before
   - `tsc -b tsconfig.json` is clean (`moduleResolution: node` does not read a
     nested `"type"`)

   If either check fails, drop the commit. The journal then records the
   warning as accepted, with the reason.

### Group 3 — the Package smoke

10. **The release checklist.** `docs/release-checklist.md` is added: the
    **Package smoke**, step by step, as a checklist that a release is ticked
    against. README links to it. Each step says what to do and what to see:
    1. **Build.** `npm run electron:package` on the dev machine. No console
       window flashes during the run. `release/FamilyFlix-Setup-<v>.exe` is
       written. `release/win-unpacked/resources/ffmpeg/` holds exactly
       `ffmpeg.exe`, `ffprobe.exe`, `LICENSE.txt` and `README.txt`.
    2. **Into Sandbox.** Start Windows Sandbox and copy in the Installer and
       the importer's fixture (`library.xlsx` and `root/`).
    3. **Install.** SmartScreen appears once: _More info → Run anyway_. The
       one-click progress window wears the mark. The app opens maximized on
       _Your library is empty_.
    4. **Every surface wears the mark.** The setup file in Explorer, the
       desktop and Start shortcuts, the taskbar button, Alt+Tab, a pin (the
       pin and the window are one button), _Settings → Apps_ (publisher Carlos
       Rezai, version 0.1.0), and Task Manager reading FamilyFlix.
    5. **Play.** Import the fixture. An MP4 direct-plays and an `.mkv`
       remuxes and plays. Settings → Codecs shows the **Default component**,
       and About reads the version.
    6. **The slot over the default.** Upload the pair from
       `resources\ffmpeg\` through the drop zone: the row reads Uploaded, and
       Play still works. Press ✕, and the row reads Default again.
    7. **The fuses.** From a Command Prompt in the install directory:
       - `set ELECTRON_RUN_AS_NODE=1 && FamilyFlix.exe -e "1"` opens the app,
         not a Node prompt
       - `NODE_OPTIONS=--inspect` has no effect
       - `FamilyFlix.exe --inspect` has no effect
       - an `app\` folder created beside `app.asar` changes nothing
    8. **Uninstall and reinstall.** Quit, then uninstall from _Settings →
       Apps_. `%APPDATA%\FamilyFlix\` is still there. Run the Installer again,
       and the library is still there, films and all.
    9. **Back on the dev machine.** `node_modules/.bin/vitest run` is green.

    The file says that step 9's release ritual will extend it, and that a
    failed step blocks the release.

    **HITL — the maintainer runs the checklist** against an Installer built
    from the tree after commit 10. This is not a commit. The round stops here
    until it is done. Each failed step becomes a `fix:` commit under this issue
    before Group 4, and the smoke is run again. A failure that is not
    packaging's (one in the player, say) is filed as its own issue and named
    in the journal.

11. **The smoke's result.** The journal's packaging entry gains the date, the
    Windows build Sandbox ran, each step's result, and any fix commit by hash.
    The closing comments' outstanding items are then all answered.

### Group 4 — the documents that close the initiative (issue 233)

12. **CLAUDE.md and README.**
    - _Tech Stack_'s FFmpeg line says the **Installer** carries the **FFmpeg
      pin**'s build as the **Default component**, not "bundled by the
      installer".
    - _Environment Variables_:
      - `FAMILYFLIX_SQLITE_BINDING`: main sets it in **every** mode, to
        `electron/.native/` unpackaged and to `resources\native\` installed.
        Unset is Vitest and `npm run dev`.
      - `FAMILYFLIX_FFMPEG_PATH`: main sets it, when installed, to the
        **Default component** under `resources\ffmpeg\`. Unpackaged runs leave
        it to `PATH`.
    - The folder map gains:
      - `shellPaths/`, with its line
      - `serverLaunch`'s line, restated over `ShellPaths`
      - `packaging/` (`builderConfig.json`, `ffmpegPin.json` and the guard)
      - `scripts/` gaining `fetchFfmpeg.mjs` (`electron:ffmpeg`),
        `packageApp.mjs` (`electron:package`), `verifyDigest/`, `zipEntries/`
        and its `package.json`
      - the gitignored `.ffmpeg/` beside `.native/` and `dist/`
      - `release/`
    - _Desktop Build_'s packaging line says what shipped: one-click, per-user
      NSIS, `release/FamilyFlix-Setup-<v>.exe`, unsigned, and the library kept
      on uninstall.
    - README:
      - The stack line says what shipped.
      - _The installer_ replaces "Not built yet" with `npm run electron:ffmpeg`
        (run by `electron:package` anyway, and offline once fetched) and
        `npm run electron:package` (with `--dir`).
      - _Installing on a new machine_: copy the Installer over, run it, click
        SmartScreen's _More info → Run anyway_ once, and import the library.
      - A link to the release checklist.
      - README's tree gets the same changes as the map.

13. **COMPONENT-SPEC, the glossary and the two log pointers.**
    - COMPONENT-SPEC's **App mark** row gains the packaged exe, the
      **Installer** and the uninstaller as consumers, through
      `electron/packaging/`. This is a registration, not a pixel change (Q20).
    - The glossary's _Desktop packaging_ section is read row by row against the
      code, and each of **Installer**, **Packaged layout**, **Shell paths**,
      **Electron-ABI binding**, **FFmpeg pin**, **Package smoke**, **Installed
      app**, **App mark**, **App version** and **Default component** is
      confirmed or corrected:
      - **Shell paths** loses any mention of `app`.
      - **Package smoke** points at `docs/release-checklist.md`.
      - The section header loses _(new)_ and the rows their _(new)_ and
        _(updated)_ tags, on the precedent of the earlier sections.
    - Log 24 Q19 and log 17 Q11 each gain a one-line ⚠️ pointer, the way log
      17 Q13 carries one. Q19's last sentence is superseded by log 25 Q10:
      nothing is rebuilt, and the Installer carries the Electron-ABI binding.
      Q11's self-signed option is settled by log 25 Q21: unsigned, and no root
      certificate. The answers themselves are not rewritten.

14. **The journal's paragraph and the tick.** The round's own journal entry
    covers:
    - what each group changed
    - the test count before and after
    - whether commit 9 landed or was dropped, and why
    - what was deliberately left out, in the shape the decision document below
      gives

    Then the tick:
    - **Desktop packaging** ✅ in README's and CLAUDE.md's feature lists.
    - The build-order chain in both files loses step 8 ("steps 1–8 … are
      done"), and **Software update** becomes "next" with its gates met.

    This commit closes this issue. 227 is closed by a comment at the same time,
    by bare number and never with a closing keyword. 233 was already closed as
    folded in when this plan was filed. _(The closure happens at closing time,
    not as a commit.)_

## Decision Document

- **The initiative is not done until the Package smoke has passed.** The log
  made the smoke the proof of an Installer (Q26), and no slice could run it.
  The round writes it down first, so that the run follows a checklist rather
  than memory. The round stops until the maintainer runs it, fixes what it
  finds inside the round, and ticks ✅ only after it passes (Q27).
- **The release checklist is a document of its own.** `docs/release-checklist.md`,
  linked from README. Step 9 extends it with the publish and the update
  round-trip (log 17's proof cycle) rather than writing a second one.
- **The guard holds every promise the log made about the config,** not only
  the ones Q25 listed: the asar's four files (Q7) and rcedit (Q18). Both fail
  silently and both would ship.
- **One name, in `package.json`.** `productName` is read by Electron for
  `userData` and by `electron-builder` for the exe and the Installer. The
  config does not repeat it. `appId` stays spelled in both the config and
  `appIdentity`, because JSON cannot import, and the guard already ties the
  two.
- **`ShellPaths` answers what is read.** `app` goes. This departs from Q11's
  sketch for the reason the code gives: no consumer reads the root. Each one
  reads the path it needs.
- **A dev script's logic gets a unit when it is worth a suite.** `zipEntries`
  joins `verifyDigest` under `electron/scripts/`: one folder, erasable
  TypeScript, imported by the `.mjs` with its extension. The download and the
  README mark stay in the script, under the script's end-to-end suite.
- **`electron/scripts/` is ESM by its own manifest.** The root keeps no
  `"type"`, because the bundles are CJS `.js`. The nested manifest carries one
  key and nothing Nx or npm reads as a project or a package.
- **Nothing changes in the Installer.** Any difference in the Packaged layout,
  the exe's version resource or the NSIS behaviour after this round is a bug in
  the round.
- **Design logs gain pointers, not edits.** Log 24 Q19 and log 17 Q11 each get
  the one-line ⚠️ pointer that log 17 Q13 set the precedent for.

## Testing Decisions

- **A good test asserts behaviour through the unit's own seam.**
  - A pure unit (`shellPaths`, `verifyDigest`, `zipEntries`): what it answers
    for what it is handed.
  - The config guard: the committed JSON read as data, held to the units it
    must agree with (`APP_USER_MODEL_ID`, `shellPaths`). No packager runs.
  - A script (`buildElectron`, `fetchFfmpeg`): run with Node, by path and with
    no shell, over a sandbox and a loopback server of the suite's own.

  No test launches Electron, runs `electron-builder` or runs an NSIS install.
  The Installer's proof is the Package smoke, by hand.

- **Characterization leaves are green on arrival.** Commits 2, 3 and 4 add
  leaves over a config that is already right. A red leaf there means the
  config drifted between 232 and now, and that drift is fixed in the same
  commit.
- **Pure moves change no leaf.** Commits 7 and 8 move code under suites that
  already assert its behaviour: the guard's, and `fetchFfmpeg`'s end-to-end
  suite. A red leaf in either means the refactor is wrong, not the test.
- **Removed and added leaves are named.**
  - Commit 5 adds one assertion to an existing leaf.
  - Commit 6 removes the two `app` leaves, and nothing else changes.
  - Commit 9 adds one leaf to `fetchFfmpeg`'s suite.
- **A new suite for the unit that had none:** `zipEntries`, written in the
  commit that creates it. It is the first suite to run the deflated path that
  every real `electron:ffmpeg` takes.
- **Prior art.**
  - `verifyDigest.test.ts` for `zipEntries`: a pure unit beside the scripts.
  - `fetchFfmpeg.test.ts`' `storedZip` for building an archive by hand, which
    `zipEntries`' suite extends with `deflateRawSync`.
  - The guard's existing leaves for commits 2–5.
  - `buildElectron.test.ts`' _calling no npx_ for asserting on a script's
    output.
- **The round is finished when `node_modules/.bin/vitest run`,
  `node_modules/.bin/tsc -b tsconfig.json` and
  `node_modules/.bin/eslint src server electron .husky` are all clean, and the
  Package smoke has passed.**

## Out of Scope

- **The fetch scripts' output directories.** `fetchNative.mjs` writes
  `electron/.native/`, and `fetchFfmpeg.mjs` writes `electron/.ffmpeg/`, each
  spelled in the script. Type stripping now lets a `.mjs` import a `.ts`
  unit, so the old reason is gone. The binding could be found through
  `shellPaths`, but that means calling a shipping unit with an invented
  Shell mode and three locations a script does not have. The FFmpeg directory
  has no unpackaged reading in `shellPaths` at all (`ffmpeg` is `null`). Both
  are gitignored scratch. Commit 4 ties the config to `shellPaths`, and the
  Package smoke ties the scripts to the config, because a missing `from`
  ships an Installer that fails step 3 or 5.
- **A suite for `packageApp.mjs`.** It is a chain of four scripts that each
  have a suite or are run by hand, then `electron-builder`'s `build()`. Its
  proof is the Package smoke's step 1.
- **The NSIS target and `electronVersion` in the script.** `--dir` swaps the
  target, and the version is read off `node_modules/electron` so that the
  runtime and the binding cannot disagree (Q17). Writing either into the
  config would make it a second source.
- **`serverLaunch`'s `userData` parameter.** The three data paths under
  `userData` are the server's environment, not the shell's layout. They stay
  `serverLaunch`'s, beside the variables they set.
- **`buildElectron.test`'s better-sqlite3 marker.** The _bundled rather than
  external_ leaf looks for a string from `better-sqlite3`'s own source. That
  couples it to the package's wording. The _requires nothing from
  node_modules_ leaf beside it already proves the property that matters. A
  better-sqlite3 upgrade that rewords the message turns the leaf red loudly
  rather than silently, so it stays.
- **Everything the log ruled out**:
  - step 9's: the release feed, `publish`, `repository`, `release.yml`,
    `npm version` and the updater
  - code signing of any kind, and asar integrity validation
  - arm64, macOS and Linux
  - an assisted installer, a directory picker, installer artwork, a portable
    build or an MSI
  - auto-launch, a tray, and backup or migration on install

## Further Notes

- **What the next initiative inherits.** After this round, step 9 has:
  - an NSIS one-click Installer proven on a clean machine
  - an `appId`, a version of `0.1.0`, and a `builderConfig.json` it only has to
    add `publish` to
  - a release checklist it extends with the publish and the update round-trip
  - one name in `package.json`, read for the exe, the Installer and
    `userData` alike

  Log 17's proof cycle (_"0.1.0 launches, offers 0.1.1"_) starts from an
  Installer the smoke has already installed.

- **Why the slices built it this way.** Every item above was the smallest
  change that made a slice's leaf pass:
  - The smoke was left outstanding because a slice runs unattended, and each
    slice said so in its closing comment rather than ticking it.
  - The guard holds Q25's list because Q25 was the list the slice was handed.
  - `productName` was repeated because the log's config sketch repeated it.
  - `app` was answered because Q11's interface named it.
  - The zip reader was written inline because `verifyDigest` was the one piece
    the plan named as pure, and the suite drove the script end to end with
    the simplest zip a test can write.

  That these add up to an unproven Installer and a reader tested on the wrong
  branch only shows when the initiative is read as a whole.
