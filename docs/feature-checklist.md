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
| Poster pick: a chosen season poster always lands    | ⬜ Planned |

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

Step 57 came out of a single-series Sync in real use. On the Death Note
series page, the Sync's review offered each season a row of TMDB posters,
but pressing one set nothing: the held tile kept reading _No poster yet_,
however many times a poster was pressed. Confirmed on 2026-11-24 against a
linked show: a show added through the **Show folder pick** with no art of
its own is recorded with no **Media folder** (a linked video names none),
so the Sync stores no art for it and quietly skips each season poster, and
a **Season choice** answers `404` _No sync holds that season._, which the
page swallows. Grilled in design log 75, which settles the open questions:
no migration (a held library's folder-less titles get one at their next
Sync, the **Late reserve**), a refused pick draws a **Poster refusal** line
on the season's card and no snackbar, a movie added the same way has the
same gap and the same fix, and the prototype gains that one line:

57. ⬜ **Poster pick**: a chosen season poster always lands, on a linked
    show too.
    - **A folder when art needs one**: a series with no **Media folder**
      gets one reserved the first time a Sync or a Season choice stores
      art for it, as the series edit already does, and keeps it from then
      on. Its videos stay linked where they lie.
    - **The whole Sync, not only the pick**: the same gap drops the series
      poster, the backdrop, each season poster and each still for such a
      show, so the fix covers every image a Sync writes.
    - **A refused pick says so**: today a refused **Season choice** leaves
      the page as it was, without a word; it should show that the poster
      was not saved.
    - **Open**: whether a held library's folder-less series get a folder
      by migration or only on their next Sync; what a refused pick shows
      (a snackbar the prototype draws, or a line on the season's card);
      whether a movie added the same way has the same gap; the prototype
      amendment.
