# Refactor plan: Ultrawide margins — the wire call as a unit, one holder per preference, the frame's own suite, and the docs that close it

> Source initiative: [`ultrawide-margins`, issue #248](https://github.com/carlos-rezai/FamilyFlix/issues/248)
> Shipped by issues 249–250. Design log: `docs/design-logs/27-ultrawide-margins.md`.
> Plan: `docs/PRDs/27-ultrawide-margins-plan.md`.
> Filed as issue 252. This plan absorbs issue 251, the plan's Phase 3 (_the close_), so the
> initiative has one refactor issue: its docs are Group 5 here.
> The maintainer approved every recommendation in advance, with one standing
> instruction: _keep the codebase consistent with our naming and code
> conventions, patterns and architecture._

## Problem Statement

`ultrawide-margins` shipped in two slices. #249 added the `ultrawide-margins`
key and its **Single-signal write**, `DisplayPreferenceProvider` /
`useDisplayPreference` in `App/`, the `ContentFrame` layout route around every
route but the player's two, the **Display group**'s Toggle, the `layout` token
and the row furniture's move into `section.styles.ts`. #250 moved the
**Snackbar stack** to the frame's corner. Every log-27 ruling was read against
the code for this filing. Q1–Q4 (a cap at 1920px, one toggle, no media query),
Q5–Q7 (the key, the default, the route and its `400`s), Q8–Q12 (the whole
screen framed, the player outside, the seam in `App/`), Q13–Q15 (the provider,
uncapped before the read, no motion), Q16–Q17 (the stack moves, nothing else
does) and Q18–Q20 (the group, its copy, the furniture) all hold, except where
the items below say otherwise.

The pattern earlier rounds found holds again: the debt an `issue-loop` build
leaves is small, and it is made of what a subagent reading one issue can't
see. Here it is one unit the plan named and the build inlined, one hook still
holding a value the log took away from it, one component whose suite lives in
its caller, and the paperwork.

### 1. The wire call the plan named isn't a unit

The plan says: _"The wire call `saveUltrawideMargins` has one caller, so it
lives beside the provider."_ The build has no `saveUltrawideMargins`.
`DisplayPreferenceProvider` holds the endpoint as a module constant, declares
its own `isBoolean` guard, and calls `postValue` inline in its setter. Every
other single-signal save in the app is a named call with its own leaves:
`saveSubtitleLanguage` (with `isLanguageEcho`) beside `useSettings`,
`saveWatched`, `saveFavorite`, `saveRating`, `saveResume`. The wire contract
for this route — `POST` the boolean, take a boolean echo, reject on a non-2xx
— is proven today only through the provider's suite, as the effect a fetch
mock observes.

The fix is the plan's own words. `saveUltrawideMargins(on)` becomes a unit
folder in `App/` beside the provider, with its suite on `saveWatched`'s shape,
and the provider calls it. `App/`'s units are imported by path, with no
barrel, so a call folder there follows the same rule `src/api/` does. It
doesn't move up to `src/api/`, because it has one caller. It doesn't go into
`features/settings/api/`, because `App/` would then be importing a feature's
wire.

### 2. `useSettings` still holds a copy of the preference

Log 27 Q13 ruled: _"`useSettings` keeps the subtitle language and nothing
else."_ The build widened `Settings` with `ultrawideMargins`, and
`useSettings` holds the whole `Settings | null`. So the Settings page holds
the preference twice: once in `DisplayPreferenceProvider`, which follows every
flip, and once in `PlaybackSection`'s `useSettings`, which reads it on mount
and never updates it. Nothing reads the second copy today. The first caller
that does gets a stale value with no error. The hook's docblock still calls the
language _"the household's one preference"_.

The build also had to touch eleven fixtures across `useSettings.test.ts` and
`PlaybackSection.test.tsx` to add `ultrawideMargins: false` to values the
hook should never have carried. That is the visible cost of the wider state.

The fix is the ruling. `useSettings` holds `subtitleLanguage: string | null`,
and `PlaybackSection` reads that field. `fetchSettings` still answers the
whole `Settings`. The hook keeps one field of it, the way the provider keeps
the other.

### 3. A component whose suite lives in its caller

`ContentFrame` has two of the three files every component carries. Its
docblock says _"Its behaviour is asserted through `App` in
`App.contentFrame.test.tsx`."_ The folder convention has no exception for that,
and the codecs-page round settled the rule this breaks: a unit's suite proves
what the unit is, and a caller's suite proves what the caller hands it. The
frame's own rule is three states. On, it is capped at the measure with auto
side margins. Off, or `null`, it is uncapped. And it renders its outlet. That
rule is proven today only through the whole app on a `MemoryRouter`, with
twelve routes and six fetch branches around it.

`App.contentFrame.test.tsx` should keep what the route table decides: which
routes are framed, that the player's two are not, that the frame follows the
provider's read as it lands, and the Toggle's round trip on `/settings`. Its
_"draws no cap while the preference is off"_ leaf is the frame's own rule, so
it moves.

### 4. Small leftovers in shipping files

- **The stack spells `right` twice.** `SnackbarProvider.styles.ts` declares
  `right: s5`, then adds a second `right: max(…)` in a conditional `css` block
  while `$framed`. It works through cascade order. `ContentFrame.styles.ts`,
  written in the same initiative, states only what changes. Every other
  conditional value in the styles tree (the `Row`'s `$last` padding, for one)
  is one declaration choosing its value. No pixel moves.
- **Docblocks over the measure.** #249 spliced the Display section into
  `SettingsPage`'s docblock, and two lines now run to 102 and 122 columns.
  `App`'s route paragraph was spliced twice before this initiative (the
  episode player and the Sync), and runs to 118. This initiative rewrote the
  paragraph after it and left it alone. It also doesn't name the season page
  or the Codecs page, two of the routes the frame now caps.
- **A Settings page leaf named for the old order.** _"composes the Network
  section between Playback and Storage"_ still passes, because Playback is
  still above Network. But Network now sits under Display, and the leaf's own
  comparison is against _Preferred language_.

### 5. The docs the initiative owes — issue 251, merged

Phase 3 of the plan, filed as 251, is moved here in full, because the standing
rule makes the close the refactor's last commit anyway:

- **CLAUDE.md.**
  - The _Settings Hub_ section says _five_ **Settings groups** and lists
    Library, Playback, Network, Storage and About. It also doesn't list the
    new route or the widened read.
  - The folder tree doesn't name `ContentFrame`, `DisplayPreferenceProvider`,
    `useDisplayPreference`, `DisplaySection` or `tokens/layout.ts`. `App/`
    still says _"the two units below"_. The feature line still says _five_
    groups. `section.styles.ts` isn't described as holding the row furniture.
    `theme.ts` doesn't say it mounts `layout`. The server's `settings/` line
    names `setSubtitleLanguage()` alone.
  - The types line's `settings.ts` doesn't name `ultrawideMargins` or
    `DEFAULT_ULTRAWIDE_MARGINS`.
  - Step 11 and the _Ultrawide margins_ feature line are still 🔜, and
    _(next)_ is still on 11.
- **README.** The same ✅, _(next)_ and six groups.
- **The glossary.** It was written with the log, but one neighbour is stale:
  the **Network group** is still _"between Playback and Storage"_.
- **The dev journal.** It has no entry for the build, and no entry for this
  round.

## Solution

Six groups, each leaving a working, green tree after every commit:

0. **The record.** The build's journal entry comes first, so it describes what
   shipped before this round changes anything.
1. **The shipping tidies.** No pixel and no behaviour changes.
2. **The wire call as a unit.** First the unit, then its one caller.
3. **One holder per preference.** `useSettings` narrowed to the language.
4. **One suite per thing it proves.** The frame's own suite, and the Settings
   page's stale leaf.
5. **The docs.** These come last, because they describe the tree the earlier
   groups leave. They close 248, 251 and this issue.

That's eleven commits. None changes what the maintainer sees.

## Commits

### Group 0 — the record of what was built

1. **The journal's ultrawide-margins build entry.** A new top entry,
   _Ultrawide margins (issues #249–#250)_, using the earlier build entries'
   sections:
   - what shipped, slice by slice: the server key and route, the provider and
     hook, the frame as a layout route, the Display group, the furniture's
     move, the token and its theme mount, then the stack's offset;
   - the prototype amendments (Settings page and `COMPONENT-SPEC`'s Content
     frame note) riding #249's `feat:` commit, as the plan said;
   - the judgement calls the subagents made alone that the log didn't name:
     - the wire call inlined into the provider (item 1);
     - `useSettings` left holding the whole `Settings` (item 2);
     - `ContentFrame` proven only through `App` (item 3);
     - the stack's `right` written twice (item 4);
     - the stack reading `DisplayPreferenceContext` directly rather than
       through the throwing hook, so that the eighteen suites which mount the
       stack alone read as off (kept — see the Decision Document);
     - the furniture guard's source reader joined with `node:path`, because
       Vite rewrote the `new URL` template as an asset glob;
   - what was deliberately not built: everything log 27 _Not built_ lists;
   - the test and file counts at the end of the build, **6891 tests across 402
     files**, measured at `1f5dfed`;
   - the follow-ups, which are this plan, by bare number.

   Docs only.

### Group 1 — shipping files tidied, nothing moved

2. **The two docblocks rewrapped.**
   - `SettingsPage`'s docblock is rewrapped to the folder's measure, with no
     change of words.
   - `App`'s route paragraph is rewrapped, and gains the two framed routes it
     never named: the season page at `/series/:id/season/:n` and the **Codecs
     page** at `/settings/codecs`.

   Comments only, no test.

3. **The stack's `right` is one declaration.** `Stack` declares `right` once,
   its value chosen by `$framed`: `s5`, or the `max(…)` over the **Content
   measure**. The conditional `css` block and its import go if nothing else
   uses them. `SnackbarProvider`'s five _Ultrawide margins_ leaves already read
   the computed `right` and every other property in all three states, so they
   are the characterization. They're green before the edit and after, and no
   leaf is added.

### Group 2 — the wire call as a unit

4. **`saveUltrawideMargins`, with its suite.** It's a new folder in `App/`
   beside the provider: `saveUltrawideMargins(on: boolean): Promise<boolean>`
   over `postValue`, with its own echo guard named for its route
   (`isMarginsEcho`, after `isLanguageEcho`). The docblock follows
   `saveSubtitleLanguage`'s: one caller, so it stays beside the provider, and
   the read it pairs with, `fetchSettings`, lives in `src/api/` because the
   player asks for it too. The suite follows `saveWatched.test.ts`:
   - it `POST`s `{ value }` as JSON to `/api/settings/ultrawide-margins`;
   - it sends `false` to the same route rather than a second one;
   - it answers the echo, not what was asked;
   - it falls back to the asked value on an unusable echo, including the
     string `"true"`;
   - it rejects on a non-2xx;
   - it rejects when the request itself fails.

   There's no caller yet, so nothing else changes.

5. **The provider calls it.** `DisplayPreferenceProvider` drops its endpoint
   constant, its `isBoolean` guard and its `postValue` import, and its setter
   awaits `saveUltrawideMargins(on)`. The provider's twelve leaves, the
   section's and the App suite's all pass unchanged, which is the proof that
   the move was pure.

### Group 3 — one holder per preference

6. **`useSettings` holds the subtitle language alone.**
   - `SettingsState.settings: Settings | null` becomes
     `subtitleLanguage: string | null`, with the same **Blank until it
     lands** contract. `chooseSubtitleLanguage` sets, keeps the echo and puts
     back that one string.
   - The docblock says it holds the **Preferred subtitle language**, and that
     **Ultrawide margins** is `DisplayPreferenceProvider`'s (log 27 Q13). It
     stops calling the language the household's one preference.
   - `PlaybackSection` reads `subtitleLanguage` where it read
     `settings?.subtitleLanguage`, and draws the pill when it isn't `null`.
     Its docblock's _"while the settings are `null`"_ becomes _"while the
     language is `null`"_.
   - `useSettings.test.ts` restates its leaves against the new field. Each
     leaf keeps its name and meaning, and the `ultrawideMargins: false`
     padding #249 added to its expectations goes. The read fixtures stay
     whole `Settings`, because that is what the route answers. One leaf is
     added: _"keeps the subtitle language alone, not the rest of the
     settings"_. It asserts that the hook's result has no `settings` and no
     `ultrawideMargins` key.
   - `PlaybackSection.test.tsx` passes unchanged. Its fixtures are route
     answers, and they keep the whole shape.

### Group 4 — one suite per thing it proves

7. **`ContentFrame` gets its own suite.**
   - `ContentFrame.test.tsx` renders the frame as a layout route on a
     `MemoryRouter` under `ThemeProvider`, with
     `DisplayPreferenceContext.Provider` handing it a value directly (no
     fetch). It has four leaves:
     - on: `max-width: 1920px` with auto side margins;
     - off: no `max-width`;
     - `null`: no `max-width`;
     - the child route renders inside it.
   - The docblock's last sentence becomes: the route table that decides which
     routes are framed is proven through `App` in `App.contentFrame.test.tsx`.
   - `App.contentFrame.test.tsx` loses _"draws no cap while the preference is
     off"_, which is now the frame's own leaf, and its file docblock says the
     suite proves the route table's shape. The other seven leaves stay as
     they are.

8. **The Settings page's Network leaf names the order it checks.** It becomes
   _"composes the Network section between Display and Storage"_. Its
   _Preferred language_ comparison becomes the _Ultrawide margins_ row's title
   before _Network_, and its comment cites log 27 beside log 23. The test
   stays green, and there's no shipping change.

### Group 5 — the docs that close the initiative (issue 251's scope)

9. **The glossary.** The **Network group** entry's position becomes _between
   Display and Storage_. Everything else log 27 added is read against the
   final tree and left alone if it still describes it, which is expected.
   Docs only.

10. **CLAUDE.md and README.**
    - CLAUDE.md, the _Settings Hub_ section:
      - _six_ **Settings groups** — Library, Playback, Display, Network,
        Storage, About;
      - the `GET /api/settings` bullet answers
        `{ subtitleLanguage, ultrawideMargins }`, with both defaults applied;
      - `POST /api/settings/ultrawide-margins { value }` → `{ value }`, `400`
        for anything but a boolean;
      - one line saying the preference is held app-wide by
        `DisplayPreferenceProvider`, and the **Content frame** follows it.
    - CLAUDE.md's folder tree:
      - `App/` names its six units: the two providers, the two hooks,
        `ContentFrame` and `saveUltrawideMargins`. The _"the two units below"_
        wording goes.
      - `tokens/` gains `layout.ts`, and `theme.ts`'s line says it mounts
        `layout`.
      - `features/settings/` says _six_ groups and gains `DisplaySection/`.
        `section.styles.ts`'s line names the **Setting row** furniture.
        `useSettings/`'s line says it holds the language alone.
      - The server's `library/settings/` line names `setUltrawideMargins()`
        and the `ultrawide-margins` key among the preferences.
    - CLAUDE.md's types line: `settings.ts` adds `DEFAULT_ULTRAWIDE_MARGINS`,
      and `Settings` names `ultrawideMargins`.
    - CLAUDE.md: build order step 11 ✅, _(next)_ moves to step 12 (**Default
      poster**), and the Settings hub feature line _Ultrawide margins_ ✅.
    - README: the same ✅ in the feature table and the build order, _(next)_
      on 12, and six groups wherever it counts them.
    - `COMPONENT-SPEC.md` already carries `page.SettingsPage ✅` with Display,
      and the Content frame note. It is read against the final tree and not
      expected to change.

    Docs only.

11. **The journal's refactor entry.** A new top entry, _Ultrawide margins
    refactor (issue 252)_, using the earlier rounds' sections:
    - what each group changed;
    - leaves added, removed, moved and restated, by name;
    - the test and file counts before (6891 across 402) and after;
    - that `tsc -b` and `eslint src server electron .husky` are clean;
    - that no commit changed a pixel;
    - that 251 was merged into this plan, and why;
    - anything the round surfaced, by bare number.

    It closes 248, 251 and this issue together.

## Decision Document

- **The plan's named unit is built as named.** `saveUltrawideMargins` lives
  beside its one caller in `App/`, as its own folder with its suite, the shape
  `src/api/` uses. It does not go to `src/api/` (one caller) or into
  `features/settings/api/` (`App/` would import a feature's wire). The echo
  guard is named for its route, after `isLanguageEcho`.
- **One holder per preference.** `DisplayPreferenceProvider` holds **Ultrawide
  margins**, and `useSettings` holds the **Preferred subtitle language**. Both
  read the one shared `fetchSettings` and keep their own field. `Settings`
  stays the wire's whole shape, and no hook stores a field it never updates.
- **`useSettings` keeps its name.** It is still the Settings feature's read of
  the settings route. Renaming it would be churn across the folder tree and
  three suites, for a name that doesn't mislead once its docblock says what it
  holds.
- **The stack keeps reading the context directly.** `SnackbarProvider` uses
  `useContext(DisplayPreferenceContext)` rather than `useDisplayPreference()`,
  so a missing provider reads as off. Eighteen suites mount the stack without
  the display provider, and the stack is drawn the same with no preference as
  with a `null` one. Wrapping all eighteen would add a provider to suites
  whose subject has no opinion about it. The throwing hook stays the contract
  for anything that writes or draws the preference: the Display group and the
  frame.
- **`$capped` and `$framed` stay two names.** Each describes its own element:
  the frame is capped, and the stack is placed at the frame's corner. Forcing
  one name would make one of them describe the other element.
- **The furniture guard stays in `DisplaySection`'s suite.** "Both sections
  import the row furniture from the shared styles" is a structural rule no
  behaviour can show, the kind of guard the codecs-page round kept
  (`NavigationRow`'s _"the two rows it replaced"_). It sits with the second
  caller, which is where `NavigationRow`'s sits. `section.styles.ts` is a flat
  furniture file like `maintainer.styles.ts`, and giving it a suite would
  graduate it into a folder.
- **A unit's suite proves the unit; a caller's suite proves what it hands
  it.** This is the codecs-page round's rule, applied to `ContentFrame` and
  `App`.
- **The close is merged.** 251's acceptance criteria are commit 10's, and its
  journal entry is commits 1 and 11. One refactor issue closes the initiative.
- **No route, schema, type, server or prototype change.** The route, the key,
  `Settings`, `DEFAULT_ULTRAWIDE_MARGINS`, the token, the frame's rule, the
  stack's offset and the Display group's surface all stay as built.

## Testing Decisions

- **A good test here asserts what the household can see or what the wire
  carries.** That means the frame's computed width and margins, the stack's
  computed `right`, the Toggle's state, and the request a save makes and what
  it answers. A leaf about a hook's state asserts the field a caller reads,
  not the fixture's shape.
- **Characterization before change.** Commit 3 is guarded by the five stack
  leaves already in place. Commit 5 is a pure move guarded by the provider's
  twelve leaves. Commit 6 restates the hook's leaves without changing their
  meaning, and `PlaybackSection.test.tsx` passing unchanged is its proof.
- **Modules tested:**
  - `saveUltrawideMargins`: new, six leaves.
  - `ContentFrame`: new, four leaves.
  - `useSettings`: leaves restated, plus one.
  - `App.contentFrame`: one leaf moved out.
  - `SettingsPage`: one leaf renamed and retargeted.
  - `DisplayPreferenceProvider`, `DisplaySection`, `SnackbarProvider`,
    `PlaybackSection`, `useDisplayPreference`, the server's settings and
    route suites: unchanged.
- **Prior art:**
  - `saveWatched.test.ts` and `features/settings/api/api.test.ts` for a
    single-signal call.
  - `useSnackbar.test.tsx` and `NavigationRow.test.tsx` for a unit rendered
    against a context or router without the app.
  - The codecs-page round for moving a leaf between suites without renaming
    its meaning.
  - `useSettings.test.ts` itself for **Blank until it lands**.
- **Coverage is sufficient.** The server's settings and route suites cover
  the key, the default, the upsert and every `400`. The provider, section,
  page, App and stack suites cover every state the log names. The gaps this
  round fills are the wire call's own contract and the frame's own rule.

## Out of Scope

- **Wrapping the eighteen stack-mounting suites in the display provider.** See
  the Decision Document.
- **Giving `section.styles.ts` a suite or a folder.**
- **Renaming `useSettings`, `$capped` or `$framed`.**
- **A body module for the settings routes** (`enrichmentBody`'s shape). Two
  one-line `typeof` checks, each beside its own route, are the subtitle
  language's precedent.
- **Anything log 27 _Not built_ lists:** a width picker, wheel forwarding from
  the margins, a `localStorage` mirror, any change to the player, fullscreen
  or the Modal.
- **Prettier-governed long lines in tests and imports.** Test names and import
  paths aren't wrapped by Prettier, and every earlier round has left them.
- **Any server, route, type, schema or prototype change.**

## Further Notes

- Commit descriptions stay under the one-line rule. For example, commit 6 is
  _useSettings holds the language alone_, and commit 4 is _the
  saveUltrawideMargins call_.
- Commit 6 changes a hook's return shape, so `tsc -b` is the first check. Any
  caller the grep missed fails to compile rather than reading `undefined`. A
  grep at filing time found `PlaybackSection` the only importer. If another
  turns up, it is migrated in its own commit between 6 and 7 rather than
  folded into 6.
- Commit 11's body closes 248 and 251 with this issue. No other commit body
  carries a closing keyword, and the journal lists follow-ups by bare number.
