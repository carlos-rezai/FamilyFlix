> **Initiative:** `backdrop-veil`
> **Design log:** `docs/design-logs/34-backdrop-veil.md`
> **Issue:** #288
> **Build order:** step 17, the second of the third chain (log 32 §4) — a `feat:`

## Problem Statement

My parents open a film's page, or a show's page, to read what it is about and
press Play. The picture behind the page covers only the top of the screen.
When they scroll down to the synopsis and the cast, the picture scrolls away
with the text, and the bottom half of the screen is plain black. The page
looks unfinished.

The top of the page has a second problem. The title, the Play button and the
round action buttons sit over a thin shade that is barely darker than the
picture. Over a bright backdrop (a beach, a snowfield, a white sky), the white
text and the circles are hard to read.

The two pages also do not match. The movie page's shade starts at 45% and
covers 62% of the screen. The series page's starts at 35% and covers 520
pixels. They were meant to be the same thing, and they have drifted apart.

## Solution

On both detail pages, the picture now fills the whole screen and stays put.
The text scrolls over it, and the picture never scrolls away.

A **Backdrop veil** lies between the picture and the text, in place of the
old shade. It is a darker gradient: 65% dark at the top, where the title and
the buttons are, 85% halfway down, and solid page background at the bottom.
Under that gradient is a faint wash of the app's accent colour, so the
picture is tinted toward FamilyFlix's colour rather than toward plain grey.
Because the gradient ends on the page background, the picture has no hard
bottom edge.

The movie page and the series page draw the same thing, the **Detail
backdrop**, so they look the same and can never drift apart again. With
**Ultrawide margins** on, the picture stays inside the centred frame, as it
does today, and does not spill into the margins.

## User Stories

1. As a family member, I want a film's backdrop to fill the whole screen, so
   that the page looks finished rather than half black.
2. As a family member, I want the backdrop to stay where it is while I scroll
   down to the cast, so that the page keeps its picture all the way down.
3. As a family member, I want the title, Play and the round buttons to read
   clearly over any backdrop, even a bright one, so that I can see what to
   press.
4. As a family member, I want the backdrop to darken the lower I look on the
   screen, so that the synopsis and the credits are easy to read.
5. As a family member, I want the bottom of the screen to fade into the page
   background, so that there is no hard line where the picture ends.
6. As a family member, I want the backdrop faintly tinted in FamilyFlix's
   colour, so that the page feels like part of the app.
7. As a family member, I want a series page to look exactly like a movie
   page behind its text, so that the two kinds of page feel like one app.
8. As a family member, I want a film with no backdrop to show its coloured
   gradient full screen, under the same veil, so that the page never looks
   empty.
9. As a family member, I want a series with no backdrop to do the same, so
   that a show without art still looks finished.
10. As a family member, I want a backdrop that fails to load to fall back to
    the gradient, so that a broken image never leaves a blank screen.
11. As a family member on an ultra-wide monitor with **Ultrawide margins** on,
    I want the backdrop to stay inside the centred frame, so that the margins
    stay plain.
12. As a family member on an ultra-wide monitor with **Ultrawide margins**
    off, I want the backdrop to fill the full width, so that nothing changes
    for me except the veil.
13. As a family member, I want the page to scroll as smoothly as it does
    today, so that a pinned picture never makes the page feel slow.
14. As a family member, I want nothing on the page to move on its own, so
    that the page is calm. This matters especially with reduced motion on.
15. As a family member, I want the loading state of a page to look as it does
    today, with no backdrop, so that nothing flashes in before the page is
    ready.
16. As a family member, I want the "not found" and "couldn't load" screens to
    still cover the page, so that a failed page never shows a stray backdrop
    under its message.
17. As a family member, I want Back, the poster and the actions where they are
    today, so that I find everything in the same place.
18. As a screen-reader user, I want the backdrop ignored, so that it adds
    nothing to what is read out.
19. As the maintainer, I want the veil to follow the accent the theme is built
    with, so that a change of accent tints the backdrop too.
20. As the maintainer, I want one place to tune the veil's stops, so that a
    change lands on both pages at once.
21. As the maintainer, I want the prototype to show the new veil before the
    code does, so that the prototype stays the spec.
22. As the maintainer, I want the dialogs, the Continue card and the player to
    keep their own shades, so that this change touches only the detail pages.

## Implementation Decisions

- **One new molecule, `DetailBackdrop`, in `components/`.** It is composed
  from the `Artwork` primitive, it is presentational, and it knows no domain.
  It graduates the way `CreditsRow` did when a second page drew it. Its props
  are `url` (the **Backdrop**'s url, or `null`) and the two gradient colours
  `g1` and `g2`. It renders an `aria-hidden` art area holding the `Artwork`
  and the veil. The components barrel re-exports it.
- **Names.** The molecule is `DetailBackdrop`, not `Backdrop`, because
  **Backdrop** is the image, and not `BackdropVeil`, because the veil is only
  one of its two layers. Its two styled parts are `ArtArea` and `Veil`.
- **Staying put inside the Content frame.** `ArtArea` is
  `position: sticky; top: 0; height: 100vh; margin-bottom: -100vh`, drawn as
  the page scroller's first child. Sticky pins it to the scroller's visible
  box. The negative margin gives back its height, so the content starts at
  the top as it does today. It stays inside the scroller, so the **Content
  frame** still clips it (log 27 Q8). A comment names the coupling: `100vh`
  is the height of both pages' scrollers.
  - Rejected: `position: fixed`, because it escapes the Content frame and
    would paint the ultrawide margins. Also rejected: a scroll listener or a
    transform, because that is per-frame work for something CSS does on the
    compositor. Also rejected: re-gridding the page scrollers, because pages
    are composition only.
- **The veil.** One `Veil` element (`absolute`, `inset: 0`) with two
  background layers. On top is a gradient at 180°: `bg` at `.65` alpha at 0%,
  `.85` at 50%, solid `bg` at 100%. Under it is the theme's `accentSoft`. The
  alpha stops spell `bg` as `rgba(20, 17, 13, …)`, as both prototypes and
  both styles files already do. The wash goes under the gradient so that the
  last stop stays pure `bg` and the art has no edge.
- **The accent.** The wash reads `theme.colors.accentSoft`, never a literal,
  so it follows `createTheme(accent)`.
- **Callers.** `MovieDetail` and `SeriesDetail` replace their own `ArtArea` +
  `Scrim` with `<DetailBackdrop url={…} g1={…} g2={…} />`, passing the same
  backdrop url and gradient colours they pass today. Each feature's `ArtArea`
  and `Scrim` styled components are deleted. The pages do not change, except
  that the `Scroller` comments name the molecule.
- **The prototype first, in the same issue.** In `page.MoviePage.dc.html` and
  `page.SeriesPage.dc.html`, the art div and its gradient are rewritten to the
  sticky geometry and the two-layer veil, with the wash written as
  `var(--color-accent-soft)`. `FamilyFlix.dc.html` composes both pages, so it
  follows without an edit of its own. No `mol.DetailBackdrop` file is added,
  following `CreditsRow`'s precedent. `COMPONENT-SPEC.md` gains the
  molecule's row.
- **Unchanged.** `LoadingDetail` and `LoadingSeries` draw no art. The failure
  screens (`z-index: 10`) still paint over it. `Content`'s `z-index: 10` and
  its `130px` top padding, the poster frame, the Back pill and the Back circle
  all stay as they are. `Modal`'s, the `ContinueCard`'s and the player's
  scrims stay. No motion and no blur are added.
- **Shipping.** One vertical slice, one issue, one `feat:` commit series. The
  slice is the prototype revision, the molecule and its suite, the barrel
  line, and both features drawing it with their twins deleted.

## Testing Decisions

- A good test here checks what the molecule renders and how it is styled,
  read through `getComputedStyle` as a user's browser would resolve it. It
  never checks the styled-component class names or the internal structure
  beyond the `aria-hidden` root and the art.
- **`DetailBackdrop` gets its own suite**, which tests that:
  - the root is `aria-hidden`, `position: sticky`, `top: 0`, `100vh` tall;
  - the `Artwork` paints the url over the **Gradient fallback**, and paints
    the gradient alone for `null`;
  - the veil reads the theme's `accentSoft`. Rendered under
    `createTheme('#3a7bd5')`, its background carries that accent's 14% and
    not the default accent's.
- **`MovieDetail` and `SeriesDetail` keep their own suites.** Neither tests
  the art's geometry any more, because that belongs to the molecule. Any
  existing assertion on the old `ArtArea`/`Scrim` moves to the molecule's
  suite or is dropped as covered there.
- **Prior art:** `ContinueCard.test.tsx` reads the art's `backgroundImage`
  through `getComputedStyle`. `ContentFrame.test.tsx` reads computed layout
  style under the theme. `CreditsRow`'s graduation is the precedent for
  moving a feature's furniture into a molecule and its suite.
- jsdom does no layout, so the sticky pinning and the Content frame clipping
  are checked in the running app, not in the suite.

## Out of Scope

- A blur on the backdrop (log 32 Q2b).
- Parallax or any motion of the art.
- A veil on the Season page, which draws no backdrop.
- Tuning the stops per image brightness. `.65` is the floor for every
  backdrop.
- A `mol.DetailBackdrop` prototype file.
- Any change to `Modal`'s, the `ContinueCard`'s or the player's scrims.
- Any change to the page scrollers, the loading states or the failure screens.

## Further Notes

- A third detail surface (a season hero, if one is ever drawn) gets the art
  for one line.
- The art's `100vh` is tied to the scroller's height by convention, not by
  the cascade. A page whose scroller is not the full viewport would have to
  pass its own height. Today both scrollers are `100vh`, and a comment says
  so.
- New and updated glossary terms, already in `docs/ubiquitous-language.md`:
  **Detail backdrop** (new) and **Backdrop veil** (updated). On a detail page
  the word "scrim" is retired. Say **Backdrop veil** for the gradient and
  **Detail backdrop** for the whole art layer. **Backdrop** alone is still the
  image.
