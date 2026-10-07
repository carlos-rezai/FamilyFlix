> **Initiative:** `add-series`
> **Design log:** `docs/design-logs/29-add-series.md`
> **Build order:** step 13

## Problem Statement

I am the maintainer, and right now the only way to get a TV show into
FamilyFlix is Bulk import. To add one show, I need a folder tree laid out the
way the scanner reads it and a spreadsheet row that names it. When I just want
to add the one series my parents asked for, that's a lot of ceremony. The form
I use for films, _Add a movie_, can't take a series at all.

The form's Save rule also doesn't match how I work. To me, the thing that
matters is the file: a movie with no video isn't a movie. The form makes me
type a title even though the filename already says it. Meanwhile the server
will still accept an add with no video and write a row with nothing behind it,
which shows up in the library as a film that can't play.

## Solution

The same screen, `/add`, adds either kind of title. A **Kind tabs** switch in
the form's header, _Movie_ / _Series_, uses the same pill track as the
library's Movies / Series tabs. The kind lives in the URL (`?kind=series`), so
a reload or a link opens the right one.

- **Series** uses the same metadata fields as a movie, with series wording:
  _Series title_, a year that reads `2019`, `2019–2023` or `2021–`,
  _Created by_, cast, synopsis, genres and rating. Its Files card holds a
  poster and a list of **Episode file rows**.
- **Episodes** are added from one multi-file picker, _＋ Add episode files_.
  Each picked video becomes a row, with its season and episode number and its
  title filled in from the filename (`S01E03 - The Long Fare.mkv` gives season
  1, episode 3, _The Long Fare_). All of these can be edited. Each row can
  carry its own subtitles, each with a language.
- **Switching kinds loses nothing.** The shared fields carry across, each
  kind's own files are kept, and Save sends only the active kind.
- **Save opens when a video is set.** For a movie, that means a picked video.
  For a series, it means at least one episode, every episode numbered, and no
  two with the same number. Picking a video into an empty title fills the
  title from the filename, so in practice the video is all I have to supply.
- **The server agrees.** It refuses a movie add or edit with no video, and a
  series with no episode.
- **One save, all or nothing.** A series is sent as one request. If anything
  fails, nothing is kept: no half-added show and no stray files. A finished
  series add lands on the library's Series tab, and a movie add on the
  library.
- **The way in is renamed.** The Settings entry points are now called _Add a
  title_.

## User Stories

1. As the maintainer, I want to add a series from the same screen I add movies from, so that I don't need a folder tree and a spreadsheet for one show.
2. As the maintainer, I want to choose between Movie and Series with the same pill switch the library header uses, so that the Movies / Series split looks the same everywhere.
3. As the maintainer, I want the form to open on Movie by default, so that the common case needs no extra press.
4. As the maintainer, I want the chosen kind kept in the URL, so that a reload keeps me on the Series form.
5. As the maintainer, I want switching kinds to add no history step, so that Back still leaves the form in one press.
6. As the maintainer, I want the title, year, creator/director, cast, synopsis, genres, rating and poster kept when I switch kinds, so that a mis-click costs me nothing.
7. As the maintainer, I want the episodes I picked kept when I switch to Movie and back, so that one mis-click never wipes a dozen files.
8. As the maintainer, I want the movie's video and subtitles kept when I switch to Series and back, so that the same holds the other way.
9. As the maintainer, I want only the kind on screen to be saved, so that a movie's video is never sent with a series or the other way round.
10. As the maintainer, I want the heading to read _Add a series_ and the lede to talk about episodes when Series is chosen, so that I know which job is in front of me.
11. As the maintainer, I want the title placeholder to read _Series title_ and the director field to read _Created by_ for a series, so that the words fit what I'm adding.
12. As the maintainer, I want to type a series' year as `2019`, `2019–2023` or `2021–`, so that I can say a show ran for years or is still running.
13. As the maintainer, I want a hyphen accepted in place of the dash, so that I don't have to hunt for an en dash.
14. As the maintainer, I want the year read the same way the spreadsheet reads it, so that a form-added show and an imported one agree.
15. As the maintainer, I want an unreadable year stored as no year rather than refused, so that a typo never blocks the save.
16. As the maintainer, I want to choose a series' genres from the same Genre pool as movies, so that the genre rows stay one vocabulary.
17. As the maintainer, I want to give a series a household rating on the form, so that it shows on the series page.
18. As the maintainer, I want to pick a series poster in the same Poster field a movie uses, so that the Series tab shows its art.
19. As the maintainer, I want to pick a whole season's episode files in one dialog, so that twelve episodes aren't twelve dialogs.
20. As the maintainer, I want to press _＋ Add episode files_ again to add more, so that I can add a second season from another folder.
21. As the maintainer, I want each picked video to become an Episode file row, so that I can see every episode I'm about to add.
22. As the maintainer, I want the season and episode numbers filled in from an `S01E03`, `s1e3` or `1x03` tag in the filename, so that a well-named season needs no typing.
23. As the maintainer, I want the episode's title filled in from the text after the tag, with dots, underscores and quality tags cleaned away, so that rows read like titles.
24. As the maintainer, I want a file with no tag placed in season 1 as the next free episode number, so that it still lands somewhere sensible.
25. As the maintainer, I want to edit any row's season, episode number and title, so that I can fix what the filename got wrong.
26. As the maintainer, I want the number fields to accept digits only, so that I can't type something the library can't store.
27. As the maintainer, I want an episode with no title to show _Untitled episode_ as its placeholder, so that I know an empty title is fine.
28. As the maintainer, I want each row to show its filename in mono, so that I can tell which file a row is.
29. As the maintainer, I want each pick's files inserted in episode order, so that the list reads like the season.
30. As the maintainer, I want rows never to re-sort while I'm typing a number, so that the row I'm editing doesn't move away from my cursor.
31. As the maintainer, I want to remove an episode row with its ✕, so that a wrongly picked file doesn't get added.
32. As the maintainer, I want to add subtitles to each episode with its own _＋ Add subtitle_, so that every episode's tracks are explicit.
33. As the maintainer, I want each episode subtitle to default to English and be changeable, so that it works like a movie's subtitles.
34. As the maintainer, I want to remove an episode's subtitle, so that a wrong track doesn't get stored.
35. As the maintainer, I want Save to stay closed until at least one episode is picked, so that I can't add an empty show.
36. As the maintainer, I want Save to stay closed while any row lacks a season or episode number, so that every episode is placed.
37. As the maintainer, I want season 0 refused, so that specials stay out as they are for import.
38. As the maintainer, I want Save to stay closed while two rows share a season and episode number, so that the save can't fail on a duplicate.
39. As the maintainer, I want the series title filled in from the first episode files' names when it's empty, so that `Harbor.and.Vine.S01E01.mkv` gives _Harbor and Vine_ without typing.
40. As the maintainer, I want a movie's title filled in from its video's filename when the title is empty, so that `The.Long.Fare.2019.1080p.mkv` gives _The Long Fare_.
41. As the maintainer, I want a title I already typed never overwritten by a pick, so that my spelling wins.
42. As the maintainer, I want Save to close again if I clear the title, so that nothing is saved untitled.
43. As the maintainer, I want a movie's Save to open on a picked video alone, without a poster, so that a film with no art can still be added.
44. As the maintainer, I want a closed Save to be just a disabled button and not a message, so that the form stays as quiet as the prototype draws it.
45. As the maintainer, I want _Adding…_ on the button while a series uploads, so that I know the save is running.
46. As the maintainer, I want a whole series saved in one go, so that a failure never leaves a half-added show I have no Delete for.
47. As the maintainer, I want a failed series save to leave no files behind in managed storage, so that the media folder holds only what the library knows.
48. As the maintainer, I want a refused save to keep everything on the form, so that I can fix it and press Save again.
49. As the maintainer, I want a finished series add to land me on the library's Series tab, unfiltered, so that I see the new show.
50. As the maintainer, I want a finished movie add to land on the library as it does today, so that nothing changes for films.
51. As a parent, I want a form-added series to show its seasons and episodes in order on its pages, so that it looks the same as an imported one.
52. As a parent, I want a form-added episode to play with its subtitles, so that subtitles work as they do for imported episodes.
53. As a parent, I want each form-added episode's runtime read off its file, so that it shows like an imported one.
54. As the maintainer, I want the form's entrances in Settings renamed _Add a title_, with the row's line reading _A movie or a series, with its files._, so that I know the one screen does both.
55. As the maintainer, I want the movie Edit job and the Import context to draw no Kind tabs, so that I can't switch an edit to a kind that can't hold the movie it loaded.
56. As the maintainer, I want `?kind=series` ignored beside `?movie=` or `?problem=`, so that a stray link can't open a series form over a movie edit.
57. As the maintainer, I want the server to refuse a movie add with no video, so that no client can write a film that can't play.
58. As the maintainer, I want the server to refuse a movie edit that would leave it with no video, so that an edit can't strip a film of its file.
59. As the maintainer, I want the server to refuse a series with no episode, a bad or duplicate episode number, an episode with no video, a stray file, a file type it doesn't store, or an unknown genre, each with a one-sentence reason, so that a bad request writes nothing.
60. As the maintainer, I want a duplicate refused with the tag spelled out (`Duplicate episode: S01E03`), so that the reason names the row.
61. As the maintainer, I want the importer to keep adding new episodes to a show it already holds, so that a new season still joins through Bulk import.
62. As a developer, I want the client's episode-tag reader and the server's held to one shared table of filenames by a guard test, so that the two can't drift apart unnoticed.
63. As a developer, I want the pill track to be one presentational molecule used by both the library tabs and the form, so that the two switches can't drift apart.

## Implementation Decisions

**One screen, a second kind.** `/add` stays one organism, `MovieForm`. The
feature, organism, hook and page keep their names, and the glossary's **Movie
form** now adds a movie or a series and edits and resolves a movie. There is
no second screen.

**`PillTabs` molecule (new, `components/`).**

- Props: `{ label, options: { value, label }[], value, onChange }`.
- It renders two or more `aria-pressed` buttons in a labelled `group`, drawn
  exactly as the library's tabs draw their pill track today.
- It is presentational: no URL, no query param.
- `LibraryTabs` composes it and keeps its own `tab` URL write. `LibraryTabs`'
  styles file goes away.

**The Kind tabs.**

- `PillTabs` sits in the form header row after the heading, pushed to the
  row's end, with _Movie_ / _Series_.
- The kind is held in the URL as `?kind=series`, written as a `replace` and
  omitted for `movie`. This is the library tabs' rule.
- The tabs are drawn only on the add with no context. With `?movie=` or
  `?problem=` they are not drawn, and `?kind=` is ignored.

**What changes with the kind.**

| Thing             | Movie                                                            | Series                                                                     |
| ----------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Heading           | Add a movie                                                      | Add a series                                                               |
| Lede              | Pick the video, poster, and any subtitle files for this movie. … | Pick the poster and every episode's video and subtitles for this series. … |
| Title placeholder | Movie title                                                      | Series title                                                               |
| Year placeholder  | 2019                                                             | 2019–2023                                                                  |
| Director field    | Director / _Director name_                                       | Created by / _Creator name_                                                |
| Description       | A short synopsis of the movie                                    | A short synopsis of the series                                             |
| Files card        | `MovieFormFiles`                                                 | `SeriesFormFiles`                                                          |
| Save / in flight  | Add to library / Adding…                                         | Add to library / Adding…                                                   |

Both ledes end with _To add many at once, use **Import library**._

The shared fields form one record that both kinds draw. Each kind's own files
are held side by side, and Save sends only the active kind's.

**The series year field** holds digits and one dash (en dash or hyphen), at
most nine characters.

**`useMovieForm`** gains:

- `kind` and `setKind`, which writes the URL.
- The **title prefill**: the first video, or the first batch of episode files,
  picked into an empty title fills it through `titleFromFilename`. A typed
  title is never overwritten.
- The series save through `createSeries`, landing a push on `/?tab=series`
  (the series kind's **Fresh home**).
- `canSave` per kind:
  - Movie: title and video, as today.
  - Series: title and `episodesComplete`.

**`useEpisodeList` (new hook, feature-local).** It holds the keyed
`EpisodeFormRow` list and exposes:

- `addEpisodeFiles(files)`. Each pick's files are read through
  `readEpisodeTag` and inserted in tag order. An untagged file goes to season
  1 as the next free episode number. Rows are never re-sorted on an edit.
- `setSeason`, `setNumber`, `setEpisodeTitle` and `removeEpisode`.
- The per-row subtitle trio (add, set language, remove), on the movie
  subtitles' rule: English by default.
- `episodesComplete`: at least one row, every row's season ≥ 1 and number ≥ 1,
  and no duplicate (season, number) pair.

**`readEpisodeTag` (new, pure, feature-local).** It is the client mirror of
the server's `episodeTag` and handles:

- `S01E03`, `s1e3` and `1x03`
- a multi-episode file's first number
- the title after the tag, with dots, underscores and quality tags cleaned

It returns season, number and title, or nothing.

**`titleFromFilename` (new, pure, feature-local).** It drops the extension,
turns dots and underscores into spaces, and drops everything from the first
year, quality tag or episode tag onward. It is the client's prefill
counterpart of the importer's `titleGuess`.

**`EpisodeFileRow` (new molecule, `components/`).**

- It is drawn in the File field's filled-row furniture.
- Left to right: an `S` number field (digits, at most 2), an `E` number field
  (digits, at most 3), the episode title field (placeholder _Untitled
  episode_) and the ✕ (`RemoveButton`).
- Under them is the filename in mono, then a children slot for the row's
  Subtitle rows and its _＋ Add subtitle_ picker.
- It is presentational, like `SubtitleRow`.

**`SeriesFormFiles` (new, feature-local, `MovieFormFiles`' shape).** It holds
the _Files_ caption, the Poster File field, an _Episodes_ label beside the
Episode file rows, and _＋ Add episode files_ (a multiple video picker) under
them. There is no backdrop slot.

**Types (`src/types/`).**

- `FormKind = 'movie' | 'series'`
- `EpisodeFormRow { key; file: MovieFormFile; season: string; number: string;
title: string; subtitles: MovieFormSubtitle[] }`. The season and number are
  held as typed strings.

**`createSeries` (feature api).** It builds the multipart body in this order:

1. The series fields: `title`, `year`, `creator`, `cast`×n, `description`,
   `genre`×n, `rating`.
2. The `poster` part.
3. For each row: an `episode` field holding JSON
   `{ season, number, title, subtitleLanguages }`, then its `episodeVideo`
   part, then its `episodeSubtitle` parts.

On a `201` it resolves the `Series`, and on a refusal it rejects as the movie
saves do.

**API contract: `POST /api/series`.**

- The body is `multipart/form-data`, streamed with `busboy`, parts in the
  order above.
- The k-th `episodeVideo` belongs to the k-th `episode` field, and its
  `episodeSubtitle` parts pair with `subtitleLanguages` by order.
- The title and year arrive before any bytes, so the **Series folder** is
  reserved when the first file part needs it.
- Each episode video lands in its `seasonFolder` (`season-NN/`), with its
  subtitles beside it.
- `201 Series`, assembled, on success.
- `400` with one sentence for:
  - no title
  - no episode
  - an `episode` field that isn't `{ season ≥ 1, number ≥ 1 }`
  - a duplicate, spelled through `spellEpisodeTag` (`Duplicate episode:
S01E03`)
  - an `episode` with no video after it
  - a stray `episodeVideo` or `episodeSubtitle`
  - a file `fileKinds` refuses
  - an unknown genre
- Any refusal or failure removes the whole Series folder, and **no row is
  written until every byte has landed**.
- Each episode's runtime is its **Derived runtime**, taken after its copy and
  best-effort, as on import.

**`seriesFormBody` (new, `server/src/routes/`, `movieFormBody`'s
precedent).**

- `collectEpisodeUploads` is the file half. It applies the `fileKinds` checks
  to the poster, videos and subtitles, and pairs parts by order.
- `readSeriesFields` is the field half, with refusals as sentences.

**`yearSpan` (new, pure, `server/src/library/series/`).** It is `readSheet`'s
private `cellYears`, extracted: text → `{ year, endYear }`, reading `2019`,
`2019–2023`, `2019-2023` and `2021–`, and `null` for anything unreadable.
`readSheet` and the series route both read years through it.

**`SeriesWrite.addSeries(input, episodes?)`.** It gains an optional list of
`NewEpisode`, each with its subtitle tracks. The series, its genres, its
episodes and their `episode_subtitles` are written in one transaction, so a
refused insert commits nothing. The importer keeps calling `addSeries(input)`
and then `addEpisode` per episode. There is no schema change and no
migration.

**The video gate on the movie routes.**

- `POST /api/movies` refuses a body with no video part with `400 Body must
carry a video`, the resolve route's sentence. The check runs after the title
  check and before any row is written, and rolls back any file that landed.
- `PATCH /api/movies/:id` refuses a body whose video is neither a part nor a
  non-empty `videoPath`, with the same sentence.
- The form's gate makes both refusals unreachable from the app.

**Entrances.**

- The Settings header's ＋ and the Library group's row are renamed _Add a
  title_. Both still open `/add` on the movie kind.
- The row's description becomes _A movie or a series, with its files._

**Prototype first.** Before phase 2 is built:

- `feat.MovieForm.dc.html` is amended with the Kind tabs, the series wording
  and the series Files card.
- `mol.EpisodeFileRow.dc.html` and `mol.PillTabs.dc.html` are added, the
  latter extracted from `page.LibraryPage`'s track, which then imports it.
- `COMPONENT-SPEC.md` gets the two molecules and the gate rule.
- `feat.SettingsHub` gets _Add a title_.

**Phases** (from the log's plan):

1. **The video gate, for movies.** `titleFromFilename`, the title prefill on a
   video pick, and the two movie routes refusing a body with no video. No
   change to the surface.
2. **A series with its episodes, end to end.** The prototype amendment,
   `PillTabs` with `LibraryTabs` adopting it, the Kind tabs and
   `?kind=series`, the series wording, `SeriesFormFiles`, `EpisodeFileRow`,
   `useEpisodeList`, `readEpisodeTag` with its drift guard, `yearSpan`,
   `seriesFormBody`, `addSeries(input, episodes)`, `POST /api/series` with
   rollback, `createSeries`, the landing on the Series tab, and _Add a title_.
3. **Episode subtitles.** Each row's _＋ Add subtitle_ and Subtitle rows, sent
   as `episodeSubtitle` parts and stored in `episode_subtitles`.

## Testing Decisions

Good tests here assert what a user or a client can observe: what the form
draws and enables, what a press writes to the URL, what goes in the request
body and in what order, what the wire answers, what the database and managed
storage hold afterwards, and what a pure function returns. They don't assert
how a hook stores its state or which helper was called. Every suite below is
written RED first.

**`titleFromFilename`** (pure). It is tested over a table of filenames:

- release-style dots
- underscores
- a year
- a quality tag
- an episode tag
- no extension

Prior art: `titleKey`'s `titleGuess` cases.

**`readEpisodeTag`** (pure). It is tested over the cases the server's
`episodeTag` suite covers. A **drift guard** in the spec project runs the
client's `readEpisodeTag` and the server's `episodeTag` over one shared table
of filenames and asserts they agree on season, number and title. Prior art:
`episodeTag`'s suite, and the structural guards that read across targets.

**`yearSpan`** (pure). It is tested on:

- `2019`
- `2019–2023`
- the hyphen form
- `2021–`
- junk → `null`

`readSheet`'s existing year cases must still pass unchanged. Prior art:
`readSheet`'s suite.

**`PillTabs`.**

- It renders a labelled group of `aria-pressed` buttons, with the current one
  pressed.
- A press calls `onChange` with the option's value.
- Its resolved styles match today's track.

`LibraryTabs`' existing suite still passes. Prior art: `LibraryTabs`' suite and
`resolvedStyle`.

**`EpisodeFileRow`.**

- It draws the numbers, title, filename and ✕.
- The number fields accept digits only, within their lengths.
- Edits and ✕ call back.
- Children render under the filename.

Prior art: `SubtitleRow`'s and `FileField`'s suites.

**`useEpisodeList`.**

- A pick of tagged files lands in tag order, prefilled.
- An untagged file takes the next free number in season 1.
- A second pick appends.
- An edit doesn't re-sort.
- Remove works.
- The per-row subtitle trio works.
- `episodesComplete` is false for: an empty list, a blank number, season 0, a
  duplicate pair.

Prior art: `useMovieForm`'s covered behaviour and the other feature hooks'
`renderHook` suites.

**`MovieForm`** (the organism, through presses).

- The Kind tabs are drawn only on a plain add, and a press writes
  `?kind=series` as a replace.
- `?kind=series` opens the series wording and Files card.
- A switch keeps the shared fields and both kinds' files.
- The title is prefilled from a video or episode pick and never overwrites a
  typed one.
- Save's enabled state follows each kind's gate.
- A series save sends the body in the contract's order and lands on
  `/?tab=series`.
- A refused save keeps everything.
- The Edit job and Import context draw no tabs and ignore `?kind=`.

Prior art: `MovieForm.test.tsx`, `LocationProbe`, `fakeResponse`.

**`createSeries`.** The `FormData` it sends holds the parts in order, and it
handles `201` and refusal. Prior art: `createMovie`'s suite.

**`SeriesWrite.addSeries(input, episodes)`.**

- The series, genres, episodes and subtitle tracks are written together.
- A refused insert (an unknown genre, a duplicate episode) commits nothing.
- `addSeries(input)` alone behaves as before.

Prior art: `write.test.ts`.

**`seriesFormBody`** and **`POST /api/series`** (route suite over a sandbox
media root).

- Happy path: the Series folder, `season-NN/` placement, the rows, the
  runtime and `201 Series`.
- Each `400` sentence.
- After any refusal, no row and no Series folder are left behind.

Prior art: `movieFormBody`'s suite, `routes.series.test.ts`, the movie POST
rollback tests and `fixtureVideo`.

**Movie routes.**

- `POST /api/movies` with no video part → `400 Body must carry a video`,
  nothing written.
- `PATCH` with no video part and an empty `videoPath` → the same.
- A `PATCH` carrying the held path still passes.

Prior art: `routes.test.ts`'s movie form cases.

**Settings entrances.** The header's ＋ and the Library row read _Add a
title_, and the row's line is the new copy. Prior art: `SettingsHeader`'s and
`LibrarySection`'s suites.

## Out of Scope

- Editing a series, deleting a series, or adding episodes to a series already
  held. These need an Edit menu on the series page, which the prototype doesn't
  draw. A new season still joins through Bulk import.
- Series in the Import context. `unplaced` stays Skip-only, and a show with no
  row still imports under its title guess.
- A backdrop slot, a Still slot or an air-date field on the series form.
- A bulk subtitle picker matched by filename stem.
- An upload progress bar. This is a debt shared with the movie form.
- A duplicate-series check. The movie form has none either.
- Specials (season 0).
- Renaming the Movie form, its hook, its page or its feature folder.
- Steps 14–15 of the build order.

## Further Notes

- This closes the gap log 22 Q2 left open: a form for series, flagged then for
  a later prototype amendment. Log 22 Q19 and Q21 stay as they are. They were
  answered "there is no form that can take a series", and the Import context
  doesn't learn series here.
- **Accepted:** a series added twice is two series.
- **Accepted:** a cancelled or failed series save loses nothing on screen, but
  a retry re-sends every byte.
- **Accepted:** a large series is one long request with nothing on screen but
  _Adding…_.
- **Accepted:** the client and server each read the Episode tag, held together
  by a guard over one table rather than by one function. The server imports
  only `src/types/` from `src/`, and moving a function across the build
  targets is a bigger structural change than this feature.
- A duplicate episode number on the form shows only as a closed Save, because
  the prototype designs no error face.
- Per the standing rule, step 13's ✅ in CLAUDE.md and the README waits for the
  refactor.
