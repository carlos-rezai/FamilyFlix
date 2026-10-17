> **Initiative:** `add-and-sync`
> **Design log:** `docs/design-logs/45-add-and-sync.md`
> **Issue:** #391 (the PRD, step 28)
> **Build order:** step 28, the first after Episode stills. It ships as five thin slices (log 45, _Implementation Plan_), the prototype revision first.

## Problem Statement

When I add one film or one show by hand, I have to type the year, the director, the cast, the synopsis and the genres, and find a poster. TMDB already knows all of that. The app can fetch it, but only once the title exists: I save the half-empty record, open its page, open the ⋯ menu, press _Fetch from TMDB_ and press Start. That is four extra steps for every title, every time.

I want to give the form the files, let the title fill itself from the video's name, and let TMDB fill everything else. If TMDB is unsure which title I meant, or disagrees with something I typed, I want to settle it the way I already do in the Sync's review.

The shortcut must never cost me the add. A Sync that fails, is refused or is stopped must leave the title I saved exactly as I saved it. It must also never quietly throw away another title's review that I have not finished.

## Solution

The **Movie form**'s plain add, for a film and for a series, draws the same _Also fetch metadata and posters from TMDB_ box that Import setup draws. It sits between the Files card and the actions, and it is off every time the form opens. _Add to library_ keeps its label. **The Save gate is unchanged**: a title and a video, every episode's for a series.

With the box off, the add ends exactly as it does now, on its **Fresh home**.

With the box on, **Add and sync**: the save goes through as always. Then the form **replaces** `/add` with the new title's page and **pushes** the **Enrichment flow** for that title. The flow is **Started on arrival**: it presses its own Start once, with setup's defaults, as soon as it knows the summary and whether a run is already held. It then drops the parameter from the URL, so a reload or a later Back never starts a second Sync. The run goes through running and review as a ⋯ menu Sync does: an `ambiguous` match draws the Candidate picker, a `missing` one the search box, and a field I typed that TMDB disagrees with a _Yours | TMDB_ row. _Back to the movie_ (or _series_) and Back both step onto the new title's page. That page's own Back steps to Settings, where _＋ Add a title_ was.

The flow does not press Start when Start would not run, or when the maintainer needs to read something first. Without a key, Start's own rule sends me to Settings with _Add your TMDB key here first._ Offline, the offline banner waits for my press. When another title's Sync is running, I get the **Busy notice**. When another title's review still has **Decisions**, the **Let-go line** is drawn and waits for my press. The title is saved in every one of these cases.

Nothing changes on the server.

## User Stories

### The box

1. As the maintainer, I want an _Also fetch metadata and posters from TMDB_ box on the Add form, so that I can ask for TMDB's details while I add the title.
2. As the maintainer, I want the box drawn on both a film's add and a series' add, so that a show gets the same shortcut as a film.
3. As the maintainer, I want the box drawn between the Files card and the actions, so that it reads as part of what _Add to library_ will do.
4. As the maintainer, I want the box to look exactly like the one in Import setup, so that the same choice reads the same everywhere.
5. As the maintainer, I want the box off every time the form opens, so that a Sync never runs because of something I ticked last week.
6. As the maintainer, I want the box kept when I switch between Movie and Series on the Kind tabs, so that switching kind does not quietly undo my choice.
7. As the maintainer, I want the hint to say the Sync runs straight after the save over this title and needs the internet, so that I know what ticking it does.
8. As the maintainer, I want the hint to tell me a TMDB key is needed when none is stored, so that I know why the Sync will not run before I tick it.
9. As the maintainer, I want the box reachable and togglable from the keyboard, so that it behaves like every other control on the form.
10. As the maintainer, I want _Add to library_ to keep its label whether the box is ticked or not, so that the button still says what it does.
11. As the maintainer, I want the box not drawn when I edit a title, so that the form does not offer something the ⋯ menu's _Fetch from TMDB_ already does.
12. As the maintainer, I want the box not drawn on a Resolve, so that the Import context's own _Also fetch_ choice is the only one that applies there.

### The Save gate

13. As the maintainer, I want the Save gate to stay a title and a video, so that ticking the box never makes another field required.
14. As the maintainer, I want the title still filled from the video's name, so that `the.matrix.1999.1080p` becomes something the Search ladder can find.
15. As the maintainer, I want a year I type to be sent with the title, so that the Sync can tell a remake from the original.
16. As the maintainer, I want the fields I leave blank simply filled by TMDB, so that I am not asked about fields I never typed.
17. As the maintainer, I want a field I typed that TMDB disagrees with raised as a _Yours | TMDB_ row, so that what I typed is never silently overwritten.

### Where the save lands

18. As the maintainer, I want an unticked add to land where it lands today, so that the shortcut changes nothing for anyone who does not use it.
19. As the maintainer, I want a ticked film add to open the Enrichment flow for that film, so that I see the progress bar and the review.
20. As the maintainer, I want a ticked series add to open the Enrichment flow for that series, so that its seasons, episodes and Season posters are fetched too.
21. As the maintainer, I want a ticked series add's review to draw the Seasons section, so that I can choose each season's poster as I can from the series' ⋯ menu.
22. As the maintainer, I want _Back to the movie_ to step onto the film I just added, so that I see what the Sync wrote.
23. As the maintainer, I want Back from the flow to step onto the new title's page too, so that both ways out reach the same place.
24. As the maintainer, I want Back from the new title's page to step to Settings, so that I end up where _＋ Add a title_ was.
25. As the maintainer, I want history never to hold the emptied Add form behind the flow, so that Back never lands me on a blank form.
26. As the maintainer, I want a refused save to leave the form standing with everything I typed, so that nothing is lost and no Sync starts over a title that does not exist.

### Started on arrival

27. As the maintainer, I want the flow to start the Sync itself, so that I do not have to press Start after already asking for it.
28. As the maintainer, I want it started with setup's defaults (every field chip, the Write targets as setup offers them), so that it does what pressing Start would have done.
29. As the maintainer, I want it started only once the summary and the held run are both known, so that it never starts on a guess.
30. As the maintainer, I want the start parameter dropped from the URL straight away, so that reloading the page does not start a second Sync.
31. As the maintainer, I want stepping back onto the flow never to start another Sync, so that history is safe to walk.
32. As the maintainer, I want the parameter dropped even when nothing was started, so that the URL always describes a page that just shows the flow.
33. As the maintainer, I want the flow, with no key stored, to send me to Settings with _Add your TMDB key here first._, so that I know what to do next.
34. As the maintainer, I want an offline flow to show its offline banner and wait for me, so that it does not fail in front of me.
35. As the maintainer, I want the Busy notice when another title's Sync is still running, so that two Syncs never run at once.
36. As the maintainer, I want the flow not to start when another title's review still has Decisions, so that I never lose a review I have not finished.
37. As the maintainer, I want the Let-go line drawn under Start in that case, so that I can choose to let it go with my own press.
38. As the maintainer, I want the flow to start when another title's run is waiting with no Decisions, so that an empty review does not block the shortcut.
39. As the maintainer, I want a run that already belongs to this title re-attached rather than started again, so that a reload mid-run shows the run I have.
40. As the maintainer, I want typing `/enrich?movie=<id>&start=1` by hand to behave exactly the same, so that the arrival is one rule with no special case for the form.

### Safety of the add

41. As the maintainer, I want a Sync that fails never to undo the add, so that the title stays in the library.
42. As the maintainer, I want a Sync I stop to keep the title as I saved it, plus whatever had already been fetched, so that _Stop_ means what it does everywhere else.
43. As the maintainer, I want a Decision I skip to leave the title as I saved it, so that skipping is always safe.
44. As a parent, I want a title added this way to show up in the library like any other, so that I can find and play it straight away.

## Implementation Decisions

### Modules

- **`EnrichCheckCard` graduates to `components/`**, `FieldDiff`'s precedent, now that a second feature draws it. It gains one prop, `keyedHint: string`, the hint drawn while a key is stored. Its props become `{ checked, keySet, keyedHint, onToggle }`. The key-less hint stays the card's own sentence (_Needs a TMDB key. Add one under Settings → Network first._). Import setup and the Library folders page pass the import's sentence (_Runs straight after the import, over everything it brings in. Needs the internet._). The form passes _Runs straight after the save, over this title. Needs the internet._ The move changes no pixel and no read. It is re-exported from the components barrel.
- **`useKeyStored` moves to `src/hooks/`**: a hook two features now call. Its behaviour is unchanged: `false` until the read lands and for a failed read.
- **`enrichPath` gains `start?: true`** on `EnrichQuery`, written as `start=1`. Every existing query reads back as before.
- **`useEnrichmentRun` gains `attaching: boolean`**, `useImportRun`'s name. It is `true` from mount until the arrival read of the Current enrichment run answers (a held run, a `404`, or a failure), then `false`.
- **`EnrichmentFlow` learns Started on arrival.** When `start` is in the query, the flow waits until the EnrichmentSummary has landed and `attaching` is `false`. Then, once, it decides:
  - the run already belongs here (re-attached) → nothing pressed;
  - a Waiting run with a Let-go line (it has Decisions) → nothing pressed;
  - otherwise → its own `onStart`, with setup's default chips and Write targets. `onStart` already handles no key, offline and the `409` Busy notice.

  In every case the flow then **replaces** the URL with the same `enrichPath` without `start`. The decision is made at most once per mount.

- **`useMovieForm` gains `enrich` and `toggleEnrich`**, `ImportFlow`'s names. `enrich` is `false` on mount, kept across a Form kind switch, and only drawn and read on the `add` job. The add's leaving becomes a choice made after a successful save:
  - `enrich` off → the kind's Fresh home, pushed, as now;
  - `enrich` on → **replace** with the new title's page (`moviePath(id)` / `seriesPath(id)`), then **push** `enrichPath({ movie | series: id, start: true })`.

  The `id` comes from the `Movie` / `Series` that `createMovie` / `createSeries` already answer. A refused save navigates nowhere, as now.

- **`MovieForm`** draws the `EnrichCheckCard` between the Files card and the actions on a plain add, both kinds, fed by `useKeyStored()` and the form's `enrich`.

### Interfaces

- `EnrichCheckCardProps`: `{ checked: boolean; keySet: boolean; keyedHint: string; onToggle: () => void }`.
- `EnrichQuery`: `{ scope?: 'all'; movie?: string; series?: string; start?: true }`.
- `EnrichmentRunState` adds `attaching: boolean`.
- `useMovieForm`'s return adds `enrich: boolean` and `toggleEnrich: () => void`.

### Server, schema, routes

- **None change.** `POST /api/movies` and `POST /api/series` already answer the record with its `id`. `POST /api/enrichment` already takes a `movieId` or a `seriesId` on the `single` scope. The single run already re-attaches by title. No migration and no wire field.

### History

- A ticked add leaves history as **Settings → the title's page → the flow**. That is not a Fresh home. An unticked add's Fresh home is untouched. The form's Back and Cancel are untouched.

### Prototype

- Before the build: `feat.MovieForm.dc.html` (the box on a plain add, both kinds, between the Files card and the actions), `mol.EnrichCheckCard.dc.html` (graduated, with `keyedHint`), and `FamilyFlix.dc.html` (the save onto the title's page and the flow, Started on arrival). `feat.EnrichmentFlow` draws nothing new.

## Testing Decisions

- A good test drives a unit through its public surface: rendered output and user events for components and organisms, the returned state and navigation for hooks, the returned string for `enrichPath`. It never reads internals. The wire is faked at `fetch` (`fakeResponse`), and where the router is now is read through `LocationProbe` (`pathname`, `search`, `navigationType`), never by spying on `navigate`.
- **`enrichPath`**: `start: true` writes `start=1` beside `movie` or `series`, and every existing query reads back unchanged. Prior art is its current suite.
- **`EnrichCheckCard`** (moved suite): the keyed hint is the caller's `keyedHint`, the key-less hint is the card's own, the box is a real checkbox in the tab order, and a press calls `onToggle`. Prior art is its current suite in `import-export/`.
- **`useKeyStored`** (moved suite): unchanged cases at the new path.
- **`useEnrichmentRun`**: `attaching` is `true` on mount and `false` once the arrival read answers, whether it holds a run, gets a `404` or fails. Prior art is `useImportRun`'s `attaching` cases.
- **`EnrichmentFlow`**, Started on arrival, one case per branch of the decision: no run held → one `POST /api/enrichment` with the single scope, the title's id and the defaults, then the URL replaced without `start`; a run already this title's → no POST, URL replaced; a Waiting run with Decisions → no POST, Let-go line drawn, URL replaced; a Waiting run with none → one POST; no key → `/settings` pushed with the notice, no POST; offline → no POST, banner drawn; a `409` → the Busy notice. Also: no POST before both reads have landed; at most one POST however often it re-renders; without `start` nothing changes from today. Prior art is the flow's existing single-scope and Waiting-run suites.
- **`useMovieForm` / `MovieForm`**: the box is drawn on a plain add for both kinds and absent on an edit, a Resolve and a series edit; it is off on mount and kept across a kind switch; a ticked film save ends on `/enrich?movie=<id>&start=1` with the title's page behind it as a replace (Back lands on `/movie/<id>`, not `/add`); a ticked series save the same with `seriesPath`; an unticked save lands on its Fresh home as now; a refused save navigates nowhere. Prior art is the form's existing add-and-land suites.
- **Import setup / Library folders page**: their existing suites keep passing with the import's sentence now passed as `keyedHint`.

## Out of Scope

- The option on an edit or a Resolve.
- A Sync run in the background on the title's page.
- A year read off the video's filename.
- A TMDB search before the save.
- A remembered tick, or any stored preference for the box.
- Any server, route, wire or schema change.

## Further Notes

- Glossary terms: **Add and sync** and **Started on arrival** (log 45 Q2). Avoid "auto-sync", "quick add", "smart add" and "auto-start".
- **Started on arrival** is not a second way to start a Sync. It is the flow pressing its own Start under every rule the button has. The form starts no Sync and posts nothing to enrichment.
- Docs per log 45 Q18: README's and CLAUDE.md's step 28 and feature entries, CLAUDE.md's folder tree (`components/EnrichCheckCard/`, `hooks/useKeyStored`, `enrichPath`'s `start`, the flow's arrival), and the glossary. Ticked ✅ only after the refactor.
