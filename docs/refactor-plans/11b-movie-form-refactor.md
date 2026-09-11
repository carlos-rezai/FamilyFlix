# 11b — Movie form refactor, round two: the frontend against the prototype

> Source initiative: [`movie-form`, issue #97](https://github.com/carlos-rezai/FamilyFlix/issues/97)
> Shipped by issues 98–107. Design log: `docs/design-logs/11-add-movie.md`.
> Round one: `docs/refactor-plans/11-movie-form-refactor.md`, issue 109, closed.
> Journal entries: `docs/dev-journal.md`, 2026-09-10 (×2).
> Filed as issue 113.

Numbered `11b` rather than `12` because it is the same feature as `11`: the
plans are numbered after the design logs, and the next log is the settings
shell's.

Round one took the route layer — the file that had doubled — and named the
frontend out of scope in as many words: "`movie-form`'s eight units, `FileField`,
`SubtitleRow` and `Textarea` came out of the build clean and at reasonable
sizes. Touching them would be churn for its own sake." That was the right call
for a round whose headline was a 1661-line file. It also meant that no round
has yet read the frontend against the thing it was built from.

This round's instruction is the one the player's round was also given: **a 1:1
translation of the prototype into our codebase, using our naming, conventions,
patterns and architecture.** So every frontend unit the initiative shipped was
read against `feat.MovieForm.dc.html`, `mol.FileField.dc.html`,
`mol.SubtitleRow.dc.html`, `prim.Textarea.dc.html`, `prim.TextField.dc.html`,
the header of `page.SettingsPage.dc.html`, the container's own `formModel` in
`FamilyFlix.dc.html`, COMPONENT-SPEC, and CLAUDE.md's rungs — and against the
rest of the codebase for the pattern each one should have followed.

The area is green: **331 tests across the 14 files** this round touches,
`npm run typecheck` green, `eslint` clean. Nothing here is a bug. It is three
pixels the prototype draws and the code does not, one page doing a feature's
job, one control drawn twice at two rungs, four styled blocks written twice,
and a test file organised as a diary.

## Problem Statement

### 1. Three things the prototype draws that the code does not

Every value in the form was measured against the prototype. Three differ, and
none of the three is recorded anywhere — which is the part that matters, since
the journal's rule is that a deviation is fine when it is deliberate and
written down where it lives.

- **The focus state is missing.** `feat.MovieForm.dc.html` is the only file in
  the handoff that declares a `style-focus`, and it declares it four times:
  every text input on the form takes `border-color: var(--color-accent-line)`
  while it has focus. Nothing in `MovieForm.styles.ts` or `TextField.styles.ts`
  carries it. The form's fields focus with the browser's ring and nothing
  else. (The ring itself stays — `TextField.styles.ts` records why the
  prototype's `outline: none` was not carried over, and that ruling is not
  reopened. The accent border is _added_ to the ring, not swapped for it.)
- **The Files card is padded 24px, not 20px.** The prototype's card is
  `padding: 20px`; `MovieFormFiles.styles.ts` writes `theme.space.s5`, which is 24. Twenty is not a step on the spacing scale, and the same feature's own
  styles file already states the rule for that case: "`22px` is the prototype's
  own gap and is not a spacing token; the values it does share with the scale
  are written as tokens." By that rule the card is `20px`, literally.
- **The language list wears `Menu`'s face, not its own.** `mol.SubtitleRow`
  draws its dropdown smaller than a filter list: an 8px corner, 5px of padding,
  a `0 14px 40px` shadow, and 13px items on `8px 12px` with a 6px corner.
  `SubtitleRow.styles.ts` overrides `Menu`'s `Panel` for `top`, `min-width` and
  `max-height` and calls that "the only thing this row changes about `Menu`'s
  panel" — which is true, and is the problem. The list opens with a 12px
  corner, 6px of padding, a heavier shadow and 15px items on `10px 12px`,
  because that is what the filter dropdown's prototype draws and `Menu` was
  built from it. `Item` is exported from `Menu.styles.ts` beside `Panel`, so
  the same component-selector override reaches it.

One more is the same pixel and worth removing anyway: `Fields` carries
`margin-top: 28px` under a `Lede` whose own `margin-bottom` is 28px. The two
collapse, so the screen is right — but the prototype puts the gap on the lede
alone, and the top margin is a leftover from the three slices the lede was held
back through. It goes.

**Checked and found faithful**, so nobody re-measures them: the 760px column and
its `s6 s6 s8` padding; the 16/8 header row; the 30px serif heading; the lede's
`0 0 28px 58px` and its 500-weight emphasis; the 22px field stack and 18px
pairs; the 150px year; the caption's 13/600/0.2px; the 4px under-caption gap
and 9px chip gap; the card's 14px gap, its caption's 12/600/0.8px uppercase;
the 70px slot labels with 10px of top padding; the 42px dashed boxes with 6px
gap and 13/600 type; the filled row's `7px 10px` on an 8px corner; the 32px ✕
on a 7px corner turning the danger colour over a `.1` tint; the language
control's 34px height, 118px minimum, `0 10px` padding and 11px caret; the
14/32 actions row; the textarea's 96px, `12px 14px` and 1.5 line height; and
the Settings header's 780px column, 6px header gap, 30px lede gap, and the
44px accent button on a 10px corner with `0 20px` padding and a 17px glyph.
`Chip`'s `md` face is the chip the prototype draws, exactly as design log Q8
said it would be.

**Two recorded deviations stand:** the 12px corner over the prototype's inline
`10px` on `TextField`'s non-pill box and on `Textarea`, and `Textarea` without
its `minHeight` prop. Both are written where they live and neither is reopened.

**One found and not this feature's:** the prototype's `IconButton` sizes its
glyph at `round(size × 0.47)`, which at 42px is 20; every back pill in the app
passes `ChevronLeftIcon size={18}` — `GenreLayout`, `MoviePage`,
`SettingsPage` and `MovieForm` alike. Changing only the form's would leave the
app disagreeing with itself. Recorded here, left for a round that owns
`IconButton`.

### 2. A page that styles and navigates

CLAUDE.md's rule for `pages/` is four words: "composition only — no logic, no
styling." `SettingsPage` ships with a 91-line styles file — a sheet, a column, a
header row, a heading, an accent button with a hover, a glyph and a lede — and a
`useNavigate` whose one call is the ＋ button's `navigate('/add')`.

`MoviePage` also owns a styles file, and that is the precedent this one leaned
on. But `MoviePage`'s two blocks are _chrome_: a scroll container and a Back
pill, ruled on in the movie-detail round because the art area has to be sized
against the viewport and not the document. What `SettingsPage` owns is
_content_: the heading, the action that opens the **Movie form**, the line under
them. That is an organism. COMPONENT-SPEC already names the folder it belongs
in — `features/settings/CodecManager` — and the header is that folder's first
unit. The settings-shell initiative will fill the folder with the grouped
sections; the header should already be there when it does.

### 3. The same sheet, written twice — and a third is coming

`MovieForm.styles.ts` and `SettingsPage.styles.ts` both open with the same two
blocks: a full-height scroll container on `bg2`, and a centred column padded
`s6 s6 s8` and capped at a measure. `feat.ImportFlow.dc.html` opens with the
same two, at the form's 760px. Three screens, one sheet.

`layouts/chrome.styles.ts` predicted this in its own docblock: "Settings and the
player are two more screens due behind chrome that is neither layout's." It was
written when the browse and genre headers were found duplicated, and its
answer — a layout each screen composes rather than a base class one screen
inherits from — is the answer here. `GenreLayout` is the working precedent: a
layout that takes `children`, owns its scroll container, and learns nothing
about what fills it.

The layout stops at the column, deliberately. The header row — back pill,
serif heading, lede — is _also_ written in both screens, and `GenreLayout` even
shows how a layout can own a back pill with a `heading` slot. But the form's
heading is state its own hook holds ("Add a movie" / "Edit details" from
`editing`), and lifting it into a slot the page fills means a provider the way
the genre page has one — a restructuring the design log's Q13 ("the organism
owns the hooks") argues against and that a 1:1 round has no business doing.
And the two header rows are not quite the same row: the prototype gives Settings
a 6px gap under it and the form 8px; a 30px lede margin against 28px; a 780px
column against 760px. Those are almost certainly prototype noise, and the rule
for noise is to amend the prototype first. Until then the header row is each
screen's own, and the layout owns what the three screens genuinely share.

### 4. A feature redrawing a molecule's control

`MovieFormFiles.styles.ts` carries `AddTrack` and `TrackPicker`.
`FileField.styles.ts` carries `Choose` and `Picker`. They are the same two
blocks — the dashed 42px `<label>` that reads "＋ …", and the clipped, one-pixel
`<input type="file">` behind it — down to the docblocks explaining why the
control is a label. The feature's copy differs in one line: it resets the
input's value after a pick, so the same file can be chosen again after the
wrong row was removed.

CLAUDE.md: "Never build a one-off styled `<div>` inline inside a feature when a
primitive or component for it already exists." The control exists; it is just
not a unit. It is one control with no composition inside it, which makes it an
atom: `primitives/FilePicker/`. `FileField` composes it for its empty state, the
Files card composes it for the ＋, and the value reset is simply what the
primitive always does — harmless in a slot that unmounts on pick, necessary in
a list that does not.

### 5. Two molecules sharing four blocks

`FileField.styles.ts` and `SubtitleRow.styles.ts` each define a soft filled row
(`7px 10px`, `bg2`, `borderSoft`, 8px corner), an `IconSlot`, a mono `Filename`
with an ellipsis, and a 32px `Remove` button with the danger hover. The four
are character-for-character identical, and so is the ✕'s JSX around it —
`type="button"`, an `aria-label` and a `title` built from the same string, the
glyph. The `rgba(201, 122, 106, 0.1)` tint is written twice with no token
behind it, because the prototype writes it inline twice.

`SubtitleRow.styles.ts`'s own docblock says why: "the same soft box `FileField`
draws a filled slot in, because a track _is_ a filled slot with a language on
it." The sentence is right and the code does not yet say it. Two moves:

- The ✕ is a control with behaviour of its own — a name, a title, a glyph, a
  destructive hover — so it becomes an atom: `primitives/RemoveButton/`. Design
  log Q10 ruled that `✕` and `＋` stay literal glyphs rather than icon atoms; a
  button _around_ the glyph is a different rung and the ruling stands.
- The box, the slot and the name are furniture, not controls. They become a
  shared styles file at the molecule rung — `components/fileRow.styles.ts`, flat
  beside the folders on `layouts/chrome.styles.ts`'s exact precedent — that
  both molecules import from. Neither owns it; both extend it.

`TextField.styles.ts` has the same `IconSlot` a third time. It stays: a
primitive cannot import from `components/`, and one block at its own rung is
not worth a second furniture file.

### 6. Small duplications inside the feature

- `useMovieForm` builds `{ kind: 'picked', file, filename: file.name }` three
  times — for the video, the poster and a subtitle. `formValues/` already holds
  `storedFile`, the constructor for the other arm of the union; `pickedFile`
  belongs beside it.
- `createMovie` and `updateMovie` are the same nine lines twice: build the
  body, `fetch`, throw on `!ok` with the verb and endpoint in the message, parse
  the record. They differ in the verb and the endpoint. Both docblocks are
  worth keeping in full; the fetch behind them is worth writing once.

### 7. Comments and tests that outlived their slices

The build narrated itself slice by slice, as it should. Six phases later, these
sentences are false in shipping code or say nothing:

- `types/form.ts` — "The `stored` arm is unreachable from the **Add context**
  and arrives with the edit slice; it is here now because…" (the edit slice
  shipped); "the three file slots join it as their slices land" (they landed);
  the video slot's "now that the form can offer a film"; the subtitles' "the
  first value here that is a list of files".
- `MovieForm.tsx` — the inline comment on the lede ("held back through three
  slices because it names the subtitle files — until this one it would have
  been the screen describing a control it did not have") and the docblock's
  closing paragraph saying the same.
- `MovieFormFiles.tsx` — "the two slots this slice puts in it"; the poster
  paragraph ("a second instance of that same molecule and nothing new at that
  rung: what is new here is only…").
- `useMovieForm.ts` — the gate "arrived in halves: the title half was all a
  form with no video slot could check, and the video half landed beside it the
  moment that slot existed"; and the #109 header note's "At 352 lines", which
  is 378 today and will be wrong again — the argument does not need the number.
- `castNames.ts` — "the edit slice has to put a stored list back" is the reason
  both directions share a folder; it reads as history now and should read as
  the rule.
- `MovieForm.test.tsx` — "it has one more half of the gate to grow when the
  video slot lands"; "which is the whole of what this slice changed about the
  gate"; "the whole of what this slice did _not_ change about the gate";
  "holding the fields and the chips this slice gives it".
- `App.test.tsx` — a test named "renders the add-movie placeholder when /add is
  opened directly", under a docblock saying "`/add` still lands on a registered
  placeholder". It has been the form since #98.
- `AddMoviePage.test.tsx` — "no longer echoes the placeholder's copy" asserts
  that the words "lands here" are absent. No shipping file has contained them
  since the stub was deleted; the test cannot fail. It is deleted rather than
  reworded, and the count in the journal says so.

And the shape of `MovieForm.test.tsx` itself. It is **2143 lines** — the
largest test file in `src/` — with **22 top-level `describe` blocks in build
order**, five of them about the save gate ("the save gate", "…with the credits
fields", "…with the video slot", "…unchanged by the poster", "…unchanged by the
subtitles"), and helpers introduced at the line their slice reached: the
credits fields at 588, the rating segments at 808, the video removal at 1074,
the poster at 1258, the subtitles at 1426, the edit context at 1745. A reader
looking for "what does Save need" has to find five places. #81 refused to split
a test file "to hit a number" and #94 re-took that ruling at twice the size; it
stands here too. This is not a split. It is the same 129 tests, helpers at the
top and blocks grouped by what they assert, with **no assertion edited**.

### 8. The documents

- **COMPONENT-SPEC is behind the design log in three places**, exactly as it
  was behind the player until #94's three spec commits. §FileField gives `icon`
  as `'video'|'poster'|'file'` — the log's Q11 made it a `ReactNode`, and the
  shipped molecule also takes `accept`. §SubtitleRow says "local open state"
  and names `lang`, `langOptions`, `onLangChange` — Q12 built it on `Menu`, and
  the shipped props are `language`, `languages`, `onLanguageChange`, the
  glossary's words. §5's MovieForm row omits `IconButton` from what it composes
  and lists an `onCancel` the shipped form does not have: Cancel and the back
  pill are one call to the app's Back rule (Q21).
- **README still describes a "four-file shape" with a per-component
  `index.ts`**, in prose and twice in the tree comments, and **its `server/src/`
  tree omits `playback/`**. Both were listed as follow-ups in round one's plan
  and are still open.
- **CLAUDE.md's folder map** gains `features/settings/` and the new layout;
  **the glossary** gains the two terms this round names.

## Solution

Make the three pixels the prototype's. Give the settings header its rung and
the three maintainer screens their one sheet. Turn the twice-drawn picker and
the twice-drawn ✕ into atoms, and the twice-written file row into furniture.
Fold the two small duplications. Let the comments describe the code as it is
and the test file read by behaviour rather than by date. Bring the spec, the
README, CLAUDE.md and the glossary up to what shipped.

**Nothing about the wire changes and no test changes what it asserts.** The
area's 331 tests are the safety net for every code commit, and the only edits
they take are import paths, the two file moves, one deletion of a test that
cannot fail, and the reorganisation in Group F — which comes after every other
code change precisely so the tests as shipped are what verified them.

## Commits

Each commit leaves the suite green and the app working. Run
`node_modules/.bin/vitest run`, `npm run typecheck` and
`node_modules/.bin/eslint src server` on every one. The pixel commits are
additionally **checked by looking**, the way every screen in this project has
been: `npm run dev`, gear → ＋ Add a movie, and the form beside its prototype.

### Group A — the pixels

1. **The focus state.** The form's `Field` label targets `TextField`'s box by
   component selector and gives it `border-color: accentLine` on
   `:focus-within` — the same device `SubtitleRow` uses to reach `Menu`'s
   `Panel`, and the same reasoning: the prototype declares this state on the
   form, not on the primitive, so it lives on the form. The browser's ring
   stays, per `TextField.styles.ts`'s recorded ruling. Check by tabbing through
   the four fields. The textarea is not given it: the prototype's Description
   is a `prim.Textarea` import with no `style-focus`, and a 1:1 translation
   carries the omission too (see Further Notes).
2. **The Files card is `20px`.** One value, with the styles file's own
   token-or-literal rule cited beside it.
3. **The language list gets its own face.** `LanguageMenu`'s override extends
   from geometry to face — `Panel`'s corner, padding and shadow, `Item`'s
   padding, corner and size — and the docblock stops saying geometry is the
   only thing it changes.
4. **`Fields` drops its top margin.** Same pixel; the lede owns the gap.

### Group B — two atoms and one piece of furniture

5. **`primitives/FilePicker/`**, with its test. Props: the label the dashed box
   reads, the `accept` list, `onPick(file)`. It owns the clipped input, ignores
   a cancelled dialog, and resets its value after every pick so the same file
   can be chosen twice. Exported from the primitives barrel. Its test is
   `FileField.test.tsx`'s picker tests, moved to the rung they are about —
   `userEvent.upload` with `applyAccept: false`, for the reason that file
   already gives.
6. **`FileField` composes `FilePicker`.** `Choose` and `Picker` leave its styles
   file. Its tests pass unedited.
7. **`MovieFormFiles` composes `FilePicker`.** `AddTrack` and `TrackPicker`
   leave its styles file, and with them the one-off reset. Its tests and the
   form's pass unedited.
8. **`primitives/RemoveButton/`**, with its test. One prop — what it removes —
   from which the name and the title are built; the glyph and the danger hover
   are its own. `FileField` and `SubtitleRow` compose it; `Remove` leaves both
   styles files. The tint stays literal, once, with the prototype cited as the
   reason there is no token.
9. **`components/fileRow.styles.ts`.** The soft box, the icon slot and the
   filename, exported once at the molecule rung; both molecules import them.
   The docblock says what `chrome.styles.ts`'s does — furniture, not a base
   class — and `SubtitleRow`'s "a track _is_ a filled slot" sentence points at
   it.

### Group C — the sheet, and the settings header's rung

10. **`layouts/MaintainerLayout/`**, with its test. The `bg2` scroll container
    and the centred column, `width` in pixels defaulting to the form's 760,
    `children` and nothing else. Structure only, on `GenreLayout`'s pattern and
    `chrome.styles.ts`'s reasoning. The test asserts it renders what it is
    given and takes the width it is asked for.
11. **`AddMoviePage` composes the layout; `MovieForm` drops its sheet.** `Sheet`
    and `Column` leave `MovieForm.styles.ts`; the page is the layout around the
    organism, the way `GenrePage` is. The form's 129 tests pass unedited — none
    of them pins the sheet.
12. **`features/settings/SettingsHeader/`.** The header row, the ＋ button and
    the lede move into the organism, `useNavigate` and `useGoBack` with them.
    `SettingsPage.test.tsx`'s five tests move to `SettingsHeader.test.tsx`
    unchanged; the page keeps one test — that it composes the header in the
    sheet. `SettingsPage.styles.ts` is deleted, and the page is once again
    composition only.

### Group D — the two small duplications

13. **`pickedFile` beside `storedFile`.** Exported from `formValues/`, called
    three times from the hook, tested in `formValues.test.ts` with one case:
    the filename is the file's own name.
14. **One sender behind two saves.** A private function taking the verb, the
    endpoint and the values; `createMovie` and `updateMovie` keep their
    docblocks and become one line each. `api.test.ts` passes unedited.

### Group E — the comments

15. **Shipping code stops narrating slices.** The nine sentences in §7 across
    `types/form.ts`, `MovieForm.tsx`, `MovieFormFiles.tsx`, `useMovieForm.ts`
    and `castNames.ts`, each rewritten to describe the code as it stands — and
    the line count leaves the #109 header note.
16. **Test narration, and the test that cannot fail.** The four sentences in
    `MovieForm.test.tsx`, the placeholder name and docblock in `App.test.tsx`,
    and the deletion of `AddMoviePage.test.tsx`'s "no longer echoes the
    placeholder's copy". 331 → 330 in the area, and the journal says why.

### Group F — the form's test file, read by behaviour

Last among the code commits, so everything above was verified by the tests as
they were.

17. **Helpers to the top.** The field accessors, pickers, file factories,
    request readers and both render helpers gathered under the fixtures, in one
    place. No test body changes.
18. **Blocks grouped by what they assert.** The five save-gate blocks become
    one; the "saving" blocks become one; the edit-context blocks sit together.
    22 top-level blocks become however many behaviours there are — likely
    eight or nine — and the `describe` docblocks stop describing slices. The
    count is 129 before and 129 after, and `--reporter=verbose` diffed across
    the commit shows only moved names.

### Group G — the documents

19. **COMPONENT-SPEC says what shipped.** §FileField (`icon` as a node,
    `accept`), §SubtitleRow (`Menu`, the glossary's prop names), §5's MovieForm
    row (`IconButton`, no `onCancel`) — three amendments in one commit, on
    #94's precedent, each citing the design-log question that decided it.
20. **README stops describing a four-file shape**, in its prose and both tree
    comments, and its `server/src/` tree gains `playback/` with the one-line
    description CLAUDE.md gives it.
21. **CLAUDE.md and the glossary.** The folder map gains `features/settings/`
    and `layouts/MaintainerLayout/`; the glossary gains **Maintainer surface**
    (the sheet the three maintainer screens share — promoted from the phrase
    the **Maintainer** entry already uses) and **File picker** (the dashed
    "＋ …" atom that owns the hidden input, as distinct from the **File field**
    that composes it). The **File field** and **Subtitle row** entries are
    re-read against the new composition.
22. **The journal entry**, with the counts, what the round found, what it
    deliberately left, and the follow-ups below.

## Decision Document

- **The prototype's declared states are translated where the prototype
  declares them.** The focus border is declared by the form's prototype, not by
  the text field's, so it is written in the form's styles by component
  selector — the same device the subtitle row uses to reach the menu's panel,
  and the same reason: the state is the caller's, and threading it through the
  primitive would put a prop on it that only one caller could set. The
  textarea gets no focus border because its prototype declares none.
- **A non-token value is written literally, once, with the prototype cited.**
  The Files card's `20px` follows the rule the same styles file already states
  for `22px`. The danger tint follows the same rule inside the new atom.
- **A control drawn at two rungs becomes an atom.** The dashed file picker and
  the ✕ are each one control with behaviour of its own — a hidden input to own,
  a name and a title to build — so they become primitives rather than exported
  styled blocks two components wrap in identical JSX. Design log Q10's ruling
  that `✕` and `＋` stay literal glyphs rather than icon atoms is unchanged: a
  button around a glyph is a different rung from the glyph.
- **Styled blocks two molecules share become furniture at their rung, flat
  beside the folders.** `layouts/chrome.styles.ts` is the precedent and its
  docblock is the rule: each consumer extends the furniture and states only
  what is its own; nothing inherits from another component's styles file. The
  same-name block in a primitive stays where it is, because a primitive does
  not import from the rung above.
- **A layout owns what the maintainer screens genuinely share and stops
  there.** The scroll container and the centred column are the layout's; the
  header row is not, because one screen's heading is its own hook's state and
  the two rows differ by amounts only a prototype amendment can settle. The
  width is a prop in pixels, defaulting to the measure two of the three
  prototypes use.
- **A page composes; a header is an organism.** The settings header carries a
  heading, an action and a navigation, which is content and a decision; it
  moves to the settings feature folder COMPONENT-SPEC already names, and the
  page returns to composition only. The movie page's chrome ruling is
  unchanged: a scroll container sized for an art area is chrome, and stays with
  the page it was ruled for.
- **Constructors for both arms of the file-slot union live in one place.** The
  stored arm's constructor already lives in the values mapper; the picked arm's
  joins it.
- **One sender behind the two saves**, parameterised over the verb and the
  endpoint, which are the only two things they disagree about. If a third
  parameter appears the extraction is being forced — round one's own rule.
- **The test file is reorganised, not split.** The ruling from #81 and #94
  stands: size alone is not a reason. Helpers move to the top and blocks group
  by behaviour; no assertion changes and the count does not move.
- **The comments describe the code as it is.** A slice's narration is honest
  when it is written and false when the slice after it ships; the refactor
  round is where it is rewritten, on #94's Group I precedent. A line count in a
  header is a number that is wrong the next time the file is touched.
- **No wire change of any kind, and no pixel change beyond the three the
  prototype settles.** The **Stored file** / **Picked file** passthrough, the
  arrival-order subtitle slotting and the **Save gate** all survive exactly.
- **The prototype amendment this round surfaces is filed, not made.** The three
  maintainer sheets disagree by 2px in two places and 20px in one. That is a
  grill-me question for the settings shell, and until it is answered the
  header row stays each screen's own.

## Testing Decisions

**What makes a good test here.** Every test asserts behaviour through a public
surface — what a maintainer sees, presses, types, picks, or where the screen
goes — and never that a particular unit was called or how a styled block is
composed. The measure of this round is that **the area's tests pass unedited
through every code commit** except where a test moves with its unit or is
deleted because it cannot fail; a test that has to change what it asserts is
evidence of a behaviour change, and there are meant to be none.

**The pixel commits have no automated test.** The project has never asserted
CSS through jsdom and does not start now; the three fixes are checked by
looking, against the prototype, as every screen has been.

**Modules gaining tests:** `FilePicker` (the empty-state tests currently on
`FileField`, moved to the rung they are about, plus the value reset that lets
the same file be picked twice), `RemoveButton` (name, title, glyph, click),
`MaintainerLayout` (renders its children; takes its width), `SettingsHeader`
(the five tests moved from the page), `pickedFile` (one case).

**Modules whose tests move:** `SettingsPage` → `SettingsHeader` (five tests);
`FileField` → `FilePicker` (the picker tests).

**Tests deleted:** one — `AddMoviePage.test.tsx`'s assertion that a stub's copy
is absent, which no shipping file has contained since the stub went.

**Prior art to copy rather than invent:**

- For `FilePicker` — `FileField.test.tsx`'s own picker block: `userEvent.upload`
  with `applyAccept: false`, and its reason.
- For `RemoveButton` — `IconButton.test.tsx`, the project's model for a named
  glyph button.
- For `MaintainerLayout` — `GenreLayout.test.tsx` and `MainLayout.test.tsx`: a
  layout rendered with content and asserted on what came through.
- For `SettingsHeader` — the tests it inherits, and `LocationProbe` for the
  navigation.
- For the reorganised form test — the verbose reporter before and after,
  diffed: the same 129 names, in a different order.

**Coverage is already strong** — 129 on the form, 25 on the Files card, 15 on
`FileField`, 11 on `SubtitleRow`, 26 on `formValues`, 15 on `castNames`, and
the walk-throughs in `App.test.tsx` that open the form from Settings and press
Save. That is what makes the structural moves in Groups B and C safe to take
one commit at a time.

## Out of Scope

- **The wire.** Not a field, a status or a body shape; round one's rule holds.
- **`useMovieForm`'s test story.** Settled in round one and written in the
  hook's header; the only edit is the line count leaving it.
- **The two recorded deviations** — `radius.md` over `10px`, and `Textarea`
  without `minHeight`. Both deliberate, both written where they live.
- **The header row moving into the layout.** Blocked on the prototype
  amendment named below, and on a provider the design log argues against.
- **`IconButton`'s glyph size.** App-wide, not the form's; noted for a round
  that owns the primitive.
- **The browser focus ring.** `TextField.styles.ts`'s ruling to keep it stands;
  this round adds the prototype's border beside it, not instead of it.
- **`TextField.styles.ts`'s own `IconSlot`.** A primitive cannot import from
  `components/`, and one block is not a second furniture file.
- **The 70px label and its row in the Files card's subtitles section.** The
  prototype draws the label inline there rather than through `FileField`, and
  so does the code; a `FileField` that took children for its control would be
  a redesign of the molecule.
- **A progress surface, a snackbar, delete, the import context, the settings
  sections, TMDB, folder-path autofill** — none designed here, none built here.
- **The dev seed.** Its expiry is still the commit that ships bulk import.

## Further Notes

**The prototype amendment this round found, to raise in the settings shell's
grill-me.** `page.SettingsPage`, `feat.MovieForm` and `feat.ImportFlow` are one
sheet drawn three times, and they disagree in three places: the column is 780
on Settings and 760 on the other two; the header row's bottom margin is 6px on
Settings and 8px on the form; the lede's is 30px on Settings and 28px on the
form. Nothing in the design brief asks for a wider settings column or a
2px-tighter header. When the prototype is amended to one sheet, the header row
becomes `MaintainerLayout`'s with a `heading` slot and an optional `headerEnd`,
exactly as `GenreLayout` already does it — and the form gets there by lifting
`editing` into a provider or by passing its heading up, which is a decision for
that round.

**The second amendment, smaller.** The prototype's four inputs get an accent
border on focus and its textarea does not; `prim.Textarea` declares no focus
state at all. That is almost certainly an oversight in the prototype rather
than a decision, and it is worth one line in the same grill: does the synopsis
box focus like the fields above it? This round translates the prototype as it
is.

**Why the sheet is named for the maintainer and not called a sheet.** The
import flow's model already has a `sheetPath`, and "sheet" in this project is
about to mean a spreadsheet for an entire initiative. The glossary exists to
stop one word meaning two things; the **Maintainer** entry already says "every
maintainer surface (the **Movie form**, Settings, bulk import)", which is the
exact list of screens this layout draws.

**What this round is not.** Round one's Group 4 found a crash (`readBody`) by
giving a covered helper its first direct test. Nothing in this round is
expected to find anything of the kind: the frontend was covered _and_ examined,
because every unit of it was built by pressing it. The value here is the kind a
1:1 translation is measured by — three states the prototype draws now drawn,
one page returned to its rung, and a feature that stops re-drawing what it
already had.
