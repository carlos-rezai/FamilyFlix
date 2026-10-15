# Plan: TMDB ratings — an unrated title draws TMDB's stars, marked TMDB

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/367

A synced library draws every title the family has not rated as five empty
stars, though the app stores TMDB's score for each. This initiative adds
**TMDB ratings**, a household preference on by default: while it is on, a
title with no household **Rating** draws its **TMDB rating** as **TMDB-marked
stars** — muted, with a `TMDB` tag — and _Highest rated_ and the Minimum
rating read the same **Shown rating** the stars draw. The family's Rating
always wins and nothing TMDB says is ever written over it.

## Running the phases

**Phase 0 is HITL and docs-only.** It amends the prototype before any code
draws it, and settles the inks. `issue-loop` stops there so the maintainer can
review the amendment.

**Phases 1–6 run AFK under `issue-loop`**, in order. They are log 43's
_Implementation Plan_ slices 2–6, with slice 4 split: Phase 3 is the movie
page's picker, Phase 4 the series page's meta line.

The docs (README, CLAUDE.md, the glossary) are log 43's slice 7. They are not
a phase here: they are ticked ✅ only after the refactor.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**:

  | Route                                          | Answer                                                       |
  | ---------------------------------------------- | ------------------------------------------------------------ |
  | `GET /api/settings`                            | `{ subtitleLanguage, ultrawideMargins, tmdbRatings }`        |
  | `POST /api/settings/tmdb-ratings { value }`    | `200 { value }` · `400` for anything but a boolean           |
  | `GET /api/home`, `/api/series`, the genre page | sort and filter on the Shown rating · the query is unchanged |

  The preference is not on the **Library query**, the URL or any browse
  request: `rating` stays a 0–10 floor and `sort` its slug.

- **Schema**:
  - Settings key `tmdb-ratings` (`'1'`/`'0'`) in the `settings` table, absent
    meaning the default. No new table, no new column.
  - **Migration 13**: `tmdb_score = NULL WHERE tmdb_score = 0` on `movies`
    and `series`. `rating` and `tmdb_score` stay two columns.

- **Key models**:
  - `Settings.tmdbRatings: boolean`, `DEFAULT_TMDB_RATINGS = true`.
  - `RatingSource = 'household' | 'tmdb'`, in the shared view-model types.
  - `ShownRating = { units, source }`, units on the Rating's own 0–10
    half-star scale; `null` is Unrated.
  - `PosterCardMovie` and the series page model gain `ratingSource`; the
    movie page model carries `ratingPercent` (the household's) and
    `tmdbPercent` (the TMDB rating while on, else `null`) apart.

- **The rule, spelled twice and only twice**:
  - Client: `shownRating(rating, tmdbScore, tmdbRatings)` in `src/utils/` —
    the household Rating when stored (`0` included), else
    `Math.round(tmdbScore)` while on and a score is held, else `null`.
  - Server: `shownRatingSql(alias, tmdbRatings)` in `library/browse/` —
    `COALESCE(<a>.rating, CAST(ROUND(<a>.tmdb_score) AS INTEGER))` while on,
    `<a>.rating` while off; the series browse imports it.
  - Both round a positive half up, so the stars and the order agree on `6.5`.

- **Boundaries**:
  - The client draws per render; the server sorts. No merged rating on any
    record.
  - The browse reads the preference through a reader composed in the
    library, `() => settings.settings().tmdbRatings`, asked per query. No
    route learns there is a preference.
  - On the client, `DisplayPreferenceProvider` holds it; `null` (Blank until
    it lands, or no provider) reads as **off**.
  - `StarRating` and `RatingPicker` stay domain-free: `muted`, `tag`,
    `placeholder`, `placeholderTag`. Only the callers say `TMDB`.

- **Unchanged throughout**:
  - What a Sync, an import or the Movie form writes. No Sync touches
    `rating`.
  - The Export writes the household Rating alone.
  - The Movie form's _Your rating_ picker has no placeholder.
  - The Continue card draws no stars; the series page gains no picker.

---

## Phase 0: Prototype amendment (HITL)

**User stories**: the surface of 1–3, 12–16, 23, 27–28

### What to build

The amendments, in `docs/handoff/`:

- **`prim.StarRating`** — `muted` (the filled stars in a neutral ink, not
  the accent) and `tag` (a small uppercase word after the value, in the faint
  ink): `★★★½☆ 3.5 TMDB`.
- **`mol.RatingPicker`** — `placeholder` and `placeholderTag`: muted stars
  and `3.5 / 5 TMDB` in place of `Not rated` while there is no value; the
  hover preview in the accent.
- **`mol.PosterCard`** — a TMDB-rated face beside the household one.
- **`page.SettingsPage`** — the Display group's second row, _Fill in
  ratings from TMDB_, with its line, its Toggle on.
- **`page.MoviePage` and `page.SeriesPage`** — a TMDB-rated meta line.
- **`FamilyFlix.dc.html`** and **`COMPONENT-SPEC.md`** — the new props.

### Acceptance criteria

- [ ] `StarRating` draws a muted face with a `TMDB` tag, and its household
      face as before.
- [ ] `RatingPicker` draws its placeholder face, the label `x / 5 TMDB`, and
      the accent hover preview over it.
- [ ] A poster card, the movie page and the series page each draw a
      TMDB-rated face.
- [ ] The Display card draws its two rows on the same furniture.
- [ ] The muted ink and the tag's ink are named tokens.
- [ ] The maintainer has reviewed the amendment before Phase 1 starts.

---

## Phase 1: The preference

**User stories**: 1–11

### What to build

The Display group's second row, _Fill in ratings from TMDB_, end to end. The
library settings gain the `tmdb-ratings` key, read through the one
`valueOf`, answered as `tmdbRatings` with the default applied, and written
by `setTmdbRatings(on)`. `GET /api/settings` carries it and
`POST /api/settings/tmdb-ratings` writes it, a **Single-signal write**.
`DisplayPreferenceProvider`'s one read lands both display preferences, and
`useDisplayPreference()` answers `tmdbRatings` and `setTmdbRatings` —
shown at once, posted over a new `saveTmdbRatings`, the echo kept, put back
on refusal, never rejecting. Nothing draws from it yet.

### Acceptance criteria

- [ ] With no row stored, `GET /api/settings` answers `tmdbRatings: true`.
- [ ] `POST /api/settings/tmdb-ratings` echoes a boolean and `400`s a
      string, a number, `null` and a missing value.
- [ ] The value read back after a write is the value written, and a Factory
      reset returns the default.
- [ ] The provider holds `null` until its one read lands, then both values.
- [ ] The setter flips at once, keeps the echo, puts the value back on a
      refusal, and never rejects.
- [ ] The Display card draws the second row's title, line and switch state,
      and a press calls the setter.
- [ ] The toggle flipped in the app survives a reload.

---

## Phase 2: Shown on the cards

**User stories**: 12–22, 24–26

### What to build

An unrated, synced title draws TMDB's stars on its poster card wherever a
poster card is drawn: the Movies tab, the Series tab, the Genre page and
search. `shownRating` is the one client reading of the Shown rating.
`StarRating` gains `muted` and `tag`. The library card mapper and the series
card mapper each take `tmdbRatings` and give the card its percent and its
`ratingSource`; their callers pass `useDisplayPreference().tmdbRatings ===
true`. The poster card maps a `tmdb` source onto `muted` and `tag="TMDB"`. A
flip in Settings redraws every loaded card.

### Acceptance criteria

- [ ] `shownRating`: a household Rating wins over any score, a stored `0`
      included; no Rating, a score and the preference on gives
      `round(score)` and `tmdb`; preference off gives `null`; no score gives
      `null`; `x.5` rounds up.
- [ ] `StarRating`'s `muted` moves the filled stars off the accent, and its
      `tag` is readable text after the value; absent, nothing changes.
- [ ] Both card mappers give the right percent and source under both
      preferences.
- [ ] A `tmdb`-sourced card draws the `TMDB` tag; a `household` one does
      not; Unrated draws as today.
- [ ] With the preference off, or before it lands, every card draws as
      before this feature.
- [ ] The Continue card is unchanged.

---

## Phase 3: The movie page's picker

**User stories**: 27–36

### What to build

The movie page's picker shows TMDB's rating as its placeholder while the
film is unrated. `RatingPicker` gains `placeholder` and `placeholderTag`:
while `value` is `null` and a placeholder is given, the stars are muted at
the placeholder and the label reads `x / 5 TMDB` in place of `Not rated`;
the hover preview stays in the accent. A click on any segment sets the
household Rating — the segment equal to the placeholder adopts it, never
clears — and _Clear rating_ is named only on the segment holding `value`.
The movie page's mapper takes `tmdbRatings` and keeps `ratingPercent` and
`tmdbPercent` apart; the meta line passes `tmdbPercent` as the placeholder
with `placeholderTag="TMDB"`. Clearing a Rating brings the placeholder back.

### Acceptance criteria

- [ ] The picker draws the placeholder face and label while `value` is
      `null`, and no placeholder face once a value is set.
- [ ] A click on the placeholder's segment emits that value, not `null`.
- [ ] _Clear rating_ is named only on the value's segment, and the hover
      preview is in the accent.
- [ ] The movie page mapper's `ratingPercent` and `tmdbPercent` are right
      under both preferences and never merged.
- [ ] With the preference off, or no score held, the picker reads
      `Not rated` over empty stars.
- [ ] The Movie form's _Your rating_ picker draws no placeholder.

---

## Phase 4: The series page's meta line

**User stories**: 23, 37

### What to build

The series page's read-only stars draw the Shown rating. The series page's
mapper takes `tmdbRatings` and gives `ratingPercent` and `ratingSource`;
`SeriesMetaLine` maps a `tmdb` source onto `StarRating`'s `muted` and
`tag="TMDB"`. The page gains no picker: a series' Rating is still set and
cleared in the series edit.

### Acceptance criteria

- [ ] The series page mapper gives the right percent and source under both
      preferences.
- [ ] `SeriesMetaLine` draws the `TMDB` tag for a `tmdb` source and not for
      a `household` one.
- [ ] A series the family rated draws its Rating, unmarked, whatever TMDB
      says.
- [ ] The series page draws no picker.

---

## Phase 5: Sort and filter

**User stories**: 38–43

### What to build

_Highest rated_ and the Minimum rating read the Shown rating, in both the
movie browse and the series browse. `shownRatingSql` spells it once; the
`highest-rated` order and the minimum-rating term are built from it. Each
browse is composed in the library with the preference reader, asked per
query, so `listMovies`, every Home section, the Series tab and the Genre page
agree. The Library query, the URL and the wire are unchanged.

### Acceptance criteria

- [ ] With the preference on, _Highest rated_ orders a TMDB-only title among
      the household Ratings; off, it sorts last.
- [ ] With the preference on, `3+ stars` keeps a title drawing 3½ TMDB
      stars; off, it drops it.
- [ ] A title with neither a Rating nor a score sorts last and is filtered
      out under either preference.
- [ ] A score of `6.5` sorts with 3½ ★.
- [ ] Movies and series behave alike, and every test says which preference
      it runs under.
- [ ] A flip is read by the next browse request without a restart.

---

## Phase 6: No votes

**User stories**: 20, 47, 48

### What to build

A score of 0 is no score. `fetchedFields`' score reading answers `null` for
a `vote_average` of `0`, so no Sync stores a `0` again; **migration 13** sets
the zeros past Syncs stored back to `NULL`, on both tables. A Sync that
refreshes a score still redraws its stars.

### Acceptance criteria

- [ ] `vote_average: 0` yields a `null` score; `7.44` still yields `7.4`.
- [ ] Migration 13 turns a stored `0` into `NULL` on `movies` and `series`
      and leaves every other score untouched.
- [ ] A title whose stored score was `0` draws Unrated, not a TMDB zero, and
      sorts as a title with no score.
