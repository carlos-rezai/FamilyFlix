# Sheet in sight: handoff

Step 56, design log `docs/design-logs/74-sheet-in-sight.md`. This README is
the spec for the **Sheet in sight** until phase 3 amends
`feat.ImportFlow.dc.html`, `page.LibraryFoldersPage.dc.html`,
`page.SettingsPage.dc.html` and `COMPONENT-SPEC.md` to it; after that the
prototype rules, as everywhere. Nothing here is newly drawn: one block gains
a paragraph and one dialog's list gains an item.

## On disk

| Place                         | Value                                                                    |
| ----------------------------- | ------------------------------------------------------------------------ |
| The **Meta folder**           | `_meta/` in a Library folder's root, and in an Export folder's           |
| The **Library sheet**         | `_meta/familyflix-library.csv`                                           |
| A held `Meta/`                | read as before; renamed `_meta/` by the sheet's next write, files intact |
| An Export written before this | read as before, `Meta/` and all                                          |

## What the scanner accepts

Drawn on Import setup and on the Library folders page's group **Scan**, the
same block on both. After the folder-first rule, a second paragraph in the
same style (13px sans, faint ink, 8px above, line-height 1.5), the path in
the mono face:

| Part       | Value                                                                                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sheet note | `FamilyFlix keeps a sheet of each folder’s titles in _meta\familyflix-library.csv and reads it first, so a scan after a reset or on another computer brings every title back as it was, ratings, hearts and what’s been watched included.` |
| Mono       | `_meta\familyflix-library.csv`                                                                                                                                                                                                             |

## Settings → Storage → Reset…

The Reset dialog's **What stays** lists four items, in order:

| Item                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------- |
| `Your library folders and every file in them`                                                                                          |
| `Each library folder’s _meta sheet: scanning the folder again brings its titles back as they were (delete _meta first to start clean)` |
| `Your exports`                                                                                                                         |
| `FamilyFlix itself`                                                                                                                    |

Every other part of the dialog is unchanged: the title, the subtitle, What
goes, the refusal and the two buttons.
