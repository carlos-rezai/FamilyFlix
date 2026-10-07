# Plan: Default poster — a branded gradient for every posterless title, and the poster on the Continue card

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/253

Today a title with no poster draws a coloured gradient with its title over it,
which the family reads as a picture that failed to load. Log 28 adds the
**Default poster**. It is the title's own **Gradient fallback** with the
FamilyFlix **Wordmark** centred in it, drawn in CSS and never stored. It
appears on every surface that shows a title's poster.

The same initiative fixes two neighbouring gaps:

- A poster whose file is missing or unreadable leaves a hole in the page. It
  will show the gradient instead.
- The Continue card has never shown artwork. It will show the title's poster,
  and an episode's card will show its series' poster.

The slicing goes from the most-seen surface out:

**the Poster card** (Phase 1) → **the detail pages** (Phase 2) → **the
movie's Continue card** (Phase 3) → **the episode's Continue card** (Phase 4)
→ **the close** (Phase 5).

## Running the phases

Phases 1–4 run AFK under `issue-loop`, following the Ultrawide margins plan.

- **No prototype-only slice.** The PRD spells out every amendment:
  - `mol.PosterCard` gains a no-poster state.
  - `mol.ContinueCard` gains a `posterUrl` and its `center 25%` art layer.
  - `page.MoviePage` and `page.SeriesPage` show the Default poster in the
    poster frame.
  - `COMPONENT-SPEC.md` gains a Default poster note.

  All of them go into Phase 1's **build** step, as the PRD asks. The GREEN
  subagent amends `docs/handoff/` first and then builds to the amended files.
  Both land in the slice's `feat:` commit, so Phases 2–4 build against a
  prototype that is already amended.

- **The Wordmark's numbers are the prototype's.** The fraction of the tile's
  shorter side, the opacity and the shadow are set in Phase 1's amendment. The
  starting point is the `TitleOverlay`'s shadow. Every later phase reads those
  numbers rather than choosing its own.
- **No HITL marks in Phases 1–4.** Every acceptance criterion is a Vitest
  assertion, a typecheck or a file diff. jsdom does no layout, so the
  Wordmark's scaling is the maintainer's own check, made in the running app
  after Phase 1. Nothing waits on that check.

Phase 5 is docs-only, so the loop stops there by design. Per the standing
rule, a feature is Done only after its refactor. The close is therefore the
refactor's last commit, made after `request-refactor-plan` and `refactor`.

---

## Architectural decisions

Durable decisions that apply across all phases.

- **HTTP routes.** No new routes. `GET /api/series` keeps its shape except for
  one field: each Continue Watching entry's `series` becomes
  `{ id, title, posterPath: string | null }`, with `posterPath` selected
  beside the series' title in the browse read. `/api/images/<Stored path>`
  stays the one image route.
- **Client routes.** No changes.
- **Schema.** No migration. `poster_path` stays `NULL` for a title showing the
  Default poster, which means:
  - **Full details** still counts the title as missing a poster.
  - _Only what's missing_ still fetches one.
  - **Write targets** never write it out as `poster.jpg`.
  - The **Export file** is unchanged.
- **The Default poster is drawn, never stored.** It is the title's
  `gradientFromId` gradient, plus the Wordmark centred on both axes, plus the
  caption the surface already draws.
  - It has no image asset.
  - The Wordmark inside it is `aria-hidden`, so the caller's accessible name
    stays the title.
- **Primitives.**
  - **`Wordmark`** (new, in the primitives barrel): _Family_ in `colors.text`
    and _Flix_ in `colors.accent`, serif 700. Its size comes from the
    parent's `font-size`. `MainLayout`'s logo and `AboutSection`'s brand row
    adopt it, and neither changes how it looks.
  - **`Artwork`** gains `poster?: boolean`:
    - With `poster` and no url, it draws the Default poster.
    - Without `poster`, it draws today's Gradient fallback.
    - A url is always a background layer **over** the gradient. A file that
      fails to load paints nothing, so the gradient shows, with no
      JavaScript. This applies to every caller, backdrops included.
    - `Artwork` becomes a size container, so the Wordmark scales to the
      tile's shorter side with no size prop.
- **Which surfaces pass `poster`.** The Poster card (movies and series), the
  movie page's poster frame, the series page's poster frame and the Continue
  card. These do not pass it: the detail backdrops, the player's art layer,
  the Season card, `EpisodeRow`, `UpNextCard` and `CandidatePicker`.
- **Key models.**
  - `MovieDetailModel.hasArtwork` and `SeriesPageModel.hasArtwork` become
    **`hasPoster`**, which is true only when `posterPath` is set.
  - `ContinueCardMovie` gains `posterUrl: string | null`, the same name and
    type as `PosterCardMovie.posterUrl`.
  - `EpisodeContinueEntry.series` gains `posterPath: string | null`, in the
    shared series types (both build targets).
- **`imageUrl` util** (new, in the utils barrel):
  `imageUrl(storedPath: string | null): string | null`. It is the one spelling
  of the image route.

---

## Phase 1: The Default poster on the Poster card, end to end

**User stories**: 1–6, 17–27

### What to build

The thinnest path from a posterless film in the database to a branded tile in
a browse row.

- **Prototype.** `docs/handoff/` is amended first, and the amendment covers
  the whole initiative:
  - `mol.PosterCard` gets the no-poster state with the centred Wordmark.
  - `mol.ContinueCard` gets `posterUrl` in its `data-props` and its art layer
    at `center 25%`.
  - `page.MoviePage` and `page.SeriesPage` get the Default poster in the
    poster frame.
  - `COMPONENT-SPEC.md` gets a note on the Default poster: where it appears,
    where it doesn't, and the layered url.

  This amendment sets the Wordmark's fraction, opacity and shadow.

- **`Wordmark`.** The new primitive. `MainLayout`'s logo and `AboutSection`'s
  brand row move onto it. Their button furniture and 25px size stay where they
  are, and their look does not change.
- **`Artwork`.**
  - It gains `poster`.
  - It becomes a size container.
  - It paints a url over the gradient for every caller, so a broken poster or
    backdrop shows the gradient rather than a hole.
  - The doc comment saying the Continue card has no image slot is retired.
- **`PosterCard`** passes `poster`, for movies on the Movies tab and series on
  the Series tab alike. Each card keeps its own colours, its title caption and
  its accessible name.

When this phase is done, a hand-added film with no poster shows its own
gradient with the FamilyFlix Wordmark in the middle in the library rows, the
genre page and the Series tab. A poster whose file was deleted from the media
folder shows the gradient behind where it was.

### Acceptance criteria

- [ ] The prototype amendments listed above and the `COMPONENT-SPEC.md` note
      land in the slice's `feat:` commit.
- [ ] `Wordmark`:
  - [ ] It draws _Family_ and _Flix_.
  - [ ] _Flix_ resolves to the accent colour.
  - [ ] The whole mark is serif 700.
- [ ] `Artwork`:
  - [ ] With a url, the background holds the url layer over the gradient.
  - [ ] Without a url, the background holds the gradient alone.
  - [ ] `poster` with no url draws the Wordmark, hidden from the
        accessibility tree.
  - [ ] `poster` with a url, and no `poster` at all, both draw no Wordmark.
- [ ] `MainLayout`'s and `AboutSection`'s existing brand assertions still pass,
      so the logo still reads _FamilyFlix_ and still leads home.
- [ ] `PosterCard`:
  - [ ] With no poster, the Wordmark is drawn, the title caption is drawn,
        and the card is still named by its title.
  - [ ] With a poster, there is no Wordmark.
- [ ] Nothing that does not take `poster` draws a Wordmark: the Season card,
      `EpisodeRow`, `UpNextCard`, `CandidatePicker`, the detail backdrops and
      the player. Their suites pass unchanged.
- [ ] `npm run typecheck`, `eslint` and the full Vitest run are green.

---

## Phase 2: The detail pages' poster frames

**User stories**: 7–10

### What to build

On the movie page and the series page, the poster frame's caption (the genre ·
year tag and the title) follows whether there is a **poster**, not whether
there is any art.

- `hasArtwork` becomes `hasPoster` in both view models and on both pages.
- Both poster frames pass `poster`.
- A title with a backdrop and no poster now gets a captioned Default poster in
  front of the backdrop.
- A title with a real poster is never captioned.
- The backdrop itself stays without a Wordmark.

When this phase is done, opening a hand-added film with a TMDB backdrop but no
poster shows a branded, captioned poster in front of the backdrop rather than
a bare gradient. The same holds on a series page.

### Acceptance criteria

- [ ] `detailView` and `seriesView`:
  - [ ] `hasPoster` is true only when a poster is set.
  - [ ] A backdrop alone gives `hasPoster: false`, and the top tag is filled.
- [ ] `MovieDetail` and `SeriesDetail`:
  - [ ] With a backdrop and no poster, the poster frame draws the caption and
        the Wordmark.
  - [ ] With a poster, the frame draws neither.
- [ ] Nothing in shipping code still reads `hasArtwork`.
- [ ] `npm run typecheck`, `eslint` and the full Vitest run are green.

---

## Phase 3: The poster on a movie's Continue card

**User stories**: 11–14, 28

### What to build

The Movies tab's Continue Watching row shows each film's artwork.

- **`imageUrl`.** The util is added, and all six local copies of the image
  route are replaced by it: the library view, the series card view, the
  detail view, the series view, the season view and the player.
- **`continueView`.** `ContinueCardMovie` gains `posterUrl`, which
  `continueView` fills from the movie's poster through `imageUrl`.
- **`ContinueCard`.**
  - It draws its art through `Artwork` with `posterUrl` and `poster`, at
    `cover` anchored `center 25%`.
  - The existing scrim keeps the title and Resume label legible.
  - A film with no poster gets the Default poster, which matches its card in
    the rows.
  - The "no url, ever" comment is retired.

When this phase is done, _Solo_ in progress shows the poster the family
recognises in Continue Watching, cropped to the key art, with its title and
_Resume_ label still readable.

### Acceptance criteria

- [ ] `imageUrl`:
  - [ ] A Stored path becomes `/api/images/<path>`.
  - [ ] `null` gives `null`.
- [ ] The image route is spelled in exactly one shipping file.
- [ ] Every suite that covers the six former copies passes unchanged.
- [ ] `continueView`: `posterUrl` is built from the movie's poster, or is
      `null`.
- [ ] `ContinueCard`:
  - [ ] With a `posterUrl`, the art layer holds it at `center 25%`.
  - [ ] Without one, the Wordmark is drawn.
  - [ ] The title and Resume label are unchanged.
- [ ] `npm run typecheck`, `eslint` and the full Vitest run are green.

---

## Phase 4: An episode's Continue card in its series' art

**User stories**: 15, 16, 29

### What to build

The Series tab's Continue Watching row shows each show's artwork, end to end
from the database.

- **Server.**
  - The series browse read's Continue Watching query selects the series'
    `poster_path` beside its title.
  - Each entry's `series` carries `posterPath`.
  - `GET /api/series` is otherwise unchanged.
- **Client.**
  - `episodeContinueView` fills `posterUrl` from the series' poster.
  - It hashes its gradient from the **series** id instead of the episode id,
    so a show with no poster gets the Default poster in the same colours as
    its series card and Season cards.

When this phase is done, a part-watched episode's Continue card shows its
show's poster. For a show with no poster, the card is branded in that show's
own colours.

### Acceptance criteria

- [ ] Series browse (server): each Continue Watching entry carries the
      series' `posterPath`, both when it is set and when it is `null`, through
      the repository and through `GET /api/series`.
- [ ] `episodeContinueView`:
  - [ ] `posterUrl` is built from the series' poster, or is `null`.
  - [ ] `g1` and `g2` equal `gradientFromId(series.id)`.
- [ ] The shared `EpisodeContinueEntry` type carries `series.posterPath` in
      both build targets.
- [ ] `npm run typecheck`, `eslint` and the full Vitest run are green.

---

## Phase 5: The close

**User stories**: none new. This phase is the initiative's paperwork.

### What to build

The docs that make the feature Done. Per the standing rule, this is the
refactor's last commit and not a build slice.

- In CLAUDE.md:
  - The folder tree names `Wordmark`, `Artwork`'s Default poster and the
    `imageUrl` util.
  - The `EpisodeContinueEntry` line reflects the series' `posterPath`.
  - Step 12 and the _Default poster_ feature line are ticked ✅, and _(next)_
    moves to step 13.
- In the README, the same ✅.
- In the dev journal, an entry for the initiative. It records that log 03
  Q6's open item, real artwork on the Continue card, is closed.

### Acceptance criteria

- [ ] CLAUDE.md and the README tick step 12 ✅ and mark step 13 as next.
- [ ] CLAUDE.md's folder tree names every new unit.
- [ ] The dev journal carries the initiative's entry.
- [ ] Prettier passes over the changed docs.
