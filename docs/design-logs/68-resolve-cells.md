# 68: Resolve cells

> **Initiative:** `resolve-cells`
> **Issue:** #650
> **Handoff:** none; nothing new is drawn, and no prototype is amended

This log is the `grill-me` session for issue 650, held against the code as
it stood on 2026-11-18 (`7ffc2457`). It is an immutable snapshot of that
moment. Log 67 (**Export paths**) rules wherever this log does not say
otherwise.

## Background

The `export-paths` walk (issue 649, `docs/dev-journal.md`) resolved Die
Hard's `no-folder` row by picking its video: the film came back with no
poster, although its row's `Poster` cell names one under the run's **Sheet
root** (the Export's `Images/poster.jpg`). What the code does today:

- **A matched row's cells are read** by `filmWithCells` (log 67 Q10): in the
  Title folder, then under the Sheet root, into the places the read left
  empty. A Problem filed by the matcher (`no-folder`, `ambiguous`,
  `no-video`) keeps its folder as scanned, its cells unread.
- **The Problem detail's `files`** are a `no-folder` row's nothing at all
  (`{ videos: [], subtitles: [] }`); `problemFormValues` already draws a
  `files.poster` as a **Found file** in the poster slot and each
  `files.subtitles` track as a found row, in the language read off its name.
- **A Resolve's save** refuses (`ImportPathError`) any found path that lies
  under none of the run's **Library folders**, so a found poster under an
  Export folder elsewhere would be refused even if the form held it.

## Problem

A `no-folder` row resolved by a pick comes back with the art its row's
cells name, as a matched row's import does.

## Questions and Answers

1. **Is the Resolve's poster slot prefilled from the row's `Poster` cell?**
   ✅ **Yes, as a Found file**, the cell's file looked for under the run's
   Sheet root (a `no-folder` row has no Title folder to look in first). It
   is drawn as every found poster already is: its name in the slot, a ✕ to
   take it off. Nothing new is drawn, so the prototype stands. ❌ **Left
   empty**: the run's own fills already read that cell for every matched
   row, and a Resolve is the same title. ❌ **Drawn as from the sheet**: a
   new state the prototype lacks, for a file the slot already shows by
   name.

2. **And the row's `Subtitles` cells?** ✅ **Prefilled too**, each cell's
   file a found track in the language its name reads, the reach of the
   run's fills. The backdrop stays out: the Resolve form has no backdrop
   slot. ❌ **The poster alone**: the tracks would be lost as the poster
   was.

3. **What may a Resolve's save copy from the Sheet root?** ✅ **Art only**:
   a found poster or track passes when it lies under a Library folder or
   under the run's Sheet root, and is copied into managed storage as art
   always is. A found video still passes only under a Library folder; the
   `Video` cell is never read (log 67 Q12). The Series Resolve's poster and
   tracks pass by the same rule. The Sheet root is only read.

4. **Which Problems does this reach?** ✅ **`no-folder` alone**, the issue's
   case. ❌ **An `ambiguous`'s or a `no-video`'s first folder read with its
   cells**: the Folder picker swaps the folder the detail prefills from,
   and which folder's cells win is its own question. Not filed.

## Design

### Types

```ts
// server/src/import-export/pathCellFills/pathCellFills.ts
/** A Title-folder-less row's cell art: its poster and tracks under the Sheet root. */
export function rowCellFiles(
  row: SheetRow,
  sheetRoot: string
): Promise<{ poster: string | null; subtitles: SubtitleFound[] }>;
```

```ts
// server/src/import-export/createImporter/createImporter.ts
interface ProblemSource {
  // …
  /** A `no-folder` row's alone: the art its cells name under the Sheet root. */
  cells?: { poster: string | null; subtitles: SubtitleFound[] };
}
```

The run keeps its Sheet root (`null` for a Folder scan, whose sheets lie in
its Library folders) beside `listedPaths`, for the save's check.

### The units

| Unit             | Where                                      | Change                                                     |
| ---------------- | ------------------------------------------ | ---------------------------------------------------------- |
| `pathCellFills`  | `server/src/import-export/pathCellFills/`  | `rowCellFiles`; a search with no Title folder              |
| `createImporter` | `server/src/import-export/createImporter/` | a `no-folder` source's cells; `files` from them; art check |

No client unit changes: `problemFormValues` already draws `files.poster` and
`files.subtitles`.

## Implementation Plan

1. **The Resolve's art from its cells.** `rowCellFiles`, the `no-folder`
   detail's `files`, the save's art check. Demo: a hand sheet beside its
   art, a `no-folder` row resolved by picking its video saves the poster and
   the track its cells name.
2. **The documents**: glossary (**Resolve**, **Found file**), the checklist,
   the journal.

## Trade-offs

- **Easier:** an Export's `no-folder` title comes back with its poster and
  tracks; the maintainer picks only the video.
- **Harder:** a Resolve's save now reads from one folder outside the Library
  folders, the run's Sheet root, as the run itself already does.
- **Out of scope:** the backdrop (no slot); `ambiguous` and `no-video`
  Problems' cells (Q4).
