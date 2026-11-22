# Plan: Seamless art, a detail page opens whole

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/685

Every picture in the **Managed media directory** is kept within its **Art
box**, fitted by FFmpeg where it is written and, for art already held, by the
**Art sweep** on every start. Pointing at or focusing a **Poster card** starts
its **Warm start**, so a detail page draws its backdrop in its first paint; a
page opened cold draws its gradient, then the whole backdrop in one frame.
The spec is design log 72.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order. There is no HITL
phase.** Phase 6's walk is done by the agent itself in the dev app, on the
400-title library. No decision is left open: log 72 settled them all.

- The phases are log 72's _Implementation Plan_ slices, with slice 4 split
  into one path end to end (phase 4) and the other features (phase 5).
- **Phases 1 to 5 each start from their own RED test** (`tdd`). Phase 6's
  documents are proved by the walk and a green suite.
- **Phase 1 lays the fitting** (`pictureSize`, `artBox`, `fitArt`) that
  phases 2 and 3 use; **phase 4 lays `warmArt` and `useDecodedArt`** that
  phase 5 uses. All six land before the next `npm version`.
- **Every existing test stays green after every phase.** A test that built
  `createMedia` without playback is given a fake `fitArt` in its phase's RED
  commit and is never deleted without a replacement.
- The glossary's **Seamless art** section was written in the grill-me. The
  checklist's step 54 row stays 🔜 until the refactor, and CLAUDE.md is not
  touched.

## Architectural decisions

Durable decisions that apply across all phases:

- **Schema**: no migration, no column, no flag. A fitted picture is within
  its box, so no later start asks again.
- **Routes**: none new and no wire change. The image route keeps
  revalidation (`max-age=0`, ETag, `Last-Modified`).
- **Dependencies**: none new, and no native module. FFmpeg (the replaceable
  **Playback component**) is the only fitter. TMDB stays at `original`.
- **Prototype**: none amended. `DetailBackdrop` and `PosterCard` keep their
  drawing; only `COMPONENT-SPEC.md`'s words change (phase 6).
- **Key models**:
  - **Picture size** `{ width, height }`, read off a picture's header
    (JPEG SOF, PNG IHDR, WebP VP8/VP8L/VP8X), or `null` when unreadable.
  - **Art box**: landscape (width ≥ height) at most 1920 wide, portrait at
    most 780 wide, never enlarged, the height following. It answers the
    width to fit to, or `null` when within. It is by shape, not role.
  - `ArtFormat = 'jpeg' | 'png' | 'webp'`, each written in its own format
    (`mjpeg -q:v 3`, `png`, `libwebp`) through a Lanczos `scale=<w>:-2`,
    stdin to stdout.
  - `Playback.fitArt(picture, width, format)` answers
    `{ kind: 'fitted'; picture: Buffer }` or
    `{ kind: 'none'; reason: 'no-component' | 'failed' | 'timed-out' }`,
    held to the **Fit budget** (10 s). A `none` always means the picture is
    kept as given.
  - `createMedia` takes `Pick<Playback, 'fitArt'>`.
  - `Media.fitStored(storedPath)` writes a `.part` beside the original and
    renames it over. If the rename fails, the original is left for the next
    start. It writes only under the Managed media directory.
  - `storage.heldArt()`: every poster, backdrop, Season poster and Still
    path the rows name.
  - `createArtSweep`, the **Quality sweep**'s twin: it is started on every
    start beside it and stopped beside it by the **Ordered shutdown**.
  - `warmArt(url | null): Promise<void>` and `isWarm(url): boolean` in
    `src/api/warmArt/`: the last 8 decoded elements kept, a url warm or
    warming never asked twice, a failure not held.
  - `useDecodedArt(url | null): string | null` in `src/hooks/useDecodedArt/`.
  - `PosterCard` emits `onWarm` on pointer enter and on focus;
    `PosterCardMovie` gains `backdropUrl`.
- **The rules**:
  - One size rule, enforced in the media domain where every picture is
    written, under the name it always had. A video or subtitle write is
    unchanged.
  - A picture within its box, unreadable, or whose fit answers `none` is
    stored byte for byte.
  - A **Library folder**'s own art is never rewritten. A request never reads
    half a file.
  - No fade. `DetailBackdrop`'s props and drawing do not change.

---

## Phase 1: One backdrop, end to end

**User stories**: 15, 16, 17, 20, 21, 22, 23, 33, 35, 36, 39, 40, 41

### What to build

The fitting, through its first writer. Picture size reads a header, the Art
box answers the width, the fit's argv is built per format, and
`Playback.fitArt` runs the component under the Fit budget. `createMedia`
takes `fitArt`, and `storeNamed` reads each picture whole, fits it if it is
over its box and writes it under its own name. `main.ts` passes playback into
media. Because `storeNamed` is the funnel for a Sync, a Season poster choice
and a Frame still, all three land fitted. Demo: a Sync of a title stores its
3840-wide `original` backdrop at 1920 wide and its poster at 780 wide, under
the same names; with no component both are stored as given.

### Acceptance criteria

- [ ] The Art box: landscape and portrait over, at and under their box; a
      square counts as landscape; never enlarged.
- [ ] Picture size: minimal JPEG, PNG and WebP (VP8, VP8L, VP8X) headers
      give their sizes; truncated, unknown or non-image bytes give `null`.
- [ ] The fit's argv per format: stdin in, Lanczos scale to the width, the
      format's encoder, stdout out.
- [ ] `fitArt` answers `fitted` with the component's output, `no-component`
      with an empty slot, `failed` on a non-zero exit, and `timed-out` past
      10 s with the process killed.
- [ ] `storeNamed`: a picture over its box is stored as `fitArt`'s answer
      under its own name; one within its box, one unreadable and one
      answered `none` are stored byte for byte.
- [ ] The Decision row's `w185` candidates are untouched.

---

## Phase 2: Every image write

**User stories**: 18, 19, 32

### What to build

`storeUpload` and `copyIn` fit an image filename (`fileKinds`' image
extensions) the same way, so the movie and series forms, a **Bulk import** and
a rescan all store art at screen size. Videos and subtitles still stream
untouched. `copyIn` stays cancellable. A **Layout fill** of an art-less
folder writes the fitted copy the app shows. Demo: adding a movie through
the form with a 4000-wide poster stores it at 780 wide; a Bulk import of a
folder of huge scans stores them fitted.

### Acceptance criteria

- [ ] `storeUpload` and `copyIn`: an image over its box is stored fitted
      under its own name; within, unreadable or `none` byte for byte.
- [ ] A video or subtitle is never handed to `fitArt` and still streams.
- [ ] `copyIn` still cancels mid-copy and leaves nothing behind.
- [ ] A Layout fill adds the fitted picture, and only to a folder that
      lacks it.

---

## Phase 3: The Art sweep

**User stories**: 24, 25, 26, 27, 28, 29, 30, 31, 34, 37

### What to build

Art already held is shrunk once, in place, offline. `storage.heldArt` names
every picture the rows hold, and `Media.fitStored` fits one through a `.part`
and a rename. `createArtSweep` walks them one at a time, yielding between two,
and fits only those over their box. It is started in `main.ts` once the
server listens, beside the Quality sweep, and stopped by the Ordered
shutdown. With no component it fits nothing, and the next start asks again.
Demo: on the 400-title library, the media directory's art shrinks after one
start, and the second start fits nothing.

### Acceptance criteria

- [ ] `heldArt` answers every poster, backdrop, Season poster and Still a
      seeded library names, and nothing else.
- [ ] `fitStored` replaces a file whole; when the rename fails the original
      is left in place and no `.part` stays behind.
- [ ] `fitStored` refuses a path outside the Managed media directory.
- [ ] The sweep fits only pictures over their box, one at a time; a `none`
      or a failure moves on to the next.
- [ ] Stopping the sweep mid-pass ends it after the current picture.
- [ ] The Ordered shutdown stops the Art sweep with the Quality sweep.
- [ ] Nothing is downloaded: the sweep has no network client.

---

## Phase 4: Warm start, one path end to end

**User stories**: 1, 2, 3, 4, 5, 6, 7, 8, 11, 12

### What to build

The Warm start through the library grid and a movie's detail page. `warmArt`
fetches and decodes a picture ahead, keeps the last 8, and never asks twice
for a url that is warm or warming. `useDecodedArt` answers the url once it
is decoded, at first render when it is already warm. `PosterCard` emits
`onWarm` on pointer enter and on focus, and the movie view model fills
`backdropUrl`. `LibraryGrid` warms the card's backdrop. `MovieDetail` hands
`DetailBackdrop` only a decoded url, so its first paint shows the backdrop
when warm, or the gradient and then the whole backdrop in one frame when
cold, and the gradient alone on a failure. The poster draws at once as
today. Demo: hovering a poster in the grid and pressing it opens the page
with its backdrop in the first paint; a direct link shows the gradient, then
the whole backdrop.

### Acceptance criteria

- [ ] `warmArt`: a url is decoded once however often it is asked; the 9th
      url evicts the oldest; a failure is not held and is asked again;
      `null` does nothing.
- [ ] `useDecodedArt`: `null` until decoded, then the url; the url at first
      render when already warm; `null` on a failure; a changed url starts
      again.
- [ ] `PosterCard` emits `onWarm` on pointer enter and on focus, and not on
      press alone.
- [ ] A hovered or focused card in `LibraryGrid` warms its backdrop url.
- [ ] `MovieDetail` draws the backdrop only once decoded, and the gradient
      alone before that and on a failure; the poster is drawn at once.
- [ ] No fade or motion is added to the backdrop.

---

## Phase 5: Warm start everywhere

**User stories**: 9, 10, 13

### What to build

The rest of the cards and the rest of the backdrops. `seriesCardView` fills
`backdropUrl`, and `CardCarousel` and `GenreTitles` warm on `onWarm` as the
grid does. `SeriesDetail` and `SeasonEpisodes` hand `DetailBackdrop` only
`useDecodedArt`'s answer. The Continue card and the Season card do not warm.
Demo: a title hovered in a home carousel or a genre's titles opens whole,
movie or series, and a season's episode page opens whole from its series.

### Acceptance criteria

- [ ] A hovered or focused card in a carousel and in a genre's titles warms
      its backdrop, for a movie and for a series.
- [ ] `SeriesDetail` and `SeasonEpisodes` draw the backdrop only once
      decoded, and the gradient alone before that and on a failure.
- [ ] The Continue card and the Season card never call `warmArt`.

---

## Phase 6: Walk it live, then the documents

**User stories**: 14, 38, 42

### What to build

The acceptance walk in the dev app on the 400-title library: the media
directory's art sizes before and after a start; a detail page opened from a
hover and opened cold, its backdrop timed; a second visit's requests read in
DevTools to confirm revalidation answers 304. If the second visit costs, the
cache reopens in a grill-me rather than here. Then the documents: the image
route's comment, stating revalidation as a decision; `tmdbClient`'s
`IMAGE_BASE` docblock (fitted on arrival); `COMPONENT-SPEC.md`'s
`DetailBackdrop` (drawn once decoded) and `PosterCard` (`onWarm`); the
checklist's step 54 entry; the docblocks of every unit touched.

### Acceptance criteria

- [ ] The media directory's art is measured before and after a start, and
      every held picture is within its box after it.
- [ ] A detail page opened from a hover draws its backdrop in its first
      paint; one opened cold never paints it in bands.
- [ ] A second visit's image requests revalidate, and no image is drawn
      stale after a rewrite across starts.
- [ ] `COMPONENT-SPEC.md`'s `DetailBackdrop` and `PosterCard` sections
      describe the decoded draw and `onWarm`.
- [ ] The checklist's step 54 entry describes the initiative and stays 🔜.
- [ ] Every touched unit's docblock describes its new face.
- [ ] The full suite and the typecheck are green.
