# Refactor plan: Settings hub — one trailing margin, one stale docblock, a tuple handed through, the tests read by behaviour, and the docs that close the initiative

> Source initiative: [`settings-hub`, issue #142](https://github.com/carlos-rezai/FamilyFlix/issues/142)
> Shipped by issues 143–147. Design log: `docs/design-logs/15-settings-hub.md`.
> Filed as issue 149. The docs-and-glossary slice filed as 148 is folded in
> here as Group 0 and Group 4, on the precedent of 140 into 141, so the
> initiative has one closing issue rather than two and ticks ✅ when this one
> closes.

## Problem Statement

The Settings hub was five build slices driven end to end by `issue-loop` —
the first initiative where every RED and every GREEN was a subagent's, with
nobody reading a diff between the commits. The maintainer's one instruction
was the scope, the same one the grill session ran under: _translate the
prototype 1:1 into the codebase, in its naming, conventions, patterns and
architecture_. What shipped is that: three **Settings groups** on the page,
each a **Section card** on the shared furniture; a **Codec report** read off
the component the player actually uses, through a seam the route never sees
behind; the **Language pool** spelled once and read three times; a
`settings` table behind the one SQLite door; a household preference the
player honours; a **Storage report** that agrees with Explorer; the **App
version** baked in. The surface was read against `page.SettingsPage.dc.html`,
`feat.CodecManager.dc.html` and `prim.Toggle.dc.html` for this filing, card
by card, and it is the prototype's — the same flex, the same paddings, the
same inks, every literal the prototype's own — with three exceptions, one of
them a pixel.

Round 14 said the debt left by a build that reads the log closely is small
and of a kind. This one is smaller again and of the same kind, plus the one
that five unattended slices were always going to leave: a docblock written
in Phase 1 about phases that had not happened, a test file per slice where
the convention is one per initiative, and leaves that count buttons three
times because three slices each asked "and did I add one?".

### 1. The About card carries a margin its prototype does not

Every **Section card** extends `Card` in `section.styles.ts`, which sets the
group's own gap under it — `margin-bottom: 32px`, the prototype's, on the
Playback and Storage cards. The prototype's About card is the last thing on
the page and carries no margin: the column's own bottom padding is what
follows it. `AboutCard` extends `Card` and inherits the 32px, so the page
scrolls 32px further than the prototype's. One pixel-level deviation on a
page otherwise 1:1, and the plan's one styles change.

### 2. A docblock from Phase 1 about phases that have since shipped

`LibrarySection`'s docblock, rewritten in #143 when `GroupHeading` moved out
to the shared furniture, ends: "Storage and About are later phases of the
settings-hub initiative." Both shipped two slices later. Nobody amended the
sentence because nobody was reading `LibrarySection` in #146 or #147 — the
one place a doc comment narrates a schedule rather than a design, and the
schedule ran out.

### 3. The tuple is copied to satisfy a prop that could take it

`SUBTITLE_LANGUAGES` is an `as const` tuple, so it is `readonly`.
`SubtitleRow`'s `languages` prop is `string[]`, so `MovieFormFiles` keeps a
local `LANGUAGES = [...SUBTITLE_LANGUAGES]` — a second name for the same
seven words, existing only to shed the `readonly`. The row reads its list
with `.map` and never writes it; the prop is the thing to widen. The
scanner's `DEFAULT_LANGUAGE: string = DEFAULT_SUBTITLE_LANGUAGE` is the same
shape — an alias that widens a literal type nobody needs narrowed — and goes
the same way.

### 4. Two route suites for one initiative, and a banner that stopped at Phase 1

`routes.settings.test.ts` opens by saying what it is: "the Settings hub's
slice of the router's tests, beside the import's and the export's" — one
file per initiative, because `routes.test.ts` is too large to take another.
Then #146 wrote `routes.storage.test.ts` beside it: the same listener, the
same `freshApi`, the same sandbox, for the fourth of the initiative's four
routes. Two files where the first file's own banner says one. And that
banner still reads "One route in this phase" over a file that has held three
since #144.

### 5. Leaves that narrate the slices, and three counts of the same buttons

`SettingsPage.test.tsx` was amended by three slices in turn, and each left
its mark: inline `// 15 — Settings hub, Phase n (issue #14n)` comments
inside the "composes X under Y" leaves, and a button count per slice —
"keeps the Library rows exactly as before" (five buttons, before the
settings land), "adds no button of its own with the Storage card" (six, with
the _Preferred language_ pill), and "composes the five sections and nothing
else" (six again, with the About checks). The middle leaf's count is the
last leaf's count; its one distinct assertion is `queryByRole('button',
{ name: /change/i })`, which belongs in the last. Elsewhere the slices left
mid-file phase banners — two in the settings feature's `api.test.ts`, one in
`routes.settings.test.ts`, one in `useSubtitles.test.ts`, one in
`db.test.ts` — where round 14's ruling is that the top-of-file banner keeps
the history and mid-file ones fold into it.

### 6. The docs the initiative owes

Issue 148's list, merged here: the journal entry for the build; CLAUDE.md's
folder map and README's tree, which name `SettingsHeader`, `LibrarySection`
and `ActionRow` under `features/settings/` and none of `section.styles.ts`,
`PlaybackSection`, `StorageSection`, `AboutSection`, `CodecManager`,
`CodecRow`, `codecView`, `useCapabilities`, `useSettings`,
`useStorageReport` or the feature's `api/`; `fetchSettings` in the shared
`api/` with its two callers; `MicrochipIcon` and `Toggle` in the primitives;
`formatBytes` in `utils/`; `types/settings.ts`, the capability types in
`types/playback.ts` and `appVersion.d.ts`; `spaceUsed` in the server's
`media/`; `decoders()` on the seam and `capabilities(component)` behind it;
migration 3 and `LibraryStorage`'s two settings methods; the four routes;
`__APP_VERSION__` in `vite.config.mts`; `useSubtitles` reading the
preference. COMPONENT-SPEC's `CodecManager` row, which gives it
`{ summaryLabel, codecs: CodecItem[], onBrowse }` and "list rows + dashed
upload zone" where it shipped with no props owning `useCapabilities` over
`CodecRow`s and no zone; its `Toggle` row, which has two props where the
primitive takes four; and its `SettingsPage` row, which still says
"`CodecManager` + default-subtitle FilterDropdown" for a page of five
sections. The glossary, which the grill session wrote ahead of the build and
which holds — every Settings-hub row was read against the code for this
filing — except that **Codec report** says "one **Codec row** per **Format
row model**" where the code's type is `CodecRowModel`, the name the design
log's own sketch gave it.

## Solution

Five groups, each a working tree after every commit: the record of the
build first, so the journal describes what shipped before this round moves
it; the pixel and the two shipping-code cleanups second, because they are
the smallest things and the one styles change should be early and visible;
the test files third, the storage suite folded before the banners are
rewritten; the leaf regroups fourth; the docs last, because the folder map
has to describe the tree the earlier groups leave. Twelve commits.

## Commits

### Group 0 — the record of what was built

1. **The journal's settings-hub entry.** `docs/dev-journal.md` gets the
   initiative's entry, dated by the last build commit (2026-09-18): what
   shipped across #143–#147, slice by slice; that it was the first
   initiative driven wholly by `issue-loop`, with the token counts the loop
   reported (the tracer bullet and the Subtitles rows both ran every step
   over the 100k budget, the three later slices under it — a note for
   `prd-to-issues`); the two judgment calls the subagents flagged — a
   decoder name must begin with a letter, which is what keeps the legend's
   `=` and the digit-named `012v` / `4xm` / `8bps` out of the report, and
   `windBackToV1` in `db.test.ts` dropping the `settings` table rather than
   migration 3 taking `IF NOT EXISTS`; the manual acceptance criteria no
   subagent could exercise (choose Spanish and reload; the Explorer
   Properties comparison; the version in the running app); what was
   deliberately not built (the drop zone, the ✕, _Change…_, _Software
   update_); and the follow-ups — which are this plan, by bare number.

### Group 1 — the pixel and the two cleanups

2. **The About card loses the group gap.** `AboutCard` sets
   `margin-bottom: 0` over what it inherits from `Card`: the prototype's
   last card carries none, and the column's bottom padding is what follows
   it. One line in `AboutSection.styles.ts`; the docblock says why. No test
   reads the margin (none reads any card's), and the check is the prototype
   beside the page.

3. **`LibrarySection`'s docblock stops scheduling.** The sentence about
   Storage and About being "later phases" becomes what is true: the four
   groups share the **Group heading** from `section.styles.ts`, and this one
   draws rows where the other three draw a card. Comment only.

4. **`SubtitleRow` takes a `readonly string[]`, and the form hands the tuple
   through.** The prop widens; `MovieFormFiles`' local `LANGUAGES` goes and
   `SUBTITLE_LANGUAGES` is passed by name, the way `PlaybackSection` already
   maps it; its docblock moves onto the prop. `detectSubtitleLanguage`'s
   `DEFAULT_LANGUAGE` alias goes the same way — `DEFAULT_SUBTITLE_LANGUAGE`
   is read where it was read. The form's "offers the seven names off the
   tuple" leaf and the scanner's four tuple leaves pass unchanged; `tsc` is
   the rest of the check.

### Group 2 — one route suite for the initiative

5. **`routes.storage.test.ts` folds into `routes.settings.test.ts`.** The
   twelve `GET /api/storage` leaves move under the settings suite's listener
   and helpers, their `process.chdir` / `afterEach` restore travelling with
   them; the storage file goes. Names and assertions unchanged; the verbose
   reporter before and after, diffed. Two route files fewer than the slices
   left, one where the banner said one.

6. **The route suite's banner says what the file holds.** "One route in this
   phase" becomes the four — `GET /api/playback/capabilities`, `GET
/api/settings`, `POST /api/settings/subtitle-language`, `GET
/api/storage` — and the mid-file "Phase 2" banner folds into it. Comment
   only.

### Group 3 — tests read by behaviour

7. **`SettingsPage.test.tsx` counts its buttons once.** "adds no button of
   its own with the Storage card — no Change…" folds into "composes the five
   sections and nothing else", which gains the `/change/i` query it lacked
   and keeps its count of six; "keeps the Library rows exactly as before"
   keeps its count of five — it is the pre-settings state and a different
   assertion. The inline `// 15 — Settings hub, Phase n` comments in the
   three "composes X under Y" leaves go; the file's top banner keeps the
   history. One leaf fewer, no assertion lost.

8. **Mid-file phase banners fold into their files' top banners.** The
   settings feature's `api.test.ts` (Phase 2 and Phase 4 docblocks between
   its three `describe`s), `useSubtitles.test.ts` (the Phase 3 docblock
   before "the Preferred subtitle language"), and `db.test.ts` (the Phase 2
   banner before "migration #3"): each file's top banner names every slice
   that touched it, on `LibrarySection.test.tsx`'s precedent, and the
   sections under it carry no dates. Comments only; the reporter diff is
   empty.

### Group 4 — the docs that close the initiative

9. **COMPONENT-SPEC says what shipped.** The `CodecManager` row: no props,
   owns `useCapabilities`, composes `CodecRow` — the tile, name, chips, `—`,
   **Status pill**, spacer — under the **Codec summary**; no drop zone and no
   ✕ until the **Playback component upload**; the `summaryLabel` copy
   amendment. The `Toggle` row: `{ checked, disabled?, onToggle, label }`,
   `aria-disabled` rather than `disabled`, the accessible name required. The
   `SettingsPage` row: five sections — `SettingsHeader`, `LibrarySection`,
   `PlaybackSection` (Codecs over the report, the divider, Subtitles with the
   **Auto-on toggle** and _Preferred language_), `StorageSection` (the path
   and the space line, no _Change…_), `AboutSection` (the brand row, no
   _Software update_). The Icons table gains `MicrochipIcon`.

10. **CLAUDE.md's folder map and README's tree.** `features/settings/`'s
    ten new units and its `api/`; `section.styles.ts` beside
    `maintainer.styles.ts`; `src/api/fetchSettings/` with its two callers
    named in the `api/` paragraph; `primitives/Toggle/` and
    `Icon/MicrochipIcon`; `utils/formatBytes/`; `types/settings.ts`,
    `types/playback.ts`'s capability types and `types/appVersion.d.ts`;
    `server/src/media/spaceUsed/`; `library/settings/`; the `playback/`
    lines for `ffmpegComponent` (`decoders()`, the listing pair) and
    `capabilities` (`(component)`, never the environment); `db/`'s
    migration 3; the four routes in the Settings hub feature paragraph. The
    **Features** section's Settings hub block rewritten per the design log's
    Q24 shape (the ticks themselves are commit 12). Tracked in both files on
    141's precedent.

11. **The glossary checked against what shipped.** **Codec report**: "one
    **Codec row** per `CodecRowModel`". Every other Settings-hub row —
    **Settings hub**, **Settings group**, **Section card**, **Codec row**,
    **Format catalogue**, **Container chips**, **Status pill**, **Codec
    summary**, **Settings**, **Preferred subtitle language**, **Auto-on
    toggle**, **Coming soon pill**, **Toggle**, **Storage report**, **Space
    used**, **App version**, **Playback component upload** — and the updated
    **Single-signal write**, **Playback component**, **Format support**,
    **Language pool** and **Stranded folder** rows read against the code for
    this filing and left where they hold. A session entry for this round
    noting the one amendment, by bare number.

12. **The journal's paragraph for the round, and the feature table ticks.**
    What each group changed, the test count before and after, what was
    deliberately left (the decision document below, in prose). Then README
    and CLAUDE.md tick, per the design log's Q24: **Settings shell** ✅;
    **Subtitle preferences** ✅; **Storage** ✅ with _Change…_ noted as the
    Electron shell's (README gains the Storage row CLAUDE.md already has);
    **Codec manager** split into _view installed codecs_ ✅ and _add a
    playback component_ 🔜; **Software update** stays 🔜. Closes 149; 142
    closed by comment alongside, 148 closed as folded in — by bare number,
    never a closing keyword. _(The three closures are done at closing time,
    not as commits.)_

## Decision Document

- **The About card's margin is the one styles change, and it is a
  subtraction.** The prototype draws the group gap on the Playback and
  Storage cards and not on the last; `Card` carries it because two of three
  cards need it, and the third overrides. The alternative — moving the gap
  off `Card` onto the section that follows — would change three files to
  fix one and put the prototype's `margin-bottom` where the prototype does
  not write it.
- **`readonly` on the prop, not a copy at the caller.** `SubtitleRow` never
  mutates its list; a molecule's prop should say what it does with what it
  is handed, and `readonly string[]` accepts both a tuple and an array. The
  `MOVIE_SORTS` precedent is handed to `FilterDropdown` the same way.
- **One route suite per initiative.** The banner `routes.settings.test.ts`
  opens with is the rule; `routes.storage.test.ts` was the slice boundary
  made a file. The suite stays named `settings` — the initiative's — rather
  than gaining a `playback` twin for the capabilities route, which is one
  route and reads the same `playback` the settings routes' listener already
  composes.
- **Three fetch-once hooks stay three.** `useCapabilities`,
  `useStorageReport` and the read half of `useSettings` are the same twenty
  lines with different names. A `useRead(fetcher)` was considered and
  rejected: each hook's name is what its test and its organism read, each
  docblock says which report and why it is blank until it lands, and a
  generic would move that "why" into a parameter. `useSubtitles`' settings
  read is the same shape again with a `movieId` dependency, which is the
  case a generic would have to grow an argument for. Recorded so the next
  round does not re-derive it.
- **The hand-rolled `fetch*` calls stay hand-rolled.** `fetchCapabilities`,
  `fetchStorageReport` and `fetchSettings` are six lines each in
  `fetchExportSummary`'s shape, as every reading call in the app is. A
  shared JSON-GET helper is a project-wide round, named as such since round
  13, and not this one.
- **`chooseSubtitleLanguage` keeps its `Promise<void>`.** The design log's
  sketch wrote `void`; the build returns the settled promise so a test can
  await the revert. It never rejects — the interface says so and a leaf pins
  it — and the section calls it with `void`. A hook action's return is the
  hook's to choose, and awaiting is worth more than matching a sketch that
  round 14 already ruled is a shape, not a signature.
- **`Toggle`'s `onToggle` stays required.** The prototype defaults it to a
  no-op; the spec and the log both list it required. A disabled switch
  passing `() => undefined` is one line in one place, and an optional
  handler on a control that exists to be pressed would be the wrong default
  the day the roadmap flips auto-on on.
- **`DECODER_LINE` keeps its letter-first rule.** The RED fixture listed
  `012v` and its exact-set assertion excluded it; the build's regex makes a
  decoder name begin with a letter, which also keeps the legend's `=` out.
  The digit-named decoders ffmpeg has are none the **Format catalogue**
  names, so no row is lost; documented in the regex's docblock and recorded
  in the journal as the one parsing decision a subagent made alone.
- **`windBackToV1` drops `settings`; migration 3 stays strict.** The
  pre-existing helper wound a database back to v1 by dropping what
  migration 2 added; once migration 3 existed, a "v1" database still had a
  `settings` table and re-opening failed. Loosening the migration with
  `IF NOT EXISTS` was rejected: a migration that tolerates its own table
  already existing is a migration that cannot tell a fresh database from a
  half-run one. The helper drops what a v1 database does not have.
- **The `ItemDesc` under _Subtitles_ keeps its 440px cap.** The prototype
  caps the _Codecs_ lede at `max-width: 440px` and leaves the _Subtitles_
  lede uncapped; the build draws both with `ItemDesc`. The Subtitles lede is
  one short sentence that never reaches the cap, so the rendered surface is
  the prototype's, and a second styled component for a difference no pixel
  shows is ceremony. Recorded so it is a decision and not an oversight.
- **`RowRule` and `Divider` stay two.** The same hairline on two margins
  (`6px 0` on a row, `22px 0` between halves); a `$margin` prop on `Divider`
  would save four lines and cost a prop whose two values are the two places.
- **The prototype's literals stay literal.** The knob's `#1a1109` is the
  `Button` and `SettingsHeader` precedent; the Installed pill's
  `rgba(138, 154, 107, 0.16)` and `0.3` are the `ExportModal` and `MetaLine`
  precedent — `tokens.css` has `--color-watched` and no soft variant.
- **`routes/index.ts` grew by 63 lines and is not this round's.** Four
  routes at ~1510 lines; the routes round named since round 13 is still its
  own round.

## Testing Decisions

- A good test here asserts what the maintainer can see or what the wire
  answers: a heading in order, a row under a summary, a pill showing the
  fetched value, a `200` with the shape, a byte count over a sandbox. Every
  commit but one changes no assertion; the check is the one the last five
  rounds used — the verbose reporter's leaf names before and after, diffed.
  The one: commit 7 folds one leaf into another, carrying its one distinct
  query, so the count drops by one and no assertion is lost. Baseline at
  filing: **4399 tests across 228 files**, `npm run typecheck` green,
  `eslint src server` clean (per #147's closing check). Expected after: 4398
  across 227.
- Group 1's pixel has no test, on round 14's rule that nothing reads a
  card's margin; the check is the prototype beside the page. The prop
  widening is checked by `tsc` and by the form's and the scanner's tuple
  leaves passing unchanged.
- Group 2 is checked by the moved leaves passing under the settings suite's
  listener — the same `freshApi`, the same sandbox — with the reporter diff
  showing twelve names moved and none changed.
- Group 3 changes nothing but where a test's name sits and one fold, on the
  delete, bulk-import and export rounds' precedent.
- Group 4 has no test; it is read.

## Out of Scope

- **The Playback component upload** — the drop zone, the component's size
  and remove, a writable slot, the drop-zone states. Its own initiative,
  with its own grill.
- **_Change…_ and _Software update_** — the Electron shell's, and the
  Snackbar system's.
- **Auto-on subtitles** — still 🧭; the **Auto-on toggle** stays disabled.
- **A shared read hook, a shared JSON-GET helper, a shared listening-API
  harness, a shared fetch double** — project-wide rounds, still not this
  one.
- **`routes/index.ts` at ~1510 lines** — the routes round.
- **Memoising `capabilities()` or `spaceUsed`** — the log priced both as a
  few hundred milliseconds on the maintainer's screen and named the cache as
  the fix if it ever is not; nothing says it is.
- **A "not supported" row** — the report's own rule says absence.
- **Validating the preference against the pool** — a vocabulary, not a
  constraint, on the **Subtitle**'s own precedent.
- **Any pixel but one.** The three cards and the toggle were read against
  their prototypes; commit 2 is the only styles change.

## Further Notes

The first initiative built wholly by `issue-loop`, and the shape of what it
left is worth recording. The code is the prototype's and the log's; a
subagent that reads a design log closely builds what it says. What it does
not do is read _back_: #146 and #147 amended `SettingsPage` and its test
and never opened `LibrarySection`, so a sentence about "later phases" sat
there for two slices; #146 wrote its route suite beside #143's rather than
inside it, because "the settings suite" was a file it had not been told
about. Every finding in Groups 1–3 is that kind — nothing wrong, nothing the
tests would catch, a thing a human reading the whole feature notices and a
subagent reading one issue does not. The refactor round is where that
reading happens, which is the argument for keeping it even when it is short.

Two of the five slices ran every step over the loop's 100k budget, and the
build reports say why: the tracer bullet carried the server seam, the types
promotion, the shared furniture and five frontend units; the Subtitles rows
carried a migration, a route pair, a new primitive, a hook and a scanner
change. Both were the design log's own phases, and both would have been two
issues each. For the next `prd-to-issues`: a slice that names a new
primitive _and_ a migration is two slices.
