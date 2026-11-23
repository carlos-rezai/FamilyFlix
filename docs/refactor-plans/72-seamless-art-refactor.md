# Refactor plan: Seamless art, the Art fit stated once, one way to write a picture, the component's one spawn, and the docs that close step 54

> Source initiative: `seamless-art`, issue 685 (step 54).
> Shipped by issues 686 to 691: five slices, RED and GREEN each, and the
> walk and documents slice (`c9ad74c3` to `4b094114`).
> Design log: `docs/design-logs/72-seamless-art.md`.
> PRD: `docs/PRDs/72-seamless-art.md` (685). Plan:
> `docs/PRDs/72-seamless-art-plan.md`.
> Handoff: none amended (log 72 Q2); `COMPONENT-SPEC.md`'s words for
> `DetailBackdrop` and `PosterCard` changed in 691, and nothing further here.
> This is the initiative's closing round. It ticks **Seamless art** and
> closes 685. Filed as issue #692.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._ The maintainer approved every recommendation in advance.

## Problem Statement

`seamless-art` shipped every phase of its plan. Every image write into the
**Managed media directory** (`storeNamed`, `storeUpload` and `copyIn` for an
image name) reads the picture's **Picture size** off its header and, over its
**Art box**, stores `Playback.fitArt`'s answer under the same name. The
**Art sweep** runs beside the **Quality sweep** on every start, fitting held
art in place through `fitStored`, and the **Ordered shutdown** stops it. A
**Poster card** emits `onWarm` on pointer enter and focus, the three features
that draw one call `warmArt`, and the three detail pages draw their
**Detail backdrop** through `useDecodedArt`. The walk (691) fitted 51 of 120
held pictures, 78.6 MB down to 34.2 MB; a warm page drew its backdrop 39 ms
after the click, a cold one in one step at 474 ms; a reload revalidated with
304s, so the cache stays as it is.

At `4b094114` the full suite has **13195 tests passing across 931 files**
(one skipped), and `tsc -b --force` is clean.
`eslint` over every file the initiative added, and every shipping file it
changed, reports **0 errors and 0 warnings**.

The design held. What is left is what five slices across two build targets
leave behind: one private rule in `createMedia` that answers "no fit" by
handing back the very buffer it was given, three ways of writing a picture's
bytes in one file, a spawn written twice for one difference, a few comments,
and the documents, two of them missing outright. Every finding below was
checked against the code at `4b094114`. They fall into four families.

### 1. `createMedia`'s fit says "none" by identity

- **`fitted` answers a buffer either way.** It returns `fitArt`'s answer for
  a picture over its box and the picture itself for every other, so a
  caller cannot tell the two apart by type. `fitStored` tells them apart by
  reference, `if (fit === picture) return;`: a rule a later edit (a copy, a
  `Buffer.from`) would break silently, rewriting every held picture on every
  start. Every other "maybe" in the domain answers `null` for none
  (`artBox`, `pictureSize`, `pictureFormat`, `mediaFilePath`).
- **Its name is not the glossary's.** Log 72 named the act the **Art fit**;
  the helper is `fitted`, an adjective for a buffer, beside `fitArt`
  (Playback's) and `fitStored` (the domain's).

### 2. Three ways to write a picture in one file

- **A picture's bytes move three ways.** `storeUpload` and `storeNamed`
  write the fitted picture with `writeFileSync`, `copyIn` reads it with
  `fs/promises`' `readFile` and writes it with `writeFileSync`, and
  `fitStored` reads and writes with `fs/promises` throughout. A video in
  the same functions moves through an awaited `pipeline`, never blocking;
  the folder housekeeping around both (`mkdirSync`, `rmSync`, `statSync`)
  is synchronous across the whole domain. The fitted picture is the only
  byte write that blocks the event loop, on the same request path as a
  video that does not.
- **The `node:fs/promises` import sits after `node:path`**, apart from the
  `node:fs` import it completes.

### 3. The component's spawn, written twice

- **`ffmpegComponent`'s `spawn` calls `spawn` in two branches** that differ
  only in the first `stdio` slot (`'pipe'` when a picture is handed in,
  `'ignore'` otherwise). The comment above them says why; the code says it
  twice.

### 4. Comments and names

- **The three detail pages repeat their docblock inline.** `MovieDetail`,
  `SeriesDetail` and `SeasonEpisodes` each carry `// The backdrop is drawn
only once decoded, so it never paints in halves.` above the
  `useDecodedArt` call, a line under a docblock that already says it, in
  the log's word (_bands_), not this one (_halves_).
- **`pictureFormat`'s docblock bolds `ArtFormat`** as if it were a
  glossary term; it is a type, written in backticks everywhere else.
- **Four docblock lines the initiative wrote run past the file's width**:
  `artBox`'s `PORTRAIT_BOX` (84 columns), `ArtSweep.start` (83),
  `pictureFormat` (82), and the **Ordered shutdown**'s docblock (94), the
  one line issue 688 rewrote.
- **`createMedia.fitArt.test` is named for Playback's method**, not the
  aspect it pins. It drives `storeNamed`; its siblings are named for what
  they drive (`fitStored`) or what they cover (`fitWrites`).

### 5. The documents

- **The build has no journal entry.** Every build before it wrote _the
  build_ (busy overlay's late, in its refactor); issue 691's commit carries
  the walk's measurements in its message but never touched
  `docs/dev-journal.md`.
- **The README names none of the new units.** Its `media/` line does not
  name the Art fit, `artBox`, `pictureSize`, `fitStored` or the Art sweep;
  `playback/` does not name `fitArgs` or `fitArt`; `library/` does not name
  `heldArt`; `src/api/` does not name `warmArt`, `src/hooks/` does not name
  `useDecodedArt`; neither `test-support/` line names `pictureBytes`,
  `unfittedArt` or `stubImage`.
- **The feature checklist's row reads ⬜ Planned**, and step 54 reads 🔜.

## Solution

One round in five groups, each commit leaving the suite green and the
typecheck clean:

1. **The Art fit stated once**: first a pin that `fitStored` leaves a
   picture it does not fit untouched; then `createMedia`'s private `fitted`
   becomes `artFit`, answering the fitted picture or `null`, and
   `fitStored` reads `null` rather than comparing buffers.
2. **One way to write a picture**: every fitted picture written with an
   awaited `fs/promises` `writeFile`, as `fitStored` writes it; the import
   beside `node:fs`.
3. **The component's one spawn**: one `spawn` call, its stdin slot chosen
   by whether a picture is handed in.
4. **Comments and a suite's name**: the three inline comments gone, the bold
   type, four long lines, `createMedia.fitArt.test` renamed.
5. **The documents**: the README, the build's missing journal entry, and
   the entry and ticks that close step 54 and issue 685.

## Commits

Every commit is `refactor:` (or `docs:` / `test:` where it says so), titled
`refactor: [seamless-art] issue #<n> <description>` with `<n>` this plan's
issue. Each runs the suites of the units it touches; each group ends on the
full suite and `tsc -b --force`. No test is weakened, and outside commit
1's two new pins no test's claim changes in groups 1 to 3: the existing `createMedia.fitArt`, `fitWrites`
and `fitStored` suites, `createArtSweep`'s, and `createPlayback.fitArt`'s
real-FFmpeg cases are the proof that each move kept the behaviour.

### Group 1: the Art fit stated once

1. **`test:` `fitStored` leaves a picture it does not fit untouched.** Two
   cases in `createMedia.fitStored.test`: a held picture within its box,
   and one whose `fitArt` answers `none`, each with its modification time
   set into the past first, keep that time and their bytes after
   `fitStored`, and leave no `.part`. Today only `createArtSweep.test`
   covers these two, by bytes alone, and a rewrite of the same bytes
   passes it while giving the image route a new `Last-Modified` and ETag,
   so every visit would be a 200 instead of a 304. Both pass on arrival:
   they pin the behaviour commit 2 rests on.

2. **`fitted` becomes `artFit`, answering `null` for none.** The private
   helper keeps its place at the top of `createMedia`'s body and its rule
   (no **Picture size**, no `ArtFormat`, within the **Art box**, or a
   `none` from `fitArt` all keep the picture), and answers
   `Promise<Buffer | null>`: the fitted picture, or `null` for one kept as
   given. Its docblock says so, in the glossary's words. `storeUpload`,
   `storeNamed` and `copyIn` write `(await artFit(picture)) ?? picture`;
   `fitStored` returns early on `null`, its reference comparison gone.
   Commit 1's two pins, the rest of `createMedia.fitStored.test` and
   `createArtSweep.test` stay green unchanged.

### Group 2: one way to write a picture

3. **Every fitted picture written with an awaited `writeFile`.**
   `storeUpload`'s and `storeNamed`'s `writeFileSync` and `copyIn`'s become
   `await writeFile(...)` from `node:fs/promises`, as `fitStored` writes;
   `copyIn`'s second `signal?.throwIfAborted()` stays between the fit and
   the write, and its `catch` still takes a half-written file with it
   (`rmSync`, as for a video). `writeFileSync` leaves the `node:fs` import.
   The `node:fs/promises` import moves up beside `node:fs`. The folder
   housekeeping stays synchronous, as across the domain. `fitWrites`'
   _cancels an image while it is being fitted and leaves nothing behind_
   and the routes' upload suites stay green unchanged.

### Group 3: the component's one spawn

4. **`ffmpegComponent.spawn` spawns once.** One `spawn(binaries.ffmpeg,
args, { stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe',
'ignore'], windowsHide: true })`, its comment kept above it; the
   `exited` promise and the stdin write below it unchanged.
   `createPlayback.fitArt`'s real-FFmpeg cases (a PNG and a JPEG fitted
   through stdin) and the frame and streaming suites, which spawn with no
   input, stay green unchanged.

### Group 4: comments and a suite's name

5. **Comments.** The inline `// The backdrop is drawn only once decoded…`
   line goes from `MovieDetail`, `SeriesDetail` and `SeasonEpisodes`, each
   page's docblock already saying it. `pictureFormat`'s docblock writes
   `` `ArtFormat` ``. The four long lines are rewrapped to the file's width:
   `PORTRAIT_BOX`'s, `ArtSweep.start`'s, `pictureFormat`'s and
   `orderedShutdown`'s. No code moves.

6. **`test:` `createMedia.fitArt.test` becomes `createMedia.fitNamed.test`**,
   named for `storeNamed`, the write it drives, beside `fitWrites` and
   `fitStored`. A `git mv`; its `describe` and `it` names already say
   `storeNamed` and stay as they are.

### Group 5: the documents

7. **`docs:` the README.** Its `media/` line names the **Art fit** at every
   image write, `artBox` (the **Art box** by shape), `pictureSize` (a
   header's **Picture size** and `pictureFormat`), `fitStored` and
   `createArtSweep` (the **Art sweep**); `playback/` names `fitArgs` and
   `fitArt` under the **Fit budget**; `library/` names `heldArt`, the
   sweep's read; `src/api/` names `warmArt` (the **Warm start**);
   `src/hooks/` names `useDecodedArt`; the server's `test-support/` names
   `pictureBytes` and `unfittedArt`, the frontend's `stubImage`.

8. **`docs:` the build's journal entry.** _2026-11-23: Seamless art, the
   build (issues 686 to 691)_, placed before this round's: what each slice
   shipped, the walk's measurements as issue 691's commit recorded them
   (the sweep's 120 pictures, 51 over their box, 78.6 MB to 34.2 MB and no
   `.part` left; a warm page's backdrop 39 ms after the click, a cold one
   whole at 474 ms; a reload's 304s and the pre-fit ETag's 200), that it
   ran on a copy of the installed library and not on 400 titles, and the
   judgement calls a later session needs (below). Its counts are the ones
   this plan records at `4b094114`.

9. **`docs:` step 54 is done.** The feature checklist's row reads ✅ Done;
   step 54 reads ✅. The dev journal gains this round's entry: counts before
   and after, what each group changed, where the round left the plan, and
   the follow-ups below. The commit's body closes 685.

## Decision Document

- **A "maybe" in the media domain answers `null` for none.** `artFit`
  joins `artBox`, `pictureSize`, `pictureFormat` and `mediaFilePath`: the
  caller writes `?? picture` where it keeps the original, and nothing
  compares buffers by reference.
- **The helper is named for the glossary's act**, `artFit`, beside
  Playback's `fitArt` (one picture through the component) and the domain's
  `fitStored` (one held picture in place). It stays private to
  `createMedia`: it closes over `playback`, and no second unit calls it.
- **A picture's bytes move awaited, its folders synchronously.** Every
  byte write in `createMedia` is awaited (a video's `pipeline`, a picture's
  `writeFile`), so neither blocks a request behind it; the directory
  housekeeping across the domain stays sync, as it was.
- **Unchanged, as settled by log 72 or as built:** `ArtFormat` in
  `playback/fitArgs/`, read by `media/pictureSize/` (the media domain
  already reads `mediaFilePath` from `playback/`); `PictureSize` in
  `pictureSize/`, not `artBox/`; the box constants as `LANDSCAPE_BOX` and
  `PORTRAIT_BOX`, the glossary's **Art box**, not the log's draft names;
  `heldArt` as its own `library/heldArt/` repository, as
  `unmeasuredVideos` is; `warmArt` in `src/api/` (log 72 Q9);
  `PosterCard`'s `onWarm` optional; `/api/images` revalidating (Q13).
- **No route, no wire, no schema, no prototype, no visible change.**

## Testing Decisions

- A good test drives a unit through its public face and checks what comes
  out: which bytes are on disk under which name, which width and format
  `fitArt` was asked for, whether a cancelled copy left anything behind,
  what a detail page draws before and after a picture decodes. It never
  checks a private helper's name, whether a write was sync, or how many
  times `spawn` appears.
- **One pin first, then groups 1 to 3 change no test.** Commit 1 adds
  the one claim the move needs and no suite makes: a picture `fitStored`
  does not fit is not rewritten (its modification time kept, as the image
  route's `Last-Modified` and ETag read it), not merely rewritten with the
  same bytes. Prior art: the never-throws pins the video-quality refactor
  added ahead of its move, passing on arrival. Beyond it, the pins already
  in place are the proof: `createMedia.fitArt` (to be `fitNamed`), `fitWrites` and
  `fitStored` script `fitArt` through `unfittedArt` and read the files
  back; `createArtSweep.test` pins the sweep's order, yielding, stop and
  never-throws; `createPlayback.fitArt`'s real-FFmpeg cases fit a PNG and a
  JPEG through stdin with the Default component, and run on this machine.
- **Group 4's rename moves a file, not a claim.** Prior art: the aspect-
  named suites beside it (`createMedia.fitStored`, `fitWrites`) and
  `createImporter`'s and `createEnrichment`'s families.
- **No walk.** Nothing drawn, fetched or stored changes; issue 691's walk
  stands. The full suite and `tsc -b --force` close each group, and
  `eslint` over the touched files stays clean.

## Out of Scope

- **`yieldToEventLoop`, written in both sweeps.** The **Art sweep** is the
  **Quality sweep**'s twin by decision, in two domains, and the server has
  no shared home outside a domain (no `lib/`); a third copy would earn a
  grill over where it lives.
- **`pictureSize` and `pictureFormat` each sniffing the format.** `artFit`
  calls both, so the signature is read twice: a few bytes, and a merged
  answer would change the **Picture size**'s shape and its glossary row.
- **A fit cancelled with its copy.** `copyIn` asks the signal before and
  after the fit, not during it, so a cancel waits out at most one **Fit
  budget** (10 s). A behaviour change, recorded as a follow-up.
- **`collectFit` and `collectFrame`'s parallel settle logic.** They differ
  on purpose (a fit reads the exit code, a frame takes an abort signal);
  a shared collector would serve two callers with two shapes.
- **The `@/api/warmArt` import's place** in `LibraryGrid` and
  `CardCarousel`, after `@/types`: the house sets no import order, and
  Prettier keeps none.
- **A cache lifetime on `/api/images`**: log 72 Q13, confirmed by the walk.
- **Fitting a Library folder's art, warming from anything but a Poster
  card, the Decision row's TMDB candidates**: log 72's own out of scope.
- **Every long comment line older than this initiative.**

## Further Notes

- Groups 1 to 4 are independent of each other; commits 2 and 3 touch the
  same three functions and run in that order, after commit 1's pin.
  Group 5's commits 8 and 9 come last, since 9 records this round's
  counts.
- **Follow-ups for the journal**: a fit that a cancelled import waits out
  (above); and whether a 400-title library, which the walk did not have,
  shows what the copy of the installed one did.
- Nine commits; the build was large but held, and the round is mostly one
  helper's answer and the documents a closing round always writes.
