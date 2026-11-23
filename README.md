# FamilyFlix

> A Netflix for the family movie folder

For a household that keeps its films and series as files on a disk, and tracks them in a folder tree or a spreadsheet. FamilyFlix turns that collection into a library that looks and feels like the streaming apps the family already knows, with a built-in player. Offline, no accounts, no recommendations: pick something and watch it.

FamilyFlix is a desktop app for Windows and Linux (an AppImage, run on a Steam Deck). Everything stays on your machine: the library, the watch history and the art. It only goes online when you ask it to fetch details from TMDB.

---

## What It Does

- **Browse and search** like a streaming app: genre rows, Continue watching and Favorites, with search, genre, rating and sort filters on top. Series get their own tab, with seasons and episodes.
- **Watch** in the built-in player: resume where you left off, subtitles and audio tracks picked in the player, and anything Chromium can't play converted on the fly by FFmpeg.
- **Import a whole collection** from your folders, with or without your old spreadsheet. Matches go in as the run goes; the review at the end lists only what it couldn't settle.
- **Add a title by hand**: a movie, or a show by its folder, from the normal file dialog.
- **Fill in the gaps from TMDB**: synopses, posters, cast and ratings, only when you start a Sync. It is the one thing FamilyFlix does online.
- **Your files stay yours**: a video is played where it lies (or copied, if you choose), and FamilyFlix never moves, renames or deletes a file of yours. It only adds missing art and subtitles beside it, and an Export writes the whole library back out as a sheet and folders.

---

## Installing

Download the latest [Release](https://github.com/carlos-rezai/FamilyFlix/releases/latest).

**Windows:** run `FamilyFlix-Setup-<version>.exe`. It is unsigned, so SmartScreen stops it once: _More info → Run anyway_. It installs for the current user with no other prompt and opens FamilyFlix. Then add your collection: Settings → Library folders. The library lives in `%APPDATA%\FamilyFlix\` and survives an uninstall.

**Steam Deck (SteamOS):** in Desktop Mode, download `FamilyFlix-x86_64.AppImage`. No helper app (AppImageLauncher, Gear Lever) is needed.

1. Move it from `~/Downloads` to `~/Applications/` (make the folder if it isn't there), where a SteamOS update never removes it.
2. Make it executable if it isn't: in Dolphin, right-click → _Properties_ → _Permissions_ → _Is executable_, or `chmod +x ~/Applications/FamilyFlix-x86_64.AppImage`.
3. Open it once. FamilyFlix adds itself to the application menu, and from then on opens from there and can be pinned to the taskbar.

The library lives in `~/.config/FamilyFlix/`, so replacing or deleting the AppImage never touches it. An update overwrites the AppImage in place, and the menu entry follows it.

---

## Development Methodology

FamilyFlix is also a portfolio project in AI-assisted engineering: every feature is built through a structured Claude Code workflow, and the methodology is as much the point as the product. The app was designed whole in Claude Design before any feature code was written. That prototype lives in `docs/handoff/` and is the spec: every feature is a 1:1 translation of it, and a change to how a screen looks is made in the prototype first. Each feature then runs the same skill chain:

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

Node.js 20+.

```
git clone https://github.com/carlos-rezai/FamilyFlix.git
cd FamilyFlix
npm install
```

| Command                             | What it runs                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                       | The everyday loop: the server through `tsx watch` on `127.0.0.1:3001`, Vite with hot reload on `localhost:4200` |
| `npm run electron:native`           | Once, and after an Electron upgrade: fetches the Electron-ABI `better-sqlite3` binding into `electron/.native/` |
| `npm run electron:dev`              | The desktop window over Vite, with hot reload                                                                   |
| `npm run electron:start`            | Exactly what the installed app runs, over the repo's own library rather than `%APPDATA%`                        |
| `npm run electron:package`          | This platform's build into `release/`: the Windows Installer or the Linux AppImage                              |
| `npm run electron:package -- --dir` | The unpacked layout only (`release/win-unpacked/` or `release/linux-unpacked/`)                                 |

A tag builds both platforms on CI (`.github/workflows/release.yml`), and every build is proven by the [release checklist](./docs/release-checklist.md) before it reaches anyone.

### Commit messages

```
<type>: [<initiative>] issue #<n> <description>
feat: [movie-form] issue #99 the genre pool
```

Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`. `<initiative>` is the PRD name, not the issue title. The full rules are in [`.claude/CLAUDE.md`](./.claude/CLAUDE.md).

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
