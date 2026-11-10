# Plan: Rebuild edges, a hand-kept sheet safe to keep by hand

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/563

What the maintainer keeps by hand comes back, whole and safely. A path cell
is read only when it is **contained** in its own row's Title folder; the
**Sheet reader** reads any Excel's **Sheet dialect** and the **Library sheet
writer** keeps it; a sheet the reader refuses is never replaced; every cell
the reader can't take is an **Unread cell**, one Warning line each; a held
title takes the art and tracks put into its folder later, on one scan; a
track named in its own language or with a region reads right; `POST /series`
refuses a **Held video**; and every sheet row is as wide as its header. No
second reader, no second writer, no new screen. It settles all ten findings
of QA ticket 562.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order.** No phase is
HITL: no screen changes, no client change, no prototype amendment, no
decision left open (the maintainer approved every recommendation of log 60
in advance; this plan adds none).

- The phases are log 60's _Implementation Plan_ slices, five of them
  thinned: slice 1 into the reader's rule (phase 1) and both runs logging it
  (phase 2); slice 3 into `writeSheet`'s separator (phase 4), the Library
  sheet keeping its dialect (phase 5) and an unreadable sheet left (phase
  6); slice 4 into every column's Unread cell (phase 7) and duplicates
  (phase 8); slice 5 into a held film's art (phase 9), tracks by language
  (phase 10) and the fill's order with its `✓ Updated` line (phase 11);
  slice 7 into the series add's refusal (phase 13) and rectangular rows
  (phase 14).
- **Each finding starts from its own RED test** reproducing it (the
  ticket's baseline on `57b91cc1`: no existing test catches any of them).
- **Each phase stays well under a 100k-token context.**
  `createImporter.ts` (~3k lines) and `routes/index.ts` (~3.5k lines) are
  large; a phase greps for the section it needs (`readMetaSheet`,
  `SheetRead`, `onBlankTitle`, `fillHeldArt`, `held === null`, `Updated`,
  `already plays this file`, `POST /series`) and reads only that range.
- No test runs Electron, FFmpeg or TMDB. Disk units run over temporary
  directories the suite creates; scans run over the importer's fixture
  library copied into a temporary Library folder. Sheet bytes for a
  foreign Excel (`;`, cp1252) are written by the test as raw bytes.
- The glossary already holds log 60's terms. The feature checklist's step 43
  row stays 🔜 until the refactor.

## Architectural decisions

Durable decisions that apply across all phases:

- **Schema**: none. No migration. Paths stay relative.
- **Routes**: none added, none removed. `POST /series` gains the movie add's
  `409 <Title> already plays this file.` No client changes.
- **Domains**: none added. `sheetDialect` lives in import-export,
  `detectSubtitleLanguage` stays in media, `heldVideoRefusal` in routes.
- **Key models**:
  - `sheetDialect(bytes) => { encoding: 'utf-8' | 'windows-1252';
separator: ',' | ';' }`, pure. A UTF-8 BOM or valid UTF-8 is UTF-8,
    else cp1252; `;` when the header row holds more `;` than `,` outside
    quotes, else `,`. No tabs or other separators. An xlsx has no dialect.
  - `SheetSkip`: `blank-title { rowNumber }`, `unread-cell { label, column,
text }` or `duplicate { label }`. `readSheet` takes `onSkip(skip:
SheetSkip)` in place of `onBlankTitle(rowNumber)`; `skipLine(skip)`
    gives each its Log line text. Both the upload and the Folder scan log
    every skip through it.
  - `writeSheet(table, format, separator = ',')`; a `;` separator writes
    decimal commas with it. CSV output is UTF-8 behind a BOM.
  - `LibrarySheet { touch, hold, release, flush }` is unchanged in shape.
  - `fillHeldArt` is retired, widened to `fillHeldFiles`.
  - `heldVideoRefusal(storage: Pick<LibraryStorage, 'titleHolding' |
'getMovie' | 'getSeries'>, placed: readonly (StoredVideo | null)[]) =>
string | null`. Storage holds no wording.
- **The rules**:
  - A path cell is **contained** when it is relative, its first segment is
    the row's Folder key by `sameFolderKey`, no segment is empty, `.` or
    `..` or holds `\` or `:`, and it names its kind (`isImageFilename` for
    `Poster`, `Backdrop`, `Still`; `isSubtitleFilename` for each
    `Subtitles` path). `Video` is unchecked. The check is lexical, made once
    by the reader, and needs no disk. A refused cell is blank and an Unread
    cell.
  - A number cell is `-?\d+([.,]\d+)?`, the comma read as the point, in any
    sheet.
  - `Status` and `Favorite` read only their yes-lists and spelled no-lists;
    no new synonyms. An unknown `Type` is read as Movie and reported.
  - Of two rows with the same Row type, Folder key, season and episode, the
    first is read.
  - The Library sheet writer rewrites in the dialect it found on disk; a
    new sheet and every Export are `,`; a sheet the reader refuses is never
    replaced.
  - A held title's files fill only empty places and add only tracks of
    languages it holds none of; never replacing, no review row.
- **Copy** (the handoff's _Copy_ table, one line each, never a Problem):
  - Unread cell: `⚠ Heat (1995): Rating "8½" not read`;
    `⚠ Tidewater (2018) Season 1: Poster "x.txt" not read`;
    `⚠ Tidewater (2018) S01E02: Status "half" not read`.
  - Duplicate: `⚠ Heat (1995) is in the sheet twice, the first row read`.
  - Titleless row (both runs): `⚠ Row 12 has no title, skipped`.
  - Unreadable Meta sheet:
    `⚠ Could not read <path>, scanned without it and left as it is`.
  - Held files: today's `✓ Updated` line, naming `poster`, `backdrop`,
    `season posters`, `stills`, `subtitles` beside its Sheet fills.
  - Series add: `409 Tidewater already plays this file.`
  - Unchanged: the Layout fill's `↓` line keeps the path under its Library
    folder's root.

---

## Phase 1: A path cell stays inside its Title folder

**User stories**: 1 to 8, 12

### What to build

The Sheet reader checks every path cell lexically against its own row: the
first segment must be the row's Folder key (compared by `sameFolderKey`, so
another Excel's casing still reads), no segment empty, `.` or `..`, none
holding `\` or `:`, and the file must name its column's kind: an image for
`Poster`, `Backdrop` and `Still`, a subtitle for each `Subtitles` path. A
cell that fails is read as blank and reported through the reader's skip
callback as an `unread-cell` skip. `Video` passes unchecked. `onBlankTitle`
becomes `onSkip` with `SheetSkip`; callers keep logging the titleless row as
today. Demo: a sheet row whose `Poster` is `../secret.txt` reads with no
poster and reports one Unread cell.

### Acceptance criteria

- [ ] `../secret.txt`, a foreign Folder key, an empty or `.` or `..`
      segment, a `\` and a `:` each read as blank and give one
      `unread-cell` skip.
- [ ] A Folder key cased differently from the row's still reads.
- [ ] A non-image in `Poster`, `Backdrop` or `Still`, and a non-subtitle
      among `Subtitles`, read as blank and are reported; the other
      `Subtitles` paths in the cell still read.
- [ ] `Video` is read unchecked.
- [ ] `onBlankTitle` is gone; `onSkip` reports `blank-title` as it did.

---

## Phase 2: Both runs log every skip

**User stories**: 9 to 11, 42, 43

### What to build

`skipLine(skip)` gives each `SheetSkip` its Log line text, as the handoff's
_Copy_ table spells it, naming a Movie or Series row by its Folder key, a
Season row by its season and an Episode row by its tag. _Import from
spreadsheet_ and the Folder scan's Meta sheet read both pass `onSkip` and
log every skip by `skipLine`, so a Meta sheet's titleless row is no longer
silent. Demo: the ticket's Ronin repro copies nothing into managed storage,
writes nothing into the Title folder, and its log names both refused cells.

### Acceptance criteria

- [ ] `skipLine` gives the handoff's text for `blank-title`, an
      `unread-cell` on a Movie, Series, Season and Episode row, and
      `duplicate`.
- [ ] The Ronin repro, by Folder scan and by upload, copies nothing into
      the Managed media directory and writes nothing into the Title folder.
- [ ] Both runs log `⚠ Ronin (1998): Poster "../secret.txt" not read`
      and the refused `Subtitles` path.
- [ ] A Folder scan's Meta sheet with a titleless row logs
      `⚠ Row 12 has no title, skipped`.

---

## Phase 3: Any Excel's sheet reads

**User stories**: 13 to 19

### What to build

`sheetDialect` reads a CSV's encoding and separator off its bytes. The Sheet
reader's workbook opener decodes a CSV by its dialect and hands `exceljs`
the separator; an xlsx opens as today. A number cell takes a decimal comma
in any sheet. Demo: the ticket's Heat repro (rated and hearted, resaved
`;`-separated and cp1252, Factory reset, rescanned) rebuilds with its
rating and heart, and `Amélie (2001)` matches its folder.

### Acceptance criteria

- [ ] `sheetDialect`: BOM UTF-8, BOM-less valid UTF-8, cp1252 bytes
      (`Am\xe9lie`), a `;` header, a `,` header, and a `;` inside a quoted
      header cell not counted.
- [ ] A `;`-separated cp1252 sheet reads whole, `Amélie (2001)` spelled
      right.
- [ ] `8,5` reads as a Rating of 9 (8.5 rounded as today); `7,9` as a TMDB
      rating of 7.9.
- [ ] An xlsx reads as before.
- [ ] The Heat repro rebuilds with its rating and heart.

---

## Phase 4: The Sheet writer takes a separator

**User stories**: 20, 21

### What to build

`writeSheet` takes a separator, `,` by default. A `;` separator writes the
CSV `;`-separated with decimal commas in its number cells. A `,` sheet's
bytes are unchanged. CSV output stays UTF-8 behind a BOM. Demo: a table
holding a TMDB rating of 7.9 writes as `7,9` under `;` and `7.9` under `,`.

### Acceptance criteria

- [ ] A `;` separator writes `;` between fields and decimal commas.
- [ ] A `;` field holding `;` is quoted.
- [ ] The default `,` output is byte for byte as before.
- [ ] Both are UTF-8 behind a BOM.

---

## Phase 5: The Library sheet keeps its dialect

**User stories**: 20, 22 to 24, 28

### What to build

The Library sheet writer already reads the file on disk to skip equal bytes;
it now takes that file's Sheet dialect and rewrites in its separator, always
UTF-8 behind a BOM. A brand-new Library sheet is written `,`; an Export
always `,`, whatever the Library sheet's dialect. The Round trip acceptance
test gains a `;` case. Demo: a `;` sheet is rewritten `;` with `7,9` after a
rating change; a cp1252 sheet is rewritten UTF-8.

### Acceptance criteria

- [ ] A `;` Library sheet is rewritten `;` with decimal commas.
- [ ] A cp1252 sheet is rewritten UTF-8 behind a BOM, its accents intact.
- [ ] A new Library sheet is `,`.
- [ ] An Export is `,` from a folder whose Library sheet is `;`.
- [ ] The Round trip holds over a `;` sheet with decimal commas: Factory
      reset, rebuilt, equal, and rewritten byte for byte `;`.
- [ ] The `,` Round trip still holds.

---

## Phase 6: A sheet that doesn't read is left alone

**User stories**: 25 to 27

### What to build

The Library sheet writer never replaces a sheet on disk that the Sheet
reader refuses; it is left until it reads or the maintainer removes it, as
a New folder's sheet is. A Folder scan whose Meta sheet doesn't read logs
`⚠ Could not read <path>, scanned without it and left as it is`. Demo: a
corrupt sheet survives a rating change byte for byte.

### Acceptance criteria

- [ ] A corrupt sheet is byte for byte the same after a touch and a flush.
- [ ] Once the sheet is fixed (or removed), the next touch writes it.
- [ ] A Folder scan over it logs the `left as it is` line and never a
      Problem.

---

## Phase 7: Every cell the reader can't take is named

**User stories**: 29 to 40, 44

### What to build

The Sheet reader reports an `unread-cell` skip for every filled cell it
can't take: `Year`, `Season`, `Episode`, `Rating`, `Runtime`, `TMDB rating`,
`TMDB id` and `Air date` when unparseable; an unknown `Type`, still read as
Movie; `Status` outside its yes-list and spelled no-list (`no`, `false`,
`0`, `unwatched`, `in progress`); `Favorite` outside its yes-list and no-list
(`no`, `false`, `0`); and a filled Episode row `Synopsis`, which is not an
episode's field. A genre outside the pool keeps its own line. The header
keeps `Synopsis`, blank on Episode rows. Demo: the ticket's finding 7 table
(`8,5`, `7,9`, `ja`) reads or says each one.

### Acceptance criteria

- [ ] Each listed number or date column, filled and unparseable, is one
      `unread-cell` skip and reads as blank.
- [ ] An unknown `Type` reads as Movie and is reported.
- [ ] `Status` `half` and `Favorite` `ja` are reported; each no-list word
      reads as no without a skip.
- [ ] A filled Episode `Synopsis` is reported; the written sheet keeps the
      column, blank on Episode rows.
- [ ] A genre outside the pool gives only its existing line.
- [ ] Both runs log each as one Warning line.

---

## Phase 8: Two rows for one title, the first read

**User stories**: 41, 44

### What to build

Two rows with the same Row type, Folder key, season and episode: the Sheet
reader reads the first and reports a `duplicate` skip, logged as
`⚠ Heat (1995) is in the sheet twice, the first row read`. Demo: the
ticket's finding 7 table's second Heat row is named and ignored.

### Acceptance criteria

- [ ] The first of two identical-key rows is read; the second is not.
- [ ] One `duplicate` skip per repeated row, logged by both runs.
- [ ] Rows differing only in season or episode are both read.

---

## Phase 9: A held film's empty art is filled

**User stories**: 45 to 48, 52

### What to build

`fillHeldArt` is widened to `fillHeldFiles`. A rescan fills a held film's
empty poster and backdrop from its Title folder's read, its path cells
filling an empty place first, as a new film's do. Art it already has (a
Sync's or a hand pick) is never replaced, and the fill adds no review row.
Demo: a poster and backdrop dropped into a held film's `Images/` reach the
library on one _Scan all_.

### Acceptance criteria

- [ ] A held film with no poster or backdrop takes them from its folder on
      a rescan.
- [ ] A contained path cell fills an empty place before the folder's read.
- [ ] A held film's existing poster or backdrop is never replaced.
- [ ] No review row is added.
- [ ] `fillHeldArt` is gone and nothing imports it.

---

## Phase 10: A held title takes the tracks it lacks

**User stories**: 49 to 51

### What to build

A rescan adds each track in a held film's folder, and in each held
episode's place, whose language the title holds none of. A track of a
language it already holds is never added, so a track the Layout fill wrote
out is never read back as a second copy. Demo: `Subtitles/English.srt` put
into a held film's folder later is read.

### Acceptance criteria

- [ ] A held film with no English track takes `Subtitles/English.srt`.
- [ ] A held episode takes a track of a language it lacks.
- [ ] A track of a held language is not added, for a film or an episode.
- [ ] A rescan after the Layout fill adds no second track.

---

## Phase 11: Held files land on one scan, and the log says so

**User stories**: 53 to 56

### What to build

`fillHeldFiles` runs after the run's new episodes are in, walking every
season the series then holds, so a season the same run adds gets its
Season poster on that scan. The in-loop Season poster stays for a new
series only. A held title's `✓ Updated` line names what it took (`poster`,
`backdrop`, `season posters`, `stills`, `subtitles`) beside its Sheet
fills, film and series alike; a filled series is no longer logged _Already
in library_. Demo: the ticket's Heat repro (poster, backdrop and track
added) and Sev repro (Season 02 with its poster) each land on one _Scan
all_.

### Acceptance criteria

- [ ] The Sev repro's Season 2 poster is set on the scan that adds Season
      2's episodes.
- [ ] A held series' Season poster is set in one place only.
- [ ] The Heat repro fills poster, backdrop and track on one scan.
- [ ] Each held title's `✓ Updated` line names exactly what was taken and
      its Sheet fills.
- [ ] A held series with files taken is not logged _Already in library_.

---

## Phase 12: A track named in its own language reads right

**User stories**: 57 to 61

### What to build

`detectSubtitleLanguage` reads each pool language's own name (`español`,
`français`, `deutsch`, `português`, `italiano`, `nederlands`), matched with
diacritics folded, and reads past a two-letter region after a known code
(`pt-BR`, `en_GB`). No language library: the seven pool names only. Demo: a
folder holding `English.srt` and `Nederlands.srt` gives one English and one
Dutch track; `heat.pt-BR.srt` is Portuguese.

### Acceptance criteria

- [ ] Each endonym reads as its language, `Espanol` and `Francais` too.
- [ ] `pt-BR` and `en_GB` read as Portuguese and English.
- [ ] Today's cases read unchanged.
- [ ] A scan of `English.srt` and `Nederlands.srt` gives one English and
      one Dutch track.

---

## Phase 13: The series add refuses a held video

**User stories**: 62 to 64

### What to build

`heldVideoRefusal` is moved out of the movie route into its own unit:
given the placed videos, the 409 sentence naming the first held video's
holder, film or series, or `null`. `POST /series` calls it before anything
is written; the movie add calls the same unit. Demo: the ticket's Tidewater
`POST /series` with a held episode video is a
`409 Tidewater already plays this file.`

### Acceptance criteria

- [ ] `heldVideoRefusal`: `null` for unheld and null videos; the first held
      video's holder named, film or series.
- [ ] `POST /series` linking a held episode video is a 409 with the
      sentence.
- [ ] A refused series add leaves no series, no row and no numbered
      `Tidewater (2018) (1)` Folder key.
- [ ] The movie add's 409 is unchanged.

---

## Phase 14: Every sheet row is as wide as its header

**User stories**: 66, 67

### What to build

`writeSheet` pads every row of both sheets, the Library sheet and the
Export, to its header's width, so a Season row under the 22-column header
has 22 fields. Every Library sheet on disk is rewritten once at its next
touch and then stays still. Demo: every row of both sheets has 22 fields.

### Acceptance criteria

- [ ] Every written row, `,` or `;`, has as many fields as the header.
- [ ] The Round trip still holds byte for byte, `,` and `;`.
- [ ] A padded sheet touched again writes nothing.

---

## Phase 15: The documents

**User stories**: 65, 68 to 71

### What to build

A dev-journal line corrects log 58 Q13's Episode Synopsis tick, since a log
is immutable. The docblocks of `readSheet`, `writeSheet`,
`createLibrarySheet`, `createImporter`, `detectSubtitleLanguage` and
`pathCellFills` say what each now does and name their glossary terms. The
glossary is checked against the built names and amended where the build
moved off them. The Layout fill's `↓` line is confirmed unchanged. The
feature checklist's step 43 row is written to what was built and stays 🔜
until the refactor. CLAUDE.md is untouched.

### Acceptance criteria

- [ ] The dev journal holds the log 58 Q13 correction.
- [ ] Every listed docblock names **Sheet dialect**, **Unread cell**,
      **Sheet reader**, **Sheet writer**, **Library sheet writer**, **Held
      video**, **Path cells** or **Language pool** as it uses them.
- [ ] `docs/ubiquitous-language.md` matches the built names.
- [ ] Step 43's row in `docs/feature-checklist.md` describes the build and
      is still 🔜.
- [ ] The `↓` line still names the path under its Library folder's root.
- [ ] CLAUDE.md is unchanged.
