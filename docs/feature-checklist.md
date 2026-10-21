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
| Start on Series — open FamilyFlix on the Series tab | 🔜 Planned |
| Subtitle picker — choose a track in the player      | 🔜 Planned |
| Loading states — spinners and an FF loading overlay | 🔜 Planned |
| Scan new folders — and sync only what a run added   | 🔜 Planned |

Everything marked ✅ is done — steps 1–9 of the first build order, ending
with Software update, which shipped as v0.2.0, and steps 10–15, the
Codecs page, Ultrawide margins, the Default poster, Add a series, Library
folders and Export options: the second chain is done too — and steps
16–21, the third chain, from Single-title Sync to Title editing. Steps 10–15 came out of installing
FamilyFlix and using it for real, and are numbered in **build
order**: smallest and most self-contained first, the form before the folders
that will feed it, export last because it mirrors what import now holds. Each
went through grill-me and a prototype revision before it was built.
_Change…_ in Settings → Storage is not in the chain — it is the Roadmap's
**Move the media folder**.

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
