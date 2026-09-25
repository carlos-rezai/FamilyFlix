# FamilyFlix — A Netflix for the Family Movie Folder

## Project Overview

FamilyFlix is a desktop app that turns a folder of movie files into
something that feels like Netflix. It replaces an Excel sheet and a
loose folder structure (one folder per movie, containing the video file,
a subtitle file, and a poster image) with a browsable, searchable
library and a built-in player.

Built primarily for my parents to navigate easily. I maintain and
update the library; they just browse and watch.

Portfolio project by Carlos Rezai demonstrating fullstack engineering,
desktop app development, and Claude Code workflow.

## Tech Stack

- **Frontend:** React + TypeScript, Vite, Nx workspace
- **UI:** styled-components + a custom design system (built via Claude
  Design handoff — see `docs/handoff/`)
- **Backend:** Node.js + Express
- **Database:** SQLite via `better-sqlite3`
- **Shell:** Electron
- **Video Playback:** a plain `<video>` element driven by our own
  `usePlayback` hook — no video.js, no react-player. Finalised in
  `docs/design-logs/10-video-player.md` Q2: the player's chrome and its
  subtitle overlay are entirely bespoke, so a library's skin and native
  cue rendering are both things to defeat rather than use, and jsdom can
  drive a bare element but not video.js
- **Playback component:** FFmpeg, bundled by the installer, behind
  `server/src/playback/`. Chromium reads MP4/WebM only, so every `.mkv`
  and `.avi` in the family folder is remuxed or transcoded on the way to
  the element. No uploaded `.dll` can change what a browser decodes —
  Settings' "codec pack" replaces this binary, which it does: a drop on
  the **Component drop zone** is two binaries staged, verified and sworn
  into the **Component slot**, and the next press of Play converts with
  them
- **Testing:** Vitest + @testing-library/react
- **Linting:** ESLint + Prettier + Husky

## No AI

FamilyFlix does not use AI anywhere — no recommendations, no smart
search, no generated summaries. This is a deliberate, permanent
decision, not a deferred feature. The app is intentionally simple: a
fast, local, searchable library and a reliable player. There is no
`ai/` directory in this project.

## Atomic Design

FamilyFlix strictly follows Atomic Design for all UI code. Every layer
maps to a rung on the ladder, and nothing skips a rung:

| Rung      | Folder        | Examples                               |
| --------- | ------------- | -------------------------------------- |
| Atoms     | `primitives/` | Button, Input, Text, Icon, Badge       |
| Molecules | `components/` | PosterCard, Modal, ProgressBar         |
| Organisms | `features/`   | LibraryGrid, MovieForm, PlayerControls |
| Templates | `layouts/`    | MainLayout                             |
| Pages     | `pages/`      | LibraryPage, MoviePage                 |

**Folder convention (every component, no exceptions):**

```
ComponentName/
├── ComponentName.tsx
├── ComponentName.test.tsx
└── ComponentName.styles.ts
```

This applies at every rung — a primitive like `Button/` and a feature
component like `MovieForm/` both follow the exact same three-file shape.

The same one-folder-per-unit rule extends beyond components: each `utils/`
helper lives in its own folder with its test — `gradientFromId/gradientFromId.ts`
beside `gradientFromId.test.ts` — and a feature's non-component modules (e.g. a
`view` mapper) get a folder too. Keep source and test co-located in that folder.

**The trigger is companion files, not files as such.** A unit gets its own
folder when it has files that must travel together — a test, and for components
a `.styles.ts`. The folder is what keeps those siblings co-located.

**Exception — single-file modules stay flat.** `tokens/` (`colors.ts`,
`spacing.ts`, …) and `types/` (`index.ts`) are single leaves of `as const` data
/ shared interfaces: no test, no styles, nothing to co-locate. They already sit
cohesively under their category folder, so wrapping each in a one-file folder is
pure ceremony — the mirror image of a redundant per-unit barrel. Keep them flat.
If a token ever needs a test, it graduates into a folder then (not before).

Folders do **not** carry their own `index.ts` barrel. Only the category
folders (`primitives/`, `components/`, `utils/`, `tokens/`) get an `index.ts`,
and it re-exports each unit directly from its file
(`export { Button } from './Button/Button'`), so imports read
`import { Button } from '@/primitives'` rather than reaching into individual
folders. A single category barrel is enough — don't add a redundant per-unit
barrel.

Never build a one-off styled `<div>` inline inside a feature when a
primitive or component for it already exists. Never add business logic
to a primitive or component — if a molecule starts needing data
fetching or domain knowledge, it has graduated into a feature.

## Folder Structure

familyflix/
├── .claude/
│ └── skills/
├── server/
│ └── src/
│ ├── routes/ ← HTTP layer only: parse request, call a domain module, return response
│ ├── library/ ← movie CRUD, SQLite queries, watch-state + resume-position logic
│ │ ├── settings/ ← the household's Settings: `settings()` with the default applied when the row is absent, `setSubtitleLanguage()` as an upsert
│ │ └── series/ ← series storage, one unit per concern as the movie's is, each with its own suite: `read` (the series page, the player's episode read, the episode list), `browse` (the Series tab and its genres), `write` (the two inserts), `watch` (the resume write, the episode and season marks), `curation` (the heart), and `nextEpisodeOf`, pure
│ ├── media/ ← folder scanning, file copy into managed storage, subtitle detection, the Movie folder’s removal after a Delete
│ │ ├── createMedia/ ← the injected domain: reserve a Movie folder, `seasonFolder` (a Series folder’s `season-NN/`), storeUpload, copyIn (a stream under the cancel signal), the three removals
│ │ ├── fileKinds/ ← what an image, a subtitle and a video may be called — the store’s security boundary, and the scanner’s line
│ │ ├── walkLibraryRoot/ ← a Library root → its Source folders: a folder holding a video is one and is not descended
│ │ ├── scanMovieFolder/ ← one Source folder → every video, the poster by name, the backdrop by name only, every subtitle
│ │ ├── detectSubtitleLanguage/ ← the language tag in a subtitle’s name → its language, off the shared Language pool
│ │ ├── episodeTag/ ← the Episode tag: `episodeTag` reads `S01E03` / `1x03` and the title after it off a filename, `spellEpisodeTag` writes one back — the server’s one spelling
│ │ ├── spaceUsed/ ← Space used: a walk summing every file under the media root, 0 for a missing root, an entry gone mid-walk skipped, never throwing — a function, not a createMedia member
│ │ └── movieFolder/ safeFilename/ ← pure: the folder a title and year name; a filename the store will take
│ ├── import-export/ ← the bulk importer and the exporter: Excel/CSV parsing and writing, row-to-folder matching, the Current run
│ │ ├── readSheet/ ← .xlsx or .csv by extension, first worksheet, headers through a synonym table → Sheet rows; a Status column reads as watched, a BOM is stripped
│ │ ├── writeSheet/ ← the reader’s mirror: the eight Export columns as a header row, one row per movie in the order given, .csv behind a BOM or .xlsx unstyled — pure over the list, no storage, no sorting
│ │ ├── titleKey/ ← pure: the Title key matching compares, and titleGuess for a folder no row names
│ │ ├── matchRows/ ← pure: rows × folder scans → matches, problems by kind, unclaimed folders
│ │ ├── groupShows/ ← pure: the walk’s Source folders → Show folders (Season folders under one, or loose tagged episodes) and the films left over
│ │ ├── createImporter/ ← the injected domain: start, current, cancel, problem, resolve, dismiss — one run in memory, its state machine as closures
│ │ │ ├── fixture/ ← the two-film sheet (.xlsx and .csv) and folder tree the tests run over, and a dev library is filled from
│ │ │ └── seriesFixture/ ← the two-show sheet and tree — one Season-folder show, one of loose episodes — kept apart so the film suites’ counts never move
│ ├── playback/ ← the Playback component, the slot it lives in, the path choice, streaming, subtitle parsing
│ │ ├── ffmpegBinary/ ← resolve the component: the Component slot, then env var, then PATH, then absent; exports `pairIn` (a directory → its pair) and `EXE` (what a platform calls a binary, the one answer the slot and the tests read too)
│ │ ├── componentSlot/ ← the Component slot: `createComponentSlot(slotDir, env, { verify, rename })` — `current/` read ahead of everything, `incoming/` and `previous/` swept on startup, `receive()`/`take`/`install()`/`discard()`, `remove()`, and the Component swap's three renames with the In-use refusal off the first one that fails like a lock. Outcomes are values, never throws: four install refusals, three remove
│ │ ├── componentBinary/ ← pure: a filename → `ffmpeg` / `ffprobe` / null — this feature's security boundary, the way `fileKinds` is media's; the binary's own word, optionally a `-` and whatever the build called itself, optionally `.exe`
│ │ ├── verifyComponent/ ← the Verified component: run the staged pair before anything moves
│ │ ├── probe/ ← ffprobe wrapper → MediaProbe (container, codecs, duration)
│ │ ├── mediaDuration/ ← an MP4’s own moov/mvhd, so a direct play needs no component
│ │ ├── choosePlaybackPath/ ← pure: MediaProbe → direct / remux / transcode / cannot-play + argv
│ │ ├── createPlayback/ ← the injected domain: `createPlayback(mediaPath, slot)` — videoFile, read, stream, subtitleFile, cues, capabilities, receiveComponent, removeComponent. It takes the slot rather than a component and reads it per request, so the next press of Play decides over whatever is live with nothing cached to clear
│ │ ├── ffmpegComponent/ ← the injected seam: what this machine can be asked to do — probe, spawn, the hardware encoder, and `decoders()`, the raw `ffmpeg -decoders` listing (an encoders/decoders listing pair behind it)
│ │ ├── mediaFilePath/ ← the under-media-root check between a stored string and an open file
│ │ ├── derivedRuntime/ ← a Playback and a stored path → the runtime minutes off the bytes, never throwing; the form’s save and the importer both ask it
│ │ ├── capabilities/ ← the Codec report: Chromium native set ∪ what `capabilities(component)` reads off whichever component the slot holds now — never the environment, never a binary on PATH; a decoder name begins with a letter
│ │ ├── parseSrt/ parseVtt/ parseAss/ parseSub/ ← pure, one format each
│ │ └── parseSubtitle/ ← dispatch on extension; the last place a format is known
│ ├── db/ ← SQLite connection + schema/migrations (1 the schema and the genre seed, 2 `last_watched_at`, 3 the `settings` table — nothing seeded, 4 `series` and `episodes` with their two joins, `series_genres` and `episode_subtitles` — no `seasons` table), shared by every domain module above
│ └── test-support/ ← test doubles shared across server tests, never imported by shipping code
│ ├── heldCopy/ ← a Media whose first copy waits until released, forwarding the cancel signal
│ ├── fixedSlot/ ← a Component slot over one fixed component, for the thirty-odd suites that compose a Playback and never write to the slot
│ ├── componentDir/ ← a component's two files in a sandbox, and `ffmpegIn` / `ffprobeIn` / `EXE` (re-exported from the resolver that owns it)
│ ├── seriesFixture/ ← the importer’s series fixture copied under a sandbox → { root, sheet }
│ └── libraryFixture/ ← the importer’s fixture copied under a sandbox → { root, sheet }
├── src/
│ ├── App/ ← the router and the app-level providers every page renders inside; `App.tsx` stays flat here (log 18 Q16), and the two units below are imported by path, no barrel
│ │ ├── SnackbarProvider/ ← the Snackbar stack: the queue, the ids off a counter, one timer per plain notice, the fixed bottom-right `column-reverse` column (newest nearest the corner, `pointer-events: none` with each card's wrapper taking them back, always mounted, no portal, no cap, no dedupe), and the action that takes its own notice off first and then runs
│ │ └── useSnackbar/ ← the context, `useSnackbar()` → `{ notify, dismiss }` (throwing outside the provider, naming itself), and `SnackbarNotice` — `{ variant, title?, message, action? }`; no `duration`, no `dismissible`: an action persists, everything else dies at 5s
│ ├── assets/ ← images, fonts, icons (static)
│ ├── styles/ ← global CSS reset (and the one **Reduced motion** block), themes, and visuallyHidden.ts — the clip that hides an input without taking it out of the tab order
│ │ ├── theme.ts ← the factory: `createTheme(accent = colors.accent)` spreads the **Accent scale** over `colors` and mounts `motion`; `theme = createTheme()`
│ │ └── interactionStates/ ← the **Interaction contract** as three fragments: `controlStates(press)` — the transition, the **Press** at doubled rank in 60ms, the 3px **Focus ring** — and `cardLift` (tile) and `cardFocus` (root) for a **Card**; its test carries the structural guard: no shipping file but `tokens/motion.ts` spells a duration or the curve, none but the fragment a press
│ ├── tokens/ ← colors, spacing, typography, breakpoints, motion
│ │ ├── colors.ts ← one accent; its five derivatives are the theme factory's
│ │ ├── spacing.ts
│ │ ├── typography.ts
│ │ ├── breakpoints.ts
│ │ ├── motion.ts ← `durFast` 120ms, `durBase` 180ms, `durSlow` 280ms, `easeOut` — the only file that spells them
│ │ └── index.ts
│ ├── primitives/ ← dumb, reusable UI atoms (Button, Input, Text, Icon, Badge)
│ │ ├── index.ts ← barrel: re-exports every primitive (only barrel at this rung)
│ │ ├── Icon/ ← one file per glyph on IconBase (DownloadIcon, SheetIcon, CheckIcon, MicrochipIcon, UploadIcon, the Snackbar's four — InfoCircleIcon, CheckCircleIcon, BangTriangleIcon, CrossCircleIcon — and the FAB's two — ArrowUpIcon, PlusIcon — named for what they draw, …), `currentColor`, sized by the caller
│ │ ├── TextField/ ← the boxed input: a glyph slot (the sheet and folder glyphs among them) and `mono` for a path
│ │ ├── Toggle/ ← the switch: `{ checked, disabled?, onToggle, label }`, `role="switch"`, `aria-disabled` rather than `disabled` so it stays in the tab order
│ │ └── Button/ ← primary / secondary / ghost / danger, at sm (a list row’s pair) / md / lg
│ │ ├── Button.tsx
│ │ ├── Button.test.tsx
│ │ └── Button.styles.ts
│ ├── components/ ← composed primitives, no business logic (PosterCard, Modal, ProgressBar)
│ │ ├── index.ts ← barrel: re-exports every component (only barrel at this rung)
│ │ ├── Modal/ ← the scrimmed card every dialog is drawn on: portal, Escape/scrim/✕, focus in, Tab held, focus back; `bare` makes the card its children alone, `title` its aria-label
│ │ ├── LogConsole/ ← the Activity log: the last lines by kind, pinned to the bottom
│ │ ├── Snackbar/ ← the transient bottom-right card, `mol.Snackbar.dc.html` 1:1: one Snackbar variant drawn as the accent bar, the glyph, the action's colour and the role (`status` for info/success, `alert` for warning/error; `error` reads `danger`), an optional title, the message, an optional action, the card's own ✕ named Dismiss. Presentational to the last prop — no timer, no effect
│ │ ├── Fab/ ← the FAB, `mol.Fab.dc.html` 1:1: one more `styled(IconButton)` face — the accent circle at 28px from the bottom-right corner, one of two glyphs by `icon`, named by a required `label`. Presentational to the last prop — no state, no listener, no effect; it does not know there is a threshold
│ │ ├── BackToTop/ ← the control: given the scrolling container as a ref, it owns the Scroll threshold (`scrollTop > 420`, strictly), the passive listener, the read on attach and the press, and mounts the FAB or nothing. Two files, no styles — it draws nothing of its own
│ │ ├── CreditsRow/ ← the lead credit and Starring: graduated from `movie-detail/` when the series page drew it too, its lead label a prop
│ │ ├── SeasonCard/ ← `mol.SeasonCard` 1:1: the 2:3 **Card**, `S02` over the gradient, the badge when complete, the bar when part-watched
│ │ ├── EpisodeRow/ ← `mol.EpisodeRow` 1:1: the 16:9 thumbnail, `S02E04` and the title, the air date, the Resume label, the watched box that only marks; a **Card**, its box a **Control**
│ │ └── PosterCard/
│ │ ├── PosterCard.tsx
│ │ ├── PosterCard.test.tsx
│ │ └── PosterCard.styles.ts
│ ├── features/ ← business logic + UI co-located per domain
│ │ ├── library/ ← genre rows, browse grid
│ │ │ ├── LibraryTabs/ LibraryBody/ ← the Movies / Series switch, writing `tab` as a replace, and the body it chooses
│ │ │ └── series/ ← the Series tab: SeriesHome over the same LibraryGrid and ContinueRow, seriesCardView and episodeContinueView
│ │ ├── search/ ← search-as-you-type, filters
│ │ ├── movie-detail/ ← the movie page: art, credits, the signals, the ⋯ menu and what it opens
│ │ │ ├── MovieDetail/ ← the organism: owns the hooks, renders the rest
│ │ │ ├── EditMenu/ ← the ⋯ menu: Edit details, and the Danger row that opens the Delete dialog
│ │ │ ├── DeleteMovieDialog/ ← the Delete dialog: Modal + the fixed copy + Delete movie / Cancel
│ │ │ ├── useDeleteMovie/ ← { deleting, deleteMovie }; back through useGoBack once the movie is gone
│ │ │ ├── useMovieDetail/ ← fetch one movie, or its not-found state
│ │ │ ├── MetaLine/ LoadingDetail/ ← the page’s own molecules
│ │ │ ├── detailView/ ← pure: a Movie → what the page shows
│ │ │ └── api/ ← saveRating, deleteMovie (one caller each, so they stay here)
│ │ ├── series/ ← the Series page and the Season page
│ │ │ ├── SeriesDetail/ ← the series page’s organism: the hero, the heart, the Seasons grid
│ │ │ ├── SeasonEpisodes/ ← the season page’s organism: the Episode rows, the marks, _Other seasons_
│ │ │ ├── SeriesMetaLine/ LoadingSeries/ ← the series page’s own molecules: the Year range, counts and read-only stars; the hero’s shape while it loads
│ │ │ ├── useSeriesRead/ ← the one load both pages read: the Load state, the stale-response guard, retry, and `editSeries`
│ │ │ ├── useSeriesDetail/ useSeasonEpisodes/ ← each page’s read mapped per render, and its writes on `useOptimisticEdit`
│ │ │ ├── seriesView/ seasonView/ ← pure: a SeriesDetail → SeriesPageModel, and → SeasonPageModel for one season
│ │ │ └── api/ ← fetchSeriesDetail, saveSeasonWatched (one caller each)
│ │ ├── player/ ← built-in video player, subtitle handling, resume position — for any **Playable**, a movie or an episode
│ │ │ ├── Player/ ← the organism: owns the hooks, renders the rest
│ │ │ ├── PlayerControls/ ← the top and bottom chrome bars
│ │ │ ├── PlayerScrubber/ ← the seek bar
│ │ │ ├── VolumeSlider/ ← the volume bar (shares logic with the scrubber, not pixels)
│ │ │ ├── SubtitleOverlay/ ← the styled cue box, ours rather than ::cue
│ │ │ ├── PlayerNotice/ ← buffering / missing-file / cannot-play, in the play circle
│ │ │ ├── UpNextCard/ ← the Up next card: the next episode, the countdown, _Play now_ and _Cancel_
│ │ │ ├── usePlayback/ ← element state ↔ React state, offset re-anchoring
│ │ │ ├── useSubtitles/ ← which track (the Preferred subtitle language read through fetchSettings once per open, then track order), the box, the line on it; the Cue list held against the row it came from
│ │ │ ├── useWatchReporter/ ← tick, coalesce, finish
│ │ │ ├── useUpNext/ ← the Up next rules: the 15-second window, _Play now_, _Cancel_ for this episode, and what the end of the file does
│ │ │ ├── useOpeningReads/ ← the record and the Playback read, together
│ │ │ ├── useControlsVisibility/ ← 3s idle, hidden cursor
│ │ │ ├── usePlayerKeys/ ← the keyboard map, onto the buttons’ own handlers
│ │ │ ├── useFullscreen/ ← the whole surface up, never the bare element
│ │ │ ├── useDragScalar/ ← a pointer over a track → a 0–1 scalar
│ │ │ ├── cueAt/ ← pure: the line covering a position
│ │ │ ├── preferredSubtitle/ ← pure: default language, then track order
│ │ │ ├── volumePreference/ ← the level and mute, in localStorage
│ │ │ └── api/ ← fetchPlayback, fetchSubtitleCues, saveResume, fetchEpisode — each addressed by a Playable
│ │ ├── maintainer.styles.ts ← the furniture the Maintainer’s screens extend: the header row, heading and lede; the captioned field
│ │ ├── movie-form/ ← Add/Edit a movie: one form, manual file pickers; and Resolve, the Import context over either job
│ │ │ └── api/ ← createMovie, updateMovie, fetchGenrePool, fetchProblem, resolveProblem (one caller each)
│ │ ├── import-export/ ← the bulk importer’s screen, and the Export dialog
│ │ │ ├── ImportFlow/ ← the organism: owns useImportRun, renders one of the three steps
│ │ │ ├── ImportSetup/ ImportProgress/ ImportReview/ ← the three steps: the two path fields; the stepper, bar and log; the tiles and the Needs attention list
│ │ │ ├── PhaseStepper/ StatTile/ ProblemRow/ ← the flow’s own molecules
│ │ │ ├── useImportRun/ ← start, poll at 500 ms while running, cancel, skip
│ │ │ ├── importView/ ← pure: an ImportRun → headline, stat line, percent, elapsed, ETA
│ │ │ ├── ExportModal/ ← the Export dialog: owns useExport; the idle face over Modal, and Export ready over the bare one — the same card, so the pop-in runs once
│ │ │ ├── FormatCard/ ← one Format card: a role="radio" button with a label and a line, the pair in a radiogroup
│ │ │ ├── useExport/ ← csv and idle on every open, the summary fetched fresh; exportLibrary fetches the file, hands it to saveToComputer, then done. A close mid-request drops the redraw, not the file
│ │ │ ├── saveToComputer/ ← a blob → the browser’s Downloads under a filename: an object URL on an anchor carrying `download`, clicked, revoked. A DOM side effect, so a feature unit rather than a util
│ │ │ └── api/ ← startImport, fetchCurrentImport, cancelImport, fetchExportSummary, fetchExportFile (one caller each)
│ │ ├── settings/ ← the Maintainer’s hub: four Settings groups under one header
│ │ │ ├── section.styles.ts ← the furniture every Settings group draws with: the Group heading, the Section card (with the 32px group gap under it), the divider, an item’s title and lede
│ │ │ ├── SettingsHeader/ ← Back, the heading, ＋ Add a movie
│ │ │ ├── LibrarySection/ ← the Library group: Add a movie and Import from spreadsheet owning their routes, and Export to CSV owning the Export dialog it mounts — the one place a section composes another feature’s organism
│ │ │ ├── ActionRow/ ← one glyph + label + description row of the Library group
│ │ │ ├── PlaybackSection/ ← the Playback card: Codecs over CodecManager, the divider, Subtitles — the Auto-on toggle under its Coming soon pill, and Preferred language over FilterDropdown, shown at once and put back on refusal
│ │ │ ├── CodecManager/ ← the Codec report organism: owns useCapabilities, the Codec summary over one CodecRow per catalogued codec, then the Component row last, then the drop zone under all of it; the ✕ passed only when the report says the component is removable
│ │ │ ├── CodecRow/ ← one template for both kinds of row: the tile, the name, the Container chips, the size (— on a codec, a weight on the Component row), the Status pill (Built-in / Installed / Default / Uploaded), and either the RemoveButton primitive or the 32px where it would sit
│ │ │ ├── ComponentDropZone/ ← the Component drop zone: a label over a clipped multiple file input, drag-over as the prototype's hover, the three faces read off zoneFace; it sorts nothing and labels nothing — the route tells the two binaries apart
│ │ │ ├── zoneFace/ ← pure: an Upload state → `{ title, line, refused }`, importView's precedent; the invitation's line is `null` because its `ffmpeg` is a Mono span the molecule composes
│ │ │ ├── codecView/ ← pure: the Format catalogue, `codecRows` (catalogue order, uncatalogued decoders absent), `componentRow` (the one row with a size and a source) and `codecSummary` (which counts formats, not the component)
│ │ │ ├── StorageSection/ ← the Storage card: the path in mono, the space line off formatBytes and the title count; no Change… until the Electron shell
│ │ │ ├── AboutSection/ ← the About card: the brand row, the App version in mono, the tagline; no Software update row; the last card, so no group gap
│ │ │ ├── useCapabilities/ ← the read on mount, plus the two writes that change it: `{ capabilities, upload, installComponent, removeComponent }`. Neither write rejects, and neither re-fetches — both routes echo the report after the write, and that echo is the redraw
│ │ │ ├── useStorageReport/ ← one fetch on mount, `null` until it lands and `null` still if it never does — nothing drawn while so
│ │ │ ├── useSettings/ ← the read half the same; `chooseSubtitleLanguage` flips the pill first and puts it back if the save refuses, never rejecting
│ │ │ └── api/ ← fetchCapabilities, installComponent, removeComponent (both rejecting with ComponentRefusedError carrying the route's own words), saveSubtitleLanguage, fetchStorageReport (one caller each)
│ │ └── collections/ ← playlists/collections (roadmap, not MVP)
│ ├── layouts/ ← page chrome
│ │ ├── chrome.styles.ts ← the furniture MainLayout and GenreLayout both extend
│ │ ├── MainLayout/ ← the Family's screens: logo, gear, scrolling body — and Back-to-top mounted over the body, because the body is where the scrolling happens, so the chrome is what knows how far it has gone; it lends the control the same ref `useRestoredScroll` attached, and holds no state for either
│ │ ├── GenreLayout/ ← Back pill, heading slot, trailing controls, scrolling body
│ │ └── MaintainerLayout/ ← the Maintainer surface: bg2 sheet + centred column, no header row
│ ├── pages/ ← route-level views, composition only, no logic (ImportPage is MaintainerLayout around ImportFlow; SeriesPage and SeasonPage own a scroll container and Back each, MoviePage’s precedent)
│ ├── api/ ← wire calls two or more features share (one folder per call + its test, no barrel)
│ │ ├── saveFavorite/ fetchMovie/ saveWatched/ dismissProblem/ fetchSettings/ saveSeriesFavorite/ saveEpisodeWatched/ ← the seven that earned it
│ │ └── postValue/
│ │ ├── postValue.ts
│ │ └── postValue.test.ts
│ ├── hooks/ ← global shared hooks only: `useGoBack(fallback)` — the one **Back rule**, a **History step** with the screen's own **Landing** behind it (the library by default) — `useRestoredScroll`, and `useOptimisticEdit`, the one bargain a detail page's edit keeps, over whatever record the page holds
│ ├── types/ ← shared TypeScript interfaces (import.ts: ImportRun, ImportProblem, ImportProblemDetail, ImportField; export.ts: EXPORT_FORMATS, EXPORT_COLUMNS, EXPORT_FILENAME, ExportSummary; settings.ts: SUBTITLE_LANGUAGES, SubtitleLanguage, DEFAULT_SUBTITLE_LANGUAGE, Settings, StorageReport; playback.ts: CodecKind, CodecSupport, CodecCapability, ComponentSource, PlaybackComponentInfo, PlaybackCapabilities — both build targets; series.ts: Series, Episode, SeasonSummary, SeriesDetail, EpisodeRead, NextEpisodeRef, EpisodeContinueEntry, SeriesHomePayload, NewSeries, NewEpisode, Playable — both build targets; viewModels.ts carries the series’ SeriesPageModel, SeasonPageModel, SeasonCardSeason and EpisodeRowEpisode beside the movie’s; appVersion.d.ts: `__APP_VERSION__`, defined by Vite from package.json)
│ ├── utils/ ← pure helper functions (one folder per helper + its test)
│ │ ├── index.ts ← barrel: re-exports every helper
│ │ ├── formatBytes/ ← 1024-based, one decimal from KB up: `18.4 GB`
│ │ ├── accentScale/ ← the accent → its five: `accentHover`, `accentPress`, `accentSoft`, `accentLine`, `focusRing`
│ │ ├── moviePath/ ← the film's page as a route, `/movie/<id>`, the id encoded: the cards open it, and it is the player's and the edit's **Landing**
│ │ ├── seriesPath/ seasonPath/ episodePlayPath/ ← the three series routes, `/series/<id>`, `/series/<id>/season/<n>`, `/episode/<id>/play`, the ids encoded
│ │ ├── formatEpisodeTag/ ← the client’s one spelling of the Episode tag: `S02E04`, `S02` or `E04`, two digits a side
│ │ └── gradientFromId/
│ │ ├── gradientFromId.ts
│ │ └── gradientFromId.test.ts
│ └── test-support/ ← test doubles shared across features, never imported by shipping code
│ ├── fakeResponse/ ← a Response by status; `fileResponse` the one whose caller reads `blob()`, its `json()` rejecting
│ ├── makeSeriesDetail/ ← a SeriesDetail by its seasons’ watch states, `makeMovie`’s rule; `makeSeries` and `makeEpisode` beside it
│ ├── comesBefore/ ← document order between two elements, for a slot's contract
│ ├── LocationProbe/ ← where the router is, in four spellings — `pathname`, `search`, `url` and `navigationType` (`POP` after a step, `PUSH` after a push) — with an optional Back of its own, and `navigationType()`, the reader of the fourth
│ ├── shippingSources/ ← the shipping-source walk the structural guards read: every `.ts`/`.tsx` under a root that is neither a test nor `test-support/`, matched with its comments stripped, by path
│ ├── snackbarStack/ ← the Snackbar stack's node, reached by what the prototype draws — the one fixed, reversed column — because it carries no role and no `data-testid`; throws when there is none
│ ├── stubScrollMetrics/ ← a writable `scrollTop` and a real overflow on every element, for a jsdom that does no layout
│ ├── resolvedStyle/ ← the cascade by hand for a named state jsdom cannot enter — hover, press, a click's focus, the keyboard's — `!important`, then specificity, then order; reads a combinator whose ancestors carry no state; `normCss` beside it
│ ├── stubScrollTo/ ← `scrollTo` on every element, for a jsdom that has it on `window` alone: who was asked for what, in order; deleted after the block
│ └── stubDownload/ ← object URLs and an anchor’s click() for a jsdom that has neither: what the page handed the browser to save, in order
└── docs/
├── design-logs/
├── PRDs/
├── refactor-plans/
├── handoff/ ← canonical design prototype (spec, screens, brand)
├── ubiquitous-language.md
└── dev-journal.md

## Layer Responsibilities

| Layer           | Purpose             | Rule                                                        |
| --------------- | ------------------- | ----------------------------------------------------------- |
| `tokens/`       | Design constants    | No React, no logic — pure values                            |
| `primitives/`   | Atomic UI elements  | No business logic, no data fetching                         |
| `components/`   | Composed UI blocks  | No business logic, composed from primitives                 |
| `features/`     | Domain UI + logic   | Owns its own components, hooks, and types                   |
| `layouts/`      | Page chrome         | Structure only, no domain logic                             |
| `pages/`        | Route views         | Composition only — no logic, no styling                     |
| `hooks/`        | Global hooks        | Only hooks used across 2+ features                          |
| `utils/`        | Pure helpers        | No side effects, fully testable                             |
| `api/`          | Shared wire calls   | Only calls made by 2+ features; imported by path, no barrel |
| `App/`          | Router + providers  | The shell pages render inside — no domain logic             |
| `test-support/` | Shared test doubles | Never imported by shipping code                             |

`api/` earns its narrowness from the same rule that created it: **no feature
should be importing another's wire.** A call moves up here only when a second
feature asks for it — `saveFavorite` did, because the browse shelf and the movie
detail page both save the same heart; `fetchMovie` did when the player needed
the record the detail page reads; and `saveWatched` did when the player began
marking a film watched at the finish threshold that the detail page's toggle
already set by hand; and `dismissProblem` did, because the Review step's Skip
and the Movie form's Skip this one both send the same `DELETE`; and
`fetchSettings` did, because the Settings hub's _Preferred language_ pill and
the player's `useSubtitles` both read the same household preference; and
`saveSeriesFavorite` did, because the Series tab's card and the series page
both save the same series heart; and `saveEpisodeWatched` did, because the
season page's box and the player's _Play now_ both mark the same episode. `saveRating`
has one caller and stays with the feature that makes it, and so does the
player's own `saveResume` — the player is the only thing in the app that can
know where a film is, which is the same rule read the other way round — and so
do `fetchProblem` and `resolveProblem`, whose one caller is the form. Any of
them moves if and when that changes. One folder per call with
its test, imported by path (`@/api/postValue/postValue`), following
`test-support/`'s precedent — a barrel over a handful of functions nobody
imports as a set would be ceremony.

**The key principle:** `primitives/` and `components/` are reusable and
know nothing about the domain. `features/` owns its own UI, hooks, and
types and knows everything about its domain. `pages/` just composes
features into a route.

## Architectural Boundaries

- `src/utils/` — pure logic and utility functions
- `server/src/` is organized by domain (`library/`, `media/`,
  `import-export/`, `playback/`), not by I/O-purity — each domain folder
  owns its full responsibility, data access and logic together. There is
  no generic `services/` or `lib/` catch-all; if new backend logic
  doesn't fit one of those, that's a sign a new domain folder is needed,
  not a reason to add a miscellaneous one. `playback/` is that rule
  exercised rather than quoted: resolving the Playback component,
  choosing a playback path, running a conversion and parsing subtitles
  into cues fitted none of the three that existed, so a fourth domain was
  added instead of a `services/`. Subtitle _detection_ stays in
  `media/`; subtitle _parsing_ exists to feed the player and lives here.
  The domain is injected into the router the way `storage` already is —
  `createApiRouter(storage, mediaPath, playback)` — so the route layer
  never learns there is an FFmpeg. That rule is about **backend logic**; test doubles are not
  backend logic, which is why `server/src/test-support/` exists beside
  `db/` as the mirror of the frontend's rung — same one-line rule
  ("never imported by shipping code"), same one-folder-per-unit shape,
  same absence of a category barrel
- `db/` holds the SQLite connection and schema/migrations — shared
  infrastructure, not a domain itself. A fresh database holds twelve
  genres and zero movies, so the browse home renders "Your library is
  empty" until something fills it. **A dev library is filled by the
  importer over its own fixture**: run the app, open Settings → Import
  from spreadsheet, type the sheet and root paths under
  `server/src/import-export/createImporter/fixture/` (`library.xlsx`
  or `library.csv`, and `root/`), and press Start import. A second run
  over the same sheet adds nothing, so re-running it is harmless. The
  dev seed that did this job before bulk import shipped is gone (#127);
  the ten-second MP4 it carried lives on as
  `server/src/test-support/fixtureVideo/`, the one real film the
  playback tests need
- `src/` never talks to SQLite directly
- `src/` never reads or writes the filesystem directly — all file
  access (folder scanning, copying video/subtitle/poster files) goes
  through `server/src/media/`

## Skills Location

All skills are in `.claude/skills/`. Read the relevant SKILL.md before
starting any task that matches its description.

## Desktop Build

FamilyFlix is an offline-first desktop app. This is the only target.

- **Shell:** Electron, wrapping the React frontend and bundling the
  Express server as a utility process
- **Storage:** SQLite via `better-sqlite3` — single-file database,
  no network, no cloud
- **Media storage:** on import, video/subtitle/poster files are copied
  into FamilyFlix's own managed media directory (inside the OS
  user-data directory). The app owns its copy; the original source
  folder is no longer the source of truth after import
- **No auth** — single-user household, single shared watch history,
  local-only
- **Packaging:** `electron-builder` for Windows installers; data and
  media live in the OS user-data directory so backups are trivial

## Movie Import — One Form, Manual Pickers

The Add Movie form is one screen at `/add` doing two jobs: it adds a
movie, and with `?movie=<id>` it edits one. Same fields, same encoding,
same save — only the heading, the button label and where a finished save
lands differ.

It collects title, year, director, cast (one comma-separated line),
description, genres (chips drawn from the **Genre pool**), a rating, and
three kinds of file: a video, a poster, and as many subtitle files as the
film has, each with its own language. **Title and video are the save
gate**; everything else is optional. `runtimeMinutes` is the one column
with no field — it is derived from the bytes after the copy, best-effort.

**The file fields are manual pickers, and only manual pickers.** There
are no mode tabs and no folder-path field. The reason is not preference:
a browser's `<input type="file">` yields a name and bytes and _never_ a
path, so a form running in Chromium cannot be given a folder to scan.
That is also why the app **copies** what it is given into the managed
media directory rather than referencing it where it lies — see
`docs/design-logs/11-add-movie.md`.

**Folder-path autofill belongs to bulk import**, which is where the
prototype actually designs it (`ImportFlow`'s root-path field) and where
its argument lives: a spreadsheet naming a thousand folders is the case
that needs a scanner, and Electron's native dialog is what can hand one
a real path. Do not build it into this form.

The save is one multipart request — `POST /api/movies` to add,
`PATCH /api/movies/:id` to amend — streamed with `busboy` so a 12 GB film
never sits in memory. On an edit, **a file the library already holds
travels as the relative path it already has, and only a freshly picked
file travels as bytes**, which is what makes a title-only edit carry no
file part at all.

## Bulk Import / Export

The existing library (Excel sheet + per-movie folders) gets migrated
once via a bulk importer:

- Reads the existing spreadsheet (name, year, genre, …)
- Matches each row to a folder (by movie name) and runs **folder-path
  autofill** over it — scanning that folder for a video, a poster and any
  subtitle files by extension (`.srt`, `.vtt`, `.ass`, `.sub` are all
  recognised), and filling the three kinds of slot the Add Movie form
  also has. This is the _only_ place autofill lives: it needs a real
  folder path, which a browser file picker cannot supply and Electron's
  native dialog can
- Imports each confident match **during the run** — reserve a Movie
  folder, copy the files in, add the movie — and shows the run in a
  progress console; the **Review step** at the end lists only what the
  run could not settle on its own, as **Problems** by kind (`no-folder`,
  `ambiguous`, `no-video`, `no-row`, `failed`, and the one soft kind,
  `missing-meta`), each with Resolve and Skip. Reviewing a thousand
  confident matches is a list nobody reads; Edit and Delete already
  exist for corrections — design log `13-bulk-import` Q16
- Consults nothing outside the spreadsheet and the folder: **no TMDB**,
  no network, `tmdbId` stays null. What a lookup would add is an
  **Enrichment** pass over an already-imported library — its own
  initiative with its own prototype (`feat.EnrichmentFlow`, build step 6),
  not part of bulk import. The one seam between them is Import setup's
  _Also fetch metadata and posters from TMDB_ checkbox, which hands Finish
  off to an Enrichment run over the library the import just built; the
  importer itself still reads nothing online
- Copies all matched media into managed storage as part of the run —
  `Media.copyIn`, a stream piped under the cancel signal rather than
  `fs.copyFile`, so a 12 GB copy can be stopped partway and the folder
  rolled back
- The domain is four units — `readSheet`, `titleKey`, `matchRows` and
  `createImporter` — not the five the design log sketched: the run's
  state machine lives as closures inside `createImporter` over the run,
  the sources map and the abort controller, because pulling it out would
  pass all three across a seam nobody else uses

The exporter writes the current library back out as one **Export file**,
CSV or Excel, from the Settings hub's third row: every movie A–Z under
the eight **Export columns** — Title, Year, Genres, Director, Cast,
Rating, Status, Subtitles — for backup or for bulk-editing externally and
re-importing. It is the reader's mirror: `writeSheet` in
`server/src/import-export/` behind `GET /api/export/:format`, with
`GET /api/export` answering the count the dialog shows. The round trip
holds in both formats and both directions — an untouched export fed back
to Bulk import adds nothing, and one with a row edited imports the edit —
which is why the reader learned to read a `Status` column as the watched
state when export shipped. No synopsis, runtime or path travels, and no
column is optional: the pills in the dialog are a list, not a picker.

Both bulk import and single Add Movie are large-file operations (video
files are big) — neither should block the UI. Both need a visible
progress indicator, not a spinner.

## Settings Hub

`/settings` is four **Settings groups** under one header — Library,
Playback, Storage, About — each a **Section card** on the feature's shared
`section.styles.ts` except Library, which draws rows. Every number on the
page is a read the app can truthfully answer now, over six routes and
nothing new injected:

- `GET /api/playback/capabilities` → `{ component, codecs }`, the **Codec
  report**, reached through `Playback.capabilities()` alone — a property
  of the **Component slot** `main.ts` composed, never a second resolution
  of it, so the report and pressing Play cannot disagree. The screen keeps
  the **Format catalogue**: a decoder the catalogue does not name is not a
  row.
- `POST /api/playback/component` → `200 PlaybackCapabilities`, the report
  **after the swap**: `multipart/form-data`, every file part named
  `component` and told apart by `componentBinary` — the client sorts
  nothing and labels nothing. `400` for a body that is not multipart, a
  stray part, a second of either or a missing half; `422` for a pair that
  will not run; `409` for the **In-use refusal**; `500` for a swap stopped
  by neither. And `DELETE /api/playback/component` → the report **after
  the fall-back**, the ✕ on the **Component row**: `404` when there is
  nothing uploaded to take back, `409` in the upload's own words, `500`
  the same. Both echo the whole report, so the screen redraws from the
  echo rather than reading again.
- `GET /api/settings` → `{ subtitleLanguage }` with the default applied,
  and `POST /api/settings/subtitle-language { value }` → `{ value }`, a
  **Single-signal write** on the favorite / watched / rating precedent;
  `400` for a missing, empty or non-string value. Membership in the
  **Language pool** is not checked — a vocabulary, not a constraint. The
  player's `useSubtitles` reads the same preference through the shared
  `fetchSettings` once per open.
- `GET /api/storage` → `{ mediaPath, bytesUsed, movieCount }`, the
  **Storage report**: the path resolved to absolute at request time, the
  walk read afresh on every visit, the count off the database.

Every read on the page is `null` until it lands and `null` still if it
never does, and nothing is drawn while so — no skeleton, no error face.
The two controls whose mechanism does not exist — _Change…_ (the Electron
shell) and _Software update_ (the Electron shell and the packaging) — are
not drawn, the rule that held the Export row back until its dialog
existed. The _Add a codec pack_ zone and the ✕ were the third; the
**Playback component upload** built their mechanism, so both are drawn
now.

The **Snackbar stack** ships first and empty: it is mounted in `App` above
the route table, and no screen in the app raises a **Snackbar notice**
today. Six logs refused a snackbar on their own merits — a refused rating
save, add, delete, a backgrounded import, export done, a refused language
save, a replaced component — and none was reopened to give the stack
work, because the prototype still draws none on any of those paths. The
first caller is the **Update offer snackbar** of the Software update flow.

## Watch Tracking

- Every movie has a watched / in-progress / unwatched state and a
  resume position (seconds into the file)
- The built-in player periodically reports playback position back to
  the database during playback, not just on close
- The browse grid visually distinguishes watched / in-progress /
  unwatched (e.g. progress bar or badge on the poster card)
- Single shared household profile — no per-person watch history

## Code Rules

- No `any` types — ever
- No business logic in components, primitives, or pages — extract to features or hooks
- All page components use default exports
- Every function in `src/utils/` must have a test
- No `console.log` in committed code
- All dates are ISO strings
- All file paths are stored as relative paths under the managed media
  directory, never absolute paths from the source machine
- Co-locate tests and styles with the file they belong to:
  `PosterCard.tsx` / `PosterCard.test.tsx` / `PosterCard.styles.ts`

## Ubiquitous Language

Single source of truth: `/docs/ubiquitous-language.md`
Read it before naming anything. Update it after every grill-me session.

## Data Model

Defined per feature through grill-me + write-a-prd.
Lives in `/docs/data-model.md` once established.

## Design Handoff — Built First

Unlike Horizon (where the design handoff came after features existed),
FamilyFlix starts with the Claude Design prototype. Before any feature
is built, three documents are handed to Claude Design together:
`README.md`, `CLAUDE.md`, and `docs/handoff/DESIGN_BRIEF.md`. The brief
is the product/UX spec — every screen, interaction, and visual
direction decision, resolved in advance via a grill-me session, so
Claude Design isn't inferring the product from engineering docs alone.
README.md and CLAUDE.md supply the engineering context: tech stack,
and — critically — the requirement that the prototype itself is built
using the same Atomic Design structure (`tokens/` → `primitives/` →
`components/` → `features/` → `layouts/` → `pages/`, see Atomic Design
above) that the real app will use. The prototype is not a flat set of
mockup screens; it's built the same way the production app will be
built, component by component, so it can be used directly as
implementation reference rather than redrawn into code later.

The resulting prototype lives in `docs/handoff/` and is the visual
source of truth for every subsequent `grill-me` and `build` cycle.
Implementation should match it, not invent a new look feature-by-
feature. If a feature needs something the prototype doesn't cover,
that's a sign the prototype needs revisiting before building, not a
license to improvise the design ad hoc.

## Local Tooling — never use `npx` (Windows)

This is a Windows machine. `npx <tool>` resolves through the `.cmd`
shim, which spawns `cmd.exe`, which allocates a **console window that
flashes on screen and steals mouse/keyboard focus**. During a `tdd` or
`build` run that is dozens of stolen focus events, which makes the
machine unusable while a skill runs unattended.

Measured: `npx prettier --version` spawns one `cmd.exe` plus an extra
`conhost.exe`; `node_modules/.bin/prettier --version` spawns neither.

Always call the binary directly instead:

| Instead of         | Run                              |
| ------------------ | -------------------------------- |
| `npx vitest run`   | `node_modules/.bin/vitest run`   |
| `npx tsc --noEmit` | `node_modules/.bin/tsc --noEmit` |
| `npx eslint src/`  | `node_modules/.bin/eslint src/`  |
| `npx prettier`     | `node_modules/.bin/prettier`     |
| `npx nx <target>`  | `node_modules/.bin/nx <target>`  |

The same rule applies to anything that spawns a tool on our behalf —
`.husky/pre-commit` calls `node_modules/.bin/lint-staged`, `.lintstagedrc`
calls `node node_modules/prettier/bin/prettier.cjs`, and
`.husky/commitTypecheck/run.ts` spawns `node` on
`node_modules/typescript/bin/tsc` with `shell: false`, all rather than a
bare command name and for exactly this reason. Don't "simplify" any of
them back.

## The commit gate

Two hooks, and the split between them is about _when the commit message
exists_:

- **`.husky/pre-commit`** runs `lint-staged`, which formats the staged
  files with Prettier.
- **`.husky/commit-msg`** runs the typecheck, because `pre-commit` fires
  before git has written the message — `COMMIT_EDITMSG` there still holds
  the _previous_ commit's.

The typecheck reads the subject and narrows on one type only. A `test:`
commit builds `tsconfig.app.json` and `tsconfig.server.json`; **every**
other commit builds the whole solution file. That is issue #111: a test
written against a module that does not exist yet cannot typecheck — which
is the entire point of the RED step — so RED commits used to be made with
`--no-verify`, which meant the one gate that would catch a real type error
in a test file was skipped on exactly the commits that add test files.
`npm run typecheck` was consequently red for six straight commits during
the player initiative before anybody noticed.

**Do not add `--no-verify` back to a RED commit.** It is no longer needed,
and it is the habit this gate exists to end.

The three tsconfig projects mean what their names say, and #111 is what
made that true: `app` is the frontend's shipping code, `server` the
backend's, and `spec` **all** the tests, frontend and backend both. Before
that, `tsconfig.server.json` included `server/**/*.ts` tests and all, so
there was no way to ask whether the backend's shipping code compiled
without also asking about its tests.

The decision itself is `.husky/commitTypecheck/`, a unit with its own
tests — most of them about what must _not_ relax the gate, since it
relaxes on the strength of a string the committer wrote.

### The other two focus stealers (measured 2026-08-12)

Calling the binaries directly is necessary but **not sufficient**. A full
`vitest run` spawns 43 `node` worker processes and zero console windows,
so the rule above is working — yet windows still flashed during every
`build` run, from two sources that have nothing to do with `npx`:

1. **Windows' default console host.** `HKCU\Console\%%Startup` was unset,
   which on Windows 11 means "Let Windows decide" → **Windows Terminal**.
   Any console program launched by a window-less GUI parent — VS Code's
   extension host, which is where the Claude Code panel and the built-in
   Git extension both live — then gets a real Windows Terminal window that
   opens, takes focus, and closes. Conhost honours the "create hidden"
   request; Windows Terminal does not. Both `DelegationConsole` and
   `DelegationTerminal` are now pinned to the conhost GUID
   `{B23D10C0-E52E-411E-9D5B-C09FDF709C7D}` (Settings → System → For
   developers → Terminal → "Windows Console Host"). Every command Claude
   Code runs was one flash before this.
2. **The Nx daemon.** It watches the workspace and spawns visible
   `cmd.exe` children on file change, which conhost cannot hide because the
   parent asks for a window. `useDaemonProcess: false` in `nx.json` turns
   it off. We call `vitest`/`tsc`/`eslint` directly anyway, so the daemon
   was only ever caching a project graph we barely query.

Measured after both: **zero** visible windows across 45 seconds of source
edits, a 459-test run, `eslint`, and `tsc`. If flashing ever returns,
watch for new _visible_ windows (`MainWindowHandle -ne 0`) rather than for
new processes — most console spawns are legitimately invisible, and only
the visible ones steal focus.

## Development Workflow

0. `ui-design-handoff` → hand README.md + CLAUDE.md + docs/handoff/DESIGN_BRIEF.md to Claude Design; build the full prototype first, using the same Atomic Design structure as the real app; populates `docs/handoff/`, used as the reference for every feature below
1. `grill-me` → shared understanding + design-log entry + ubiquitous-language update
2. `write-a-prd` → reads design-log → GitHub issue + docs/PRDs/
3. `prd-to-plan` → phased plan on issue
4. `prd-to-issues` → individual issues
5. `tdd` → failing tests (stops at RED)
6. `build` → implement against the `docs/handoff/` prototype
   — `issue-loop` drives 5–6 across every buildable slice unattended, one
   subagent per step, and stops at the first HITL or docs-only issue
7. `request-refactor-plan` → create issue
8. `refactor` → clean up

## Commit Messages

```
<type>: [<initiative>] issue #<n> <description>
```

`<initiative>` is the PRD/feature initiative name (e.g. `movie-form`,
`import-export`) — not the issue title.

Examples:

```
feat: [movie-form] issue #99 the genre pool
fix: [player] issue #7 correct subtitle track offset
refactor: [library] issue #9 extract genre-row hook
```

Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`

**Keep the `<description>` short enough to fit on one line.** Long
descriptions get wrapped or mangled in commit history (this happened
during Horizon). If the description doesn't fit in roughly 60
characters, the issue is too broad — split it into smaller issues
rather than writing a longer commit message.

**Never write a closing keyword in a commit body for an issue the
commit does not close.** GitHub parses `close`, `closes`, `closed`,
`fix`, `fixes`, `fixed`, `resolve`, `resolves` and `resolved` followed
by `#n` anywhere in the message — including with a colon between them,
and including inside a sentence that is saying the opposite. Commit
`0c51aaf`'s body read "Follow-ups filed rather than **fixed: #39**",
and GitHub closed #39 on the spot with nothing shipped against it. #40
survived only because it came after an "and". When listing follow-ups,
write the bare number or the URL: "follow-ups filed as 39 and 40".

## Environment Variables

PORT=3001
VITE_API_BASE_URL=http://localhost:3001
FAMILYFLIX_DB_PATH= # entrypoint reads it and passes the path to createSqliteStorage; defaults to ./familyflix.db. Electron main sets this to app.getPath('userData')/familyflix.db.
FAMILYFLIX_MEDIA_PATH= # root directory for copied video/subtitle/poster files; defaults to ./media. Electron main sets this to app.getPath('userData')/media.
FAMILYFLIX_FFMPEG_PATH= # absolute path to the ffmpeg binary of the Playback component; ffprobe is looked for beside it. Unset falls back to `ffmpeg`/`ffprobe` on PATH, and then to absent — a state, not an error: MP4s still direct-play and everything else answers `cannot-play`. The slot the installer fills and the maintainer's uploaded component replaces.
FAMILYFLIX_COMPONENT_PATH= # the Component slot: the writable directory an uploaded Playback component lives in (`current/`, with `incoming/` and `previous/` swept on startup); defaults to ./playback-component. Read ahead of FAMILYFLIX_FFMPEG_PATH and ahead of PATH, so an uploaded pair is what the next Play converts with. Electron main will set it to app.getPath('userData')/playback-component.
DEBUG_SQL= # set to "1" to enable better-sqlite3 query tracing via console.info. Off by default; never on in packaged builds.

## The prototype is the spec

For every feature below, the canonical design prototype in `docs/handoff/` is the goal.
The implementation target is a **1:1 translation** of that prototype into our codebase —
same layout, spacing, states, copy, and interaction.

- **1:1 means the UI surface, not the fake behavior.** The prototype simulates the backend
  (sample data, fake folder scans, `setTimeout` "installing", canned update checks).
  Reproduce the _surface_ exactly — every pixel, token, state, and transition — then wire
  the behavior to the real Express + SQLite layer. Never port the simulation itself.
- The prototype is the source of truth for _what the UI is_. Do not redesign, "improve," or
  reinterpret it while building. If something seems wrong, raise it in the grill-me session
  and amend the prototype first, then build to the amended prototype.
- Each prototype file maps 1:1 to a component (see `docs/handoff/COMPONENT-SPEC.md`):
  `prim.*` → `primitives/`, `mol.*` → `components/`, `feat.*` → `features/`,
  `page.*` → `pages/`. The component's `data-props` is its prop interface; the inline
  `var(--token)` values become styled-components reading the theme.
- Fidelity over convenience: match the prototype's pixels, tokens, and states first, then
  layer the real data behind the same surface.

## Features

> Status legend: ✅ Done · 🔜 Planned · 🧭 Roadmap · 🚫 Out of scope
> Every 🔜 item builds against its prototype in `docs/handoff/` — translate, don't redesign.

**Build order — the four that are left.** The groups below say what the app
_is_; this says what to build _next_, and it is a chain rather than a
preference. Each 🔜 entry carries its step number; steps 1–5, the
**Snackbar system**, the **Back-to-top FAB**, **Back navigation**,
**Motion & interaction states** and **Series (TV)**, are done — step 3 was found by the prototype audit of 2026-09-21 and went ahead
of the shell, because it was the app's own seams rather than anything
Electron adds. Steps 4–6 arrived
with the prototype revision of 2026-09-22 (`docs/handoff/` — three new
components, two new pages, one new organism, and a motion contract) and
go ahead of the shell for the same reason: none of the three needs anything
Electron adds, and each is built against a prototype that already exists.
The shell, the packaging and the update moved down three numbers and keep
their gates.

6. **Enrichment (TMDB)** _(next)_ — the one feature that goes online: a Network
   group in Settings, and a sync run that fills what the sheet left blank.
   Needs nothing of Electron; goes after Series so it enriches series too.
7. **Electron desktop shell** — unblocks everything after it. `Change…` in the
   Storage group and folder-path autofill in the **Movie form** are both
   waiting on this one, and both stay undrawn until it lands.
8. **Desktop packaging** — needs 7; produces the installer that 9 publishes.
9. **Software update** — needs 7 and 8 (and 1, which is done). Designed in
   full already (`docs/design-logs/17-software-update.md`); its PRD waits
   on 7.

A 🧭 Roadmap item is not in this chain — it is after all four, if ever.

### Foundation

- ✅ **Nx + Vite + React workspace scaffold** — monorepo, tooling, lint/format.
- ✅ **Claude design handoff prototype** — full interactive design system, the build spec.
- ✅ **Library core** — movie model, SQLite schema, repository layer.
- 🔜 **Electron desktop shell** _(step 7)_ — main process, window, file-system access. The gate every remaining Maintainer control sits behind.

### Browse & discover (parent-facing)

- ✅ **Browse grid** — genre rows of poster cards on the home library screen.
- ✅ **Card carousel** — horizontal rows with prev/next arrows; capped at 15 cards, "View all" → genre page. Both variants ship: poster rows with the browse grid, `continue` with the Continue Watching row.
- ✅ **Movie detail page** — backdrop, poster, expandable synopsis, director + cast, primary actions.
- ✅ **Search + filter** — by title, genre, and rating.
- ✅ **Genre page** — every movie in one genre under its own header, uncapped; where "View all" lands, carrying the sort.
- ✅ **Sort** — recently added, A–Z, year, highest rated, unwatched first.
- ✅ **Ratings** — 5-star display with a half-star picker.
- ✅ **Favorites** — mark from card and detail; dedicated Favorites row.
- ✅ **Continue Watching row** — resume in-progress titles from the home screen, ordered by when the family last watched them.
- ✅ **Series (TV)** — a separate top-level tab, not mixed into the movie rows: a segmented Movies / Series control in the library header; the Series tab is a Continue Watching row of **episode** cards — one per series, on its earliest part-watched episode (log 22 Q29) — over an "All series" grid on the same `LibraryGrid` + `PosterCard`. The **Series page** (`page.SeriesPage`) is the movie page's hero shape — poster, year range, season and episode count, rating, genres, synopsis, creator and cast — over a Seasons grid of `SeasonCard` (a 2:3 tile: StatusBadge when the season is fully watched, ProgressBar when partly; its line reads "8 episodes" or "3 of 8 watched"). A season poster opens the **Season page** (`page.SeasonPage`): the series → season header, _Resume Enn_, Mark season watched, one `EpisodeRow` per episode — a 16:9 thumbnail with a hover play affordance and a resume bar, `S02E04` and the title, the air date, the resume label, and a watched checkbox that stops propagation (the row opens the episode, the box only marks it) — and an "Other seasons" pill row. No synopsis, runtime or filename on a row; no tabs or accordion for seasons. Resume on the series and Continue Watching both follow `nextEpisodeOf`: the part-watched episode, else the first unwatched. In SQLite this is two tables and two joins — `series`, `episodes` (carrying the same watch-state columns the movie table has), `series_genres` and `episode_subtitles` — and no `seasons` table: a season is a number (log 22 Q3). Everything is additive; the movie flow is untouched. Spec §5aa.

### Playback

- ✅ **Built-in video player** — local playback, subtitle tracks, transport controls.
- ✅ **Watch tracking** — watched / in-progress / unwatched states and resume position.
- ✅ **Episode playback** — the player unchanged for movies; for an episode the title reads `Show · S02E04 · Episode title`, and an **Up next** card appears in the last 15 s with a countdown, Play now and Cancel — auto-play next is the player's only addition. No skip-intro, no in-player episode list.

### Maintainer tools

- ✅ **Add a movie** — manual file picker (video, poster, multiple subtitles with language).
- ✅ **Edit a movie** — amend metadata and files; a file the library already holds travels as its path, only a freshly picked one as bytes.
- ✅ **Delete a movie** — the ⋯ menu’s Danger row, the Delete dialog, `DELETE /api/movies/:id`, then the Movie folder under best-effort cleanup.
- ✅ **Bulk import** — a Sheet and a Library root become Movies during the run; the Review step lists only the Problems the run could not settle, each with Resolve (the Movie form in Import context) and Skip.
- ✅ **Import progress console** — the Connect ✓ → Scan → Import stepper, the bar, the current item, elapsed and ETA, the Activity log, and Cancel; a server run polled every 500 ms, re-attachable.
- ✅ **Export** — the Settings hub’s third row opens the Export dialog; `family-library.csv` or `.xlsx` lands in Downloads with every movie A–Z under the eight Export columns, and an untouched export fed back to Bulk import adds nothing.
- ✅ **Series import** — the Library root may hold shows beside movies: `Show Name/Season 01/S01E03.mkv`, or loose episodes at the show root. Season and episode numbers come from the folder first, then the filename (`S01E03`, `1x03`); anything unparsed lands in the existing Review list. The accepted shapes are shown verbatim in Import setup.
- 🔜 **Enrichment (TMDB)** _(step 6 — next)_ — the first and only feature that touches the network; everything else stays offline-first. One organism, `EnrichmentFlow` (`features/enrichment/`), mirroring ImportFlow's three steps so the two read as siblings: **setup** (the key and offline banners, three scope cards — _Only what's missing_ / _Everything_ / _Just this movie_ — the field chips, and the write-target list; Start is `secondary` and inert until the key is tested and the machine is online), **running** (a determinate bar, because the count is known up front; LogConsole; elapsed and ETA; _Stop_ keeps what was already fetched), and **review** (two stat tiles over the rows that need a human: `ambiguous` with a horizontal poster picker of candidates and their % match, `conflict` as a field-by-field _Yours | TMDB_ diff with per-field choice then _Apply choices_ / _Keep all mine_, `missing` with a manual search box; every row has Skip). Three ways in: Settings → Network → _Sync metadata & posters_ (the primary), the Import setup's _Also fetch metadata and posters from TMDB_ checkbox (Finish hands the review straight to a full-library run), and the movie page's ⋯ menu → _Fetch from TMDB_ (a single-title run that returns to the movie). Fields: synopsis, poster, backdrop, runtime, year, genres, director, cast, original title, TMDB score. **The household rating is untouched** — TMDB's score is a separate field beside it. Conflicts are asked per movie in the review, never silently overwritten. The run is a pass over the already-imported library keyed by title + year, not a second scanner — `walkLibraryRoot` / `scanMovieFolder` are untouched, and `tmdbId` finally gets a value. The library database is the source of truth, and optionally a `familyflix-metadata.csv` in the collection root and a `poster.jpg` in each movie folder, each toggleable and neither overwriting a file that exists — the only place the app writes back into the source folders, so it needs its own permission check and a dry-run log line. Spec §5a.

### Settings hub

- ✅ **Settings shell** — the Library, Playback, Storage and About groups on one page, each a Section card on the shared furniture.
- ✅ **Codec manager — view installed codecs** — the Codec report off the component the player uses: one row per catalogued format, Built-in or Installed.
- ✅ **Codec manager — add a playback component** — the Component drop zone under the rows and the ✕ on the Component row: a pair dropped is staged, verified and sworn into the Component slot, and the next press of Play converts with it.
- ✅ **Subtitle preferences** — the household's Preferred subtitle language, kept in the library's database and honoured by the player; the Auto-on toggle built but disabled until shipped.
- ✅ **Storage** — the managed media folder's location and space used, agreeing with Explorer; _Change…_ is the Electron shell's.
- 🔜 **Network group** _(part of step 6)_ — a fifth Settings group between Playback and Storage, the one place FamilyFlix goes online: _The Movie Database (TMDB)_ with a status pill, the lede ("Nothing is sent about your household — just movie titles, to look up posters and synopses"), the API-key field in mono with _Test connection_ beside it, and the _Sync metadata & posters_ row that opens the Enrichment flow.
- 🔜 **Software update** _(step 9)_ — the About card's first row: an Update offer downloaded at launch, Update now, and Check for updates. Needs steps 1, 7 and 8; designed in `17-software-update`.

### System

- ✅ **Snackbar system** — info / success / warning / error notices in the bottom-right Snackbar stack; an actionable one persists, a confirmation dies at 5s. Ships with no caller: the first is the Software update flow's Update offer.
- ✅ **Back-to-top FAB** — the accent circle in the home screen's bottom-right corner once the body is past 420px, riding it back to the top on a press; mounted by the chrome over the body it already owns, and gone again under the line.
- ✅ **Back navigation** — one **Back rule** on every screen: `useGoBack(fallback)`, a **History step**, or the screen's own **Landing** pushed when there is nothing behind it — the player's is its movie, Import's is Settings, the **Movie form**'s is where its job came from. Every **Leaving** is a step except the two **Fresh homes**, _Add to library_ and Import's _Finish_; Play → Back → Back reaches the library, the shelf comes back filtered and scrolled, and a Delete after a Play lands on the library.
- ✅ **Motion & interaction states** — the prototype's **Interaction contract** (`COMPONENT-SPEC.md` §2a) over every built control and card, in two disjoint vocabularies: a **Control** (Button, Chip, IconButton and every extension, the Filter dropdown's trigger) signals with colour, a **Card** (PosterCard, ContinueCard) with elevation. `tokens/motion.ts` is the one file that spells `durFast`, `durBase`, `durSlow` and `easeOut`; the **Accent scale** is derived from the one accent by `createTheme(accent)`, never aliased; `styles/interactionStates/` holds `controlStates(press)` — the **Press** at doubled rank in 60ms, so every `IconButton` extension inherits it — and `cardLift` and `cardFocus`, with a structural guard against any other file spelling a duration, the curve or a press; one **Reduced motion** block in `GlobalStyle`. `SeasonCard` and `EpisodeRow` are born on the card fragments in step 5.
- 🔜 **Desktop packaging** _(step 8)_ — Windows installer build via electron-builder; needs step 7.

### Roadmap

- 🧭 **Collections / playlists** — user-curated groupings.
- 🧭 **Auto-on subtitles** — enable the built, currently-disabled toggle.
- 🧭 **Backgroundable import** — leave the Import screen while a large scan runs, surfaced via snackbar.

### Out of scope

- 🚫 **User accounts / multi-profile** — FamilyFlix is offline, local-only, single shared library.
