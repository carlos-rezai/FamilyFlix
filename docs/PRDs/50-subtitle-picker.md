> **Initiative:** `subtitle-picker`
> **Design log:** `docs/design-logs/50-subtitle-picker.md`
> **Issue:** #434 (the PRD, step 33)
> **Build order:** step 33, **Subtitle picker**. It ships as thin slices (log 50, _Implementation Plan_), the prototype revision first. Client only: no migration, no route, no wire change, no new **Setting**.

## Problem Statement

Some of our films and episodes carry more than one subtitle file: an English one and a Spanish one, or an English and an English SDH. FamilyFlix always shows the one `preferredSubtitle` picks (the first in the **Preferred subtitle language**, else the first in track order). The household cannot see the others at all.

The CC pill can only turn subtitles on and off. There is nowhere to say _which_ subtitles.

And an episode's choice is lost at _Up next_. After a whole evening with subtitles on, the next episode opens with them off again, and a parent has to find CC every time.

## Solution

**The CC pill becomes the Subtitle picker when there is a choice to make.** On a film or episode with two or more **Subtitles**, pressing CC opens a menu upward, the same panel as the **Audio picker**: _Off_ first, then one item per Subtitle in track order, the showing one marked (or _Off_ while off). Each item reads as its language (_English_, _Spanish_); when two files share a language, each gets ` · Track N` after it (_English · Track 1_, _English · Track 2_). A filename is never shown. Picking an item switches the subtitles there and then, mid-film; picking _Off_ hides the box.

**With one Subtitle nothing changes.** The pill stays the plain on/off toggle it is today, and with none it isn't drawn. The `c` key stays a toggle in every case: on shows the last-picked track (else the rule's), off hides it.

**The choice lasts the sitting.** Whatever a viewer last did by hand to the subtitles (a pick, the pill, `c`) is the **Subtitle choice**, held for as long as the player stays open. _Play now_ and _Up next_ open the next episode with subtitles on in the chosen language where a file speaks it (else on the rule's track), or off if the viewer turned them off. Leaving the player forgets it: subtitles still open off on every fresh open, and nothing is stored or posted.

**Switching back is instant.** A track's lines are read once per open; going back to a track already shown asks the server nothing.

## User Stories

### The picker

1. As a parent watching a film with two or more subtitle files, I want pressing CC to open a list of them, so that I can choose which subtitles I see.
2. As a parent, I want the list to open upward from the CC pill like the Audio picker's, so that both pickers in the transport row behave the same.
3. As a parent, I want _Off_ first in the list, so that turning subtitles off is always in the same place.
4. As a parent, I want the subtitle files listed in track order after _Off_, so that the list reads the same every time I open it.
5. As a parent, I want the showing subtitles marked in the list, so that I can see what is on before I change it.
6. As a parent with subtitles off, I want _Off_ marked, so that the list never claims something is showing when nothing is.
7. As a parent, I want each item named by its language, so that I read _Spanish_ and not a filename.
8. As a parent with two files in the same language, I want each named with ` · Track N` after the language, so that I can tell them apart.
9. As a parent, I want the track number to be the file's place in track order from 1, so that it matches the order the list shows.
10. As a parent, I want picking a language to switch the subtitles right away, mid-film, so that I don't have to restart anything.
11. As a parent, I want picking a language while subtitles are off to turn them on in that language, so that one press does both.
12. As a parent, I want picking _Off_ to hide the subtitle box, so that the list can turn subtitles off too.
13. As a parent, I want the list to close once I pick, so that the film is back in front of me.
14. As a parent, I want Escape or a press outside the list to close it without changing anything, so that opening it by mistake costs nothing.
15. As a parent, I want the player's controls to stay up while the list is open, so that the list doesn't vanish under my pointer.
16. As a parent using the keyboard, I want arrow keys and Enter to walk and pick in the list, so that it works like the other menus in FamilyFlix.
17. As a parent, I want keys pressed inside the open list to belong to the list, so that pressing a key there doesn't also seek or pause the film.
18. As a parent, I want the CC pill to look lit while subtitles are showing, whether it opens a list or not, so that the pill's face always tells me whether they're on.
19. As a parent using a screen reader, I want the pill announced as _Subtitles_ and as opening a menu when it does, so that I know what pressing it will do.

### One file, or none

20. As a parent watching a film with one subtitle file, I want CC to stay a plain on/off toggle, so that I'm not shown a menu with only one real answer.
21. As a parent using a screen reader on a one-file film, I want the pill announced as a pressed or unpressed toggle, so that its state is clear.
22. As a parent watching a film with no subtitle files, I want no CC pill at all, so that the player never offers what it can't show.

### The `c` key

23. As a parent, I want `c` to keep turning subtitles on and off, so that the key I already know still does what it did.
24. As a parent who picked Spanish and then pressed `c` twice, I want Spanish back on, so that the key returns to my pick rather than the default.
25. As a parent who never picked, I want `c` to show the track the household preference picks, so that it behaves as it does today.
26. As a parent on a film with no subtitles, I want `c` to do nothing, so that a stray key press is harmless.

### The choice across a sitting

27. As a parent who turned on Spanish subtitles in one episode, I want the next episode to open with Spanish subtitles on, so that I don't have to pick again every episode.
28. As a parent, I want that to hold whether the next episode came from _Play now_ or _Up next_ ran out on its own, so that the evening behaves the same either way.
29. As a parent who chose a language the next episode has no file for, I want that episode to open with subtitles on in its preferred track, so that I still get subtitles.
30. As a parent who turned subtitles off, I want the next episode to open with them off, so that off stays off.
31. As a parent who turned subtitles on with the pill or `c` (not the list), I want the next episode to open with them on too, so that every way of turning them on counts.
32. As a parent passing through an episode with no subtitle files, I want the episode after it to still follow my earlier choice, so that one bare file doesn't reset my evening.
33. As a parent, I want subtitles to open off when I start something fresh from the library, so that one evening's choice doesn't become a permanent setting.
34. As a parent, I want a choice of language to win over the household preference within the sitting, so that what I did by hand beats what was set in Settings.
35. As a parent, I want two files sharing my chosen language to resolve to the first of them in track order, so that the next episode's track is predictable.
36. As a parent, I want my choice never written into Settings, so that one viewer's evening doesn't change the household preference.
37. As the maintainer, I want the rule's own opening answer never reported as a choice, so that only what a viewer did by hand is carried.
38. As the maintainer, I want the choice treated the same for episodes and films, so that there is one behaviour to explain.

### Reading the lines

39. As a parent switching from English to Spanish and back, I want English back without a pause, so that switching costs nothing the second time.
40. As the maintainer, I want each track's lines fetched at most once per open, so that switching doesn't hammer the server.
41. As the maintainer, I want lines fetched only for a track while it is showing, so that files nobody shows are never read.
42. As a parent who switched tracks before the old track's lines arrived, I want the new track's lines drawn and never the old one's, so that the wrong language doesn't flash up.
43. As a parent, I want a subtitle file that fails to load to leave the film playing with no box, so that a bad file never interrupts the film.
44. As a parent, I want the lines to stay in step after a seek, whichever track is showing, so that switching tracks never breaks timing.

## Implementation Decisions

- **Names** (log 50 Q3): the **Subtitle picker** (the CC pill as a menu trigger with the `Menu` it opens, `SubtitleMenu`), the **Subtitle choice** (the sitting's last hand action: a language, or `null` for off) and the **Subtitle label** (what the picker draws for one Subtitle). The **Subtitle track** keeps its name: the one row showing. The glossary already carries all four. Rejected: "caption menu", "CC menu", "subtitle selector", "track menu".
- **Subtitle rows only** (Q1): the picker lists the Subtitle files the form, the importer and the folder scan attach. Streams embedded in an MKV are not read.
- **`preferredSubtitle` gains a third argument** (Q9), `choice`, as `preferredAudio` has: the first row (track order) in the choice's language, else in the **Preferred subtitle language**, else the first in track order; case-insensitive as today. A choice no row speaks falls to the preference. Its docblock's "nobody chooses" is rewritten.
- **`subtitleLabel(subtitle, subtitles)`** (Q8), new, pure, in the player feature: the Subtitle's language; when another row shares it (case-insensitive), ` · Track N` after it, N its place in track order from 1. The same tie rule as the server's audio labels, but client side, because a Subtitle's language is already the human name.
- **`useSubtitles` stays the one hook** (Q14) and gains the choosing.
  - New options: `choice?: string | null` (carried from an earlier player in the sitting) and `onChoice?: (language: string | null) => void` (told of every hand action), the same names as `useAudioTracks`.
  - Answers: `subtitles` (track order), `track`, `subtitlesOn`, `line`, `hasSubtitlePicker` (two or more rows), `toggleSubtitles`, and `choose(subtitle: Subtitle | null)`, where `null` is _Off_.
  - The opening state: on when `choice` is a language and the film has rows, off when it is `null` or absent. The track: a hand pick when there is one, else `preferredSubtitle(subtitles, language, choice)`.
  - `choose(row)` shows that row and turns subtitles on; `choose(null)` turns them off; `toggleSubtitles` flips on/off over the current track. Each reports `onChoice` with the showing track's language, or `null` (Q11). Nothing is reported at open.
  - Rejected: `hasSubtitleTracks`, which would misuse **Subtitle track**.
- **The choice's shape** (Q10): `string | null`. `null` covers both "no choice yet" and "chose off", since both open off. Rejected: `{ on, language }` or a third `undefined` state.
- **Cue lists held per track** (Q13): the single held `{ trackId, list }` becomes a map keyed by Subtitle id, so each track is fetched at most once per open. Still fetched only while on and only for the showing track. A list that arrives for a track no longer showing is kept, not drawn. A failed fetch is still no box, with no error state. Rejected: prefetching every track at open.
- **`SubtitleMenu`** (Q4, Q5), new organism in the player feature, `AudioMenu`'s sibling on `Menu`: the trigger is the existing `SubtitleButton` face (icon, _CC_, `$on` while showing), named _Subtitles_; the panel is `AudioMenu`'s (upward, `bottom: 54px`, `min-width: 220px`). Items: _Off_, then one `MenuItem` per Subtitle in track order labelled by `subtitleLabel`, `selected` on the showing row, or on _Off_ while off. Props: the rows, the showing track (or `null` while off), `onChoose(subtitle | null)`, `onOpenChange(open)`.
- **Toggle or menu button, never both** (Q5): as a toggle the pill keeps `aria-pressed`; as the picker's trigger it takes `Menu`'s `aria-haspopup`/`aria-expanded` and has no `aria-pressed`.
- **`PlayerControls`** (Q14) gains `hasSubtitlePicker`, `subtitles`, `subtitleTrack`, `onChooseSubtitle` and `onSubtitleMenuChange`, and draws `SubtitleMenu` in the pill's place when `hasSubtitlePicker`; otherwise the pill as today. It keeps its slot after the Audio picker in the right group.
- **`Player`** (Q7, Q12): one `menuOpen`, fed by both menus' `onOpenChange`, replaces `audioMenuOpen` in holding the chrome up. It takes `subtitleChoice` and `onSubtitleChoice` from `PlayerScreen` and passes them to `useSubtitles` as `choice`/`onChoice`.
- **`PlayerScreen`** (Q12): holds `subtitleChoice` beside `audioChoice` (`useState<string | null>(null)`) and hands it to each keyed `Player`. Leaving the player drops it; never stored, never posted. An episode with no Subtitles leaves it untouched.
- **`usePlayerKeys`** (Q6, Q7): `c` is still `toggleSubtitles`, `null` with no track. `isInMenu` already covers any `role="menu"`; only its docblock widens to name both pickers.
- **Episodes exactly as films** (Q15).
- **Prototype first** (Q16): `feat.PlayerControls.dc.html` gains the pill opening the menu (_Off_ then the tracks) and a `hasSubtitlePicker` prop beside `hasSubs`; `FamilyFlix.dc.html` gains a film with two subtitle files and keeps the choice on _Play now_. This revision lands before any build slice.
- **Rejected** (log 50, _Chosen and rejected_): embedded streams; a second button beside CC; a menu for one file; a cycling `c` key; filename labels; a choice stored per title; a choice written to the preference; auto-on subtitles; prefetching all tracks.
- **Slices** (log 50, _Implementation Plan_): 1. the prototype; 2. the picker (a film with two files switches language mid-film, and _Off_ hides the box); 3. the sitting (_Play now_ keeps a Spanish evening's subtitles on and Spanish); 4. the docs.

## Testing Decisions

- A good test drives a unit through its public face and asserts what a parent or caller sees: the items drawn and marked, the line on screen, the requests made, the choice reported. It never asserts on internal state or on which helper ran.
- **`preferredSubtitle`**: a choice beats the preference; a choice no row speaks falls to the preference, then track order; `null` and absent choices behave as today; case-insensitive; the first of two same-language rows in track order. Prior art: `preferredAudio.test.ts` and the existing `preferredSubtitle` tests.
- **`subtitleLabel`** (new): a lone language is just the language; two sharing one get ` · Track N` by track order, not arrival order; a third, distinct language beside a tie stays bare; ties are case-insensitive. Prior art: the server's audio-label tests.
- **`useSubtitles`** (the deep module): opens off with no choice and with `null`; opens on, on the choice's row, with a language; opens on the rule's row when no row speaks the choice; `hasSubtitlePicker` true from two rows; `choose(row)` switches the line and reports the language; `choose(null)` clears the line and reports `null`; `toggleSubtitles` reports on and off; nothing reported at open; switching back to a track already read makes no second request; a late list for a track no longer showing is never drawn; a failed fetch draws no line. Prior art: `useSubtitles.test.ts` and `useAudioTracks.test.ts`.
- **`SubtitleMenu`** (new): the trigger is named _Subtitles_, has `aria-haspopup` and no `aria-pressed`, and is lit while on; opening lists _Off_ then the labels in track order; the showing row (or _Off_) is marked; a pick calls `onChoose` with the row or `null` and shuts; `onOpenChange` reports open and shut. Prior art: `AudioMenu.test.tsx`.
- **`PlayerControls`**: the picker drawn in the pill's place with `hasSubtitlePicker`; the plain toggle with `aria-pressed` without it; no pill with no track. Prior art: `PlayerControls.test.tsx`.
- **`Player`**: with two files, picking Spanish draws Spanish lines and _Off_ hides the box; an open subtitle menu holds the chrome up as the audio menu does; `c` restores the last pick. Prior art: `Player.audioPicker.test.tsx`.
- **`PlayerScreen`**: a language chosen in one episode opens the next (_Play now_ and the countdown) on, in that language; off carries as off; an episode with no files passes the choice through to the one after; a fresh open starts off. Prior art: `PlayerScreen.audioChoice.test.tsx`.
- **`usePlayerKeys`**: no behaviour change; its existing tests stay green.

## Out of Scope

- Subtitle streams embedded in video files, including image formats (PGS, VobSub) (log 50 Q1).
- Auto-on subtitles; the dropped Settings row stays dropped (Q2).
- A subtitle choice remembered per title or across opens (Q2, Q12).
- Writing the choice to the **Preferred subtitle language** (Q2).
- A subtitle-style setting (size, colour, position) (Q2).
- Any server, wire, migration or Settings change.

## Further Notes

- This narrows log 10's "off on every film" to "off on every **open**": within a sitting, "on" now carries.
- The CC pill now has two faces (toggle and menu trigger), decided by the number of Subtitles; the prototype revision shows both.
- The checklist's step 33 row and entry, README's player paragraph, CLAUDE.md where it describes the player and its folder tree, and the docblocks of `preferredSubtitle` and `useSubtitles` change per log 50 Q17; ticked ✅ only after the refactor.
