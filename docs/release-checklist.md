# Release checklist — the Package smoke

The **Package smoke** is the proof of an **Installer** (design log 25 Q26):
the Installer built on the dev machine, then installed, played, hardened-checked
and uninstalled in Windows Sandbox, which is a clean user with no Node and no
FFmpeg. A release is ticked against this list, top to bottom, every time.

**A failed step blocks the release.** Fix it, rebuild the Installer, and run
the smoke again from step 1. A failure that is not packaging's (one in the
player, say) is filed as its own issue.

Software update (build step 9) extends this file with the publish and the
update round-trip, log 17's proof cycle, rather than writing a second list.

---

## 1. Build

On the dev machine, from the repo root:

```
npm run electron:package
```

- [ ] No console window flashes while it runs.
- [ ] `release/FamilyFlix-Setup-<version>.exe` is written.
- [ ] `release/win-unpacked/resources/ffmpeg/` holds exactly `ffmpeg.exe`,
      `ffprobe.exe`, `LICENSE.txt` and `README.txt` — no `ffplay.exe`.
- [ ] `FamilyFlix-Setup-<version>.exe` wears the **App mark** in Explorer.

The importer's fixture films are stand-ins of a few bytes, not video. Step 5
plays the one real film the tests carry, `fixtureVideo`, as an MP4 and as an
`.mkv` remuxed from it:

```
cp server/src/test-support/fixtureVideo/fixture-video.mp4 release/smoke.mp4
electron/.ffmpeg/ffmpeg.exe -i release/smoke.mp4 -c copy release/smoke.mkv
```

## 2. Into Sandbox

- [ ] Start **Windows Sandbox**.
- [ ] Copy in the Installer, `release/smoke.mp4`, `release/smoke.mkv`, and
      the importer's fixture: `library.xlsx` and its `root/` folder from
      `server/src/import-export/createImporter/fixture/`.

## 3. Install

- [ ] Run the Installer. SmartScreen appears once: _More info → Run anyway_.
- [ ] The one-click progress window wears the mark, and asks nothing.
- [ ] The app opens maximized on _Your library is empty_.

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
- [ ] Settings → Playback → Codecs: the Component row's pill reads
      **Default**.
- [ ] Settings → About reads the version.

## 6. The slot over the default

- [ ] Drop `ffmpeg.exe` and `ffprobe.exe` from the install directory's
      `resources\ffmpeg\` onto the Component drop zone: the row reads
      **Uploaded**.
- [ ] Play `smoke.mkv` again: it still plays.
- [ ] Press ✕ on the Component row: it reads **Default** again.

## 7. The fuses

Quit the app. Open a Command Prompt in the install directory,
`%LOCALAPPDATA%\Programs\FamilyFlix\`, and quit the app after each check:

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

## 9. Back on the dev machine

- [ ] `node_modules/.bin/vitest run` is green.
