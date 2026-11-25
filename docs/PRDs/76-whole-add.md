> **Initiative:** `whole-add`
> **Issue:** #715 (the PRD, step 58)
> **Design log:** `docs/design-logs/76-whole-add.md`
> **Handoff:** `docs/handoff/handoff-whole-add/README.md`, until phase 5 amends `feat.MovieForm.dc.html`, `feat.ImportFlow.dc.html`, `page.LibraryFoldersPage.dc.html` and `COMPONENT-SPEC.md` to it.
> **Build order:** step 58, **Whole add**. Lifts log 11's "the form does not collect" a backdrop; keeps log 41's rule that art is always copied. No migration, no new dependency; one new route (`GET /api/film-folder`).

## Problem Statement

The maintainer has a whole show in hand: `The Show (2019)\`, with a poster and a backdrop in `Images\` and four **Season folders** of twelve episodes each. Every season has its own `Images\poster.jpg` and a `Subtitles\S01E01\` folder per episode. A **Folder scan** of that folder gives a complete title. **Add a title** does not.

- The **Show folder pick** fills the episode rows and their tracks, but no art. The **Show folder read** already sees each **Season poster** and each **Still** and answers neither, and it never reads the show's poster or backdrop. To get the art in, the maintainer picks each image again by hand, opening one dialog after another.
- The form has no **Backdrop** slot at all, so a title added by hand never gets one unless it is synced.
- A movie video pick reads nothing beside the video. The film's poster, backdrop and tracks in its **Title folder** have to be picked again. The movie add takes its tracks only as bytes.
- A household with no TMDB key never gets a Still for a show added by hand. The **Frame still** is taken only inside a Sync, and that Sync never runs.
- _What the scanner accepts_ on Import setup and Library folders → Scan still describes three shapes. Log 58 retired two of them (`subs.en.srt` beside the video, loose episodes at a show's root), along with the folder-first numbering rule. It never mentions `Images\`.

## Solution

**Add a title gives the same complete title a Folder scan gives, for a movie or a series, with or without TMDB.**

- **A Backdrop slot.** It sits directly under Poster in both kinds' Files card, on the add and the edit: a `mol.FileField` labelled _Backdrop_, with _Choose backdrop image_. A browser sends the file's bytes. A Resolve draws no Backdrop slot, because its importer takes no backdrop.
- **A show taken whole.** In the shell, _＋ Add show folder_ fills more than the episode rows. It also fills the Poster, the Backdrop, each _Season posters_ slot and each row's Still, from the art the folder holds (**Folder art**).
- **A film taken whole.** In the shell, on a plain add, picking a movie's video reads its folder (the **Film folder read**). The read fills the Poster and the Backdrop, and adds one Subtitles row per track with its language chosen.
- **Never over a hand pick.** A pick fills a slot only while that slot is empty or still holds the earlier pick's file. The Show folder row's ✕, or the movie video slot's ✕, takes back every slot still holding the pick's art. A slot the maintainer replaced by hand stays.
- **Art is copied.** Every found image is copied into the title's **Media folder** on save, as all art is, even for a linked title. A Still that arrives this way counts as picked, so a Sync never replaces it.
- **Stills without a Sync.** A series add or edit answers first. Then the **Frame fill** takes a Frame still in the background for each episode holding no Still. The series page draws each row's gradient until its Still lands. Nothing on screen waits for it.
- **The scanner block says the layout.** It shows a movie example and a series example side by side, then three rules, then the **Sheet note** as it stands.

## User Stories

1. As the maintainer adding a movie, I want a Backdrop slot under Poster, so that a title added by hand gets a backdrop without a Sync.
2. As the maintainer adding a series, I want the same Backdrop slot between Poster and _Season posters_, so that both kinds read alike.
3. As the maintainer editing a title, I want its held backdrop shown in the Backdrop slot, so that I can see what it has.
4. As the maintainer editing a title, I want to replace its backdrop by picking a new one, so that a bad backdrop can be fixed by hand.
5. As the maintainer editing a title, I want to remove its backdrop with ✕, so that a wrong image can go.
6. As the maintainer, I want a replaced or removed backdrop's old file deleted only after the save commits, as a replaced poster's is, so that a failed save loses nothing.
7. As the maintainer adding in a browser during development, I want the Backdrop slot to upload bytes, so that the dev loop can add a backdrop too.
8. As the maintainer resolving a Problem, I want no Backdrop slot drawn, so that the form never offers a control that does nothing.
9. As the maintainer with a linked title, I want a picked backdrop also written into its Title folder's `Images\` by the **Layout fill**, so that the folder stays whole.
10. As the maintainer picking a show folder in the shell, I want its poster to fill the Poster slot, so that I don't pick it again.
11. As that maintainer, I want its backdrop to fill the Backdrop slot, so that the show's header is ready at save.
12. As that maintainer, I want each season's `Images\poster.jpg` to fill that season's _Season posters_ slot, so that each season tile has its art.
13. As that maintainer, I want each episode's `Images\Stills\S01E01.jpg` to fill that row's Still slot, so that the episode list isn't blank.
14. As that maintainer, I want to pick a single Season folder and still get the show's poster and backdrop, so that adding one season loses no art.
15. As that maintainer, when a place holds two files, I want the first by name order used, the scan's rule, so that a pick and a scan agree.
16. As that maintainer, I want a slot I filled by hand before the pick kept, so that the pick never overwrites my choice.
17. As that maintainer, I want a second show folder pick to replace only the first pick's art, so that re-picking corrects a mistake cleanly.
18. As that maintainer, I want the Show folder row's ✕ to take back every slot still holding its art, so that undoing a pick undoes all of it.
19. As that maintainer, I want a slot I replaced by hand after the pick to survive that ✕, so that my own choice is never lost.
20. As that maintainer, I want each filled slot replaceable and removable like any other, so that Folder art is not a special case to learn.
21. As that maintainer, I want a folder with no art to fill nothing, in silence, so that no line or snackbar appears for a normal case.
22. As the maintainer adding a movie in the shell, I want picking `Heat (1995)\Heat.mkv` to fill the Poster and Backdrop from its `Images\`, so that I don't pick them again.
23. As that maintainer, I want each track in `Subtitles\` added as a Subtitles row with its language chosen, after any rows I added by hand, so that the film's tracks come along.
24. As that maintainer, I want a later video pick to replace only the earlier pick's fills, so that picking the wrong video is easy to correct.
25. As that maintainer, I want the video slot's ✕ to take back the fills still in place, so that clearing the video clears what it brought.
26. As that maintainer, I want an answer that lands after a later pick or after the ✕ to change nothing, so that a slow read never fills stale art.
27. As that maintainer, I want a folder holding two videos still to fill its art and tracks, with no choice to make, so that the video I picked decides.
28. As that maintainer, I want a video under a series folder, a left-out folder or an unreadable one to fill nothing, so that only a film's own folder fills a film.
29. As that maintainer, I want no loader drawn for the movie's read, so that the form doesn't flash for two `readdir`s.
30. As the maintainer editing a movie, I want a replacement video pick not to read its folder, so that a held title's art is never overwritten by surprise.
31. As the maintainer resolving a Problem, I want no folder read on a Resolve, so that its own Found files rule.
32. As the maintainer, I want every found image copied into the title's Media folder on save, so that FamilyFlix never depends on art it doesn't manage.
33. As the maintainer adding a linked title whose only copies are images, I want a Media folder reserved at the add, so that every title holding art has one.
34. As the maintainer, I want a found Still stored with the Still source `picked`, so that a later Sync never replaces art from my folder.
35. As the maintainer, I want a copy that breaks to fail the save and take its folder back, so that a half-added title never lingers.
36. As a developer, I want a found image path refused with `400` unless it is absolute and an image, so that the add reads only what the form could have offered.
37. As a developer, I want a refused path to leave nothing on disk, so that a bad request has no side effects.
38. As the maintainer adding a movie, I want its found tracks accepted by path on the add, so that a film's tracks are read like a show's.
39. As the household with no TMDB key, I want a show added by hand to get a Frame still on every Still-less episode, so that its episode list has pictures.
40. As the maintainer, I want the save to answer before any Frame still is taken, so that adding a 48-episode show doesn't hang.
41. As the household, I want each row's gradient drawn until its Still lands, then the Still on the page's next read, so that the page never waits.
42. As the maintainer, I want an episode that already holds a Still left alone by the Frame fill, so that folder, hand-picked or TMDB art wins.
43. As the maintainer, I want a Still that lands while a frame is being taken to win, so that the fill never overwrites a newer picture.
44. As the maintainer, I want a series saved twice while queued filled once, so that no work is repeated.
45. As the maintainer, I want a series deleted or reset while queued to reserve no folder, so that a Delete leaves nothing behind.
46. As the maintainer, I want specials included in the fill, in season then episode order, so that every row is treated alike.
47. As the maintainer, I want one Frame still taken at a time, so that the machine stays responsive while I keep working.
48. As the maintainer, I want a linked show's Frame stills kept in its Series folder and never written into the Library folder, so that the only writers there stay the Layout fill and the Library sheet writer.
49. As the maintainer who adds and syncs, I want the Sync still to replace a `frame` Still with TMDB's, so that _Add and sync_ ends with TMDB's stills where TMDB has them.
50. As the maintainer, I want movies to take no Frame fill, so that the fill does only what a Still is for.
51. As the maintainer quitting mid-fill, I want the next save of the title to queue the fill again, so that a lost pass heals itself.
52. As the maintainer reading _What the scanner accepts_, I want a movie example and a series example side by side, so that I can lay my folders out by eye.
53. As that maintainer, I want the three rules (film or series, the episode's number and season, where art and subtitles go), so that the block says exactly what the scan reads.
54. As that maintainer, I want the retired shapes gone (`subs.en.srt`, `Show Name\`, loose episodes, "the folder first"), so that the block never teaches a layout the scan rejects.
55. As that maintainer, I want the Sheet note kept as it stands, so that the `_meta` sentence still guides me.
56. As a developer, I want the Sync and the Frame fill to name `<stem>.frame.jpg` in one place, so that the two never drift.
57. As a developer, I want the Show folder pick to use the scan's own art readers, so that a pick and a scan can't disagree.
58. As a developer, I want no route to know there is an FFmpeg, so that the Frame fill reaches playback only through the domain injected into the router.

## Implementation Decisions

### The Backdrop slot

- **`MovieFormValues`** (changed) gains `backdrop: MovieFormFile | null`. `loadFormRecord` fills it from the held `backdropPath`. The docblock line "There is no backdrop beside it" goes.
- **`MovieFormFiles`** and **`SeriesFormFiles`** (changed) draw the Backdrop `mol.FileField` directly under Poster: label _Backdrop_, choose label _Choose backdrop image_, the `poster` icon, the card's own `gap: 14px`. A Resolve passes no backdrop, so no slot is drawn (the `stills: false` precedent).
- **The wire is the Poster's word for word.** A Picked file travels as a `backdrop` part. A held **Stored path** on an edit, or a **Found file** on an add, travels as a `backdropPath` field. On an edit the body is the whole record, so sending neither removes the backdrop. A replaced or removed file is deleted after the commit.
- **The uploads collectors** (`collectUploads`, `collectEpisodeUploads`) take a `backdrop` part as they take `poster`. The add and edit routes store it as `backdrop_path`. The route comment "the form does not collect one" goes.

### Found images on the wire

- **`foundPathRefusal`** (changed): `FoundKind` gains `'image'`, checked with `isImageFilename`. A found image that is not absolute or not an image is a `400`, with nothing on disk.
- **The fields.** Images travel as `posterPath` and `backdropPath` (both kinds), a `seasonPoster` field's `path`, and an `episode` field's `stillPath`. On the movie add, found tracks travel as `subtitlePath`, which the add now reads; "Bytes only, on this route" goes.
- **Where they land.**
  - A title's poster and backdrop go at its Media folder's root.
  - A Season poster and a Still go in `season-NN/` (`media.seasonFolder`).
  - A movie's tracks go at the root, as picked tracks do.
  - A found Still is stored with the Still source `picked`.
- **Always copied.** A found image goes through `Media.copyIn`, which fits art on its way in. An add whose only copies are images still reserves a Media folder. A copy that breaks fails the save and takes the folder back.
- **`copyFoundArt`** (new import-export module) copies a title's found poster, backdrop and Season posters for both adds.
  - It takes `(media, folder, art: FoundArt)` and resolves to `CopiedArt`, each file's Stored path with the Season posters listed by season.
  - It rejects on the first copy that breaks, and the caller takes the folder back.
  - It is shared so that `POST /series`, already the longest route, doesn't grow a second inline copier.
- **`copyFoundEpisodes`** (changed) copies an episode's found `stillPath` beside its found tracks and answers it in `CopiedEpisode.still`.

### The Show folder read

- **`readTitleArt`** (new export of the media domain's `readTitleFolder` module) is the art reader lifted out of `readTitleFolder`. It takes a folder and answers its **Poster** and **Backdrop** by role from `Images/`, the first of each by name order. `readTitleFolder` then calls it, so its behaviour is unchanged.
- **`readShowFolder`** (changed) passes `readTitleArt(showFolderOf(dir))` to `numberShow` in place of `poster: null, backdrop: null`. Because it reads the **Show folder**, a picked Season folder still brings its show's art.
  - `ShowFolderRead` gains `poster` and `backdrop` (absolute or `null`) and `seasonPosters: { season, path }[]`, listing only the seasons holding one, in number order.
  - `ShowFolderEpisode` gains `still: string | null`.
  - The form draws no **Doubled place**.

### The Film folder read

- **`readFilmFolder`** (new import-export module), exposed as `importer.readFilmFolder`, reads `readTitleFolder(dirname(video))`. When that reads as a `film` whose videos include the picked one, it answers the film's poster, backdrop and tracks (path and language). A series, a left-out folder or an unreadable folder answers all empty. A folder holding two videos still answers its art and tracks.
- **`GET /api/film-folder?video=<absolute path>`** (new route) answers `FilmFolderRead` (`{ poster, backdrop, subtitles: { path, language }[] }`, in `src/types/form.ts`). A path that is not absolute or not a video is a `400`, by `foundPathRefusal`.
- **It is not merged into the containing read.** That read belongs to `useImportMode` and answers a Library folder, and keeping one read per question keeps both small.

### The form takes Folder art

- **`FolderArt`** (new shared type in `src/types/form.ts`): `{ poster, backdrop, seasonPosters: Record<number, string> }`, absolute paths with `null` for none.
- **One fill rule, the Folder key's.** A slot is filled when it is empty or still holds the earlier pick's file, and never over a file picked by hand. A ✕ on the pick takes back each slot still holding the pick's file.
- **`showFolderRows`** (changed) sets each row's `still` as a Found file.
- **`useShowFolderPick`** (changed) takes `prefillFolderArt: (art: FolderArt, picked: FolderArt | null) => void` beside `prefillFolderKey`. It remembers the art it offered, as it remembers the key.
- **`useSeasonPosters`** (changed) gains the same prefill for its slots. A slot is drawn once the rows hold its season.
- **`useFilmFolderPick`** (new movie-form hook) follows `useShowFolderPick`'s pattern.
  - It runs only in the shell, on a plain add (not an edit, not a Resolve), when a video is picked.
  - It reads the video's path through `folderBridge()`.
  - It fills the Poster and Backdrop. It adds each track as a found row with its language, after the hand-added rows.
  - It draws no loader. An answer that lands after a later pick or after the ✕ is dropped (the `videoPick` counter's rule).
- **`readFilmFolder`** (new wire call) joins `movie-form/api/`. It is one feature's, so it stays there.
- **A browser is unchanged**, apart from the new Backdrop slot. It has no paths, so it has no folder read.

### The Frame fill

- **`takeFrameStill`** (new enrichment module) takes one Frame still and stores it as `<stem>.frame.jpg`. It is lifted out of `writeEpisodes`, so the Sync and the fill share it. The Sync's behaviour is unchanged.
- **`createFrameFill`** (new enrichment module) takes `{ storage, media, playback }`. `storage` is `Pick<LibraryStorage, 'getSeriesDetail' | 'stillSourcesOf' | 'enrichEpisode' | 'mediaFolderOf' | 'recordMediaFolder'>` and `playback` is `Pick<Playback, 'frame'>`. It answers `{ fill(seriesId): Promise<void> }`.
  - Fills are queued behind any fill in flight, one take at a time. A series already waiting is filled once.
  - `fill` resolves when that series' turn is done, and never rejects.
  - At its turn the fill reads the series again. A series that is gone does nothing, so a Delete or Reset mid-queue reserves no folder.
  - It takes each Still-less episode in season, then episode order, specials included. It stores through one `lateReserve` per series and writes `stillPath` with `stillSource: 'frame'`.
  - Just before writing, it reads the episode's Still source again. A Still that landed meanwhile wins, and the picture is dropped.
- **Wiring.** The fill is made in the server's main wiring and injected into `createApiRouter` as `frameFill`, as `layoutFill` is. `POST /series` and `PATCH /series/:id` call `void frameFill.fill(id)` after the Layout fill. Movies take none.
- **Unchanged.**
  - The Layout fill still never writes a Frame still. A Frame still lives only in the Series folder.
  - The Sync still replaces a `frame` Still with TMDB's.
  - A Sync that planned before a fill stored may store a second frame. The older file stays in the Series folder, unreferenced, and goes with the folder on a Delete.
  - A Folder scan and a Resolve start no Frame fill.
- **It lives in enrichment, not `playback/`.** Playback knows no rows, and the Late reserve belongs to enrichment.

### The scanner block

- **`FolderShapes`** (changed, name kept) follows the handoff.
  - The panel, glyph and heading stay. The movie example (`Heat (1995)\`) and the series example (`The Show (2019)\`) sit side by side in 12px mono, faint, with line-height 1.8 and `flex` with `gap: 32px` and wrap.
  - Three rules follow in 13px sans, faint, with their names in mono.
  - The Sheet note follows, unchanged.
  - The three retired shape lines and the folder-first sentence go.

### Documents

- **Phase 5** amends `feat.MovieForm.dc.html` (the Backdrop slot on both kinds), `feat.ImportFlow.dc.html` and `page.LibraryFoldersPage.dc.html` (the scanner block), and `COMPONENT-SPEC.md` (MovieForm's Files; ImportFlow's and LibraryFolders' `FolderShapes`).
- **The checklist's step 58** is updated.
- **CLAUDE.md's Movie form rule** changes: a show is taken whole "with its art", and a film's art and tracks are read from its folder.
- **Docblocks** change on `MovieFormValues`, `ShowFolderRead`, `readShowFolder`, `useShowFolderPick`, `copyFoundEpisodes`, `foundPathRefusal`, `writeEpisodes` and the two add routes.
- **The glossary** already holds the new and updated terms (log 76).
- **The README** is untouched: no top-level folder or rule changes.

## Testing Decisions

- **A good test proves behaviour through a unit's public interface.**
  - A server test drives a real library over a temp Media directory and real folders on disk.
  - A route test drives the HTTP API with supertest and checks the answer, the rows and the files.
  - A form test drives the rendered form with Testing Library, the way the maintainer clicks.
  - No test asserts on private helpers, call order or internal state.
- **Server tests.**
  - The `readTitleFolder` suites stay unchanged and passing, which proves the lift is a refactor. `readTitleArt` gets a new suite in the same folder.
  - `readShowFolder` gets an art suite: the show's poster and backdrop, each Season poster and each episode's Still. A picked Season folder answers its show's art. A folder with none answers `null`s and no Season posters.
  - `readFilmFolder` covers a film's art and tracks. A series folder, a left-out one and an unreadable one answer empty. A folder of two videos answers its art.
  - `copyFoundArt` gets its own suite. `copyFoundEpisodes` gains the still case.
- **Route tests.**
  - The two add suites for Folder art cover found art copied into a reserved Media folder for a linked title, and a found Still stored as `picked`. A relative or wrong-kind path is refused with nothing on disk.
  - The backdrop suite covers a backdrop added, kept, replaced and removed on both kinds' edit.
  - The film-folder suite covers the answer and the `400`.
  - The frame-fill suite shows that a series add answers before the fill ends, and that the Stills land after.
- **The Frame fill.** It is tested over a real library and Media with a fake `frame`.
  - Every Still-less episode is filled, and a held Still is untouched.
  - A second `fill` while queued fills once.
  - A series deleted while queued reserves nothing.
  - A Still landing mid-take wins.
- **Form tests.**
  - `useShowFolderPick` gets an art suite, and `useFilmFolderPick` its own.
  - A MovieForm backdrop suite covers the slot on both kinds, the add and the edit, and none on a Resolve.
  - A MovieForm folder-art suite shows that a pick fills the slots but never over a hand pick, and that the ✕ takes them back.
  - The `formValues` suite gains `showFolderRows`' Still.
- **The scanner block.** The `FolderShapes` suite covers the two examples, the three rules and the Sheet note.
- **Prior art.**
  - `readShowFolder`'s and `readTitleFolder`'s existing suites, for real-folder fixtures.
  - The `routes.*` suites for found videos and tracks on `POST /series`, for found-path refusals.
  - `lateReserve` and the `createEnrichment` Frame still suites, for a fake `playback.frame` over a real library.
  - `useShowFolderPick`'s and the MovieForm Show folder suites, for the prefill-and-✕ rule.

## Out of Scope

- A folder read in a browser (`<input webkitdirectory>`): it would need a second, client-side Layout reader and every byte uploaded, for the dev loop alone.
- A Backdrop on a Resolve: the importer's `resolveMovie` and `resolveSeries` take no backdrop. This is a follow-up.
- A Frame fill after a Folder scan or a Resolve. It will be filed as a follow-up when the issues are cut.
- Merging the containing read into the Film folder read.
- A **Found-file choice** for a film folder holding two videos.
- A **Doubled place** drawn on the form.
- Any progress, loader or snackbar for the Frame fill.
- Linking art where it lies: art is always copied.
- A Frame still written into a Library folder.

## Further Notes

- **Build order** (log 76's plan):
  1. A Backdrop by hand.
  2. A show added whole.
  3. A film added whole.
  4. Stills without a Sync.
  5. The block and the prototype, walked live in the shell.
- **Two costs to accept.** More of the wire now takes absolute paths, though the **Loopback guard** still keeps it local. The Frame fill's work is lost on quit; the title's next save queues it again.
- **Dev fixtures.** The fixture's `Tidewater (2018)/Season 01/` and a hand-made `The Show (2019)\` with `Images\` and `Subtitles\` cover the demos. Use `Heat (1995)\Heat.mkv` for the film walk.
