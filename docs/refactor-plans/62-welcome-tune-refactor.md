# Refactor plan: Welcome tune, a tune made whole when it is made, one copy of each number, a voice that is its partials, guards that read timings, a stub with its own suite, and the docs that close step 45

> Source initiative: `welcome-tune`, issue 593 (step 45).
> Shipped by issues 594 to 601: the build slices 594 to 599, RED and GREEN
> each (599 needed no GREEN), the live walk and retune by ear (600,
> `f47dcae1`) and the documents (601, `c44a020c`).
> Design log: `docs/design-logs/62-welcome-tune.md`.
> PRD: `docs/PRDs/62-welcome-tune.md` (593). Plan:
> `docs/PRDs/62-welcome-tune-plan.md`.
> Handoff: `docs/handoff/handoff-welcome-tune/README.md` (the score).
> This is the initiative's closing round. It ticks **Welcome tune** and
> closes 593. Filed as issue #605.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._ The maintainer approved every recommendation in advance.

## Problem Statement

`welcome-tune` shipped every phase of its plan. A **Cold start** plays the
**Welcome tune**: the **Intro cue** from the welcome's start, the **Closing
chord** when the **Wordmark handoff** starts, the **Welcome hold** silent, a
150ms fade on a skip, the chord alone under reduced motion, and silence
where Web Audio is missing, throws or is kept suspended. The splash, the
provider and the score read one `welcomeTimeline`.

At `c44a020c` the full suite has **11934 tests across 777 files, all
passing** (one skipped). `tsc -b --force` is clean. `eslint src server
electron` reports **1 error and 138 warnings**, against 1 and 137 when
export-round-trip closed: the new warning is this initiative's (below,
family 1).

The design held. What is left is what six slices and a retune by ear leave
behind: a workaround standing in for a missing seam, two numbers each kept
in two places, a player whose voices are a switch over eight positional
parameters, a test guard that reached past what it guards and the two
values it bent on the way, a test oracle with no test of its own, and the
documents. Every finding below was checked against the code at `c44a020c`.
They fall into seven families.

### 1. Reduced motion opens the tune with an empty cue

- **`play([])` is a workaround** (the journal's first follow-up). The
  player makes its `AudioContext` lazily, on the first `play`; under reduced
  motion there is no Intro cue, so `useWelcomeTune` plays an empty one on
  mount just so a skip in the 900ms intro has a master to fade. The comment
  explains what the call only implies. Log 62's _Types_ already says what
  the factory is: _a tune on a new `AudioContext`_. Made eagerly, the
  context exists from the moment the tune does, and the lazy `open()`, the
  `closed`-on-refusal path inside it and the `context`/`master` null checks
  in `fadeOut` and `finish` all go.
- **The hook's effect leaves `reducedMotion` out of its dependencies**
  (`react-hooks/exhaustive-deps`, the round's lint warning). Both inputs are
  read once by the provider and never change, so listing both changes
  nothing and says so.

### 2. Two numbers kept in two places

- **The swell's rise is spelled twice**: `SWELL_RISE_MS = 350` in the score
  and `SWELL_RISE = 0.35` in the player. The score uses its copy only to
  compute `MARK_SWEEP_START + MARK_SWEEP_MS / 2 - SWELL_RISE_MS`, which is
  `MARK_SWEEP_START` by construction. Log 62 Q6 defines the rise as _half
  the mark sweep_: a timeline number, not one of its own.
- **The swell's length is a literal**: `SWELL_MS = 950` with a comment
  saying it ends _as the intro ends_. It is `INTRO_MS - MARK_SWEEP_START`.
  The score's own rule (the handoff's _Rules the score keeps_) is that every
  time is computed from the timeline, never typed as a number of its own;
  a retimed intro would leave the swell short or ringing on.

### 3. A voice is a switch over eight parameters

- **`sound` takes eight positional parameters** and `strike` wraps it in a
  closure, `at`, to pass five of them, then switches on the voice. Since the
  retune by ear every oscillator is a sine, so the `type` parameter carries
  one value. A voice is data, as the notes are: each is its partials (a
  frequency ratio, a share of the note's level, an envelope shape). The
  bell is two partials, the pluck and swell one each.

### 4. A guard that reads past what it guards

- **The splash's literal scan bans numbers, not timings** (the journal's
  second follow-up). `welcomeTimeline.test` bans `520`, `420`, `1000`,
  `700`, `1150` and `380` anywhere in `WelcomeSplash.styles`, so slice 595
  moved the splash's `z-index` from 1000 to 999 and lifted the wordmark's
  `font-weight: 700` into a new `WORDMARK_WEIGHT` token to get past it.
  Scoped to the styles' `animation`, `transition` and delay declarations
  and the keyframe steps, it guards the same thing and spares both.
- **`z-index: 999`** is a value chosen by a regex. It goes back to 1000.
- **`WORDMARK_WEIGHT` has one reader.** The **Wordmark** primitive, the
  header's wordmark the splash's glides onto, still spells `700`. A brand
  token is worth keeping when the two wordmarks that must match read it;
  it stays, and the primitive reads it too.
- **`main.autoplayPolicy.test` reads a comment** (the journal's third
  follow-up). Its first case pins the `autoplayPolicy` line in
  `openWindow`'s `webPreferences`, which is the point of log 62 Q16: a line
  deleted would silence the tune with no test failing. Its second case
  asserts the words _Welcome tune_ and _player_ in the comment above it: a
  test on prose. `src/main.test.ts` and `packagingConfig.test` are prior art
  for reading wiring's source; none reads its comments.

### 5. The test oracle has no test

- **`stubAudioContext` is the only `src/test-support/` stub with logic and
  no suite.** `FakeAudioParam.valueAt` evaluates set, linear, exponential
  and target automation, and `levelAt` walks the graph multiplying gains:
  every tune assertion trusts both. `stubMediaElement`, `stubFullscreen`,
  `stubScrollTo` and the rest each have one.
- **`setTargetAtTime` has no caller.** The shipping player never calls it,
  before the retune or after; the stub carries its event kind and its
  evaluation branch for nothing.

### 6. Comments

- Lines past 80 columns left by the build: `useWelcomeTune`'s docblock (two
  run-on lines), `WelcomeProvider`'s (_holds,_ broken short),
  `welcomeScore.test`'s Phase 3 header, `stubAudioContext`'s header and two
  of its docblocks, `main.ts`'s autoplay comment, and
  `WelcomeSplash.styles`' mark-sweep docblock.
- `createWelcomeTune`'s docblock says the context is made _on the first
  `play`_; after family 1 it is made with the tune.
- `WelcomeNote` has no docblock; log 62's _Types_ gives it one.

### 7. The documents

- The feature checklist's row reads _Welcome tune: a jingle in sync with the
  intro_, 🔲 Planned, and step 45 is 🔜, _the refactor is still to come_.
  _Jingle_ is on the glossary's avoid list (log 62 Q3).
- The release checklist has no smoke for the tune.

## Solution

One round in seven groups, each commit leaving the suite green and the
typecheck clean:

1. **A tune made whole when it is made**: `createWelcomeTune` opens its
   context at once; reduced motion plays nothing on mount.
2. **One copy of each number**: the swell read off the timeline.
3. **A voice is its partials**: a table in place of the switch.
4. **Guards that read timings**: the scan scoped, the z-index back, the
   token read by both wordmarks, the autoplay test on the line alone.
5. **A stub with its own suite.**
6. **Comments** rewrapped and made true.
7. **The docs that close step 45**, then the journal.

No behaviour changes. No note, level, time or voice changes; nothing drawn
changes. No wire, schema, Settings, copy or prototype change. The family
hears and sees nothing new.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [welcome-tune] issue #605 …`, except where a commit is named
`test:` or `docs:`.

### Group 1: a tune made whole when it is made

1. **`createWelcomeTune` opens its context when it is made.** The factory
   constructs the `AudioContext`, the master gain at 0.3 and the lowpass
   at once; no constructor, or one that throws, answers the silent tune
   then and there. The lazy `open()` goes, and with it the `closed = true`
   on a refusal and the `context === null || master === null` guards in
   `fadeOut` and `finish`; `closed` and `fading` stay. Each cue is still
   anchored on `currentTime` at its `play`. The provider sees no change:
   `useWelcomeTune` makes the tune and plays the Intro cue in the same
   effect. Guarded by `createWelcomeTune.test` (every suite calls `play`
   before reading `contexts()`, and the throwing constructor's `attempts()`
   is still 1) and `WelcomeProvider.tune`, unchanged.
2. **Reduced motion plays nothing on mount.** `useWelcomeTune` plays the
   Intro cue unless `reducedMotion`; the `play([])` and its comment go,
   since the context now opens with the tune. Guarded by
   `WelcomeProvider.tune`'s reduced-motion suite (no Intro cue note; the
   chord at 900ms; a skip by click and by key in the intro fades the master
   over 150ms and closes after), unchanged.
3. **The hook's effect lists what it reads.** Its dependencies become
   `[played, reducedMotion]`, and its comment says both are read once by
   the provider, so it runs once per mount. Lint ends this group at 1 error
   and 137 warnings.

### Group 2: one copy of each number

4. **The swell is read off the timeline.** In the score, the swell is struck
   at `MARK_SWEEP_START` and lasts `INTRO_MS - MARK_SWEEP_START`;
   `SWELL_RISE_MS` and `SWELL_MS` go. In the player, the swell's rise is
   `MARK_SWEEP_MS / 2`, read from `welcomeTimeline`, its docblock saying it
   peaks at the mark sweep's middle. The values are the ones the score holds
   today (1000, 950, 350). Guarded by `welcomeScore.test`'s swell case (it
   already asserts the start at `MARK_SWEEP_START`, the peak at the sweep's
   middle and the end by `INTRO_MS`), `createWelcomeTune.test`'s swell voice
   (_over 350ms_) and the Intro cue suites, unchanged.

### Group 3: a voice is its partials

5. **`VOICES`, a table of partials.** A module-private
   `VOICES: Record<WelcomeVoice, readonly VoicePartial[]>`, each `VoicePartial` a
   frequency ratio, a share of the note's level and an envelope `Shape`:
   the pluck one partial with `struck(PLUCK_RISE)`, the swell one with
   `swelled`, the bell two, the octave at `BELL_OCTAVE`, both with
   `struck(BELL_RISE)`. `strike` sounds each partial of the note's voice;
   `sound` takes the graph, the partial's frequency and level and the
   note's span, and every oscillator is a sine. The `at` closure, the
   `switch` and the `type` parameter go. The `Record` keeps the voices
   exhaustive, as the `switch` did. Guarded by every `createWelcomeTune.test`
   voice and cue suite (oscillator count, type, frequency, peak, rise, fall,
   start), unchanged.

### Group 4: guards that read timings

6. **`test: [welcome-tune] issue #605 the splash's scan reads timings`.**
   `welcomeTimeline.test`'s styles case reads the `animation`, `transition`
   and `*-delay` declarations of `WelcomeSplash.styles` (each to its `;`,
   comments stripped as now) and bans the timeline's numbers there and the
   `* 40` and `* 45` steps; the `55%` keyframe ban and the `DROP_LANDING`
   case are unchanged. The provider case is untouched: it bans the clock's
   numbers in a file with no other use for them. Still green against the
   styles as they are.
7. **The splash sits at `z-index: 1000` again**, the value log 55 shipped,
   its docblock unchanged. Guarded by the scoped scan, `WelcomeSplash`'s
   provider suites and `App.welcomeSplashSpec`, unchanged.
8. **Both wordmarks read `WORDMARK_WEIGHT`.** The **Wordmark** primitive's
   `Family` reads the token in place of its `700`; the token's docblock
   says the header's wordmark and the splash's that glides onto it share
   it. Guarded by `Wordmark.test` (_the serif at 700_), `brand.test`,
   `MainLayout.test` and the welcome's handoff suite, unchanged.
9. **`test: [welcome-tune] issue #605 the autoplay guard reads the line`.**
   `main.autoplayPolicy.test` keeps its first case, the
   `autoplayPolicy: 'no-user-gesture-required'` line in `openWindow`'s
   `webPreferences`, and drops the second, which read the comment; its
   header says why the line is pinned and the comment is not.

### Group 5: a stub with its own suite

10. **`test: [welcome-tune] issue #605 the stub loses setTargetAtTime`.**
    `FakeAudioParam.setTargetAtTime`, the `target` event kind and its branch
    in `valueAt` go: no shipping code calls it. The tune suites are
    unchanged and green.
11. **`test: [welcome-tune] issue #605 stubAudioContext's own suite`.**
    A `stubAudioContext.test.ts` beside it, in `stubMediaElement.test`'s
    shape, pinning what the tune suites lean on: a param's value before any
    event, after a set, along a linear and an exponential ramp, and held
    after the last; an exponential ramp to 0 refused; `levelAt` through one
    gain and through two in series, two paths summed, a filter passing its
    level through, an oscillator silent before its start and from its stop;
    a context's `close()` and `state`; `startTime`, `state: 'suspended'`,
    `refuse` and `attempts()`; and the window left with no `AudioContext`
    once the block is over. Green from the start: it describes the stub as
    it is.

### Group 6: comments

12. **The docblocks rewrapped and made true.**
    - Rewrapped to 80 columns: `useWelcomeTune`'s docblock,
      `WelcomeProvider`'s, `welcomeScore.test`'s Phase 3 header,
      `stubAudioContext`'s header and its `state` and `stubAudioContext`
      docblocks, `main.ts`'s autoplay comment, `WelcomeSplash.styles`'
      mark-sweep docblock.
    - `createWelcomeTune`'s docblock: the context is made with the tune,
      never resumed (after commit 1).
    - `WelcomeNote` gains log 62's _One note of the **Welcome tune**_.
    - `useWelcomeTune`'s docblock: reduced motion plays nothing until the
      chord (after commit 2).

    Comments only.

### Group 7: the docs

13. **`docs: [welcome-tune] issue #605 the docs know the tune`.**
    - **Feature checklist**: the row reads _Welcome tune: a tune in sync
      with the intro_, ✅; step 45 goes ✅ with what shipped, in step 44's
      shape (_Built in issues 594 to 600; the closing round in issue
      #605_), its lines rewrapped.
    - **Release checklist**: one smoke after _Intro animation_, in the shell
      with the sound on: quit and open FamilyFlix: a pluck as each F lands,
      a run up with the letters, a swell with the light, a chord as the
      wordmark glides into the header, ringing on under the home. Open again
      and press a key mid-run: the tune fades with the picture and no chord
      plays. Reload: silence. With Windows animations off, open once more:
      the chord alone, as the fades hand over.
    - **Glossary**: checked against the round; **Welcome tune**, **Intro
      cue**, **Closing chord** and the three updated terms already say what
      the code does. The dialogue is a snapshot and stays.
14. **`docs: [welcome-tune] issue #605 the journal`.** A newest-first
    entry in `docs/dev-journal.md`, in the last refactor entry's shape: what
    shipped before the round, what each group changed, where the round left
    the plan, the test count and lint against `c44a020c`, the follow-ups
    (below). The commit closes 593 in words, not with a keyword, and this
    issue with one.

## Decision Document

- **The tune's context is made with the tune.** Log 62's _Types_ already
  reads _a tune on a new `AudioContext`_; the lazy open was the build's,
  and it is what forced the empty cue. The hook makes a tune only when the
  welcome is `played`, so no context is made a moment earlier than today,
  and a reload or a deep link still makes none. No `open()` or `start()`
  joins `WelcomeTune`: a method that only says _exist_ is what the factory
  is for.
- **`WelcomeTune` keeps `play`, `fadeOut`, `finish` and `close`.** A fade
  still wins over `finish()` (the build's _A fade wins_); a suspended
  context is still never resumed.
- **The swell's rise is a timeline number the player reads.** Log 62 Q6
  defines it as half the mark sweep. The player importing `welcomeTimeline`
  is the same dependency the score and the splash already have; the score
  no longer needs the rise at all, since its swell starts where the sweep
  does.
- **Voices are a private table in the player.** Log 62 Q6 put the voices in
  the player and let the notes name them; a `Record<WelcomeVoice, …>` keeps
  them there and exhaustive. `VoicePartial` and `VOICES` are not exported.
  `Shape`, `struck` and `swelled` stay as they are.
- **The scan guards timings, not digits.** Its purpose (log 62 Q8) is that
  the splash draws no timing of its own; a `z-index` or a weight is not a
  timing. The splash's other literal durations (the reduced fades' 300ms,
  the hold's 400ms from 50ms, the mark's 300ms) were never in the timeline
  and the scan does not reach them; see _Out of Scope_.
- **`WORDMARK_WEIGHT` stays and earns a second reader** rather than going
  back to a literal: the splash's wordmark glides onto the header's and must
  match it, the same _in sync by construction_ the timeline gives the tune.
  It stays in `src/tokens/brand.ts` beside the mark's paths.
- **The autoplay guard pins the line, not the comment.** The line is the
  dependency log 62 Q16 wrote down; the comment's wording is the
  maintainer's to change.
- **`stubAudioContext` loses what no tune calls** before it gains a suite,
  so the suite pins only what the tune suites lean on.
- **The checklist row loses _jingle_.** The glossary avoids it (log 62 Q3);
  the row is the one place it survived.
- **Nothing on the score, the timeline's values, the wire, Settings, the
  prototype or any copy changes.**

## Testing Decisions

- **A good test asserts what a listener or the family gets**: which
  oscillators reach the destination, at which frequency, how loud and when
  (`levelAt`); when the context closes; what the splash draws and when. It
  never asserts which helper ran or the order of internal calls.
- **The initiative's behavioural suites carry every refactor commit**:
  `welcomeScore.test`, `welcomeTimeline.test`, `createWelcomeTune.test`,
  `WelcomeProvider.tune`, and the welcome's earlier suites
  (`WelcomeProvider.test`, `.intro`, `.handoff`, `.holdAndSkip`,
  `.reducedMotion`, `App.welcomeSplashSpec`, `App.welcome`), plus
  `Wordmark.test`, `brand.test` and `MainLayout.test` for commit 8.
- **New tests: one suite**, `stubAudioContext.test` (commit 11), for a test
  oracle every tune assertion trusts. Prior art: `stubMediaElement.test`,
  `stubFullscreen.test`, `stubScrollTo.test`. `useWelcomeTune` keeps no
  suite of its own: the provider's tune suite drives it through its public
  face, as the PRD settled. `VOICES` is private and tested through the
  player, as the voices are today.
- **Assertions that change: none in the behavioural suites.** Commit 6
  narrows what a source scan reads, commit 9 drops a case on a comment and
  commit 10 drops stub surface no suite uses. A suite that has to change
  anywhere else is reading an implementation detail, and is fixed in the
  same commit with the reason in the body.
- **The gate:** the full suite at the end of each commit; `tsc -b --force`
  (an incremental build can miss a spec file) and `eslint src server
electron` at the end of each group. The round ends at 1 error and 137
  warnings, or fewer, and 11934 tests or more (commit 9 removes one, commit
  11 adds its own).
- **No live walk is needed**: no note, level or time moves. Commit 1 changes
  when the context is constructed only in the player's unit tests' terms;
  the maintainer may still hear one Cold start in the shell after group 3
  as a check.

## Out of Scope

- **The splash's other literal durations** (the reduced-motion fades'
  300ms, the background's 400ms from 50ms in the handoff, the mark's 300ms
  shrink). The tune does not sync to them and log 62 Q8 did not lift them;
  lifting them is a timeline round of its own if the animation is retimed.
- **`WelcomeProvider`'s two `exhaustive-deps` warnings** (`startClock` in
  `send` and in the mount effect). They predate this initiative (log 55),
  and fixing them reshapes the clock; the round leaves the provider's
  behaviour alone.
- **A mute control or volume setting** (log 62 Q1), **following the
  player's `volumePreference`** (Q7), **resuming a suspended context**
  (Q15) and **output-latency compensation** (Q11).
- **A shared `hz` test helper.** Two suites spell `440 * 2 ** ((p - 69) /
12)` as their expected frequency; a test's expected values are its own.
- **The frozen `handoff-welcome-splash/`**, and the tune's handoff score,
  which the round does not change.

## Further Notes

- Groups 1 and 4 are the round's reason to exist: the empty cue is a
  workaround the journal flagged, and the scan bent two unrelated values to
  pass.
- Order: commit 1 before 2 (the empty cue can go only once the context
  opens with the tune); 2 before 3 is not required but keeps the hook's
  diff readable; 6 before 7 (the unscoped scan bans `1000`); 10 before 11;
  12 after every code commit, so it rewraps what stays; 13 after 12, 14
  last. Groups are otherwise independent.
- Slice 594 ran over its token budget (the journal's fourth follow-up), as
  582 did a round earlier; `prd-to-plan` should split a new pure unit and
  its test-support fake from the acceptance test that needs them. A process
  note, not code.
- Follow-ups for the journal, not this round: the splash's unlifted
  durations, the provider's two dependency warnings, and a mute control as
  its own step.
