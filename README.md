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

FamilyFlix is an offline-first desktop application for Windows. There is no cloud version, no authentication, and no network dependency. All data and media live locally on the machine.

- **Shell:** Electron, one window over the bundled Express server, forked as a utility process and serving the built app beside its API on one loopback origin
- **Storage:** SQLite via `better-sqlite3` for the library; an import links each video where it lies in its Library folder (or copies it, if you choose Copy), and copies posters and subtitles into FamilyFlix's own managed media folder. Installed, everything lives under `%APPDATA%\FamilyFlix\`
- **No auth**: single household, single shared watch history, local-only by design
- **Packaging:** one file, `FamilyFlix-Setup-<version>.exe`, a one-click, per-user NSIS installer via `electron-builder`, no UAC prompt, unsigned, carrying the pinned FFmpeg build as the Default component; uninstalling keeps the library

---

## How It Works

### Adding a movie

One screen adds a movie and edits one. You fill in the title, year, director, cast, description, genre and rating, then pick the files: the video, a poster, and as many subtitle files as the film has, each tagged with its language. A title and a video are all that's required to save; everything else can be filled in later by opening the same screen again. Running time isn't asked for at all; it's read off the video file after it's copied.

Files are picked individually, from your machine's normal file dialog. FamilyFlix then **copies** what you gave it into its own media folder, so the app owns its copy and moving the original later can't break anything. On an edit, files you don't touch aren't re-uploaded: fixing a typo in a title doesn't move a 12 GB film.

### Migrating an existing library

A bulk importer reads an existing spreadsheet (title, year, genre, …) over every library folder you've listed, matches each row to its movie folder, and scans that folder for the video, poster and subtitle files (it isn't picky about subtitle format: `.srt`, `.vtt`, `.ass`, and `.sub` are all recognised), building the whole library in one pass. A row whose folder is a confident match is imported as the run goes, with a live progress console showing what's happening; the review step at the end lists only what the run couldn't settle on its own (a row with no folder, two folders for one row, a folder no row names, a copy that failed), each with a Resolve that opens the ordinary Add Movie form prefilled, and a Skip; two folders for one row are settled by pressing the right one, and a folder no row names by one _Import as_ press. A row for a title already in the library fills in whatever that title has empty, and anything it says differently waits in the review as _Yours | Spreadsheet_, field by field; nothing you filled in is overwritten without a press. Nothing is looked up online: the spreadsheet and the folder are all the importer reads, so there is no TMDB key to enter and no network to be on. Filling in what the sheet left blank (synopses, posters, runtimes) is a separate, opt-in Enrichment pass over the finished library, started from Settings → Network or the import's own _Also fetch metadata and posters from TMDB_, which is the one and only place FamilyFlix goes online. Pointing at a folder is the bulk importer's job rather than the Add Movie form's: a file dialog hands over a file, never a folder path. It is also how a development library gets filled: the importer's own test fixtures replace the dev seed the app carried until it shipped. An exporter writes the library back out as CSV or Excel (every movie, A–Z, under the same columns the importer reads) for backups or bulk edits, and an export fed back to the importer adds nothing.

### Watching

Movies open in a built-in player with subtitle support. Watched, in-progress, and unwatched movies are visually distinguished in the browse grid, and playback resumes where you left off.

### Browsing

The main screen is genre rows, like a streaming app, with search and filtering on top to find something quickly without scrolling. A film with no genre yet sits in its own _Other movies_ row, so every film is on the home.

### Looking after the library

A rescan never adds a title twice: a video FamilyFlix already plays is known wherever it lies and whatever its folder is now called, and a film whose file has gone missing is found again when a scan meets its file. Season folders are read the way real shows name them (`Season 1`, `Seizoen 1`, `Season 1 (2008)`, a release's `S01` folder, `Specials`), and a show folder pick names each episode by its path inside the show. Deleting a title takes it out of FamilyFlix and leaves its files where they lie, unless you ask for the Recycle Bin, and a file another title plays is never thrown away. A title taken out stays out of every scan until _Bring back_ on its Library folder, or until you add it again by hand. A poster that won't load draws the stand-in.

---

## Development Methodology

This project is built using a structured Claude Code skill workflow. Unlike a typical feature-by-feature build, FamilyFlix starts with a full Claude Design prototype: the browse grid, search, movie form, and player are designed up front, before any feature code is written, and that prototype becomes the visual reference for everything that follows.

ui-design-handoff → grill-me → design-log → ubiquitous-language → write-a-prd → prd-to-plan → prd-to-issues → tdd → build → request-refactor-plan → refactor

**What this means in practice:**

- The Claude Design prototype is built first and lives in docs/handoff/; every feature is implemented against it, not designed ad hoc as it's built
- Every feature starts with a grill-me session, where Claude interrogates the design until every assumption is resolved
- A PRD is written and filed as a GitHub issue before implementation begins
- Tests are written before code (TDD, stopping at RED)
- All domain terminology is locked in docs/ubiquitous-language.md
- Design decisions are recorded in docs/design-logs/
- All UI code strictly follows Atomic Design; see Component Architecture below

The `.claude/` folder contains all skill definitions. The `docs/` folder contains the full paper trail (PRDs, design logs, and the ubiquitous language dictionary), so the reasoning behind every decision is readable alongside the code.

---

## Component Architecture: Atomic Design

Every piece of UI maps to a rung on the Atomic Design ladder, and nothing skips a rung:

| Rung      | Folder        | Examples                       |
| --------- | ------------- | ------------------------------ |
| Atoms     | `primitives/` | Button, Input, Text, Icon      |
| Molecules | `components/` | PosterCard, Modal, ProgressBar |
| Organisms | `features/`   | LibraryGrid, MovieForm         |
| Templates | `layouts/`    | MainLayout                     |
| Pages     | `pages/`      | LibraryPage, MoviePage         |

Every component, at every rung, follows the same three-file shape:

```
ComponentName/
├── ComponentName.tsx
├── ComponentName.test.tsx
└── ComponentName.styles.ts
```

There is no per-component `index.ts`. Category folders (`primitives/`, `components/`, `utils/`, `tokens/`) carry the one barrel, re-exporting each unit straight from its file, so components are imported from the category, not from their individual folder.

Three folders under `src/` sit outside the ladder, because what they hold is not UI:

| Folder          | Purpose              | Rule                                                           |
| --------------- | -------------------- | -------------------------------------------------------------- |
| `api/`          | Shared wire calls    | One folder per call with its test. No barrel; imported by path |
| `App/`          | Router and providers | The shell every page renders inside. No domain logic           |
| `test-support/` | Shared test doubles  | Never imported by shipping code                                |

`server/src/` carries the mirror of the last of those. It is otherwise organised
strictly by domain (`library/`, `media/`, `import-export/`, `playback/`, with
`db/` as shared infrastructure and no miscellaneous catch-all), and that rule is
about **backend logic** having a domain home. Test doubles are not backend logic, so
`server/src/test-support/` gets the same one-line rule the frontend's rung has:
shared test doubles, one folder per unit with its test, never imported by
shipping code.

`api/` is the narrow one and the rule is what keeps it narrow: a call lives there
only once **two or more features** make it, because the alternative is one feature
importing another's wire. A call with a single caller stays with the feature that
makes it, and moves up only when a second feature asks for it.

---

Every feature is a 1:1 translation of the canonical prototype in docs/handoff/: the prototype is designed and resolved first, then implemented against, never redesigned mid-build.

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
├── .claude/            # Claude Code skills and CLAUDE.md
├── electron/           # The Desktop shell's main process: main.ts, wiring only, over one unit per decision
│   ├── shellMode/ shellPaths/ # dev / start / installed, read once; every path the shell and the server need, for that mode
│   ├── serverLaunch/ serverHandle/ awaitExitOrKill/ # the entry and environment off ShellPaths, fork the bundled server, wait for ready, shut it down or kill it
│   ├── quitAfterShutdown/ reloadOnce/ loadRenderer/ # the quit gate, one reload after a crash, loading until Vite answers
│   ├── rendererUrl/ windowPolicy/ downloadPath/     # where the window points, what it may open, where a download lands
│   ├── pickFolders/        # the native folder dialog's answer → the paths to add, behind the preload's folders bridge and its Path bridge (a picked file's absolute path)
│   ├── shellDialogs/ shellLog/ appIdentity/         # the two failure dialogs, the Shell log, the taskbar identity
│   ├── assets/             # icon.ico, the App mark, and its guard
│   ├── packaging/          # builderConfig.json, ffmpegPin.json, and the guard that holds them to the shell
│   ├── scripts/            # buildElectron.mjs, buildIcon.mjs, fetchNative.mjs, fetchFfmpeg.mjs, packageApp.mjs; verifyDigest/ and zipEntries/, pure units the scripts import
│   ├── test-support/       # fakeServerChild, never imported by shipping code
│   └── .native/ .ffmpeg/ dist/ # gitignored: the Electron-ABI binding, the Default component, the two bundles
├── server/             # Express backend
│   └── src/
│       ├── routes/         # HTTP layer only: parses requests, calls a domain module; enrichmentBody/ reads a Sync's start and Apply choices, seriesFormBody/ a series save, foundPathRefusal/ a found path both adds read; loopbackGuard/ and rendererRouter/ stand in front of the API
│       ├── library/        # movie CRUD, SQLite queries, watch-state + resume position, the household's settings and the TMDB key and stamp beside them
│       │   ├── enrich/            # a Sync's film writes, the counts over both kinds, the Source folders, and Full details spelled once
│       │   ├── folders/           # the Library folders: the list, its title counts, the remove that keeps the titles, and folderOverlap
│       │   ├── holding/           # the Held video rule's read: the title a video already belongs to
│       │   ├── leftOut/           # the Left-out videos a scan skips, and titleVideos, the ones a keep-files Delete records
│       │   └── series/            # series storage, one unit per concern: read, browse, write, watch, curation, enrich, nextEpisodeOf, and yearSpan, the one reading of a Year range
│       ├── media/          # folder scanning, copying files into managed storage (a season's folder among them), a Sync's art (storeNamed, into a title's Media folder or a season under it; readStored), subtitle detection, removing a title's Media folder after a delete, space used
│       │   ├── readableFolder/        # whether a path is a folder the app can read, never throwing
│       │   ├── walkLibraryFolder/     # a Library folder → its Source folders
│       │   ├── scanMovieFolder/       # one folder → its video, poster, backdrop, subtitles
│       │   ├── detectSubtitleLanguage/ # the language tag in a subtitle's name
│       │   ├── episodeTag/            # the Episode tag: read off a filename, and spelled back as S01E03
│       │   ├── spaceUsed/             # the bytes under the media root, never throwing
│       │   ├── writableFolder/        # whether a folder can be written into, never throwing
│       │   └── fileKinds/             # what an image, a subtitle and a video may be called
│       ├── import-export/  # the bulk importer and the exporter: readSheet, titleKey, matchRows, groupShows, admitFolder, heldValues, readShowFolder, listedFolderOf, heldByVideo, placeFoundVideo, leftOutEntries, placeShowFolder, placeFilmFolder, copyFoundEpisodes, planSheetFields, plannedSheetFill, createImporter (+ its film and series fixtures), writeSheet, exportName, exportRows, exportSummary, writeExport
│       ├── playback/       # the Playback component (probe, spawn, decoders), the Component slot it lives in (componentSlot, componentBinary, verifyComponent), the path choice, streaming, subtitle parsing, derivedRuntime, capabilities(component)
│       ├── enrichment/     # the fifth domain, the one network client: tmdbClient, tmdbAuth, tmdbGenres, matchScore, fetchedFields, currentFields, planFields, planEpisode, plannedEnrichment, decisionFace, writeBack, createEnrichment
│       ├── db/             # SQLite connection + schema/migrations (3: the settings table; 4: series and episodes; 5: original title, TMDB score and source folder on both titles, stills on episodes; 6: the Library folders; 7: the old library root carried onto them; 8 and 9: the Source file an episode and a film remember across scans; 10: season posters); the Electron-ABI binding when FAMILYFLIX_SQLITE_BINDING names one
│       ├── shell/          # the server's half of the shell seam: shellHandshake, listen (the loopback bind and boundPort), orderedShutdown
│       └── test-support/   # Shared test doubles, never imported by shipping code (heldCopy, libraryFixture, seriesFixture, fixedSlot, componentDir, fakeTmdb, offlineTmdb, …)
├── src/                # React frontend
│   ├── App/            # Router and app-level providers
│   │   ├── DisplayPreferenceProvider/ # the household's Ultrawide margins and TMDB ratings, held app-wide; useDisplayPreference and useTmdbRatings read them, saveUltrawideMargins and saveTmdbRatings write them
│   │   ├── ContentFrame/     # the Content frame: every route but the player's, capped at 1920px and centred while Ultrawide margins is on
│   │   ├── SnackbarProvider/ # the Snackbar stack: the queue, the timers, the fixed bottom-right column; an action persists, everything else dies at 5s
│   │   └── useSnackbar/      # `{ notify, dismiss }` off the stack, and SnackbarNotice
│   ├── assets/         # Static images, fonts, icons
│   ├── styles/         # Global CSS reset and Reduced motion, visuallyHidden; theme.ts, the createTheme(accent) factory spreading the Accent scale; interactionStates/: controlStates(press), cardLift, cardFocus, and the structural guard in its test
│   ├── tokens/         # Colors, spacing, typography, breakpoints, motion, layout (the Content measure)
│   ├── primitives/     # Atomic UI elements (Button, Input, Text, Toggle, Artwork and the Wordmark, the Icon glyphs: the Snackbar's four, the FAB's two and enrichment's five among them), each with .tsx, .test.tsx, .styles.ts
│   ├── components/     # Composed UI blocks (PosterCard, Modal, ProgressBar, CreditsRow, SeasonCard, EpisodeRow, PillTabs, EpisodeFileRow, ChoiceCard, ImportModeChoice), same three-file shape
│   │   ├── Modal/          # the scrimmed card every dialog is drawn on; owns its own dismissal and focus; `bare` for a card that is its children alone
│   │   ├── LogConsole/     # the import's Activity log, pinned to its bottom
│   │   ├── Snackbar/       # the transient bottom-right card, one of four variants; presentational, as the stack above owns the timing
│   │   ├── Fab/            # the FAB: the accent circle in the bottom-right corner, one of two glyphs; presentational, as it does not know there is a threshold
│   │   └── BackToTop/      # the control over a scrolling container: the Scroll threshold, the passive listener, the read on attach, the press; mounts the FAB or nothing
│   ├── features/       # Domain UI + logic co-located
│   │   ├── library/        # browse grid, genre rows, and the Movies / Series tabs, with the Series tab under series/; StartTabGate and useStartTabSettled, which open the app on the Start tab
│   │   ├── search/          # search-as-you-type, filters
│   │   ├── movie-detail/    # the movie page, its ⋯ menu, and the Delete dialog the menu opens
│   │   │   ├── EditMenu/          # Edit details, and the red Delete row
│   │   │   ├── DeleteMovieDialog/ # Modal + the fixed copy + Delete movie / Cancel
│   │   │   ├── useDeleteMovie/    # sends the delete, then steps back through history
│   │   │   └── api/               # saveRating, deleteMovie, one caller each
│   │   ├── series/          # the Series page and the Season page: SeriesDetail, SeasonEpisodes, SeriesMetaLine, LoadingSeries, useSeriesRead and the two page hooks, seriesView, seasonView
│   │   ├── player/          # built-in video player for any Playable, the Audio picker (AudioMenu) and the Subtitle picker (SubtitleMenu, subtitleLabel), their Audio and Subtitle choices held by PlayerScreen for the sitting, subtitles (useSubtitles reads the preferred language), resume, and Up next (UpNextCard, useUpNext)
│   │   ├── movie-form/      # Add a movie or a series, Edit a movie: one form, manual pickers, the Kind tabs; MovieForm, MovieFormFiles and SeriesFormFiles over filesCard.styles.ts and filesCard.ts, useMovieForm, useEpisodeList, useImportMode, useShowFolderPick, readEpisodeTag, titleFromFilename, and createSeries, readShowFolder and containingFolder in its api/; and Resolve, the Import context
│   │   ├── import-export/   # the bulk importer's screen: ImportFlow and its three steps, useImportRun, importView; the Library folders page: LibraryFolders, FolderRow, useLibraryFolders, useFolderScan; and the Export dialog: ExportModal, useExport, startExport in its api/; pathField.styles.ts, the path row both draw
│   │   ├── enrichment/      # the Sync with TMDB: EnrichmentFlow and its three steps, SetupBanner, ScopeCard, WriteTargetRow, DecisionRow over CandidatePicker, TitleSearch and FieldDiff, useEnrichmentRun, enrichmentView, and its api/
│   │   ├── settings/        # the Maintainer's hub: SettingsHeader; LibrarySection + ActionRow; PlaybackSection (the Codecs row onto the Codecs page); DisplaySection (the Ultrawide margins and TMDB ratings Toggles, and the Start on Pill tabs); CodecManager (the Codecs page's screen) over CodecRow, ComponentDropZone, codecView, zoneFace; NavigationRow, the row both the Codecs row and the sync row draw through; NetworkSection + useTmdbKey + syncLine; StorageSection; AboutSection; useCapabilities, useSettings, useStorageReport; and its api/
│   │   │   └── section.styles.ts # the Group heading, the Section card, the divider, an item's title and lede, and the row furniture: what every group draws with
│   │   ├── maintainer.styles.ts # the header and the captioned field the Maintainer's screens share
│   │   └── collections/     # playlists (roadmap)
│   ├── layouts/         # Page chrome (MainLayout mounts Back-to-top over its body, on the ref useRestoredScroll attached)
│   ├── pages/           # Route-level views, composition only (ImportPage, EnrichmentPage, CodecsPage and LibraryFoldersPage among them)
│   ├── api/             # Wire calls two or more features share (saveFavorite, fetchMovie, saveWatched, dismissProblem, fetchSettings, saveSeriesFavorite, saveEpisodeWatched, fetchEnrichmentSummary, fetchTmdbKey)
│   ├── hooks/            # Global shared hooks (useGoBack(fallback): the one Back rule, a history step with the screen's own landing behind it; useRestoredScroll, useOptimisticEdit, useEnrichmentSummary, useLibraryTab, the Library tab the URL names, and useImageFallback, the one failed-url rule for a poster or a still)
│   ├── types/            # Shared TypeScript interfaces (import.ts, export.ts, settings.ts, playback.ts, series.ts, enrichment.ts, read by both build targets; form.ts, the Movie form's shapes; shell.ts, the Shell handshake, read by the server and the shell; appVersion.d.ts)
│   ├── utils/            # Pure helper functions (formatBytes, formatElapsed, formatEpisodeTag, moviePath, enrichPath, seriesPath, seasonPath, episodePlayPath, imageUrl, shownRating, tmdbMarks, accentScale, isLibraryTab, libraryTabOptions and inTrackOrder among them)
│   └── test-support/     # Shared test doubles (fakeResponse, fakeFolderBridge, makeSeriesDetail, makeContinueCardMovie, makeEnrichmentRun, stubScrollMetrics, stubScrollTo, comesBefore, snackbarStack, LocationProbe and its navigationType reader, shippingSources, resolvedStyle and normCss, …)
├── release/            # gitignored: the Installer, and win-unpacked/, the Packaged layout
└── docs/
    ├── design-logs/    # Immutable feature design snapshots
    ├── PRDs/           # Product requirements and implementation plans
    ├── refactor-plans/ # Refactor RFCs filed as work items
    ├── handoff/        # Canonical design prototype: spec, screens, brand
    ├── ubiquitous-language.md
    ├── feature-checklist.md  # Every feature, shipped and planned, in build order
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

```
npm run electron:package         # release/FamilyFlix-Setup-<version>.exe
npm run electron:package -- --dir  # release/win-unpacked/ only, no installer
```

Builds the renderer and both bundles, fetches the Electron-ABI binding and the Default component, then hands `electron/packaging/builderConfig.json` to `electron-builder`: a one-click, per-user NSIS installer for x64, unsigned, with no `node_modules` inside it.

```
npm run electron:ffmpeg
```

Downloads the build `electron/packaging/ffmpegPin.json` names, refuses it unless its SHA-256 is the pin's, and extracts `ffmpeg.exe`, `ffprobe.exe` and the licence into the gitignored `electron/.ffmpeg/`. `electron:package` runs it anyway; once fetched it needs no network.

Every Installer is proven by the [release checklist](./docs/release-checklist.md) before it reaches anyone.

### Installing on a new machine

1. Copy `FamilyFlix-Setup-<version>.exe` over.
2. Run it. The installer is unsigned, so SmartScreen stops it once: _More info → Run anyway_. There is no other prompt: it installs for the current user and opens FamilyFlix.
3. Import the library: Settings → Import from spreadsheet.

The library lives in `%APPDATA%\FamilyFlix\` and survives an uninstall, so a reinstall finds it as it was.

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
- [Design Handoff](./docs/handoff/HANDOFF.md)
- [Feature Checklist](./docs/feature-checklist.md): every feature, shipped and planned, in build order
- [Dev Journal](./docs/dev-journal.md)
- [Release Checklist](./docs/release-checklist.md): the Package smoke a release is ticked against

---

## Author

**Carlos Rezai**, Senior Software Engineer, Berlin

[GitHub](https://github.com/carlos-rezai) · [LinkedIn](https://www.linkedin.com/in/aryan-carlos-r-0ba21017b/)
