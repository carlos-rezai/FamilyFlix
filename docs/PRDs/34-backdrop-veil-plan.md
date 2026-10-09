# Plan: Backdrop veil — the detail pages' art fills the viewport and stays put

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/288

Today the movie page and the series page each draw their own `ArtArea` and
`Scrim`. The art is `absolute` against the page's scroller, so it covers 62%
of the screen (520px on the series page) and scrolls away with the text,
leaving the bottom half bare `bg`. The shade's top stop (`.45` or `.35`) is
too pale for the title and the circles over a bright backdrop, and the two
copies have already drifted apart.

This is build step 17, the second of the third chain (log 32 §4), and a
`feat:`. The PRD and design log 34 Q9 decide that it ships as **one vertical
slice and one issue**, and the plan keeps that. The prototype revision, the
molecule and both callers are one change to one surface. Splitting them would
leave one page on the old shade and the other on the new veil.

## Running the phase

Phase 1 runs AFK under `issue-loop`. The prototype revision comes first in the
same issue, before the code (log 34 Q6). It is a rewrite of two art divs in
files that already exist, not a new prototype, so it does not need a HITL stop.

## Architectural decisions

Durable decisions that apply across the phase:

- **Routes**: unchanged. `/movie/<id>` and `/series/<id>` draw the same pages.
  No API, wire call or server change.
- **Schema**: no migration. The art reads the **Backdrop** url and the
  **Gradient fallback** colours the pages already pass.
- **Key models**:
  - **Detail backdrop**: one molecule in `components/`, composed from the
    `Artwork` primitive, presentational, with no domain knowledge. Its props are
    `{ url: string | null; g1: string; g2: string }`. It renders an
    `aria-hidden` art area that holds the `Artwork` and the veil. The
    components barrel re-exports it. Both detail pages draw it, and the third
    one, if it ever exists, gets it for one line.
  - **Geometry**: the art area is `position: sticky; top: 0; height: 100vh;
margin-bottom: -100vh`, drawn as the page scroller's first child. It stays
    inside the scroller, so the **Content frame** still clips it with
    **Ultrawide margins** on (log 27 Q8). The `100vh` is coupled to the height
    of both scrollers by convention, and a comment says so.
  - **Backdrop veil**: one element (`absolute`, `inset: 0`) with two background
    layers. On top is a 180° gradient: `rgba(20, 17, 13, .65)` at 0%, `.85` at
    50% and solid `bg` at 100%. Under it is `theme.colors.accentSoft`, never a
    literal. The wash sits under the gradient so the last stop stays pure
    `bg` and the art has no edge.
  - **Vocabulary**: "scrim" is retired on a detail page. Use **Backdrop veil**
    for the gradient and **Detail backdrop** for the whole art layer.
    **Backdrop** alone is still the image. `Modal`'s, the `ContinueCard`'s and
    the player's scrims keep their names and their shades.
- **Boundaries**: the pages do not change; only their `Scroller` comments name
  the molecule. `LoadingDetail` and `LoadingSeries` draw no art. The failure
  screens (`z-index: 10`) still paint over the art. `Content`'s `z-index` and
  `130px` top padding, the poster frame, the Back pill and the Back circle all
  stay where they are. No motion and no blur are added.

---

## Phase 1: The Detail backdrop

**User stories**: 1–22

### What to build

First the prototype. In `page.MoviePage.dc.html` and `page.SeriesPage.dc.html`,
rewrite the art div and its gradient to the sticky `100vh` geometry and the
two-layer veil, with the wash written as `var(--color-accent-soft)`.
`FamilyFlix.dc.html` composes both pages, so it follows without an edit of its
own. `COMPONENT-SPEC.md` gains the molecule's row. No `mol.*` file is added,
following `CreditsRow`'s precedent.

Then the code. Build the **Detail backdrop** molecule and its suite, and add
its barrel line. Switch the movie page's and the series page's organisms to
it, passing the backdrop url and gradient colours they pass today, and delete
each feature's own art area and shade. Any existing assertion on the old
pieces moves to the molecule's suite or is dropped as covered there.

When this phase is done, opening a film or a show shows its picture over the
whole screen. The picture stays put while the synopsis and cast scroll over
it, under a darker veil tinted with the accent that fades into the page
background at the bottom. Both pages look the same.

### Acceptance criteria

- [ ] Both detail prototypes draw the sticky `100vh` art under the two-layer
      veil (`.65` 0% → `.85` 50% → `bg` 100%, over
      `var(--color-accent-soft)`), and `COMPONENT-SPEC.md` lists the molecule
- [ ] The molecule's root is `aria-hidden`, `position: sticky`, `top: 0` and
      `100vh` tall, read through `getComputedStyle`
- [ ] Given a url, the `Artwork` paints it over the Gradient fallback. Given
      `null`, it paints the gradient alone
- [ ] Rendered under `createTheme('#3a7bd5')`, the veil's background carries
      that accent's 14% and not the default accent's
- [ ] The movie page and the series page both draw the molecule. Neither
      feature keeps an `ArtArea` or a `Scrim` of its own, and neither suite
      tests the art's geometry
- [ ] The loading states draw no art, and the not-found and couldn't-load
      screens still cover the page
- [ ] `Modal`'s, the `ContinueCard`'s and the player's scrims are unchanged
- [ ] The full suite, `tsc -b --force`, ESLint and Prettier are green
- [ ] Checked in the running app, since jsdom does no layout: the art stays
      pinned while the page scrolls on both pages. With Ultrawide margins on,
      it stays inside the frame. With them off, it fills the full width
