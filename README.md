# FamilyFlix

> A Netflix for the family movie folder — built with a structured Claude Code workflow

FamilyFlix turns a folder of movie files — one folder per movie, each containing a video, a subtitle file, and a poster — into a browsable, searchable library with a built-in player. It was built for my parents, who had been navigating their movie collection through an Excel sheet and a folder tree. They just want to pick something and watch it.

---

## Why This Project Exists

This project has two purposes:

1. **A genuinely useful family tool** — my parents have a real collection of movies on disk and a spreadsheet tracking titles, years, and genres. FamilyFlix replaces both with something that looks and feels like the streaming apps they already know how to use.

2. **A portfolio demonstrating AI-assisted engineering** — every feature is built using a structured Claude Code workflow: grill-me sessions, PRDs, TDD, and a living ubiquitous language document. The methodology is as much the point as the product.

**Note on AI:** FamilyFlix itself does not use AI anywhere — no recommendations, no smart search, no generated summaries. It's a deliberately simple, local-only tool. The "AI-assisted engineering" above refers to how it's _built_, not what it _does_.

---

## Desktop App

FamilyFlix is an offline-first desktop application for Windows. There is no cloud version, no authentication, and no network dependency. All data and media live locally on the machine.

- **Shell:** Electron, wrapping the React frontend and bundling the Express server as a utility process
- **Storage:** SQLite via `better-sqlite3` for the library; video/subtitle/poster files are copied into FamilyFlix's own managed media folder on import
- **No auth** — single household, single shared watch history, local-only by design
- **Packaging:** NSIS installer via `electron-builder`, installs per-user with no UAC prompt

---

## How It Works

### Adding a movie

The same Add Movie form works two ways:

- **Folder-path autofill** — point it at a movie's folder and it finds the video, subtitle, and poster files automatically (it isn't picky about subtitle format — `.srt`, `.vtt`, `.ass`, and `.sub` are all recognised). You still confirm the title, year, and genre.
- **Manual mode** — pick the video, subtitle, and poster files individually and fill in the same fields by hand.

### Migrating an existing library

A bulk importer reads an existing spreadsheet (title, year, genre, …), matches each row to its movie folder, and runs the same autofill logic to build the whole library in one pass, with a review step before anything is committed. An exporter writes the library back out to CSV for backups or bulk edits.

### Watching

Movies open in a built-in player with subtitle support. Watched, in-progress, and unwatched movies are visually distinguished in the browse grid, and playback resumes where you left off.

### Browsing

The main screen is genre rows, like a streaming app, with search and filtering on top to find something quickly without scrolling.

---

## Development Methodology

This project is built using a structured Claude Code skill workflow. Unlike a typical feature-by-feature build, FamilyFlix starts with a full Claude Design prototype — the browse grid, search, movie form, and player are designed up front, before any feature code is written, and that prototype becomes the visual reference for everything that follows.

ui-design-handoff → grill-me → design-log → ubiquitous-language → write-a-prd → prd-to-plan → prd-to-issues → tdd → build → request-refactor-plan → refactor

**What this means in practice:**

- The Claude Design prototype is built first and lives in docs/handoff/ — every feature is implemented against it, not designed ad hoc as it's built
- Every feature starts with a grill-me session — Claude interrogates the design until every assumption is resolved
- A PRD is written and filed as a GitHub issue before implementation begins
- Tests are written before code (TDD, stopping at RED)
- All domain terminology is locked in docs/ubiquitous-language.md
- Design decisions are recorded in docs/design-logs/
- All UI code strictly follows Atomic Design — see Component Architecture below

The `.claude/` folder contains all skill definitions. The `docs/` folder contains the full paper trail — PRDs, design logs, and the ubiquitous language dictionary — so the reasoning behind every decision is readable alongside the code.

---

## Component Architecture — Atomic Design

Every piece of UI maps to a rung on the Atomic Design ladder, and nothing skips a rung:

| Rung      | Folder        | Examples                       |
| --------- | ------------- | ------------------------------ |
| Atoms     | `primitives/` | Button, Input, Text, Icon      |
| Molecules | `components/` | PosterCard, Modal, ProgressBar |
| Organisms | `features/`   | LibraryGrid, MovieForm         |
| Templates | `layouts/`    | MainLayout                     |
| Pages     | `pages/`      | LibraryPage, MoviePage         |

Every component, at every rung, follows the same four-file shape:

```
ComponentName/
├── index.ts
├── ComponentName.tsx
├── ComponentName.test.tsx
└── ComponentName.styles.ts
```

Category folders (`primitives/`, `components/`) also carry their own `index.ts` barrel file, so components are imported from the category, not from their individual folder.

---

## Tech Stack

| Layer    | Choice                                   | Why                                                               |
| -------- | ---------------------------------------- | ----------------------------------------------------------------- |
| Frontend | React + TypeScript + Vite + Nx           | Production-standard, full TypeScript coverage                     |
| UI       | styled-components + custom design system | Built via Claude Design handoff, precision over convenience       |
| Backend  | Node.js + Express                        | Lightweight, consistent with JS ecosystem                         |
| Database | SQLite via better-sqlite3                | Offline-first, single-file, zero config                           |
| Playback | video.js                                 | Built-in subtitle support, seeking, no external player dependency |
| Desktop  | Electron + electron-builder              | Wraps the existing app for offline family use                     |
| Testing  | Vitest + Testing Library                 | Fast, Vite-native, great DX                                       |

---

## Project Structure

```
familyflix/
├── .claude/            # Claude Code skills and CLAUDE.md
├── electron/           # Main process, preload, server lifecycle
├── server/             # Express backend
│   └── src/
│       ├── routes/         # HTTP layer only — parses requests, calls a domain module
│       ├── library/        # movie CRUD, SQLite queries, watch-state + resume position
│       ├── media/          # folder scanning, copying files into managed storage, subtitle detection
│       ├── import-export/  # Excel/CSV parsing, row-to-folder matching, CSV export
│       └── db/             # SQLite connection + schema/migrations
├── src/                # React frontend
│   ├── assets/         # Static images, fonts, icons
│   ├── styles/         # Global CSS reset, themes
│   ├── tokens/         # Colors, spacing, typography, breakpoints
│   ├── primitives/     # Atomic UI elements (Button, Input, Text) — each with index.ts, .tsx, .test.tsx, .styles.ts
│   ├── components/     # Composed UI blocks (PosterCard, Modal, ProgressBar) — same four-file shape
│   ├── features/       # Domain UI + logic co-located
│   │   ├── library/        # browse grid, genre rows
│   │   ├── search/          # search-as-you-type, filters
│   │   ├── player/          # built-in video player, subtitles, resume
│   │   ├── movie-form/      # Add Movie: autofill + manual modes
│   │   ├── import-export/   # bulk importer, CSV exporter
│   │   └── collections/     # playlists (roadmap)
│   ├── layouts/         # Page chrome
│   ├── pages/           # Route-level views, composition only
│   ├── hooks/            # Global shared hooks
│   ├── types/            # Shared TypeScript interfaces
│   └── utils/            # Pure helper functions
└── docs/
    ├── design-logs/    # Immutable feature design snapshots
    ├── PRDs/           # Product requirements and implementation plans
    ├── refactor-plans/ # Refactor RFCs filed as work items
    ├── handoff/        # Canonical design prototype — spec, screens, brand
    ├── ubiquitous-language.md
    └── dev-journal.md
```

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

### Dev (browser + hot reload)

```
npm run electron:dev
```

### Smoke-test (compiled, production renderer)

```
npm run electron:start
```

### Build installer

```
npm run release
```

Output: `release/FamilyFlix-Setup-x.x.x.exe`

### Commit message convention

```
<type>: [<initiative>] issue #<n> <description>
```

`<initiative>` is the PRD/feature initiative name (e.g. `movie-form`, `import-export`) — not the issue title.

Examples:

```
feat: [movie-form] issue #3 add folder-path autofill
fix: [player] issue #7 correct subtitle track offset
refactor: [library] issue #9 extract genre-row hook
```

Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`

Keep the description short enough to fit on one line — long descriptions get wrapped or mangled in commit history. If it doesn't fit, the issue is too broad; split it.

---

### Releasing a new version

```
npm version patch   # bugfix:      1.0.0 → 1.0.1
npm version minor   # new feature: 1.0.0 → 1.1.0
npm version major   # breaking:    1.0.0 → 2.0.0
```

Each command runs tests, typecheck, and lint first — if any fail the version bump is aborted. On success it updates `package.json`, commits, tags, and pushes. Then:

```
npm run release
```

Builds the installer and publishes it to GitHub Releases automatically.

---

## Build Status

| Feature                                         | Status          |
| ----------------------------------------------- | --------------- |
| Nx + Vite + React workspace scaffold            | ✅ Done         |
| Claude Design handoff prototype                 | 🔜 Planned      |
| Library core (movie model, SQLite, repository)  | 🔜 Planned      |
| Add Movie — manual mode                         | 🔜 Planned      |
| Add Movie — folder-path autofill                | 🔜 Planned      |
| Browse grid — genre rows                        | 🔜 Planned      |
| Search + filter                                 | 🔜 Planned      |
| Built-in video player (playback, subtitles)     | 🔜 Planned      |
| Watch tracking (watched / in-progress / resume) | 🔜 Planned      |
| Bulk import (Excel/CSV → library)               | 🔜 Planned      |
| Export (library → CSV)                          | 🔜 Planned      |
| Electron desktop shell                          | 🔜 Planned      |
| Desktop packaging (Windows installer)           | 🔜 Planned      |
| Collections / playlists                         | 🔜 Roadmap      |
| User accounts / multi-profile                   | 🚫 Out of scope |

---

## Docs

- [Ubiquitous Language](./docs/ubiquitous-language.md)
- [Design Logs](./docs/design-logs/)
- [PRDs](./docs/PRDs/)
- [Refactor Plans](./docs/refactor-plans/)
- [Design Handoff](./docs/handoff/HANDOFF.md)
- [Dev Journal](./docs/dev-journal.md)

---

## Author

**Carlos Rezai** — Senior Software Engineer, Berlin
Transitioning from frontend specialist to agentic AI engineering — building structured human-AI workflows and fullstack AI-powered products.

[GitHub](https://github.com/carlos-rezai)
[LinkedIn](https://www.linkedin.com/in/aryan-carlos-r-0ba21017b/)
