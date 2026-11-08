# Folder layout: handoff

Step 41, design log `docs/design-logs/58-folder-layout.md`. The layout has no
screen of its own, so this handoff is the shape on disk, drawn as trees, and
the two screens whose copy it changes. Where this README and the log differ,
the log rules.

The prototype amendments are made in place, not in a `prototype/` copy:

1. `feat.EnrichmentFlow.dc.html`: _Where it is saved_ loses its two toggles
   (_Metadata sheet in the collection root_, _Posters into each movie
   folder_) and draws _Your library_ (_Required_) and _Your library folders_
   (_Always_), with the note under the card always drawn.
2. `feat.ExportModal.dc.html`: the _Images_ and _Subtitles_ descriptions say
   where each lands in the layout.
3. `FamilyFlix.dc.html`: the model drops `enWriteSheet`, `enWritePosters` and
   their toggles; `layoutPath` replaces `sheetPath` and `posterPathExample`.

No screenshots were taken: no browser was available to the session.

## A Library folder

```text
E:\Movies\                         a Library folder
  Meta\
    familyflix-library.csv         the Library sheet, FamilyFlix's own
  Heat (1995)\                     a film: one video loose
    Heat.1995.1080p.mkv
    Images\
      heat-1995-poster.jpg         ends in "poster": the poster
      backdrop.jpg                 ends in "backdrop": the backdrop
    Subtitles\
      English.srt                  language read off the name
      heat.pt.srt
    Extras\                        not read
  Severance (2022)\                a series: Season folders, no loose video
    Images\
      poster.jpg
      backdrop.jpg
    Season 01\
      Severance.S01E01.Good.News.About.Hell.mkv
      Severance.S01E02.Half.Loop.mkv
      Images\
        poster.jpg                 the Season poster
        Stills\
          S01E01.jpg               a Still, by its Episode tag
      Subtitles\
        S01E01\
          English.srt
          Dutch.srt
        S01E02\
          English.srt
    Season 00\                     the specials
```

## What the scan says about the rest

One Warning line per root entry left out, never a Problem:

| On disk                                    | Log line                                                             |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `Drama\Amelie (2001)\`                     | `⚠ Drama isn't named Title (Year), left out`                         |
| `Heat (1995)\` with no video               | `⚠ Heat (1995) holds no video or Season folder, left out`            |
| `Severance (2022)\` with a loose `.mkv`    | `⚠ Severance (2022) holds loose videos and Season folders, left out` |
| 98 `.mp4` files lying in `E:\Movies\`      | `⚠ 98 videos lie loose at the top of E:\Movies, left out`            |
| `Meta\`, an Export folder, `$RECYCLE.BIN\` | nothing                                                              |

## An Export folder

The same layout less the videos. The sheet is always `familyflix-library`;
the **Export name** names only the folder.

```text
D:\Backups\familyflix-collection_08-11-2026\
  Meta\
    familyflix-library.xlsx        one worksheet, "Library"
  Heat (1995)\
    Images\
      poster.jpg
      backdrop.jpg
    Subtitles\
      English.srt
  Severance (2022)\
    Images\
      poster.jpg
    Season 01\
      Images\
        poster.jpg
        Stills\
          S01E01.jpg
      Subtitles\
        S01E01\
          English.srt
```

## The one sheet

Every row has a `Type` and a `Folder`; a cell is blank where the type has no
such field. Paths are relative to the root holding the title folder, with
forward slashes; subtitle paths are joined by `|`.

| Type    | Folder           | Season | Episode | Title                | Year  | Rating | Status  | Video                                              | Poster                                       |
| ------- | ---------------- | ------ | ------- | -------------------- | ----- | ------ | ------- | -------------------------------------------------- | -------------------------------------------- |
| Movie   | Heat (1995)      |        |         | Heat                 | 1995  | 9      | Watched | Heat (1995)/Heat.1995.1080p.mkv                    | Heat (1995)/Images/heat-1995-poster.jpg      |
| Series  | Severance (2022) |        |         | Severance            | 2022– | 8      |         |                                                    | Severance (2022)/Images/poster.jpg           |
| Season  | Severance (2022) | 1      |         |                      |       |        |         |                                                    | Severance (2022)/Season 01/Images/poster.jpg |
| Episode | Severance (2022) | 1      | 1       | Good News About Hell |       |        | Watched | Severance (2022)/Season 01/Severance.S01E01....mkv |                                              |

The full column list and each type's cells are in log 58, Q13.

## Copy

| Where                                 | Text                                                                                                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sync, _Where it is saved_, second row | **Your library folders**, mono `E:\Movies\<title folder>\Images` (several folders: `<title folder>\Images in each library folder`), badge _Always_                                          |
| Sync, the note under the card         | _Art goes into each title folder's `Images` folder, only where there isn't one already: nothing of yours is ever replaced. The sheet in `Meta` is FamilyFlix's own and is kept up to date._ |
| Sync, the done summary                | _Saved to your library, each title folder, the sheet in Meta._                                                                                                                              |
| Export, _Images_                      | _Posters, backdrops, season posters and stills, in each title folder's Images, as your library folders hold them._                                                                          |
| Export, _Subtitles_                   | _Every subtitle file, in each title folder's Subtitles._                                                                                                                                    |
