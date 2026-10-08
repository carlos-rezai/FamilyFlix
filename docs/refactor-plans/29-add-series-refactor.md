# Refactor plan: Add a series — one kind vocabulary, one spelling per file rule, the body's own suite, and the docs that close it

> Source initiative: [`add-series`, issue #260](https://github.com/carlos-rezai/FamilyFlix/issues/260)
> Shipped by issues 261–264. Design log: `docs/design-logs/29-add-series.md`.
> Plan: `docs/PRDs/29-add-series-plan.md`.
> Filed as issue 266. This plan absorbs issue 265, the plan's Phase 5 (_the close_), so the
> initiative has one refactor issue: its docs are Group 4 here.
> The maintainer approved every recommendation in advance, with one standing
> instruction: _keep the codebase consistent with our naming and code
> conventions, patterns and architecture._

## Problem Statement

`add-series` shipped in four slices. #261 added `titleFromFilename`, the title
prefill and the video gate on both movie routes. #262 extracted `PillTabs`
from the Library tabs, drew the **Kind tabs** and the series' words, and added
`SeriesFormFiles`, with the prototype amendments riding its `feat:` commit.
#263 added `readEpisodeTag` and its drift guard, `useEpisodeList`,
`EpisodeFileRow`, `yearSpan`, `seriesFormBody`, `addSeries(input, episodes)`,
`POST /api/series` and `createSeries`. #264 carried each row's subtitles end to
end. Every log-29 ruling was read against the code for this filing. Q1–Q3
(scope), Q4–Q11 (the screen), Q12–Q18 (episodes), Q19–Q21 (the gate), Q22–Q27
(the wire and the write) and Q29–Q30 (no rename, the prototype) all hold,
except where the items below say otherwise. Q28's `FormKind` is the one ruling
the build placed somewhere else (item 3).

The pattern earlier rounds found holds again. The debt an `issue-loop` build
leaves comes from what a subagent reading one issue can't see: docblocks that
still describe the form before the initiative, two spellings of one thing
written by two slices, scaffolding a later slice outgrew, one unit with no
suite of its own, and the paperwork.

### 1. Docblocks still describing a form with one kind

- **`MovieForm`** introduces itself as _"One screen, three jobs"_, and its
  `HEADING` docblock says an add _"is 'Add a movie'"_. A plain add now has two
  **Form kinds**, and the heading follows the kind.
- **`useMovieForm`**'s long docblock says the gate is _"a title and a film …
  one condition"_. It is now one condition per kind (log 29 Q19). It names
  `?movie=` and `?problem=` as the URL's parameters and says nothing of
  `?kind=`. Its _"Why this file has no `useMovieForm.test.ts`"_ section counts
  _"129 tests over 22 blocks"_; the suite now holds 290 leaves, and the
  section doesn't say that the series half's list rules live in
  `useEpisodeList`'s own suite.
- **`UseMovieFormResult.save`** says _"Write the movie"_. Seven of the eight
  episode members the build added carry no docblock, where every movie member
  above them does.

### 2. Lines the build wrote past the measure

The build wrote comment lines past 80 columns, which Prettier doesn't wrap.
Among them: `PillTabs.styles`' `Track` (106 columns), `readEpisodeTag`'s type
(87), `yearSpan`'s type (83), `SeriesFormFiles.styles`' re-export (83),
`MovieForm.styles`' `KindTabs` (83) and `useMovieForm`'s `SERIES_FRESH_HOME`
(81), plus the `save` comments the build re-indented one level deeper. Every
earlier round has rewrapped its own initiative's lines.

### 3. `FormKind` lives in a hook, not in `src/types/`

Log 29 Q28: _"`src/types/` gains `EpisodeFormRow` … and `FormKind`"_. The
build put `EpisodeFormRow` in `types/form.ts` and declared `FormKind` in
`useMovieForm.ts`, so `MovieForm` imports a type from its hook's file. Every
other shared shape of the form (`MovieFormValues`, `MovieFormFile`,
`MovieFormSubtitle`, `EpisodeFormRow`) is in `types/form.ts`.

### 4. `PillTabs` speaks `string`, so its callers re-narrow

`PillTabs` types `options`, `value` and `onChange` over `string`. `LibraryTabs`
lost its `LibraryTab` union in the extraction, and `MovieForm` had to add an
`isFormKind` guard to get its own union back out of `onChange`. A
presentational molecule over a caller's choices should hand back the caller's
own type: the guard is a runtime check of something the compiler can know.
No molecule is generic yet, so `PillTabs` is the first.

### 5. The heading is the one kind-word outside `WORDING`

`MovieForm` keys the kind's words by kind in `WORDING`, but the heading went
into the job-keyed `HEADING` as a third key, `addSeries`, picked by a nested
ternary. The heading is the kind's word on an add and the job's on an edit;
`WORDING` is where the kind's words are.

### 6. Two spellings of a picked file and a picked track

`formValues` has `pickedFile(file)`, the one constructor of the `picked` arm,
built _"beside `storedFile` so the two constructors that decide what a slot
holds live in one place"_. `useEpisodeList` spells
`{ kind: 'picked', file, filename: file.name }` three times instead. It also
redeclares `DEFAULT_LANGUAGE = 'English'`, which `useMovieForm` declares with
story 27's reasoning, and it builds a picked track inline exactly as
`useMovieForm.addSubtitle` does.

### 7. `SeriesFormFiles`' optional props are Phase 2's scaffolding

#262 built `SeriesFormFiles` before episodes existed, so its nine episode
props are optional with an `ignore` default. Since #263, its one caller passes
every one. `MovieFormFiles`' props are all required, and an optional callback
that silently does nothing is how a wiring slip goes unnoticed.

### 8. The Files card written twice

`SeriesFormFiles` redeclares six of `MovieFormFiles`' constants:

- the three `accept` lists, without the docblocks that say why each is what it
  is (Chromium's MIME-less MKV, why `image/*` is enough, why no MIME for
  subtitles);
- `CARD_LABEL`, `POSTER_LABEL` and `POSTER_CHOOSE`.

Its styles re-export `Card` and `Caption` from `MovieFormFiles.styles`,
which makes one organism's styles another's public surface: the thing
`fileRow.styles.ts`'s docblock rules out. And its `Episodes`, `EpisodesLabel`
and `EpisodeRows` restate `Subtitles`, `SubtitlesLabel` and `Tracks`
character for character.

### 9. `EpisodeFileRow` suppresses the focus ring

Its number and title fields set `outline: none`, as the prototype does.
`TextField` and `Textarea` both record a deliberate deviation from exactly
that line: _"the focus ring is left alone … It is the only thing that tells a
keyboard user where they are"_. Its lengths are also bare `2` and `3`, where
the form names `YEAR_LENGTH`.

### 10. The Episode tag's shape spelled a third time on the client

`titleFromFilename` ends a title at an Episode tag through its own two
patterns (`s\d{1,2}e\d{1,3}`, `\d{1,2}x\d{2,3}`). `readEpisodeTag`'s
`TAG_SHAPES`, held to the server's by the drift guard, read wider
(`s\d{1,3}e\d{1,4}`, `\d{1,2}x\d{1,3}`). So `Harbor.and.Vine.1x3.mkv` lands as
a row tagged S1E3 while the prefill titles the series _"Harbor and Vine
1x3"_. The prefill should stop where the tag reader says the tag is.

Two smaller things sit beside it:

- The client's type is named `ReadEpisodeTag`, a verb phrase. The glossary
  term, and the server's type, is `EpisodeTag`.
- `titleFromFilename`'s docblock sits at the top of the file over the
  constants, and the function has none. Every other unit documents its
  export.

### 11. `seriesFormBody` has no suite

Every folder under `server/src/routes/` has its own test file except the new
`seriesFormBody/`. Its refusals are covered only through
`routes.addSeries.test.ts`. `movieFormBody` is the precedent: its pure field
half is pinned in its own suite, refusal order included (_"the order of the
refusals is load-bearing"_), and its part half is asserted through the router.
`readEpisodeField` and `readSeriesFields` are pure and untested as units.

### 12. The route casts what the body reader already proved

`readSeriesFields` refuses a body whose episode has no video or a short
subtitle count, then answers the episode fields without the paths it checked.
The route reads them back off `uploads` with `upload.video as string` and
`path as string`. A reader that has proved a value should hand it over typed.
The same function holds the codebase's only loose equality
(`span?.endYear == null`), and the route's new `yearSpan` import sits among
the playback imports.

### 13. `cellYears` is a wrapper with one caller

Once `yearSpan` was extracted, `readSheet`'s `cellYears` became one line with
a docblock that restates `yearSpan`'s, called from one place.

### 14. `FilePicker`'s multiple mode has no leaf

#263 gave the `FilePicker` primitive a second mode (`multiple`,
`onPickFiles`). `FilePicker.test.tsx` was not touched. The mode is covered only
through `MovieForm`, which is the rung-skipping the folder convention exists
to prevent.

### 15. Names the rename left behind

- `SettingsHeader`'s button reads _Add a title_, and its styled component is
  still `AddMovieButton`.
- The hook answers `kindSwitchable`, and `COMPONENT-SPEC.md`'s `MovieForm`
  row, the spec the form is built to, calls it `showKindTabs`.

### 16. The docs the initiative owes — issue 265, merged

The plan's Phase 5, filed as 265, is moved here in full, because the standing
rule makes the close the refactor's last commit anyway:

- **CLAUDE.md.**
  - The folder tree's `components/` doesn't name `PillTabs/` or
    `EpisodeFileRow/`.
  - `features/movie-form/` doesn't name `useEpisodeList/`, `readEpisodeTag/`,
    `titleFromFilename/`, `SeriesFormFiles/` or `createSeries`, nor the two
    files this round adds.
  - `server/src/routes/` doesn't name `seriesFormBody/`, and
    `server/src/library/series/` doesn't name `yearSpan/`.
  - The types line doesn't name `form.ts`.
  - The _Movie Import — One Form_ section doesn't say the form adds a series,
    that Save needs a video, or that `POST /api/series` exists.
  - Step 13 and the _Add a series_ line are still 🔜, _(next)_ is still on 13,
    and _None of 13–15 has a prototype yet_ is stale.
- **README.** The same ✅ and _(next)_.
- **The dev journal.** No entry for the build and none for this round. The
  build's entry must record that log 22 Q2's open item, a form for series, is
  closed.
- **The glossary** was written with the log (`a09d14e`). It is read against
  the final tree at commit time and gets a commit only if something it names
  changed.
- **`COMPONENT-SPEC.md`** already names `PillTabs`, `EpisodeFileRow`,
  `showKindTabs` and the gate rule, and needs no commit.

## Solution

Five groups, each leaving a working, green tree after every commit:

0. **The record.** The build's journal entry comes first, so it describes
   what shipped before this round changes anything.
1. **The comments.** Stale docblocks rewritten, missing ones written, long
   lines rewrapped. No code changes.
2. **The client's tidies.** One home for the kind's type and words, a generic
   `PillTabs`, one constructor per picked thing, required props, one Files
   card furniture, the focus ring kept, one client spelling of the tag's
   shape, and the two names the rename left. One pixel changes: the focus
   ring on an Episode file row's fields.
3. **The server's tidies.** `seriesFormBody`'s suite, the reader handing over
   what it proved, the wrapper inlined, and `FilePicker`'s missing leaves.
4. **The docs.** Last, because they describe the tree the earlier groups
   leave. They close 260, 265 and this issue.

That's twenty commits. No route, wire, schema or prototype changes.

## Commits

### Group 0 — the record of what was built

1. **The journal's add-series build entry.** A new top entry, _Add a series
   (issues #261–#264)_, using the earlier build entries' sections:
   - What shipped, slice by slice:
     - #261: `titleFromFilename`, the title prefill, and both movie routes
       refusing a body with no video in the resolve route's sentence;
     - #262: `PillTabs` and `LibraryTabs` on it, the Kind tabs on
       `?kind=series`, the series wording, `SeriesFormFiles`, the entrances
       renamed _Add a title_;
     - #263: `readEpisodeTag` and the drift guard, `useEpisodeList`,
       `EpisodeFileRow`, `FilePicker`'s multiple mode, `yearSpan`,
       `seriesFormBody`, `addSeries(input, episodes)`, `POST /api/series`
       with rollback, `createSeries` and the landing on the Series tab;
     - #264: each row's subtitles, sent as `episodeSubtitle` parts and stored
       in `episode_subtitles`.
   - The prototype amendments (`feat.MovieForm`, `mol.PillTabs`,
     `mol.EpisodeFileRow`, `page.LibraryPage`, `page.SettingsPage` and the
     COMPONENT-SPEC entries) riding #262's `feat:` commit, as the plan said.
   - Log 22 Q2's open item, a form for series, closed — for the add. Edit,
     Delete and _Add episodes_ stay the follow-up log 29 names.
   - The judgement calls the subagents made alone that the log didn't name:
     - `FormKind` declared in the hook (item 3);
     - `PillTabs` over `string` and the `isFormKind` guard (item 4);
     - `HEADING.addSeries` (item 5);
     - the inline picked literals and second `DEFAULT_LANGUAGE` (item 6);
     - optional episode props on `SeriesFormFiles` (item 7);
     - the Files card's constants and furniture restated (item 8);
     - the prototype's `outline: none` carried (item 9);
     - `titleFromFilename`'s own tag patterns (item 10);
     - `seriesFormBody` without a suite (item 11);
     - the route's casts (item 12);
     - `FilePicker`'s mode without a leaf (item 14);
     - the `lib: dom.iterable` line in `tsconfig.spec.json`, so suites can
       spread a sent `FormData` to read its parts in order (kept);
     - `FilePicker`'s two modes as a union of prop shapes told apart by
       `multiple`, rather than a second primitive (kept).
   - What was deliberately not built: everything log 29 _Not built_ lists.
   - The test and file counts at the end of the build, **7200 tests across 416
     files**, measured at `7f06da3`.
   - The follow-ups, which are this plan, by bare number.

   Docs only.

### Group 1 — the comments, nothing else

2. **The form's docblocks name both kinds.**
   - `MovieForm`: a plain add has two **Form kinds** chosen on the **Kind
     tabs**, beside the edit and the Resolve; the heading follows the kind on
     an add and the job on an edit.
   - `useMovieForm`:
     - the gate is one condition per kind — a title and a film, or a title
       and complete episodes — and the poster is still no half of either;
     - `?kind=` is the URL's third parameter, read on a plain add alone;
     - a series lands on the Series tab, its kind's **Fresh home**;
     - the _"Why no test file"_ section restates the suite's count as
       measured, and says the list rules are `useEpisodeList`'s suite's.
   - `UseMovieFormResult`: `save` writes _the title_; each episode member gets
     a one-line docblock in its movie sibling's words.

   Comments only, no test.

3. **The build's over-measure lines rewrapped.** Every comment line the build
   wrote or re-indented past 80 columns in its own shipping files, found with
   `git blame` against `a09d14e..7f06da3`, rewrapped with no change of words
   except where commit 2 already rewrote them. Lines past the measure that
   predate the initiative are left. Comments only, no test.

### Group 2 — the client's tidies

4. **`FormKind` in `src/types/`.** It moves to `types/form.ts` beside
   `EpisodeFormRow`, with its docblock, and joins the barrel. `useMovieForm`
   and `MovieForm` import it from `@/types`. `tsc -b` and the unchanged run are
   the proof.

5. **`PillTabs` hands back its caller's type.**
   - `PillTabs<T extends string>`: `options: readonly { value: T; label:
string }[]`, `value: T`, `onChange: (value: T) => void`.
   - `MovieForm`'s `isFormKind` guard goes; `onChange={setKind}`.
   - `LibraryTabs`' `onChange` receives `'movies' | 'series'`.

   `PillTabs`', `LibraryTabs`' and `MovieForm`'s Kind-tabs suites pass
   unchanged; the generic is the typecheck's to prove.

6. **The heading joins the kind's words.** `WORDING.movie.heading` is _Add a
   movie_ and `WORDING.series.heading` is _Add a series_. `HEADING` keeps
   `edit` alone, and the heading reads `editing ? HEADING.edit :
wording.heading`. The `HEADING` docblock moves its kind half onto
   `WORDING`'s. The heading leaves in `MovieForm.test.tsx` pass unchanged.

7. **One constructor per picked thing.**
   - `formValues` gains `pickedSubtitle(key, file)`, beside `pickedFile`: a
     picked track in the default language. `DEFAULT_LANGUAGE` and story 27's
     docblock move there from `useMovieForm`.
   - `useMovieForm.addSubtitle` and `useEpisodeList.addEpisodeSubtitle` build
     tracks through it.
   - `useEpisodeList` builds its three picked files through `pickedFile`, and
     its own `DEFAULT_LANGUAGE` goes.

   `useEpisodeList`'s suite and `MovieForm.test.tsx`'s subtitle leaves pass
   unchanged.

8. **`SeriesFormFiles`' props are required.** The nine episode props lose
   their `?`, and `ignore` and the defaults go. `SeriesFormFiles.test.tsx`'s
   render helper passes a `vi.fn()` for each, as `MovieFormFiles.test.tsx`'s
   does. Every leaf keeps its name and assertions.

9. **One Files card furniture.** A flat `features/movie-form/filesCard.styles.ts`,
   on `maintainer.styles.ts`' and `settings/section.styles.ts`' precedent,
   holds:
   - `Card` and `Caption`, with their docblocks;
   - the list section's three blocks — the section, its 70px label and its
     rows — under one set of names (`ListSection`, `ListLabel`, `ListRows`).

   `MovieFormFiles.styles` and `SeriesFormFiles.styles` each re-export or
   extend from it and keep only what is their own. `SeriesFormFiles.styles`
   no longer imports from `MovieFormFiles.styles`. The two components keep
   their own local names through the re-export if that reads better at the
   call site. Both suites' `resolvedStyle` leaves pass unchanged.

10. **One set of the card's constants.** A flat
    `features/movie-form/filesCard.ts` holds `VIDEO_ACCEPT`, `POSTER_ACCEPT`
    and `SUBTITLE_ACCEPT` with the docblocks `MovieFormFiles` wrote for them,
    and `CARD_LABEL`, `POSTER_LABEL` and `POSTER_CHOOSE`. Both Files cards
    import them. Labels only one card draws (`VIDEO_*`, `SUBTITLES_LABEL`,
    each card's own _Add subtitle_ wording, `EPISODES_*`) stay with that card.
    Both suites pass unchanged.

11. **`EpisodeFileRow` keeps the focus ring.**
    - The shared field rule drops `outline: none`, with the docblock
      `TextField` and `Textarea` carry: the prototype's line deliberately not
      carried over. The `:focus` border stays.
    - The bare lengths become `SEASON_LENGTH = 2` and `NUMBER_LENGTH = 3`,
      named as `YEAR_LENGTH` is.

    One new leaf: _a focused field keeps the browser's focus ring_, read
    through `resolvedStyle`'s keyboard-focus state. It is red before the edit
    and green after. The digit leaves pass unchanged.

12. **The client's tag type is `EpisodeTag`.** `ReadEpisodeTag` is renamed to
    the glossary's term, and `readEpisodeTag` exports `TAG_SHAPES` with its
    docblock. The drift guard and `readEpisodeTag`'s suite pass unchanged.

13. **The prefill stops where the tag reader says the tag is.**
    - `titleFromFilename`'s two Episode-tag tail forms go. Its tail search
      reads `TAG_SHAPES` beside its year and quality forms, so the client
      spells the tag's shape once.
    - Its file-top docblock moves onto the exported function.

    `titleFromFilename`'s existing leaves pass unchanged. One new leaf:
    _`Harbor.and.Vine.1x3.mkv` titles "Harbor and Vine"_, the case the two
    spellings disagreed on. It is red before and green after.

14. **The names the rename left behind.**
    - `SettingsHeader.styles`' `AddMovieButton` becomes `AddTitleButton`.
    - `UseMovieFormResult.kindSwitchable` becomes `showKindTabs`,
      COMPONENT-SPEC's name, in the hook and in `MovieForm`.

    No leaf reads either name. `tsc -b` and the unchanged run are the proof.

### Group 3 — the server's tidies, and the primitive's missing leaves

15. **`seriesFormBody`'s suite.** A new `seriesFormBody.test.ts` on
    `movieFormBody.test.ts`' shape and header:
    - `readEpisodeField`: the contract's shape read; a blank title dropped and
      a title trimmed; missing `subtitleLanguages` read as none; `null` for
      bad JSON, a non-object, season or number below 1 or not an integer, a
      non-string title, and a non-string language.
    - `readSeriesFields — the record a body describes`: the values, a year
      span, an open span, an unreadable year as no year, `creator` and
      `description` as optional text.
    - `readSeriesFields — the refusals`: each sentence.
    - `readSeriesFields — the order the refusals are checked in`: a body
      wrong in two ways answers the earlier sentence (title before episodes,
      a duplicate before a refused part, a refused part before a missing
      video, the rating before the genre).
    - `collectEpisodeUploads` stays asserted through the router, as
      `collectUploads` is, and the header says so.

    Test only. Every leaf is green on the code as it stands, because it
    characterizes the code commit 16 changes.

16. **The body reader hands over what it proved.**
    - `readSeriesFields` answers `episodes` as `LandedEpisode[]`: each
      `EpisodeField` with its `video: string` and `subtitles: string[]`,
      paired once the checks have passed.
    - The route's `upload.video as string` and `path as string` go, and it
      reads paths off the episode it was handed.
    - `span?.endYear == null` becomes strict.
    - The route's `yearSpan` import moves beside the other `library/`
      imports.

    Commit 15's suite gains the paths in its value leaves, and
    `routes.addSeries.test.ts` passes unchanged.

17. **`cellYears` inlined.** Its one caller spreads
    `yearSpan(...) ?? { year: null, endYear: null }`, and the wrapper and its
    restated docblock go. `readSheet`'s year leaves and `yearSpan`'s suite
    pass unchanged.

18. **`FilePicker`'s multiple mode gets its leaves.** In
    `FilePicker.test.tsx`:
    - the input carries `multiple` in that mode and not in the other;
    - a pick reports every file, in the order given;
    - a cancelled dialog reports nothing;
    - the input is cleared after a pick, so the same files can be picked
      again.

    Test only, green on the code as it stands.

### Group 4 — the docs that close the initiative (issue 265's scope)

19. **CLAUDE.md and the README.** Docs only.
    - CLAUDE.md's folder tree:
      - `components/` names `PillTabs/` (the pill track, presentational, the
        **Library tabs** and the **Kind tabs** its callers) and
        `EpisodeFileRow/` (one **Episode file row**: the numbers, the title,
        the ✕, the filename, a slot for its subtitles).
      - `features/movie-form/` names `SeriesFormFiles/`, `useEpisodeList/`,
        `readEpisodeTag/` (with the drift guard), `titleFromFilename/`,
        `filesCard.styles.ts`, `filesCard.ts`, and `createSeries` in `api/`.
      - `server/src/routes/` names `seriesFormBody/`, and
        `server/src/library/series/` names `yearSpan/` (the one reading of a
        **Year range**, the Sheet's too).
      - The types line names `form.ts`: `MovieFormValues`, `MovieFormFile`,
        `MovieFormSubtitle`, `EpisodeFormRow`, `FormKind`.
    - CLAUDE.md's _Movie Import — One Form, Manual Pickers_: the form adds a
      movie or a series, chosen on the Kind tabs at `?kind=series`; the
      **Save gate** is a video for either kind, held on the wire too; and the
      series save is one atomic `POST /api/series`.
    - CLAUDE.md: build order step 13 ✅, _(next)_ moves to step 14, _None of
      13–15 has a prototype yet_ reads _Neither 14 nor 15_, and the
      Maintainer tools line _Add a series_ ✅.
    - README: the same ✅ in the feature table and the build order, _(next)_
      on 14, and the new units in its tree.
    - The glossary, read against the final tree. It gets a line here only if
      a name it uses changed in this round.

    Prettier runs over the changed docs.

20. **The journal's refactor entry.** A new top entry, _Add a series refactor
    (issue 266)_, using the earlier rounds' sections:
    - what each group changed;
    - leaves added, removed and moved, by name;
    - the test and file counts before (7200 across 416) and after;
    - that `tsc -b` and `eslint src server electron .husky` are clean;
    - that one pixel changed, the Episode file row's focus ring, and why;
    - that 265 was merged into this plan, and why;
    - that the glossary and `COMPONENT-SPEC` were read against the final tree;
    - anything the round surfaced, by bare number.

    Docs only. This commit closes 260, 265 and this issue together.

## Decision Document

- **The form's shared shapes live in `src/types/form.ts`.** `FormKind` joins
  `EpisodeFormRow` there, as log 29 Q28 placed it.
- **A presentational molecule over a caller's choices is generic in the
  value.** `PillTabs<T>` hands back `T`. No caller re-narrows a string at
  runtime.
- **The kind's words live in `WORDING`, the job's in `HEADING`.** On an add
  the heading is the kind's; on an edit it is the job's.
- **One constructor per arm.** A picked file is built by `pickedFile`, a
  picked track by `pickedSubtitle`, and the default language is spelled once,
  beside them.
- **A component's callbacks are required unless a caller omits them.**
  `SeriesFormFiles` matches `MovieFormFiles`.
- **Two organisms that draw one card share furniture, not each other's
  styles.** `filesCard.styles.ts` and `filesCard.ts` are flat feature files on
  `maintainer.styles.ts`' precedent, and the folder rule's single-file
  exception: no test, no companion.
- **The browser's focus ring is never suppressed.** `TextField` and
  `Textarea` recorded the deviation from the prototype's `outline: none`;
  `EpisodeFileRow` joins them.
- **The client spells the Episode tag's shape once.** `readEpisodeTag` owns
  `TAG_SHAPES`, held to the server's by the drift guard, and the title guess
  ends a title wherever that reader says a tag starts. The client's type is
  the glossary's `EpisodeTag`, keeping `number` (the form's and `NewEpisode`'s
  word) where the server says `episode`.
- **Every routes unit has its own suite.** The pure field half is pinned
  there, refusal order included; the part half is asserted through the
  router. This is `movieFormBody`'s split.
- **A reader that proves a value hands it over typed.** `readSeriesFields`
  answers each episode with its landed paths, and the route casts nothing.
- **A primitive's every mode has a leaf in its own suite.**
- **Names follow the copy and the spec.** _Add a title_ is `AddTitleButton`;
  the Kind tabs' flag is COMPONENT-SPEC's `showKindTabs`.
- **The close is merged.** 265's acceptance criteria are commit 19's, and its
  journal entry is commits 1 and 20. One refactor issue closes the
  initiative.
- **No route, wire, schema, server behaviour or prototype change.**
  `POST /api/series`'s contract and sentences, `addSeries`, `yearSpan`'s
  readings, the drift guard's table, the Kind tabs' URL rule and every
  surface's look stay as built — except the Episode file row's focus ring.

## Testing Decisions

- **A good test here asserts what the maintainer can see or what the wire
  carries**: a field's value and placeholder, which Files card is drawn,
  whether Save can be pressed, the parts a save sends and their order, the
  sentence a refusal answers, what lands on disk and in the tables. A pure
  reader's suite asserts the value it answers and the order its refusals are
  checked in. A primitive's suite asserts each mode's reports.
- **Characterization before change.**
  - Commits 2–3 are comments, so `tsc -b` and `eslint` guard them.
  - Commits 4, 5, 12 and 14 are types and names, guarded by the typecheck
    and the unchanged run.
  - Commits 6–10 and 17 move or share code with no visible change, each
    guarded by the suites named in it passing with every leaf unchanged.
  - Commit 15 is written against the code before commit 16 changes it.
  - Commits 11 and 13 each add one leaf that is red before the edit and
    green after, because each changes what the maintainer sees.
- **Modules tested:**
  - `seriesFormBody`: new suite, on `movieFormBody`'s shape.
  - `FilePicker`: four new leaves for the multiple mode.
  - `EpisodeFileRow`: one new focus-ring leaf.
  - `titleFromFilename`: one new leaf.
  - `SeriesFormFiles`: render helper restated, leaves unchanged.
  - Every other suite the build touched (`PillTabs`, `LibraryTabs`,
    `MovieForm`, `MovieFormFiles`, `useEpisodeList`, `readEpisodeTag` and its
    drift guard, `api`, `yearSpan`, `readSheet`, `write`,
    `routes.addSeries`, `routes`, `SettingsHeader`, `LibrarySection`,
    `SettingsPage`, `App`): unchanged.
- **Prior art:**
  - `movieFormBody.test.ts` for the body reader's suite and its header.
  - `TextField.styles.ts`' and `Textarea.styles.ts`' recorded deviation for
    the focus ring, and `resolvedStyle`'s keyboard-focus state for its leaf.
  - `maintainer.styles.ts` and `settings/section.styles.ts` for flat feature
    furniture.
  - `makeContinueCardMovie`'s round (issue 259) for fixtures restated with
    leaves unchanged.
- **Coverage is otherwise sufficient.** Every log-29 ruling has a behaviour
  leaf: the Kind tabs and `?kind=` (`MovieForm`), the series wording, the
  year field's rule, a switch keeping both kinds' files, both gates and both
  prefills, the episode list's ordering and gate (`useEpisodeList`), the
  part order (`api`), the atomic write (`write`), each route refusal and the
  rollback (`routes.addSeries`, `routes`), and the tag readers' agreement
  (the drift guard). Adding a real season through the running app is the
  maintainer's own check, as the plan accepted.

## Out of Scope

- **Narrowing `EpisodeFormRow.file` to the picked arm.** Every row is picked
  by construction, and `seriesFormData`'s `kind === 'picked'` checks are what
  the union asks for. Narrowing it would change log 29 Q28's type for no
  behaviour.
- **One `formatEpisodeTag` / `readEpisodeTag` module on the client.** One
  spells a tag and the other reads one; the server keeps the same split
  inside one file, but the client's `formatEpisodeTag` is a util with
  callers across features, and `readEpisodeTag` is the form's.
- **A drift guard for `formatEpisodeTag` against `spellEpisodeTag`.** It
  predates this initiative.
- **Moving `episodeTag` into `src/`.** Log 29 Q14 ruled it out.
- **The library's empty state, _"Add a movie to start filling your
  shelves."_** It is the prototype's family-facing copy, and the entrances'
  rename (Q22) didn't name it.
- **`useMovieForm`'s length and its nested save ternary.** Log 29's
  Trade-offs accepted that the hook grows a second save. Its own docblock
  names the line to watch (a second caller, or an unreachable branch), and
  neither has happened.
- **An upload progress bar**, a duplicate-series check, and everything else
  log 29 _Not built_ lists, including Edit, Delete and _Add episodes_ for a
  held series.
- **Prettier-governed long lines in tests and imports**, and **lines past the
  measure that predate this initiative**. Each round rewraps its own.
- **Steps 14–15 of the build order, and the Roadmap's Move the media
  folder.**

## Further Notes

- Commit descriptions stay under the one-line rule. For example, commit 5 is
  _PillTabs hands back its caller's type_, commit 13 is _the prefill stops at
  the tag_, and commit 16 is _the body reader hands over its paths_.
- Commits 9 and 10 name their new files `filesCard.styles.ts` and
  `filesCard.ts`. If the subagent finds a name the codebase already uses for
  the same idea, it takes that instead and records it in commit 20.
- Commit 11's leaf reads the focused state through `resolvedStyle`. Neither
  `TextField` nor `Textarea` has such a leaf, so this is the first; if it
  proves useful, giving them one is a follow-up for commit 20 to list, not
  this round's work.
- Commit 20's body closes 260 and 265 with this issue. No other commit body
  carries a closing keyword, and the journal lists follow-ups by bare number.
