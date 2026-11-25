# Feature Checklist

Every feature FamilyFlix has shipped or plans, in build order. The [README](../README.md) links here.

| Feature                                             | Status     |
| --------------------------------------------------- | ---------- |
| Nx + Vite + React workspace scaffold                | ✅ Done    |
| Claude Design handoff prototype                     | ✅ Done    |
| Library core (movie model, SQLite, repository)      | ✅ Done    |
| Browse grid — genre rows                            | ✅ Done    |
| Card carousel — prev/next arrows, 15-per-row cap    | ✅ Done    |
| Movie detail page (synopsis, director, cast)        | ✅ Done    |
| Search + filter (title, genre, rating)              | ✅ Done    |
| Genre page — every movie in one genre, uncapped     | ✅ Done    |
| Sort (recent, A–Z, year, rating, unwatched)         | ✅ Done    |
| Ratings — 5-star display + half-star picker         | ✅ Done    |
| Favorites — mark + dedicated row                    | ✅ Done    |
| Continue Watching row                               | ✅ Done    |
| Built-in video player (playback, subtitles)         | ✅ Done    |
| Watch tracking (watched / in-progress / resume)     | ✅ Done    |
| Add Movie — manual file picker                      | ✅ Done    |
| Edit a movie — amend metadata and files             | ✅ Done    |
| Delete a movie — from the ⋯ menu, with confirmation | ✅ Done    |
| Bulk import (Excel/CSV → library)                   | ✅ Done    |
| Import progress console (scan/import, live log)     | ✅ Done    |
| Export (library → CSV/Excel)                        | ✅ Done    |
| Settings hub (six groups, Library to About)         | ✅ Done    |
| Codec manager — view installed codecs               | ✅ Done    |
| Codec manager — add a playback component            | ✅ Done    |
| Subtitle preferences (preferred language)           | ✅ Done    |
| Storage (media folder location, space used)         | ✅ Done    |
| Snackbar system (info / success / warning / error)  | ✅ Done    |
| Back-to-top FAB                                     | ✅ Done    |
| Back navigation — one Back rule on every screen     | ✅ Done    |
| Motion & interaction states (hover / press / focus) | ✅ Done    |
| Series (TV) — tab, series page, seasons, episodes   | ✅ Done    |
| Enrichment — TMDB metadata & posters sync           | ✅ Done    |
| Network group — the TMDB key and the sync row       | ✅ Done    |
| Electron desktop shell                              | ✅ Done    |
| Desktop packaging (Windows installer)               | ✅ Done    |
| Software update (check / install)                   | ✅ Done    |
| Codecs page — the codec list on its own page        | ✅ Done    |
| Ultrawide margins — side gutters for wide screens   | ✅ Done    |
| Default poster — a fallback for titles without one  | ✅ Done    |
| Add a series — the Add form for shows too           | ✅ Done    |
| Library folders — several root folders at once      | ✅ Done    |
| Export options — where to, and what travels         | ✅ Done    |
| Single-title Sync — the ⋯ menu's fetch, one movie   | ✅ Done    |
| Backdrop veil — full-screen art, accent-veiled      | ✅ Done    |
| Open the media folder from Settings → Storage       | ✅ Done    |
| Export name — the export folder's name as a field   | ✅ Done    |
| Factory reset — erase everything, behind a dialog   | ✅ Done    |
| Title editing — number, edit and delete a series    | ✅ Done    |
| Season posters — TMDB art on each season card       | ✅ Done    |
| Import review — folders + sheet, adjustments listed | ✅ Done    |
| Link or copy — import without a second copy         | ✅ Done    |
| Review at scale + Season art — grouped review       | ✅ Done    |
| TMDB ratings — fetched stars until the family rates | ✅ Done    |
| Episode stills — a frame from the file, as fallback | ✅ Done    |
| Add and sync — add by files, TMDB fills the rest    | ✅ Done    |
| Audio tracks — English by default, switch in player | ✅ Done    |
| Manage library — every title, edit, clear, delete   | ✅ Done    |
| Add a show folder — a show by its folder, numbered  | ✅ Done    |
| Start on Series — open FamilyFlix on the Series tab | ✅ Done    |
| Subtitle picker — choose a track in the player      | ✅ Done    |
| Library audit: every Library flow, tested live      | ✅ Done    |
| Keep originals: a Delete never touches your files   | ✅ Done    |
| Loading states: the FF mark while an action runs    | ✅ Done    |
| Scan new folders: and sync only what a run added    | ✅ Done    |
| Intro animation: the FF mark opens FamilyFlix       | ✅ Done    |
| Linux build: FamilyFlix on SteamOS, as an AppImage  | ✅ Done    |
| Tidy into folders: each loose video its own folder  | ❌ Dropped |
| Folder layout: one shape to scan, sync and export   | ✅ Done    |
| Rebuild whole: every sheet field and series art     | ✅ Done    |
| Rebuild edges: hand-kept sheets, growing folders    | ✅ Done    |
| Export round trip: an Export gives it all back      | ✅ Done    |
| Welcome tune: a tune in sync with the intro         | ✅ Done    |
| Row view: genre rows or one grid, Movies and Series | ✅ Done    |
| Rescan a folder: a year and `Season 1` optional     | ✅ Done    |
| Show folder title: a pick reads its Folder key      | ✅ Done    |
| Missing videos: a held title whose file is gone     | ✅ Done    |
| Export paths: a nested Export imports back whole    | ✅ Done    |
| Silent waits: every press shows it is working       | ✅ Done    |
| Video quality: a 4K to SD tag on every poster       | ✅ Done    |
| Busy overlay: no loader moves what is around it     | ✅ Done    |
| Seamless art: the backdrop lands with the page      | ✅ Done    |
| Header fit: every filter pill and Settings in reach | ✅ Done    |
| Sheet in sight: `_meta/` on top, and said aloud     | ✅ Done    |
| Poster pick: a chosen season poster always lands    | ✅ Done    |
| Whole add: a title by hand, with all its art        | ⬜ Planned |

Steps 1 to 9 are the first build order, ending with Software update, which
shipped as v0.2.0. From step 10 on, each step came out of using FamilyFlix
for real and went through a grill-me before it was built. Its design log
holds the decisions, its PRD and plan the scope, and `dev-journal.md` the
build and its walk. A step keeps a full description here only until it is
grilled; once it ships, it is one line and a link.

10. ✅ **Codecs page**: the codec list on its own Settings page ([log 26](design-logs/26-codecs-page.md)).
11. ✅ **Ultrawide margins**: side gutters for wide screens ([log 27](design-logs/27-ultrawide-margins.md)).
12. ✅ **Default poster**: a fallback for titles without one ([log 28](design-logs/28-default-poster.md)).
13. ✅ **Add a series**: the Add form for shows too ([log 29](design-logs/29-add-series.md)).
14. ✅ **Library folders**: several root folders at once ([log 30](design-logs/30-library-folders.md)).
15. ✅ **Export options**: where to, and what travels ([log 31](design-logs/31-export-options.md)).
16. ✅ **Single-title Sync**: the ⋯ menu's fetch, one movie ([log 33](design-logs/33-single-title-sync.md); the third chain, [log 32](design-logs/32-third-chain.md)).
17. ✅ **Backdrop veil**: full-screen art under an accent veil ([log 34](design-logs/34-backdrop-veil.md)).
18. ✅ **Open the media folder**: from Settings → Storage ([log 35](design-logs/35-open-media-folder.md)).
19. ✅ **Export name**: the export folder's name as a field ([log 36](design-logs/36-export-name.md)).
20. ✅ **Factory reset**: erase everything, behind a dialog ([log 37](design-logs/37-factory-reset.md)).
21. ✅ **Title editing**: number, edit and delete a series ([log 38](design-logs/38-title-editing.md)).
22. ✅ **Season posters**: TMDB art on each season card ([log 39](design-logs/39-season-posters.md)).
23. ✅ **Import review**: folders and sheet, adjustments listed ([log 40](design-logs/40-import-review.md)).
24. ✅ **Link or copy**: import without a second copy ([log 41](design-logs/41-link-or-copy.md)).
25. ✅ **Review at scale + Season art**: a grouped review ([log 42](design-logs/42-review-at-scale.md)).
26. ✅ **TMDB ratings**: fetched stars until the family rates ([log 43](design-logs/43-tmdb-ratings.md)).
27. ✅ **Episode stills**: a frame from the file, as fallback ([log 44](design-logs/44-episode-stills.md)).
28. ✅ **Add and sync**: add by files, TMDB fills the rest ([log 45](design-logs/45-add-and-sync.md)).
29. ✅ **Audio tracks**: English by default, switch in the player ([log 46](design-logs/46-audio-tracks.md)).
30. ✅ **Manage library**: every title, edit, clear, delete ([log 47](design-logs/47-manage-library.md)).
31. ✅ **Add a show folder**: a show by its folder, numbered ([log 48](design-logs/48-add-a-show-folder.md)).
32. ✅ **Start on Series**: open FamilyFlix on the Series tab ([log 49](design-logs/49-start-on-series.md)).
33. ✅ **Subtitle picker**: choose a track in the player ([log 50](design-logs/50-subtitle-picker.md)).
34. ✅ **Library audit**: every Library flow, tested live ([log 51](design-logs/51-library-audit.md)).
35. ✅ **Keep originals**: a Delete never touches your files ([log 52](design-logs/52-keep-originals.md)).
36. ✅ **Loading states**: the FF mark while an action runs ([log 53](design-logs/53-loading-states.md)).
37. ✅ **Scan new folders**: and sync only what a run added ([log 54](design-logs/54-scan-new-folders.md)).
38. ✅ **Intro animation**: the FF mark opens FamilyFlix ([log 55](design-logs/55-intro-animation.md)).
39. ✅ **Linux build**: FamilyFlix on SteamOS, as an AppImage ([log 56](design-logs/56-linux-build.md)).
40. ❌ **Tidy into folders**: dropped on 2026-11-06, after it was built and
    reverted whole (issues 524 to 530). Moving files inside a Library folder
    is not FamilyFlix's job; a separate tool does it, and a video loose at a
    Library folder's top level is still not read ([log 57](design-logs/57-tidy-into-folders.md)).
41. ✅ **Folder layout**: one shape to scan, sync and export ([log 58](design-logs/58-folder-layout.md)).
42. ✅ **Rebuild whole**: every sheet field and series art ([log 59](design-logs/59-rebuild-whole.md)).
43. ✅ **Rebuild edges**: hand-kept sheets, growing folders ([log 60](design-logs/60-rebuild-edges.md)).
44. ✅ **Export round trip**: an Export gives it all back ([log 61](design-logs/61-export-round-trip.md)).
45. ✅ **Welcome tune**: a tune in sync with the intro ([log 62](design-logs/62-welcome-tune.md)).
46. ✅ **Row view**: genre rows or one grid, Movies and Series ([log 63](design-logs/63-row-view.md)).
47. ✅ **Rescan a folder**: a year and `Season 1` optional ([log 64](design-logs/64-rescan-a-folder.md)).
48. ✅ **Show folder title**: a pick reads its Folder key ([log 65](design-logs/65-show-folder-title.md)).
49. ✅ **Missing videos**: a held title whose file is gone ([log 66](design-logs/66-missing-videos.md)).
50. ✅ **Export paths**: a nested Export imports back whole ([log 67](design-logs/67-export-paths.md), [log 68](design-logs/68-resolve-cells.md)).
51. ✅ **Silent waits**: every press shows it is working ([log 69](design-logs/69-silent-waits.md)).
52. ✅ **Video quality**: a 4K to SD tag on every poster ([log 70](design-logs/70-video-quality.md)).
53. ✅ **Busy overlay**: no loader moves what is around it ([log 71](design-logs/71-busy-overlay.md)).
54. ✅ **Seamless art**: the backdrop lands with the page ([log 72](design-logs/72-seamless-art.md)).
55. ✅ **Header fit**: every filter pill and Settings in reach ([log 73](design-logs/73-header-fit.md)).
56. ✅ **Sheet in sight**: `_meta/` heads the folder, and the sheet is said aloud ([log 74](design-logs/74-sheet-in-sight.md)).
57. ✅ **Poster pick**: a synced title's art always lands, and a refused season poster says so ([log 75](design-logs/75-poster-pick.md)).

Step 58 came out of a walk through **Add a title** with a whole show in hand
on 2026-11-24. The show is `The Show (2019)\` in the **Folder layout**: a
poster and a backdrop in `Images\`, and four **Season folders** of twelve
episodes, each with its own `Images\poster.jpg` and a `Subtitles\S01E01\`
folder per episode, and no Stills. A **Folder scan** reads all of it, but
the maintainer won't always have that route: their Library folders may be
just _Movies_ and _Series_, and they would rather add one show by hand than
list a third folder for it. Or they have no TMDB key, so nothing is ever
synced and the add form is the only way art and details get in. Either
way, adding a title by hand should give the same complete title a scan
gives. Confirmed against the code on 2026-11-24:

- **The Show folder pick keeps only the episodes.** `readShowFolder` reads
  the Season folders by the scan's own reader, but passes the show's poster
  and backdrop as `null` and drops each **Season poster** `readSeasonFolder`
  found, so only the 48 episode rows and their subtitles reach the form.
  The maintainer then opens five file dialogs for files in the folder they
  just picked (the poster and four Season posters), and the backdrop can't
  be added at all.
- **Neither form has a Backdrop slot.** Log 11 left it out ("the form does
  not collect one", `routes/index.ts`); since then only a **Sync** or a
  scan fills `backdrop_path`. The server half is there: the column, and the
  **Layout fill**, which writes a backdrop into `Images\`.
- **No Stills without a Sync.** A **Frame still** is only taken inside a
  Sync (log 44), so a show added by hand with no TMDB key, or one TMDB
  doesn't know, never gets a Still. Saving takes none.
- **A plain movie add reads nothing beside its video.** Picking a video in
  a **Title folder** doesn't fill the Poster or the Subtitles from that
  folder's `Images\` and `Subtitles\`; only Resolve's **Found files** read
  a folder.
- **In a browser it is roughly 57 dialogs**: four episode picks, 48
  subtitle picks one row at a time, a poster and four Season posters, and
  still no backdrop.
- **_What the scanner accepts_ is out of date** (`FolderShapes`, drawn by
  Import setup and Library folders → Scan). Three of its lines say what
  log 58 stopped doing: `subs.en.srt` beside the video isn't read (tracks
  are read from `Subtitles\` only); loose episodes at a show's root aren't
  read (one video is a film, more is the _more than one video_ Problem);
  and the season comes only from the Season folder, while the filename
  gives only the episode number. It also never mentions `Images\`.

Grilled in design log 76, which settles the open questions: a Frame
still is taken after the save answers, in the background (the **Frame
fill**), and a linked show's Frame stills stay in its Series folder, as
the Layout fill has always left them; a pick's art is copied in, as all
art is; a movie pick in a Title folder holding two videos fills its art
with no **Found-file choice**; and the prototype gains the Backdrop slot
and the rewritten block, through the handoff until the last phase:

58. 🔜 **Whole add**: a title added by hand fills every place of the Folder
    layout, movie and series, with or without TMDB.
    - **A Backdrop slot** under Poster on the movie form and the series
      form, on add and on edit (never a Resolve), stored as `backdrop_path`
      and written to `Images\` by the **Layout fill**. Emptied on an edit,
      its file goes on save.
    - **The Show folder pick takes the show whole, with its art**: its
      **Folder art** (the show's Poster and Backdrop, each **Season
      poster** and each episode's **Still**) fills those slots as **Found
      files** along with the episodes and their tracks. A slot picked by
      hand stays, a second pick replaces only the first's, and the Show
      folder row's ✕ takes back every slot still holding it.
    - **The same for a film**: a video picked on a shell add is read by the
      **Film folder read** (`GET /api/film-folder`), and when its folder
      reads as a film holding it (two videos included, with no **Found-file
      choice**) its Poster, Backdrop and tracks fill the form by the same
      rule; the video's ✕ takes them back. A video in a Season folder reads
      none.
    - **Found art is copied in, never linked**, a linked title's too: both
      adds take it as absolute paths, refused when not absolute or not an
      image, and copy it into the title's Media folder.
    - **Stills without a Sync**: once a series add or edit answers, the
      **Frame fill** takes a **Frame still** for each episode holding no
      Still, in the background, one take at a time, through the **Late
      reserve** and by the one `takeFrameStill` the Sync uses, so a show
      added with no TMDB key still gets its Stills. A linked show's stay in
      its Series folder; nothing is drawn while it runs.
    - **_What the scanner accepts_, rewritten** to the layout as log 58
      reads it, on Import setup and Library folders → Scan: a movie and a
      series example side by side (`Heat (1995)\` with its video, `Images\`
      and `Subtitles\`; a show with `Images\` and `Season 01\` holding its
      episodes and `Subtitles\S01E01\`), the rules in a few lines, and the
      `_meta` sentence kept as it stands. The handoff prototype carries the
      Backdrop slot and the block.
