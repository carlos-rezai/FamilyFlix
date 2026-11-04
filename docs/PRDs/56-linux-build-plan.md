# Plan: Linux build, the AppImage beside the Installer

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/511

Today every **Release** carries one **Platform build**, the Windows
**Installer**. This initiative adds the **AppImage**,
`FamilyFlix-x86_64.AppImage`, for the Steam Deck in Desktop Mode: the same
`v*` tag builds both on one **Draft release**, the Linux build carries its own
static FFmpeg as its **Default component**, and the **Package smoke** gains a
Linux half run on the Deck. Nothing on screen changes (log 56 Q2), so there
is no prototype.

## Running the phases

**Phases 1 to 5 are AFK and run under `issue-loop`, in order. Phases 6 and 7
are HITL.**

- The phases are log 56's _Implementation Plan_ slices, thinned: slice 1 (the
  units) is split into phases 1 to 3, slice 2 into the workflow (phase 4,
  written AFK) and its proof (phase 6), slice 3 into the documents (phase 5)
  and the Deck smoke (phase 7).
- Every Linux answer is proven on Windows by passing the platform in. The
  AppImage can't be built on the maintainer's machine, so phases 1 to 5 never
  build one; a local `npm run electron:package` must still write today's
  Installer after each.
- Phase 3 needs the network once, to pick a dated BtbN `autobuild-*` asset
  and record its SHA-256. Its tests never touch the network.
- Phase 6 starts with the maintainer's `npm version minor` (v0.14.0) and its
  tag push; any test that goes red on the Linux leg is fixed there, each with
  its own test, and the leg re-run into the same draft.
- Phase 7 is the maintainer's walk on the Deck, then the publish.
- The glossary already holds log 56's terms. The feature checklist's step 39
  row stays 🔜 until the refactor.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: none added or changed. No migration, no wire call, no renderer
  change; the server changes only if the Linux leg finds a red test.
- **Schema**: none.
- **Key models**:
  - `shellPaths(mode, locations, platform = process.platform)`: off Windows
    `resources/ffmpeg/ffmpeg` and `electron/assets/icon.png`; on Windows
    `ffmpeg.exe` and `icon.ico`. `platform` is not a field on
    `ShellLocations`; the server's `EXE` is not imported.
  - `packageOptions(args, platform)` answers
    `{ target: 'nsis' | 'AppImage' | 'dir', publish: 'never' | 'always', platform: 'windows' | 'linux' }`;
    any other platform throws a sentence. Erasable types only.
  - `ffmpegTarget(platform)` answers `{ archive: 'zip' | 'tar.xz', wanted, build }`,
    `wanted` being (entry under the archive's one top folder → name shipped)
    pairs plus the licence as `LICENSE.txt`; any other platform throws.
  - **The FFmpeg pin** (`electron/packaging/ffmpegPin.json`):
    `{ "win32": { version, url, sha256 }, "linux": { version, url, sha256 } }`.
    Windows stays gyan.dev essentials 9.0.2; Linux is BtbN's `linux64-gpl`
    9.0 from a dated `autobuild-*` release.
- **Packaging config**: `builderConfig.json` gains `icon.png` in `files`, a
  `linux` block (target `AppImage`, category `AudioVideo`, icon `icon.png`,
  `executableName` `familyflix`, a `synopsis`) and an `appImage` block with
  `artifactName` `FamilyFlix-x86_64.${ext}`. `win` and `nsis` are unchanged.
- **Data**: `userData` stays Electron's own, `~/.config/FamilyFlix/` on
  Linux. The sandbox stays `sandbox: true` and the fuses as they are.
- **Release**: two jobs. `draft` on `ubuntu-latest` makes the Draft release
  if the tag has none; `package`, `needs: draft`, a matrix over
  `windows-latest` and `ubuntu-latest`, `fail-fast: false`, each leg with
  `fetch-depth: 0`. A full draft holds five files: the Installer,
  `latest.yml`, its blockmap, the AppImage and `latest-linux.yml`.
- **Boundary**: the shell imports nothing but types from outside `electron/`.

---

## Phase 1: Shell paths take a platform

**User stories**: 9, 10, 11, 49, 52, 55

### What to build

`shellPaths` gains its third argument, defaulting to `process.platform`
(`folderOverlap`'s precedent). Off Windows the installed mode answers the
extensionless `ffmpeg` under `resources/ffmpeg/`, and both modes answer
`icon.png`; on Windows nothing changes. Main keeps calling it with two
arguments. Docblocks that say "Explorer" where they describe behaviour (Open
folder, the Packaged layout, `shellPaths` itself) are corrected to "the file
manager" as they are touched, and `ShellPaths.ffmpeg`'s docblock names both
binaries. Demo: the suite on Windows proves what Linux gets.

### Acceptance criteria

- [ ] With `'linux'`, installed answers `.../ffmpeg/ffmpeg` and `icon.png`;
      unpackaged answers `icon.png` and a `null` ffmpeg.
- [ ] With `'win32'`, both modes answer exactly today's paths.
- [ ] Every other path is the same on both platforms.
- [ ] Omitting the argument behaves as `process.platform`.
- [ ] The shell still imports nothing but types from outside `electron/`.
- [ ] No behavioural docblock in `electron/` says "Explorer".

---

## Phase 2: The AppImage target, proven on Windows

**User stories**: 4, 6, 9, 33, 34, 35, 50, 53, 54

### What to build

`packageOptions` takes the platform: `nsis` on Windows, `AppImage` on Linux,
`dir` under `--dir` on either, `--publish` in any order as today, and a new
`platform` field `packageApp.mjs` maps to electron-builder's `Platform`; any
other platform is refused in a sentence. `buildIcon.mjs` also renders
`electron/assets/icon.png` at 512px, committed beside `icon.ico`.
`builderConfig.json` gains the `linux` and `appImage` blocks and `icon.png`
in `files`. The packaging guard holds the Linux blocks to `shellPaths`'
Linux icon and the AppImage's unversioned name. Demo: `npm run
electron:package` on Windows builds the same versioned Installer as before.

### Acceptance criteria

- [ ] `'win32'` answers `nsis` and `windows`; `'linux'` answers `AppImage`
      and `linux`; `--dir` answers `dir` on either; `--publish` in any order.
- [ ] `'darwin'` throws a sentence; `packageApp.mjs` refuses before building.
- [ ] `icon.png` is 512px, rendered by `buildIcon.mjs`, committed.
- [ ] The guard: the `linux` icon is the one `shellPaths` answers for Linux
      and is in `files`; the `appImage` artifact name carries no version; the
      category is `AudioVideo` and the executable name `familyflix`.
- [ ] The `win` and `nsis` guards pass unchanged; the Installer's name is
      still versioned.
- [ ] A local `npm run electron:package` writes today's Installer.

---

## Phase 3: The Linux FFmpeg

**User stories**: 19, 20, 21, 42, 43, 44, 45, 46, 47, 48, 51

### What to build

The pin becomes keyed by platform, the Windows entry unchanged and a Linux
entry pinned to a dated BtbN `autobuild-*` `linux64-gpl` 9.0 asset and its
SHA-256. `ffmpegTarget` answers what differs between the two archives.
`fetchFfmpeg.mjs` reads `process.platform`'s pin entry and `ffmpegTarget`'s
answer, refusing any other platform: a `.zip` through `zipEntries` as today,
a `.tar.xz` through the system `tar`, spawned without a shell and only on
Linux. Binaries are written `0o755`; the README names the build, its version,
the archive, the digest and where the source is, and still serves as the
"already matches" mark. A vanished URL fails the fetch loudly. Demo: on
Windows the fetch writes the same four files as before, skipping when the
README already names the pin.

### Acceptance criteria

- [ ] `ffmpegTarget('win32')`: `zip`, the `.exe` and licence pairs, the
      gyan.dev build line. `ffmpegTarget('linux')`: `tar.xz`, the
      extensionless pairs, the BtbN linux64 GPL build line. Any other
      platform throws.
- [ ] The pin holds `win32` and `linux` entries; both are 9.0 line.
- [ ] The existing fetch tests pass against a keyed pin, the platform's
      entry chosen.
- [ ] On Linux only (skipped on Windows), a `.tar.xz` fetch extracts exactly
      `ffmpeg`, `ffprobe`, `LICENSE.txt` and `README.txt`, the binaries
      executable.
- [ ] A digest that differs is refused on both platforms.
- [ ] A second fetch whose README names the pin skips the download.
- [ ] A fetch that can't reach the URL exits non-zero with a sentence.

---

## Phase 4: The two-leg release workflow

**User stories**: 26, 27, 28, 30, 32

### What to build

`release.yml` splits into the `draft` job, which makes the Draft release only
if the tag has none (issue #284's rule, its comment kept), and the `package`
matrix over `windows-latest` and `ubuntu-latest` with `fail-fast: false`,
`needs: draft`, each leg checking out with full history (issue #510) and
running Install, Typecheck, Test and `packageApp.mjs --publish`. The header
comment names both Platform builds and the five files. Written here, proven
by phase 6's tag.

### Acceptance criteria

- [ ] One `draft` job, on `ubuntu-latest`, idempotent on a re-run.
- [ ] The `package` matrix needs `draft`, runs both runners with
      `fail-fast: false`, and each leg installs, typechecks and tests before
      it packages.
- [ ] Each leg checks out with `fetch-depth: 0` and publishes with the
      workflow's own token.
- [ ] The workflow parses (`actionlint` or an equivalent YAML check, if
      available locally).

---

## Phase 5: The documents

**User stories**: 1, 2, 3, 5, 14, 36, 37, 38, 39, 40, 41, 56

### What to build

The README names both platforms, gains _Installing on SteamOS_ beside
_Installing on a new machine_ (download in Desktop Mode, move it from
`~/Downloads` to `~/Applications/`, make it executable in Dolphin or with
`chmod +x`, add a KDE menu entry; no helper needed), and _The installer_
names both Platform builds. `docs/release-checklist.md` gains the five-file
first tick, the Linux half of the Package smoke (every step of the PRD's
_The Linux Package smoke_, the update round-trip from the second Linux
release on) and the **Windows-only release**'s steps and limits. CLAUDE.md's
stack line gains "Windows and Linux (AppImage)". Demo: the checklist can be
followed on the Deck as written.

### Acceptance criteria

- [ ] The README's SteamOS steps are the PRD's three, with no helper app.
- [ ] The release checklist lists the five files, both smoke halves, and the
      Windows-only release: Linux leg or Linux smoke failed, Windows passed;
      Linux files deleted from the draft first; notes say _Windows only;
      Linux follows in the next version_; the problem filed as an issue.
- [ ] The checklist says a failed Windows half blocks the Release and that
      there is never a Linux-only release.
- [ ] CLAUDE.md's stack line names both Platform builds.
- [ ] No em dash in any touched prose.

---

## Phase 6: The v0.14.0 draft carries five files (HITL)

**User stories**: 29, 31, 32

### What to build

The maintainer runs `npm version minor` and pushes the v0.14.0 tag. The
workflow runs the suite on Linux for the first time. Every test that goes red
there is a Linux bug, fixed in this initiative with its own test, and the
failed leg re-run into the same draft. Demo: the draft for v0.14.0 holds all
five files.

### Acceptance criteria

- [ ] One draft for the tag, made by the `draft` job.
- [ ] Both legs green: install, typecheck, test and package.
- [ ] Each red test found on Linux is fixed by a commit with its own test.
- [ ] A re-run leg uploads into the existing draft.
- [ ] The draft holds the Installer, `latest.yml`, its blockmap,
      `FamilyFlix-x86_64.AppImage` and `latest-linux.yml`.

---

## Phase 7: The Deck smoke, then publish (HITL)

**User stories**: 7, 8, 12, 13, 15, 16, 17, 18, 22, 23, 24, 25

### What to build

The maintainer runs both halves of the Package smoke against the v0.14.0
draft, the Linux half on the Deck in Desktop Mode, every step blocking, as
`docs/release-checklist.md` now lists it. v0.14.0 skips the update
round-trip; the next Release is the first to smoke an Install from the
previous AppImage (stories 22 to 24). A failure of the sandbox or the
AppImage runtime is filed as a fix issue, never a switch turned off. HEVC
smoothness is noted; VAAPI is filed only if it stutters. Then the draft is
published, or, if only the Linux half failed, published as a Windows-only
release by the checklist's steps.

### Acceptance criteria

- [ ] The README's install steps work on the Deck as written.
- [ ] A fresh AppImage launches maximized on _Your library is empty_, the
      sandbox and the AppImage runtime both holding, the App mark on the
      window, taskbar and menu entry.
- [ ] The fixture imports from the SD card; an external drive's Library
      folder reads once mounted and shows **Unreachable** when not.
- [ ] `smoke.mp4` direct-plays, `smoke.mkv` remuxes, an HEVC film
      transcodes; its smoothness is noted.
- [ ] _Open folder_ opens `~/.config/FamilyFlix/media`; Codecs reads
      **Default**; About reads 0.14.0.
- [ ] The Windows half passes as before.
- [ ] The draft is published, carrying both Platform builds or, by the
      checklist's exception, the Installer alone.
