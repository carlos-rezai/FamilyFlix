# Release checklist: the Package smoke

The **Package smoke** is the proof of a **Draft release**, in two halves, one
per **Platform build**:

- **The Windows half** (steps 1 to 9) proves the **Installer** (design log 25
  Q26): built, then installed, played, hardened-checked and uninstalled on real
  hardware, the maintainer's own Windows machine, with the parents' PC as the
  clean-machine check (dev journal, 2026-10-05: Windows Sandbox painted a blank
  window and was dropped undiagnosed).
- **The Linux half** (step 12) proves the **AppImage** on the Steam Deck in
  Desktop Mode (design log 56).

A release is ticked against this list, top to bottom, every time.

**A failed Windows step blocks the release.** Fix it, rebuild, and run the
smoke again from step 1. **A failed Linux step blocks the Linux half**: fix it
and run step 12 again, or, with the Windows half passed, publish a
**Windows-only release** (step 13). There is never a Linux-only release. A
failure that is not packaging's (one in the player, say) is filed as its own
issue.

Software update (build step 9) extends it with the publish and the update
round-trip, log 17's proof cycle, rather than writing a second list: a release
is the **Draft release** the workflow builds, smoked, then published.

---

## 1. Build

On the dev machine, from the repo root:

```
npm run electron:package
```

- [ ] No console window flashes while it runs.
- [ ] `release/FamilyFlix-Setup-<version>.exe` is written.
- [ ] `release/win-unpacked/resources/ffmpeg/` holds exactly `ffmpeg.exe`,
      `ffprobe.exe`, `LICENSE.txt` and `README.txt`, and no `ffplay.exe`.
- [ ] `FamilyFlix-Setup-<version>.exe` wears the **App mark** in Explorer.

The importer's fixture films are stand-ins of a few bytes, not video, and the
tests' `fixtureVideo` is too small to prove playback. Make the smoke films
instead: a realistic 20 s 720p H.264 High film with AAC as an MP4, its `.mkv`
remux, and an HEVC encode. Steps 5 and 12 play them:

```
electron/.ffmpeg/ffmpeg.exe -f lavfi -i testsrc2=size=1280x720:rate=30:duration=20 -f lavfi -i sine=frequency=440:duration=20 -c:v libx264 -profile:v high -pix_fmt yuv420p -c:a aac -shortest release/smoke.mp4
electron/.ffmpeg/ffmpeg.exe -i release/smoke.mp4 -c copy release/smoke.mkv
electron/.ffmpeg/ffmpeg.exe -i release/smoke.mp4 -c:v libx265 -c:a copy release/smoke-hevc.mkv
```

## 2. Onto the target machine

- [ ] Quit any running FamilyFlix. If a previous install exists, note that
      `%APPDATA%\FamilyFlix\` carries its library into this run.
- [ ] Have the Installer, `release/smoke.mp4`, `release/smoke.mkv`,
      `release/smoke-hevc.mkv`, and the
      importer's fixture to hand: `library.xlsx` and its `root/` folder from
      `server/src/import-export/createImporter/fixture/`.

## 3. Install

- [ ] Run the Installer. SmartScreen appears once: _More info → Run anyway_.
- [ ] The one-click progress window wears the mark, and asks nothing.
- [ ] The app opens maximized on _Your library is empty_.
- [ ] Settings → Storage → _Open folder_ on this fresh install, before any
      import: Explorer opens `%APPDATA%\FamilyFlix\media`, made empty.

## 4. Every surface wears the mark

- [ ] The setup file in Explorer.
- [ ] The desktop shortcut and the Start-menu shortcut.
- [ ] The taskbar button, and Alt+Tab.
- [ ] Pin it to the taskbar: the pin and the running window are one button.
- [ ] _Settings → Apps_: FamilyFlix, publisher **Carlos Rezai**, version
      **0.1.0** (or this release's).
- [ ] Task Manager reads **FamilyFlix**.

## 5. Play

- [ ] Settings → Import from spreadsheet over the fixture's `library.xlsx` and
      `root\`: both films import.
- [ ] Settings → Add a movie with `smoke.mp4` as the video: it direct-plays.
- [ ] Settings → Add a movie with `smoke.mkv` as the video: it remuxes and
      plays.
- [ ] Settings → Add a movie with `smoke-hevc.mkv` as the video: it
      transcodes and plays.
- [ ] Settings → Playback → Codecs: the Component row's pill reads
      **Default**.
- [ ] Settings → Storage → _Open folder_: Explorer opens
      `%APPDATA%\FamilyFlix\media`, holding the imported films' folders.
- [ ] Settings → About reads the version.
- [ ] Keep originals: add a sandbox Library folder holding a copy of
      `smoke.mp4` in a folder of its own, a show folder of two episodes, and
      a second film, _Scan all folders_ under **Link** for the first two, then add
      the second film by hand under **Copy**. Delete all three: every original
      is still in the sandbox folder, byte for byte, and _Scan all folders_ again
      does not bring them back.
- [ ] Rescan a folder: on a sandbox Library folder holding a copy of the
      importer fixture, drop in `Heat/heat.mkv` and `Death Note/Season 1/`
      with two episodes, and press _Scan all folders_: both arrive with no
      year and no `isn't named` line. Sync Death Note: its poster lands in
      `Death Note/Season 1/Images/` and no `Season 01/` appears. A second
      scan adds nothing.
- [ ] Missing videos: on a sandbox Library folder holding a copy of the dev
      library, delete one film's video and one episode's, and make an empty
      `Heat/`. _Scan all folders_ lists the film and the show under
      _Missing_, and `Heat` under _Off layout_. _Take out of library_ and
      _Take out 1 episode_ settle their rows, and the grid loses the film;
      the original files are untouched.
- [ ] The Media directory refusal: on Settings → Library folders, type
      `%APPDATA%\FamilyFlix\media` and _Add_: it is refused with _That folder
      overlaps where FamilyFlix keeps its own copies. Choose another one._,
      and nothing is added.
- [ ] The Path bridge: Settings → Add a movie, pick a video from outside
      every Library folder: the Link card is disabled, reading _Only for files
      inside one of your library folders._, and Copy is chosen. Remove it and
      pick a video inside a Library folder: Link is enabled and chosen again.
- [ ] A linked movie add: with that video picked under **Link**, add it: it
      plays from where it lies, nothing new is under
      `%APPDATA%\FamilyFlix\media`, and _Scan all folders_ afterwards reads it as
      _Already in library_.
- [ ] A linked series add: Settings → Add a series, _Add a show folder_ from
      the real folder dialog on a show inside a Library folder named with a
      running range (`Smoke Show (2022–)`): the Title field reads _Smoke
      Show_ and the Year field _2022_. Add it under **Link**: its episodes
      play from where they lie.
- [ ] Poster pick: add a show TMDB knows the same way, by the Show folder
      pick under **Link** with no art, and Sync it alone. Its poster,
      backdrop, Season posters and Stills land in one new folder under
      `%APPDATA%\FamilyFlix\media\`, nothing new appears in its Title folder
      beyond what the Layout fill adds, and its episodes still play from
      where they lie. Press a season's poster in the review: it replaces the
      held tile, with no snackbar.
- [ ] Whole add: with no TMDB key, add `The Show (2019)` by the Show folder
      pick under **Link**: its Poster, Backdrop, each Season poster and every
      Still in the folder fill their slots. Save: the series page draws them
      all, and a little later every Still-less row draws a Frame still, none
      of them written into the Title folder. Then pick
      `Heat (1995)\Heat.mkv` on a movie add: its Poster, Backdrop and tracks
      fill, and ✕ on the video takes them back.
- [ ] Loading states, over the sandbox Library folder: Add a large film by hand under **Copy**:
      the button reads _Adding…_ after a moment, and the form leaves once the
      copy is done. Delete a long linked series from Manage library: the
      dialog locks, shows _Deleting “<title>”_, and closes with its snackbar.
      With Windows animations off (_Settings → Accessibility → Visual
      effects_), add the large film again: the button's shine fades, not
      freezes.
- [ ] Intro animation: quit and open FamilyFlix: the window opens at once on
      the plain background, with no tile before the welcome. The Fs drop,
      _Flix_ stays plain orange until the light reaches it, and the wordmark
      lands in the header unfocused; pressing it does nothing. Quit and open
      again and press a key mid-way: the library shows at once. A start that
      waits over 2s (a first open after a reboot can) fades the tile and
      _Opening your library_ in. With Windows animations off, open once more:
      the welcome is a plain fade.
- [ ] Welcome tune, in the shell with the sound on: quit and open
      FamilyFlix: a pluck as each F lands, a run up with the letters, a swell
      with the light, a chord as the wordmark glides into the header, ringing
      on under the home. Open again and press a key mid-run: the tune fades
      with the picture and no chord plays. Reload: silence. With Windows
      animations off, open once more: the chord alone, as the fades hand over.
- [ ] Row view, in the shell on the dev library with
      `npm run db:seed-series`: switch Movies to _All_: every film in one
      grid under _All movies_. Switch Series to _By genre_: a row per genre
      and _Other series_ last. _View all_ on a series row opens its series,
      and Back returns to the rows. Heart a series on a row: it lands on the
      shelf. Quit and open: both tabs keep their view.
- [ ] Scan new folders, over the sandbox library: add a new Library folder
      holding a film: its row reads _Not scanned yet_. _Scan new folders_
      logs one `Scanning` line, for that folder, and imports only its
      titles. After the review its row reads _N titles_ and _Scan new
      folders_ is disabled. Tick the TMDB box and scan a new folder again:
      _Continue to TMDB sync_ opens the Sync on **Just what was added**,
      reading _N titles this run brought in_, chosen.
- [ ] The Library sheet, over the sandbox library: rate a film in a Title
      folder there. A few seconds later
      `<sandbox>\_meta\familyflix-library.csv` is rewritten, and its row's
      Rating cell holds the new rating.
- [ ] The Layout fill, over the sandbox library: put a `heat-poster.png` in
      one film's `Images\` and empty another's, then Sync both. The empty
      `Images\` now holds a `poster` and a `backdrop`; the first keeps its
      `heat-poster.png` and gains no `poster`.
- [ ] Silent waits, in the shell: Settings → Add a series, _Add show
      folder_ on a show of many episodes inside a Library folder: while the
      folder is read the button is locked, and a read past 300ms shows the
      mark with _Reading folder…_. On Library folders, _Scan all folders_
      reads _Scanning…_ with _Scan new folders_ disabled, and a folder's ✕
      reads _Removing…_ before the row leaves.
- [ ] Video quality: the three smoke films' posters each read **720p** at
      the end of their Star row, and the fixture's placeholder films carry no
      tag. The _Quality_ pill on _720p+_ keeps the smoke films and drops the
      placeholders; _1080p+_ shows none of them. Settings → Display → _Show
      video quality_ off: every tag and the pill go. Back on, put a copy of
      `smoke.mp4` in a folder of its own in the sandbox Library folder,
      _Scan all folders_ and rate it: its row of
      `<sandbox>\_meta\familyflix-library.csv` reads `720p` in the _Quality_
      cell after _Runtime_.

## 6. The slot over the default

- [ ] Drop `ffmpeg.exe` and `ffprobe.exe` from the install directory's
      `resources\ffmpeg\` (`%LOCALAPPDATA%\Programs\@familyflixsource\`)
      onto the Component drop zone: the row reads **Uploaded**.
- [ ] Play `smoke.mkv` again: it still plays.
- [ ] Press ✕ on the Component row: it reads **Default** again.

## 7. The fuses

Quit the app. Open a Command Prompt in the install directory,
`%LOCALAPPDATA%\Programs\@familyflixsource\`, and quit the app after each check:

- [ ] `set ELECTRON_RUN_AS_NODE=1`, then `FamilyFlix.exe -e "console.log(1)"`:
      the app opens, not a Node prompt. Then `set ELECTRON_RUN_AS_NODE=`.
- [ ] `set NODE_OPTIONS=--inspect`, then `FamilyFlix.exe`: the app opens, and
      `netstat -ano | findstr 9229` finds nothing. Then `set NODE_OPTIONS=`.
- [ ] `FamilyFlix.exe --inspect`: the app opens, and
      `netstat -ano | findstr 9229` finds nothing.
- [ ] Create `resources\app\` holding a `package.json` of
      `{ "main": "main.js" }` and an empty `main.js`, then `FamilyFlix.exe`:
      the app opens on the library as before. Delete `resources\app\`.

## 8. Uninstall and reinstall

- [ ] Quit, then uninstall from _Settings → Apps_.
- [ ] `%APPDATA%\FamilyFlix\` is still there.
- [ ] Run the Installer again: the library is still there, films and all, and
      they play.
- [ ] Loading states, the reset, last because it erases the library: Settings
      → _Factory reset_, then _Erase everything_: the dialog locks, shows
      _Erasing everything_, and the app reloads on an empty library.
- [ ] The scan after a Factory reset: list the sandbox Library folder again
      and _Scan all folders_. Every title in it comes back with its ratings,
      hearts and Status, read from its `_meta\familyflix-library.csv`.
- [ ] Rebuild whole, over the sandbox Library folder: a series there with a
      poster, a Season poster and a Still in its Title folder, hearted, one
      episode Watched. Note the size and modified time of
      `<sandbox>\_meta\familyflix-library.csv`. Settings → _Factory reset_,
      list the folder again, _Scan new folders_, then _Done_: the series
      comes back with all three pieces of art, the heart and the Watched,
      and the sheet's size and modified time are unchanged.
- [ ] Rebuild edges, over the sandbox Library folder in the shell: open
      `<sandbox>\_meta\familyflix-library.csv` in a Dutch or German Excel,
      change one rating to `8,5` and give one title a diacritic, and save it
      as plain _CSV_ (`;`, cp1252). _Scan new folders_, then _Done_: the
      rating reads 9, the title spells its diacritic, and the sheet is
      rewritten `;` with decimal commas.
- [ ] Sheet in sight, over the sandbox Library folder in the shell: rename
      its `_meta\` to `Meta\`, put a `notes.txt` beside the sheet, and rate a
      film. A few seconds later `Meta\` is gone and `_meta\` holds both
      `familyflix-library.csv` and `notes.txt`. _Import setup_ and a group's
      _Scan_ draw the Sheet note, and the Factory reset dialog lists four
      items under _What stays_, the sheet second.
- [ ] Export round trip, over the sandbox Library folder in the shell: rename
      one title in the app and rate it, then _Export_ to a folder outside the
      sandbox. Settings → _Factory reset_, list the sandbox again, then
      _Import from spreadsheet_ with the Export's
      `_meta\familyflix-library.csv`: the title comes back under its new
      name with its rating, and review lists no Problem.
- [ ] Export paths, over a sandbox holding a copy of the
      `server/src/import-export/createImporter/v0.16.1-export/` fixture and
      the dev library's Title folders under one inner folder: list that
      inner folder and _Import from spreadsheet_ with the fixture's
      `Meta\familyflix-library.csv`. Every title comes back with its poster,
      backdrop, Season poster, Still and tracks, and review lists no
      Problem. A new _Export_ is flat, one folder per title beside `_meta/`.

## 9. Back on the dev machine

- [ ] `node_modules/.bin/vitest run` is green.

---

## 10. Publish

**Publishing the Draft release is the release** (log 17 Q48). Nothing reaches
the family before it, and the smoke is run against the draft's own Installer.

- [ ] On `main`, clean: `npm version minor` (or `patch`). The commit reads
      `chore: [release] v<version>` and the tag is `v<version>`.
- [ ] `git push --follow-tags`. The **Release** workflow runs on the tag,
      and only on a `v*` tag, never on a push to `main`.
- [ ] The workflow is green: the `draft` job, then both `package` legs
      (Windows and Linux), each through typecheck, tests and package.
- [ ] GitHub → Releases holds exactly **one** **Draft** `v<version>`, and it
      has all five files: `FamilyFlix-Setup-<version>.exe`, its `.blockmap`
      and `latest.yml` from the Windows leg, `FamilyFlix-x86_64.AppImage` and
      `latest-linux.yml` from the Linux leg. A second draft means the uploads
      split (issue #284). A failed leg is re-run; it uploads into the same
      draft.
- [ ] Download the draft's Installer and run steps 2 to 8 above against it.
- [ ] On the Deck, run step 12 against the draft's AppImage.
- [ ] Both halves passed: publish the draft. Only now is it on the
      **Release feed**. A failed Windows half blocks the release; a failed
      Linux half alone goes to step 13.

## 11. Update round-trip

Proves the feed end to end: a machine on the previous version is offered this
one and lands on it. On the target machine (step 2) install the **previous**
published Installer first: the round-trip needs a version to update from. The
Deck's round-trip is in step 12.

- [ ] The previous version opens and, at launch, the About card offers this
      release with **Update now**.
- [ ] Press **Update now**: the row reads _Installing and restarting…_, the
      app quits, and it relaunches by itself.
- [ ] The relaunch congratulates once, and the About card reads the new
      version.
- [ ] From v0.17.0 on, the **Quality sweep**: the previous version's films
      had no rung, and within a minute of the relaunch their posters carry a
      Quality tag, the library browsable all the while.
- [ ] The quit path: install the previous version again, let the offer
      arrive, then quit without pressing **Update now**. The next launch is on
      the new version.
- [ ] Turn the network off, press **Check for updates**: it answers
      _FamilyFlix couldn’t check for updates._, and nothing else changes.

---

## 12. The Linux half, on the Deck

On the Steam Deck in **Desktop Mode**, from the draft's own
`FamilyFlix-x86_64.AppImage`. Every step blocks the Linux half. Have
`release/smoke.mp4`, `release/smoke.mkv` and `release/smoke-hevc.mkv` (step
1), and the importer's fixture (`library.xlsx` and its `root/` folder), copied
onto the SD card.

From the second Linux release on (v0.14.0 is the first, and skips it), start
with the **previous** published AppImage installed as below, for the update
round-trip at the end.

- [ ] The README's _Installing on SteamOS_, its three steps as written:
      moved from `~/Downloads` to `~/Applications/`, made executable if it
      isn't already, opened once by double-clicking. No helper app. The
      double-click adds _FamilyFlix_ to the application menu.
- [ ] Launched from that menu entry, the app opens maximized on _Your
      library is empty_, and the window, the KDE taskbar and the menu entry
      all wear the **App mark**.
- [ ] `ps -ef | grep -i familyflix` shows no `--no-sandbox` (and no
      `--appimage-extract-and-run`): the sandbox and the AppImage runtime
      both hold.
- [ ] Moved to another folder and opened there once by double-clicking, the
      AppImage's menu entry still opens it; moved back, the same. After an
      update the entry still opens it too (the round-trip below).
- [ ] Settings → Import from spreadsheet over the fixture's `library.xlsx`
      and `root/` on the SD card (`/run/media/deck/<label>/...`): both films
      import.
- [ ] A **Library folder** on the SD card, holding a copy of `smoke.mp4` in
      a folder of its own: it is read and its film imports.
      With the card ejected, its row reads **Unreachable**; put back, it is
      read again.
- [ ] Settings → Add a movie with `smoke.mp4`: it direct-plays.
- [ ] Settings → Add a movie with `smoke.mkv`: it remuxes and plays.
- [ ] Settings → Add a movie with `smoke-hevc.mkv`: it transcodes and
      plays. Note how smoothly it plays:
      **\*\*\*\***\_\_\_**\*\*\*\*** (VAAPI is wired later only if this stutters).
- [ ] The three smoke films' posters each read **720p**: the bundled
      ffprobe measures on Linux too.
- [ ] Settings → Storage → _Open folder_: the file manager opens
      `~/.config/FamilyFlix/media`.
- [ ] Settings → Playback → Codecs: the Component row's pill reads
      **Default**.
- [ ] Settings → About reads the version.
- [ ] From the second Linux release on, the update round-trip: on the
      previous AppImage, the About card offers this release with **Update
      now**. Press it: the app relaunches on the new version, the library is
      still there, the AppImage is still executable, and the menu entry still
      opens it.

## 13. A Windows-only release

Published only when the Linux leg or the Linux half of the smoke failed **and
the Windows half passed**. Never to skip the Deck smoke by choice, and never
the other way round: a failed Windows half blocks the whole release, and there
is no Linux-only release.

- [ ] Delete `FamilyFlix-x86_64.AppImage` and `latest-linux.yml` from the
      draft, whichever are there, so a broken AppImage never reaches the
      **Release feed**. The draft holds only the Installer, its `.blockmap`
      and `latest.yml`.
- [ ] The release notes say _Windows only; Linux follows in the next
      version_.
- [ ] The Linux problem is filed as an issue.
- [ ] Publish the draft.

The Deck stays on its current version: its **Update check** finds no Linux
metadata, quietly at launch and `refused` when pressed. The next release
carries both Platform builds again, and the Deck catches up.

## Maintainer notes

Kept here from the README, for the hands that build a release.

- **The App mark**: when the mark in `docs/handoff/brand/` changes, run
  `npm run electron:icon` by hand. It renders `electron/assets/icon.ico` and
  the favicon.
- **The Default component**: `npm run electron:ffmpeg` downloads the build
  `electron/packaging/ffmpegPin.json` names for this platform (gyan.dev's on
  Windows, BtbN's on Linux), refuses it unless its SHA-256 is the pin's, and
  extracts `ffmpeg`, `ffprobe` and the licence into the gitignored
  `electron/.ffmpeg/`. `electron:package` runs it anyway; once fetched it
  needs no network.
- **The package**: `electron:package` hands
  `electron/packaging/builderConfig.json` to `electron-builder` for the
  platform it runs on, with no `node_modules` inside; any platform other than
  Windows or Linux is refused.
- **AppImageLauncher**: if it ever added a FamilyFlix entry (an
  `appimagekit_<hash>-FamilyFlix.desktop` in `~/.local/share/applications/`)
  on the Deck, remove it: it launches the app with `--no-sandbox`.
