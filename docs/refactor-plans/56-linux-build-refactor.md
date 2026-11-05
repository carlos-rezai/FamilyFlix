# Refactor plan: Linux build, one spelling of the synopsis, a Menu entry that escapes its path, an FFmpeg target that says what is executable, and the docs that close step 39

> Source initiative: `linux-build`, issue 511 (step 39).
> Shipped by issues 512 to 521: the build slices 512 to 516, the v0.14.0
> draft (517) and Deck smoke (518), then the smoke's fixes 519 to 521 (up to
> `3554580a`, released as v0.14.1).
> Design log: `docs/design-logs/56-linux-build.md`, with its 2026-11-05
> amendment (the **Menu entry**).
> PRD: `docs/PRDs/56-linux-build.md` (511). Plan:
> `docs/PRDs/56-linux-build-plan.md`.
> This is the initiative's closing round. It ticks **Linux build**.
> Filed as issue 522.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._ The maintainer approved every recommendation in advance.

## Problem Statement

`linux-build` shipped every phase of its plan, and its proof has run: the
v0.14.1 **Package smoke** passed both halves, and the Deck updated itself
from v0.14.0 to v0.14.1 through `latest-linux.yml`, the first Linux update
round-trip. What is left is the usual shape of a round built one slice at a
time, then patched three times after a smoke.

Verified in the code at `3554580a`:

### 1. The synopsis is spelled twice

`main.ts` holds `LINUX_SYNOPSIS`, the **Menu entry**'s `Comment`, and its
docblock says it is "`linux.synopsis` in `builderConfig.json`". Nothing holds
the two together: an edit to either leaves the AppImage's embedded entry and
FamilyFlix's own **Menu entry** describing the app differently, with no test
going red. The codebase already has the pattern for exactly this:
`APP_USER_MODEL_ID` lives in `electron/appIdentity/`, main imports it, and
`packagingConfig.test.ts` asserts `appId` equals it. The same is true of the
entry's `Categories=AudioVideo;`, a second spelling of `linux.category`.

### 2. The Menu entry's `Exec` is quoted, not escaped

`menuEntry` writes `Exec="<$APPIMAGE>" %U` and `TryExec=<$APPIMAGE>` from
the path as it is. The Desktop Entry spec reserves characters in both:
inside a quoted `Exec` argument `"`, `` ` ``, `$` and `\` take a backslash,
a literal `%` is `%%`, and every value escapes `\` as `\\`. A path with a
space is tested and works; a folder named `50% off` or holding a `$` writes
an entry that opens nothing. Unlikely on the Deck, but the unit owns the
whole file and a wrong one is silent.

`writeMenuEntry` also invents an error: a missing **App mark** throws
`ENOENT: no App mark at ...`, an error code nothing raised. And its test for
that case makes the fake disk _throw_ on the mark's read, while main's real
`menuEntryFs.read` answers `undefined` on any failure; the branch production
takes is not the one the test drives.

### 3. What is executable is decided by a string compare in a script

`ffmpegTarget` answers `wanted` as `[inner, shipped]` pairs, the licence
among them. `fetchFfmpeg.mjs` then works out which files are programs with
`binariesOf`, a filter on `shipped !== 'LICENSE.txt'`, and uses it twice:
for the `0o755` mode and for the README's "Only ffmpeg and ffprobe are
carried". The initiative's own rule (log 56, _Trade-offs_) is that each
Linux answer is a unit test on Windows; the executable bit is proven only by
`fetchFfmpeg.test`'s Linux-only case, and a renamed licence would make it
executable.

### 4. Two platform types where the rest says `NodeJS.Platform`

`shellPaths` and `menuEntry` take `platform: NodeJS.Platform`, as log 56 Q11
and Q18 wrote. `packageOptions` and `ffmpegTarget` take `platform: string`.
Both are in `tsconfig.electron.json` with Node's types, and a type annotation
is erasable, so nothing stops them saying the same.

### 5. A suite that says everything twice

`shellPaths.test` gained, in 512 and 517, both per-field Windows describes
(each now naming `'win32'`) and a whole-object _answers exactly today's
paths_ describe that asserts the same nine fields again. Its _without a
platform_ describe asserts the Linux answer once by hand and again in the
`it.each` beside it. Its header still says installed carries `ffmpeg.exe`,
and "today's" ages.

### 6. Docblocks and docs that know one platform

- `packageApp.mjs`'s header: "the **Installer**. Issue #230", and usage lines
  naming only `FamilyFlix-Setup-<version>.exe` and `release/win-unpacked/`.
- `fetchFfmpeg.mjs`'s header: "the **Default component** the **Installer**
  carries"; `fetchFfmpeg.test`'s: "what the **Installer** ships to
  `resources\ffmpeg\`".
- The direct-play route's and the renderer fallback's docblocks don't say why
  `sendFile` allows dotfiles (issue 519); a later reader sees an option that
  looks like a loosening.
- `src/types/libraryFolders.ts` says _Open folder_ shows the folder "in
  Explorer", twice: behaviour, which log 56 Q2 said to correct as touched.
  (`formatBytes`, `spaceUsed` and `StorageSection` name Explorer's Properties
  dialog as the figure they agree with, which is a fact about Windows, and
  stay.)
- The README's tree says `release/` holds "the Installer, and win-unpacked/".
- The feature checklist row is still 🔜, step 39's entry still planned, and
  the journal has no entry for the initiative.

## Solution

1. **One spelling of the synopsis**: `APP_SYNOPSIS` in `appIdentity`, read by
   main, held to `linux.synopsis` by the packaging guard; the entry's
   category held to `linux.category`.
2. **The Menu entry escapes what the spec reserves**, and a missing App mark
   is a plain sentence, tested the way production reaches it.
3. **The FFmpeg target says which entries are executable**; the fetch script
   stops deciding it.
4. **`NodeJS.Platform` everywhere the platform is an argument.**
5. **`shellPaths.test` says each thing once.**
6. **The docblocks and docs name both Platform builds**, and step 39 closes.

No wire, schema, route, renderer, workflow or packaging-output change. The
Installer and the AppImage are byte-for-byte the same programs apart from
`main.js`'s inlined constant.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean, except a
`test:` RED commit, which the commit gate lets through by design (it checks
only the shipping projects). Each commit is
`<type>: [linux-build] issue #522 …`.

### Group 1: one spelling of the synopsis

1. **`test: … the synopsis is spelled once, RED`.**
   - `appIdentity.test`: `APP_SYNOPSIS` is the sentence
     _A browsable library and player for the family movie folder_; main
     imports it from `./appIdentity/appIdentity` and declares no
     `LINUX_SYNOPSIS` (its existing comment-stripped source reading, as for
     `APP_USER_MODEL_ID`); main passes it to `menuEntry`.
   - `packagingConfig.test`: the `linux` block's `synopsis` **is**
     `APP_SYNOPSIS`, replacing the leaf that asked only for a non-empty
     string; and the **Menu entry**'s `Categories` is the `linux` block's
     `category` followed by `;`, read from `menuEntry`'s answer for a Linux
     AppImage run.
2. **`refactor: … the synopsis is spelled once`.**
   - `appIdentity.ts` exports `APP_SYNOPSIS` beside `APP_USER_MODEL_ID`,
     with a docblock naming both places that carry it (the `linux` block,
     the **Menu entry**'s `Comment`).
   - `main.ts` drops `LINUX_SYNOPSIS` and imports `APP_SYNOPSIS`.
   - `menuEntry`'s signature is unchanged: the synopsis stays an argument,
     so the unit stays pure and its suite passes its own.

### Group 2: the Menu entry escapes its path

3. **`test: … the Menu entry escapes what the spec reserves, RED`.**
   `menuEntry.test`, through its existing `parse` of the entry text:
   - an AppImage path holding `"`, `` ` ``, `$`, `\` and `%` is written in
     `Exec` quoted, each of the four quote-reserved characters behind a
     backslash, `%` doubled, and the whole value's backslashes doubled, so
     that unescaping by the spec gives back the path; `TryExec` gives back
     the path by the same rule;
   - the spaced-path case stays as it is.
   - The writer's failure case for a missing App mark is driven the way
     production reaches it: the disk's `read` answers `undefined` for the
     mark, and the one Shell log line names the mark's path, with no
     `ENOENT`. The throwing-disk case stays as the generic failure.
4. **`fix: … the Menu entry escapes what the spec reserves`.**
   - `menuEntry.ts`: one module-private helper per rule, named for the
     spec's terms (an `Exec` argument, a string value); `Exec` and `TryExec`
     built from them. The docblock gains one sentence citing the Desktop
     Entry spec.
   - `writeMenuEntry`: a missing mark throws `No App mark at <path>.`

### Group 3: the platform as a type, and the executable bit as data

5. **`refactor: … the packaging units take NodeJS.Platform`.**
   `packageOptions(args, platform: NodeJS.Platform)` and
   `ffmpegTarget(platform: NodeJS.Platform)`, as `shellPaths` and
   `menuEntry`. Types only; both stay erasable for Node's type stripping
   (proven by `fetchFfmpeg.test` and `packageOptions.test`'s script cases
   running the `.mjs` files). Every suite passes unchanged.
6. **`test: … the FFmpeg target says which entries are executable, RED`.**
   - `ffmpegTarget.test`: `wanted` is a list of
     `{ inner, shipped, executable }`; on Windows `ffmpeg.exe` and
     `ffprobe.exe` are executable and `LICENSE.txt` is not; on Linux the
     same for the extensionless pair. The refusal case is unchanged.
   - `fetchFfmpeg.test` is unchanged: its Linux-only mode case and its
     README cases are the end-to-end proof the script still writes the
     same files, modes and README.
7. **`refactor: … the FFmpeg target says which entries are executable`.**
   - `ffmpegTarget.ts`: `FfmpegTarget.wanted` becomes
     `ReadonlyArray<FfmpegEntry>`, a new exported interface with the three
     fields and one-line docblocks; the unit's docblock follows.
   - `fetchFfmpeg.mjs`: `binariesOf` goes; the mode is
     `executable ? 0o755 : 0o644`, the README's "Only … are carried" names
     the executable entries' shipped names, and `fromZip`/`fromTarXz` read
     `inner` and `shipped` by name. The README text is byte-identical, so the
     "already matches" mark still holds and no machine re-downloads.

### Group 4: a suite that says each thing once

8. **`test: … shellPaths says each platform once`.**
   - The _answers exactly today's paths_ describe goes: the per-field
     Windows describes (unpackaged and installed, each naming `'win32'`)
     already assert all nine fields.
   - _without a platform_: the hand-written Linux case goes; the `it.each`
     over `win32` and `linux` stays, as does the two-argument main check.
   - The header names both platforms' FFmpeg and icon, and "today's" goes.
   - No new case; the count drops by four. The boundary describe (imports,
     no "Explorer") stays where 512 put it: it guards log 56 Q11's decision,
     which `shellPaths` was the unit tempted to break.

### Group 5: docblocks that know both platforms

9. **`refactor: … the docblocks name both Platform builds`.** No code
   changes; every suite passes.
   - `packageApp.mjs`: the header names both **Platform builds** and issue
     513; its usage lines give the Windows and Linux outputs and both
     unpacked folders.
   - `fetchFfmpeg.mjs` and `fetchFfmpeg.test`: "the **Default component**
     each **Platform build** carries", shipped to `resources/ffmpeg/`.
   - The direct-play route's comment and `rendererRouter`'s docblock: one
     sentence each on `dotfiles: 'allow'` (`send` refuses any absolute path
     with a dot segment; on Linux `~/.config/...` and the AppImage's
     `/tmp/.mount_...` both have one; the path is never the URL's).
   - `src/types/libraryFolders.ts`: "in Explorer" becomes "in the file
     manager", twice.
   - No em dash in any line this commit writes.

### Group 6: the docs

10. **`docs: … the docs know the Linux build as shipped`.**
    - **README**: the tree's `release/` line names the Installer or the
      AppImage and `win-unpacked/` or `linux-unpacked/`.
    - **Glossary**: **FFmpeg target** (updated): each wanted entry says
      whether it ships executable. **Menu entry** (updated): its `Exec` and
      `TryExec` are escaped by the Desktop Entry spec. No new term.
    - **Feature checklist**: the row becomes ✅; step 39's entry in step
      38's shape, naming the smoke fixes (519 to 521) and this round.
11. **`docs: … the journal`.** A newest-first entry in
    `docs/dev-journal.md` in the last entry's shape: what shipped (the
    slices, the two smokes, the first Linux update round-trip), what each
    group here changed, what was deliberately not changed, the follow-ups.
    It names 511 as already closed, and closes this issue with a keyword.

## Decision Document

- **Shared identity lives in `appIdentity`.** `APP_SYNOPSIS` joins
  `APP_USER_MODEL_ID`: a string main needs at run time that
  `builderConfig.json` also carries, held together by the packaging guard.
  `builderConfig.json` can't be read at run time (it is not in the asar), so
  a constant plus a guard is the pattern, not a read.
- **`menuEntry` keeps the synopsis as an argument.** The log's signature
  stands; importing the constant inside would make the unit's suite depend on
  the real sentence.
- **Category is guarded, not shared.** `Categories=AudioVideo;` stays a
  literal in `menuEntry` (the entry's format is the unit's), and the guard
  asserts it matches `linux.category`. `Icon=familyflix` is the hicolor file
  the unit writes, not `executableName`, so it is not tied to it.
- **Escaping follows the Desktop Entry spec**, not a shell's: the quote-rule
  inside `Exec`, `%%` for a literal percent, `\\` for every value's
  backslash. A newline in a path is not handled: a file name can hold one,
  but nothing on the Deck makes one, and the spec has no escape for it in
  `Exec`.
- **The writer says "No App mark at <path>."** A sentence, as every other
  Shell log line; no borrowed error code.
- **`FfmpegEntry` is `{ inner, shipped, executable }`.** One list, so
  extraction stays one loop; the executable bit becomes data a Windows test
  can read. Not split into binaries and a licence: that would make the
  fetch script rebuild the list it extracts.
- **The FFmpeg README is byte-identical.** It is the "already matches" mark;
  any change would re-download on every machine once. Its existing em dashes
  are generated text, left alone for the same reason.
- **`NodeJS.Platform` for every platform argument.** A type the scripts can
  carry under type stripping.
- **Nothing on the schema, the wire, routes, the renderer, Settings, the
  workflow, `builderConfig.json` or the release checklist changes.**

## Testing Decisions

- **A good test asserts what a caller or the Deck sees**: the entry text
  KDE parses, the line in the Shell log, the config's fields against the
  shell's constants, the files and modes the fetch writes. Never which
  helper ran.
- **Modules tested**: `appIdentity`, `packagingConfig`, `menuEntry`,
  `ffmpegTarget`, `shellPaths` (trimmed).
- **Prior art**: `appIdentity.test`'s comment-stripped reading of main for
  the import; `packagingConfig.test`'s `appId` leaf for a config value held
  to a shell constant; `menuEntry.test`'s `parse` and `MemoryFs`;
  `ffmpegTarget.test`'s per-platform describes.
- **The rest of the initiative's suites carry every commit unchanged**:
  `fetchFfmpeg`, `packageOptions`, `iconSizes`, `createUpdates`,
  `rendererRouter`, `routes.dotSegment`. `fetchFfmpeg.test` passing
  unchanged through commit 7 is the proof the README and modes didn't move.
- **Characterization before change**: a suite that has to change anywhere
  else than named here is reading an implementation detail, and is fixed in
  the same commit with the reason in the body.
- **The gate**: the full suite at the end of each GREEN commit;
  `tsc -b --force` and `eslint src server electron` at the end of each
  group. The round ends with no more lint errors or warnings than it began.
- **Linux**: the next tag's Linux leg runs every changed suite on Linux; the
  next Deck smoke's step 12 (the menu entry opens the app) covers the
  escaping in the real desktop.

## Out of Scope

- **VAAPI hardware encoding**: the v0.14.0 smoke found HEVC smooth in
  software (518), so log 56 Q19's condition for filing it was not met.
- **Moving the shell's boundary guard** out of `shellPaths.test`.
- **The FFmpeg README's wording**, including its em dashes (see above).
- **A guard that every server `sendFile` allows dotfiles**: there are two,
  both covered by 519's tests; a third would be caught by the same kind of
  test when it is written.
- **The two near-identical file-system adapters in `main.ts`**
  (`logFs`, `menuEntryFs`): wiring, each typed by its own unit's interface.
- **Game Mode, controller navigation, Flatpak, arm64, macOS, code signing**,
  and everything log 56 put out of scope.

## Further Notes

- Order: commit 1 before 2, 3 before 4, 6 before 7; commit 5 before 6.
  Groups are otherwise independent; Group 6 last.
- Follow-ups this plan already sees, for the journal: none required. The
  next Release's Deck smoke re-proves the Menu entry with the escaping in.
