## Problem Statement

I am the maintainer of this library, and the Settings page is half a page.

The hub at `/settings` has its header and its **Library** group — _Add a
movie_, _Import from spreadsheet_, _Export to CSV_ — and then it stops. The
prototype draws three more groups under it: **Playback**, with the codec list
and the two subtitle rows; **Storage**, with the managed media folder and how
much of the disk it holds; and **About**, with the name and the version. Both
shipped files say the rest is "the settings-shell initiative's". The feature
table has five 🔜 rows under _Settings hub_ and every one of them is that
page.

Three of those rows are about things the app already knows and has no way to
show. Log 10 built `capabilities` — a truthful, probed report of which codecs
this machine decodes — "because the Settings initiative is what will consume
it", and no route reads it; the CodecManager the prototype draws is the one
screen in the app that would stop a family member asking "will this one
play?". The player's `preferredSubtitle` has carried an optional `language`
since it was written, with the note that "the Settings default-language
dropdown is a later initiative", and every call omits it — so a household
whose films all have Spanish tracks gets whichever track is first. The
managed media directory is a folder my parents will never open, on a disk
they will one day fill, and nothing in the app says how big it is.

The other three rows the prototype draws — the dashed _Add a codec pack_ zone,
_Change…_ under the folder path, and _Software update_ — need mechanisms the
app does not have: a component upload nobody has designed, Electron's folder
dialog, an updater. Log 13's rule is that a row whose destination does not
exist is not drawn, which is how the Export row waited for its dialog. The
question this initiative answers is which rows are true today, where their
numbers come from, and what the page looks like with the untrue ones left
out.

## Solution

The three groups the hub lacks — **Playback**, **Storage**, **About** — each
a **Section card** under its uppercase **Group heading**, drawn 1:1 from
`page.SettingsPage` and wired to what the app can truthfully answer now.

**Playback.** The card opens with _Codecs_ and its two-line description, then
the **Codec report**: a **Codec summary** — `6 formats enabled · 3 from the
playback component` — over one **Codec row** per format the machine decodes,
each with a microchip tile, the display name, its **Container chips** in
mono, a `—` in the size cell, a _Built-in_ or _Installed_ **Status pill**,
and the prototype's 32px spacer where a ✕ would sit. The rows come from
`GET /api/playback/capabilities`, the report log 10 built, now read through
the **Playback component** seam so it describes the component the player
actually uses; the **Format catalogue** in `codecView` turns four hundred
decoder names into the handful a family folder is made of, with the
prototype's names and chips. A rule, then _Subtitles_ with its lede, _Turn on
automatically_ beside a **Coming soon** pill and a new `Toggle` primitive
drawn off and disabled, a rule, and _Preferred language_ with a
`FilterDropdown` over the seven names of the **Language pool**. Choosing one
writes the **Preferred subtitle language** — the first row of a new
`settings` table, behind `GET /api/settings` and a **Single-signal write** —
and the player reads it back: `useSubtitles` fetches the settings when a
film opens and hands the language to `preferredSubtitle`, which closes the
slot log 10 left.

**Storage.** _Managed media folder_ over its absolute path in mono, and under
it **`18.4 GB` of movies · 12 titles** — `GET /api/storage`, which resolves
the media path, walks it with `spaceUsed` and counts the movies; `formatBytes`
writes the number the way Explorer would. No _Change…_.

**About.** One row: **Family**Flix in serif, the version in mono from a
build-time `__APP_VERSION__` off `package.json`, and _Offline · local-only ·
no account_ at the far end. No _Software update_ row.

Every read lands blank-until-it-lands, the Export summary's rule: no
skeleton, no error face. The three absent controls each come back in the
same card, under the same heading, when their mechanism ships — the
**Playback component upload**, and the Electron shell.

## User Stories

### The page

1. As the maintainer, I want the Settings page to show four groups in the
   prototype's order — Library, Playback, Storage, About — so that the hub
   is the whole page the prototype draws and not the top of it.
2. As the maintainer, I want each of the three new groups to be an uppercase
   **Group heading** over one **Section card** — the surface fill, the soft
   border, 20px padding, 32px below — so that the three read as the same
   furniture at the same measure.
3. As the maintainer, I want the Library group's rows left exactly as they
   are, so that this initiative adds three groups and touches none.
4. As a family member, I want none of this on the browse surface, so that
   Settings stays the maintainer's screen behind the gear.

### The Codecs header

5. As the maintainer, I want the Playback card to open with _Codecs_ in
   16px/600 and, under it, "These decide which video files FamilyFlix can
   play. Common formats work out of the box — add a pack only if a movie
   won't play." in the faint 13px at 440px max-width, so that the header is
   the prototype's, second sentence included.
6. As the maintainer, I want that second sentence kept even though the
   _Add a codec pack_ zone is not drawn yet, so that the copy does not move
   when the zone lands directly under it.

### The Codec summary

7. As the maintainer, I want a line above the rows reading `N formats
enabled · M from the playback component`, so that I can see at a glance
   how much of the list the component is responsible for.
8. As the maintainer, I want `N` to be the number of rows drawn — the
   catalogued codecs the machine decodes — and not the number of decoders
   ffmpeg lists, so that the line describes the table under it.
9. As the maintainer, I want the line to read `N formats enabled · no
playback component` when the report says there is none, so that a machine
   whose installer has not run says so rather than counting to zero.
10. As the maintainer, I want the line to read "from the playback component"
    rather than the prototype's "added by you", so that it is true of the
    bundled build my parents will have — recorded as a copy amendment.
11. As the maintainer, I want the line empty and no rows drawn until the
    report lands, and left so if it never does, so that a slow or refused
    read shows nothing rather than something wrong.

### The Codec rows

12. As the maintainer, I want one row per codec in the **Format catalogue**
    that the report contains, in catalogue order — video first, then audio —
    so that the list is stable across visits and machines.
13. As the maintainer, I want a decoder the catalogue does not name
    (`pcm_s16le`, `bmp`, `rawvideo`) to be no row, so that the list is the
    formats a family folder is made of and not ffmpeg's four hundred.
14. As the maintainer, I want a catalogued codec nothing decodes to be no row
    either — no "unsupported" state — so that the absence of a row is how the
    report says no, the rule `capabilities` already keeps.
15. As the maintainer, I want each row to begin with a 36px tile holding a
    20px microchip glyph in the accent colour, so that every row has the
    prototype's leading mark.
16. As the maintainer, I want the row to name the format the way the
    prototype does — _H.264 / AVC_, _H.265 / HEVC_, _MPEG-4 / XviD_, _AC-3 /
    Dolby Digital_, _DTS Audio_, _AAC Audio_ — rather than by ffmpeg's
    decoder name, so that it reads to a person.
17. As the maintainer, I want the container chips under the name — `.mp4
.mov .m4v`, `.mkv .mp4`, `.avi .mkv`, `.wmv` — in mono at 11.5px, so that
    a format is tied to the file endings my parents actually see.
18. As the maintainer, I want the chips to be display only, so that nothing
    decides whether a file plays from a chip.
19. As the maintainer, I want the size cell on every row to read `—`, so
    that the geometry is the prototype's and the cell does not pretend a
    codec has a size of its own.
20. As the maintainer, I want a codec Chromium decodes to carry a
    **Built-in** pill — faint text on the third surface — so that it reads as
    the prototype's built-in row.
21. As the maintainer, I want a codec the **Playback component** decodes to
    carry an **Installed** pill — the watched green on its own tint — so that
    it reads as the prototype's installed row.
22. As the maintainer, I want a codec both can decode to appear once, as
    **Built-in**, so that H.264 is never listed twice or credited to the
    component.
23. As the maintainer, I want no ✕ on any row, and the prototype's 32px
    spacer in its place on every row, so that nothing on the screen offers
    to remove one codec from a component that comes and goes whole.
24. As the maintainer, I want the dashed _Add a codec pack_ zone absent, so
    that the card offers no drop target that leads nowhere — the row-not-drawn
    rule the Export row followed.
25. As the maintainer with no ffmpeg on the machine, I want the Built-in rows
    alone and the summary's "no playback component", so that the report is a
    reduced page and not a broken one.

### The report on the wire

26. As the client, I want `GET /api/playback/capabilities` to answer
    `{ component, codecs }` with each codec `{ codec, kind, support }`, so
    that the screen has the raw truthful report and the vocabulary stays on
    the screen.
27. As the maintainer, I want the report to describe the component the
    player actually uses — the one composed at startup — so that it can never
    disagree with what pressing Play does, and stays true when a later
    initiative swaps the component while the app runs.
28. As a developer, I want the route to reach the report through `Playback`
    and the `PlaybackComponent` seam, so that the route layer never learns
    there is an FFmpeg and the route tests hand over a fake listing.

### The Subtitles rows

29. As the maintainer, I want a rule after the codec rows and then
    _Subtitles_ with "How subtitles behave when a movie has them." under it,
    so that the second half of the card opens the way the prototype does.
30. As the maintainer, I want _Turn on automatically_ with a **Coming soon**
    pill beside it and "Show subtitles by default when a movie has them."
    under it, so that the row is drawn as the prototype draws it.
31. As the maintainer, I want the switch on that row drawn off and disabled —
    opacity .45, `not-allowed` cursor — so that the roadmap's auto-on is
    visibly a roadmap item and not a control that changes nothing.
32. As a keyboard user, I want that switch to stay in the tab order and to
    announce itself as a disabled switch, so that a screen reader says what
    is there rather than skipping it.
33. As the maintainer, I want the disabled switch to store nothing and press
    to nothing, so that auto-on subtitles remain 🧭 exactly as log 10 decided.
34. As the maintainer, I want a rule, then _Preferred language_ with "Which
    track to use whenever subtitles are shown." under it, and a dropdown pill
    on the right, so that the row is the prototype's.
35. As the maintainer, I want the dropdown to offer the seven names of the
    **Language pool** — English, Spanish, French, German, Portuguese,
    Italian, Dutch — rather than the prototype's sample four, so that it
    offers what the Subtitle row on the form offers.
36. As the maintainer, I want the pill to show the current preference without
    a caption on screen, and _Preferred language_ as its accessible name, so
    that it reads as the prototype's bare pill and still has a name.
37. As the maintainer, I want the pill to show _English_ before I have ever
    chosen, so that the default is visible and not blank.
38. As the maintainer, I want the pill to change the moment I choose, so that
    the choice feels made — the detail page's bargain.
39. As the maintainer, I want a refused save to put the previous value back,
    so that the pill never shows a preference the library does not hold.
40. As the maintainer, I want no snackbar and no error face on that refusal,
    so that the surface stays the prototype's.
41. As the maintainer, I want the pill blank until the settings land, and
    left so if they never do, so that a refused read does not show a default
    the server never confirmed.

### The preference itself

42. As the household, I want the preference kept in the library's database
    beside the movies, so that it survives a cleared browser profile and
    travels with the backup.
43. As the household, I want one preference for everyone, so that it is the
    household's the way the watch history is.
44. As the client, I want `GET /api/settings` to answer `{ subtitleLanguage }`
    with the default already applied, so that no client has to know what the
    default is.
45. As the client, I want `POST /api/settings/subtitle-language { value }` to
    answer `{ value }`, so that it is a **Single-signal write** like favorite,
    watched and rating.
46. As the client, I want that route to refuse anything but a non-empty
    string with `400` and a reason, so that a malformed body is a refusal and
    not a stored `null`.
47. As the maintainer, I want the route to accept a language outside the
    pool, so that the pool stays a display vocabulary and not a constraint —
    the same rule a **Subtitle**'s own language follows.
48. As the maintainer, I want choosing the language I already have to be a
    harmless write, so that nothing special happens on a no-op.

### The player honours it

49. As a family member, I want a film with an English track and a Spanish
    track to open on the Spanish one when the household prefers Spanish, so
    that the dropdown changes what pressing CC shows.
50. As a family member, I want a film with no track in the preferred language
    to open on its first track, so that a preference never hides subtitles
    that exist.
51. As a family member, I want `Spanish` and `spanish` to be one language, so
    that a track the importer tagged in another case still matches.
52. As a family member, I want the player to work exactly as it does today
    until the settings land, and if they never do, so that a refused read
    never delays or breaks a film.
53. As a family member, I want a language change to apply the next time a
    film opens, so that the film I am watching does not switch tracks under
    me.

### The Storage card

54. As the maintainer, I want _Managed media folder_ in 16px/600 with the
    folder's absolute path under it in mono at 13px, faint, on one line with
    an ellipsis when it is long, so that the row is the prototype's.
55. As the maintainer, I want the path to be absolute even when the server
    was started with `./media`, so that it names a place on the disk and not
    a place relative to a process.
56. As the maintainer, I want no _Change…_ button, and the title and path
    alone on their line, so that the card offers nothing it cannot do.
57. As the maintainer, I want a line under it reading **`18.4 GB`** in bold
    then _of movies_, a faint `·`, and _12 titles_, so that the space line is
    the prototype's.
58. As the maintainer, I want the number to be the bytes of every file under
    the managed media directory, so that it is what the disk actually holds.
59. As the maintainer, I want it written 1024-based with one decimal in
    `B · KB · MB · GB · TB`, so that the card agrees with the folder's own
    Properties dialog in Explorer.
60. As the maintainer, I want an empty directory to read `0 B`, and a
    directory that does not exist yet to read the same, so that a fresh
    install has a Storage card and not an error.
61. As the maintainer, I want the count to read _1 title_ for one, so that a
    library of one is not a typo.
62. As the maintainer, I want a **Stranded folder** to count in the bytes and
    not in the titles, so that the card tells the truth and the leak has a
    place to surface.
63. As the maintainer, I want the path and the space line empty until the
    report lands, and left so if it never does, so that nothing is shown that
    was not read.
64. As the client, I want `GET /api/storage` to answer `{ mediaPath,
bytesUsed, movieCount }`, so that one read fills the card.
65. As the maintainer, I want a file the walk cannot stat to be skipped
    rather than fail the walk, so that one locked file never blanks the card.

### The About card

66. As the maintainer, I want the About card to hold one row: **Family** in
    serif then **Flix** in the accent, the version in mono beside it, and
    _Offline · local-only · no account_ pushed to the far end, so that the
    row is the prototype's brand row.
67. As the maintainer, I want the version to be the one in `package.json` at
    build time, so that the card and the installer can never disagree.
68. As the maintainer, I want no _Software update_ row and no rule above the
    brand row, so that the card does not say _You're up to date_ with no
    updater to know it.
69. As the maintainer, I want the card to read `0.0.0` until the packaging
    initiative sets a version, so that the About card is honest about where
    the project is.

### Housekeeping

70. As a developer, I want the seven languages spelled once, in the shared
    types, so that the form's Subtitle row, the scanner's tag table and the
    Settings dropdown cannot drift.
71. As a developer, I want the capability types moved to the shared types,
    so that both build targets read one definition of the report.
72. As a developer, I want the card furniture the three groups share — the
    card, the divider, the item title, the item description — and the Group
    heading all four share in one styles module, so that the next section
    extends it rather than copying it.
73. As the maintainer, I want the feature table ticked only after the
    initiative's refactor pass, so that ✅ means what it says.

## Implementation Decisions

### Scope

- Three groups, each drawn 1:1 and wired to what the app can answer now.
  Three controls the prototype draws are **not drawn**: the _Add a codec
  pack_ zone (the **Playback component upload** initiative), _Change…_ and
  _Software update_ (the Electron shell). Each lands in the same card under
  the same heading when its mechanism ships, the way the Export row waited
  for its dialog. The one control the prototype itself marks **Coming soon**
  is drawn, disabled.

### The types

- The capability types — `CodecKind`, `CodecSupport`, `CodecCapability`,
  `PlaybackCapabilities` — move from the server's `capabilities` unit into
  the shared `playback` types module beside `PlaybackRead`, since both build
  targets now read them.
- A new shared `settings` types module: `SUBTITLE_LANGUAGES` as a const
  tuple of the seven names with `SubtitleLanguage` derived, on the
  `MOVIE_SORTS` precedent; `DEFAULT_SUBTITLE_LANGUAGE = 'English'`;
  `Settings { subtitleLanguage: string }`; `StorageReport { mediaPath,
bytesUsed, movieCount }`. The form's `LANGUAGES` and the scanner's
  `LANGUAGE_TAGS` read the tuple instead of spelling their own.

### The codec report behind the seam

- `PlaybackComponent` gains `decoders(): string | null` — what `ffmpeg
-decoders` printed, raw, or `null` for every way of not knowing, the way
  `probe` hands over raw output. `ffmpegComponent`'s injected listing
  becomes a pair — encoders and decoders — one seam for both spawns.
- `capabilities(component: PlaybackComponent | null)`: the native rows alone
  for `null`; native ∪ the parsed listing otherwise, a codec both decode
  reported once as native. The three-step binary lookup it used to run
  itself is gone — the component handed over is the one `main.ts` composed.
- `Playback` gains `capabilities(): PlaybackCapabilities` and the route calls
  that. A `capabilities(process.env)` in the route was rejected: a second
  resolution of the slot, wrong the day the upload initiative makes the live
  component replaceable. This is the one change to shipped playback code.
- The wire stays the raw report. Filtering to the catalogue on the server
  was rejected: a display vocabulary belongs with the screen that draws it.

### The Format catalogue and `codecView`

- A pure `codecView` unit in the settings feature, on the `importView`
  precedent, holding the catalogue: decoder name → display name → container
  chips, video then audio, in the order the rows draw. `h264` _H.264 / AVC_
  `.mp4 .mov .m4v`; `hevc` _H.265 / HEVC_ `.mkv .mp4`; `vp8`; `vp9`; `av1`;
  `mpeg4` _MPEG-4 / XviD_ `.avi .mkv`; `mpeg2video`; `vc1` _Windows Media
  Video_ `.wmv`; `prores`; `theora`; then `aac` _AAC Audio_; `mp3`; `opus`;
  `vorbis`; `flac`; `ac3` _AC-3 / Dolby Digital_ `.mkv .avi`; `eac3`; `dts`
  _DTS Audio_; `truehd`.
- `codecRows(capabilities)` → the catalogued codecs the report contains, in
  catalogue order, each `{ codec, name, exts, support }`. Uncatalogued
  decoders are not rows; catalogued codecs the report lacks are not rows.
- `codecSummary(capabilities)` → `N formats enabled · M from the playback
component`, `N` and `M` counted over the rows; `… · no playback component`
  when `component` is false.

### The Playback card

- `PlaybackSection` — the organism for the card: the Codecs header,
  `CodecManager`, the divider, the Subtitles header and its two rows. Owns
  `useSettings`.
- `CodecManager` — the organism that owns `useCapabilities` and draws the
  summary over `CodecRow`s; the spec's `{ summaryLabel, codecs, onBrowse }`
  props collapse the way `ExportModal`'s did. Nothing rendered while the
  report is `null`.
- `CodecRow` — the feature's molecule on the `ProblemRow` precedent: the
  tile with `MicrochipIcon`, the name, the chips, `—`, the **Status pill**,
  the 32px spacer. No remove.
- `MicrochipIcon` — a new glyph in the Icon primitives: the prototype's
  rect-and-pins path at stroke 1.6, `currentColor`, the `DownloadIcon`
  precedent.
- `Toggle` — a new primitive per COMPONENT-SPEC: `{ checked, disabled?,
onToggle, label }`, a `role="switch"` button carrying `aria-checked` and
  `aria-disabled` rather than the `disabled` attribute (stays in the tab
  order, announces itself), 46×26 on a 3px pad, knob and track animating at
  `.18s`, opacity `.45` and `not-allowed` when disabled, `onToggle` not
  called when disabled. `label` is the accessible name the prototype's bare
  button lacks. Drawn `checked={false} disabled` beside the **Coming soon**
  pill; it stores nothing.
- _Preferred language_ is `FilterDropdown` with `label="Preferred language"`,
  `showLabel={false}`, `menuWidth` 200, options from `SUBTITLE_LANGUAGES`,
  value from the settings. Not drawn while the settings are `null`.

### The preference

- Migration 3: a `settings` table — `key TEXT PRIMARY KEY, value TEXT NOT
NULL`. `Storage` in `library/` gains `settings(): Settings` with the
  default applied when the row is absent, and `setSubtitleLanguage(language)`
  as an upsert. `library/` is the one SQLite door; a `settings/` server
  domain was rejected (two methods over one table is not a domain).
  `localStorage` was rejected: volume is a device's, this is the household's,
  and it must be in the backup.
- `GET /api/settings` → `200 Settings`. `POST /api/settings/subtitle-language
{ value }` → `200 { value }`; `400 { error }` for a missing, empty or
  non-string value. One route per setting, so the roadmap's auto-on adds a
  sibling rather than a shape. Membership in the pool is not checked.
- `fetchSettings` lives in the shared `api/` — two callers, the hub and the
  player. `saveSubtitleLanguage` — through `postValue` with a string
  `isEcho` — stays in the settings feature's `api`, one caller.
- `useSettings()` → `{ settings, chooseSubtitleLanguage }`. Fetches on mount;
  `settings` is `null` until it lands and stays `null` if it never does.
  `chooseSubtitleLanguage`: set the value on screen, post, take the echo,
  put the previous value back on rejection. Two lines inside the hook rather
  than `useOptimisticEdit`, which edits a movie.

### The player

- `useSubtitles` fetches the settings when the screen opens and hands
  `subtitleLanguage` to `preferredSubtitle(subtitles, language)`. Until they
  land, and if they never do, track order as today. `preferredSubtitle`
  itself is untouched. The track is chosen once per open; a preference
  changed mid-film applies to the next.

### The Storage card

- `spaceUsed(root): Promise<number>` in the server's `media` domain: a walk
  summing every file's size under the root; `0` for a root that does not
  exist; a file that cannot be stat'd is skipped; never throws. A method on
  `createMedia` was rejected — every test double would grow a member nobody
  asks.
- `GET /api/storage` → `200 StorageReport`: the media path resolved to
  absolute, `spaceUsed` over it, `storage.countMovies()`. The route composes
  three reads; nothing new is injected into the router.
- `formatBytes(bytes)` in `utils/`: 1024-based, one decimal, `B · KB · MB ·
GB · TB`; `0 B` for zero.
- `useStorageReport()` → `{ report }`, `null` until it lands. `StorageSection`
  owns it and draws the title, the path in mono, and the space line with
  `N titles` / `1 title`.

### The About card

- `__APP_VERSION__` declared once as a global and defined through Vite's
  `define` from `package.json`'s `version`. `AboutSection` draws the brand
  row; it owns no hook. A `GET /api/about` was rejected: a wire to carry a
  constant the bundle already knows.

### Furniture

- `features/settings/section.styles.ts` — `GroupHeading` (moved out of
  `LibrarySection.styles.ts`), `Card`, `Divider`, `ItemTitle`, `ItemDesc` —
  the `maintainer.styles.ts` precedent one rung down. The page composes
  `SettingsHeader`, `LibrarySection`, `PlaybackSection`, `StorageSection`,
  `AboutSection` and nothing else.

### Loading and refusal

- Blank until it lands, the Export summary's rule, on all three reads: the
  summary and rows, the pill, the path and the number. No skeleton, no error
  face — the prototype draws neither.

### Prototype amendment

- `FamilyFlix.dc.html`'s `summaryLabel`: "added by you" → "from the playback
  component". Copy only; made before building.

## Testing Decisions

A good test asserts **external behaviour** — what a route answers, what a
pure function returns for a report, what the screen shows and what a hook
hands back — never how it was reached. **Every unit gets its co-located
test**, the project's standing rule. The precedents are `routes.test.ts` (a
real listener over a real migrated in-memory database, a fake
`PlaybackComponent` handed to `createPlayback`), the `capabilities` tests
(an injected listing rather than a machine), the `importView` and
`preferredSubtitle` tests (pure in, pure out), the `useExport` and
`ExportModal` tests (a hook and the organism that owns it, read through
what is on screen), and the `saveFavorite`-style client tests against
`fakeResponse`.

**`capabilities(component)`**: `null` answers the native rows alone with
`component: false`; a component whose `decoders()` returns a listing answers
native ∪ the parsed video and audio decoders, `component: true`; a codec in
both is reported once as native; a component answering `null` is
`component: true` with the native rows alone; the legend line is not a
codec. The existing cases re-pointed at the seam.

**`ffmpegComponent`**: `decoders()` hands over what the injected listing
returned, `null` included; the encoder detection is unchanged.

**`Playback.capabilities()`**: returns what `capabilities` answers over the
component it was composed with.

**`codecView`**: `codecRows` keeps only catalogued codecs in catalogue order
with the display name and chips; an uncatalogued decoder is not a row; a
catalogued codec absent from the report is not a row; support is carried
through. `codecSummary` counts the rows, not the report; the
"no playback component" form when `component` is false; `0 formats enabled`
for an empty report.

**The routes**: `GET /api/playback/capabilities` answers the fake
component's report; `GET /api/settings` answers `English` on a fresh
database and the stored value after a write; the write echoes `{ value }`
and persists; a missing, empty or non-string value is `400` with an error;
a value outside the pool is accepted; `GET /api/storage` answers an absolute
`mediaPath`, `bytesUsed` equal to the bytes written under a sandbox root
(`0` when the root is missing), and `movieCount` off the database.

**`Storage`**: `settings()` applies the default; `setSubtitleLanguage`
upserts; migration 3 creates the table and a fresh database is at version 3.

**`spaceUsed`**: sums nested files under a sandbox root; `0` for an empty
directory and for one that does not exist; does not throw on a file that
disappears mid-walk.

**`formatBytes`**: `0 B`, bytes, the four thresholds at 1024, one decimal,
`18.4 GB` for its bytes.

**`SUBTITLE_LANGUAGES`**: the form's Subtitle row offers the seven; the
scanner still detects every language it detected.

**The client calls**: `fetchCapabilities`, `fetchSettings`,
`fetchStorageReport` resolve their payloads and reject on a non-OK status;
`saveSubtitleLanguage` posts to its route, resolves the echo, and rejects on
refusal.

**`useCapabilities`, `useStorageReport`**: `null` until the read lands; the
payload after; `null` kept on refusal.

**`useSettings`**: `null` until the read lands; `chooseSubtitleLanguage`
shows the new value at once, keeps the echo, and puts the previous value
back on a rejected post.

**`useSubtitles`**: with settings preferring Spanish, the track is the
Spanish row; with no Spanish row, the first; before the settings land, and
when they are refused, track order — the existing tests unchanged.

**`Toggle`**: a `switch` with the label as its name, `aria-checked` following
`checked`; `onToggle` on press and on Space/Enter; `aria-disabled` and no
call when disabled; still focusable when disabled.

**`MicrochipIcon`**: renders its path at the size given.

**`CodecRow`**: the name, each chip, `—`, _Built-in_ for native and
_Installed_ for via-component; no button.

**`CodecManager`**: nothing while the report is `null`; the summary line and
one row per catalogued codec once it lands; the "no playback component"
line; nothing on a refused read.

**`PlaybackSection`**: the Codecs heading and both sentences; the Subtitles
heading and lede; _Turn on automatically_ with **Coming soon** and a disabled
switch that is off; the _Preferred language_ pill showing the fetched value
with the seven options; choosing one shows it at once and reverts on refusal;
the pill absent until the settings land.

**`StorageSection`**: the title; the path in the report; `18.4 GB` and `12
titles`; `1 title`; `0 B`; nothing but the title while the report is `null`.

**`AboutSection`**: _Family_, _Flix_, the defined version, the tagline; no
update row.

**`SettingsPage`**: the four group headings in order, over the five
sections.

No new frontend `test-support/` unit is anticipated; `fakeResponse`,
`freshStorage`, `sandboxRoot` and the fake component in the route tests
cover what is needed.

## Out of Scope

- **The Playback component upload** — the dashed _Add a codec pack_ zone, a
  writable slot ahead of the installer's, a two-file upload validated by
  running it, the component's own size and remove, and the drop zone's busy /
  refused / replaced states. Its own grill.
- **A per-row ✕** — deferred with the upload rather than contradicted; it
  returns as the component's remove in whatever geometry that session
  amends the prototype to.
- **_Change…_** — Electron's folder dialog and a move of the managed media
  directory: a storage model of its own with copy-in's stakes.
- **_Software update_** — the Electron initiative's `autoUpdater` and the
  Snackbar system's; the idle copy would be a lie without an updater.
- **Auto-on subtitles** — the toggle is drawn disabled and stores nothing;
  flipping it on is 🧭 roadmap, and would add a second settings key and a
  sibling route then.
- **A subtitle track picker in the player** — the preference chooses; nobody
  picks.
- **Validating the preference against the pool** — a display vocabulary, not
  a constraint.
- **An "unsupported" row** for a catalogued codec nothing decodes — absence
  is the report's own rule.
- **Memoising the decoder listing or caching the space walk** — a few hundred
  milliseconds and a directory walk per Settings visit, on the maintainer's
  screen; the fix is known if it is ever felt.
- **A skeleton, an error face, or a snackbar** on any of the three reads.
- **`GET /api/about`** — the version is a build-time constant.
- **Any change to the Library group.**

## Further Notes

**Trade-offs accepted.** Three of the prototype's controls are absent until
two later initiatives land, and the _Codecs_ description mentions one of them
in the meantime. `capabilities()` spawns `ffmpeg -decoders` on each visit and
`spaceUsed` walks the whole managed directory on each visit — acceptable for
the maintainer's screen, memoisable and cacheable if they are not. The size
cell is a column of dashes until the upload initiative decides what a
component's size means on a row. The codec report becoming a property of the
component the player uses is the one change to shipped playback code, and it
is what lets the upload initiative inherit a truthful screen for free.

**Implementation order**, from the log: the codec report end to end first —
`decoders()` on the seam, `capabilities(component)`, `Playback.capabilities()`,
the types promoted, the route; `MicrochipIcon`, `section.styles.ts` with
`GroupHeading` moved, `codecView`, `useCapabilities`, `CodecRow`,
`CodecManager`, `PlaybackSection` with the Codecs header, the page composing
it — the thinnest slice that puts a true row on the screen. Then the
Subtitles rows: `Toggle`, the Coming soon row, `SUBTITLE_LANGUAGES` promoted
and both spellings replaced, migration 3 and the `Storage` methods, the two
routes, `fetchSettings`, `saveSubtitleLanguage`, `useSettings`, the
dropdown, and `useSubtitles` honouring the preference. Then Storage:
`spaceUsed`, the route, `formatBytes`, `useStorageReport`, `StorageSection`.
Then About: `__APP_VERSION__`, `AboutSection`. Then docs — COMPONENT-SPEC's
`CodecManager` and `SettingsPage` rows, the glossary, the feature tables, the
journal — and the refactor pass, with the feature table ticking only after
it: **Settings shell** ✅, **Subtitle preferences** ✅, **Storage** ✅
(_Change…_ noted as Electron's), **Codec manager** split into _view installed
codecs_ ✅ and _add a playback component_ 🔜, **Software update** 🔜.

Design log: `docs/design-logs/15-settings-hub.md`.
