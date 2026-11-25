# Whole add: handoff

Step 58, design log `docs/design-logs/76-whole-add.md`. This README is the
spec for the **Whole add** until phase 5 amends `feat.MovieForm.dc.html`,
`feat.ImportFlow.dc.html`, `page.LibraryFoldersPage.dc.html` and
`COMPONENT-SPEC.md` to it; after that the prototype rules, as everywhere.
Newly drawn: one slot on the form and the scanner block. A pick filling the
slots draws nothing new: each slot reads as a filled `mol.FileField` already
does.

## Add a title → Files: the Backdrop slot

Both kinds, on the add and the edit; never on a Resolve.

| Part         | Value                                                                    |
| ------------ | ------------------------------------------------------------------------ |
| Component    | `mol.FileField`, as Poster                                               |
| Label        | `Backdrop`                                                               |
| Choose label | `Choose backdrop image`                                                  |
| Icon         | `poster`                                                                 |
| Place        | directly under Poster; on the series kind, above _Season posters_        |
| Filled       | the file's name, ✕ to remove, as Poster                                  |
| Spacing      | the Files card's own `gap: 14px`; nothing between Poster and it but that |

## Add a title → a pick fills its slots

In the shell, on a plain add:

| Pick                 | Slots it fills                                                         |
| -------------------- | ---------------------------------------------------------------------- |
| _＋ Add show folder_ | Poster, Backdrop, each _Season posters_ slot, each episode row's Still |
| A movie's video      | Poster, Backdrop, and one Subtitles row per track, its language chosen |

- A slot is filled only while it is empty or still holds the earlier pick's
  file; one picked by hand is never replaced.
- Each filled slot is a filled `mol.FileField` (its file's name, ✕), and a
  track a `mol.SubtitleRow`, after the rows added by hand.
- The Show folder row's ✕, or the movie video slot's ✕, takes every slot
  still holding the pick's file; a slot replaced by hand stays.
- No loader beyond the Show folder pick's own _Reading folder…_; the movie's
  read draws none, as the containing read draws none.
- No snackbar, no line: a folder holding no art fills nothing, in silence.

## Import setup and Library folders → Scan: _What the scanner accepts_

The panel, its glyph and its heading are unchanged. Under the heading, in
place of the three shape lines:

**The examples**: two columns side by side, `display: flex; gap: 32px;
flex-wrap: wrap`, each the shapes' face (12px mono, `--color-text-faint`,
line-height 1.8), nested lines indented two spaces:

```
Heat (1995)\                The Show (2019)\
  Heat.mkv                    Images\poster.jpg
  Images\poster.jpg           Season 01\
  Images\backdrop.jpg           The Show S01E01.mkv
  Subtitles\English.srt         Images\poster.jpg
                                Images\Stills\S01E01.jpg
                                Subtitles\S01E01\English.srt
```

**The rules**: three lines in the rule's face (13px sans, faint, 8px above,
line-height 1.5), the folder and file names in mono:

1. `A folder with one video is a film; one with Season folders (Season 01) is
a series.` with `Season 01` in mono.
2. `Each episode’s number comes from its filename (S01E03, 1x03), its season
from its Season folder.` with `S01E03` and `1x03` in mono.
3. `Art goes in Images\, named ending in poster or backdrop; subtitles go in
Subtitles\. Anything it can’t place lands in the review list.` with
   `Images\`, `poster`, `backdrop` and `Subtitles\` in mono.

**The Sheet note** follows as it stands (log 74), unchanged.

Gone: `Movie Title (2019)\ movie.mkv · subs.en.srt`, both `Show Name\`
lines, _(loose episodes at the show root are fine)_, and _Season and episode
numbers come from the folder first, then the filename_.
