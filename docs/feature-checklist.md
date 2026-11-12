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
| Export round trip: an Export gives it all back      | 🔲 Planned |

Everything marked ✅ is done — steps 1–9 of the first build order, ending
with Software update, which shipped as v0.2.0, and steps 10–15, the
Codecs page, Ultrawide margins, the Default poster, Add a series, Library
folders and Export options: the second chain is done too — and steps
16–21, the third chain, from Single-title Sync to Title editing. Steps 10–15 came out of installing
FamilyFlix and using it for real, and are numbered in **build
order**: smallest and most self-contained first, the form before the folders
that will feed it, export last because it mirrors what import now holds. Each
went through grill-me and a prototype revision before it was built.

10. ✅ **Codecs page** — the codec rows moved to their own Settings
    sub-page, `/settings/codecs`, opened from the Playback card's Codecs row.
11. ✅ **Ultrawide margins** — an optional left/right margin on every screen, so
    the library doesn't stretch edge to edge on an ultra-wide monitor.
12. ✅ **Default poster** — a title with no poster linked shows a FamilyFlix
    default poster instead of an empty tile.
13. ✅ **Add a series** — the Add form adds a show, its seasons and its
    episodes, not only a film.
14. ✅ **Library folders** — point FamilyFlix at one or more top folders that
    hold movies, and add everything in them at once.
15. ✅ **Export options** — choose where the export is saved and what it
    carries: the sheet with films, series and episodes, and optionally
    posters, backdrops, stills and subtitles beside it.

Steps 16–21 are the **third chain**, out of using v0.3.0 (design log 32,
its last three steps folded into one by log 38), again smallest first:

16. ✅ **Single-title Sync** — _Fetch from TMDB_ on a movie's ⋯ menu syncs
    that movie alone, rather than reopening a library-wide sync left in review.
17. ✅ **Backdrop veil** — the detail pages' art fills the whole screen under
    an accent-tinted veil, so the title, buttons and text read clearly.
18. ✅ **Open the media folder** — an _Open folder_ button on Settings →
    Storage.
19. ✅ **Export name** — the export folder's name becomes editable beside
    _Save to_.
20. ✅ **Factory reset** — erase every title, watch history and setting and
    empty the media folder, behind an _Erase everything?_ dialog; your own
    folders are never touched.
21. ✅ **Title editing** — a show whose files carry no `S01E01` is imported
    anyway: `Episode 12` is read, and for any other name you type
    `S[01] E[01]` in front of the file (`eps1.0_hellofriend.mov`) without
    renaming it, one review row per show. A series is edited — its details,
    and its episodes renumbered, added or removed — and deleted from the
    series page's ⋯ menu, with confirmation, as a movie is.

Step 22 came after the third chain, out of the open issues from v0.3.0's use
(design log 39):

22. ✅ **Season posters** — a synced series shows each season's own TMDB
    poster on its season card, not just the series' gradient. A Sync already
    asked TMDB for every season and threw the poster away; now it keeps it,
    never replacing one already there, and an export with images on carries
    them too.

Step 23 came after it, out of using the latest release (design log 40):

23. ✅ **Import review** — _Import from spreadsheet_ reads all your library
    folders and a spreadsheet (CSV or Excel) together. New films still import
    as the run goes. For a title already in the library, the sheet fills in
    whatever is empty, and anything it says differently waits in the review
    as _Yours | Spreadsheet_, field by field, the way a TMDB Sync asks —
    nothing you filled in is overwritten without a press. A row two folders
    could match is settled by picking the folder, and a folder the sheet
    doesn't name by one _Import as_ press.

Steps 24–25 came out of importing five real series (3–8 seasons, 8–20
episodes each): the import was slow and doubled the disk space, and the review
listed more than 1,400 rows. Both are done (design logs 41 and 42):

24. ✅ **Link or copy** — Import from spreadsheet and Scan folders offer
    **Link** or **Copy**, **Link by default** (design log 41). A linked title's
    video plays from where it lies in your Library folder, so nothing is
    duplicated and the import is fast; its poster, subtitles and TMDB art are
    still kept in FamilyFlix's own media folder, and Copy keeps today's
    behaviour. The choice is kept per video, so a library already copied keeps
    working beside new linked titles. Deleting a linked title or a Factory
    reset never touches your files, and a Library folder can't be removed
    while titles play from it. A linked title whose drive is unplugged says
    so in the player rather than failing. The Add form still copies: a file
    in a Library folder is added by Scan folders, which links it.
25. ✅ **Review at scale + Season art** — a review never runs to a thousand
    rows (design log 42). A show whose episodes couldn't be copied is one row,
    not one per episode. The Import review groups a title's rows under one
    header with a count, opened on demand; both reviews filter by kind; and
    bulk actions settle many rows in one press (_Skip all_, _Import all as
    guessed_, _Keep all mine_). A Sync finds more of what TMDB holds — it tries
    the title without its year, cleaned of release tags and punctuation, and
    before its subtitle — and _Only what's missing_ comes back to any title
    still unmatched or missing episode or season art. A single-series Sync
    shows a **Seasons** section — each season's current poster beside TMDB's
    choices — so every season can be given art, and the series form takes a
    season poster from a file too.

Step 26 came out of using step 25: a synced library still showed every title
at 0/5 stars, because a Sync stores TMDB's score but never draws it. It is
done (design log 43):

26. ✅ **TMDB ratings** — a switch in Settings → Display, _Fill in ratings
    from TMDB_, **on by default**. While it is on, a title the family hasn't
    rated shows TMDB's score as stars (7.8/10 → 4★, to the nearest half), so a
    synced library no longer reads 0/5 everywhere; setting the stars by hand
    saves the family's own rating, which always wins and is never overwritten
    by a Sync. Off shows the family's ratings alone, as today. Nothing is
    copied between the two — the switch only changes what is drawn — and
    TMDB's stars look different from the family's, so it's clear whose they
    are.

Step 27 came out of using step 26: TMDB has a still for every episode of some
shows and for none of others, so half a season page can be gradients. It is
done (design log 44):

27. ✅ **Episode stills** — when TMDB has no still for an episode, a Sync
    takes one from the episode's own file: a single frame a third of the way
    in, grabbed with the FFmpeg it already ships, stored beside the episode's
    other art and never written into your Library folder. TMDB's still is
    preferred whenever it has one — a later Sync swaps a frame for it — and a
    still you picked by hand in the series form is never replaced. With no
    FFmpeg on the machine the episode keeps its gradient.

Step 28 came out of using v0.7.0: adding one title by hand means typing every
field TMDB already knows. It is done (design log 45):

28. ✅ **Add and sync** — when you add a movie or a series by hand, tick
    _Also fetch metadata and posters from TMDB_ and pick only its files: the
    title comes from the video's name, and once it is saved a Sync for just
    that title starts by itself and fills the synopsis, poster, cast and the
    rest. A match it is unsure of waits in that Sync's review; Back from it
    lands on the title's page.

Step 29 came out of using v0.8.0: some films carry several audio languages,
and the player played whichever came first. It is done (design log 46):

29. ✅ **Audio tracks** — Settings → Playback has an _Audio_ section beside
    Subtitles, where you choose the household's preferred audio language —
    English by default. A film with several audio tracks opens on that
    language when it has it, and the player has an _Audio_ menu beside CC
    (or the `A` key) to switch track mid-film without losing your place, the
    way VLC's _Audio → Audio Track_ does. A language picked there carries on
    to the next episode for the rest of the evening.

Step 30 came out of using v0.8.0 too: there was no one place to see what the
library holds or take a title out of it completely. It is done (design log 47):

30. ✅ **Manage library** — Settings → Library → _Manage library_ lists every
    film and series the library holds, each with where its files are,
    whether it is linked or copied, and whether TMDB filled its details.
    From a row you can edit a title, sync it with TMDB, clear its details
    back to just its title and files, or delete it. A delete takes the
    title out of FamilyFlix with its posters, stills, subtitles and every
    file FamilyFlix keeps for it; a linked title's own files go to the
    Recycle Bin, so nothing is lost for good by accident.

Step 31 is the other half of what step 30 first set out to do: adding a whole
show by hand meant picking its episodes one file at a time. It is done
(design log 48):

31. ✅ **Add a show folder** — in the series form, _＋ Add show folder_ picks
    a show's folder instead of its episodes: FamilyFlix reads it by the same
    rules a folder scan uses and fills in an episode row for every video,
    numbered for you. Both adds now link by default — the video stays where
    it lies — and copy only a file outside every Library folder. The show's
    or film's folder is recorded, so a later scan never adds it twice.

Step 32 came out of a household that mostly watches series: FamilyFlix
always opened on Movies, so every evening began with a press of _Series_. It
is done (design log 49):

32. ✅ **Start on Series**: Settings → Display gains a _Start on_ row, the
    same Movies / Series switch the library draws, choosing which tab
    FamilyFlix opens on. With Series chosen the app opens straight onto the
    Series tab, with nothing of the Movies tab drawn first; until a choice
    is made, or if it can't be read, it opens on Movies as before. Every
    link and Back keeps its own destination: the logo and _Back to library_
    still mean Movies.

Step 33 came out of films that carry two subtitle files, English and Spanish
say, where the player only ever showed one. It is done (design log 50):

33. ✅ **Subtitle picker**: with two or more subtitle files, the player's CC
    button opens a menu: _Off_, then each file by its language, the one
    showing marked. A film with one file keeps the plain on/off button, and
    `C` still turns subtitles on and off. What you last chose carries to the
    next episode for the evening; a film started afresh from the library
    starts with subtitles off.

Step 34 came before the loading states, out of using v0.10.0 for real: the
Settings → Library flows were built one step at a time and never walked end
to end. It is done (design log 51):

34. ✅ **Library audit**: every Library flow was walked live and what broke
    is fixed. A rescan never doubles a title, renamed or not: a video
    FamilyFlix already plays is known wherever it lies. A Delete keeps the
    files unless you ask for the Recycle Bin, and never takes a file another
    title plays. A title taken out stays out of every scan until _Bring back_
    on its Library folder, or until you add it again by hand. `Seizoen 1`,
    `Season 1 (2008)`, release `S01` folders and `Specials` read as seasons,
    and `Aflevering` as an episode. A show folder pick names each episode by
    its path inside the show. Every film is on the home: one with no genre
    sits in _Other movies_ until it has one. A film whose file has gone is
    found again when a scan meets its file, and a poster that won't load
    draws the stand-in.

Step 35 came out of a linked series' Delete that sent a thousand episodes to
a Recycle Bin, which purged them. It is done (design log 52):

35. ✅ **Keep originals**: a Delete never touches a file in a Library folder,
    linked or copied, and there is nothing to choose: the title leaves
    FamilyFlix, its own art and subtitles go, and every video stays where it
    lies, out of every scan until _Bring back_. The Delete dialog is the same
    in the app and in a browser. FamilyFlix's own media folder can't be added
    as a Library folder, so nothing it clears can reach your files.

Step 36 came out of a slow save that sat on a grey button, a Delete that
could be walked away from while it ran, and a cold start that showed
nothing. It is done (design log 53):

36. ✅ **Loading states**: a quick action shows nothing, and a slow one its
    _-ing_ label after a moment, held long enough to read. A Delete or a
    Factory reset can't be dismissed once confirmed, and shows the FF mark
    while it runs; a failed Delete says so. FamilyFlix opens its window at
    once on _Opening your library_, and the library loads over it.

Step 37 came out of adding three films to a library folder: the scan walked
every folder and buried the three in its log, and the Sync after it offered
the whole library. It is done (design log 54):

37. ✅ **Scan new folders**: a Library folder no scan has read says _Not
    scanned yet_ on its row. _Scan new folders_ walks only those, and _Scan
    all folders_ every one, as the scan always has. A run with the TMDB box
    ticked hands on to the Sync with _Just what was added_ chosen: the titles
    that run brought in, and a held show's new episodes, nothing else.

Step 38 came out of the animation drawn for opening FamilyFlix
(`docs/handoff/handoff-welcome-splash/`, option 2a). It is done (design log
55):

38. ✅ **Intro animation**: opening FamilyFlix plays a short welcome of about
    two seconds, in place of the old start-up tile. The two Fs drop in,
    _FamilyFlix_ rises letter by letter, a light sweeps across both, and the
    wordmark glides up into the header as the library fades in underneath.
    Any click or key skips straight to the library. A library not ready by
    the end keeps the mark as its loader until it is; with reduced motion
    the welcome is a plain fade. The tile shows only if the app takes more
    than two seconds to start. The wordmark is never a button, nothing is
    focused when the welcome ends, and _Flix_ stays its plain orange until
    the light reaches it.

Step 39 came out of wanting FamilyFlix on a Steam Deck (SteamOS) as well as
on Windows. It is done (design log 56):

39. ✅ **Linux build**: every release carries an AppImage beside the Windows
    installer, so FamilyFlix runs on SteamOS, whose read-only system rules
    out a `.deb` or a package install. It lives in the home folder, runs in
    Desktop Mode (Game Mode is out of scope), and updates itself as the
    Windows build does: the Deck took v0.14.1 on its own. It carries a Linux
    FFmpeg as its **Default component**, pinned and checked like the Windows
    one, and the release workflow builds it on a Linux runner. Opened once,
    it puts itself in the menu with the FamilyFlix mark. The Deck smoke's
    fixes (issues 519 to 521) let it play a video whose path holds a dot folder,
    launch without `--no-sandbox` through its own menu entry, and log a
    missing Linux update file as one line; the closing round (issue 522)
    spelled its synopsis once and escaped the menu entry's path.

Step 40 came out of the family's first scan on their own PC: a Library folder
on an external drive, `E:\Movies\Movies (2026)`, holding about a hundred
`Title (Year).mp4` files side by side with no folder of their own, found 0
titles. The walk treats a Library folder's top level as a shelf, never a
film, so a video lying loose there is not read (design log 30, Q15 left
it out). The walk keeps that rule. FamilyFlix was to give each loose video
the folder the walk expects; built, it was dropped for a tool of its own:

40. ❌ **Tidy into folders**: dropped on 2026-11-06, after it was built.
    Design log 57, its PRD (issue 523) and its plan stand as the record; the
    build (issues 524 to 530) was reverted whole. Moving files inside a Library
    folder is not FamilyFlix's job: a separate tool, outside FamilyFlix, gets a
    folder of bare files into the shape the walk expects, and FamilyFlix goes
    back to never moving a file it doesn't own. The walk's rule stands: a
    video lying loose at a Library folder's top level is not read.

Step 41 came out of the family's folders carrying their subtitles and art in
subfolders the scan never opens: a `Subtitles/` folder beside the video, a
folder per episode inside it, and the art apart in its own folder. The scan
reads only the files lying directly in a Source folder, so those subtitles
were never found, and an Export's own `subtitles/` folder did not come back
in either. Settled in a grill-me on 2026-11-08, it is done (design log 58,
handoff `docs/handoff/handoff-folder-layout/`):

41. ✅ **Folder layout**: every title folder in a Library folder has one
    layout, which the scan reads, the Layout fill and an Export write, and
    nothing else is read. The old shapes (genre shelves, Collection folders,
    loose shows, art and subtitles loose beside the video) are no longer
    read: FamilyFlix is before v1.0.0, a title already held from one keeps
    playing, and converting an existing library is left to a separate tool,
    as step 40's tidy was. Built in issues 534 to 544; the closing round
    (issue 545) spelled the layout's names and its two shared rules once, in
    `media/`, and had the composition root make every writer.
    - **Title folders** sit directly in a Library folder's root, named
      `Title (Year)` always, a series by its first year (`Severance (2022)`).
      Four Star Wars films are four folders in the root, and two films
      sharing a title differ by year. A folder holding one video loose is a
      film; one holding Season folders and no loose video is a series.
    - **A film**: its one video loose (a second is a Problem; extras go in
      an `Extras/` folder, which is not read), its subtitles loose in
      `Subtitles/`, its poster and backdrop loose in `Images/`. A film has
      no Stills.
    - **A series**: `Images/` at its root for its own poster and backdrop;
      one `Season 01` folder per season (`Season 00` the specials) holding
      its episode videos, numbered by their Episode tags, an `Images/` with
      the Season poster loose and the episodes' Stills in `Images/Stills/`,
      and a `Subtitles/` with one `S01E01` folder per episode holding its
      tracks.
    - **Images by role**: a file is the poster or backdrop when its name ends
      in `poster` or `backdrop` (`moviea-2012-poster.jpg`), so names may
      carry the title and year. A subtitle's language is read off its name.
    - **One sheet**: a single table of 22 columns, one row per Movie,
      Series, Season and Episode, each with its `Type` and its `Folder` (the
      title folder's name, which a row is matched by), a cell blank where it
      does not apply; image, subtitle and video cells are relative paths into
      the layout. It replaces the Titles and Episodes sheets in CSV and xlsx
      alike, and Bulk import reads all of it, episodes included.
    - **`Meta/`**: each Library folder's root carries that sheet as
      `Meta/familyflix-library.csv`, owned by FamilyFlix and rewritten a few
      seconds after any change to one of its cells, held while a review is
      open, and never touched by a Factory reset. A scan reads it, so the
      folder rebuilds its library offline, ratings, hearts and Status
      included. This is the one place FamilyFlix replaces a file inside a
      Library folder.
    - **Library sheet writer**: every change to the library touches the
      Library folders it concerns, and each touched folder's sheet is
      rewritten through a temporary file and a rename; an Unreachable or
      unlisted folder is skipped, and shutdown flushes what is pending.
    - **Layout fill**: after an add or an edit from the Movie form and after
      each title's Sync, FamilyFlix writes into the title folder each
      poster, backdrop, Season poster, Still and subtitle it holds whose
      place is empty: never replacing a file, never a frame still, a second
      track of one language as `<Language> (2)`. Each file written is a
      `↓` line in the Sync's log; a folder it can't write is one Warning
      line and the save still succeeds. A title with no title folder gets
      nothing. The Sync's two Write target toggles and its
      `familyflix-metadata.csv` are gone: _Where it is saved_ draws _Your
      library_ and _Your library folders_, both always. Running the fill
      after a Bulk import or a scan's import is not wired yet.
    - **Export**: an Export folder is the same layout less the videos, its
      sheet `Meta/familyflix-library` in the chosen format, so its folders
      copied over a Library folder of videos scan back whole.
    - **Left out**: a root entry that isn't in the layout is one Layout
      warning in the scan's log, never a Problem: _isn't named Title
      (Year)_, _holds no video or Season folder_, or _holds loose videos and
      Season folders_, and one line for the root's loose videos. `Meta/`,
      an Export folder and system folders pass in silence.
    - **Unchanged**: the Managed media directory keeps its own internal
      layout; the layout is for Library folders and Export folders only.
      The dev fixtures (`createImporter/fixture/` and `seriesFixture/`) move
      to the new layout; `db:seed-series` writes no folders, so it stays.

Step 42 came out of the end-to-end QA pass after step 41: a Factory reset
rebuilt by a scan gave back series with no art and titles without their TMDB
match, hearts and episode Status, and the sheet rewritten when the scan closed
erased what it had skipped. Settled in a grill-me on 2026-11-09, it is done
(design log 59, handoff `docs/handoff/handoff-rebuild-whole/`, which keeps the
QA ticket):

42. ✅ **Rebuild whole**: a Library folder gives its whole library back. A
    scan imports a series' poster, backdrop, Season posters and Stills from
    its Title folder, and a rescan fills them in for a series already held
    without them. Every sheet column is read: a title comes back with its
    TMDB match and score, its heart and each episode's Watched, so it needs
    no second Sync, and a sheet written, reset and scanned back is the same
    sheet byte for byte, the **Round trip**. Built in issues 548 to 560; the
    closing round (issue 561) gave each rule the build had spelled twice one
    home: one Watched rule (`marksWatched`), one path cell resolver
    (`resolvePathCell`), the Video cell in `exportRows`.
    - **Path cells**: the sheet's path cells name the files the folder
      really holds, as `readTitleFolder` reads them, an episode's video as
      it lies. A path cell fills a place the folder's read left empty.
    - **One reader of a show**: a show folder picked in the form reads
      exactly as the scan reads it, by `numberShow`; a title folder whose
      seasons hold no video is one warning line, and so is an **Orphaned
      row**, a sheet row whose folder is gone.
    - **Layout fill**: a scan fills each title folder's empty art places, as
      a save does.
    - **The sheet kept**: a folder FamilyFlix has not scanned yet never has
      its sheet rewritten, so adding it back after a Factory reset can't
      erase the sheet that will rebuild it; every scan rewrites the sheets it
      read when one fell behind, and equal bytes are never written.

Step 43 came out of the second end-to-end QA pass, after step 42: the round
trip held, and its edges did not. A sheet's path cell could reach outside its
title's folder, a sheet resaved by a Dutch Excel was lost and then
overwritten, and a held film never took art put into its folder later.
Settled in a grill-me on 2026-11-10, it is done (design log 60, handoff
`docs/handoff/handoff-rebuild-edges/`, which keeps the QA ticket):

43. ✅ **Rebuild edges**: a hand-kept sheet and a growing folder reach the
    library whole and safely. Built in issues 564 to 577; the closing round
    (issue 579) gave each concept the build had spelled twice one home: the
    Sheet dialect's separator and BOM in `sheetDialect`, the reader's cell
    checks beside its other cell rules, one fill per held place in
    `fillHeldFiles`.
    - **Contained path cells**: a path cell is read only when it lies inside
      its own row's Title folder (its first segment the row's Folder key, in
      any casing, and no empty, `.` or `..` segment, `\` or `:`) and names
      its kind (an image for Poster, Backdrop and Still, a subtitle for each
      Subtitles path); any other is an **Unread cell**. Both _Import from
      spreadsheet_ and the Folder scan read by the same rule, so the Ronin
      repro copies nothing and writes nothing.
    - **The Sheet dialect**: a sheet saved by any Excel reads back, UTF-8 or
      cp1252, `,` or `;`, decimal comma or point (`sheetDialect` reads it off
      the bytes), and the Library sheet is rewritten in the separator it was
      found in, always UTF-8 behind a BOM; a new sheet and every Export are
      `,`. A sheet that still doesn't read is never replaced, and the scan
      logs that it scanned without it and left it as it is.
    - **Unread cells**: every filled cell the reader can't take (a rating of
      `8½` or `11`, a Status of `half`, a Favorite of `ja`, an unknown Type,
      a path outside its folder) is one Warning line in both runs before the
      rewrite on close erases it; two rows for one title read the first, and
      say so. An Episode row's Synopsis is an Unread cell, and the written
      sheet keeps the column blank on Episode rows.
    - **Held files**: a held film takes the poster, backdrop and tracks put
      into its folder later, as a held series does (`fillHeldFiles`), never
      replacing what it has and adding no review row; a track of a language
      it already holds is never added. A held series takes its files after
      the run's new episodes, so a season the run adds takes its Season
      poster on that run. A held title's `✓ Updated` line names the files it
      took beside its Sheet fills.
    - **Track languages**: `Nederlands.srt`, `Español.srt` and
      `heat.pt-BR.srt` read as their languages, from the seven pool names
      only.
    - **The rest**: a series add refuses an episode video another title
      plays, as a movie add does, through one `heldVideoRefusal`; both sheets
      write every row as wide as their header, so each Library sheet is
      rewritten once at its next touch and then stays still.

Step 44 came out of the third end-to-end QA pass, after step 43: the Library
sheet's round trip held, and the Export's did not. An Export named each Title
folder after its title, so a renamed title never came back from it, and an
older Export uploaded after a Factory reset erased the newer `Meta/` sheet.
Settled in a grill-me on 2026-11-12 (design log 61, handoff
`docs/handoff/handoff-export-round-trip/`, which keeps the QA ticket):

44. 🔜 **Export round trip**: an Export gives the library back whole,
    uploaded after a Factory reset or copied over a Library folder of videos,
    and never erases a newer record. Built in issues 582 to 588; the refactor
    is still to come.
    - **Folder keys by Source folder**: an Export names each title's Title
      folder and `Folder` cell as the Library sheet does, by its Source folder
      (`sourceFoldersOf`, the one rule for both), while its `Title` cell keeps
      the library's title, so a title renamed in the app or by a Sync comes
      back from it. A title in no Library folder is still spelled
      `Title (Year)`. The Export round trip test beside the Round trip takes
      the Amélie repro back whole both ways: uploaded after a Factory reset,
      and copied over a folder of bare videos and scanned.
    - **The folder's own sheet first**: an upload into a Library folder never
      scanned places it by its own `Meta/` sheet first, by the Folder scan's
      own per-folder step (`placeFolder`), so the upload meets its titles as
      held ones: a blank cell is a Sheet fill, and each cell the two sheets
      disagree on waits in review as _Yours | Spreadsheet_. The Heat repro
      keeps its 9 and its heart, and the `Meta/` sheet is not rewritten to 5.
      Still one run, one complete line, one review.
    - **Doubled places**: a Title folder holding two posters, backdrops,
      Season posters, Stills for one episode or tracks of one language reads
      the first by name order and says so in one Layout warning line,
      `⚠ Heat (1995) holds 2 posters, heat-1995-POSTER.png read`; a title
      never holds two tracks of one language, and the Library sheet's path
      cell names the file read.
    - **The rest**: Folder keys compare folded, NFC then case
      (`foldFolderKey`), in the scan, the sheet reader's duplicate rows and
      the Export's numbering, so a folder copied from a Mac matches its sheet,
      and a path cell typed NFC reaches the NFD folder's files; _Play_ on a
      show with specials offers the next regular episode, a special only when
      part-watched or when the show holds nothing but specials.
