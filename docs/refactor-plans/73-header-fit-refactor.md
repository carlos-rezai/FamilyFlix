# Refactor plan: Header fit, the Quality filter's last imports, the Header end in the house idiom, docblocks that say what is, and the docs that close step 55

> Source initiative: `header-fit`, issue 693 (step 55).
> Shipped by issues 694 to 698: the prototype amended, three slices RED and
> GREEN each, and the walk and documents slice (`4c0c9e11` to `124ddfaf`).
> Design log: `docs/design-logs/73-header-fit.md`.
> PRD: `docs/PRDs/73-header-fit.md` (693). Plan:
> `docs/PRDs/73-header-fit-plan.md`.
> Handoff: amended in 694 (`page.LibraryPage.dc.html`,
> `page.SettingsPage.dc.html`, the model, `COMPONENT-SPEC.md`); nothing
> further here.
> This is the initiative's closing round. It ticks **Header fit** and closes 693. Filed as issue #699.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._ The maintainer approved every recommendation in advance.

## Problem Statement

`header-fit` shipped every phase of its plan. The Genre dropdown leads with
the two **View rows**, _All Genres_ (**By genre**) and _All movies_ / _All
series_ (**All**), and choosing one takes `?genre=` off and sets the tab's
**Row view**; `allTitlesLabel` states those words once for the dropdown and
the three grid headings; `useRowView` lives in `src/hooks/`. The _View_ and
_Quality_ pills are gone, the Quality filter end to end: no `minQuality`, no
`?quality=` parse or 400, a held `?quality=` read past. `MainLayout` holds
the `headerEnd` slot and Settings in one **Header end** that wraps whole to a
second line, with no spacer and no breakpoint. The walk (698) found one line
at 1920 and 1366px and two at 1280 and 1024px, every pill and Settings on
screen.

At `124ddfaf` the full suite has **13169 tests passing across 927 files**
(one skipped), and `tsc -b --force` is clean. `eslint` over every shipping
and test file the initiative added or changed reports **0 errors and 8
warnings**, all of them below.

The design held. What is left is what a removal across both build targets
leaves behind: the imports the deleted code used, one declaration in a
spelling the house does not use, docblocks that narrate what is gone, a few
long lines, a suite named apart from its siblings, and the documents. Every
finding below was checked against the code at `124ddfaf`. They fall into
five families.

### 1. The Quality filter's imports outlived it

- **Eight imports nothing reads.** The two browse `WHERE`s went in 696, and
  with them every use of `VIDEO_QUALITIES` and `qualityRankSql` in the movie
  browse, and of those two and `seriesQualitySql` in the series browse. The
  route reader's `parseMinQuality` went too, leaving `VIDEO_QUALITIES` and
  `VideoQuality` imported in the routes, and `minQuality` left
  `VideoQuality` imported in `src/types/browse.ts`. These are the eight
  `no-unused-vars` warnings; `tsc` does not flag them.

### 2. The Header end's declaration

- **`HeaderEnd` writes `flex-shrink: 0`**, the one such declaration in
  `src/`; the house writes `flex: 0 0 auto` for a box that neither grows
  nor shrinks (62 times, `LogoMark` and the chrome's `Header` beside it),
  and log 73 Q4 specified exactly that. The behaviour is the same: a flex
  item's grow is `0` and its basis `auto` by default.

### 3. Imports and hook calls

- **`LibraryBody`'s `useRowView` import sits among the relative imports.**
  The move to `src/hooks/` (695) rewrote its path in place, so an `@/hooks`
  import now follows `../series/SeriesRows`; the file's other alias import
  (`useLibraryTab`) sits above them, as across the codebase.
- **`LibraryFilters` calls a hook inside an argument**,
  `allTitlesLabel(useLibraryTab())`, the only such call in a shipping
  component; every other reader names the tab first
  (`const tab = useLibraryTab()`), as `LibraryBody` and `useRowView` do.

### 4. Docblocks that narrate, and long lines

- **Four docblocks describe what is gone.** `LibraryFilters` (_the View and
  Quality pills are gone (log 73)_), `useLibraryQuery` (_It owns no quality
  setter and reads no Show video quality (log 73)_), `useQualityTags` (_and
  nothing else (the **Quality filter** is gone, log 73)_) and
  `DisplaySection` (_nothing else (log 73), and its line says so in one
  sentence_). A docblock says what a unit does; what it no longer does is
  the log's and the journal's. Three of them bold **Quality filter**, a term
  the glossary retired.
- **The held `?quality=` rule is stated twice, in two ways.**
  `parseLibraryQuery` (the client's one place a URL is made safe) bolds the
  retired term; the routes' `libraryQueryOr400` says _from before log 73_.
  Both say the same thing and should say it in the same words, without the
  retired term in bold.
- **`LibraryFilters`' docblock is stale in two places.** It still says the
  dropdown renders _with "All Genres" alone_ before the genre list lands,
  where it now renders both View rows; and _Nothing here knows that the
  rows exist_, where it now chooses the Row view (it still knows nothing of
  what a body draws for it).
- **Eight comment lines the initiative wrote run past the file's width**:
  `MainLayout`'s two slot props (91 and 85 columns) and two docblock lines
  (82, 81), `LibraryBody`'s (86), `headerSpacer`'s (86), `ROW_VIEWS`' (82)
  and `parseLibraryQuery`'s (129), the last a line 698 joined without
  rewrapping.

### 5. A suite's name, and the documents

- **Five suites pin one rule under two names.** The client's four are
  `*.quality.test.*` (`LibraryFilters`, `useLibraryQuery`,
  `useSettledLibraryQuery`, `parseLibraryQuery`), the route's
  `routes.qualityIgnored.test.ts`. Every one of them now pins _a held
  `?quality=`_ (their `describe`s say so), not a quality filter;
  `.quality` reads as the filter they once pinned, and among the routes'
  `qualityTags`, `videoQuality` and `episodeVideoQuality` suites a bare
  `routes.quality` would read as any of them.
- **The build has no journal entry**, as seamless art's had none until its
  refactor: 698's commit carries the walk's measurements, but
  `docs/dev-journal.md` was never touched.
- **The feature checklist's row reads ⬜ Planned**, and step 55 reads 🔜
  with its full description, where the checklist's rule (since
  `9c36a2ed`) is one line and a link once a step ships.

The README is untouched: its _Project Structure_ names folders and rules,
never units, and no folder or rule changed. The glossary already carries
the log's new, updated and retired rows.

## Solution

One round in five groups, each commit leaving the suite green and the
typecheck clean:

1. **The Quality filter's last imports**: the eight unused imports go,
   server then client.
2. **The Header end in the house idiom**: `flex: 0 0 auto`.
3. **Imports and hook calls**: `LibraryBody`'s import beside its alias
   sibling; `LibraryFilters` names its tab.
4. **Docblocks that say what is**: the four narrations, the held
   `?quality=` rule in one wording, `LibraryFilters`' two stale lines, then
   the eight long lines.
5. **A suite's name and the documents**: the five held-quality suites
   named alike, the build's journal entry, and the entry and ticks that
   close step 55 and issue 693.

## Commits

Every commit is `refactor:` (or `docs:` / `test:` where it says so), titled
`refactor: [header-fit] issue #<n> <description>` with `<n>` this plan's
issue. Each runs the suites of the units it touches; each group ends on the
full suite and `tsc -b --force`. No test is added, weakened or changes its
claim: the suites already in place (the browse and route suites, the
held-quality suites, `MainLayout`'s Header end pins, `LibraryFilters`' and
`LibraryBody`'s) are the proof that each move kept the behaviour.

### Group 1: the Quality filter's last imports

1. **The server's unused quality imports go.** `VIDEO_QUALITIES` and
   `qualityRankSql` from the movie browse; those two and
   `seriesQualitySql` from the series browse; `VIDEO_QUALITIES` and
   `VideoQuality` from the routes. `qualityRankSql` and `seriesQualitySql`
   themselves stay: the **Series quality** and the sweep read them. The
   browse suites, the held-quality route suite and the **Series quality**
   suites stay green unchanged.

2. **`src/types/browse.ts` drops its `VideoQuality` import.** Nothing in
   the file names it since `minQuality` left `MovieQuery` and
   `LibraryQuery`. `eslint` over the touched files now reports no warning
   the initiative left.

### Group 2: the Header end in the house idiom

3. **`HeaderEnd` declares `flex: 0 0 auto`** in place of `flex-shrink: 0`,
   as log 73 Q4 specified and as `LogoMark` beside it writes;
   `flex-wrap: nowrap` stays, since it states the rule the docblock names
   (never wrapped inside). `MainLayout.test`'s _holds the Header end
   whole_ pin stays green unchanged: jsdom expands the shorthand, so the
   box still reads `flex-shrink: 0` (checked at `124ddfaf`).

### Group 3: imports and hook calls

4. **`LibraryBody`'s `useRowView` import moves up** beside
   `useLibraryTab`'s, the alias imports before the relative ones.

5. **`LibraryFilters` names its tab.** `const tab = useLibraryTab();`
   then `allTitlesLabel(tab)`, as every other reader of the tab writes it.
   `LibraryFilters`' suites (`test`, `rowView`, `heldQuality` after commit 9) stay green unchanged.

### Group 4: docblocks that say what is

6. **The four narrations go.** `LibraryFilters` states its three pills in
   the prototype's order and no longer lists the two it does not draw;
   `useLibraryQuery` loses its added paragraph (the held `?quality=` is
   `parseLibraryQuery`'s to state); `useQualityTags` reads _Whether a
   **Quality tag** is drawn on the posters_; `DisplaySection` reads that
   _Show video quality_ turns the **Quality tag** on the posters on or off.
   No retired term stays bold in shipping code.

7. **The held `?quality=` rule in one wording, and `LibraryFilters`' stale
   lines.** `parseLibraryQuery` and the routes' `libraryQueryOr400` each
   say, in the same words, that a held `?quality=`, from a build that
   filtered by quality, is read past and narrows nothing (the client adds
   that it stays on the URL). `LibraryFilters` says the dropdown renders
   with the two **View rows** alone until the genre list lands, and that
   nothing here knows what a body draws for a view.

8. **The eight long lines rewrapped** to the file's width: `MainLayout`'s
   two slot props become two-line JSDoc blocks, as `MainLayoutProps`'
   neighbours across the layouts write a long one, and its two docblock
   lines; `LibraryBody`'s, `headerSpacer`'s, `ROW_VIEWS`' and
   `parseLibraryQuery`'s. No code moves.

### Group 5: a suite's name and the documents

9. **`test:` the five held-quality suites named alike.** A `git mv` each:
   `LibraryFilters.quality.test.tsx`, `useLibraryQuery.quality.test.tsx`,
   `useSettledLibraryQuery.quality.test.tsx` and
   `parseLibraryQuery.quality.test.ts` become `*.heldQuality.test.*`, and
   `routes.qualityIgnored.test.ts` becomes `routes.heldQuality.test.ts`,
   each named for the aspect its `describe` already states, _a held
   `?quality=`_. Their `describe` and `it` names stay as they are.

10. **`docs:` the build's journal entry.** _2026-11-23: Header fit, the
    build (issues 694 to 698)_, placed before this round's: what each slice
    shipped (the prototype amended; the View rows and `allTitlesLabel`, the
    hook's move and the two units deleted; the Quality filter gone, client
    and server; the Header end), the walk's measurements as 698's commit
    and the checklist record them (one line at 1920 and 1366px, two at 1280
    and 1024px, the search at 205px on one line at 1366 and 398px wrapped,
    _Documentary_ chosen, nothing cut), the spacer the walk caught and
    `8b45d900` took out, that the walk ran against the dev server in a
    headless Edge rather than in the shell, and the judgement calls a later
    session needs. Its counts are the ones this plan records at
    `124ddfaf`.

11. **`docs:` step 55 is done.** The feature checklist's row reads ✅ Done;
    step 55 becomes one line and a link, as the steps before it
    (_55. ✅ **Header fit**: every filter pill and Settings in reach ([log
    73](design-logs/73-header-fit.md))._), and the paragraph that
    introduced it goes. The dev journal gains this round's entry: counts
    before and after, what each group changed, where the round left the
    plan, and the follow-ups below. The commit's body closes 693.

## Decision Document

- **A removal takes its imports with it.** The browse `WHERE`s, the route's
  parse and `minQuality` are gone; what only they read leaves its file's
  imports. What other readers still need stays where it is:
  `qualityRankSql` and `seriesQualitySql` for the **Series quality** and the
  sweep, `VIDEO_QUALITIES` and `VideoQuality` in every file that names them.
- **A box that neither grows nor shrinks is `flex: 0 0 auto`**, the house
  spelling and log 73's. `flex-wrap: nowrap` stays on the Header end as the
  rule's own statement.
- **Alias imports before relative ones**, as every feature file writes
  them; a hook's result is named before it is passed (`const tab =
useLibraryTab()`).
- **A docblock states what its unit does now.** What a unit stopped doing
  belongs to the log and the journal; a retired glossary term is not bolded
  in shipping code. The one behaviour a removal left (a held `?quality=` is
  read past) is stated where it happens, in `parseLibraryQuery` and the
  route reader, in the same words.
- **A suite is named for the aspect it pins.** The five suites that pin a
  held `?quality=` are `.heldQuality`, beside `routes.qualityTags`,
  `routes.videoQuality` and `routes.episodeVideoQuality`.
- **Unchanged, as settled by log 73 or as built:** `GenreSelection` in the
  `genreOptions` unit (Q13: one feature reads it); `allTitlesLabel` in
  `src/utils/`; `useRowView` in `src/hooks/`; a genre leaving the Row view
  as it is (Q10); the Genre pill drawing nothing while the Row view is
  `null` (Q11); `ALL_GENRES` exported for the suites; the chrome's `Spacer`
  and `headerSpacer`, still the Genre page's; the glossary, the handoff and
  the README.
- **No route, no wire, no schema, no prototype, no visible change.**

## Testing Decisions

- A good test drives a unit through its public face and checks what comes
  out: which pills the header draws and in what order, what choosing a row
  writes to the URL and the household setting, what a route answers for a
  held `?quality=`, which declarations hold the Header end whole. It never
  checks an import, a docblock or a file's name.
- **No test changes its claim.** Groups 1 to 4 move no behaviour, and the
  suites in place are the proof: the browse and route suites, the five
  held-quality suites, `MainLayout`'s Header end pins (the declaration
  change reads the same through jsdom, checked before planning),
  `LibraryFilters`' and `LibraryBody`'s, `DisplaySection`'s description.
  Prior art: seamless art's groups 2 to 4, which changed no test.
- **Group 5's renames move files, not claims.** Prior art: seamless art's
  `createMedia.fitArt.test` to `createMedia.fitNamed.test`, and the
  aspect-named suites across the routes.
- **No walk.** Nothing drawn, fetched or stored changes; 698's walk stands.
  The full suite and `tsc -b --force` close each group, and `eslint` over
  the touched files ends at 0 errors and 0 warnings from this initiative.

## Out of Scope

- **The held-quality route suite's fixture.** It still seeds four series
  whose **Series quality** differs by episode, a fixture written for the
  filter it once pinned; the suite now only needs a whole library back.
  Trimming it rewrites a test's arrangement for no claim, and the richer
  library proves the read-past at least as well.
- **`genreOptions` reading the selection's arm twice** (`'rowView' in` and
  `'genre' in`): a narrowing a reader follows at a glance; a helper would
  serve one caller.
- **The test docblocks that name the retired terms** (`LibraryPage.test`'s
  _Phase 2_ note, the held-quality suites' _Phase 3_ notes): a test's
  docblock records the phase that wrote it, by house convention.
- **The glossary's older sections and dialogues** that still say **Row view
  switch** and **Quality filter**: each section is its log's moment, and
  the retired rows already say what replaced them.
- **A `?quality=` stripped from the URL** (log 73 Q15), **the Genre page's
  header** and **a narrower header by smaller type or gaps** (Q1, Q3):
  the log's own out of scope.
- **Every long comment line older than this initiative**, in the routes
  and the browses among them.

## Further Notes

- Groups 1 to 4 are independent of each other; commits 6 to 8 touch the
  same docblocks and run in that order. Group 5's commits 10 and 11
  come last, since 11 records this round's counts.
- **Follow-ups for the journal**: the walk ran in a headless Edge against
  the dev server, not in the shell the log's plan named, so the next look
  at the installed app at its 1024px minimum width confirms the wrap there;
  and whether the about 58px a second header line costs is felt in a
  narrow window.
- Eleven commits; the build was a clean removal and a small layout rule,
  and the round is mostly what a removal leaves behind and the documents a
  closing round always writes.
