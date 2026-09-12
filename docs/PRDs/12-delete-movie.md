## Problem Statement

I am the maintainer of this library, and once a movie is in it there is no way
to take it out.

Add and Edit shipped with `movie-form`. A film can be added with the wrong
video, the wrong poster, or as a duplicate of one already there, and the only
correction available is Edit — which can replace its files but can never make
it go away. A movie added by mistake is permanent, and so are the gigabytes
FamilyFlix copied into its **Movie folder** for it.

The pieces are already built and none of them are connected.
`LibraryStorage.deleteMovie` has existed since library-core: one `DELETE FROM
movies` with `ON DELETE CASCADE` clearing the genre tags and subtitles, tested,
called by nothing but the dev seed. `Media` can already open the folder a
**Stored path** lives in and remove a folder recursively, both written for the
form's rollback. The prototype's ⋯ menu on the movie detail page draws a red
`🗑 Delete movie` row — and wires it to `onToggleEditMenu`, so it closes the
menu and does nothing. That is why the shipped **Edit menu** holds one item:
design log 04 refused to ship "a red row that closes the menu and does nothing,
or a permanently greyed one that reads as 'this movie can't be deleted'", and
`11-add-movie.md` listed Delete under _Not built_ for the same reason: the
prototype draws no confirmation anywhere.

Deferred twice for one cause, and the cause has not changed: the prototype's
only Delete control is a row with no effect, and CLAUDE.md forbids improvising
the dialog it needs.

## Solution

A **Danger row** in the **Edit menu**, a **Delete dialog** that confirms it,
and a route that removes the row and then the bytes.

The dialog is not designed from scratch. It is **composed from the prototype's
own vocabulary** — three pieces the prototype already has and never put
together: the **Modal** shell that `feat.ExportModal` draws pixel for pixel
(scrim, centred card, icon tile, serif title, subtitle, ✕, body slot), the
`danger` variant `prim.Button`'s `renderVals` already implements and no screen
uses, and the red row `page.MoviePage` already draws. The prototype is amended
with that composition first — `mol.Modal`, `feat.DeleteMovieDialog`, the
`danger` enum entry, and a Delete row that opens the dialog — as one `docs:`
commit before any code, so the build has something to translate rather than a
description to interpret.

The dialog says the one thing the **Maintainer** actually needs to know:

> **Delete “{title}”?**
> This can’t be undone.
>
> The movie leaves your library, and the video, poster and subtitles FamilyFlix
> copied are deleted. The original files are not touched.
>
> [ Delete movie ] [ Cancel ]

Confirming sends `DELETE /api/movies/:id`. The server deletes the row (the
cascade takes the genre tags and subtitles) and then removes the **Movie
folder** under the **Managed media directory** — best-effort, after the commit,
the same order and the same swallow the form's superseded-file cleanup already
keeps. The **Library root** is never read or written; the dialog says so.

Done, the page steps back through history — the genre shelf or the filtered,
scrolled browse home the Maintainer came from, remounted without the movie. A
`404` counts as done: **gone is gone**.

`components/Modal` lands as a real molecule with the whole dismissal contract —
Escape, scrim, ✕, focus in and back out, Tab held inside — which the 🔜 Export
dialog is the second customer for.

## User Stories

**The row**

1. As the maintainer, I want a "🗑 Delete movie" row in the movie detail page's
   ⋯ menu, so that the control the prototype draws finally does what it says.
2. As the maintainer, I want that row drawn in the danger colour with a tint of
   it on hover, so that it reads as the one destructive choice in the menu
   before I pick it.
3. As the maintainer, I want the row to close the menu and return focus to the
   ⋯ trigger the way every other row does, so that Delete is not a special
   mode of the menu.
4. As the maintainer, I want the row below "Edit details" in the order the
   prototype draws, so that the menu matches the design and the safe action
   comes first.
5. As the maintainer, I want the 🗑 glyph kept out of the row's accessible
   name, so that a screen reader says "Delete movie" and not the emoji.

**The dialog**

6. As the maintainer, I want a confirmation dialog before anything is deleted,
   so that a single click in an overflow menu cannot remove a film and its
   gigabytes.
7. As the maintainer, I want the dialog to name the movie in its title, so
   that I can see I am deleting the one I meant to.
8. As the maintainer, I want the dialog to say "This can't be undone.", so
   that I know there is no trash and no restore.
9. As the maintainer, I want the dialog to tell me the copied video, poster
   and subtitles are deleted **and the originals are not touched**, so that
   the one real question — what happens to my folder — is answered where I am
   asking it.
10. As the maintainer, I want the confirming button drawn in the `danger`
    variant and the Cancel in `secondary`, in [confirm][Cancel] order, so that
    the dialog reads like the prototype's Export dialog and the dangerous
    action is unmistakable.
11. As the maintainer, I want the dialog's icon tile to show the same 🗑 as the
    row, so that Delete has one symbol across the feature.
12. As the maintainer, I want the dialog drawn over the whole viewport with the
    page scrimmed and blurred behind it, so that nothing else on the page can
    be pressed while it is open.
13. As the maintainer, I want the dialog to sit still while the page behind it
    scrolls, so that it does not drift away inside the detail page's scroll
    container.
14. As the maintainer, I want the dialog to animate in when it opens, so that
    it matches the prototype's pop rather than appearing in place.

**Dismissing it**

15. As the maintainer, I want Cancel to close the dialog and delete nothing, so
    that changing my mind costs one click.
16. As the maintainer, I want the ✕ in the dialog's corner to do the same, so
    that the header's close works the way the prototype draws it.
17. As the maintainer, I want Escape to close the dialog, so that the keyboard
    has a way out.
18. As the maintainer, I want a press on the scrim to close the dialog, so
    that clicking away from it is a way out too.
19. As the maintainer, I want a press inside the card to leave the dialog
    open, so that mis-clicking beside a button does not dismiss it.
20. As the maintainer, I want focus to land on the dialog's card when it opens
    and on no button, so that pressing Enter reflexively on open does nothing
    and I have to Tab to a choice.
21. As the maintainer, I want Tab and Shift+Tab to cycle within the dialog, so
    that keyboard focus cannot wander onto the scrimmed page behind it.
22. As the maintainer, I want focus returned to the ⋯ trigger when I cancel,
    so that dismissing the dialog puts me back where I opened the menu from.
23. As the maintainer using a screen reader, I want the dialog announced as a
    modal dialog labelled by its title, so that I know what has opened and
    what it is asking.
24. As the maintainer, I want a closed dialog to render nothing at all, so that
    there is no hidden card in the page and the pop runs fresh on every open.

**Deleting**

25. As the maintainer, I want "Delete movie" to remove the movie from the
    library, so that it no longer appears anywhere the family browses.
26. As the maintainer, I want its genre tags and subtitle records gone with it,
    so that no genre row counts a movie that is not there.
27. As the maintainer, I want the movie's folder under the managed media
    directory removed — video, poster, subtitles, and anything else in it — so
    that the disk space comes back.
28. As the maintainer, I want the folder removed even if the video inside it
    was deleted by hand at some point, so that a poster and subtitles are not
    left on disk forever for a movie that is gone.
29. As the maintainer, I want the library updated **before** the files are
    touched, so that a failure to remove the bytes leaves stranded files
    nobody can reach rather than a ghost row the family can open and fail on.
30. As the maintainer, I want a locked file — a video the stream route still
    has open — to leave the delete successful with the folder stranded, rather
    than fail the delete, so that the library is right even when Windows
    refuses the unlink.
31. As the maintainer, I want nothing in my own family folder touched, ever,
    so that deleting here can never cost me an original.
32. As the maintainer, I want the confirming button to read "Deleting…" and be
    disabled while the request runs, so that I cannot send it twice and I can
    see it is working.
33. As the maintainer, I want Cancel, ✕ and Escape to stay live while the
    request runs, so that the dialog never traps me on a slow request.
34. As the maintainer, I want a delete that succeeds after I dismissed the
    dialog to still leave the page, so that I am not left on a detail page for
    a movie that no longer exists.

**Afterwards**

35. As the maintainer, I want a successful delete to take me one step back in
    history — the genre shelf or the browse home I came from, with its filters
    and scroll as I left them — so that Delete obeys the same Back rule as
    every Back in the app.
36. As the maintainer, I want the screen I land on refetched without the movie,
    so that its card is not still on the shelf.
37. As the maintainer, I want a deep-linked or reloaded detail page — one with
    no history behind it — to land on the browse home after the delete, so
    that I am not stranded on a dead page.
38. As the maintainer, I want stepping forward in the browser onto the deleted
    movie's page to show "That movie isn't here — it may have been removed from
    your library", so that the forward stack answers honestly rather than
    erroring.

**Failure and edge cases**

39. As the maintainer, I want a `404` from the delete route to count as done —
    the movie is not in the library, which is what I asked for — so that a
    movie deleted from another window does not leave me on a stale page whose
    only working button re-asks a question the server has already answered.
40. As the maintainer, I want a failed request (a `500`, or no server) to
    re-enable "Delete movie" and change nothing else, so that I can try again
    without the app inventing an error surface the prototype does not design.
41. As the maintainer, I want the request to keep going even if I dismiss the
    dialog mid-flight, so that dismissal never leaves the library half-done.
42. As the maintainer, I want a title with quotes or a very long title to sit
    in the dialog's heading without breaking the card, so that the copy holds
    for any film in the library.
43. As the maintainer, I want a movie whose stored path escapes the managed
    media directory — a corrupted row — to be deleted from the library with
    no files touched, so that the boundary every read route keeps is kept by
    the one delete too.
44. As the maintainer, I want a movie whose folder is already gone to delete
    cleanly, so that cleaning up by hand beforehand is never punished.
45. As the maintainer, I want another movie's folder left alone when one
    movie is deleted, so that a delete removes exactly one film.
46. As a parent browsing, I want no Delete anywhere on the browse home, a
    poster card, or the player, so that nothing I can reach removes a film —
    the only Delete is behind the ⋯ menu on the detail page, and the only
    thing that confirms it is the dialog.

## Implementation Decisions

**Scope.** Delete alone. Edit shipped with `movie-form` and is not touched. The
only surface is the detail page's ⋯ menu; the only confirmation is the dialog.
No undo, no snackbar, no trash, no keyboard shortcut, no delete from a card or
a grid — none of them is in the prototype.

**The prototype is amended first, as one `docs:` commit, and nothing in `src/`
lands before it.** Four changes: a new `mol.Modal` file holding the shell lifted
verbatim from `feat.ExportModal`'s idle state (scrim fixed over everything,
z 90, scrim colour, 4px blur, the fade; a 520-wide card at `max-width 100%` on
`surface-2` with the border, the large radius, the deep shadow and the pop; a
header of a 44px `radius 12` tile on `accent-soft` / `accent-line` holding the
icon, a serif 600 24px title, a 14px faint subtitle and a 34px ✕; a body slot
padded `22px 28px 28px`) with exactly the props COMPONENT-SPEC already lists
for it — `open`, `title`, `subtitle`, `icon`, `onClose`, children; a new
`feat.DeleteMovieDialog` file composing that Modal with one 15px dim paragraph
and a `gap 12` action row of a `danger`/`md` and a `secondary`/`md` Button in
[confirm][Cancel] order; `danger` added to `prim.Button`'s `variant` enum,
which its `renderVals` already implements; and `page.MoviePage`'s Delete row
rewired to open the dialog, with the root prototype file holding the open
state, dropping the movie on confirm and returning to browse. COMPONENT-SPEC
gains the two rows. Describing the dialog only in prose was ruled out: the
build skill translates prototype files, and a dialog that exists only in a
design log is the improvisation the rule forbids.

**The wire.** `DELETE /api/movies/:id` answers `204 No Content` and, for an
unknown id, the same JSON `404` every per-movie route sends. Not `200 {}`: the
single-signal routes echo because a client reconciles on the echo, and a delete
reconciles on absence. The route is thin — find the movie or 404, delete the
row, remove the folder, end — and learns nothing about the filesystem beyond
the `Media` method it calls.

**Row first, then bytes, best-effort.** The library is the source of truth. A
row that survives with its files gone is a ghost the family can open and fail
on; files that survive with their row gone are stranded bytes nobody can reach
— a cost, not a bug. This is `removeFile`'s existing contract, quoted rather
than re-argued: "Losing an edit that already succeeded is the wrong trade
against one stranded file." The glossary names it **Best-effort cleanup** and
both deletions of media in the app now follow it.

**A third removal on `Media`: `removeMovieFolder(storedPath)`.** It removes the
**Movie folder** the stored path _names_ — its first segment — and everything
in it, whether or not the file is still there; it does nothing for a path that
escapes the root or names a folder that is already gone; and it swallows its
own failure. Neither existing method fits: `openFolder` answers nothing for a
missing file, which is right for an edit (a missing video means "reserve a
fresh folder") and wrong here (a hand-deleted video would leave the poster and
subtitles on disk forever); and `removeFolder` throws on a locked file, which
is right for a rollback where nothing has committed and wrong after a commit.
Three removals with three stated contracts, beside each other.

**The row.** `MenuItem` grows a `danger` boolean — the **Danger row**: danger
ink, a `.12` tint of it on hover, written literally because the prototype
writes it inline and there is no token behind it (the same call
`RemoveButton` made). Not a `tone` enum: there is one destructive row in the
app's four menus and no third tone anywhere in the prototype. Not a
`dangerSoft` token: it would be the third danger tint in the app and none of
them is a token. The 🗑 is a literal glyph on the `glyph` prop, the precedent of
`MenuItem`'s ✎ and `RemoveButton`'s ✕ — not an icon atom. The row closes the
menu before its `onSelect` runs, so the menu is gone and focus is back on the
⋯ trigger by the time the dialog takes it, which is where the dialog returns
it on Cancel.

**`components/Modal` is a deep molecule and owns the whole dismissal
contract**, on the same argument `Menu` made — it is the half that is easy to
half-implement. Escape, a press on the scrim, and the ✕ all call `onClose`.
Focus moves to the card (`tabIndex=-1`) on open and returns to the previously
focused element on close. Tab and Shift+Tab wrap inside the card.
`role="dialog"`, `aria-modal="true"`, labelled by the title. It renders nothing
when `open` is false — a mount, so the pop animation runs, on `Fab`'s recorded
note that prop-driven entrances are unreliable. It renders through a portal to
the document body, because a scrim inside the detail page's scroll container
would scroll with it (the prototype's `position: absolute` is relative to its
phone frame; ours is the viewport). The icon tile is omitted when no icon is
given. The ✕ is a local styled button labelled "Close" — not `RemoveButton`,
which is a different size, radius and hover colour, and a dialog's close is not
a removal. Ruled out: a native `<dialog>`, because jsdom does not implement
`showModal()` and the app's pattern from `Menu` onward is a bespoke contract it
can test; scroll-locking the page behind, because the prototype does not and
the Export dialog will share the scrim.

**Focus lands on the card, not a button.** For a destructive dialog that is the
safe default — Enter on open does nothing — and it is the one rule that serves
the Export dialog too, so `Modal` never needs to know which child is the
dangerous one.

**The icon tile stays brand-coloured.** It is the Modal pattern's own chrome,
exactly as the Export dialog's download icon sits on it. The destructive
meaning lives where the prototype puts it: the danger row that opened the
dialog and the danger button that confirms it. A red tile would need two
tokens the prototype does not have.

**`EditMenu` owns the open state**, because it owns the row. It gains a `title`
prop beside `movieId` (the dialog's heading needs it), holds `deleteOpen`, and
renders the dialog beside its corner menu; the portal takes the dialog out of
the fixed corner slot. The movie detail organism passes the title down.

**`DeleteMovieDialog`** takes `movieId`, `title`, `open`, `onClose`: the Modal,
the copy, the two buttons, and the hook. **`useDeleteMovie`** exposes
`{ deleting, deleteMovie }`: it sets `deleting` for the life of the request,
calls the feature's `api.deleteMovie`, and on completion goes back through
`useGoBack` — the app's one Back rule, which steps through history and falls
back to the browse home only when there is none. Not `navigate('/')`: that is
the prototype's `goBrowse()`, and `useGoBack`'s docblock already says why it is
not ours. The deleted movie's entry stays in the forward stack; stepping onto
it lands on the detail page's existing `not-found` state, which was written for
precisely this.

**In flight.** The confirming button is `disabled` and reads **Deleting…** —
the form's "Adding…", a prop the prototype's Button already declares. Cancel, ✕
and Escape stay live; dismissing does not cancel the request. A success after a
dismissal still navigates, because the movie is gone and its page has nothing
left to show. A failure re-enables the button and nothing else — the form's
precedent, since the prototype designs no error state on this screen. No
snackbar: the system is 🔜 and this flow raises none.

**Gone is gone.** The client's `deleteMovie(id)` resolves on `204` and on `404`
alike and rejects on anything else. The goal of Delete is that the movie is not
in the library, and `404` says it is not.

**The client call lives with the feature**, beside `saveRating`: one caller, so
CLAUDE.md's `api/` rule keeps it there. It moves up to the shared `api/` folder
if and when bulk import's review step or a second surface deletes.

**Copy is fixed by the log.** Title `Delete “{title}”?`, subtitle `This can’t be
undone.`, body `The movie leaves your library, and the video, poster and
subtitles FamilyFlix copied are deleted. The original files are not touched.`,
buttons `Delete movie` / `Cancel`, in-flight `Deleting…`, ✕ labelled `Close`.
Typographic quotes and apostrophes as the prototype writes them.

**No schema change.** The cascade on `movie_genres` and `subtitles` already
exists and `LibraryStorage.deleteMovie` is untouched.

## Testing Decisions

A good test asserts **external behaviour** — what a URL answers, what is on
disk, what the screen shows and where focus is — never how it was reached. The
precedent is `routes.test.ts`, whose header states the rule outright: the seam
is the endpoint over a real listener and a real migrated `:memory:` database,
because what a slice promises a caller is a URL, a status and a body shape.

**Every unit gets its co-located test.**

**The Media seam.** `removeMovieFolder` against a real sandbox directory using
the existing `sandboxRoot` test-support unit, in the style of the `removeFolder`
and `removeFile` groups already there: it removes the folder a stored path
names and everything in it; it removes the folder when the named file is
already gone but its siblings are not; it leaves another movie's folder alone
and the managed media directory itself standing; it says nothing about a folder
that is already gone; it refuses a path that escapes the root; and it swallows
a failure rather than throwing.

**The route**, through `createApiRouter` the way `routes.test.ts` does, with
the `Media` seam pointed at a sandbox: `DELETE /api/movies/:id` → `204` with an
empty body and the movie absent from `GET /api/movies` and from its genre
rows; the movie folder gone from the sandbox after the response; an unknown id
→ the JSON `404` with `Unknown movie: <id>`; a second delete of the same id →
`404`; the row gone even when the folder removal fails; another movie and its
folder untouched.

**The client call**, in the style of `saveRating`'s tests against
`fakeResponse`: sends `DELETE` to the movie's route with an encoded id; resolves
on `204`; resolves on `404`; rejects on `500`; rejects when the request itself
cannot be made.

**`MenuItem.danger`**, in `Menu.test.tsx`'s existing groups: a danger row still
closes the menu and reports like any other; the glyph stays out of its
accessible name; a row without `danger` is unchanged.

**`Modal`**, a new co-located test carrying the contract, in `Menu.test.tsx`'s
shape ("the three ways out", "reopening"): renders nothing when closed; renders
into the document body rather than its parent; carries `role="dialog"`,
`aria-modal`, and is labelled by its title; shows the icon tile only when an
icon is given; Escape, a press on the scrim, and the ✕ each call `onClose`,
and a press inside the card does not; focus is on the card on open; Tab from
the last focusable wraps to the first and Shift+Tab from the first wraps to
the last; focus returns to the previously focused element on close; stops
listening once shut so a stray Escape costs nothing.

**`DeleteMovieDialog`**, rendered: the title carries the movie's name; the
subtitle and body copy are exact; the danger button and Cancel are present in
order; Cancel calls `onClose`; confirming sends the delete and the button reads
"Deleting…" and is disabled while it runs; Cancel stays enabled while it runs;
a failure re-enables the button and the dialog stays open.

**`useDeleteMovie`**, with `LocationProbe`: `deleting` is true for the life of
the request; a `204` and a `404` both navigate back one step; a deep-linked
page (no history) lands on `/`; a rejection leaves the location alone and
`deleting` false.

**`EditMenu`**: the existing test that asserts "no Delete row, disabled or
otherwise" is replaced by its opposite — the row is there, in the danger
colour, after Edit details; selecting it closes the menu and opens the dialog
with this movie's title; Cancel closes the dialog and focus is back on the ⋯
trigger.

**`MovieDetail`**: passes the title into the menu — one assertion that the
dialog, opened, names the movie on the page.

No new `test-support/` unit is anticipated; `sandboxRoot`, `freshStorage`,
`newMovie`, `fakeResponse`, `LocationProbe` and `makeMovie` cover what is
needed.

## Out of Scope

- **Undo, a "Deleted _title_" snackbar, a trash or restore** — not designed;
  the snackbar system is a separate 🔜 feature and the prototype raises none
  here. "This can't be undone" is true and stays true.
- **Delete from the poster card, the browse grid, the player, or a keyboard
  shortcut** — the prototype's only Delete is the detail page's ⋯ menu.
- **Touching the family's own folder (the Library root)** — never; the app has
  never read it and never will under **Managed copy**.
- **Surfacing a stranded folder** — a locked file leaves the folder behind and
  nothing reports it; the 🔜 Storage section's "space used" is the first place
  it could.
- **A red icon tile** and the `dangerSoft` / `dangerLine` tokens it would need.
- **Scroll-locking the page behind the scrim** — not in the prototype.
- **A native `<dialog>`** — jsdom cannot drive it, and the app's dismissal
  contracts are bespoke and tested.
- **Edit** — shipped, untouched.
- **The Export dialog** — `Modal` is built for it, but it ships with
  `import-export`.

## Further Notes

**Trade-off accepted.** Files are removed best-effort after the row commits, so
a locked file — Windows will refuse to unlink a video the stream route still
has open, if the family navigated here mid-stream — leaves a stranded folder
that nothing yet surfaces. The alternative, failing the delete or deleting the
bytes first, produces either a movie that cannot be deleted while anyone is
watching it or a ghost row; both are worse than orphaned bytes. The deleted
movie's page stays in the browser's forward history and answers `not-found`.
`Modal`'s focus containment is bespoke and must be right — a half-implemented
trap is worse than none — which is the cost of not having `<dialog>` under
jsdom, and why the Modal tests carry the most weight.

**Phasing.** Four slices, each checkable by looking:

1. **Amend the prototype.** `mol.Modal`, `feat.DeleteMovieDialog`, the `danger`
   enum, the rewired row and root state, COMPONENT-SPEC. One `docs:` commit;
   nothing in `src/`.
2. **The thinnest end-to-end slice.** `DELETE /api/movies/:id` (row only) →
   `api.deleteMovie` → `Modal` with the dismissal contract →
   `DeleteMovieDialog` + `useDeleteMovie` → `MenuItem.danger` + the row in
   `EditMenu`. A movie deleted from its page is gone from the browse home.
3. **The bytes.** `Media.removeMovieFolder`; the route calls it after the row.
   A deleted movie's folder is gone from the managed media directory.
4. **The edges.** "Deleting…", `404` counts as done, failure re-enables, Tab
   containment and focus return, the forward-stack landing on `not-found`.

**What this hands on.** `components/Modal` is the shell the 🔜 Export dialog
draws on, with its dismissal and focus contract already tested. `MenuItem`'s
`danger` is the only destructive row the prototype has, and stays the only one.
`removeMovieFolder` is what bulk import's review step would call if it ever
un-imports a row.

**What is now easy.** Nothing here is designed from scratch: the shell is the
Export dialog's, the button is the prototype's own unused variant, the row's
colours are already in `page.MoviePage`. Every navigation and error rule is one
the app already has — `useGoBack`, `not-found`, the form's silent failure — so
Delete adds no new UI state to the app.
