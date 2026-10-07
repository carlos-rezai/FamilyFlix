# Plan: Add a series — the Movie form adds a show with its episodes, and Save needs a video

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/260

Today the only way to get a show into FamilyFlix is Bulk import. Log 29 has
the **Movie form** at `/add` add either kind of title. A **Kind tabs** switch,
_Movie_ / _Series_, sits in the form's header. A series is its metadata, a
poster and a list of **Episode file rows**, and it is saved in one
all-or-nothing request. The same initiative changes the Save rule for both
kinds: a title with no video behind it is refused by the form and by the
server alike.

The slicing goes from the gate out:

**the video gate for movies** (Phase 1) → **the Kind tabs and the series
form's surface** (Phase 2) → **a series saved with its episodes** (Phase 3) →
**episode subtitles** (Phase 4) → **the close** (Phase 5).

The log's plan had three phases. Its Phase 2 is split here into Phases 2
and 3, because it held about fifteen units across the prototype, the client
and the server.

## Running the phases

Phases 1–4 run AFK under `issue-loop`, following the Default poster plan.

- **No prototype-only slice.** The prototype amendment (log 29 Q30) goes into
  Phase 2's **build** step, as the PRD asks. The GREEN subagent amends
  `docs/handoff/` first and then builds to the amended files. Both land in the
  slice's `feat:` commit, so Phases 3 and 4 build against a prototype that is
  already amended. The amendment covers the whole initiative:
  - `feat.MovieForm.dc.html` gets the Kind tabs in the header row, the series
    wording, and the series Files card with its Episode file rows, each row's
    _＋ Add subtitle_, and _＋ Add episode files_.
  - `mol.EpisodeFileRow.dc.html` is added, with its `data-props`.
  - `mol.PillTabs.dc.html` is added. It is extracted from
    `page.LibraryPage`'s track, which then imports it.
  - `COMPONENT-SPEC.md` gets the two molecules and the gate rule.
  - `feat.SettingsHub` gets _Add a title_ and the row's new line.
- **No HITL marks in Phases 1–4.** Every acceptance criterion is a Vitest
  assertion, a typecheck or a file diff. Adding a real season through the
  running app is the maintainer's own check after Phase 3. Nothing waits on
  that check.

Phase 5 is docs-only, so the loop stops there by design. Per the standing
rule, a feature is Done only after its refactor. The close is therefore the
refactor's last commit, made after `request-refactor-plan` and `refactor`.

---

## Architectural decisions

Durable decisions that apply across all phases.

- **Client routes.** `/add` stays one screen and one organism, `MovieForm`.
  - The kind is held as `?kind=series`, written as a `replace` and omitted
    for `movie`. This is the library tabs' rule.
  - `?kind=` is read only on a plain add. Beside `?movie=` or `?problem=` it
    is ignored, and no tabs are drawn.
  - A series add lands with a push on `/?tab=series`, the series kind's
    **Fresh home**. A movie add still lands on the library.
- **HTTP routes.**
  - **`POST /api/series`** (new) takes `multipart/form-data`, streamed with
    `busboy`. Its parts come in this order:
    1. The series fields: `title`, `year`, `creator`, `cast`×n,
       `description`, `genre`×n, `rating`.
    2. `poster`.
    3. For each episode: an `episode` field holding JSON
       `{ season, number, title, subtitleLanguages }`, then its
       `episodeVideo` part, then its `episodeSubtitle` parts.

    The k-th `episodeVideo` belongs to the k-th `episode` field. Its
    `episodeSubtitle` parts pair with `subtitleLanguages` by order. On
    success it answers `201 Series`. Every refusal is a `400` with one
    sentence, and a duplicate is spelled through `spellEpisodeTag`
    (`Duplicate episode: S01E03`).

  - **`POST /api/movies`** refuses a body with no video part:
    `400 Body must carry a video`, the resolve route's sentence.
  - **`PATCH /api/movies/:id`** refuses a body whose video is neither a part
    nor a non-empty `videoPath`, with the same sentence.

- **Schema.** No migration. A form-added series is written to the same
  `series`, `episodes`, `series_genres` and `episode_subtitles` tables an
  imported one is.
- **Storage.**
  - The **Series folder** is reserved when the first file part needs it. The
    title and year arrive before any bytes.
  - Each episode's video and subtitles land in its `seasonFolder`
    (`season-NN/`).
  - Any refusal or failure removes the whole Series folder.
  - **No row is written until every byte has landed.**
- **Write.** `SeriesWrite.addSeries(input, episodes?)` writes the series, its
  genres, its episodes and their subtitle tracks in one transaction. The
  importer keeps calling `addSeries(input)` and then `addEpisode`.
- **Key models** (`src/types/`):
  - `FormKind = 'movie' | 'series'`.
  - `EpisodeFormRow { key; file: MovieFormFile; season: string; number:
string; title: string; subtitles: MovieFormSubtitle[] }`. The season and
    number are held as typed strings.
- **Year.** `yearSpan` (`server/src/library/series/`) reads `2019`,
  `2019–2023`, `2019-2023` and `2021–` into `{ year, endYear }`, and anything
  else into `null`. It is the one reader of a series year, and `readSheet`
  reads through it too. An unreadable year is stored as no year rather than
  refused.
- **The Episode tag on two sides.** The client's `readEpisodeTag` and the
  server's `episodeTag` stay two functions. A drift guard in the spec project
  runs both over one shared table of filenames.
- **Save gates.**
  - Movie: a title and a picked video.
  - Series: a title, at least one episode, every row's season ≥ 1 and
    number ≥ 1, and no duplicate (season, number) pair.
  - A closed Save is a disabled button and nothing more.

---

## Phase 1: The video gate, for movies

**User stories**: 40–43, 50, 57, 58

### What to build

A movie needs a video, on the form and on the wire. Nothing on screen
changes.

- **`titleFromFilename`** (pure, feature-local) drops the extension, turns
  dots and underscores into spaces, and drops everything from the first year,
  quality tag or episode tag onward. It is the client's counterpart of the
  importer's `titleGuess`.
- **The title prefill.** Picking a video into an empty title fills the title
  through `titleFromFilename`. A typed title is never overwritten. Clearing
  the title closes Save again.
- **The movie routes.**
  - `POST /api/movies` with no video part is refused with
    `400 Body must carry a video`. The check runs after the title check and
    before any row is written, and it rolls back any file that landed.
  - `PATCH /api/movies/:id` with no video part and an empty `videoPath` gets
    the same refusal.
  - A `PATCH` carrying the held path still passes.

When this phase is done, a maintainer picks only `The.Long.Fare.2019.1080p.mkv`.
The title reads _The Long Fare_, Save opens with no poster, and the film lands
on the library.

### Acceptance criteria

- [ ] `titleFromFilename` passes over a table of filenames: release-style
      dots, underscores, a year, a quality tag, an episode tag, and no
      extension.
- [ ] `MovieForm`:
  - [ ] A video picked into an empty title fills the title.
  - [ ] A video picked over a typed title leaves the title alone.
  - [ ] Save opens on a title and a video, with no poster.
  - [ ] Clearing the title closes Save.
- [ ] `POST /api/movies` with no video part answers
      `400 Body must carry a video`. No row is written and no Movie folder is
      left behind.
- [ ] `PATCH /api/movies/:id` with no video part and an empty `videoPath`
      gets the same answer, and the movie is unchanged.
- [ ] A `PATCH` that carries the held `videoPath` still answers `200`.
- [ ] The existing movie-form and route suites pass.
- [ ] `npm run typecheck`, `eslint` and the full Vitest run are green.

---

## Phase 2: The Kind tabs and the series form's surface

**User stories**: 2–6, 9–13, 16–18, 44, 54–56, 63

### What to build

The form learns it has two kinds. A series can be described, but nothing can
be saved yet.

- **Prototype.** The whole initiative's amendment, as listed under _Running
  the phases_, lands first.
- **`PillTabs`** (new molecule, `components/`) takes
  `{ label, options: { value, label }[], value, onChange }`. It renders
  `aria-pressed` buttons in a labelled `group`, drawn exactly as the
  library's track is today. It is presentational, with no URL. `LibraryTabs`
  composes it and keeps its own `tab` write, and `LibraryTabs`' styles file
  goes away.
- **The Kind tabs.**
  - `PillTabs` with _Movie_ / _Series_ sits after the heading in the form's
    header row, pushed to the row's end.
  - A press writes `?kind=series` as a replace, so Back still leaves the form
    in one press.
  - The form opens on Movie by default.
  - The tabs are drawn only on a plain add.
- **The series wording**, per the PRD's table: the heading, the lede, the
  title, year and description placeholders, and _Created by_ / _Creator name_.
  The series year field takes digits and one dash (an en dash or a hyphen),
  at most nine characters.
- **`SeriesFormFiles`** (feature-local, `MovieFormFiles`' shape) holds the
  _Files_ caption, the Poster File field and the _Episodes_ label. It has no
  backdrop slot. Episode rows and _＋ Add episode files_ arrive in Phase 3.
- **One record, two kinds' files.**
  - Title, year, creator/director, cast, synopsis, genres, rating and poster
    carry across a switch.
  - The movie's video and subtitles are kept while Series is on screen.
  - Save is closed on Series, because the series gate needs an episode.
- **Entrances.** The Settings header's ＋ and the Library group's row read
  _Add a title_, and the row's line reads _A movie or a series, with its
  files._ Both still open `/add` on the movie kind.

When this phase is done, a maintainer opens _Add a title_ and presses
_Series_. The URL reads `?kind=series`, the heading reads _Add a series_, and
the director field reads _Created by_. They press _Movie_ again and find
everything they typed and the video they picked still there.

### Acceptance criteria

- [ ] The prototype amendments and the `COMPONENT-SPEC.md` entries land in the
      slice's `feat:` commit.
- [ ] `PillTabs`:
  - [ ] It renders a labelled group of `aria-pressed` buttons, with the
        current one pressed.
  - [ ] A press calls `onChange` with the option's value.
  - [ ] Its resolved styles match today's track.
- [ ] `LibraryTabs`' existing suite passes unchanged on `PillTabs`.
- [ ] `MovieForm`:
  - [ ] A plain add draws the Kind tabs with _Movie_ pressed.
  - [ ] Pressing _Series_ writes `?kind=series` as a replace, and pressing
        _Movie_ removes it.
  - [ ] `?kind=series` opens the series wording and `SeriesFormFiles`.
  - [ ] The series year field accepts `2019–2023`, `2019-2023` and `2021–`,
        and refuses letters and a tenth character.
  - [ ] A switch either way keeps the shared fields, the poster, and the
        movie's video and subtitles.
  - [ ] Save is disabled on Series.
  - [ ] With `?movie=` or `?problem=`, no tabs are drawn and `?kind=series`
        is ignored.
- [ ] `SettingsHeader` and `LibrarySection` read _Add a title_, with the row's
      new line.
- [ ] `npm run typecheck`, `eslint` and the full Vitest run are green.

---

## Phase 3: A series saved with its episodes, end to end

**User stories**: 1, 7, 8, 14, 15, 19–31, 35–39, 45–49, 51, 53, 59–62

### What to build

The thinnest complete path from a season's files on disk to a show on the
Series tab. Episodes carry no subtitles yet.

- **Client.**
  - **`readEpisodeTag`** (pure, feature-local) reads `S01E03`, `s1e3`,
    `1x03` and a multi-episode file's first number. It returns the season,
    the number and the cleaned title after the tag, or nothing.
  - **The drift guard** (spec project) runs `readEpisodeTag` and the server's
    `episodeTag` over one shared table and asserts they agree.
  - **`useEpisodeList`** (feature-local) holds the keyed rows.
    - `addEpisodeFiles(files)` inserts each pick in tag order. An untagged
      file goes to season 1 as the next free number. A second pick appends.
    - Rows are never re-sorted on an edit.
    - It exposes `setSeason`, `setNumber`, `setEpisodeTitle`,
      `removeEpisode` and `episodesComplete`.
  - **`EpisodeFileRow`** (new molecule, `components/`) is drawn in the File
    field's filled-row furniture. It has an `S` field (digits, at most 2), an
    `E` field (digits, at most 3), the title field (_Untitled episode_), the
    ✕, the filename in mono, and a children slot. It is presentational.
  - **`SeriesFormFiles`** gains the rows and _＋ Add episode files_, a
    multiple video picker.
  - **`useMovieForm`**:
    - The series gate is the title plus `episodesComplete`.
    - The title prefill extends to the first batch of episode files.
    - The series save goes through **`createSeries`**, shows _Adding…_, and
      lands on `/?tab=series`. A refusal keeps everything on the form.
- **Server.**
  - **`yearSpan`** is extracted from `readSheet`'s `cellYears`, and
    `readSheet` reads through it.
  - **`seriesFormBody`** (`server/src/routes/`, `movieFormBody`'s precedent)
    has two halves:
    - `readSeriesFields` reads the fields, with refusals as sentences.
    - `collectEpisodeUploads` applies the `fileKinds` checks and pairs parts
      by order.
  - **`addSeries(input, episodes)`** writes everything in one transaction.
  - **`POST /api/series`**:
    - It reserves the Series folder lazily and copies each video into its
      `season-NN/`.
    - It takes each episode's **Derived runtime** after its copy,
      best-effort.
    - It writes the rows only once every byte has landed.
    - It answers `201 Series`, or `400` with one sentence and nothing left
      behind.
  - The importer still adds new episodes to a show it already holds.

When this phase is done, a maintainer picks a season's twelve files and finds
them listed in episode order with their titles filled in. The series title
reads _Harbor and Vine_. They press _Add to library_ and land on the Series
tab, where the show opens to its season and episodes in order. Each episode
plays and shows its runtime.

### Acceptance criteria

- [ ] `readEpisodeTag` passes the cases `episodeTag`'s suite covers, and the
      drift guard passes over the shared table.
- [ ] `yearSpan` reads `2019`, `2019–2023`, the hyphen form and `2021–`, and
      gives `null` for junk. `readSheet`'s existing year cases pass
      unchanged.
- [ ] `EpisodeFileRow`:
  - [ ] It draws the numbers, the title, the filename and the ✕.
  - [ ] The number fields take digits only, within their lengths.
  - [ ] Edits and the ✕ call back.
  - [ ] Children render under the filename.
- [ ] `useEpisodeList`:
  - [ ] A tagged pick lands in tag order, prefilled.
  - [ ] An untagged file takes the next free number in season 1.
  - [ ] A second pick appends.
  - [ ] An edit does not re-sort.
  - [ ] Remove works.
  - [ ] `episodesComplete` is false for an empty list, a blank number,
        season 0 and a duplicate pair.
- [ ] `MovieForm` (series):
  - [ ] An episode pick into an empty title fills the title, and leaves a
        typed one alone.
  - [ ] Save follows the series gate.
  - [ ] A save sends the body in the contract's order, shows _Adding…_, and
        lands on `/?tab=series`.
  - [ ] A refused save keeps every field and row.
  - [ ] Episodes picked, then a switch to Movie and back, keeps the rows.
- [ ] `createSeries` sends its `FormData` parts in order, resolves the
      `Series` on `201`, and rejects on a refusal.
- [ ] `addSeries(input, episodes)`:
  - [ ] The series, its genres and its episodes are written together.
  - [ ] An unknown genre or a duplicate episode commits nothing.
  - [ ] `addSeries(input)` alone behaves as before.
- [ ] `POST /api/series` (route suite over a sandbox media root):
  - [ ] The happy path makes the Series folder with `season-NN/` placement,
        writes the rows and runtime, and answers `201 Series`.
  - [ ] Each `400` sentence is returned: no title, no episode, a bad
        `episode` field, a duplicate as `Duplicate episode: S01E03`, an
        episode with no video, a stray part, a refused file kind, and an
        unknown genre.
  - [ ] After any refusal, no row and no Series folder are left behind.
- [ ] The importer's suites pass unchanged.
- [ ] `npm run typecheck`, `eslint` and the full Vitest run are green.

---

## Phase 4: Episode subtitles

**User stories**: 32–34, 52

### What to build

Each Episode file row carries its own subtitles, end to end.

- **Client.**
  - `useEpisodeList` gains the per-row subtitle trio (add, set language,
    remove), on the movie subtitles' rule: English by default.
  - Each `EpisodeFileRow`'s children slot holds its Subtitle rows and its own
    _＋ Add subtitle_ picker.
  - `createSeries` sends each row's `subtitleLanguages` in its `episode` JSON
    and its files as `episodeSubtitle` parts after the row's video.
- **Server.**
  - `collectEpisodeUploads` pairs the `episodeSubtitle` parts with
    `subtitleLanguages` by order.
  - Each subtitle lands beside its episode's video.
  - `addSeries` writes the `episode_subtitles` rows in the same transaction.
  - A count mismatch, or a subtitle with no episode before it, is a `400`
    with nothing left behind.

When this phase is done, an episode added with an `.srt` plays with its
subtitles, exactly as an imported episode does.

### Acceptance criteria

- [ ] `useEpisodeList`: a row's subtitle can be added (English by default),
      have its language changed, and be removed, without touching other rows.
- [ ] `MovieForm`: each row draws its Subtitle rows and _＋ Add subtitle_
      under its filename.
- [ ] `createSeries`: each row's subtitle parts follow its video, and its
      languages are in its `episode` JSON in the same order.
- [ ] `addSeries(input, episodes)` writes the subtitle tracks in the same
      transaction, and a refused insert commits none.
- [ ] `POST /api/series`:
  - [ ] A subtitle is stored beside its episode in `season-NN/`, with its
        `episode_subtitles` row.
  - [ ] The episode read lists the track.
  - [ ] A stray `episodeSubtitle` or a language-count mismatch is a `400`
        with no row and no Series folder left.
- [ ] `npm run typecheck`, `eslint` and the full Vitest run are green.

---

## Phase 5: The close

**User stories**: none new. This phase is the initiative's paperwork.

### What to build

The docs that make the feature Done. Per the standing rule, this is the
refactor's last commit and not a build slice.

- In CLAUDE.md:
  - The folder tree names `PillTabs`, `EpisodeFileRow`, the movie form's new
    units (`useEpisodeList`, `readEpisodeTag`, `titleFromFilename`,
    `SeriesFormFiles`, `createSeries`), `seriesFormBody` and `yearSpan`.
  - The _Movie Import — One Form_ section says the form adds a series too,
    and that Save needs a video.
  - Step 13 and the _Add a series_ feature line are ticked ✅, and _(next)_
    moves to step 14.
- In the README, the same ✅.
- In the dev journal, an entry for the initiative. It records that log 22
  Q2's open item, a form for series, is closed.

### Acceptance criteria

- [ ] CLAUDE.md and the README tick step 13 ✅ and mark step 14 as next.
- [ ] CLAUDE.md's folder tree names every new unit.
- [ ] The dev journal carries the initiative's entry.
- [ ] Prettier passes over the changed docs.
