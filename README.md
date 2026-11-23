# FamilyFlix

> A Netflix for the family movie folder, built with a structured Claude Code workflow

FamilyFlix turns a folder of movie files (one folder per movie, each containing a video, a subtitle file, and a poster) into a browsable, searchable library with a built-in player. It was built for my parents, who had been navigating their movie collection through an Excel sheet and a folder tree. They just want to pick something and watch it.

---

## Why This Project Exists

This project has two purposes:

1. **A genuinely useful family tool**: my parents have a real collection of movies on disk and a spreadsheet tracking titles, years, and genres. FamilyFlix replaces both with something that looks and feels like the streaming apps they already know how to use.

2. **A portfolio demonstrating AI-assisted engineering**: every feature is built using a structured Claude Code workflow: grill-me sessions, PRDs, TDD, and a living ubiquitous language document. The methodology is as much the point as the product.

**Note on AI:** FamilyFlix itself does not use AI anywhere: no recommendations, no smart search, no generated summaries. It's a deliberately simple, local-only tool. The "AI-assisted engineering" above refers to how it's _built_, not what it _does_.

---

## Desktop App

FamilyFlix is an offline-first desktop application for Windows and Linux (an AppImage, run on a Steam Deck). There is no cloud version, no authentication, and no network dependency. All data and media live locally on the machine.

- **Shell:** Electron, one window over the bundled Express server, forked as a utility process and serving the built app beside its API on one loopback origin
- **Storage:** SQLite via `better-sqlite3` for the library; an import links each video where it lies in its Library folder (or copies it, if you choose Copy), and copies posters and subtitles into FamilyFlix's own managed media folder. Installed, everything lives under `%APPDATA%\FamilyFlix\` on Windows and `~/.config/FamilyFlix/` on Linux
- **No auth**: single household, single shared watch history, local-only by design
- **Packaging:** two Platform builds via `electron-builder`, each carrying its platform's pinned FFmpeg build as the Default component. On Windows, `FamilyFlix-Setup-<version>.exe`, a one-click, per-user NSIS installer, no UAC prompt, unsigned; uninstalling keeps the library. On Linux, `FamilyFlix-x86_64.AppImage`, one self-contained file whose name carries no version, so an update overwrites it in place

---

## How It Works

### Adding a movie

One screen adds a movie and edits one. You fill in the title, year, director, cast, description, genre and rating, then pick the files: the video, a poster, and as many subtitle files as the film has, each tagged with its language. A title and a video are all that's required to save; everything else can be filled in later by opening the same screen again. Running time isn't asked for at all; it's read off the video file after it's copied.

Files are picked individually, from your machine's normal file dialog. FamilyFlix then **copies** what you gave it into its own media folder, so the app owns its copy and moving the original later can't break anything. On an edit, files you don't touch aren't re-uploaded: fixing a typo in a title doesn't move a 12 GB film.

### Migrating an existing library

A bulk importer reads an existing spreadsheet (title, year, genre, …) over every library folder you've listed, matches each row to its movie folder, and scans that folder for the video, poster and subtitle files (it isn't picky about subtitle format: `.srt`, `.vtt`, `.ass`, and `.sub` are all recognised), building the whole library in one pass. A row whose folder is a confident match is imported as the run goes, with a live progress console showing what's happening; the review step at the end lists only what the run couldn't settle on its own (a row with no folder, two folders for one row, a folder no row names, a copy that failed), each with a Resolve that opens the ordinary Add Movie form prefilled, and a Skip; two folders for one row are settled by pressing the right one, and a folder no row names by one _Import as_ press. A row for a title already in the library fills in whatever that title has empty, and anything it says differently waits in the review as _Yours | Spreadsheet_, field by field; nothing you filled in is overwritten without a press. Nothing is looked up online: the spreadsheet and the folder are all the importer reads, so there is no TMDB key to enter and no network to be on. Filling in what the sheet left blank (synopses, posters, runtimes) is a separate, opt-in Enrichment pass over the finished library, started from Settings → Network or the import's own _Also fetch metadata and posters from TMDB_, which is the one and only place FamilyFlix goes online. Pointing at a folder is the bulk importer's job rather than the Add Movie form's: a file dialog hands over a file, never a folder path. It is also how a development library gets filled: the importer's own test fixtures replace the dev seed the app carried until it shipped. An exporter writes the library back out as CSV or Excel (every movie, A–Z, under the same columns the importer reads) for backups or bulk edits, and an export fed back to the importer adds nothing; fed to an emptied library, from its sheet or copied over the library's folders, it gives the whole library back, its art included, whatever shape those folders were in.

### Watching

Movies open in a built-in player with subtitle support. Watched, in-progress, and unwatched movies are visually distinguished in the browse grid, and playback resumes where you left off.

### Browsing

The main screen is genre rows, like a streaming app, with search and filtering on top to find something quickly without scrolling. A film with no genre yet sits in its own _Other movies_ row, so every film is on the home.

### Looking after the library

A rescan never adds a title twice: a video FamilyFlix already plays is known wherever it lies and whatever its folder is now called, and a film whose file has gone missing is found again when a scan meets its file. A rescan lists each title whose video is no longer on disk, and each folder it could not read, for you to take out or skip; nothing leaves the library on its own. A folder is read under the name the family gives it, its year optional (`Heat` as good as `Heat (1995)`), and `Season 1` is as good as `Season 01`; FamilyFlix writes a show's art and subtitles into the season folder its episodes already lie in. A show folder pick names the show and its year as a scan reads the folder (`Severance (2022–)` is _Severance_, 2022), and each episode by its path inside the show. Deleting a title takes it out of FamilyFlix and leaves its files where they lie, and never deletes a file of yours. A title taken out stays out of every scan until _Bring back_ on its Library folder, or until you add it again by hand. A poster that won't load draws the stand-in.

---

## Development Methodology

FamilyFlix was designed whole in Claude Design before any feature code was written. That prototype lives in `docs/handoff/` and is the spec: every feature is a 1:1 translation of it, and a change to how a screen looks is made in the prototype first. Each feature then runs the same Claude Code skill chain:

grill-me (→ design-log → ubiquitous-language) → write-a-prd → prd-to-plan → prd-to-issues → tdd → build → request-refactor-plan → refactor

- **grill-me** interrogates the design until every assumption is settled, and records it as an immutable design log.
- **ubiquitous-language** locks every domain term in `docs/ubiquitous-language.md`.
- **write-a-prd** to **prd-to-issues** turn the decisions into GitHub issues before code is written.
- **tdd** writes the failing tests (stopping at RED), **build** makes them pass, and the refactor pair closes the feature.

The skills live in `.claude/skills/`; `docs/` holds the full paper trail, so the reasoning behind every decision is readable beside the code.

---

## Component Architecture: Atomic Design

Every piece of UI maps to a rung, and nothing skips one:

| Rung      | Folder        | Rule                                             |
| --------- | ------------- | ------------------------------------------------ |
| Atoms     | `primitives/` | Dumb UI, no business logic, no data fetching     |
| Molecules | `components/` | Composed primitives, no domain knowledge         |
| Organisms | `features/`   | Domain UI + logic: owns its hooks, types, `api/` |
| Templates | `layouts/`    | Page chrome, structure only                      |
| Pages     | `pages/`      | Route views, composition only                    |

Each unit is one folder with its companions beside it (`Button/Button.tsx`, `Button.test.tsx`, `Button.styles.ts`) and no `index.ts` of its own; only `primitives/`, `components/`, `utils/` and `tokens/` have a barrel.

---

## Tech Stack

| Layer    | Choice                                   | Why                                                                                      |
| -------- | ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| Frontend | React + TypeScript + Vite + Nx           | Production-standard, full TypeScript coverage                                            |
| UI       | styled-components + custom design system | Built via Claude Design handoff, precision over convenience                              |
| Backend  | Node.js + Express                        | Lightweight, consistent with JS ecosystem                                                |
| Database | SQLite via better-sqlite3                | Offline-first, single-file, zero config                                                  |
| Playback | Plain `<video>` + FFmpeg (server-side)   | Bespoke chrome needs no library skin; FFmpeg remuxes/transcodes what Chromium can't read |
| Desktop  | Electron + electron-builder              | Wraps the existing app for offline family use                                            |
| Testing  | Vitest + Testing Library                 | Fast, Vite-native, great DX                                                              |

---

## Project Structure

```
familyflix/
├── electron/          # the desktop shell: main.ts and preload.ts wire one small unit per decision
├── server/src/
│   ├── routes/        # HTTP only: parse, call a domain, respond
│   ├── library/       # titles, series, watch state, settings, Library folders
│   ├── media/         # every file FamilyFlix touches: scans, copies, art, subtitles
│   ├── import-export/ # bulk import, the Library sheet, the Layout fill, Export
│   ├── playback/      # FFmpeg: probing, streaming, remux and transcode, art fitting
│   ├── enrichment/    # TMDB, the only network client
│   ├── db/            # SQLite connection and migrations
│   └── shell/         # the server's half of the shell handshake and shutdown
├── src/
│   ├── primitives/ components/ features/ layouts/ pages/   # the Atomic Design rungs
│   ├── api/ hooks/    # wire calls and hooks two or more features share
│   ├── App/           # router and app-wide providers
│   ├── tokens/ styles/ utils/ types/
│   └── test-support/  # test doubles (also in server/src/ and electron/)
└── docs/
    ├── handoff/       # the prototype: the visual spec
    ├── design-logs/   # one immutable grill-me record per feature
    ├── PRDs/ refactor-plans/
    ├── ubiquitous-language.md
    ├── feature-checklist.md
    └── dev-journal.md
```

The rules that hold the shape (the full set is in [`.claude/CLAUDE.md`](./.claude/CLAUDE.md)):

- **The server is organised by domain.** Each domain owns its data and logic, and is injected into the router; there is no `services/` or `lib/` catch-all. Logic that fits no domain earns a new one.
- **`src/` never touches SQLite or the filesystem.** All file access goes through `server/src/media/`.
- **TMDB is the only network call**, and only Enrichment makes it.
- **FamilyFlix deletes nothing outside its own media folder.** The only writers into a Library folder are the Layout fill, which only adds what is missing, and the Library sheet writer.
- **A shared call or hook moves up** to `src/api/` or `src/hooks/` only when a second feature needs it; no feature imports another's.
- **`test-support/` is never imported by shipping code**, and every `src/utils/` function has a test.

---

## Running from Source

### Prerequisites

- Node.js 20+

### Install

```
git clone https://github.com/carlos-rezai/FamilyFlix.git
cd FamilyFlix
npm install
```

### Dev in the browser (the fast loop)

```
npm run dev
```

The server from source through `tsx watch` on `127.0.0.1:3001`, and Vite with hot reload on `localhost:4200`. Server edits restart it; this is the loop for everyday work.

### Dev in the desktop window

```
npm run electron:native   # once, and again after an Electron upgrade
npm run electron:dev
```

`electron:native` fetches the Electron-ABI `better-sqlite3` binding into the gitignored `electron/.native/`, so the shell and Vitest each keep their own. `electron:dev` opens the window over Vite with hot reload, and forks the bundled server the watcher rebuilds; a server change is picked up by restarting the script.

### The installed shape, unpackaged

```
npm run electron:start
```

Builds the renderer and both bundles, then runs exactly what the installed app runs (the built renderer served on the server's own origin, the Shell port `41720`) over the repo's own library rather than `%APPDATA%`.

### The App mark

```
npm run electron:icon
```

Run by hand when the mark in `docs/handoff/brand/` changes: it renders `electron/assets/icon.ico` and the favicon.

### The installer

A Release carries two **Platform builds**, one per platform, each built on that platform:

- **Windows:** the Installer, `FamilyFlix-Setup-<version>.exe`, with `latest.yml` and its blockmap. A one-click, per-user NSIS installer for x64, unsigned.
- **Linux:** the AppImage, `FamilyFlix-x86_64.AppImage`, with `latest-linux.yml`. Its name carries no version, so an update overwrites it in place and a menu entry pointing at it survives.

```
npm run electron:package         # Windows: release/FamilyFlix-Setup-<version>.exe; Linux: release/FamilyFlix-x86_64.AppImage
npm run electron:package -- --dir  # the unpacked layout only (release/win-unpacked/ or release/linux-unpacked/)
```

Builds the renderer and both bundles, fetches the Electron-ABI binding and the Default component, then hands `electron/packaging/builderConfig.json` to `electron-builder` for the platform it runs on, with no `node_modules` inside the package. Any platform other than Windows or Linux is refused. A tag builds both on CI, one leg per runner (`.github/workflows/release.yml`).

```
npm run electron:ffmpeg
```

Downloads the build `electron/packaging/ffmpegPin.json` names for this platform (gyan.dev's on Windows, BtbN's on Linux), refuses it unless its SHA-256 is the pin's, and extracts `ffmpeg` and `ffprobe` (`.exe` on Windows) and the licence into the gitignored `electron/.ffmpeg/`. `electron:package` runs it anyway; once fetched it needs no network.

Every Platform build is proven by the [release checklist](./docs/release-checklist.md) before it reaches anyone.

### Installing on a new machine

1. Copy `FamilyFlix-Setup-<version>.exe` over.
2. Run it. The installer is unsigned, so SmartScreen stops it once: _More info → Run anyway_. There is no other prompt: it installs for the current user and opens FamilyFlix.
3. Import the library: Settings → Import from spreadsheet.

The library lives in `%APPDATA%\FamilyFlix\` and survives an uninstall, so a reinstall finds it as it was.

### Installing on SteamOS

On the Steam Deck, in Desktop Mode, download `FamilyFlix-x86_64.AppImage` from the latest Release in the browser. No helper app (AppImageLauncher, Gear Lever) is needed. Then:

1. Move it from `~/Downloads` to `~/Applications/` (make the folder if it isn't there), where a SteamOS update never removes it.
2. Make it executable, if it isn't already: in Dolphin, right-click it → _Properties_ → _Permissions_ → _Is executable_, or `chmod +x ~/Applications/FamilyFlix-x86_64.AppImage`.
3. Open it once by double-clicking it. FamilyFlix adds itself to the application menu, wearing its mark, and from then on opens from there and can be pinned to the taskbar.

The library lives in `~/.config/FamilyFlix/`, so replacing or deleting the AppImage never touches it. Each launch checks the menu entry against where the AppImage now lies, so an update or a move keeps it working; a deleted AppImage's entry hides itself.

> **Maintainer's note:** if AppImageLauncher ever added a FamilyFlix entry (an `appimagekit_<hash>-FamilyFlix.desktop` in `~/.local/share/applications/`), remove it: it launches the app with `--no-sandbox`.

### Commit message convention

```
<type>: [<initiative>] issue #<n> <description>
```

`<initiative>` is the PRD/feature initiative name (e.g. `movie-form`, `import-export`), not the issue title.

Examples:

```
feat: [movie-form] issue #99 the genre pool
fix: [player] issue #7 correct subtitle track offset
refactor: [library] issue #9 extract genre-row hook
```

Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`

Keep the description short enough to fit on one line; long descriptions get wrapped or mangled in commit history. If it doesn't fit, the issue is too broad; split it.

---

## Build Status

Every shipped and planned feature, in build order, lives in the [Feature Checklist](./docs/feature-checklist.md).

---

## Docs

- [Ubiquitous Language](./docs/ubiquitous-language.md)
- [Design Logs](./docs/design-logs/)
- [PRDs](./docs/PRDs/)
- [Refactor Plans](./docs/refactor-plans/)
- [Design Handoff](./docs/handoff/README.md)
- [Feature Checklist](./docs/feature-checklist.md): every feature, shipped and planned, in build order
- [Dev Journal](./docs/dev-journal.md)
- [Release Checklist](./docs/release-checklist.md): the Package smoke a release is ticked against

---

## Author

**Carlos Rezai**, Senior Software Engineer, Berlin

[GitHub](https://github.com/carlos-rezai) · [LinkedIn](https://www.linkedin.com/in/aryan-carlos-r-0ba21017b/)
