# Refactor plan: Audio tracks — one policy call per track, one opening rule, one picker rule, one bargain, and the docs that close the initiative

> Source initiative: `audio-tracks`, issue 397 (step 29).
> Shipped by issues 398–404: 398 the prototype revision `224579f`, then RED
> and GREEN each — 399 `04e40b8`/`ddbd61d`, 400 `327f1c9`/`4e9e629`, 401
> `334823b`/`ef34e75`, 402 `b68b060`/`e06cd7d`, 403 `4fd81a9`/`09a8b7a`, 404
> `ebe4156`/`6993626`.
> Design log: `docs/design-logs/46-audio-tracks.md`. PRD:
> `docs/PRDs/46-audio-tracks.md` (397). Plan:
> `docs/PRDs/46-audio-tracks-plan.md`.
> This is the initiative's closing round. It ticks **Audio tracks** and
> **Audio preferences** and closes 397. Filed as issue 405.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._

## Problem Statement

`audio-tracks` shipped every slice of log 46's implementation plan. At
`6993626` the full suite has 9915 tests across 593 files. 9914 pass. The one
failure is an `ENOTEMPTY` while a sandbox is torn down in
`routes.enrichment.test.ts`, a suite this initiative did not touch, and it
passes when run alone (see Further Notes). `tsc -b --force` is clean.
`eslint` over every folder the initiative touched reports no errors and 19
warnings. Two of them are new: a guard this initiative added to the settings
suite (section 6).

The six build slices were built one at a time by agents that each saw one
slice. The design held:

- the server switches the track (`?a=`, `-map 0:a:N?`);
- one Playback read carries each track's own path;
- the preference is waited for, and `useSubtitles` stopped fetching it for
  itself;
- the Audio choice lives on the unkeyed `PlayerScreen`.

The seams show in smaller places. Nothing below is a bug a household would
see, except one row drawn too early on the Settings page (section 5). Every
finding was checked against the code for this plan. They fall into six
families:

- the server asks its format policy about each track by hand;
- the opening rule is spelled in two places;
- the switch re-spells the position helpers it sits beside;
- the picker's rule is spelled twice, and its props break the CC precedent;
- the Settings side copies a bargain and a header, and draws one row early;
- the docblocks and documents still describe the code before step 29.

### 1. The server asks its policy about each track by hand

- **`read` calls `choosePlaybackPath` a second time, outside `decide`.**
  `createPlayback` has one local, `decide`, that reads the slot, probes once
  and asks the policy. To give each offered track its own path, `read` builds
  a second `choosePlaybackPath` call inline, one per track, over the same
  probe. So that it can, `decide` now returns `availability` beside its
  decision, and only `read` reads it. `createPlayback` now calls the policy
  in two places, and only one of them is the local named for it.
- **`no-track` is folded in the wrong unit.** `audioTracks` already owns "a
  track that cannot play is not offered" and drops `cannot-play`. But its
  `pathOf` is typed as the wire's `PlaybackPath`, so `read`'s inline call has
  to turn the policy's `no-track` into `cannot-play` first
  (`path === 'no-track' ? 'cannot-play' : path`). The rule "not offered" now
  lives half in `audioTracks` and half in the caller.
- **Stale docblocks in the domain.**
  - `PlaybackDecision` still says "the other two carry none at all". There
    are three argv-less paths now: `direct`, `cannot-play` and `no-track`.
  - `choosePlaybackPath`'s ordered list now starts at `0.`. Every other
    numbered list in the domain starts at 1.
  - `PlaybackRead` still says "which path, and how long the film runs". It
    carries `audioTracks` too.

### 2. The opening rule is spelled in two places

- **`useAudioTracks` matches a language itself.** `preferredAudio` is the
  pure opening rule: the preferred language, case-insensitive, then the file
  default, then the first. The **Audio choice** is a second language read
  ahead of it. Instead of handing that to the pure rule, `useAudioTracks`
  writes its own `tracks.find(track => track.language?.toLowerCase() ===
choice.toLowerCase())` and falls back to `preferredAudio` after it. The
  match is spelled twice. The full rule (choice where a track speaks it, then
  preference, then file default, then first) is in no single unit, and the
  pure suite cannot state it. The glossary does state it, word for word
  (_Audio tracks_, the relationship line), and the code agrees with the
  glossary.
- **The PRD and the code read the choice differently.** The PRD says
  `preferredAudio(tracks, choice ?? preference)`, so a choice no track speaks
  would fall to the file default. The code and the glossary use the
  preference next, so a Spanish evening reaching an episode with no Spanish
  opens in the household's language, not whatever the file marks. This round
  keeps the code's behaviour and gives it one home.

### 3. The switch re-spells its neighbours

- **The track switch writes the anchors by hand.** `usePlayback` has three
  small helpers for the **Absolute position**: `absolute()`,
  `anchorElement(seconds)` and `anchorStream(seconds)`. Every seek goes
  through them. The switch block added for the picker reads
  `offsetRef.current + elementTimeRef.current` itself (that is `absolute()`).
  On a stream path it sets the offset ref, the offset state, the element ref
  and the element state one line at a time (that is `anchorStream(at)`). On
  Direct play it writes the same four with other values (that is
  `anchorStream(0)` then `anchorElement(at)`). Log 46 Q13 names the switch
  "`anchorStream(absolute())` with the new `a`". The code should read those
  words.

### 4. The picker's rule and its props

- **"Two or more" is written twice.** `Player` computes
  `hasAudioPicker = audioTracks.length >= 2` for the `a` key.
  `PlayerControls` checks `audioTracks.length >= 2` again to draw the
  picker. CC's rule is written once: `Player` decides `track !== null` and
  hands `hasSubtitles` down, and `onToggleSubtitles` is `null` on the same
  fact. The prototype names the prop `hasAudioTracks`, beside `hasSubs`
  (`feat.PlayerControls.dc.html`, revision 398).
- **Optional props where the precedent makes them required.**
  - `PlayerControls`' four audio props are optional, with no-op defaults.
    Every other prop on it is required, `onToggleSubtitles` included.
  - `PlayerKeys.onNextAudioTrack` is optional ("for a caller with no
    picker"). Its sibling `onToggleSubtitles` is required and `null` when
    absent.
  - `Player`'s `audioChoice` and `onAudioChoice` are optional, but
    `PlayerScreen` is its only caller and always passes them.

  The optional props exist so that suites written before the picker did not
  have to change. Both suites build their props in one harness, so making the
  props required costs one line in each harness.

### 5. The Settings side

- **The optimistic bargain is written twice.** `useSettings`'
  `chooseSubtitleLanguage` and `chooseAudioLanguage` are the same twelve
  lines with different state. The codebase already has a precedent for this:
  `DisplayPreferenceProvider` extracted `useHeldFlag(save)` once its two flags
  shared the bargain ("its setters are one bargain, `useHeldFlag`'s"). The two
  languages are that case again, over a string.
- **Names that now lie.**
  - `PlaybackSection` builds `languageOptions` (the subtitle pill's) and
    `audioOptions` with the same map. The first name now fits both.
  - The Audio block's header is drawn with `SubtitlesHeader`.
- **The audio row is drawn too late.** While the settings read is `null`,
  the subtitle row draws its title and lede and leaves only the pill out ("the
  row itself is there; only the value is not yet known"). The audio row
  leaves the whole row out, so the card grows by a row when the read lands.
  The PRD contradicts itself here. Its user story 8 asks for "the dropdown
  left undrawn until the settings read has landed", which is the subtitle
  precedent. Its body and plan say "the row is not drawn", and that is what
  was built and tested.

### 6. Tests, docblocks and documents

- **Two new lint warnings.** The settings suite's guard against the old pool
  names splits each name in half with `'…' + '…'`, so the suite does not name
  them itself. `no-useless-concat` flags both.
- **Stale docblocks.**
  - `useOpeningReads` still says "the two reads", "both have answered",
    "all four of these" and "the pair". There are three reads now.
  - `preferredSubtitle` still says the preference "has no source yet … every
    call today omits it". That has been false since step 15, and
    `preferredAudio` now calls itself its twin.
  - `LANGUAGE_POOL`'s docblock says "a subtitle may be filed under", and
    "three places", one of them "the _Preferred language_ pill". Both
    dropdowns were renamed, and the pool now serves audio too.
  - `Settings`' docblock explains why `subtitleLanguage` is a string. It now
    has to explain that for both language fields.
  - The `GET /api/settings` route comment names "the _Preferred language_
    pill" and "the player when it picks a track".
- **The documents.**
  - CLAUDE.md and the README still carry step 29 and its two feature rows
    (_Audio tracks_, _Audio preferences_) as 🔜, with "to settle in the
    grill" text.
  - CLAUDE.md's Settings Hub still answers three fields from
    `GET /api/settings`, and has no `audio-language` route.
  - CLAUDE.md's folder tree has none of `trackLanguage/`, `audioTracks/`,
    `preferredAudio/`, `useAudioTracks/`, `AudioMenu/` or `SpeechBubbleIcon`.
    Its `probe/`, `useOpeningReads/`, `useSubtitles/`, settings repository,
    `PlaybackSection/`, `useSettings/`, settings `api/` and `types/` lines
    describe the code before the initiative.
  - The `api/` prose credits `fetchSettings` to "the player's
    `useSubtitles`".
  - The glossary's **Preferred subtitle language** row names "the Playback
    group's _Preferred language_ dropdown".

## Solution

`createPlayback` asks the policy in one place. A local `decisionFor` is the
one call of `choosePlaybackPath` in the domain. `decide` reads the slot and
the probe once and asks it. `read` asks it once more for each track over the
same probe. `audioTracks` takes the policy's own answer and declines both
`cannot-play` and `no-track`.

`preferredAudio` learns the Audio choice as a third argument, read ahead of
the preference, so the whole opening rule is one pure function with rows in
its suite. `useAudioTracks` keeps only the hand's pick on top of it, and
answers `hasAudioTracks`, the picker's two-or-more rule, once. `Player` hands
that rule down as `PlayerControls`' `hasAudioTracks`, CC's shape, and every
audio prop becomes required. The track switch in `usePlayback` reads
`absolute`, `anchorStream` and `anchorElement`.

`useSettings` gains `useHeldLanguage(save)`, `useHeldFlag`'s twin. The
Playback card builds both pills from one local and draws the audio row's
title while the read is out, as the subtitle row does. That is the round's
one visible change, a `fix:`.

The docblocks catch up, and the documents learn the feature shipped.

Nothing on the wire, in the schema, in the opening rule's behaviour or in the
switch's behaviour changes.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [audio-tracks] issue #405 …`, except where a commit is
named `fix:`, `test:` or `docs:`.

### Group 1 — the server's per-track path, once

1. **`audioTracks` takes the policy's own answer.**
   - `pathOf` is typed as the policy's decision path, so `no-track` is a
     value it can be handed.
   - A `no-track` is not offered, the same as a `cannot-play`. The docblock
     says so in one line: "a track nothing can play, or one the file does not
     have, is not offered".
   - `audioTracks.test.ts` gains the `no-track` row.
   - The caller's fold is untouched in this commit. Widening the argument is
     enough for it to keep compiling.
2. **One call of the policy in `createPlayback`.**
   - A local `decisionFor(file, component, probe, offsetSeconds,
audioTrack)` is the domain's one call of `choosePlaybackPath`, with
     `availabilityOf(component)` read inside it.
   - `decide` reads the slot and probes once, then asks `decisionFor`. It
     stops returning `availability`.
   - `read` hands `audioTracks` a `pathOf` that is `decisionFor` over the
     probe `decide` already made. There is still one probe per read, never
     one per track. The `no-track` → `cannot-play` fold goes.
   - Covered by `createPlayback.audioTracks.test.ts` (each track's own path,
     a component-less machine offering at most index 0, one probe per read)
     and `routes.audioTracks.test.ts`.
3. **The domain's docblocks catch up.**
   - `PlaybackDecision`: the three paths that run nothing (`direct`,
     `cannot-play`, `no-track`) carry no argv.
   - `choosePlaybackPath`'s ordered answers are numbered from 1, the
     `no-track` answer first.
   - `PlaybackRead`: the path, the length and the offered Audio tracks.
   - No code changes.

### Group 2 — the opening rule, once

4. **`preferredAudio` learns the Audio choice.**
   - The signature becomes `preferredAudio(tracks, language?, choice?)`.
     `choice` is read first, but only where a track speaks it. Then comes
     `language`. Then the track the file marks default. Then the first.
     `null` stays the answer for `[]`.
   - `choice` goes last so that every existing call and row,
     `(tracks, language)`, reads as before.
   - Both matches go through one private `spokenIn(tracks, language)`,
     case-insensitive, a track with no language never matching. That is the
     one spelling of the match.
   - `preferredAudio.test.ts` gains rows for:
     - a choice spoken by a track, over the preference;
     - a choice no track speaks, falling to the preference and not to the
       file default (the glossary's order);
     - a `null` choice;
     - a choice differing from a track's language only in case.
   - The docblock states the whole rule in the glossary's words.
5. **`useAudioTracks` reads the whole rule.**
   - The playing track becomes "the hand's pick, else
     `preferredAudio(tracks, language, choice)`". The `carried` lookup goes.
   - Covered by `useAudioTracks.test.ts` and
     `PlayerScreen.audioChoice.test.tsx`: the choice carried across _Play
     now_, a choice the next episode cannot speak, and a pick holding over a
     late read.
6. **The switch reads the anchors.**
   - The track switch in `usePlayback` reads `absolute()` for the second it
     is at.
     - Onto a stream path it is `anchorStream(at)`.
     - Onto Direct play it is `anchorStream(0)` and `anchorElement(at)`,
       with the wind armed at `at`.
   - The buffering flag, the resume ref and the render-phase comparison stay
     as they are. Log 46 Q13's sentence goes into the comment.
   - Covered by `usePlayback.test.ts` (both directions of switch, the
     position kept, a paused film staying paused, a seek during a direct
     load) and `Player.audioPicker.test.tsx`.

### Group 3 — the picker's rule, once

7. **`hasAudioTracks`, spelled once.**
   - `useAudioTracks` answers `hasAudioTracks`: two or more offered tracks,
     the **Audio picker**'s rule.
   - `Player` reads it for `onNextAudioTrack: hasAudioTracks ? next : null`,
     the shape `onToggleSubtitles` already has. It hands it to
     `PlayerControls` as `hasAudioTracks`, beside `hasSubtitles`, the
     prototype's prop name. `hasAudioPicker` goes.
   - `PlayerControls` draws the `AudioMenu` on `hasAudioTracks`, and no
     longer counts the list.
   - `useAudioTracks.test.ts` gains the rule's rows: none, one, two.
     `PlayerControls.test.tsx`'s picker cases pass `hasAudioTracks`.
8. **The audio props are required.**
   - These props become required: `PlayerControls`' `audioTracks`,
     `audioTrack`, `onChooseAudio` and `onAudioMenuChange` (its
     `hasAudioTracks` is born required in commit 7);
     `PlayerKeys.onNextAudioTrack` (still `| null`); and `Player`'s
     `audioChoice` and `onAudioChoice`. The no-op defaults go.
   - The two harnesses, `renderControls` and `renderKeys`, gain the props'
     defaults, and so does the one direct render in `PlayerControls.test.tsx`.
     No case changes.
   - `onNextAudioTrack`'s "Optional, for a caller with no picker" goes from
     its docblock.

### Group 4 — the Settings side

9. **`useHeldLanguage`, `useHeldFlag`'s twin.**
   - `useSettings` gains a private `useHeldLanguage(save)` →
     `{ value, land, set }`, the provider's shape over a string. It shows the
     choice at once, posts it, keeps the echo, puts the old value back on a
     refusal and never rejects.
   - The hook's one `fetchSettings` lands both values. `SettingsState`
     keeps its four fields exactly.
   - Covered by `useSettings.test.ts` (both languages: shown at once, the
     echo kept, put back on refusal, never rejecting) and the section's
     choosing suites.
10. **One option builder and an honest header.**
    - `PlaybackSection` builds both pills' options through one local,
      `poolOptions(value, choose)`, over `LANGUAGE_POOL`. `languageOptions`
      and `audioOptions` go.
    - `SubtitlesHeader` is renamed `ItemHeader`, "a Playback-card item's
      title and lede, 14px over its first row", because it heads both the
      Subtitles and the Audio items.
    - No pixel changes.
11. **`fix: [audio-tracks] issue #405 the audio row waits as the subtitle row does`.**
    - While the settings read is `null`, the _Preferred audio language_ row
      draws its title and lede, and leaves only the pill out. That is the
      subtitle row's shape, and the PRD's user story 8.
    - `PlaybackSection.test.tsx`'s "the Audio row while the read is null"
      cases change in the same commit. Each now asserts that the title is
      drawn and the pill is absent, on a pending read and on a refused read,
      as the subtitle cases do.
    - The body cites story 8 and the subtitle row, and says the PRD's body
      and plan said "the row".

### Group 5 — the tests

12. **`test: [audio-tracks] issue #405 the pool guard lints clean`.**
    - The settings suite's guard joins each old name from two halves without
      a string concatenation of literals (an array of halves, joined), so
      that it still does not name them itself.
    - `no-useless-concat`'s two warnings go. The assertion does not change.

### Group 6 — the docs that close the initiative

13. **The docblocks catch up.**
    - `useOpeningReads`: three reads, made together and reported as one;
      "settled" for all three.
    - `preferredSubtitle`: the preference arrives from the opening settings
      read. Its "no source yet" paragraph goes.
    - `LANGUAGE_POOL`: what a subtitle is filed under and what both
      preferences choose from; its readers named; both dropdowns' new names.
    - `Settings`: why both language fields are strings.
    - The `GET /api/settings` route comment: the Playback card's two pills,
      and the player's opening read.
    - No code changes.
14. **`docs: [audio-tracks] issue #405 the docs know audio tracks shipped`.**
    - **CLAUDE.md**:
      - step 29 goes ✅. Its text becomes what shipped:
        - the server maps the track (`?a=`, `-map 0:V:0? -map 0:a:N?`);
        - Direct play only on index 0;
        - one Playback read carrying each track's path;
        - the preference waited for, the opening rule, the picker before
          CC with `a` to cycle;
        - the Audio choice for the sitting;
        - no migration.

        The build order's sentence names step 29 as done and step 30 as
        next.

      - the _Audio tracks_ (Playback) and _Audio preferences_ (Settings hub)
        rows go ✅.
      - the Settings Hub: `GET /api/settings` answers four fields, and the
        `POST /api/settings/audio-language` bullet is added.
      - the `api/` prose: `fetchSettings` is read by the Settings hub's
        pills and the player's opening read.
      - the folder tree:
        - `probe/` (`audioStreams`, cover art skipped);
        - `choosePlaybackPath/` (the two maps, `no-track`);
        - new lines for `trackLanguage/` and `audioTracks/`;
        - `createPlayback/` (`read`'s tracks, `stream`'s `audioTrack`);
        - the settings repository (four preference keys);
        - player: `preferredAudio/`, `useAudioTracks/` and `AudioMenu/`;
          `useOpeningReads/` (three reads); `useSubtitles/` (the language
          handed in); `usePlayback/` (the switch); `PlayerScreen/` (the
          Audio choice);
        - the Icon line (`SpeechBubbleIcon`);
        - `PlaybackSection/`, `useSettings/` and the settings `api/`;
        - `types/` (`settings.ts`' `LANGUAGE_POOL`, `PoolLanguage`,
          `DEFAULT_AUDIO_LANGUAGE`, `Settings`' four fields;
          `playback.ts`' `AudioTrack`).

    - **README**: step 29 and its two feature rows go ✅.
    - **Glossary**: the **Preferred subtitle language** row names its
      dropdown _Preferred subtitle language_. The dialogue at the 15-settings
      section is a snapshot and stays as it is.

15. **`docs: [audio-tracks] issue #405 the journal`.** A newest-first
    entry in `docs/dev-journal.md`, in the last entry's shape:
    - what shipped;
    - what each group changed;
    - what was deliberately not changed;
    - the follow-ups.

    The commit closes 397 in words, not with a keyword, and this issue with
    one.

## Decision Document

- **`createPlayback` calls the format policy in one place.** `decisionFor`
  is the only `choosePlaybackPath` call. `decide` is "read the slot, probe
  once, ask". `read` asks per track over that one probe. This is the
  domain's "nothing else in `playback/` decides a path" rule, applied inside
  `createPlayback` too.
- **"Not offered" is `audioTracks`' rule, whole.** It takes the policy's
  decision path, including `no-track`, and declines both paths that cannot
  play. The wire type `AudioTrack.path` is unchanged:
  `Exclude<PlaybackPath, 'cannot-play'>`.
- **The opening rule is `preferredAudio`'s, whole.** The rule is: choice
  where spoken, then preference, then file default, then first. That is the
  glossary's order, and today's behaviour. The PRD's
  `choice ?? preference` reading is not adopted. `choice` is the third
  argument, so the existing two-argument shape and rows hold.
  `useAudioTracks` decides nothing but "a hand's pick holds".
- **The picker's rule is `useAudioTracks`' `hasAudioTracks`.** It is named
  as the prototype names the prop. `Player` hands it down as it hands
  `hasSubtitles`, and the key's handler is `null` on the same fact, so the
  button and the key cannot disagree.
- **Player props are required, as their siblings are.** No audio prop has a
  default. `null` is the absent handler, CC's convention.
- **The switch is written in the anchors' words.** No new helper, and no
  move to an effect. The render-phase comparison stays, for the reason its
  docblock gives: the new `a` and the new offset reach the element as one
  load.
- **`useHeldLanguage` is private to `useSettings`.** It is `useHeldFlag`'s
  twin, kept next to its one caller as `useHeldFlag` is kept next to its
  own. It is not a shared hook: two hooks with one bargain each are not yet
  two features asking for one.
- **`ItemHeader`** names the Playback card's item header for what it is. It
  stays in the section's own styles file.
- **The one behaviour change is the audio row's waiting shape**: its title
  and lede are drawn while the read is out, and the pill is not. It ships as
  a `fix:`. The subtitle row is the precedent, and the PRD's user story is
  the spec.
- **Nothing on the wire, the server's routes, the schema, the opening rule's
  behaviour or the switch's behaviour changes.** `PlaybackRead`,
  `AudioTrack`, `Settings`, `StreamPlan`, `PlaybackDecision` and
  `SettingsState` keep their shapes. `AudioTracksState` gains
  `hasAudioTracks`. `PlayerControlsProps` gains `hasAudioTracks`, and its
  audio props become required.

## Testing Decisions

A good test drives a unit through its public interface and asserts what a
caller sees: a path in a read, an argv, a stream URL, an element's
`currentTime`, a menu item marked, a request posted, a row drawn. It never
asserts which helper ran. The initiative's suites are thorough and
behavioural:

- `probe.audioStreams`, `choosePlaybackPath.audioTrack`,
  `createPlayback.audioTracks` and `routes.audioTracks` on the server;
- `preferredAudio`, `useAudioTracks`, `usePlayback`, `Player.audio`,
  `Player.audioPicker`, `PlayerScreen.audioChoice`, `AudioMenu`,
  `PlaybackSection` and `useSettings` on the client.

This round moves rules, not behaviour, so almost every commit is carried by
cases that already exist.

- **Two pure units get rows** (commits 1, 4 and 7).
  - `audioTracks`' `no-track` row.
  - `preferredAudio`'s choice rows. Together they are the guard that states
    the whole opening rule in one suite.
  - `useAudioTracks`' `hasAudioTracks` rows.
  - Prior art: `preferredSubtitle.test.ts`, `audioTracks.test.ts`'
    `cannot-play` row, and `formJob.test.ts`'s Landing rows for a rule moved
    into a pure home.
- **The journeys are already pinned.**
  - The switch's position, play state and buffering in `usePlayback.test.ts`
    and `Player.audioPicker.test.tsx`.
  - The carried choice in `PlayerScreen.audioChoice.test.tsx`.
  - Each track's own path and the one probe in
    `createPlayback.audioTracks.test.ts`.
  - The bargain's four outcomes in `useSettings.test.ts`.
  - None of these cases changes in Groups 1 to 4, except the two harnesses
    of commit 8, which gain defaults. A suite that has to change anywhere
    else is reading an implementation detail, and is fixed in the same
    commit with the reason in the body.
- **The fix changes two cases** (commit 11): the audio row's pending and
  refused cases assert the subtitle row's shape. Every other
  `PlaybackSection` case keeps its assertion.
- Every commit runs the full suite and `tsc -b --force`, and `eslint` over
  the folders it touched.

## Out of Scope

- **`ProbedAudio.isDefault` beside `AudioTrack.fileDefault`.** Log 46 named
  both on purpose (Q6, Q7). On the probe, every field is the file's, and the
  flag reads as ffprobe's disposition. On the wire, `fileDefault` keeps the
  file's default apart from the household's preference.
- **`AudioMenu`'s panel reached by `[role='menu']`.** `Menu`'s panel is not
  in the category barrel, and `FilterDropdown`'s docblock rules out a layout
  prop on the shared menu. The selector is documented where it is used. A
  `placement` prop on `Menu` would be its own change.
- **The four settings routes' copied bodies.** One route per setting, each
  reading its own body, is the precedent the Ultrawide margins and TMDB
  ratings routes already set as twins. A shared body reader would change all
  four.
- **Moving the switch out of the render phase.** It is React's
  adjust-state-on-prop-change pattern, chosen so that the element gets one
  load. An effect would add a load at the old second.
- **The Package smoke's check of which track Chromium plays on a
  multi-track MP4** (log 46 Q5). It is manual and belongs to the next
  release's smoke, not a refactor.
- Anything log 46 put out of scope: a subtitle picker, a per-title memory,
  audio metadata in the form or the importer, new pool languages, an Export
  column, Chromium's `audioTracks`.

## Further Notes

- Groups 1 to 3 are the round's real moves. Each is covered before it
  changes by the suites written in 400 and 402–404.
- Commit 11 is the only change a household could see: one row's title
  appearing a moment sooner on the Settings page.
- Follow-ups this plan already sees, each for the journal, not this round:
  - **The sandbox teardown flake.** `sandboxRoot`'s `afterEach` `rmSync`
    can hit `ENOTEMPTY` on Windows under a full parallel run. It was seen in
    `routes.enrichment.test.ts` at `6993626`, and the suite passes alone. A
    `maxRetries` on that `rmSync` is likely the whole fix.
  - The follow-ups the Add and sync journal entry left open, unchanged by
    this initiative (`useQueryParamWriter` to `hooks/`, the lint error in
    `EnrichmentReview.test.tsx`).
