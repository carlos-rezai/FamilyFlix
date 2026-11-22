> **Initiative:** `seamless-art`
> **Issue:** #685 (the PRD, step 54)
> **Design log:** `docs/design-logs/72-seamless-art.md`
> **Handoff:** none amended. `COMPONENT-SPEC.md`'s **Detail backdrop** already draws it with no motion; only the spec's words for when it is drawn change.
> **Build order:** step 54, **Seamless art**. Amends the step's planned **Cache** bullet (log 72 Q13). No migration, no new dependency, nothing new to package per **Platform build**.

## Problem Statement

Mum hovers a poster in a library of 400 titles and opens it. The poster and the words are there at once, but the backdrop behind them is not: for a second and a half, sometimes two, the page sits on its gradient, and then the backdrop paints in bands, top to bottom, under the **Backdrop veil**. Every detail page opens in two beats.

The art is far bigger than anything FamilyFlix draws:

- A **Sync** stores TMDB's `original` art: backdrops at 3840x2160, 0.8 to 2.4 MB each, posters around 1 MB, for frames that are at most 300px wide.
- A **Frame still** is grabbed at the video's own size, so a 4K episode gives a 4K Still.
- Art from the movie and series forms, a **Bulk import** or a rescan is stored exactly as given, at any size.

And the backdrop is first asked for only once the detail page draws, as a CSS background, so the browser fetches and decodes a multi-megabyte picture while the household is already looking at the page.

## Solution

**A detail page opens whole, backdrop included.**

- **Art is kept at screen size.** Every picture in the **Managed media directory** is held within its **Art box**, read off its own shape: a landscape picture (a backdrop, a Still) at most 1920px wide, a portrait one (a poster, a **Season poster**) at most 780px wide, never enlarged.
- **New art is stored at that size.** Whatever writes a picture, a Sync, a Season poster choice, a Frame still, the forms, a Bulk import, a rescan, it lands fitted, under the name it always had.
- **Art already held is shrunk once, on disk, offline.** The **Art sweep** runs in the background on every start, beside the **Quality sweep**, and fits each held picture over its box in place. Nothing is downloaded again; a fitted picture is never asked again. A **Library folder**'s own art is never touched.
- **The backdrop is ready before the page opens.** Pointing at or focusing a **Poster card** starts its **Warm start**: the backdrop is fetched and decoded in the few hundred milliseconds before the press, so the page draws it in its first paint.
- **Never in bands.** A page opened cold (a direct link, Back, the keyboard from elsewhere) draws its gradient, then the whole backdrop in one frame once it is decoded. No fade: the spec draws it with no motion.
- **FFmpeg does the fitting**, the same replaceable **Playback component** that already grabs Frame stills. With no component, or any failure, a picture is kept exactly as it was: never a broken file.

## User Stories

1. As the household, I want a detail page to open with its backdrop already drawn, so that the page arrives whole in one beat.
2. As the household, I want the backdrop never to paint in bands from top to bottom, so that the page looks finished rather than loading.
3. As the household, I want pointing at a poster to get its backdrop ready, so that by the time I press it the page is complete.
4. As a keyboard user in the family, I want focusing a poster with Tab to get its backdrop ready too, so that keyboard browsing opens pages as smoothly as the mouse.
5. As the household, I want a page I open by a link, by Back or from elsewhere to show its gradient and then the whole backdrop at once, so that even a cold open never paints in bands.
6. As the household, I want a backdrop that cannot be read to leave the gradient on its own, so that a broken picture never shows as a broken image.
7. As the household, I want the backdrop to appear without a fade, so that a page opened warm is not held back by an animation, as the prototype draws.
8. As the household, I want the poster on a detail page to appear at once, as today, so that nothing that was already instant gets slower.
9. As the household, I want a movie's detail page, a series' detail page and a season's episode page to all open whole, so that every page with a backdrop behaves alike.
10. As the household, I want the library grid, the home carousels and a genre's titles all to warm a poster's backdrop, so that it doesn't matter where I opened a title from.
11. As the household, I want moving the pointer across a whole row of posters not to slow the app down, so that browsing stays smooth.
12. As the household, I want a poster I hovered a moment ago to still open warm, so that going back and forth between a few titles stays instant.
13. As the household, I want the Continue Watching cards not to warm a backdrop, since they open the player, not a page with one.
14. As the household, I want a large library's grid to load and scroll lighter, so that 400 posters don't each decode a megabyte.
15. As the household, I want art from a Sync to be stored at screen size, so that a new title is as quick to open as an old one.
16. As the household, I want a Frame still from a 4K episode to be stored at screen size, so that the episode list doesn't decode 4K pictures.
17. As the household, I want a Season poster I choose to be stored at screen size, so that the season grid stays light.
18. As the maintainer, I want a poster or backdrop I add through the movie or series form to be stored at screen size, so that my own uploads follow the same rule as TMDB's.
19. As the maintainer, I want art brought in by a Bulk import or a rescan to be stored at screen size, so that a folder of huge scans doesn't bloat the library.
20. As the maintainer, I want art that is already within its box to be stored byte for byte as given, so that nothing is re-encoded for no reason.
21. As the maintainer, I want art never to be enlarged, so that a small picture is not blurred up to fill a box.
22. As the maintainer, I want a fitted picture to keep its format and its name, so that every row, url and Export that names it still works.
23. As the maintainer, I want a picture whose header can't be read to be stored as given, so that an odd file is never lost or broken.
24. As the maintainer, I want the art already in my library to be shrunk on the next start, without me doing anything, so that the whole library benefits, not just new titles.
25. As the maintainer, I want that pass to run in the background, one picture at a time, so that the app stays usable while it works.
26. As the maintainer, I want that pass to download nothing, so that it works offline and TMDB is never asked again for art it already gave.
27. As the maintainer, I want a picture shrunk once never to be looked at again, so that later starts cost almost nothing.
28. As the maintainer, I want a request for a picture mid-shrink to get the whole old picture or the whole new one, never half a file, so that nothing draws torn art.
29. As the maintainer on Windows, I want a picture that is held open and can't be replaced to be left for the next start, so that a locked file never fails the pass.
30. As the maintainer, I want the pass stopped cleanly by the **Ordered shutdown**, so that closing the app mid-pass leaves no half-written art.
31. As the maintainer, I want the art in my **Library folder** never to be rewritten, so that FamilyFlix still writes nothing into my folders but the **Layout fill** and the **Library sheet**.
32. As the maintainer, I want a Layout fill of an art-less folder to write the fitted copy, so that what it adds is the same picture the app shows.
33. As the maintainer with no FFmpeg installed, I want art to be stored as given and the app to work as today, so that a missing component never breaks an add, a Sync or a start.
34. As the maintainer, I want the next start after I install a component to fit what was stored as given, so that the library catches up on its own.
35. As the maintainer with a replaced component that can't write a format, I want that picture kept as given, so that a limited FFmpeg never produces a broken file.
36. As the maintainer, I want one fit that hangs to be stopped after 10 seconds and the picture kept, so that one bad file can't stall a write or the pass.
37. As the maintainer, I want the media directory to shrink after a start, so that the library takes a fraction of the disk it did.
38. As the maintainer, I want the image route to keep revalidating its pictures, so that a picture rewritten under its own name, or after a **Factory reset**, is never drawn stale across starts.
39. As the maintainer, I want the TMDB candidates shown in a **Decision row** left as they are, so that a url drawn and never stored isn't touched.
40. As the maintainer, I want one size rule enforced where every picture is written, so that the next new source of art follows it without anyone remembering to.
41. As the maintainer, I want no new native module in the shipped app, so that each **Platform build** packages exactly what it does today.
42. As the maintainer, I want the walk to time a detail page opened warm and cold, and to compare the art's sizes before and after a start, so that "opens whole" is measured, not assumed.

## Implementation Decisions

- **One initiative, three parts**: the art's size, the **Warm start**, and the cache decision, under one symptom and one walk.
- **The Art box, a pure unit in the media domain** (`artBox`). It takes a **Picture size** `{ width, height }` and answers the width to fit it to, or `null` when it is within its box. A picture at least as wide as it is tall is landscape (box 1920); otherwise portrait (box 780, the 300px detail poster frame at 2.6x). The constants are exported. Never enlarged; the height follows. The box is by shape, not role, because the media domain writes by filename and does not know a poster from a backdrop.
- **Picture size, a pure unit in the media domain** (`pictureSize`). It reads width and height off a picture's bytes: a JPEG's SOF marker, a PNG's IHDR, a WebP's VP8, VP8L or VP8X chunk; `null` for anything it cannot read, and such a picture is kept as given. A header read is a few KB; no ffprobe per file.
- **`fitArgs`, a pure unit in the playback domain** beside `frameArgs`: the FFmpeg argv for a picture on stdin, a Lanczos `scale=<width>:-2`, written to stdout in its own format: `mjpeg -q:v 3` for a JPEG, `png` for a PNG, `libwebp` for a WebP.
- **`Playback.fitArt(picture, width, format)`**, beside `frame`, answers `{ kind: 'fitted'; picture: Buffer }` or `{ kind: 'none'; reason: 'no-component' | 'failed' | 'timed-out' }`. It is held to the **Fit budget**, 10 s, as `frame` is to the **Frame budget**; past it the process is killed. `ArtFormat` is `'jpeg' | 'png' | 'webp'`. A `none` always means the caller keeps the picture as it is.
- **`createMedia` takes playback** as `Pick<Playback, 'fitArt'>`, the same narrow-dependency shape the Quality sweep takes. `main.ts` already builds playback before media; it now passes it in.
- **Every image write is fitted, in the media domain**: `storeNamed`, and `storeUpload` and `copyIn` for an image filename (`fileKinds`' image extensions), read the picture whole, read its Picture size, ask `artBox`, fit it if over, and write it under the name they always did. One funnel covers every source: a Sync, a Season poster choice, a Frame still, both forms, a Bulk import, a rescan. A video or subtitle write is unchanged and still streams. `copyIn` stays cancellable. Rejected: each caller fitting its own (six call sites), and fitting on the way out in the image route (paid again every start).
- **TMDB stays at `original`** and is fitted on arrival: one rule for every source, and TMDB has no 1920 rung. The Decision row's `w185` candidates are unchanged.
- **`Media.fitStored(storedPath)`**: fits one held picture in place. It writes the fitted picture to a `.part` beside the original and renames it over, so a request never reads half a file. A rename that fails (a file held open on Windows) leaves the original for the next start. It writes only under the **Managed media directory**.
- **`storage.heldArt()`**, a new library read: every image path the rows name (posters, backdrops, Season posters, Stills). Art is always copied in, so every one is a Managed path.
- **The Art sweep** (`createArtSweep`, in the media domain), the Quality sweep's twin: started in `main.ts` on every start once the server listens, beside the Quality sweep; walks `heldArt`, reads each Picture size, and calls `fitStored` on each over its box, one at a time, yielding to the event loop between two. A fitted picture is within its box, so no later start asks again: no column, no flag, no migration. With no component it fits nothing and the next start asks again. It downloads nothing. The **Ordered shutdown** stops it as it stops the Quality sweep.
- **`warmArt`, a shared wire call** (`src/api/warmArt/`), because the library, movie-detail and series features all use it: `warmArt(url | null): Promise<void>` fetches and decodes a picture ahead through an `Image` and its `decode()`; `isWarm(url): boolean` says whether it is decoded now. The last 8 elements are kept so Chromium keeps their pictures decoded; a url warm or warming is not asked twice; a failure settles quietly and is not held. Not a util: it holds state and talks to the server.
- **`useDecodedArt`, a shared hook** (`src/hooks/useDecodedArt/`): `useDecodedArt(url | null): string | null` answers the url once `warmArt` has it decoded, already at the first render when `isWarm`, and `null` until then; a failure stays `null`, the **Gradient fallback** alone.
- **`PosterCard` emits `onWarm`** on pointer enter and on focus, as it emits `onOpen`; it stays presentational. `PosterCardMovie` gains `backdropUrl`, filled by its view models (`view`, `seriesCardView`) from `imageUrl`.
- **The three features that draw a Poster card** (`LibraryGrid`, `CardCarousel`, `GenreTitles`) pass `onWarm` calling `warmArt` with the card's `backdropUrl`. The Continue card and the Season card do not warm.
- **The three features that draw a backdrop** (`MovieDetail`, `SeriesDetail`, `SeasonEpisodes`) pass `useDecodedArt`'s answer to `DetailBackdrop`, whose props and drawing do not change. Rejected: fetching inside the molecule; switching `Artwork` to its `<img>` mode.
- **No fade** (log 72 Q11).
- **The image route keeps revalidation** (`max-age=0`, ETag, `Last-Modified`), now stated in its comment as a decision: a picture is rewritten under its own name and a Factory reset reuses folder names, so a lifetime would draw stale art across starts. The walk measures a second visit; if it costs, the cache reopens in a grill-me.
- **Documents**: `COMPONENT-SPEC.md`'s `DetailBackdrop` (drawn once decoded) and `PosterCard` (`onWarm`); the feature checklist's step 54 entry; the docblocks of every unit touched, `tmdbClient`'s `IMAGE_BASE` and the image route's comment among them. The glossary's **Seamless art** section is already written (log 72).

## Testing Decisions

- A good test drives a unit through its public face and checks what it answers or what lands on disk or screen: the width asked for, the bytes stored, the url drawn, the call made. It never checks internals such as which helper ran or a styled-component's class.
- **`artBox`**: landscape and portrait over, at and under their box; a square counts as landscape; never enlarged. Prior art: the pure units' tests, such as `qualityOf`.
- **`pictureSize`**: real minimal JPEG, PNG and WebP (VP8, VP8L, VP8X) headers give their sizes; truncated, unknown or non-image bytes give `null`. Prior art: `parseSrt` and the other pure byte/text parsers.
- **`fitArgs`**: the argv per format: stdin in, the Lanczos scale to the width, the encoder, stdout out. Prior art: `frameArgs.test.ts`.
- **`Playback.fitArt`**: `fitted` with the component's output; `no-component` with an empty slot; `failed` on a non-zero exit; `timed-out` past the Fit budget, the process killed. Prior art: `createPlayback.frame.test.ts` and its fake component.
- **`createMedia`**: an image over its box is stored as `fitArt`'s answer under its own name, through each of `storeNamed`, `storeUpload` and `copyIn`; one within its box, one with an unreadable header, and one whose fit answers `none` are stored byte for byte; a video is never handed to `fitArt`; `copyIn` still cancels. `fitStored` replaces a file whole and leaves it in place when the rename fails. Prior art: `createMedia.test.ts`.
- **`storage.heldArt`**: every poster, backdrop, Season poster and Still a seeded library names, and nothing else. Prior art: `unmeasuredVideos`' tests.
- **`createArtSweep`**: fits only pictures over their box, one at a time; a `none` or a failure moves on; stopping it mid-pass ends it after the current picture. Prior art: `createQualitySweep.test.ts`.
- **`orderedShutdown`**: the Art sweep is stopped with the Quality sweep. Prior art: `orderedShutdown.test.ts`.
- **`warmArt`**: a url is decoded once however often it is asked; the 9th url evicts the oldest; a failure is not held and is asked again; `null` does nothing. Prior art: the `src/api/` calls' tests, with a stubbed `Image`.
- **`useDecodedArt`**: `null` until decoded, then the url; the url at first render when already warm; `null` on a failure; a changed url starts again. Prior art: `useImageFallback`'s tests.
- **`PosterCard`**: `onWarm` on pointer enter and on focus, not on press alone. Prior art: `PosterCard.test.tsx`.
- **The features**: a hovered card in the grid, a carousel and a genre's titles warms its backdrop; a detail page draws the backdrop only once decoded, and the gradient alone before and on a failure. Prior art: the features' existing tests.
- Every slice starts RED (`tdd`). The acceptance is the walk on the 400-title library: the media directory's art sizes before and after a start; a detail page opened from a hover and cold, its backdrop timed; a second visit's requests read in DevTools.

## Out of Scope

- A cache lifetime on the image route, versioned urls or hashed names (log 72 Q13).
- Fitting a **Library folder**'s own art.
- Warming from anything but a Poster card: the Continue card, the Season card, a direct link.
- The Decision row's TMDB candidates, drawn off TMDB at `w185`.
- A fade or any other motion on the backdrop.
- `sharp`, Electron's `nativeImage`, a JS decoder or the renderer's canvas as the fitter.
- Any change to the prototype's drawing.

## Further Notes

- Trade-offs accepted: fitting rests on the replaceable FFmpeg, so with none new art is stored as given until a start finds a component; an image write now reads the picture whole before it lands (a few MB at most); a picture rewritten under its own name is drawn old until the next start in a session that already loaded it (the Art sweep's fit is the same picture smaller, so it does not matter there).
- Implementation plan (log 72): 1. one backdrop end to end (`pictureSize`, `artBox`, `fitArgs`, `fitArt`, `storeNamed` fitting: a Sync's backdrop lands at 1920 wide); 2. every image write (`storeUpload`, `copyIn`); 3. the Art sweep (`heldArt`, `fitStored`, `createArtSweep`, start and shutdown); 4. the Warm start (`warmArt`, `useDecodedArt`, `onWarm`, the six features); 5. the walk and the documents.
