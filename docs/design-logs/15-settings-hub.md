# 15 — Settings hub

> **Initiative:** `settings-hub`
> **PRD:** [#142](https://github.com/carlos-rezai/FamilyFlix/issues/142) · `docs/PRDs/15-settings-hub.md`
> **Plan:** to follow the PRD

This log is the `grill-me` session that settled the feature before the PRD was
written, run against the prototype and the code as they stood on 2026-09-18. It
is an immutable snapshot of that moment. The session ran with every
recommendation accepted in advance by the maintainer, whose one instruction was
the scope: _translate the prototype 1:1 into the codebase, in its naming,
conventions, patterns and architecture_.

## Background

The Settings hub is half built. `pages/SettingsPage` composes `SettingsHeader`
and `LibrarySection` on `MaintainerLayout` at the prototype's 780px measure;
the header shipped with the movie form (log 11) because a tracer bullet has to
be the real path, the Library group's three rows shipped with bulk import and
export (logs 13, 14). Both files say the rest is "the settings-shell
initiative's". This is it.

The prototype is `docs/handoff/page.SettingsPage.dc.html`, with
`feat.CodecManager.dc.html` and `prim.Toggle.dc.html` under it, mapped by
COMPONENT-SPEC §5–6 to `features/settings/CodecManager`, `primitives/Toggle`
and a `pages/SettingsPage` of four groups — **Library** (done), **Playback**
(`CodecManager` + the default-subtitle `FilterDropdown`), **Storage** (media
folder, space) and **About**. The container's model (`FamilyFlix.dc.html`,
`settingsModel`) shows what each group draws:

- **Playback** — one card. _Codecs_ with its two-line description, then
  `feat.CodecManager`: a summary line (`6 formats enabled · 3 added by you`),
  one row per codec (a microchip glyph in a tile, the name, container chips in
  mono, a size, a _Built-in_ / _Installed_ pill, a ✕ on installed rows and a
  32px spacer on built-in ones), and a dashed _Add a codec pack_ zone whose
  copy log 10 already amended to "Drop a playback component (ffmpeg) here, or
  browse". A rule, then _Subtitles_: _Turn on automatically_ with a **Coming
  soon** pill and a `prim.Toggle` drawn `disabled`, a rule, and _Preferred
  language_ with a `mol.FilterDropdown` over `English · Spanish · French ·
German`.
- **Storage** — one card. _Managed media folder_ over its path in mono, a
  _Change…_ button, and `18.4 GB` **of movies · 12 titles**.
- **About** — one card, two rows: _Software update_ in three states (offered /
  updating / idle, each with its own button), a rule, then **Family**Flix, the
  version in mono, and _Offline · local-only · no account_.

Every number in the model is sample data: `uploadCodec()` appends a canned
row, `mediaFolder` is a string literal, `spaceUsed` is `'18.4 GB'`,
`runUpdate` is a `setTimeout`. CLAUDE.md's rule is to reproduce the surface
and never the simulation.

What exists to build on:

- `server/src/playback/capabilities/`: log 10 Q5's **truthful probed report**
  — Chromium's native set ∪ what `ffmpeg -decoders` prints — built there
  "because the mechanism belongs with the rest of the format policy, and the
  Settings initiative is what will consume it" (its own test header). No route
  reads it yet. It resolves the binary from an `env` argument, a design from
  before the `PlaybackComponent` seam existed.
- `features/player/preferredSubtitle/`: the pure choice of a **Subtitle
  track**, taking an optional `language` that "has no source yet — the
  Settings default-language dropdown is a later initiative". Every call omits
  it.
- The **Language pool**, spelled twice: `MovieFormFiles`' `LANGUAGES` and
  `detectSubtitleLanguage`'s `LANGUAGE_TAGS`, both seven names with `English`
  the default.
- `components/FilterDropdown/` on `Menu`, `components/Modal/`, and the
  `postValue` **Single-signal write** with `isEcho` per route.
- `features/settings/`: `SettingsHeader`, `LibrarySection` (holding the
  `GroupHeading` and `Rows` styles the next three groups also need),
  `ActionRow`. `features/maintainer.styles.ts` for the header furniture.
- `storage.countMovies()`, already the **Export summary**'s number; the
  router's `mediaPath` argument; `busboy` for a later upload.
- Nothing under `electron/`: the shell is 🔜 and unbuilt, so there is no
  native dialog, no updater and no `app.getVersion()`.

## Problem

A page whose three remaining groups mix things the app can answer today (which
codecs decode, which folder holds the media, how many bytes, which version)
with things only a desktop shell can (a folder picker, an updater) and one
thing the prototype simulates outright (uploading a codec). The questions are
which of those this initiative is, where the truthful numbers come from,
where a household preference lives and how the player learns it, and what a
row looks like when the mechanism behind it — one Playback component rather
than many packs — has no per-row size and no per-row remove.

## Questions and Answers

1. **What is `settings-hub`?** ✅ The three groups the hub still lacks —
   **Playback**, **Storage**, **About** — each drawn 1:1 and wired to what the
   app can truthfully answer now: the codec report, the subtitle preference
   (stored, and honoured by the player), the folder and its size, the version.
   Three controls are **not drawn**, on log 13 Q2's rule that a row whose
   destination does not exist is not drawn: the _Add a codec pack_ zone (its
   own initiative, the **Playback component upload**, Q9), _Change…_ (Q19) and
   the _Software update_ row (Q21). Each lands in the same card, under the
   same heading, when its mechanism does. ❌ The whole page including upload
   and update: upload is a slice the size of Delete or Export with states the
   prototype does not draw, and update cannot exist without Electron.

2. **Name and log?** ✅ Initiative **`settings-hub`**, log `15-settings-hub.md`.
   "Settings shell" is the feature table's row; the hub is what the glossary
   already calls the screen.

3. **Where do the Codecs rows come from?** ✅ **`capabilities`** — the report
   log 10 built for exactly this — behind a new **`GET
/api/playback/capabilities`** → `PlaybackCapabilities { component, codecs }`,
   each codec `{ codec, kind: 'video' | 'audio', support: 'native' |
'via-component' }`. Its types move to `src/types/playback.ts` beside
   `PlaybackRead`, since both build targets now read them. ❌ A hand-kept list
   of formats: log 10's whole point was that the CodecManager stops being a
   fiction.

4. **How does the route reach it without learning there is an FFmpeg?** ✅
   **`capabilities` moves behind the component seam.** `PlaybackComponent`
   gains `decoders(): string | null` — what `ffmpeg -decoders` printed, or
   `null` for every way of not knowing, the raw listing the way `probe` hands
   over raw output; `capabilities(component: PlaybackComponent | null)` is the
   native rows on their own for `null` and native ∪ the parsed listing
   otherwise; `Playback` gains `capabilities(): PlaybackCapabilities` and the
   route calls that. `ffmpegComponent`'s injected listing becomes a pair
   (`encoders`, `decoders`), one seam for both spawns. ❌ `capabilities(process.env)`
   in the route, or a thunk handed to `createPlayback`: a second resolution of
   the slot beside the one `main.ts` already made, correct today only because
   nothing changes the env, and wrong the day the upload initiative makes the
   live component replaceable — the report must describe the component the
   player actually uses. This is the one change to shipped playback code, and
   it is what the next initiative needs.

5. **`ffmpeg -decoders` names some four hundred decoders; the prototype draws
   six rows.** ✅ A **Format catalogue**: the codecs a family folder is made
   of, each with the prototype's display name and the container chips it
   arrives in — `h264` → _H.264 / AVC_ `.mp4 .mov .m4v`, `hevc` → _H.265 /
   HEVC_ `.mkv .mp4`, `vp8`, `vp9`, `av1`, `mpeg4` → _MPEG-4 / XviD_ `.avi
.mkv`, `mpeg2video`, `vc1` → _Windows Media Video_ `.wmv`, `prores`,
   `theora`; then `aac` → _AAC Audio_, `mp3`, `opus`, `vorbis`, `flac`, `ac3`
   → _AC-3 / Dolby Digital_ `.mkv .avi`, `eac3`, `dts` → _DTS Audio_,
   `truehd`. It lives in a pure **`codecView`** (`features/settings/codecView/`,
   the `importView` precedent): `codecRows(capabilities)` is the catalogued
   codecs the report contains, in catalogue order, and `codecSummary` the
   line above them. Uncatalogued decoders (`pcm_s16le`, `bmp`) are not rows;
   a catalogued codec nothing decodes is not a row either — `capabilities`'
   own rule, "the absence of a row is the honest way to say so". The chips are
   display, nothing decides playability from them. ❌ Filtering on the server:
   the wire stays the raw truthful report the glossary defines, and a display
   vocabulary belongs with the screen that draws it, as the Language pool does.
   ❌ Four hundred rows.

6. **The status pill?** ✅ `native` → **Built-in**, `via-component` →
   **Installed** — the prototype's two labels and its two colourings (faint on
   `surface3`; the watched green on its own tint). "Installed" is true of a
   component the installer bundled and of one the maintainer uploads alike.

7. **The per-row size and the per-row ✕.** ✅ **A codec has no size and cannot
   be removed on its own.** The mechanism log 10 settled has one pack — the
   **Playback component** — and every via-component row comes and goes with
   it. So: the size cell reads `—` on every row (the prototype's own built-in
   cell), and the ✕ is drawn on no row — the prototype's 32px spacer, which it
   already draws on built-in rows, takes its place on all of them, so nothing
   moves. Log 10 said "rows, ext chips, status pills, remove button and
   geometry stay 1:1"; geometry does, and the remove button is deferred rather
   than contradicted: it is the inverse of an upload that does not exist yet,
   and returns with the upload initiative as the _component's_ remove, in
   whatever geometry that session amends the prototype to. ❌ A ✕ on each
   via-component row that removes the whole component: a maintainer pressing
   ✕ on _DTS_ and losing _HEVC_ is a trap. ❌ Showing the component's size on
   every via-component row: six rows saying `94 MB` reads as six times
   `94 MB`. ❌ Dropping the size cell: a geometry amendment this session need
   not make.

8. **The summary line says "added by you".** ✅ A **copy amendment**, log 10
   amendment 1's sibling, geometry unchanged: `N formats enabled · M from the
playback component`, and with no component at all `N formats enabled · no
playback component`. "Added by you" is false of the bundled build my parents
   will have, and the prototype draws no component-less state.

9. **The dashed drop zone?** ✅ **Not drawn** — the **Playback component
   upload** is its own initiative: a writable slot under user-data ahead of
   the installer's in the resolution order, a component that can be swapped
   while the app runs, a two-file upload (ffmpeg and ffprobe ship together, and
   `ffmpegBinary` resolves them together) validated by running it, and the
   drop-zone states — busy, refused, replaced — the prototype does not draw
   and a grill has to design. The _Codecs_ description keeps the prototype's
   second sentence ("add a pack only if a movie won't play"): the zone lands
   directly under it. Recorded as an accepted interim, like the `⬇ Export to
CSV` row that was not drawn until its dialog existed.

10. **The row's glyph?** ✅ A new **`MicrochipIcon`** in `primitives/Icon/` —
    the prototype's rect-and-pins path at stroke 1.6, `currentColor`, 20px in
    the row's tile. The `DownloadIcon` precedent (log 14 Q12).

11. **_Turn on automatically_.** ✅ A new **`Toggle`** primitive per
    COMPONENT-SPEC — `{ checked, disabled?, onToggle, label }`, `role="switch"`,
    `aria-checked`, `aria-disabled` rather than the `disabled` attribute (the
    prototype's choice: it stays in the tab order and announces itself), 46×26
    on a 3px pad, the knob sliding and the track filling accent at `.18s`,
    opacity `.45` and `not-allowed` when disabled. Drawn `checked={false}`
    `disabled` beside the **Coming soon** pill, and it stores nothing: log 10
    Q7 made auto-on subtitles 🧭 roadmap, and this row is the disabled toggle
    that decision named. `label` is the accessible name the prototype's bare
    `<button>` lacks. ❌ Skipping the primitive because it never toggles: the
    prototype draws it, the roadmap flips it on, and a switch with no knob is
    not the surface.

12. **_Preferred language_ — which options?** ✅ **The Language pool**: the
    seven names the **Subtitle row** offers, promoted to `src/types/settings.ts`
    as `SUBTITLE_LANGUAGES as const` with `DEFAULT_SUBTITLE_LANGUAGE =
'English'`, on the `MOVIE_SORTS` precedent — `MovieFormFiles` and
    `detectSubtitleLanguage` read it instead of each spelling its own. Drawn as
    a `FilterDropdown` with `label="Preferred language"` off screen
    (`showLabel={false}`), `menuWidth` 200. ❌ The prototype's four: sample
    data, a subset of the pool the form already offers. ❌ Languages derived
    from the library's subtitle rows: a preference is for the track that
    arrives next week too, and an empty library would have nothing to prefer.

13. **Where does the preference live?** ✅ **SQLite** — a `settings` table
    (`key TEXT PRIMARY KEY, value TEXT NOT NULL`), migration 3, on `Storage` in
    `library/`: `settings(): Settings` with the default applied, and
    `setSubtitleLanguage(language)`. `library/` is the one SQLite door, and a
    household preference about the library's own subtitles is the library's.
    ❌ `localStorage`, the volume precedent: volume is a device's; this is the
    household's, it must survive a cleared profile, and it must travel with the
    backup CLAUDE.md promises ("data and media live in the OS user-data
    directory"). ❌ A `settings/` domain folder on the server: two methods over
    one table is not a domain, and a second SQLite connection would be worse
    than a fifth row on the first.

14. **Wire?** ✅ Two calls:
    - `GET /api/settings` → `Settings { subtitleLanguage: string }` — the
      default already applied, so no client learns it.
    - `POST /api/settings/subtitle-language { value }` → `{ value }` — a
      **Single-signal write** through `postValue`, on the favorite / watched /
      rating precedent, one route per setting so the roadmap's auto-on adds a
      sibling rather than a shape; `400` for anything but a non-empty string.
      The pool is a display vocabulary, not a constraint (a **Subtitle**'s
      language "is stored as the chosen text"), so the route does not check
      membership.

    `fetchSettings` goes to `src/api/fetchSettings/` — two callers, the hub and
    the player (Q16); `saveSubtitleLanguage` stays in `features/settings/api/`.

15. **What happens on screen when a language is chosen?** ✅ The detail page's
    bargain: the pill shows the choice at once, the route's echo is taken over
    what was assumed, and a refusal puts the previous value back. Two lines
    inside **`useSettings`** rather than `useOptimisticEdit`, which edits a
    movie. No snackbar — that system is its own initiative and the prototype
    draws none here.

16. **Does the player honour it?** ✅ **Yes.** `useSubtitles` fetches the
    settings when the screen opens and hands `subtitleLanguage` to
    `preferredSubtitle(subtitles, language)` — the slot log 10 Q8 left, whose
    fallback "only reads as a fallback if there is something to fall back
    from". Until the settings land, track order, as today. This is what makes
    the **Subtitle preferences** row ✅ rather than a dropdown that changes
    nothing.

17. **Storage — where do the folder and the number come from?** ✅ **`GET
/api/storage`** → `StorageReport { mediaPath, bytesUsed, movieCount }`:
    `resolve(mediaPath)` (the prototype shows an absolute path and `./media`
    is not one), **`spaceUsed(root)`** in `server/src/media/spaceUsed/` — a
    walk summing every file's size, `0` for a root that does not exist yet,
    never throwing — and `storage.countMovies()`. A **Stranded folder** (log 12) counts in the bytes and not in the titles, which is the truth and is
    the "first place it would surface" the glossary predicted. ❌ A method on
    `createMedia`: every test double would grow a member nobody asks; the
    route composes three reads, which is what a route is for.

18. **How is the number written?** ✅ **`formatBytes`** in
    `src/utils/formatBytes/`, pure and tested: 1024-based, one decimal, `B ·
KB · MB · GB · TB` — Windows Explorer's arithmetic, so the card agrees with
    the folder's own Properties dialog. `0 B` for an empty directory. The
    count reads `N titles`, singular `1 title` (the `1 movie` precedent).

19. **_Change…_?** ✅ **Not drawn.** It needs Electron's folder dialog and a
    _move_ of the managed media directory — a storage model of its own, with
    the same "a bug in it deletes my parents' films" stakes log 13 refused for
    copy-in. The row is the title over the path, alone on its line.

20. **The version?** ✅ A build-time **`__APP_VERSION__`** from `package.json`
    through Vite's `define`, declared once as a global; `AboutSection` draws
    it. `package.json` stays `0.0.0` until the packaging initiative sets a
    version — the About card is honest about that. ❌ `GET /api/about`: a wire
    to carry a constant the bundle already knows, and Electron's
    `app.getVersion()` reads the same file.

21. **_Software update_?** ✅ **Not drawn** — it is the Electron initiative's
    (`autoUpdater`) and the Snackbar system's, and the idle copy _You're up to
    date_ would be a lie with no updater behind it. The About card is the
    brand row alone; the rule between the two rows goes with the row.

22. **How is it structured?** ✅ Three sections beside the two that exist —
    **`PlaybackSection`**, **`StorageSection`**, **`AboutSection`** — and the
    page composes five. The card furniture the three share (`Card`, `Divider`,
    `ItemTitle`, `ItemDesc`) and the `GroupHeading` all four share go to
    **`features/settings/section.styles.ts`**, the `maintainer.styles.ts`
    precedent one rung down; `GroupHeading` moves out of
    `LibrarySection.styles.ts`. **`CodecManager`** is the organism that owns
    `useCapabilities` and draws the summary over **`CodecRow`**s (the feature's
    molecule, the `ProblemRow` precedent); the spec's `{ summaryLabel, codecs,
onBrowse }` props collapse the way `ExportModal`'s did — the organism owns
    its hook. `PlaybackSection` owns `useSettings`; `StorageSection` owns
    `useStorageReport`; `AboutSection` has nothing to own.

23. **Loading and refusal?** ✅ **Blank until it lands** — the Export summary's
    rule: the summary line empty and no rows, the path and the number empty,
    until each read answers; a refused read leaves them so. No skeleton, no
    error face: the prototype draws neither, and Settings is the maintainer's
    screen.

24. **The feature table afterwards?** ✅ **Settings shell** ✅, **Subtitle
    preferences** ✅, **Storage** ✅ (location and space used; _Change…_ noted
    as Electron's). **Codec manager** splits into _view installed codecs_ ✅
    and _add a playback component_ 🔜. **Software update** stays 🔜. Ticked
    only after the initiative's refactor, per the project's rule.

## Design

### Types — `src/types/playback.ts` (grows), `src/types/settings.ts` (new)

```ts
// playback.ts — moved up from server/src/playback/capabilities/
export type CodecKind = 'video' | 'audio';
export type CodecSupport = 'native' | 'via-component';
export interface CodecCapability {
  codec: string;
  kind: CodecKind;
  support: CodecSupport;
}
/** `GET /api/playback/capabilities` — what this machine decodes, and whether a component is part of the answer. */
export interface PlaybackCapabilities {
  component: boolean;
  codecs: CodecCapability[];
}

// settings.ts — shared by both build targets, on the MOVIE_SORTS precedent
export const SUBTITLE_LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Italian',
  'Dutch',
] as const;
export type SubtitleLanguage = (typeof SUBTITLE_LANGUAGES)[number];
export const DEFAULT_SUBTITLE_LANGUAGE = 'English';

/** `GET /api/settings` — the household's preferences, defaults applied. */
export interface Settings {
  subtitleLanguage: string;
}

/** `GET /api/storage` — the managed media directory, described. */
export interface StorageReport {
  mediaPath: string;
  bytesUsed: number;
  movieCount: number;
}
```

### Backend

```
server/src/playback/
├── ffmpegComponent/     ← PlaybackComponent gains decoders(): string | null; listing seam becomes { encoders, decoders }
├── capabilities/        ← capabilities(component: PlaybackComponent | null): PlaybackCapabilities
└── createPlayback/      ← Playback gains capabilities()
server/src/media/
└── spaceUsed/           ← spaceUsed(root): Promise<number> — every file's size under the root, 0 when it is not there
server/src/library/      ← Storage gains settings(): Settings, setSubtitleLanguage(language: string): void
server/src/db/migrations.ts
                         ← version 3: CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)
```

### Routes — `server/src/routes/index.ts`

```
GET  /api/playback/capabilities        → 200 PlaybackCapabilities         playback.capabilities()
GET  /api/settings                     → 200 Settings                     storage.settings()
POST /api/settings/subtitle-language   → 200 { value }                    { value } a non-empty string, else 400 { error }
GET  /api/storage                      → 200 StorageReport                resolve(mediaPath), spaceUsed(mediaPath), countMovies()
```

Nothing new is injected into `createApiRouter`.

### Frontend

```
src/primitives/
├── Toggle/                            ← the switch atom: checked, disabled, onToggle, label
└── Icon/MicrochipIcon.tsx             ← the codec row's tile glyph
src/utils/formatBytes/                 ← 18.4 GB
src/api/fetchSettings/                 ← two callers: the hub and the player
src/features/settings/
├── section.styles.ts                  ← GroupHeading (moved), Card, Divider, ItemTitle, ItemDesc
├── PlaybackSection/                   ← the Playback card: Codecs header, CodecManager, the two Subtitles rows; owns useSettings
├── CodecManager/                      ← the organism: owns useCapabilities; the summary over the rows
├── CodecRow/                          ← tile, name, chips, `—`, the pill, the spacer
├── codecView/                         ← pure: the Format catalogue; codecRows, codecSummary
├── useCapabilities/                   ← { capabilities: PlaybackCapabilities | null }
├── useSettings/                       ← { settings, chooseSubtitleLanguage } — optimistic, reverted on refusal
├── StorageSection/                    ← the Storage card: title, path in mono, the space line; owns useStorageReport
├── useStorageReport/                  ← { report: StorageReport | null }
├── AboutSection/                      ← the About card: FamilyFlix, __APP_VERSION__, the tagline
└── api/                               ← fetchCapabilities, saveSubtitleLanguage, fetchStorageReport (one caller each)
src/features/player/useSubtitles/      ← fetchSettings on open; preferredSubtitle(subtitles, settings?.subtitleLanguage)
src/features/movie-form/MovieFormFiles/ ← LANGUAGES → SUBTITLE_LANGUAGES
src/pages/SettingsPage/                ← + PlaybackSection, StorageSection, AboutSection
vite.config.mts                        ← define: __APP_VERSION__
```

```ts
// Toggle
export interface ToggleProps {
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
  /** The accessible name — the row's own title. */
  label: string;
}

// codecView
export interface CodecRowModel {
  codec: string;
  name: string;
  exts: string[];
  support: CodecSupport;
}
export function codecRows(capabilities: PlaybackCapabilities): CodecRowModel[];
export function codecSummary(capabilities: PlaybackCapabilities): string;

// useSettings
export interface SettingsState {
  settings: Settings | null;
  chooseSubtitleLanguage: (language: string) => void;
}
export function useSettings(): SettingsState;

// api
export function fetchCapabilities(): Promise<PlaybackCapabilities>;
export function fetchSettings(): Promise<Settings>;
export function saveSubtitleLanguage(language: string): Promise<string>;
export function fetchStorageReport(): Promise<StorageReport>;
```

### Prototype amendments (make first, then build)

1. `FamilyFlix.dc.html` — `summaryLabel`: `N formats enabled · M added by
you` → `N formats enabled · M from the playback component`. Copy only.

### Not built

The _Add a codec pack_ zone and the per-row ✕ (the **Playback component
upload** initiative); _Change…_ and the _Software update_ row (Electron); the
snackbars the update flow pushes (the Snackbar system).

## Implementation Plan

1. **The codec report, end to end.** `capabilities` behind the component seam
   (`decoders()`, `capabilities(component)`, `Playback.capabilities()`), the
   types promoted, `GET /api/playback/capabilities`; `MicrochipIcon`,
   `section.styles.ts` with `GroupHeading` moved, `codecView`,
   `useCapabilities`, `CodecRow`, `CodecManager`, and `PlaybackSection` with
   the Codecs header over it; the page composes it. The thinnest slice that
   puts a true row on the screen.
2. **The Subtitles rows.** `Toggle`, the Coming soon pill and the auto-on row;
   `SUBTITLE_LANGUAGES` promoted and both spellings replaced; the `settings`
   table, `Storage.settings` / `setSubtitleLanguage`, the two routes;
   `fetchSettings`, `saveSubtitleLanguage`, `useSettings`; the _Preferred
   language_ `FilterDropdown`; `useSubtitles` honours the preference.
3. **Storage.** `spaceUsed`, `GET /api/storage`, `formatBytes`,
   `useStorageReport`, `StorageSection`.
4. **About.** `__APP_VERSION__`, `AboutSection`.
5. **Docs and refactor.** COMPONENT-SPEC's `CodecManager` and `SettingsPage`
   rows, the glossary, the feature tables (Q24), the journal; the refactor
   pass.

## Trade-offs

**Easier.** Every number on the page is a read the domain already makes or a
walk over a directory the app owns; nothing is stored that was not stored
before except one preference. The codec report becomes a property of the
component the player uses, so the upload initiative inherits a truthful screen
for free. The Language pool is spelled once. The player's preferred-track slot
closes without touching `preferredSubtitle`.

**Harder.** Three of the prototype's controls are absent until two later
initiatives land, and the _Codecs_ description mentions one of them in the
meantime. `capabilities()` spawns `ffmpeg -decoders` on each Settings visit —
a few hundred milliseconds, acceptable for the maintainer's screen, memoisable
if it ever is not. `spaceUsed` walks the whole managed directory on each
visit; a library of thousands of folders on a slow disk would feel it, and a
cached total is the fix if so. The size cell is a column of dashes until the
upload initiative decides what a component's size means on a row.

**Ruled out of scope.** The Playback component upload and remove; a folder
picker and a move of the managed media directory; the software updater and
its snackbars; auto-on subtitles (still 🧭); a "not supported" row for a
catalogued codec nothing decodes (the report's own rule says absence);
validating the preference against the pool.
