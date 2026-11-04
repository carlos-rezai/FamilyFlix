> **Initiative:** `linux-build`
> **Design log:** `docs/design-logs/56-linux-build.md`
> **Issue:** #511 (the PRD, step 39)
> **Build order:** step 39, **Linux build**. No prototype: nothing on screen changes (log 56 Q2). It ships as three slices (log 56, _Implementation Plan_): the units proven on Windows, both **Platform builds** on one draft, then the Deck smoke and the documents. The first Release to carry both is v0.14.0.

## Problem Statement

I maintain FamilyFlix for my parents on the family's Windows PC, and I want it on my Steam Deck too. Today every **Release** carries one file, the Windows **Installer**: packaging, **Shell paths** and the release workflow know only Windows, the **FFmpeg pin** names only a Windows build, and the **App mark** exists only as an `.ico`. SteamOS has a read-only root, so a package install wouldn't survive an OS update, and electron-builder can't build a Linux file from Windows anyway: the SQLite binding and FFmpeg have to be Linux ones. The app code itself already names executables and compares paths by platform, but nothing has ever run its test suite on Linux.

## Solution

Every **Release** from v0.14.0 on carries two **Platform builds**, made by the same `v*` tag: the **Installer** as today, and the **AppImage**, `FamilyFlix-x86_64.AppImage`, one self-contained file kept in `~/Applications/` on the Deck. I download it in Desktop Mode, mark it executable, and give it a KDE menu entry by hand, following the README's new _Installing on SteamOS_. It launches with the Chromium sandbox on, keeps its data in `~/.config/FamilyFlix/`, carries a static Linux FFmpeg as its **Default component**, and updates itself in place through **Software update**, the same way the Installer does, from the same **Release feed**.

The workflow makes one **Draft release**, then builds and tests on a Windows and an Ubuntu runner side by side, each uploading its Platform build to that draft. The **Package smoke** gains a Linux half run on the Deck in Desktop Mode. Both halves pass before the draft is published, with one exception: if only the Linux half fails, I may publish a **Windows-only release** after deleting the Linux files from the draft, so a Linux problem never holds up a Windows fix.

## User Stories

### Installing on the Deck

1. As the maintainer, I want one AppImage I can download in Desktop Mode's browser, so that installing needs no package manager and no extra tool.
2. As the maintainer, I want the AppImage kept in `~/Applications/`, so that a SteamOS update never removes it.
3. As the maintainer, I want the README to give the three install steps (move it from `~/Downloads`, make it executable in Dolphin or with `chmod +x`, add a KDE menu entry), so that I can repeat them on a fresh Deck without remembering.
4. As the maintainer, I want the AppImage's name to carry no version, so that an update overwrites it in place and my menu entry keeps pointing at it.
5. As the maintainer, I want no AppImageLauncher, Gear Lever or other helper needed, so that there is nothing more to keep up to date.
6. As the maintainer, I want the Windows **Installer** unchanged, its name still versioned, so that the family's PC installs and updates exactly as before.

### Running on the Deck

7. As the maintainer, I want FamilyFlix to launch maximized on _Your library is empty_ from a fresh AppImage, so that a first run looks like a first run on Windows.
8. As the maintainer, I want the Chromium sandbox and the fuses left on, with no `--no-sandbox` and no `--appimage-extract-and-run`, so that the Linux build is as locked down as the Windows one.
9. As the maintainer, I want the **App mark** on the window, the KDE taskbar and the menu entry, so that FamilyFlix is recognisable among the Deck's apps.
10. As the maintainer, I want my library's database, **Managed media directory**, **Component slot** and logs in `~/.config/FamilyFlix/`, so that replacing or deleting the AppImage never touches them.
11. As the maintainer, I want _Open folder_ to open `~/.config/FamilyFlix/media` in the file manager, so that Storage works as on Windows.
12. As the maintainer, I want a **Library folder** on the SD card (`/run/media/deck/<label>/...`) imported and linked like any other folder, so that the Deck's storage holds the films.
13. As the maintainer, I want a Library folder on an external drive read once Dolphin has mounted it, and shown **Unreachable** when it isn't mounted, so that a drive behaves as it does on Windows.
14. As the maintainer, I want every visible string unchanged, since they are already platform-neutral, so that nothing on screen says Windows on the Deck.

### Playing on the Deck

15. As the maintainer, I want an `.mp4` to direct-play, so that the common case needs no FFmpeg at all.
16. As the maintainer, I want an `.mkv` to remux, so that the common container plays without a transcode.
17. As the maintainer, I want an HEVC film to transcode with `libx264 veryfast`, so that it plays even though the Deck's VAAPI isn't wired.
18. As the maintainer, I want the smoke to note how smoothly a 1080p HEVC film plays, so that VAAPI is wired later only if software encoding stutters.
19. As the maintainer, I want Settings → Codecs to read **Default** on a fresh AppImage, so that I know its bundled FFmpeg was found.
20. As the maintainer, I want to drop the two extensionless Linux binaries as an **Uploaded component**, so that I can replace FFmpeg on the Deck as on Windows.
21. As the maintainer, I want a Windows FFmpeg dropped on the Deck refused with the one sentence verification already gives, so that a wrong upload never replaces a working component.

### Updating on the Deck

22. As the maintainer, I want **Software update** to offer and install a new version on the Deck, so that I never download the AppImage by hand again.
23. As the maintainer, I want an **Install** to keep my library, the file's executable bit and my menu entry, so that an update is invisible apart from the new version.
24. As the maintainer, I want About to read the new version after an Install, so that I can tell the update landed.
25. As the maintainer, I want the Deck's **Update check** to find nothing when a Release carries no Linux metadata, quietly at launch and `refused` when pressed, so that a Windows-only release leaves the Deck on its current version without a fault.

### The release

26. As the maintainer, I want one `v*` tag to build both Platform builds, so that a release is still one `npm version`.
27. As the maintainer, I want the **Draft release** made once, before either platform uploads, so that the two legs never make two drafts for one tag.
28. As the maintainer, I want each leg to install, typecheck and test before it packages, so that no Platform build ships code its own platform's tests didn't run.
29. As the maintainer, I want the test suite to run on Linux for the first time, and any test that goes red there fixed in this initiative, so that a Linux bug is caught on CI and not on the Deck.
30. As the maintainer, I want the Windows leg to finish even when the Linux leg fails, so that a Linux problem never stops the Installer being built.
31. As the maintainer, I want a draft to carry five files (the Installer, `latest.yml`, its blockmap, the AppImage and `latest-linux.yml`), so that I can see at a glance that both Platform builds landed.
32. As the maintainer, I want re-running a failed leg to find the draft already there, so that a re-run uploads into the same release.
33. As the maintainer, I want `npm run electron:package` on my Windows machine to build the same Installer it builds today, so that my local workflow doesn't change.
34. As the maintainer, I want `--dir` on a Linux machine to write the unpacked layout, so that I can inspect a Linux package without building the AppImage.
35. As the maintainer, I want packaging on any platform other than Windows or Linux refused in a sentence, so that a Mac build never half-works.

### A Windows-only release

36. As the maintainer, I want to publish the Installer alone when the Linux leg or the Linux half of the smoke fails and the Windows half passed, so that a Windows fix is never held up by the Deck.
37. As the maintainer, I want the release checklist to tell me to delete any AppImage or `latest-linux.yml` from the draft first, so that a broken AppImage never reaches the **Release feed**.
38. As the maintainer, I want the release notes to say _Windows only; Linux follows in the next version_ and the Linux problem filed as an issue, so that the gap is written down.
39. As the maintainer, I want the next Release to carry both Platform builds again, so that the Deck catches up.
40. As the maintainer, I want a failed Windows half to block the whole Release, so that the family's main install is never left behind the Deck.
41. As the maintainer, I want a Windows-only release allowed only when the Linux half has failed, never to skip the Deck smoke, so that the exception stays an exception.

### FFmpeg

42. As the maintainer, I want the Linux **Default component** to be a static GPL `linux64` build with `libx264`, from BtbN's FFmpeg-Builds, of the Windows pin's version line (9.0), so that both platforms convert with the same encoder.
43. As the maintainer, I want it pinned to a dated `autobuild-*` release asset and its SHA-256, so that a download whose digest differs is refused.
44. As the maintainer, I want one pin file keyed by platform, so that both pins are reviewed and bumped side by side.
45. As the maintainer, I want a pinned URL that has disappeared to fail the release at the fetch, loudly, so that re-pinning is a deliberate `chore:` commit and never a silent substitute.
46. As the maintainer, I want the fetch to ship `ffmpeg`, `ffprobe`, the licence and a README naming the build, its version and where its source is, so that the Linux build meets the GPL as the Windows one does.
47. As the maintainer, I want the Linux binaries written executable, so that the server can run them straight out of the AppImage.
48. As the maintainer, I want a second fetch whose README already names the pin to skip the download, so that a re-run needs no network on either platform.

### The maintainer's code

49. As the maintainer, I want **Shell paths** to take the platform as an argument, defaulting to `process.platform`, so that a unit test on Windows can ask what Linux gets.
50. As the maintainer, I want `packageOptions` to take the platform the same way, so that the AppImage target is proven by a test on Windows.
51. As the maintainer, I want what differs between the two FFmpeg archives answered by one pure unit, so that the fetch script stays wiring and the difference is tested.
52. As the maintainer, I want the shell to import nothing but types from outside `electron/`, so that the boundary holds after this change too.
53. As the maintainer, I want `icon.png` rendered by `buildIcon.mjs` beside `icon.ico` and committed, so that the mark is drawn by one tool, not two.
54. As the maintainer, I want the packaging guard to hold the Linux blocks to `shellPaths` and the AppImage's name, so that a renamed icon or a versioned artifact name fails a test, not a release.
55. As the maintainer, I want docblocks that say "Explorer" for the file manager corrected to "the file manager" where they describe behaviour, as the code is touched, so that the comments stay true on both platforms.
56. As the maintainer, I want the README, the release checklist, the feature checklist, the ubiquitous language and CLAUDE.md's stack line to name both Platform builds, so that the documents match the release.

## Implementation Decisions

### Shell

- **Shell paths** gains a third argument, `platform: NodeJS.Platform`, defaulting to `process.platform` (`folderOverlap`'s precedent). Off Windows it answers `resources/ffmpeg/ffmpeg` and `electron/assets/icon.png`; on Windows `ffmpeg.exe` and `icon.ico`, as today. It doesn't import the server's `EXE`, and `platform` isn't a field on `ShellLocations`, since it is not a location.
- Nothing else in main changes: `setAppUserModelId` is a no-op off Windows, and the single-instance lock, the folder dialogs, `shell.openPath` and the **Path bridge** work as they are.
- `userData` stays Electron's own, `~/.config/FamilyFlix/` on Linux. No Linux-only override.
- The Chromium sandbox stays `sandbox: true` and the fuses as they are. If the smoke shows the AppImage runtime can't run it, that is a fix issue, never a switch turned off.
- **Software update** code is unchanged: `electron-updater` picks its AppImage updater on Linux and reads `latest-linux.yml` from the same **Release feed**, still only in the `installed` **Shell mode**.

### Server

- No change is planned. Executable names, the slot's `0o755`, and path comparisons are already by platform. The proof is the suite running green on the Linux leg; a test that goes red there is a Linux bug, fixed in this initiative.

### Packaging units

- **`packageOptions(args, platform)`**: `target` becomes `'nsis' | 'AppImage' | 'dir'`, chosen by platform (`nsis` on Windows, `AppImage` on Linux, `dir` under `--dir` on either); `publish` as today; a new `platform: 'windows' | 'linux'` field that `packageApp.mjs` maps to electron-builder's `Platform`. Any other platform is refused with a thrown sentence. It stays written in erasable types so the script imports it under Node's type stripping.
- **`ffmpegTarget(platform)`**, new and pure, answers what differs between the two archives:
  - `archive`: `'zip'` on Windows, `'tar.xz'` on Linux.
  - `wanted`: pairs of (entry under the archive's one top folder → the name shipped), `.exe` names on Windows, extensionless on Linux, plus the licence as `LICENSE.txt`.
  - `build`: the README's `Build:` line, naming gyan.dev's essentials or BtbN's linux64 GPL.
  - Any other platform is refused in a sentence.
- **The FFmpeg pin** becomes keyed by platform: `{ "win32": { version, url, sha256 }, "linux": { version, url, sha256 } }`. Windows stays gyan.dev essentials 9.0.2; Linux is BtbN's `linux64-gpl` 9.0 from a dated `autobuild-*` release.
- **`fetchFfmpeg.mjs`** takes `process.platform`'s pin entry and `ffmpegTarget`'s answer, refusing any other platform. A `.zip` is read by `zipEntries` as today; a `.tar.xz` by the system `tar`, spawned with no shell and only on Linux, since Node has no xz decoder. Binaries are written `0o755`. The README still carries the digest as the "already matches" mark.
- **`buildIcon.mjs`** also renders `electron/assets/icon.png` at 512px, committed beside `icon.ico`.
- **`builderConfig.json`** gains `icon.png` in `files`, a `linux` block (target AppImage, category `AudioVideo`, icon `icon.png`, `executableName` `familyflix`, a `synopsis`) and an `appImage` block whose `artifactName` is `FamilyFlix-x86_64.${ext}`. The `win` and `nsis` blocks are unchanged.
- **`fetchNative.mjs`** is unchanged: it already asks `prebuild-install` for `process.platform` and `process.arch`.

### The release workflow

- Two jobs. `draft`, on `ubuntu-latest`, makes the **Draft release** if the tag has none (issue #284's rule, kept). Then `package`, `needs: draft`, a matrix over `windows-latest` and `ubuntu-latest` with `fail-fast: false`, each leg checking out with `fetch-depth: 0` (issue #510) and running Install, Typecheck, Test and `packageApp.mjs --publish`.
- Each leg uploads its own Platform build and its `latest*.yml` to the one draft. The workflow needs nothing extra for a **Windows-only release**: `fail-fast: false` already lets the Windows leg finish.

### Release policy

- A Release carries exactly two **Platform builds**: the Installer with `latest.yml` and its blockmap, and the AppImage with `latest-linux.yml`.
- A draft is published only once both halves of the **Package smoke** pass, except as a **Windows-only release**: Linux leg or Linux smoke failed, Windows passed; Linux files deleted from the draft first; notes say _Windows only; Linux follows in the next version_; the problem filed as an issue. Never a Linux-only release, never Windows-only by choice.
- v0.14.0 is the first Release with both. Its Linux half skips the update round-trip; the next Release (v0.14.1 or v0.15.0) is the first to smoke an Install from the previous AppImage.

### The Linux Package smoke

Run on the Steam Deck in Desktop Mode, from the draft's AppImage, every step blocking: the README's three install steps; a launch maximized on _Your library is empty_ with the sandbox and the AppImage runtime both holding; the App mark in the taskbar and the menu entry; the importer's fixture imported from the SD card; a Library folder on an external drive read once mounted and **Unreachable** when not; `smoke.mp4` direct-plays and `smoke.mkv` remuxes; an HEVC film transcodes, its smoothness noted; _Open folder_ opens `~/.config/FamilyFlix/media`; Codecs reads **Default**; About reads the version; and, from the second Linux release, an Install from the previous AppImage keeps the library, the executable bit and the menu entry.

### Documents

- README: the platforms, _Installing on SteamOS_ beside _Installing on a new machine_, and _The installer_ section naming both Platform builds.
- `docs/release-checklist.md`: both halves of the smoke, the five-file first tick, and the Windows-only release's steps.
- The feature-checklist row, `docs/ubiquitous-language.md` (already holds log 56's terms), and CLAUDE.md's stack line gaining "Windows and Linux (AppImage)".

## Testing Decisions

- A good test drives a unit through its public face and asserts what a caller sees: the paths answered for a platform, the options for a set of arguments, the files extracted, the config's fields. It never asserts which helper ran. Each Linux answer is asked on Windows by passing the platform in, so the suite proves it on the maintainer's machine before any runner does.
- **`shellPaths`**: with `'linux'`, the installed and unpackaged modes answer `ffmpeg` and `icon.png`; with `'win32'`, `ffmpeg.exe` and `icon.ico`; every other path is the same on both; omitting the argument behaves as `process.platform`. Prior art: its existing tests.
- **`packageOptions`**: `'win32'` answers `nsis` and `windows`, `'linux'` answers `AppImage` and `linux`, `--dir` answers `dir` on either, `--publish` in any order as today, and `'darwin'` throws a sentence. Prior art: its existing tests.
- **`ffmpegTarget`**: for `'win32'`, `zip`, the three `.exe` and licence pairs and the gyan.dev build line; for `'linux'`, `tar.xz`, the extensionless pairs and the BtbN build line; any other platform throws. Prior art: `verifyDigest`'s and `zipEntries`' tests.
- **`fetchFfmpeg`**: the existing end-to-end tests run against a keyed pin, the platform's entry chosen; the `.tar.xz` path runs on Linux only (skipped on Windows, since it needs the system `tar`) and extracts exactly `ffmpeg`, `ffprobe`, `LICENSE.txt` and `README.txt`, executable; a digest that differs is refused on both. Prior art: `fetchFfmpeg.test.ts`.
- **`packagingConfig`**: the `linux` block's icon is the one `shellPaths` answers for Linux and is in `files`; the `appImage` artifact name carries no version; the category and executable name are as decided; the `win` and `nsis` blocks keep passing. Prior art: `packagingConfig.test.ts`.
- **The whole suite on Linux**: the workflow's Linux leg is a test in itself; every red test it finds is fixed in this initiative with the fix's own test.
- The workflow, the AppImage and the Deck behaviour are proven by the **Package smoke**, not by unit tests.

## Out of Scope

- Game Mode in any form: gamescope, Steam Input, a Steam shortcut.
- Controller navigation (a D-pad focus model).
- VAAPI hardware encoding; filed as a follow-up only if the smoke finds HEVC stutters.
- Flatpak and Flathub; `.deb`, `.rpm` and pacman packages.
- arm64, macOS.
- Code signing on either platform.
- Any distro beyond SteamOS as a smoked target (the AppImage likely runs on most, but only the Deck is proven).
- A Linux-only release.
- Moving `userData` to `~/.local/share/`.

## Further Notes

- The AppImage can't be built on the maintainer's Windows machine, so a Linux packaging change is first seen on CI.
- There are now two FFmpeg pins to keep in step, one from a source that prunes old builds.
- A release now waits on two smokes, one on the Deck, unless the Linux half fails and it goes out Windows-only.
- The maintainer approved every recommendation of log 56 in advance; this PRD adds no decision the log doesn't hold.
