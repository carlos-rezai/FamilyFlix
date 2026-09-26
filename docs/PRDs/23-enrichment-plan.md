# Plan: Enrichment (TMDB) — fill what the sheet left blank

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/202

The library is in, and most of it is thin: no synopsis, no director, no cast,
posters only where a folder had one, backdrops almost nowhere, and episodes
that are numbers. The prototype revision of 2026-09-22 draws the feature
(COMPONENT-SPEC §5a). This initiative carries both 🔜 parts of build step 6 —
**Enrichment (TMDB)** and the **Network group** — because neither is usable
alone.

**Enrichment is a pass over the library already imported**, keyed by title
and year, never a second scanner. It is the first and only thing in the app
that goes online, and every test of it stays offline. The household
**Rating**, `watched`, `resume_position_seconds` and `last_watched_at` are
never written by it.

The slicing follows design log 23's six, with three of them split so every
phase is demoable on its own:

**the key** (Phase 1) → **_Just this movie_ for a Confident film** (Phase 2,
the tracer) → **the whole library** (Phase 3) → **Decisions: `ambiguous` and
`missing`** (Phase 4) → **Decisions: `conflict`** (Phase 5) → **series and
episodes** (Phase 6) → **remembering where titles came from** (Phase 7) →
**writing back into the collection** (Phase 8) → **from the import**
(Phase 9).

The log's tracer splits in two (the key alone is demoable and brings the
Snackbar stack its first caller), its Decisions slice in two (`conflict` is a
separate pure unit with its own face), and its write-target slice in two (the
importer's bookkeeping is visible before anything is written into the root).

There is **no Phase 0**: the prototype draws every surface here, and the two
reason strings flagged in the PRD (`missing`'s _…this title_, `ambiguous`'s
spelled-out count) are amendments to the prototype, not improvisations.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes (server)** — injected into the router as a sixth argument, so no
  route learns there is a TMDB:

  | Route                                                                        | Answer                                                                  |
  | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
  | `GET /api/tmdb/key`                                                          | `{ key: string \| null }`                                               |
  | `POST /api/tmdb/key { key }`                                                 | `200 { key }` · `400` empty · `422` refused · `503` unreachable         |
  | `GET /api/enrichment`                                                        | `EnrichmentSummary`                                                     |
  | `POST /api/enrichment { scope, movieId?, fields, writeSheet, writePosters }` | `201 EnrichmentRun` · `400` · `409` busy · `412` no key · `503` offline |
  | `GET /api/enrichment/current`                                                | `EnrichmentRun` · `404`                                                 |
  | `POST /api/enrichment/current/cancel`                                        | `204`                                                                   |
  | `POST /api/enrichment/current/decisions/:id/search { query }`                | `200 Decision`                                                          |
  | `POST /api/enrichment/current/decisions/:id/pick { tmdbId }`                 | `204`                                                                   |
  | `POST /api/enrichment/current/decisions/:id/apply { choices }`               | `204`                                                                   |
  | `DELETE /api/enrichment/current/decisions/:id`                               | `204` · `404`                                                           |

  `POST /api/import` accepts `enrich`. `GET /api/settings` is **not**
  widened — the key is read by `GET /api/tmdb/key` alone, so the player never
  carries it.

- **Routes (client)**:
  - `/enrich` — `pages/EnrichmentPage`, `MaintainerLayout` around
    `EnrichmentFlow`, `ImportPage`'s shape.
  - `?movie=<id>` → _Just this movie_; `?scope=all` preselects _Everything_.
  - **Landing**: the movie's path with a movie, else `/settings`. Back,
    _Done_ and _Back to the movie_ all follow the **Back rule**.
  - Ways in: Settings' sync row (push), the ⋯ menu (push), Import _Finish_
    with the box ticked (**replace** of `/import`). Start with no key and
    _Open Network settings_ push `/settings`.

- **Schema — migration 5**, additive, nothing seeded or backfilled:
  - `movies`, `series`: `original_title TEXT`, `tmdb_score REAL`,
    `source_folder TEXT` (relative to the Library root).
  - `episodes`: `still_path TEXT`.
  - `tmdb_id` (already present on both) finally gets a value.
  - Three new keys in the existing `settings` table: `tmdb-api-key`,
    `library-root`, `enrichment-last-synced-at` (ISO), read and written
    through the library's settings unit.

- **Key models** (a new enrichment type module, both build targets):
  - `EnrichField` — the ten chips: synopsis, poster, backdrop, runtime, year,
    genres, director, cast, originalTitle, tmdbScore.
  - `EnrichScope` — `missing` | `all` | `single`.
  - `EnrichmentSummary { total, complete, lastSyncedAt, keySet, online,
libraryRoot }` — `complete` is **Full details**: a synopsis and a poster.
  - `Candidate { tmdbId, title, year, genre, language, posterUrl, score }`.
  - `FieldConflict { field, label, mine, tmdb }`, `field` one of the five
    conflictable: synopsis, year, genres, director, cast.
  - `Decision { id, title, reason, path }` & one of `ambiguous { query,
candidates }`, `missing { query }`, `conflict { fields }`.
  - `EnrichmentRun { id, phase ('running' | 'review'), scope, startedAt,
total, done, enriched, currentItem, log, decisions, written: { sheet,
posters } }`.
  - `ImportRun` gains `enrich: boolean`. Movie and Series gain
    `originalTitle`, `tmdbScore`; Episode gains `stillPath`. `sourceFolder`
    stays server-side.

- **Domain placement**: a fifth server domain, `enrichment/` — nothing in
  `library/`, `media/`, `import-export/` or `playback/` becomes a network
  client. One folder per unit: the TMDB client (the injected seam over an
  injected `fetch`), key-shape auth, genre mapping, match scoring, fetched
  fields, field planning, write-back, and the domain itself — one **Current
  enrichment run** in memory as closures, `createImporter`'s shape. The
  **Title key** is imported from `import-export/`.

- **Matching**: **Confident** is exactly one candidate with an equal Title key
  and, when the title has a year, an equal year. A title holding a `tmdb_id`
  is fetched by id and never searched again. Answers are `en-US`, fixed.

- **Genres**: TMDB names mapped onto the twelve of the **Genre pool** —
  _Science Fiction_ → Sci-Fi, TV compounds split, the rest dropped. The pool
  never grows.

- **Images**: poster, backdrop and stills are **downloaded into the title's
  folder in managed storage** (`poster.jpg`, `backdrop.jpg`,
  `<episode stem>.still.jpg` in the season folder). The only images drawn
  straight from `image.tmdb.org` are review candidates (`w185`) over the
  Gradient fallback.

- **Write targets**: the database always; the **Metadata sheet**
  (`familyflix-metadata.csv`, the Export file, films A–Z) at the Library root
  and `poster.jpg` in each Source folder, each a toggle, each checked for
  write permission with a dry-run log line first, **neither ever replacing a
  file that exists**, nothing else ever written into the root.

- **Frontend placement**: `features/enrichment/` in `import-export/`'s shape
  (the organism, the three steps, its own molecules, `useEnrichmentRun`,
  `useEnrichmentSummary`, the pure `enrichmentView`, `api/`); ❌ reusing
  `FormatCard` or `StatTile` — different pixels. Settings gains
  `NetworkSection` and `useTmdbKey`. `fetchEnrichmentSummary` lives in the
  shared `src/api/` (Settings' row and the setup both call it).

- **Snackbars**: through the existing `useSnackbar()`, plain 5 s notices —
  the Snackbar stack's first callers.

- **Testing boundary**: no test goes online — every domain test drives a fake
  `fetch` or a fake client, image streams are fakes, write-back runs in a
  sandbox. Behaviour through public interfaces only; snackbars asserted
  through the real `SnackbarProvider` and `snackbarStack`. Each surface phase
  is checked visually against the prototype.

---

## Phase 1: The TMDB key

**User stories**: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 102

### What to build

The Network group, end to end. The settings unit learns to read and write
`tmdb-api-key`. A key's shape decides how it is sent — a JWT-shaped string is
a v4 Read Access Token sent as a Bearer header, anything else a v3 API key
sent as `api_key` — and the TMDB client, built over an injected `fetch`, can
authenticate a key and answer _accepted_, _refused_ (`401`) or _unreachable_
(network error or timeout) as values. `POST /api/tmdb/key` is **the test and
the save in one**: the key is stored only when TMDB accepts it; `GET
/api/tmdb/key` answers the stored key.

Settings draws a fifth group between Playback and Storage on the shared
section furniture: _The Movie Database (TMDB)_, its status pill, the lede
("Nothing is sent about your household — just movie titles, to look up
posters and synopses"), the masked key field in mono, and _Test connection_
reading _Testing…_ while it asks and _Test again_ once connected. The pill
reads _Connected_ while the stored key is in the field and _Not set up_ the
moment it is edited. The four notices: _Paste a key first._ (warning),
_Connected to TMDB._ (success), _TMDB didn't accept that key._ (error),
_Couldn't reach TMDB._ (error).

### Acceptance criteria

- [ ] A v3 key is sent as `api_key`, a v4 token as `Authorization: Bearer`.
- [ ] The client answers accepted, refused and unreachable as values over a
      fake `fetch`; nothing in the suite goes online.
- [ ] `POST /api/tmdb/key` stores only an accepted key, and answers `400`,
      `422` and `503` as the table says; `GET /api/tmdb/key` answers it or
      `null`.
- [ ] `GET /api/settings` does not carry the key.
- [ ] The Network group sits between Playback and Storage and matches the
      prototype: lede, masked mono field, pill, button labels.
- [ ] A stored key comes back masked with the pill _Connected_; editing it
      flips the pill to _Not set up_.
- [ ] Each of the four outcomes raises its notice in the Snackbar stack.

---

## Phase 2: Tracer — _Just this movie_ for a Confident film

**User stories**: 19, 25 (the movie half), 34, 53, 54, 55, 62, 79, 97, 98,
99, 100

### What to build

The tracer through every layer. Migration 5 adds its columns. The client
learns movie search and movie detail with credits, and image streams. A
fetched movie becomes our columns — Director the first credit whose job is
Director, cast the top ten, TMDB's score to one decimal, genres mapped onto
the pool. Planning fills every empty field for the chips that are on;
original title and TMDB score are always written when their chip is on. The
library gains an enrich write for a movie that touches only the columns it
names, and `Media` gains a member that stores a stream under a given name in
a title's folder.

The domain starts a `single`-scope run over one movie: fetched by id when it
holds a `tmdb_id`, else searched by title and year; a Confident result is
written — columns, `tmdb_id`, and `poster.jpg` / `backdrop.jpg` into its
Movie folder — and the run reaches review. `POST /api/enrichment` and `GET
/api/enrichment/current` answer it.

The movie's ⋯ menu gains _⟳ Fetch from TMDB_ between _Edit details_ and the
Danger row, pushing `/enrich?movie=<id>`. The page shows setup with the _Just
this movie_ card in place of the two library scopes, a bare running state
while it polls, and review's _All done_ with _Back to the movie_, which
follows the Back rule to the movie. A tracer film from the dev fixture comes
back with its synopsis, credits, poster and backdrop drawn offline.

### Acceptance criteria

- [ ] Migration 5 applies to a fresh and to a v4 database; nothing is
      backfilled.
- [ ] Fetched fields map Director, cast (top 10), score (one decimal) and
      genres onto the pool — _Science Fiction_ as Sci-Fi, the rest dropped.
- [ ] Planning fills empty fields only for chips that are on.
- [ ] A Confident movie is written with its columns, `tmdb_id`, and both
      images stored in its Movie folder as relative paths.
- [ ] `rating`, `watched`, `resume_position_seconds` and `last_watched_at`
      are byte-for-byte unchanged by a run.
- [ ] A movie holding a `tmdb_id` is fetched by id with no search.
- [ ] Every request asks for `en-US`; the suite drives a fake client.
- [ ] The ⋯ menu shows _⟳ Fetch from TMDB_ in its place and opens
      `/enrich?movie=<id>`.
- [ ] Setup shows _Just this movie_ alone; review shows _All done_ and _Back
      to the movie_ lands on the movie.

---

## Phase 3: The whole library

**User stories**: 15, 16, 17, 18, 25, 26, 27, 28, 29, 30, 31, 32, 33, 35, 36,
38, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 56, 57, 58, 59, 60, 80, 101

### What to build

`GET /api/enrichment` answers the summary: movie and series totals, how many
have **Full details**, `lastSyncedAt`, whether a key is set, whether TMDB
answered a short reachability probe asked by the server, and the Library
root. Library storage answers the titles in a scope with their current
values: _Only what's missing_ is the titles without Full details, _Everything_
is all of them.

The setup draws in full: the _Sync with TMDB_ header with its key badge and
lede; the offline banner in a danger tint with _Retry_ and the key banner
with _Open Network settings_; the two scope cards with their counts; the ten
field chips (a chip off means that column is never written); the line that ★
ratings are never touched; the estimate (`About 12s for 30 titles`,
_Waiting for a connection_, _A key is needed before this can run_); and
Start — primary only with a key and TMDB answering, pushing to Settings with
_Add your TMDB key here first._ with no key, inert offline. Nothing is drawn
until the read lands.

The run snapshots its titles so `total` is known before the first request,
works one title at a time, and writes the prototype's log lines. The running
card draws the headline, elapsed, stat line, determinate bar, current item,
ETA, Activity log and _Stop_, polled every 500 ms and re-attached on return.
_Stop_ aborts in-flight requests and returns to setup, keeping written rows. A
dropped connection or a `401` ends the run into review with its line. A
second start while one runs is refused. Reaching review stamps
`enrichment-last-synced-at`; _Sync again_ drops the run and shows setup.

Settings' Network group gains _Sync metadata & posters_, pushing `/enrich`,
its line reading `Last synced {relative} · N of M titles have full details.`
or the second half alone before any sync.

### Acceptance criteria

- [ ] The summary counts movies and series and their Full details; an empty
      library answers zeros, not an error.
- [ ] Offline means the server's probe did not answer.
- [ ] Both banners, both scope cards with counts, the chips, the ★ line and
      the estimate's three faces match the prototype.
- [ ] Start's three behaviours: runs; no key → Settings with the notice;
      offline → nothing.
- [ ] _Only what's missing_ never questions a filled field; a chip off is
      never written.
- [ ] The running card polls, shows progress, log, elapsed and ETA, and
      re-attaches after leaving.
- [ ] _Stop_ keeps written rows and returns to setup.
- [ ] Network loss and `401` end into review with their lines; a second start
      answers `409`.
- [ ] `lastSyncedAt` is stamped at review; the Settings row's line reads _just
      now_, _N minutes ago_, _yesterday_ or the date, and drops the half
      with none.
- [ ] Back from `/enrich` lands on Settings with nothing behind it.

---

## Phase 4: Decisions — `ambiguous` and `missing`

**User stories**: 61, 63, 64, 65, 66, 67, 68, 69, 70, 77, 78

### What to build

Match scoring: 70 for the title (an equal Title key 70, else word overlap × 70) and 30 for the year (equal 30, one off 15, unknown 0). A search with more
than one candidate, or one that is not Confident, becomes an `ambiguous`
**Decision** carrying the top three; no result becomes `missing`. Each has
_Skip_.

The review draws two tiles — _movies enriched_ and _need your decision_ — over
the list. A **Decision row** shows its dot by kind, the title, the reason
(_{n} releases share this title — pick the right one._ / _Nothing on TMDB
matched this title._) and its path when known. The `ambiguous` face is the
candidate picker — posters straight from TMDB over the Gradient fallback, with
year, genre, language and _% match_ — and a dashed _Search by title_ card that
swaps in the search box prefilled with the title; the `missing` face is that
box. Searching raises _Searching TMDB…_ and answers candidates in the same
picker, or keeps the box with _Nothing on TMDB matched “{query}”._ Picking
writes through the same path as a Confident title and raises _Match saved._
A settled row leaves the list and counts into _movies enriched_.

### Acceptance criteria

- [ ] Scoring follows the 70/30 arithmetic; Confident needs both conditions,
      and a yearless title needs only the title.
- [ ] Several or non-Confident candidates make `ambiguous` with at most three;
      none makes `missing`.
- [ ] The search, pick and dismiss routes answer as the table says.
- [ ] The two tiles, the row and both faces match the prototype.
- [ ] Search raises its notice, answers candidates in the picker, and keeps
      the box with its line when nothing matched.
- [ ] Pick writes the film as a Confident one would and raises _Match saved._
- [ ] _Skip_ and a settled row both leave the list; settled rows count into
      _movies enriched_.

---

## Phase 5: Decisions — `conflict`

**User stories**: 71, 72, 73, 74, 75, 76

### What to build

Planning learns conflicts. Outside _Only what's missing_, Synopsis, Year,
Genres, Director and Cast conflict when TMDB's value differs from a filled
one after trimming and case-folding — genres and cast compared as sets.
Poster, Backdrop and Runtime are never diffed; TMDB's score and original
title never conflict. A conflicting title's empty fields are filled at once,
and only the disagreements wait.

The `conflict` face is the field diff: one _Yours | TMDB_ row per differing
field, TMDB chosen by default, each switchable. _Apply choices_ writes the
chosen sides and raises _Details updated._; _Keep all mine_ leaves the title
as it is and removes the row.

### Acceptance criteria

- [ ] Only the five fields ever conflict; case, spacing and order of genres
      and cast do not count.
- [ ] _Only what's missing_ never produces a conflict.
- [ ] A conflicting title's empty fields are written during the run.
- [ ] The diff defaults every field to TMDB; _Apply choices_ writes the chosen
      sides and raises its notice.
- [ ] _Keep all mine_ changes nothing on the title and removes the row.

---

## Phase 6: Series and episodes

**User stories**: 37, 82, 83, 84, 85, 86, 87

### What to build

The run covers series: searched by title and first year, fetched with
credits, given the same fields at show level — Director as the creator
(`created_by` names joined), the year range from first and last air dates,
its images into the Series folder. For every season number it has on disk
(never season 0) the season is read and matched by episode number: title and
air date when empty, always; the still under the Poster chip, stored as
`<episode stem>.still.jpg` in its season folder; runtime under Runtime.
Episodes never raise a Decision. Library storage gains enrich writes for a
series and an episode touching only the columns named.

The setup says a series gets the same fields at show level plus episode
titles, air dates and stills. The season page's Episode row draws its still
where it drew the gradient, `PosterCard`'s precedent.

### Acceptance criteria

- [ ] A Confident series is written with its fields, creator, year range,
      `tmdb_id` and images.
- [ ] Each episode on disk gets its title and air date when empty, its still
      under Poster, and its runtime under Runtime; season 0 is never read.
- [ ] No Decision is ever raised for an episode.
- [ ] Episode watch state and resume positions are unchanged.
- [ ] The setup line about series matches the prototype.
- [ ] An Episode row with a still draws it over the Gradient fallback.

---

## Phase 7: Remembering where titles came from

**User stories**: 39, 88, 89, 90

### What to build

The importer records `library-root` on Start, and `source_folder` — relative
to the root — on every movie and series it adds **or** finds **Already in
library**, so a re-run backfills a library imported before this shipped. The
summary answers the root.

A Decision row shows its path (root + source folder) when one is on record.
Setup's _Where it is saved_ lists _Your library_ with the _Required_ pill.

### Acceptance criteria

- [ ] Starting an import stores `library-root`.
- [ ] Added and Already-in-library titles carry a relative `source_folder`;
      no absolute path lands on a row.
- [ ] Re-running the fixture over an existing library backfills
      `source_folder` and adds nothing else.
- [ ] Decision rows show the path when known and none otherwise.
- [ ] _Where it is saved_ shows _Your library_ as Required.

---

## Phase 8: Writing back into the collection

**User stories**: 40, 41, 42, 81, 91, 92, 93, 94, 95, 96

### What to build

Write-back's two targets. Before the first TMDB request, the run checks it
can write to the root and logs _Will write familyflix-metadata.csv to …_ or
_Can't write to … — the sheet and posters will be skipped_, and the sync runs
into the library either way. With posters on, each written title's poster is
added to its Source folder as `poster.jpg` only when none exists; a title
with no source folder logs _– Title — no source folder on record, poster
skipped_. At review, with the sheet on, `familyflix-metadata.csv` — the Export
file, films A–Z under the eight columns — is added to the root only when none
exists. An existing file logs _– … exists, left alone_ and is left
byte-identical. Neither ever throws.

Setup draws the two toggles under _Where it is saved_ — the sheet with the
root's path in mono, and `poster.jpg` in each movie folder — only when the
root is known. Review names what landed under _Saved to …_.

### Acceptance criteria

- [ ] The permission check and its dry-run line come before any TMDB request;
      an unwritable root skips both targets and the run continues.
- [ ] `poster.jpg` and the sheet are written only when absent; an existing
      file is left byte-identical with its log line.
- [ ] A title with no source folder logs its line and raises no Decision.
- [ ] The sheet reads back through Bulk import as the Export file does.
- [ ] Nothing else is ever written into the root.
- [ ] The toggles are not drawn without a root; _Saved to …_ names what was
      written.

---

## Phase 9: From the import

**User stories**: 20, 21, 22, 23, 24

### What to build

Import setup gains the _Also fetch metadata and posters from TMDB_ checkbox
card over _Start import_ — a `role="checkbox"` over a visually hidden input,
the prototype's 22px box — its hint chosen by `GET /api/tmdb/key`: _Runs
straight after the import, over everything it brings in. Needs the internet._
with a key, _Needs a TMDB key — add one under Settings → Network first._
without. The box travels on the run (`POST /api/import { …, enrich }`,
`ImportRun.enrich`), so a re-attached run still knows it. _Finish_ on such a
run **replaces** `/import` with `/enrich?scope=all`, landing on setup with
_Everything_ selected — nothing starts unasked — and Back from there steps to
Settings.

### Acceptance criteria

- [ ] The checkbox card and both hints match the prototype.
- [ ] `enrich` is carried on the run and survives a re-attach.
- [ ] _Finish_ with the box ticked replaces `/import` with
      `/enrich?scope=all` and shows setup with _Everything_ selected.
- [ ] _Finish_ without it behaves exactly as before.
- [ ] The import itself makes no TMDB request.
