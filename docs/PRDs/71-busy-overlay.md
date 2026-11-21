> **Initiative:** `busy-overlay`
> **Issue:** #675 (the PRD, step 53)
> **Design log:** `docs/design-logs/71-busy-overlay.md`
> **Handoff:** `docs/handoff/handoff-loading-states/`. Phase 1 amends it first: its table row 3 and row 5, its _Inside a row_ size, and the rule _Lock the control, not the layout_ (in the README and in `Loading States.dc.html`'s `rules`)
> **Build order:** step 53, **Busy overlay**. Logs 53 (**Loading states**) and 69 (**Silent waits**) rule wherever log 71 does not say otherwise; it amends log 69 Q3 and Q4. One new molecule (`BusyOverlay`), no server change, no migration.

## Problem Statement

Dad is in the review of a **Bulk import** and confirms a match. Three hundred milliseconds later the row's loader appears, and the row jumps: the small coloured dot beside the title is replaced by a spinner and _Saving match…_, so the title and the posters slide to the right while he is still looking at them. Half a second after the save, they slide back. Elsewhere the same thing happens in other shapes:

- A **Folder row**'s _N titles_ line becomes the loader beside its label, and the row can grow taller.
- A **Season choice**'s 112px held-poster caption has _Saving poster…_ squeezed into it, so it wraps.
- A **Busy button** holds its idle width as a `min-width`, so a wider **Busy label** still grows it: _Add_ → _Adding…_ beside the folder field, _Skip all_ → _Skipping…_, an Export's _Exporting…_ push what sits beside them.
- A **Delete** or **Reset** dialog, once its loader is **Shown**, is swapped for a second, bare `Modal`: the card is remounted, its pop-in runs a second time, and it shrinks from the dialog's height to the loader's. If the action fails, it pops in a third time at its old size.

Every one of these moves something the household was looking at or about to press, for a moment, for no reason.

## Solution

**A loader never moves what is around it.** Each of the three action loaders is drawn so that nothing around it changes size or position as it appears or goes:

- **The Busy row draws a Busy overlay.** Once **Shown**, a scrim with a light blur covers the whole row or card, and the 18px `inline` **Logo loader** with its _-ing_ label sits centred on it. The row underneath stays laid out exactly as at `idle`; its status slot keeps its dot, its _N titles_ line, its held-poster caption. The dim to .75 goes.
- **The Busy button keeps one width.** Its label and its Busy label are laid out in the same cell, the one not drawn hidden, so the button is always as wide as the wider of the two and the swap moves nothing.
- **The Dialog loader keeps its dialog's size.** It is drawn inside the dialog's own card, over its idle face, which stays laid out but hidden. The card is never remounted, its pop-in runs once, and a failure shows the idle face again in the same card.
- **The lock and the timing are unchanged.** A row is still `inert` and `aria-busy` from `waiting`; nothing is drawn until **Loader timing** says **Shown**; the hold after settling is the same.
- **The prototype is amended first**, so that the spec draws what is built.

## User Stories

1. As the household, I want a row I just confirmed to stay exactly where it is while it saves, so that I don't lose my place in the list.
2. As the household, I want the title, posters and buttons in a busy row not to slide when its loader appears, so that I don't misread or mis-press anything.
3. As the household, I want them not to slide back when the loader goes, so that the end of a save is as calm as its start.
4. As the household, I want a busy row to read as one whole thing working, not a row with a gap in it, so that I can tell at a glance which row is saving.
5. As the household, I want the loader and its words centred over the row, so that it is easy to see however wide the window is.
6. As the household, I want to still faintly see the row under the loader, so that I know which title is being saved.
7. As the household, I want the row's text blurred under the loader's words, so that _Saving match…_ is readable and not mixed with the title behind it.
8. As the household, I want the loader's words to read the same on a light poster or a dark row, so that it is always legible.
9. As the household, I want the overlay to fade in gently, so that it doesn't flash.
10. As the household, I want a quick save that settles before 300ms to show nothing at all, so that fast work stays silent, as it does today.
11. As the household, I want a slow save to show its loader for at least half a second once shown, so that it doesn't flicker, as it does today.
12. As the household, I want the mouse cursor to show progress over a busy row, so that I know pressing it will do nothing yet.
13. As the household, I want a busy row not to respond to presses or keys while it saves, so that I can't save it twice, as today.
14. As the household, I want a **Decision row** to keep its kind dot under the overlay, so that the row looks the same before, during and after.
15. As the household, I want a **Problem row** to keep its kind dot under the overlay, so that it behaves exactly like a Decision row.
16. As the household, I want a **Folder row** to keep its _N titles_ line under the overlay and never grow taller, so that the folder list doesn't jump.
17. As the household, I want a **Season choice** to keep its held-poster caption under the overlay, so that _Saving poster…_ never wraps into a 112px box.
18. As the household, I want a bulk press to show one loader in its button and leave its rows quiet, so that a hundred rows don't each draw a spinner, as log 69 decided.
19. As the household, I want _Add_ beside the folder field to stay the same width when it becomes _Adding…_, so that the field beside it doesn't shrink.
20. As the household, I want _Skip all_ to stay the same width when it becomes _Skipping…_, so that the buttons beside it don't move.
21. As the household, I want an Export's button to stay the same width when it becomes _Exporting…_, so that the dialog's footer doesn't shift.
22. As the household, I want a button whose busy words are shorter than its idle words to look exactly as it does today, so that nothing changes where nothing moved.
23. As the household, I want a button's busy words to keep their shine, so that it still reads as working.
24. As a screen-reader user in the family, I want a button to announce only the label it is showing, so that the hidden one isn't read out as well.
25. As a screen-reader user in the family, I want a button's accessible name to be its visible label at each phase, so that what I hear matches what is drawn.
26. As the household, I want a Delete dialog to keep its size when its loader appears, so that the screen doesn't jump as the delete starts.
27. As the household, I want the dialog not to pop in a second time when its loader appears, so that it doesn't look like a new dialog has opened.
28. As the household, I want the loader to replace the dialog's heading, words and buttons in the same card, so that it reads as the dialog becoming its own progress view, as the handoff draws.
29. As the household, I want no Cancel and no ✕ while a delete or reset runs, so that I can't half-stop a destructive action, as today.
30. As the household, I want Escape and a press on the scrim to do nothing while the loader shows, so that the dialog stays locked, as today.
31. As the household, I want a failed delete or reset to show its dialog again in the same card, with no third pop-in, so that I can read the error and try again calmly.
32. As a keyboard user in the family, I want focus to stay inside the dialog while its loader shows, so that Tab doesn't escape to the page behind.
33. As a keyboard user in the family, I want the hidden face's buttons out of the tab order while the loader shows, so that I can't press an invisible button.
34. As a screen-reader user in the family, I want the dialog to say it is busy while its loader shows, so that I know to wait.
35. As a screen-reader user in the family, I want the hidden face out of what is read out, so that I hear the loader's words, not a delete confirmation that no longer applies.
36. As the household, I want the four dialogs, _Delete title_, _Delete movie_, _Delete series_ and _Reset_, to behave the same, so that every destructive action looks alike.
37. As the household, I want the Export dialog's **Export ready** face to keep working as today, so that the change to dialogs doesn't break it.
38. As the household, I want the _＋ Add show folder_ box to keep behaving as today, so that a control that never moved is left alone.
39. As the household, I want the **Player notice**, the **Start-up splash**, the **Welcome hold**, the **Skeletons** and the live logs left as they are, so that nothing that already stayed still is touched.
40. As the maintainer, I want one stated rule, _a loader never moves what is around it_, in the handoff, so that the next loader is drawn the same way.
41. As the maintainer, I want the prototype amended before the build, so that the spec and the app agree.
42. As the maintainer, I want the overlay to be one reusable molecule that knows nothing of Decisions or folders, so that a future Busy row draws it in one line.
43. As the maintainer, I want every row's root to be a containing block at every phase, so that the root itself never changes as the overlay comes.
44. As the maintainer, I want the Button's measured width, its ref and its layout effect gone, so that the primitive is simpler and lays itself out.
45. As the maintainer, I want each dialog to keep one `Modal` in its tree, so that its open, focus and dismissal contract lives in one place.
46. As the maintainer, I want a row's box and a button's width measured before and after **Shown** in the walk, so that "nothing moves" is checked, not assumed.

## Implementation Decisions

- **One initiative, three faces.** The **Busy row** (the step as filed), the **Busy button** and the **Dialog loader**, the three faces log 71's audit found shifting, under one rule and one walk. Every other loading face is left as is.
- **Phase 1 amends the prototype first**: the loading-states README's row 5 and _Inside a row_ size draw the overlay; row 3 says the dialog keeps its size; the rule _Lock the control, not the layout_ says how, in the README and in the prototype's `rules`. No demo is redrawn; `screenshots/05-rules.png` keeps its old sentence.
- **`BusyOverlay`, a new molecule** in `components/`, exported from the `components` barrel. Its interface is one prop, `label: string`, the press's _-ing_ words. It composes the `LogoLoader` atom at `BUSY_ROW_LOADER_SIZE` (18px, `inline`) and knows no domain.
  - Its root is absolutely placed, `inset: 0`, `border-radius: inherit`, `cursor: progress`, a grid centring the loader.
  - The scrim is `bg` at .55 (`rgba(20, 17, 13, 0.55)`, the **Player notice** circle's), under `backdrop-filter: blur(4px)` (the `Modal` scrim's light blur), fading in on `ffFade` 0.18s; the loader keeps its own pop-in. The label is the loader's 15/600 `text`.
- **`busyRow` changes**: it becomes the root's `position: relative` at every phase, so the root never changes as the overlay comes; the opacity and the cursor go. `BUSY_ROW_LOADER_SIZE` stays, read by `BusyOverlay` and by _＋ Add show folder_. `busyRowLock` is unchanged.
- **The four Busy rows** (`DecisionRow`, `ProblemRow`, `FolderRow`, `SeasonChoices`) keep their status slot's content at every phase and draw `BusyOverlay` last in their root while their label is set (the Season choice on `busy === 'shown'`). The loader no longer takes the slot's place (amends log 69 Q4). `useBusyRow` still names the press and refuses a second; a bulk press still hands its rows `waiting` and draws its one loader in its Busy button (log 69 Q10).
- **`Button` (primitive)**: the face lays out its label and, when it has one, its `busyLabel` in one grid cell; the one not drawn is `visibility: hidden` and `aria-hidden`. The button is always as wide as its wider label. The held-width measure (`heldWidth`, its layout effect, its ref) goes. The `busyLabel` prop's contract and the shine are unchanged.
- **`Modal` takes `loader?: string`.** Given, the card is `aria-busy`, its idle face (header and ✕ included) stays laid out but `visibility: hidden`, and `DialogLoader` is drawn over it; the card takes focus, as on open, since its focused button is now hidden. Absent, `Modal` is unchanged. The card is never remounted across the change.
- **`DialogLoader` becomes that layer**: `inset: 0`, the 64px `LogoLoader` and its label centred on `surface2`, with no `Modal` of its own. Its `label` prop is unchanged.
- **The four dialogs** (`DeleteTitleDialog`, `DeleteMovieDialog`, `DeleteSeriesDialog`, `ResetDialog`) drop their early return of a `DialogLoader` for their one `Modal` with `loader` set once **Shown**. The lock (`locked`) is unchanged.
- **Rejected:** reserving the loader's width in the slot at `idle`; a fixed-width slot; a css helper with a pseudo-element (it cannot hold the loader); the `scrim` token at .72 (a page-wide dim); no blur; a fixed button `width`; holding the measured height on a second `Modal`; a blurred scrim on a dialog.
- **Kept as is:** the overlay sits inside the `inert` root, so its `status` is out of the accessibility tree while the root says `aria-busy`, as log 69's slot loader was. Moving the lock off the root is a change of its own.
- **Documents**: the handoff README and the prototype's rule (phase 1); `COMPONENT-SPEC.md`'s new `BusyOverlay` section and its `DialogLoader` and `Modal` sections; the feature checklist's step 53 entry, widened to the three faces; the docblocks of every unit touched. The glossary's **Busy overlay** section is already written (log 71).

## Testing Decisions

- A good test drives a unit through its public face and checks what the household would see or hear: the label drawn, the element that stays in the document, what is hidden and from whom, where focus is. It never checks a styled-component's class or which hook ran. Layout itself (that nothing moves) is not measurable in jsdom; it is checked by measuring in the walk.
- **`BusyOverlay`**: draws its label with the 18px loader; adds no control and takes no focus. Prior art: `DialogLoader.test.tsx`, `LogoLoader`'s tests.
- **The four Busy rows**: once Shown, the slot's content (the kind dot, the _N titles_ line, the held-poster caption) is still in the document alongside the overlay's label; at `idle` and `waiting` there is no overlay; the lock is unchanged. Prior art: the rows' existing log 69 tests and `useBusyRow`'s.
- **`Button`**: with a `busyLabel`, both labels are in the document at every phase, exactly one is `aria-hidden`, and the accessible name is the visible one (idle label at `idle` and `waiting`, busy label at `shown`); without one, the button is as today. Prior art: `Button.test.tsx`'s busy cases.
- **`Modal`**: with `loader`, the card is `aria-busy`, the loader's label is drawn, the idle face is still in the document but hidden from the accessible tree, focus moves to the card, and Escape and the scrim ask nothing while `locked`; going from no `loader` to a `loader` and back keeps the same card element (no remount). Prior art: `Modal.test.tsx`.
- **`DialogLoader`**: draws its 64px loader and label, and no dialog of its own. Prior art: `DialogLoader.test.tsx`.
- **The four dialogs**: once Shown, one dialog is on screen with the loader's label and the confirmation hidden; on a failure the confirmation and its error come back in the same dialog. Prior art: the dialogs' existing **Shown** and failure tests.
- Every slice starts RED (`tdd`); the acceptance is the walk in the dev app with each write held open, a row's box and a button's width measured before and after **Shown**.

## Out of Scope

- The faces log 71's audit lists as not shifting: _＋ Add show folder_, the **Component drop zone**, the **Player notice**, the **Start-up splash** and **Welcome hold**, the **Skeletons** and **Form skeleton**, a running Import or Sync's live log, the Busy label's shine.
- A Settings read drawing nothing until it lands: content arriving, the Product Rule's, not a loader.
- A **Skeleton**'s fidelity to the page that replaces it.
- Moving the lock off a Busy row's root so its overlay's `status` reaches the accessibility tree.
- Any change to **Loader timing**, the lock, `useBusyRow`, or which presses are Busy.
- Any server change.

## Further Notes

- The trade-off accepted: a row's root is now a containing block, so anything absolutely placed inside it is placed against the row; and an idle button whose busy label is the wider (_Add_, _Skip all_) is a few pixels wider than the prototype draws it.
- Implementation plan (log 71): 1. one row end to end (`BusyOverlay`, `busyRow`, the Decision row with its dot kept); 2. every Busy row; 3. the Busy button; 4. the Dialog loader; 5. the walk and the documents.
