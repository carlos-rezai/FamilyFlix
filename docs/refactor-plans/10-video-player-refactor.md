# 10 — Built-in video player refactor

Follows the build in issues #83–#93 (parent #82), and is the plan issue **94**
asked for by name in its own definition of done. The feature shipped in nine
phases; the suite is green at **2181 tests across 134 files**, `eslint src server`
is clean, and both **Built-in video player** and **Watch tracking** are still 🔜
in README and CLAUDE.md — deliberately, because a feature is not done until its
refactor round is.

This is the largest initiative the project has run: a fourth backend domain, a
frontend feature with fourteen units in it, three new reads, one new write, four
subtitle parsers, two new `test-support/` doubles, and a seed that now writes
files as well as rows. Two rounds in a row had found almost nothing structural
(#73, #81). This one finds twenty-six things, and the largest of them is not a
duplication — it is a **typecheck that has been failing for six commits and
saying so in each of them**.

Issue 94 filed seven of the twenty-six from the build's own vantage point. This
plan verifies all seven against the code as it stands, and adds nineteen more
found by reading the whole feature — both sides of the wire — against
`docs/handoff/`, `docs/design-logs/10-video-player.md` and CLAUDE.md's
conventions. The instruction this round was given is a **1:1 translation of the
prototype into our codebase using our naming, conventions, patterns and
architecture**, so the fidelity findings (Group H) are as much a part of it as
the duplications.

## Problem Statement

### 1. `npm run typecheck` is red, and nothing was ever going to notice

Two errors, reported twice each because `tsconfig.json` is a solution and both
`tsconfig.app.json` and `tsconfig.spec.json` include `src/`:

```
src/features/player/PlayerScrubber/PlayerScrubber.tsx(69,9): error TS2769
src/features/player/VolumeSlider/VolumeSlider.tsx(67,9): error TS2769
  Type 'RefObject<HTMLElement | null>' is not assignable to
  type 'Ref<HTMLDivElement> | undefined'.
```

`useDragScalar` types its track as `RefObject<HTMLElement | null>` and both
sliders attach it to a styled `div`, whose `ref` wants `HTMLDivElement`.
`HTMLElement` is the supertype, so the assignment is genuinely unsound and
TypeScript is right.

Two things make it worse than a stray error. It **shipped four more times after
it was noticed** — the `feat` commits for issues 88 and 89 both close with "Two
typecheck errors remain in PlayerScrubber and VolumeSlider, both predating this
commit and untouched by it", and three more commits landed on top. And **nothing
was ever going to catch it**: `.husky/pre-commit` runs `lint-staged`, and
`.lintstagedrc` runs Prettier and nothing else. No eslint, no `tsc`, no vitest.
2181 green tests say nothing about a type error because Vitest does not
typecheck, and the only thing that reports it is a script no gate runs.

A second, smaller type inaccuracy sits in the same hook: the drag's window
listeners are typed `(event: MouseEvent)` while registered on `pointermove` and
`pointerup`, which deliver `PointerEvent`. It compiles — `PointerEvent` is a
`MouseEvent`, so the assignment is sound in the safe direction — but the
signature says the wrong thing about what arrives.

### 2. The player duplicates three things inside itself

None of these is large. All three are in a feature whose own docblocks argue,
repeatedly and correctly, that one behaviour should be written down once.

- **`percentOf`** — a five-line pure function turning a 0–1 scalar into a
  rounded percent string — is **byte-identical** in `PlayerScrubber.tsx` and
  `VolumeSlider.tsx`. It is a pure helper, which is what `src/utils/` is for,
  and CLAUDE.md requires a test for every function in it. It has none, in
  either copy.
- **The chrome face of `IconButton`** — `background: transparent; border: none;
color: #fff;` plus the identical `&:hover:enabled` block — is written out in
  full in `PlayerControls.styles.ts` (as `TransportButton`) and again in
  `VolumeSlider.styles.ts` (as `MuteButton`). Each of the two carries a docblock
  pointing at the other ("the same reason the transport row states its own"),
  which is a comment doing the work a shared component should be doing. The
  `IconButton` primitive deliberately refuses an over-artwork variant, and it is
  right to: the app's three other translucent call sites differ from each other
  by accident. These two do not differ at all.
- **`SKIP_SECONDS = 10`** is declared in `PlayerControls.tsx` and again in
  `usePlayerKeys.ts`. The whole argument for the keyboard hook is that "every key
  is handed the very handler its button is handed, so a key and a button cannot
  drift apart" — and the one number they both need is the one thing they do not
  share.

### 3. The route layer got a `writeSignal` and never got its counterpart

`writeSignal` was extracted (`routes/index.ts:45`) because the 404-before-write
check "was upheld by three routes having remembered to paste the same four
lines". The read side now has exactly that shape and no such helper:

- `getMovie` missing → `404 { error: "Unknown movie: <id>" }` appears **five**
  times (`:53`, `:378`, `:506`, `:570`, `:646`), three of them this build's.
- `playback.videoFile` missing → `404 { error: "No video file for movie: <id>" }`
  appears **three** times (`:514`, `:578`, `:601`), all this build's.

`/playback` and `/stream` open with the identical six-line pair. `writeSignal`'s
own docblock argues why it stays local to the file rather than graduating to a
folder; whatever the read counterpart is called, that argument applies unchanged
to where it lives.

### 4. The `Response` fake, in twenty-four files — now measured

Twenty-four frontend test files hand-roll `{ ok, status, json } as unknown as
Response`. The player added six of them. It was eighteen before this initiative.

Issue 94 said this was a measurement to make rather than assume. It has now been
made:

| Helper                | Definitions | Distinct bodies                                                |
| --------------------- | ----------- | -------------------------------------------------------------- |
| `okResponse`          | 23          | **22 byte-identical**, 1 (`LibraryPage`) wraps a `HomePayload` |
| `serverErrorResponse` | 14          | **14 byte-identical**                                          |
| `notFoundResponse`    | 7           | 4 variants, differing **only** in the error string             |

That is the `makeMovie` finding from #80/#81 one rung over, and it comes out the
same way: fold what is genuinely identical, parameterise the one axis that
actually varies (the 404's message), and leave the specimen that is doing
something else at its call site.

### 5. Four playback modules have no test, and they are the only four

Every unit under `server/src/` has a co-located test — twenty-four of twenty-
eight. The four that do not are all in `playback/`:

| Module            | Covered by                           | What is uncovered                                              |
| ----------------- | ------------------------------------ | -------------------------------------------------------------- |
| `createPlayback`  | `routes.test.ts`, through the router | Its own contract, stated nowhere a reader can find             |
| `probe`           | nothing                              | ffprobe-JSON → `MediaProbe`, including the matroska/webm split |
| `mediaDuration`   | nothing                              | `moov`/`mvhd` parsing, v0 vs v1, the all-ones sentinel         |
| `ffmpegComponent` | nothing                              | Hardware-encoder selection order                               |

`mediaDuration` is the sharpest of these. The dev journal singles it out — "A
32-bit duration of all ones is the container saying it does not know, which is
not a film that runs for 49 days" — and no test names that rule. It is a pure
parse over a buffer, which is the cheapest thing in the repository to test.

`probe` and `ffmpegComponent` look untestable because they spawn, but
`capabilities` already solved exactly this in the same domain and the same
initiative: `capabilities(env, listing = ffmpegDecoders)` takes what the binary
would have printed as a default parameter, so ten tests exercise it on a machine
with no FFmpeg. Neither of the other two has that seam.

### 6. `Player.tsx` is 368 lines and holds three effects

The organism owns the two opening reads, the volume-persistence effect, the cue
fetch, the subtitle track choice, the on-screen line, the notice decision and
the composition of six hooks. Every piece is argued in a comment and none of it
is wrong — but the file is a third as long again as any other component in the
app, and three candidates come out of it cleanly: the two opening reads
(`fetchMovie` + `fetchPlayback`, the `cancelled` flag, the `fileMissing`
derivation); the subtitle block (`preferredSubtitle` → `subtitlesOn` → the
one-shot cue fetch → `cueAt`), which is four pieces of state serving one
feature; and the volume-persistence effect with its `volumeSettled` ref.

The counter-argument is that `Player` is _supposed_ to be where the screen is
assembled, and a hook per paragraph is its own kind of mess. This stays a
**measure-then-decide**, in the spirit of #81's conditional commits.

### 7. One thing the element does that the comment beside it says it does not

`Player.tsx` guards the media element with `fileMissing || cannotPlay ? null :
<Picture …>`, under a comment reading "No element over bytes no browser can
read: one left there stalls, retries and logs a decode error behind a notice
already saying what happened."

Both flags derive from the **Playback read**, and both are `false` until it
lands. So on the first render the element _is_ mounted and pointed at
`/api/movies/:id/stream` — for a film with no file, and for a film nothing can
decode. The request is answered 404 or 415 and the element is unmounted a moment
later, so nothing visible breaks; but the guard does not hold on the frame the
comment is about, and either the guard or the comment is wrong.

### 8. Six comments outlived the slices they were written in

The build narrated itself honestly, phase by phase. Nine phases later, six of
those sentences are false in shipping code and in test narration:

- `Player.tsx:53–58` — a `/** … */` explaining that the **Stream offset** is not
  put on the stream URL here, with **no declaration under it**, so it reads as
  `moviePath`'s documentation, which it is not. (Issue 94, item 7.)
- `usePlayback.ts:321` — "the ±10s buttons, and the keyboard next slice". The
  keyboard is issue 91 and shipped.
- `PlayerPage.tsx:10` — "`Player`, which owns the picture and (from the next
  slice) the chrome, the hooks and the state". It owns all of it.
- `mediaDuration.ts:128–135` — "the only container this slice can be asked
  about", "the ffprobe read … arrives with the transcoding paths", "until then".
  All three arrived.
- `ffmpegComponent.ts:67` — "the next slice's error handling is where that is
  caught". **No such error handling shipped.** A conversion that fails to start
  produces no bytes, the element never fires `playing`, and the buffering notice
  stays up for the rest of the evening. That is a real defect, and fixing it
  means a state the screen does not draw yet — a build, not a refactor. The
  comment stops claiming a slice that never came, and the defect gets filed.
- `Player.test.tsx:36` ("What this slice cannot do yet is seek") and
  `PlayerControls.test.tsx:15, :132` ("the CC pill … the next slice's") — three
  places where a suite narrates a limitation the same file now has tests
  against.

And one leftover of a different kind: `src/features/player/.gitkeep` is still
there, in a directory holding forty-four files.

### 9. The handoff spec and the code have drifted apart

This is the group the round's stated goal is about, and the direction of the fix
matters: CLAUDE.md's rule is that the prototype is amended first and the code
built to the amendment, never the reverse. Three of these are the spec being
behind; one is a divergence to look at and decide.

- **COMPONENT-SPEC §ProgressBar and §PlayerControls both say the scrubber is
  built on the `ProgressBar` primitive.** It is not, and it should not be:
  `ProgressBar` sets `overflow: hidden` (which would clip a knob centred on the
  fill's end), `transition: width 0.2s ease` (which would lag a drag by a fifth
  of a second), a dark `rgba(0,0,0,0.45)` track where the player wants
  `rgba(255,255,255,0.2)` over film, and a `role="progressbar"` where a seek bar
  needs `role="slider"`. The build declined the spec's suggestion correctly and
  recorded nothing about it. **The spec is what changes.**
- **COMPONENT-SPEC §PlayerControls lists the prototype's own prop names** —
  `currentTime`, `subsOn`, `controlsVisible`, `showBigPlay`, `showBuffering`,
  `showUnavailable`, `noticeTitle`, `noticeBody` — and maps the whole surface to
  `pages/PlayerPage`. What shipped is `position`, `subtitlesOn`, `visible`, and
  a separate `PlayerNotice` taking one `kind`, composed by `Player` with
  `PlayerControls`, `PlayerScrubber`, `VolumeSlider` and `SubtitleOverlay`
  beside it. The shipped shape is the one the design log argued for; the table
  is a year-zero snapshot of the prototype's own view model.
- **COMPONENT-SPEC's icon table names `VolumeMuteIcon` and `CaptionsIcon`.** The
  primitives are `VolumeMutedIcon` and `SubtitlesIcon`. The shipped names are
  the ones that match the ubiquitous language (**Subtitles** is the canonical
  term; "captions" is listed as an alias to avoid) and the element's own
  `muted`. The table is what is out of step.
- **`PlayerNotice`'s `Stack` merges two of the prototype's stacks into one.**
  `feat.PlayerControls.dc.html` gives the buffering stack `gap: 20px` and
  nothing else, and the unavailable stack `gap: 20px; padding: 0 40px;
text-align: center`. Ours applies the unavailable stack's padding and
  alignment to both. A one-line caption centred in a grid is unaffected by
  either, so this is very likely a difference of nothing — but it is a
  difference, and this round is the place to confirm it and say so.

Two things were checked and found **faithful**, and are recorded so nobody
re-opens them: the subtitle overlay's lift between 130px and 60px is PRD story
36, not an invention; and `Stage`'s `cursor: pointer` where the prototype's
`playerWrap` says `default` is the same pixel, because the prototype's
click-to-play layer covers the whole surface at `cursor: pointer` anyway.

### 10. Two rulings this build's size invalidates, and two unused members

- **The temp-directory sandbox.** #81 declined a shared helper because three
  copies had three ownership models. There are now **eight** server test files
  calling `mkdtempSync`, and **five** of them share one shape:
  `realpathSync(mkdtempSync(join(tmpdir(), prefix)))`, pushed onto a tracked
  array, `rmSync`d in an `afterEach` (`seed`, `mediaFilePath`, `routes`, and —
  without the `realpathSync` — `capabilities` and `ffmpegBinary`). The other
  three (`db`, `write`, `genre`) really are a different thing: they mint database
  _file paths_ inside a lazily-created directory. The ruling was made at three;
  it should be re-taken at eight.
- **`componentDir` is written twice, near-verbatim** (issue 94, item 2).
  `capabilities.test.ts` and `ffmpegBinary.test.ts` open with the same `EXE`
  constant and the same comment on it, the same `sandboxes: string[]`, the same
  `afterEach`, the same `componentDir(names)`, and the same `ffmpegIn` /
  `ffprobeIn`. They differ in the `mkdtemp` prefix and one word of a docblock.
  `server/src/test-support/` exists because of exactly this measurement.
- **File sizes.** `routes.test.ts` nearly doubled, 1881 → **3346 lines**, and is
  now the largest file in the repository by a wide margin, covering four
  domains' endpoints. `Player.test.tsx` landed at **1835**. #81 refused to split
  `home.test.ts` "to hit a number" and that principle stands — but it was stated
  at half these sizes.
- **Two exported members nothing consumes.** `useFullscreen` returns
  `fullscreen`, which no shipping file reads; the `fullscreenchange` effect
  exists solely to maintain it. (A pressed face on the fullscreen button would
  consume it — and would be a prototype amendment, which is not this round's.)
  And `usePlayback` takes **five positional parameters**, three of them
  defaulted and none of them ever omitted, in a feature where `useWatchReporter`,
  `useDragScalar` and `usePlayerKeys` all take an options object.

## Solution

Ten groups, ordered so the defect goes first and the documents go last, and so
that every conditional group has landed or been written off before the round is
declared over.

**Group A is the only thing here that is a defect.** `useDragScalar` gains a
type parameter so each slider names its own element and nothing widens, and
`.husky/pre-commit` gains `tsc` so the class of failure that shipped six times
cannot ship a seventh. Everything after A moves code without changing what a URL
answers, what the screen shows or what gets written.

**Groups B through E remove duplication**, in ascending order of how certain the
shape is: the player's own three (B), the read routes' preambles (C), the
`Response` fake (D), and the server test rung (E).

**Group F closes the coverage gap** — the four playback modules, with the two
spawning ones getting `capabilities`' own injection seam so that a test can be
asked about a machine other than the one running it.

**Group G is conditional**: measure `Player.tsx`, then extract or record why not.

**Group H makes the handoff spec and the code agree again**, which is this
round's stated goal read literally — the spec is amended to what the design log
argued for and the build shipped, and the one genuine pixel question is settled
by looking.

**Group I clears the comments that outlived their slices**, the `.gitkeep`, and
re-takes the two rulings. **Group J** is the documents and the ✅ tick.

## Commits

### Group A — the red typecheck, and the gate that let it ride

**A1. Give `useDragScalar` a type parameter.**
`useDragScalar<E extends HTMLElement = HTMLElement>` hands back
`trackRef: RefObject<E | null>`; `PlayerScrubber` names `HTMLDivElement` and so
does `VolumeSlider`. The default keeps every other possible call site working
unchanged. Nothing about behaviour moves — the hook already only ever calls
`getBoundingClientRect`. `npm run typecheck` goes green in this commit, and the
commit message says so in those words.

**A2. Correct the drag listeners' event type.** `onMove` and `onUp` take
`PointerEvent`, which is what `pointermove` and `pointerup` deliver. Separate
from A1 so that the commit which turns the typecheck green contains exactly one
idea.

**A3. Put `typecheck` in the pre-commit hook.** `.husky/pre-commit` runs
`node_modules/.bin/lint-staged` and then `node_modules/.bin/tsc -b
tsconfig.json` — the binary directly, never `npx`, for the reason CLAUDE.md
gives at length. ESLint and the test run stay out: eslint is clean and cheap to
run by hand, and a fifteen-second suite on every commit is the gate people start
routing `--no-verify` around, which would cost more than it buys. The commit
message records that both were considered and why one gate rather than three.

### Group B — the player's own three duplications

**B1. `percentOf` becomes `src/utils/toScalarPercent/`.** One folder, one
function, one test — the shape every helper in `utils/` has, and the barrel
gains a line. The test asserts the rounding rule the two copies encode (one
decimal place, so the CSS never carries float noise) and both ends of the range.
`PlayerScrubber` and `VolumeSlider` import it; neither keeps a local copy.

**B2. One chrome face for the player's icon buttons.** `PlayerControls.styles.ts`
exports the shared `styled(IconButton)` extension under a name that says what it
is rather than where it is used — `ChromeIconButton` — and `TransportButton` and
`MuteButton` both become it. `VolumeSlider.styles.ts` imports from its parent's
styles, which is the precedent `LoadingDetail` ← `MovieDetail.styles` and
`GenreGrid` ← `LibraryGrid.styles` already set. **The primitive is not widened**:
`IconButton.styles` explains at length why an over-artwork variant would make an
API out of accidental drift, and that argument is untouched by two call sites in
one feature that genuinely do not drift. The two docblocks that pointed at each
other are replaced by one that states the face once.

**B3. One `SKIP_SECONDS`.** The constant moves to whichever of the two files
reads as its home — `usePlayerKeys` imports the chrome's, or both import a
feature-level constant — and the commit message says which and why. What is not
allowed is leaving two.

### Group C — the read routes' 404 preambles

**C1. Add the read counterpart to `writeSignal`, used by nothing.** A local
function in `routes/index.ts` — the same rung `writeSignal` and `isMovieSort`
already sit on, for the same reason its docblock gives: the trigger for a folder
is companion files, and this has none, being observable only through the router.
It answers the movie or `null`, having already sent the 404 when there is none.
Its docblock states the rule it holds, the way `writeSignal`'s does. Suite green,
nothing else touched.

**C2. Point `/movies/:id` and `/movies/:id/subtitles/:subtitleId` at it.** The
two reads that need only the movie lookup. Their bodies get shorter; their
responses do not change by a byte, which `routes.test.ts` already asserts.

**C3. Add the video-file counterpart and point `/playback` and `/stream` at
it.** The second half of the identical six-line pair — resolve
`playback.videoFile`, 404 with `No video file for movie:` when it is `null`.
Split from C1–C2 because it is a second rule with a second message, and because
`/stream`'s own `sendFile` callback re-uses that message a third time, which the
commit should either route through the same helper or explain why it cannot.

### Group D — the `Response` fake

**D1. Add `src/test-support/fakeResponse/`, imported by nothing.** Three
functions and one test: `okResponse(body)`, `serverErrorResponse()`, and
`notFoundResponse(error?)` with a default message. The bodies are the twenty-two-
copy specimen exactly as it stands — changing them here would silently alter
twenty-two files' fixtures under cover of a refactor. The test asserts what each
promises: the `ok`/`status` pair, and that `json()` resolves the body it was
given.

**D2. Point the `api/` rung's tests at it.** `fetchMovie`, `postValue`,
`saveFavorite`, `saveWatched`. Four files, the rung the fake is most obviously
about.

**D3. Point the player's six at it.** `player/api`, `Player`,
`useWatchReporter`, `PlayerPage`, and the two the initiative promoted. This
round's own files, so a failure here is bisectable to the feature being
refactored.

**D4. Point the library, search and movie-detail tests at it.** Twelve files.
Split from D2–D3 only so a failure is bisectable to one area.

**D5. Point the page- and app-level tests at it, and rule on the two
specimens.** `App`, `GenrePage`, `MoviePage`, and `LibraryPage` — whose
`okResponse` builds a whole `HomePayload` and is therefore **not** the same
helper. Express it as a thin local wrapper over the shared one, or leave it and
say so in the commit message. Either is the commit; leaving the question open is
not.

### Group E — the server test rung

**E1. Move `componentDir` onto `server/src/test-support/`.** One folder holding
the `EXE` constant, the directory factory and the `ffmpegIn` / `ffprobeIn`
helpers, with its own test asserting what it promises: the named files exist,
they are executable on a platform that has such a bit, and nothing else is in the
directory. **Verify first**, as B2 of the Continue Watching plan had to, whether
a module-scope `afterEach` inside an imported helper is registered per importing
file under Vitest — if it is not, the cleanup stays at the call site and only the
factory moves. Say which of the two happened in the commit message.

**E2. Point `ffmpegBinary.test.ts` and `capabilities.test.ts` at it.** The two
suites that motivated it. Assertions untouched.

**E3. Re-take the temp-sandbox ruling, at eight.** Measure the five files
sharing the `realpathSync(mkdtempSync(prefix))` + tracked-array + `afterEach`
shape against the three that mint database file paths in a lazily-created
directory. If the five are one helper, they become one — `sandboxRoot(prefix)`
beside `componentDir`, which would then be built on it. If they are not, the
commit message says why the ruling comes out the same way it did at three. #81's
own precedent is that this is a legitimate outcome; leaving it unasked a third
time is not.

### Group F — the four playback modules that nothing names

**F1. Test `mediaDuration`.** A pure parse over a buffer, so the fixtures are
buffers written to a temp file: a v0 `moov`/`mvhd` with a known timescale and
duration; a v1 header with its 64-bit duration; the **32-bit all-ones sentinel**,
which is the container saying it does not know and must answer `null` rather than
49 days; a file with no `moov`; a `moov` with no `mvhd`; a header that stops
mid-box; a file that will not open at all. This is the sharpest of the four
because the journal singles the sentinel out and nothing asserts it.

**F2. Give `probe` a seam and test the parsing.** The ffprobe-JSON →
`MediaProbe` half is pure and is where every interesting rule lives — the
`mov,mp4,m4a,…` list collapsing to `mp4`, and the `matroska,webm` list splitting
on the file's own extension because Chromium reads one and refuses the other.
Follow `capabilities`' precedent exactly: a default parameter carrying what the
binary would have printed, so a test can be asked about a machine other than the
one running it. Whether that is a default parameter on `probe` or a separate
pure unit beside it is the commit's call; the constraint is that **no test
spawns a binary**, which is the property that keeps CI — a machine with no
FFmpeg on it — green.

**F3. Give `ffmpegComponent` the same seam and test the encoder selection.**
`detectHardwareEncoder` reads a listing and picks the first of five names in
preference order. The listing becomes injectable the way `capabilities`' is, and
the test asserts the order, the fallback to `null` when none is listed, and the
`null` when the process could not be run at all. What is **not** asserted is that
a given machine can run what its ffmpeg build lists — the journal is right that
no test can pin that, and the selection is the part that is ours.

**F4. Test `createPlayback` directly.** It is exercised end-to-end through
`routes.test.ts`, which is real coverage, but its contract — `videoFile`, `read`,
`stream`, `subtitleFile`, `cues` — is stated in a docblock and asserted only as a
side effect of HTTP. The test hands it a temporary media root and a fake
component and names the rules that are its own rather than a route's: that a
present file whose length nothing can determine answers `cannot-play` and not a
duration of nought; that `stream` refuses an offset past the end **before** the
spawn rather than after it; that the film's very last second is not past it; and
that a subtitle file which will not parse answers `[]` and never throws.

### Group G — `Player.tsx`, measured

**G1. Measure, then extract or record why not.** The three candidates are the
opening reads, the subtitle block, and the volume-persistence effect. Extract the
ones that come out as a hook with a name and a contract — a hook that is a
paragraph moved out of a component and still needs the component's comment to be
understood has made two files out of one idea. Whatever the outcome, it is
**one commit per extraction** and a commit message recording what was left and
why. If nothing moves, that is the commit: a note in this plan's own record and
in the dev journal, not silence.

Two constraints on any extraction. The dangling docblock (I1) is fixed
**before** this group, so it does not get carried into a new file still attached
to the wrong declaration. And the guard in finding 7 is settled here, since it
lives in the opening-reads block: either the element waits for the **Playback
read** before it is pointed at the stream, or the comment stops claiming it
does. Both are a one-line change; the commit picks one and says why.

### Group H — the prototype and the spec, made to agree again

**H1. Amend COMPONENT-SPEC's ProgressBar entry.** The line "the player scrubber
base" comes out, replaced by a sentence recording that the scrubber is its own
surface and why: `overflow: hidden` clips a centred knob, a width transition lags
a drag, the track colour is wrong over film, and a seek bar is a `slider` rather
than a `progressbar`. This is a **spec amendment, not a code change** — the code
already declined correctly, and what was missing was the record.

**H2. Amend COMPONENT-SPEC's PlayerControls entry.** The prop list becomes the
shipped one, and the row records the composition the design log settled: `Player`
as the organism, with `PlayerControls`, `PlayerScrubber`, `VolumeSlider`,
`SubtitleOverlay` and `PlayerNotice` beside it, rather than one component mapped
to `pages/PlayerPage`. The §6 screen-mapping row is updated to match.

**H3. Amend COMPONENT-SPEC's icon table.** `VolumeMuteIcon` → `VolumeMutedIcon`,
`CaptionsIcon` → `SubtitlesIcon`, with a half-line noting that the shipped names
follow the glossary, where **Subtitles** is canonical and "captions" is listed as
an alias to avoid. The code does not move: it is already the one that is right.

**H4. Settle `PlayerNotice`'s merged stack.** Compare the buffering state as
rendered against `feat.PlayerControls.dc.html` at the prototype's own preview
size. If the padding and text-align genuinely change nothing for a one-line
caption in a centred grid — which is the expectation — keep the merge and say so
in a comment on `Stack`, so the next reader does not re-open it. If anything
moves, split the two stacks as the prototype has them. Either way this is the
last of the fidelity findings and the commit that closes the 1:1 question.

### Group I — the comments that outlived their slices

**I1. Fix the dangling docblock.** `Player.tsx:53–58` becomes a docblock on
`streamUrl`, which is what it is about, or a plain comment. It is currently
parsed as `moviePath`'s documentation, which is a claim about the wrong function.

**I2. Correct the five stale slice comments in shipping code.**
`usePlayback.ts:321`, `PlayerPage.tsx:10`, `mediaDuration.ts:128–135`, and
`ffmpegComponent.ts:67`. The last of these is not merely stale — it points at
error handling that never shipped, and a conversion that fails to start still
leaves the buffering notice up forever. The comment stops promising a slice, and
**the defect is filed as its own issue** rather than fixed here: the fix is a
state the screen does not draw, which is a build. The commit message carries the
new issue's bare number, never a closing keyword.

**I3. Correct the three stale narrations in the suites.** `Player.test.tsx:36`
and `PlayerControls.test.tsx:15, :132` each describe a limitation the same file
now has tests against. Nothing about what they assert changes.

**I4. Delete `src/features/player/.gitkeep`.** Forty-four files make the case.

**I5. Rule on `useFullscreen`'s unused `fullscreen`.** Nothing renders it, and
the `fullscreenchange` effect exists only to maintain it. Either it goes with its
effect and the hook returns one function, or the commit message records that it
is kept for the pressed face a prototype amendment would bring — but a return
value with no reader is not left unexamined a second time.

**I6. Rule on `usePlayback`'s five positional parameters.** Every other hook in
this feature takes an options object. Convert it, or write down why this one is
different. If it converts, `PlaybackSource` collapses into `PlaybackRead` at the
same time — it restates the same two fields for a hook that is handed the read
whole.

**I7. Re-take the file-size ruling, at 3346 and 1835.** `routes.test.ts` is the
largest file in the repository and covers four domains' endpoints;
`Player.test.tsx` is the largest test in `src/`. #81's "not to hit a number"
stands, and the question is not the number — it is whether either file has a seam
that is about _something_ rather than about length. `routes.test.ts` has one per
domain; `Player.test.tsx` has one at the subtitles block and one at the keyboard
block, both of which carry their own ~270-line harness dependency. Split on a
seam, or record in writing that neither is one. Conditional, and dropped rather
than forced.

### Group J — the documents, and the tick

**J1. The glossary.** `docs/ubiquitous-language.md` is in good order for this
feature — every player and playback term is defined and the two-durations
ambiguity is flagged — so this commit adds only what the round itself decided:
whatever Group B named the shared chrome button, and whatever Group C named the
read helper's rule.

**J2. The dev-journal entry.** What this round found, what it moved, what it
declined and why, and the honest sentence the initiative earned: the largest
thing the biggest build in the project left behind was a failing gate that
reported itself in two commit messages and was carried by six more. Plus the
follow-ups this round files — the conversion-that-will-not-start defect from I2,
and anything Groups D5, E3, G1, I5, I6 and I7 write off rather than land.

**J3. The tick.** **Built-in video player** and **Watch tracking** go ✅ in
`README.md` and `.claude/CLAUDE.md` — the last commit of the round, because a
feature is done after steps 7–8 of the workflow and not when its build issues
close. `813b546` reverted exactly such a premature tick once; this is the commit
that earns it.

## Decision Document

- **`useDragScalar` becomes generic in its element**, defaulting to
  `HTMLElement`, rather than the sliders casting their refs. A cast at two call
  sites would silence the compiler about a thing the compiler is right about; the
  parameter lets each slider state the element it actually has.
- **The pre-commit hook gains `tsc` and nothing else.** ESLint is clean and
  cheap to run by hand; a full test run per commit is a gate that gets bypassed.
  The mechanism that let the error ride was that no gate ran the one script that
  reports it, and that is the mechanism this closes.
- **The `IconButton` primitive is not widened.** Its refusal to carry an
  over-artwork variant is argued and correct. The player's two identical
  extensions become one shared extension _inside the feature_, which is a
  different rung and a different claim.
- **`percentOf` graduates to `src/utils/`** rather than to a feature-local
  helper: it is pure, it has two callers already, and CLAUDE.md's rule is that
  every function there has a test — which is the thing neither copy has.
- **The read routes' helpers stay local to `routes/index.ts`**, on
  `writeSignal`'s own recorded argument: the one-folder-per-unit trigger is
  companion files, and a route helper's behaviour is observable only through the
  router, which is where it is already tested.
- **`server/src/test-support/` takes `componentDir`**, and possibly a sandbox
  root under it. The rung exists for precisely this and its rule is unchanged:
  never imported by shipping code, one folder per unit, no category barrel.
- **`src/test-support/fakeResponse/` folds what is byte-identical and
  parameterises only the 404's message.** `LibraryPage`'s payload-building
  variant is a different thing and is treated as one.
- **`probe` and `ffmpegComponent` get `capabilities`' default-parameter seam.**
  Not a mock of `node:child_process`, and not a spawned fixture binary: the
  domain already has one answer to "how is a spawning module tested here", and a
  second would be a second convention.
- **No HTTP contract changes and no pixel moves.** Every route answers what it
  answered, the screen shows what it showed, and the writes are the writes. If
  something looks or answers differently, that is a bug in the refactor.
- **The COMPONENT-SPEC amendments are documentation catching up to decisions the
  design log already argued**, not a redesign. Where the spec and the code
  disagree in this feature, the code is right in all four places, which is why
  all four commits are docs-only.
- **The conversion-that-will-not-start defect is filed, not fixed.** It needs a
  state the prototype does not draw, and CLAUDE.md's rule is that the prototype
  is amended first.

## Testing Decisions

**What makes a good test here, restated because Group F adds new ones.** A test
names external behaviour — what a caller can observe — and never how it is
computed. `mediaDuration`'s tests assert the seconds a file reports, not that a
`moov` box was found; `probe`'s assert the `MediaProbe` a listing produces, not
which branch of `normalizeContainer` ran; `createPlayback`'s assert the plan the
domain answers, not that `choosePlaybackPath` was called. The property that must
survive every commit in Group F is the one CI depends on: **no test spawns a
binary**, because CI is a machine with no FFmpeg on it and the whole suite passes
there today.

**Modules tested for the first time:** `mediaDuration`, `probe` (its parsing),
`ffmpegComponent` (its encoder selection), `createPlayback` (its own contract).

**Modules gaining a test because they gain a home:** `src/utils/toScalarPercent`,
`src/test-support/fakeResponse`, `server/src/test-support/componentDir`, and a
sandbox helper if E3 lands one. Each is a `test-support`/`utils` unit and gets
the test its rung requires — the doubles' tests assert what the double promises,
which is the shape `makeMovie.test.ts`, `stubMediaElement.test.ts` and
`freshStorage.test.ts` already set.

**Prior art to follow:**

- `capabilities.test.ts` — a spawning module tested through an injected listing,
  in this same domain and this same initiative. F2 and F3 are that pattern twice
  more.
- `mediaFilePath.test.ts` — filesystem fixtures in a `realpathSync`'d temporary
  directory, including the symlink cases. F1's buffers-on-disk fixtures follow it.
- `makeMovie.test.ts` (#81's A1) — the shared builder's own test: the default
  type-checks as a complete record, and an override replaces exactly the field
  named. D1 is that test for `Response`.
- `freshStorage.test.ts` (#81's B2) — including the `afterEach`-registration
  question E1 has to re-answer for `componentDir`.
- `routes.test.ts`'s converting arms — every one already runs through a fake
  component, which is why F4 can test `createPlayback` without changing how the
  route suite works.

**What no test asserts, on purpose:** whether a given machine can run the
hardware encoder its ffmpeg build lists. F3 covers the selection given an answer;
"available" varies by machine and is not something a test can pin.

**The invariant for every other group:** all 2181 existing tests pass, unchanged
in what they assert. Groups B–E and I touch test _files_ extensively — imports,
deleted local factories, corrected narration — and touch no assertion. If an
expected value changes, the commit is wrong.

## Out of Scope

- **Any change to what a URL answers, what the screen shows, or what gets
  written.** This round moves no pixel and changes no HTTP contract.
- **The conversion that fails to start** (finding 8 / I2). Filed, not fixed:
  the fix is a notice the prototype does not draw.
- **`capabilities` having no route, no `main.ts` wiring and no UI.** Deliberate,
  and the Settings initiative's. It is the one thing in the repo built ahead of
  its consumer and it has ten tests so the consumer finds it working.
- **A subtitle track picker, hover-preview on the scrubber, a pressed face on
  the fullscreen button, HLS, embedded MKV subtitle tracks.** All prototype
  amendments, all listed as not-built in the design log.
- **`features/*/api/api.ts` holding several calls in one file.** Four features
  do it; it is the established pattern at that rung and changing it is a
  repo-wide question, not a player one.
- **The `fetch → 404 → null → !ok throw → json` shape shared by `fetchMovie`,
  `fetchPlayback` and `fetchSubtitleCues`.** Three callers across two rungs, and
  each has a different empty answer (`null`, `null`, `[]`). Worth a look when a
  fourth arrives; not worth a shared wrapper at three.
- **Forty-eight test files wrapping their subject in `ThemeProvider`.** Real,
  repo-wide, and older than this feature. Noted here so it is on the record for
  whoever refactors next.
- **The dev seed's absolute `lastWatchedAt` stamps.** Carried forward from #81
  unchanged, and now the ones that will read as wrong first — but the seed is
  deleted by the commit that ships bulk import, and this is not that commit.
- **CLAUDE.md and the glossary disagreeing about whether media is copied into
  the managed directory or referenced in place.** A real contradiction, and the
  media/import initiative's to settle.
- **Electron, the Settings shell, the CodecManager UI.** Their own initiatives.

## Further Notes

**Why the fidelity group is docs-only.** The instruction for this round was a 1:1
translation of the prototype using our conventions, and the honest finding is
that the translation is already faithful — the four divergences from
COMPONENT-SPEC are all places where the design log argued for something better
and the build did it, and only the spec was never told. That is worth stating
plainly rather than manufacturing code changes to match a table: the spec was
written before the player was designed, and `docs/design-logs/10-video-player.md`
supersedes it in every one of the four.

**What this round is really about.** Favorites left six undocumented decisions;
Continue Watching left an accrued bill. This initiative is four times the size of
either and left neither — the format policy, the seek anchoring and the watch
coalescing were all decided before a line was written and none needed revisiting.
What it left instead is a **process** finding: a failing gate, reported honestly
in two commit messages and then carried by six more. Group A is worth more than
the other nine put together, because it is the only one that changes what the
next initiative can get away with.

**On the conditional groups.** D5, E3, G1, I5, I6 and I7 all end in "or record
why not". That is #81's precedent and it is deliberate — but the failure mode is
a round that records six declines and moves nothing. Each of the six has a stated
default in its commit above, and a decline needs a sentence in the commit message
saying what was measured, not a shrug.
