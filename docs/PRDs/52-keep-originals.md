> **Initiative:** `keep-originals`
> **Design log:** `docs/design-logs/52-keep-originals.md`
> **Issue:** #473 (the PRD, step 35)
> **Build order:** step 35, **Keep originals**, above **Loading states**. It ships as thin slices (log 52, _Implementation Plan_), the prototype revision first. No migration, no new route; one route loses its query and one gains a refusal.

## Problem Statement

In v0.10.0 a Delete of a linked title moved its **Linked files** to the Recycle Bin. Deleting a linked series sent over a thousand episodes there; Windows silently purges whatever overflows the bin's size limit, and the household's originals were lost for good.

v0.11.0 made keeping the default, but the **Recycle choice** is still drawn for a linked title in the shell: one wrong click on _Move them to the Recycle Bin_ and it can happen again. The bin is not a safe place, so an opt-in is not a safety net.

The maintainer's rule is absolute: FamilyFlix never deletes an original file. Deleting a linked title removes only the link; deleting a copied title removes only FamilyFlix's own copy. Today that is true by default, not by construction. One mechanism can still reach an original (the Shell trash), and one gap could (a **Library folder** that is, lies inside or holds the **Managed media directory** puts originals in reach of **Factory reset**).

## Solution

A Delete is safe to press in every case, with nothing to choose. The Delete dialog draws what today's _Keep the files_ state draws, with the two cards and the callout gone and every other word unchanged; it looks the same in the shell and in a browser. A linked Delete removes the title's rows; a copied Delete removes its **Media folder**; every file in a Library folder stays where it is, byte for byte, and is remembered as a **Left-out video** so the next scan does not bring the title back.

The whole Shell trash goes: the request on the **Shell handshake**, main's trash handler, the server's trash client and `Media.trashLinked`. Nothing in FamilyFlix can move an **Original** anywhere.

Adding a Library folder that overlaps the Managed media directory is refused with _That folder overlaps where FamilyFlix keeps its own copies. Choose another one._ (the **Media directory refusal**), so no Factory reset or Delete can reach an original through an overlap.

The guarantee is pinned by one route test that exercises every removal FamilyFlix makes and checks every original is still on disk and byte-identical afterwards.

## User Stories

### Deleting a linked title

1. As a parent, I want deleting a linked movie to leave its video file where it lies, so that the film I own is never lost.
2. As a parent, I want deleting a linked series to leave every episode file where it lies, so that a thousand episodes can never vanish again.
3. As a parent, I want the Delete dialog to offer no option that removes my files, so that one wrong click can't cost me my collection.
4. As a parent, I want the Delete dialog's _What stays_ to tell me my original stays in its library folder, so that I know what pressing Delete means without extra reading.
5. As a parent, I want the dialog to say _Scan folders would bring it back_, so that I know how to undo a Delete.
6. As a parent, I want a deleted linked title to stay out of the library on the next scan, so that deleting it means something.
7. As a parent, I want a deleted linked title whose files are shared with another title to say _which another title plays_, so that I understand why the files are untouched.
8. As a parent, I want a deleted linked title whose drive is unplugged to say its files _can't be reached right now_, so that I'm not surprised.
9. As a parent, I want a poster FamilyFlix wrote beside a linked video to stay too, so that nothing in my folders disappears.
10. As a parent, I want deleting a linked title to remove FamilyFlix's own art and subtitles for it, so that its copies don't pile up.

### Deleting a copied title

11. As a parent, I want deleting a copied movie to remove FamilyFlix's copy (video, art, subtitles), so that its disk space comes back.
12. As a parent, I want the original a copied title came from to stay in its library folder, so that deleting the copy never reaches the source.
13. As a parent, I want that original remembered as left out, so that the next scan doesn't import it again.

### One dialog everywhere

14. As a parent, I want the Delete dialog to look the same in the desktop app and in a browser, so that I learn it once.
15. As a parent, I want _Delete movie_ / _Delete series_ and _Cancel_ to be the only choices, so that the dialog is quick to act on.
16. As a parent, I want the Delete to finish without a refusal line, so that a Delete never fails for a reason I can't fix.
17. As a parent, I want a title someone already removed to count as deleted, so that a stale page never shows an error (gone is gone).
18. As a parent, I want a real failure (the server down) still to surface as the dialog's error, so that I know when nothing happened.

### Library folders

19. As the maintainer, I want adding the Managed media directory as a Library folder to be refused, so that a scan never walks FamilyFlix's own copies as new videos.
20. As the maintainer, I want adding a folder inside the Managed media directory to be refused, so that its files are never in reach of Factory reset.
21. As the maintainer, I want adding a folder that holds the Managed media directory to be refused, so that a scan never imports FamilyFlix's copies.
22. As the maintainer, I want the refusal to read _That folder overlaps where FamilyFlix keeps its own copies. Choose another one._, so that I know what to do instead.
23. As the maintainer, I want the existing refusals (nothing typed, not absolute, not a folder, overlapping another Library folder) to keep their order and words, so that nothing else about the add changes.

### Every other removal

24. As the maintainer, I want replacing a linked film's video on an edit to leave the old original in place, so that an edit never deletes a file.
25. As the maintainer, I want removing a linked episode in the Series edit job to leave its file in place, so that trimming a show never deletes a file.
26. As the maintainer, I want Clear details to remove only FamilyFlix's art, so that a poster beside a linked video stays.
27. As the maintainer, I want Factory reset to empty only the Managed media directory, so that every Library folder survives it.

### The maintainer

28. As the maintainer, I want the guarantee pinned by a test of every removal, so that no future change can quietly reintroduce a delete of an original.
29. As the maintainer, I want the Shell trash removed whole, so that there is no dormant path to the Recycle Bin left in the code.
30. As the maintainer, I want the Shell handshake back to `ready | fatal` and `shutdown`, so that the shell's surface is as small as it can be.
31. As the maintainer, I want `createMedia` to take only the media path, so that the media domain has no injected way to reach outside its root.
32. As the maintainer, I want a stray `?files=trash` from an old client to be ignored, so that it can't trigger anything.
33. As the maintainer, I want CLAUDE.md, README, the checklist, the release checklist and the glossary to say originals are never deleted, so that the rule is written where every future change reads it.
34. As the maintainer, I want a live walk in the shell over a sandbox Library folder, so that I see the originals survive in the real app before shipping.

## Implementation Decisions

- **One initiative** (log 52 Q2): `keep-originals`, step 35, above Loading states. Not built here: Loading states, Scan new folders, a boot-time check of Library folders already listed.
- **Prototype first** (Q3): the Delete dialog without its cards and callout in `page.ManageLibraryPage`, `page.MoviePage`, `page.SeriesPage` and `FamilyFlix`; the Library folders add's new refusal in `page.LibraryFoldersPage`; the three Delete dialogs' rows in the component spec (`ChoiceCard ×2` drops). Step 30's frozen handoff is left as it is.
- **Glossary**: **Original** and **Media directory refusal** are new; **Recycle choice** and **Shell trash** are retired; **Linked files**, **Library folder** and **Delete** are updated. The glossary already carries all of them.
- **No Delete reaches an original** (Q1): a linked Delete removes only its rows; a copied Delete removes only its Media folder. Rejected: the Recycle choice as an opt-in.
- **The Delete dialog** (Q4, Q5): today's _Keep the files_ state, cards and callout gone, every word unchanged: heading, subtitle, _What goes / What stays_ as `deleteView` words them for keeping, then the confirm and _Cancel_. `DeleteTitleBody` stops reading the **Folder bridge**; one dialog everywhere. Rejected: new reassurance copy.
- **The delete routes** (Q6): `DELETE /api/movies/:id` and `/api/series/:id` take no query. Each always records the title's Left-out videos, then removes the rows, then the Media folder: row first, then bytes, best-effort, as today. `recycleChoiceFirst` and `trashedFirst` go. A stray `?files=trash` is ignored. Rejected: a `400` for it.
- **No refusal** (Q7): every delete `409` was the trash's, so `DeleteOutcome`, the hooks' `refusal`, `useLibraryTitles`' `refusalFor` and the dialog's refusal line go. `deleteTitleAt(route)` returns to Factory reset's shape, `Promise<void>`: any `2xx` or a `404` resolves, anything else rejects. `DeleteFiles` and every `files` parameter go (`deleteTitleAt`, `deleteMovie`, `deleteSeries`, `useDeleteMovie`, `useDeleteSeries`, `useLibraryTitles.deleteTitle`, `onConfirm`). `refusalSentence` stays: the folder and form wires use it.
- **`LinkedFiles` as a kind only** (Q8): `folder | videos | shared | unreachable`, `null` for a copied title, redefined as what a Delete leaves where it lies. `LinkedFilesAnswer.paths` and `libraryTitleList`'s `linkedFilesOf` go; `linkedFiles` answers `LinkedFiles | null`. `offersRecycleChoice`, `LINKED_CALLOUT`, `DeleteView.callout` and `filesGoing`'s trash branch go; `deleteView(title)` loses its second parameter.
- **The Shell trash goes whole** (Q9): `ServerMessage` is `ready | fatal`, `ShellCommand` is `shutdown`. `createShellTrash`, `electron/trashItems/`, main's trash wiring, `serverHandle`'s `trash` dependency and `answerTrash` go. `createMedia(mediaPath)` loses its second parameter; `Trash`, `TrashOutcome`, `NO_TRASH` and `trashLinked` go.
- **The Media directory refusal** (Q10): `admitFolder(storage, path, mediaPath)` gains a fourth rule after the overlap with listed folders: `folderOverlap(path, [mediaPath])` non-null is refused as a new `FolderRefusal`, `'media'`, answered `409` by `POST /api/library-folders` with _That folder overlaps where FamilyFlix keeps its own copies. Choose another one._ Holding the media directory is refused too. Rejected: a boot-time check of folders already listed (the installed media root lies under the app's own working directory, and the household's one Library folder is `D:\Movies`).
- **A copied Delete is unchanged** (Q12): its Media folder goes; its original stays as a Left-out video. A poster a **Write target** wrote beside a linked video stays.
- **Documents** (Q13): the checklist's row and a step 35 entry; README's Library paragraph; CLAUDE.md's _Product Rules_ **Media** ("never deleted: FamilyFlix deletes nothing outside the **Managed media directory**"); the release checklist's Shell trash smoke becomes a Keep originals smoke; the docblocks of every unit touched. The `keep-originals-pending-grill` memory is obsolete.
- **Slices** (log 52, _Implementation Plan_):
  1. the prototype;
  2. a Delete keeps originals (routes, dialog, wire, the keeps-originals test for both Deletes);
  3. the Shell trash goes;
  4. the media directory is no Library folder (the refusal, and the rest of the keeps-originals test);
  5. walk it live in the shell over a sandbox Library folder, then the documents.

## Testing Decisions

- A good test drives a unit through its public face and asserts what a caller or the household sees: the files on disk, the rows, the status answered, the request sent, the words drawn. It never asserts which helper ran.
- **The guarantee** (Q11): one new route test, `routes.keepsOriginals`, over a temporary Library folder. It deletes a linked movie, a linked series and a copied movie; replaces a linked film's video on an edit; removes a linked episode in the Series edit job; runs Clear details; runs Factory reset. After each, every original is on disk and byte-identical, and a copied title's Managed copy is gone. Prior art: `routes.deleteKeepsFiles`, `routes.linkedDelete`, `routes.linkedEdit`, `routes.deleteSeries`.
- **The delete routes**: the trash cases leave `routes.deleteKeepsFiles` and `routes.linkedDelete`; what stays asserts Left-out videos are always recorded and a `?files=trash` is ignored.
- **`admitFolder`**: the `media` refusal for a path that is, lies inside or holds the media path, after the existing rules; prior art its own test and `routes.libraryFolders` for the `409` and its words.
- **`deleteTitleAt`**: resolves on `2xx` and `404`, rejects otherwise; prior art the Factory reset wire's test.
- **`deleteView` / `DeleteTitleBody` and the three Delete dialogs**: no cards, no callout, the same words in shell and browser; prior art their existing tests. The four recycle tests go.
- **`linkedFiles` / `libraryTitleList`**: the kind only, no paths; prior art their existing tests.
- **Removed with their units**: `routes.shellTrash`, `shellTrash`, `trashItems`, and the trash cases of `createMedia`'s test.

## Out of Scope

- **Loading states** and **Scan new folders**: their own steps.
- A boot-time check of Library folders already listed against the Managed media directory.
- Any way to free disk space from a linked title inside FamilyFlix: that is the household's job in Explorer, by design.
- Step 30's frozen handoff (`handoff-manage-library/`).

## Further Notes

- The trade-off is accepted: a Library folder that overlaps the Managed media directory can no longer be added, even deliberately.
- The release checklist's smoke replaces the Shell trash smoke: in the shell, delete a linked film, a linked series and a copied film over a sandbox Library folder, and every original is still there.
