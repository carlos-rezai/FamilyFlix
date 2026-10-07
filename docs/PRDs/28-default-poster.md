> **Initiative:** `default-poster`
> **Design log:** `docs/design-logs/28-default-poster.md`
> **Build order:** step 12

## Problem Statement

I am the maintainer, and I add films by hand that have no poster. Each one
shows as a coloured gradient with its title over it. Nothing on the tile says
FamilyFlix, so to my parents it looks like a picture that failed to load. On the
movie and series pages, a title that has a backdrop but no poster gets a bare
gradient poster with no caption at all.

Sometimes it really is a hole. If a poster's file goes missing or can't be
read, the tile paints nothing and the page shows through it.

The Continue Watching row has the opposite problem. Its cards have never shown
artwork. _Solo_ is in progress and has a poster, but its Continue card is a
plain gradient while the same film's card further down the screen shows the
poster my parents recognise. An episode's Continue card is worse: its gradient
is hashed from the episode, so it doesn't even match its own series' colours.

## Solution

A title with no poster draws the **Default poster**: the title's own gradient
with the FamilyFlix **Wordmark** centred in it, plus the caption that surface
already draws. Every no-poster tile in a row still has its own colours, and
each one now reads as a FamilyFlix default rather than as a gap.

- It appears on every surface that shows a title's poster: the Poster card
  (movies and series), the movie and series pages' poster frames, and the
  Continue card.
- It doesn't appear on backdrops, behind the player, on Season cards, on
  episode thumbnails or the Up next card, or on TMDB candidates. Those keep the
  plain **Gradient fallback**.
- The Wordmark scales with the tile, so one rule fits a card, a Continue card
  and the detail poster.
- It is drawn, never stored. A title with the Default poster still has no
  poster, still counts as missing one for a Sync, and is never written back as
  a `poster.jpg`.
- A poster whose file is missing or unreadable shows the gradient underneath
  it rather than an empty tile, on every surface that draws artwork.
- On the movie and series pages, the poster frame's caption (genre · year and
  the title) follows whether there is a poster, not whether there is any art.
- The Continue card shows the title's poster, else the Default poster, cropped
  to the upper part of the poster where the key art sits. An episode's
  Continue card shows its series' poster, else the Default poster in its
  series' colours.

## User Stories

1. As a parent browsing the rows, I want a film with no poster to show the
   FamilyFlix Wordmark on its tile, so that it looks like it belongs in the
   app rather than like a broken picture.
2. As a parent, I want each no-poster film to keep its own colours, so that a
   row of hand-added films doesn't collapse into identical tiles.
3. As a parent, I want a no-poster film's title still drawn along the bottom of
   its card, so that I can read which film it is.
4. As a parent, I want a no-poster series on the Series tab drawn the same way,
   so that films and shows look alike.
5. As a parent, I want the Wordmark in the middle of the tile, so that it never
   sits under the heart, the watched badge, the play badge or the title.
6. As a parent, I want the Wordmark sized to the tile, so that it looks right
   on a small card and on the large poster of the movie page.
7. As a parent, I want a no-poster film's movie page to show the Default poster
   with its genre · year tag and its title, so that the page looks finished.
8. As a parent, I want a film with a backdrop but no poster to show a captioned
   Default poster in front of the backdrop, so that the poster frame is never a
   bare gradient.
9. As a parent, I want the same on a series page, so that shows and films
   behave alike.
10. As a parent, I want a film with a real poster never to get a caption drawn
    over its art, so that the artwork stays clean.
11. As a parent, I want the Continue Watching card to show the film's poster,
    so that I recognise at a glance the film I was watching.
12. As a parent, I want the Continue card's poster cropped to show the upper
    part of the poster, so that I see the key art rather than the credits at
    its foot.
13. As a parent, I want the title and Resume label on the Continue card still
    readable over the poster, so that I know where I will resume.
14. As a parent, I want a Continue card for a film with no poster to show the
    Default poster, so that it matches that film's card in the rows.
15. As a parent, I want an episode's Continue card to show its series' poster,
    so that I recognise the show I was watching.
16. As a parent, I want an episode's Continue card with no series poster to use
    the series' colours, so that it matches the series' card and Season cards.
17. As a parent, I want a poster whose file has gone missing to show the
    gradient rather than an empty tile, so that the page never shows through
    a hole.
18. As a parent, I want backdrops whose file has gone missing to show the
    gradient too, so that the movie page never has a hole behind it.
19. As a parent, I want the movie page's backdrop and the player's art to stay
    without a Wordmark, so that nothing distracts from the page or the film.
20. As a parent, I want the Season cards to keep their large season number and
    no Wordmark, so that each season is still told apart by its number.
21. As a parent, I want episode thumbnails and the Up next card unchanged, so
    that an episode is shown by its own frame.
22. As the maintainer, I want TMDB's candidate cards in the Enrichment review
    never branded FamilyFlix, so that I can tell a TMDB result from a title in
    my library.
23. As a parent using a screen reader, I want a card's name to stay the film's
    title, so that "FamilyFlix" isn't read out on every no-poster card.
24. As the maintainer, I want a title showing the Default poster still counted
    as missing a poster, so that _Only what's missing_ still fetches one.
25. As the maintainer, I want the Default poster never written into a source
    folder as `poster.jpg`, never stored and never exported, so that it can
    never be mistaken for real art.
26. As the maintainer, I want the header's logo and the About card's brand row
    to look exactly as they do today, so that the Wordmark has one look
    everywhere.
27. As a developer, I want the Default poster to be one optional switch on the
    artwork primitive, so that a new poster surface gets the brand by asking
    for it.
28. As a developer, I want the image route spelled in one helper, so that a
    poster or backdrop url is built the same way everywhere.
29. As a developer, I want the series' poster path delivered in each Continue
    Watching entry, so that the client doesn't have to cross-reference the
    series list.

## Implementation Decisions

**The Default poster.** It is the title's own **Gradient fallback**, which
`gradientFromId` already hashes per id, with the **Wordmark** centred on both
axes, plus the caption the surface already draws. It is drawn in CSS, with no
image asset. It is decoration: the Wordmark inside it is `aria-hidden`, and the
caller's accessible name is unchanged. It is never stored, exported or written
back. `poster_path` stays `NULL`, and **Full details** and **Write targets**
are unchanged.

**`Wordmark` primitive (new).** _Family_ in `colors.text` and _Flix_ in
`colors.accent`, serif 700. It takes its size from the parent's `font-size`,
so each caller sets the size. It goes in the primitives barrel. `MainLayout`'s
logo and `AboutSection`'s brand row adopt it in place of their own copies,
which makes it a third caller of something written twice. Their button
furniture and their 25px stay theirs, and their look must not change. A
primitive composing a primitive has precedent: `Button` imports `PlayIcon`.

**`Artwork` primitive.**

- It gains `poster?: boolean`. With `poster` set and no url, it draws the
  Default poster. Unset, it draws today's Gradient fallback.
- A url is painted **over** the gradient as two background layers. An image
  that fails to load paints nothing and the gradient shows, with no JavaScript
  and no `onError`. This applies to every caller, backdrops included.
- `Artwork` becomes a size container. The Wordmark's font size is a fraction of
  the tile's shorter side, so it is about 20px on a card, 25px on a Continue
  card and 35px on the detail poster, with no size prop. The exact fraction,
  opacity and shadow are set by the prototype revision. The `TitleOverlay`'s
  shadow is the starting point.
- The doc comment that says the Continue card has no image slot is retired.

**Which surfaces pass `poster`.** The Poster card, the movie page's poster
frame, the series page's poster frame and the Continue card. Not the detail
backdrops, the player's art layer, the Season card, `EpisodeRow`, `UpNextCard`
or `CandidatePicker`.

**Detail captions.** `MovieDetailModel.hasArtwork` and
`SeriesPageModel.hasArtwork` are renamed to **`hasPoster`**, which is true when
`posterPath` is set. The top tag and the poster title follow it. A title with a
backdrop and no poster now gets a captioned Default poster. Real poster art is
never captioned.

**`imageUrl` util (new).** `imageUrl(storedPath: string | null): string |
null` returns `/api/images/` plus the **Stored path**, and `null` for `null`.
It is re-exported from the utils barrel. It replaces the six local
`IMAGE_ROUTE` copies (the library view, the series card view, the detail view,
the series view, the season view and the player) and serves the two continue
mappers. The route is then spelled in one file.

**Wire.** `EpisodeContinueEntry.series` becomes `{ id; title; posterPath:
string | null }`. The series browse read's Continue Watching query selects the
series' `poster_path` beside its title. `GET /api/series` is otherwise
unchanged. There is no migration.

**View models.**

- `ContinueCardMovie` gains `posterUrl: string | null`, the same name and type
  as `PosterCardMovie.posterUrl`.
- `continueView` fills it from the movie's poster through `imageUrl`.
- `episodeContinueView` fills it from the series' poster, and hashes its
  gradient from the **series** id instead of the episode id.

**`ContinueCard`.** It draws its art through its own `styled(Artwork)` with the
card's `posterUrl` and `poster`, at `cover` anchored `center 25%`. The existing
scrim keeps the title and Resume label legible. Its "no url, ever" comment is
retired.

**Prototype first.** Phase 1's first commit amends:

- `mol.PosterCard.dc.html` with a no-poster state showing the centred Wordmark
- `mol.ContinueCard.dc.html` with a `posterUrl` in `data-props` and its art
  layer at `center 25%`
- `page.MoviePage` and `page.SeriesPage` with the Default poster in the poster
  frame
- `COMPONENT-SPEC.md` with a note on the Default poster: where it appears,
  where it doesn't, and the layered url

There is no new `prim.*` file. `Artwork` and `Wordmark` have no prototype file
of their own, and the Wordmark's markup is the header's.

**Phases** (from the log's plan):

1. **The Default poster on the Poster card, end to end.** The prototype
   amendment, the `Wordmark` primitive with its two adopters, `Artwork`'s
   `poster`, size container and layered url, and `PosterCard` passing
   `poster`.
2. **The detail pages.** `hasArtwork` becomes `hasPoster`, and both poster
   frames pass `poster`.
3. **The poster on the Continue card.** `imageUrl` with all six copies
   replaced, `ContinueCardMovie.posterUrl`, `continueView`, the server's
   `series.posterPath`, `episodeContinueView` on the series' poster and
   gradient, and the `ContinueCard`'s art at `center 25%`.

## Testing Decisions

Good tests here assert what a user or a client can observe: what the wire
answers, what a view model holds, what a tile's background resolves to, what
is in the accessibility tree, and what text is drawn. They do not assert how a
component is nested or which helper was called. jsdom does no layout, so the
Wordmark's scaling is checked in the prototype and the running app, not in a
suite. Every suite below is written RED first.

- **`Wordmark`.**
  - It draws _Family_ and _Flix_.
  - _Flix_ resolves to the accent colour, and the whole mark is serif 700.
  - Prior art: the other primitives' suites, such as `StatusBadge` and
    `Toggle`.
- **`Artwork`.**
  - With a url, the background holds the url layer over the gradient.
  - Without one, it holds the gradient alone.
  - `poster` without a url draws the Wordmark, hidden from the accessibility
    tree.
  - `poster` with a url, or no `poster`, draws no Wordmark.
  - Prior art: `Artwork`'s existing suite.
- **`MainLayout` and `AboutSection`.** Their existing brand assertions still
  pass, so the logo still reads _FamilyFlix_ and still leads home.
- **`PosterCard`.**
  - With no poster, the Wordmark is drawn and the card is still named by its
    title.
  - With a poster, there is no Wordmark.
  - Prior art: `PosterCard`'s suite.
- **`detailView` and `seriesView`.**
  - `hasPoster` is true only when a poster is set. A backdrop alone gives
    false and a top tag.
  - Prior art: their existing suites.
- **`MovieDetail` and `SeriesDetail`.** A title with a backdrop and no poster
  draws the caption and the Wordmark in its poster frame. One with a poster
  draws neither.
- **`imageUrl`.**
  - A Stored path becomes `/api/images/<path>`.
  - `null` gives `null`.
  - Prior art: `moviePath` and `seriesPath`.
- **Series browse (server).**
  - Each Continue Watching entry carries the series' `posterPath`, set and
    `null`.
  - Prior art: `browse`'s suite and the series route suite.
- **`continueView` and `episodeContinueView`.**
  - `posterUrl` is built from the movie's or the series' poster, or is `null`.
  - The episode card's `g1`/`g2` equal `gradientFromId(series.id)`.
  - Prior art: their existing suites.
- **`ContinueCard`.**
  - With a `posterUrl`, the art layer holds it, at `center 25%`.
  - Without one, the Wordmark is drawn.
  - The title and Resume label are unchanged.
  - Prior art: `ContinueCard`'s suite.

## Out of Scope

- Art on the Season card, the episode thumbnails or the Up next card.
- A Wordmark on a backdrop or behind the player.
- Branding TMDB candidates.
- An `<img>` with `onError`, because the layered background covers a broken
  link.
- A generated image file per title, or any write, storage or export of the
  Default poster.
- The backdrop or the episode's Still as Continue art.
- A letterboxed poster on the Continue card.
- Steps 13–15 of the build order, and the Roadmap's **Move the media folder**.

## Further Notes

- The glossary already carries **Default poster** and the updated **Gradient
  fallback**, **Continue card**, **Wordmark** and **Poster URL** entries, in
  commit `7b0a798`.
- **Accepted:** a poster link whose file is broken draws the gradient without
  the Wordmark or caption, because the view still holds a url. It is a repair
  case, and Edit fixes it.
- **Accepted:** `center 25%` cuts the top and bottom of every poster on the
  Continue card and will sometimes miss a face.
- `Artwork` being a size container means a caller that gives it no height
  would get a zero-sized Wordmark. Every frame sets an aspect ratio today.
- This closes log 03 Q6's open item: real artwork on the Continue card,
  flagged then as a prototype amendment for later.
- Per the standing rule, step 12's ✅ in CLAUDE.md and the README waits for the
  refactor.
