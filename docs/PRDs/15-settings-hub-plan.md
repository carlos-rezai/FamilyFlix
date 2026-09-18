# Plan: Settings hub — the Playback, Storage and About groups

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/142

The Settings page is half a page: the header and the **Library** group, and
then it stops. The prototype draws three more groups under it — **Playback**,
**Storage**, **About** — and three of the rows they hold are about things the
app already knows and cannot show: the codec report log 10 built for exactly
this screen, the `language` slot `preferredSubtitle` has carried unused since
it was written, and a managed media directory nobody can see the size of.
This initiative draws the three groups 1:1 and wires each row to what the app
can truthfully answer now. The three controls whose mechanism does not exist —
the dashed _Add a codec pack_ zone, _Change…_, _Software update_ — are not
drawn, the rule that held the Export row back until its dialog existed.

The slicing follows the design log's own order, with its second step split in
two: **a true codec row on the page** (Phase 1) → **the Subtitles rows and the
preference they keep** (Phase 2) → **the player honours it** (Phase 3) →
**Storage** (Phase 4) → **About** (Phase 5). The hub writing a preference and
the player reading it are separate verticals through separate features, each
demoable on its own, so they are separate phases. Docs — COMPONENT-SPEC's
`CodecManager` and `SettingsPage` rows, the glossary, the feature tables, the
journal — and the refactor pass are filed by `request-refactor-plan` after
Phase 5, as #135 was for bulk import, and the feature table ticks there and
not before.

Every phase is checked by looking: open Settings and read the card. From
Phase 1 the Playback card names the formats this machine decodes; Phase 2
adds the two Subtitles rows and a choice that survives a reload; Phase 3 makes
that choice change which track a film opens on; Phase 4 puts a number on the
media folder that agrees with Explorer; Phase 5 puts the version on the page.

## Three things settled in the tracer bullet rather than later

- **The report is a property of the component the player uses, from its
  first commit.** `capabilities` today resolves the binary itself — the
  three-step `ffmpegBinary` lookup a second time. The route could call
  `capabilities(process.env)` and be done in an afternoon, and it would be
  wrong the day the upload initiative makes the live component replaceable:
  two resolutions of one slot, disagreeing. Phase 1 moves the report behind
  the seam — `decoders()` on `PlaybackComponent`, `capabilities(component)`,
  `Playback.capabilities()` — so the route reads the component `main.ts`
  composed and nothing else. It is the one change to shipped playback code
  in the initiative, and it is what lets the upload initiative inherit a
  truthful screen for free.

- **Blank-until-it-lands is the hook's shape from its first commit.** Every
  read on the page — the report, the settings, the storage — is `null` until
  it lands and `null` still if it never does, and nothing is drawn while so.
  No skeleton, no error face, no snackbar: the prototype draws none, and a
  hook written to do anything else and rewritten later is a test suite
  written twice. The rule is the Export summary's, and `useCapabilities` in
  Phase 1 sets the shape `useSettings` and `useStorageReport` repeat.

- **The furniture is built once, in Phase 1.** `section.styles.ts` — the
  Section card, the divider, the item title and description, and the Group
  heading moved out of `LibrarySection.styles.ts` — lands with the first
  card so the next two extend it rather than copy it. The Playback card is
  drawn with only its Codecs half in Phase 1, the Subtitles half arriving in
  Phase 2 under the same divider: an intermediate state of the Maintainer's
  surface, named rather than hidden.

---

## Architectural decisions

Durable decisions that apply across all phases.

- **Routes.** Four, under the existing `/api` router. Nothing new is
  injected: the capability route reads the `playback` the router already
  holds, the settings routes read `storage`, and the storage route composes
  `mediaPath`, a walk and `storage`.

  ```
  GET  /api/playback/capabilities        -> 200 PlaybackCapabilities  { component, codecs }
  GET  /api/settings                     -> 200 Settings              { subtitleLanguage }
  POST /api/settings/subtitle-language   -> 200 { value }
       { value }                         -> 400 { error }             missing, empty or non-string
  GET  /api/storage                      -> 200 StorageReport         { mediaPath, bytesUsed, movieCount }
  ```

  The capability wire is the raw report — `{ codec, kind, support }` per
  row, `support` one of `native | via-component` — and the **Format
  catalogue** stays on the screen that draws it. The settings write is a
  **Single-signal write** on the favorite / watched / rating precedent: one
  route per setting, so the roadmap's auto-on adds a sibling and not a
  shape. Membership in the **Language pool** is not checked — a display
  vocabulary, not a constraint, the rule a **Subtitle**'s own language
  follows. There is no `GET /api/about`: the version is a build-time
  constant the bundle already knows.

- **Schema.** Migration 3: a `settings` table, `key TEXT PRIMARY KEY, value
TEXT NOT NULL`. One row today, `subtitle-language`. `LibraryStorage` in
  `library/` gains `settings(): Settings` — the default applied when the row
  is absent — and `setSubtitleLanguage(language: string)` as an upsert.
  `library/` is the one SQLite door; a `settings/` server domain was
  rejected (two methods over one table is not a domain), and so was
  `localStorage` (volume is a device's; this is the household's, and it must
  be in the backup).

- **Key models.** Two shared type modules, both build targets reading each:
  - `src/types/playback.ts` gains the capability types moved out of the
    server's `capabilities` unit — `CodecKind`, `CodecSupport`,
    `CodecCapability`, `PlaybackCapabilities` — beside `PlaybackRead`.
  - `src/types/settings.ts`, new: `SUBTITLE_LANGUAGES` as a const tuple —
    `English, Spanish, French, German, Portuguese, Italian, Dutch` — with
    `SubtitleLanguage` derived, on the `MOVIE_SORTS` precedent;
    `DEFAULT_SUBTITLE_LANGUAGE = 'English'`; `Settings { subtitleLanguage:
string }`; `StorageReport { mediaPath, bytesUsed, movieCount }`. The
    form's `LANGUAGES` and the scanner's `LANGUAGE_TAGS` read the tuple
    instead of spelling their own, so the three cannot drift.

- **The seam.** `PlaybackComponent` gains `decoders(): string | null` — what
  `ffmpeg -decoders` printed, raw, or `null` for every way of not knowing,
  the way `probe` hands over raw output. `ffmpegComponent`'s injected
  listing becomes a pair, encoders and decoders, one seam for both spawns.
  `capabilities(component: PlaybackComponent | null)` answers the native
  rows alone with `component: false` for `null`, and native ∪ the parsed
  listing with `component: true` otherwise — a codec both decode reported
  once, as native; a component answering `null` is `component: true` over
  the native rows alone. `Playback` gains `capabilities()` and the route
  calls that. The three-step binary lookup `capabilities` ran itself is
  gone.

- **The Format catalogue.** A pure `codecView` unit in `features/settings/`,
  on the `importView` precedent: decoder name → display name → container
  chips, video then audio, in the order the rows draw — `h264` _H.264 /
  AVC_ `.mp4 .mov .m4v`; `hevc` _H.265 / HEVC_ `.mkv .mp4`; `vp8`; `vp9`;
  `av1`; `mpeg4` _MPEG-4 / XviD_ `.avi .mkv`; `mpeg2video`; `vc1` _Windows
  Media Video_ `.wmv`; `prores`; `theora`; then `aac` _AAC Audio_; `mp3`;
  `opus`; `vorbis`; `flac`; `ac3` _AC-3 / Dolby Digital_ `.mkv .avi`;
  `eac3`; `dts` _DTS Audio_; `truehd`. `codecRows(capabilities)` keeps the
  catalogued codecs the report contains, in catalogue order, each `{ codec,
name, exts, support }`; an uncatalogued decoder is not a row and a
  catalogued codec the report lacks is not a row — no "unsupported" state,
  the rule `capabilities` already keeps. `codecSummary(capabilities)` counts
  the rows, not the report: `N formats enabled · M from the playback
component`, or `… · no playback component` when `component` is false.
  The chips are display only; nothing decides whether a file plays from one.

- **Where things live.** Under `features/settings/`: `section.styles.ts`
  (`GroupHeading`, `Card`, `Divider`, `ItemTitle`, `ItemDesc` — the
  `maintainer.styles.ts` precedent one rung down); `PlaybackSection`,
  `StorageSection`, `AboutSection` — one organism per card; `CodecManager`
  owning `useCapabilities` over `CodecRow`s, the spec's `{ summaryLabel,
codecs, onBrowse }` props collapsing the way `ExportModal`'s did;
  `CodecRow` on the `ProblemRow` precedent; `codecView`; `useCapabilities`,
  `useSettings`, `useStorageReport`; and the feature's own `api/` with
  `fetchCapabilities`, `saveSubtitleLanguage` (through `postValue` with a
  string `isEcho`) and `fetchStorageReport`, one caller each. `fetchSettings`
  lives in the shared `api/` — two callers, the hub and the player. In the
  primitives: `MicrochipIcon` (the prototype's rect-and-pins path at stroke
  1.6, `currentColor`, the `DownloadIcon` precedent) and `Toggle` (per
  COMPONENT-SPEC: `{ checked, disabled?, onToggle, label }`, a `role="switch"`
  button carrying `aria-checked` and `aria-disabled` rather than the
  `disabled` attribute, 46×26 on a 3px pad, knob and track at `.18s`,
  opacity `.45` and `not-allowed` when disabled, `onToggle` not called when
  disabled). In the server's `media/`: `spaceUsed(root)`. In `utils/`:
  `formatBytes`. The page composes `SettingsHeader`, `LibrarySection`,
  `PlaybackSection`, `StorageSection`, `AboutSection` and nothing else.
  `__APP_VERSION__` is declared once as a global and defined through Vite's
  `define` from `package.json`'s `version`. No new `test-support/` unit:
  `fakeResponse`, `freshStorage`, `sandboxRoot` and the route tests' fake
  component cover what is needed.

- **Loading and refusal.** Blank until it lands, on all three reads: the
  summary and rows, the pill, the path and the number. `null` until the read
  lands, `null` still if it never does, and nothing drawn while so. No
  skeleton, no error face, no snackbar. A refused settings write puts the
  previous value back and shows nothing else — the detail page's bargain.

- **Copy, fixed by the prototype.** _Codecs_ / "These decide which video
  files FamilyFlix can play. Common formats work out of the box — add a pack
  only if a movie won't play." — the second sentence kept though the zone
  is not drawn, so the copy does not move when it lands. The summary line's
  "from the playback component" replaces the prototype's "added by you" —
  true of the bundled build — recorded as a copy amendment to
  `FamilyFlix.dc.html` made before building. _Subtitles_ / "How subtitles
  behave when a movie has them."; _Turn on automatically_ with **Coming
  soon** / "Show subtitles by default when a movie has them."; _Preferred
  language_ / "Which track to use whenever subtitles are shown."; _Managed
  media folder_; `{bytes}` **of movies** `·` `{n} titles` / `1 title`;
  **Family**Flix, the version, _Offline · local-only · no account_. The
  pills: **Built-in** (faint text on the third surface), **Installed** (the
  watched green on its own tint), **Coming soon**.

- **Not built, anywhere in these phases.** The _Add a codec pack_ zone and
  the **Playback component upload** it leads to; a per-row ✕; _Change…_
  and a move of the managed media directory; _Software update_; auto-on
  subtitles (the toggle is drawn disabled and stores nothing); a subtitle
  track picker in the player; validating the preference against the pool;
  an "unsupported" row; memoising the decoder listing or caching the space
  walk; a skeleton, an error face or a snackbar on any read; `GET
/api/about`; any change to the Library group.

---

## Phase 1: The tracer bullet — a true codec row on the page

**User stories**: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 71, 72

### What to build

The thinnest complete path from `ffmpeg -decoders` to a row on the Settings
page. The **Playback component** learns to say what it decodes; the codec
report is asked of the component the player was composed with rather than
of the environment a second time; `Playback` exposes it; the route answers
it raw. On the screen, the hub gains its second **Group heading** —
PLAYBACK — over a **Section card** holding the Codecs header, both sentences,
the **Codec summary** and one **Codec row** per catalogued format the
machine decodes: the 36px tile with the microchip glyph in the accent, the
display name, the **Container chips** in mono, `—` in the size cell, the
**Built-in** or **Installed** pill, and the 32px spacer where a ✕ would sit.
No dashed zone under it. The card ends there in this phase; the divider and
the Subtitles half arrive in Phase 2.

The capability types move to the shared `playback` types so both targets
read one definition. The card furniture — the card, the divider, the item
title and description — and the Group heading moved out of
`LibrarySection.styles.ts` land in `section.styles.ts`, with the Library
group re-pointed at it and otherwise untouched. The report is `null` until
it lands and `null` still if it never does, and `CodecManager` renders
nothing while so — the shape every hook on this page repeats.

The prototype's `summaryLabel` copy — "added by you" → "from the playback
component" — is amended in `FamilyFlix.dc.html` before the first commit.

### Acceptance criteria

- [ ] `CodecKind`, `CodecSupport`, `CodecCapability` and
      `PlaybackCapabilities` live in `src/types/playback.ts`, re-exported from
      the barrel and imported by both build targets; the server's
      `capabilities` unit no longer declares them
- [ ] `PlaybackComponent` has `decoders(): string | null`;
      `ffmpegComponent(...).decoders()` hands over what the injected decoder
      listing returned, `null` included, and the encoder detection is
      unchanged
- [ ] `capabilities(null)` answers the native rows alone with `component:
false`; `capabilities(component)` whose `decoders()` returns a listing
      answers native ∪ the parsed video and audio decoders with `component:
true`; a codec in both is reported once, as native; a component
      answering `null` is `component: true` over the native rows alone; the
      legend line above the rule is not a codec; `capabilities` no longer
      reads the environment or resolves a binary
- [ ] `Playback.capabilities()` returns what `capabilities` answers over the
      component `createPlayback` was composed with
- [ ] `GET /api/playback/capabilities` answers `200 { component, codecs }`
      from the fake component the route tests hand over; the route reaches
      it through `Playback` alone
- [ ] `codecRows` keeps only catalogued codecs, in catalogue order — video
      then audio — with the display name, the chips and the support carried
      through; `pcm_s16le` is not a row; a catalogued codec absent from the
      report is not a row
- [ ] `codecSummary` counts the rows, not the report; reads `N formats
enabled · M from the playback component`; `N formats enabled · no
playback component` when `component` is false; `0 formats enabled`
      for an empty report
- [ ] `fetchCapabilities` resolves the payload and rejects on a non-OK
      status
- [ ] `useCapabilities` is `null` until the read lands, the payload after,
      `null` kept on refusal
- [ ] `MicrochipIcon` renders its path at the size given
- [ ] `section.styles.ts` exports `GroupHeading`, `Card`, `Divider`,
      `ItemTitle`, `ItemDesc`; `LibrarySection` reads `GroupHeading` from it
      and its three rows are unchanged
- [ ] `CodecRow` shows the name, each chip, `—`, _Built-in_ for `native` and
      _Installed_ for `via-component`, and no button
- [ ] `CodecManager` renders nothing while the report is `null`; the summary
      line and one row per catalogued codec once it lands; the "no playback
      component" line for a report without one; nothing on a refused read
- [ ] `PlaybackSection` shows _Codecs_ and both sentences over the manager;
      no _Add a codec pack_ zone
- [ ] `SettingsPage` shows LIBRARY then PLAYBACK, the Library rows exactly
      as before, and the Playback card under them at the same measure
- [ ] No codec, settings or storage control on the browse home, a card, the
      detail page or the player
- [ ] On a machine with ffmpeg on `PATH`: Settings lists _H.264 / AVC_ as
      Built-in and _H.265 / HEVC_ as Installed under `N formats enabled · M
from the playback component`; with `FAMILYFLIX_FFMPEG_PATH` pointed at
      nothing and no ffmpeg on `PATH`: the Built-in rows alone under `… · no
playback component`

---

## Phase 2: The Subtitles rows — the preference kept and shown

**User stories**: 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42,
43, 44, 45, 46, 47, 48, 70

### What to build

The second half of the Playback card, end to end for the one preference the
app keeps. Under a rule after the codec rows: _Subtitles_ with its lede;
_Turn on automatically_ beside a **Coming soon** pill and its description,
with the new `Toggle` primitive drawn off and disabled — in the tab order,
announcing itself as a disabled switch, storing nothing and pressing to
nothing; a rule; _Preferred language_ with its description and a
`FilterDropdown` pill on the right, `label="Preferred language"` as its
accessible name and no caption on screen, offering the seven names of the
**Language pool** and showing the current preference.

Behind it, migration 3 adds the `settings` table and `LibraryStorage` the
two methods; `GET /api/settings` answers the household's preference with
the default already applied, and `POST /api/settings/subtitle-language`
takes a **Single-signal write** and echoes it, refusing anything but a
non-empty string with `400`. `useSettings` fetches on mount and holds `null`
until it lands — the pill is not drawn while so — and `chooseSubtitleLanguage`
sets the value on screen, posts, takes the echo, and puts the previous value
back on rejection. `SUBTITLE_LANGUAGES` is spelled once in the shared
`settings` types, and the form's `LANGUAGES` and the scanner's
`LANGUAGE_TAGS` read it.

### Acceptance criteria

- [ ] `src/types/settings.ts` exports `SUBTITLE_LANGUAGES`,
      `SubtitleLanguage`, `DEFAULT_SUBTITLE_LANGUAGE`, `Settings` and
      `StorageReport`, re-exported from the barrel; the form's Subtitle row
      offers the seven names off the tuple and the scanner still detects
      every language it detected
- [ ] Migration 3 creates the `settings` table and a fresh database is at
      version 3; `storage.settings()` answers `{ subtitleLanguage:
'English' }` on a fresh database; `setSubtitleLanguage` upserts and
      `settings()` reads it back
- [ ] `GET /api/settings` answers `200 { subtitleLanguage: 'English' }` on a
      fresh database and the stored value after a write
- [ ] `POST /api/settings/subtitle-language { value: 'Spanish' }` answers
      `200 { value: 'Spanish' }` and persists; a missing, empty or
      non-string value answers `400 { error }` and stores nothing; a value
      outside the pool is accepted; writing the value already held is a
      harmless `200`
- [ ] `fetchSettings` (shared `api/`) resolves the payload and rejects on a
      non-OK status; `saveSubtitleLanguage` posts to its route, resolves the
      echo, and rejects on refusal
- [ ] `useSettings` is `null` until the read lands and `null` kept on
      refusal; `chooseSubtitleLanguage` shows the new value at once, keeps
      the echo, and puts the previous value back on a rejected post
- [ ] `Toggle` is a `switch` named by `label`, `aria-checked` following
      `checked`; calls `onToggle` on press and on Space / Enter; carries
      `aria-disabled` and calls nothing when disabled; is still focusable
      when disabled; draws at `.45` opacity with `not-allowed` when disabled
- [ ] `PlaybackSection` shows a rule after the codec rows, _Subtitles_ and
      its lede, _Turn on automatically_ with **Coming soon** and a disabled
      switch that is off, a rule, and _Preferred language_ with its
      description
- [ ] The _Preferred language_ pill is absent until the settings land and
      stays absent on a refused read; shows the fetched value with _Preferred
      language_ as its accessible name and no caption; offers the seven
      options; choosing one shows it at once and reverts on refusal, with no
      snackbar and no error face
- [ ] Against a dev library: choose _Spanish_, reload Settings → the pill
      reads _Spanish_; `familyflix.db`'s `settings` table holds the row; a
      cleared browser profile does not change the answer

---

## Phase 3: The player honours it

**User stories**: 49, 50, 51, 52, 53

### What to build

The slot log 10 left closes. `useSubtitles` fetches the settings when a film
opens and hands `subtitleLanguage` to `preferredSubtitle(subtitles,
language)`, which already knows what to do with one; `preferredSubtitle`
itself is untouched. Until the settings land, and if they never do, track
order as today — a refused read never delays or breaks a film. The match is
case-insensitive, so a track the importer tagged `spanish` still counts. The
track is chosen once per open; a preference changed mid-film applies to the
next film, not the one playing.

### Acceptance criteria

- [ ] With settings preferring _Spanish_ and a film holding an English and a
      Spanish track, `useSubtitles` chooses the Spanish row; with no Spanish
      row, the first track
- [ ] `Spanish` and `spanish` are one language for the match
- [ ] Before the settings land, and when the read is refused, the track is
      the first in track order — the existing `useSubtitles` tests unchanged
- [ ] The track is not re-chosen when the settings change during a film
- [ ] `preferredSubtitle` is unchanged; `fetchSettings` has two callers and
      stays in the shared `api/`
- [ ] Against a dev library: set _Spanish_ in Settings, open a film with an
      English and a Spanish track, press CC → the Spanish cues; open one
      with English alone → the English cues; the player behaves as before
      with the server's settings route unreachable

---

## Phase 4: The Storage card

**User stories**: 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65

### What to build

The third **Group heading** — STORAGE — over a card with one item: _Managed
media folder_ in 16px/600 and the folder's absolute path under it in mono,
faint, on one line with an ellipsis when long; no _Change…_. Under it the
space line: the bytes in bold, _of movies_, a faint `·`, and `N titles` /
`1 title`.

`spaceUsed(root)` in the server's `media` domain walks the root and sums
every file's size, `0` for a root that does not exist, skipping a file it
cannot stat, never throwing. `GET /api/storage` composes the media path
resolved to absolute — even when the server was started with `./media` —
`spaceUsed` over it, and `storage.countMovies()`. `formatBytes` in `utils/`
writes the number 1024-based with one decimal in `B · KB · MB · GB · TB`, so
the card agrees with the folder's Properties dialog in Explorer. A
**Stranded folder** counts in the bytes and not in the titles, so the card
tells the truth and the leak has a place to surface. `useStorageReport` is
`null` until the read lands; `StorageSection` draws the title alone while so.

### Acceptance criteria

- [ ] `spaceUsed` sums nested files under a sandbox root; answers `0` for an
      empty directory and for one that does not exist; does not throw on a
      file that disappears mid-walk
- [ ] `GET /api/storage` answers `200 { mediaPath, bytesUsed, movieCount }`
      with an absolute `mediaPath` (given a relative one), `bytesUsed` equal
      to the bytes written under a sandbox root and `0` when the root is
      missing, and `movieCount` off the database
- [ ] `formatBytes` writes `0 B`, bytes below 1024 as `B`, the four
      thresholds at 1024, one decimal, and `18.4 GB` for its bytes
- [ ] `fetchStorageReport` resolves the payload and rejects on a non-OK
      status; `useStorageReport` is `null` until the read lands, the payload
      after, `null` kept on refusal
- [ ] `StorageSection` shows _Managed media folder_; the path from the
      report in mono; `18.4 GB` and `12 titles` for that report; `1 title`
      for one; `0 B` for zero bytes; nothing but the title while the report
      is `null`; no _Change…_
- [ ] `SettingsPage` shows LIBRARY, PLAYBACK, STORAGE in order
- [ ] Against a dev library: the number on the card matches the media
      folder's Properties in Explorer to the decimal; a folder left under
      `media/` with no movie counts in the bytes and not in the titles; a
      fresh install with no `media/` directory yet reads `0 B` and `0
titles`

---

## Phase 5: The About card

**User stories**: 66, 67, 68, 69

### What to build

The fourth **Group heading** — ABOUT — over a card holding one row: **Family**
in serif then **Flix** in the accent, the version in mono beside it, and
_Offline · local-only · no account_ pushed to the far end. No _Software
update_ row and no rule above the brand row. `__APP_VERSION__` is declared
once as a global and defined through Vite's `define` from `package.json`'s
`version`, so the card and the installer can never disagree; it reads
`0.0.0` until the packaging initiative sets one. `AboutSection` owns no hook.

### Acceptance criteria

- [ ] `__APP_VERSION__` is declared once and defined by Vite from
      `package.json`'s `version`; the typecheck passes in both build targets
      and under the test runner
- [ ] `AboutSection` shows _Family_, _Flix_, the defined version and the
      tagline; no update row, no _You're up to date_
- [ ] `SettingsPage` shows the four group headings in order — LIBRARY,
      PLAYBACK, STORAGE, ABOUT — over the five sections and nothing else
- [ ] Against the running app: the About card reads `0.0.0`; bumping
      `package.json`'s version and rebuilding changes it
- [ ] The feature table ticks 🔜 → ✅ in README and CLAUDE.md only after the
      refactor pass filed by `request-refactor-plan` after this phase, per
      the project rule: **Settings shell**, **Subtitle preferences** and
      **Storage** (_Change…_ noted as Electron's) tick; **Codec manager**
      splits into _view installed codecs_ ✅ and _add a playback component_
      🔜; **Software update** stays 🔜
