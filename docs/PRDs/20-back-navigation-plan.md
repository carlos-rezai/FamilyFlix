# Plan: Back navigation — one Back rule, four screens that never got it

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/170

The app has had the **Back rule** since the movie page was built: a **History
step**, with the library as the fallback for a screen with nothing behind it.
`useGoBack` is that rule, and four screens call past it — the player's `leave`
pushes `/movie/:id`, Import's Back pushes `/settings`, and the form's
`AFTER_ADD` / `afterEdit` / `AFTER_RESOLVE` push three URLs between them. Each
push shows the right screen and leaves a duplicate entry behind, and the next
press of Back walks into it.

This initiative is not a new mechanism. It is one parameter on the hook that
already exists, one new spelling on the probe that already exists, and four
screens becoming callers. There is nothing to design and nothing to draw: the
whole of the work is _which_ function a handler calls, and the whole of the
proof is a second press of Back.

It is step 3 of the seven that are left, ahead of the Electron shell, because
the shell would ship the bug as its own.

The slicing follows the callers, one screen at a time, with the two shared
tools first so every screen after has something to assert with:

**the two tools** (Phase 1) → **the player** (Phase 2) → **Import** (Phase 3)
→ **the form's landing, edit and add** (Phase 4) → **the form in Import
context** (Phase 5) → **docs and the refactor filing** (Phase 6).

Phase 1 is the one deliberately non-vertical slice — a hook parameter and a
probe spelling with no caller — kept separate on the Snackbar's and the FAB's
precedent, so the four screen phases each get a RED step that is a journey
rather than a signature. Phases 2–5 are the tracer bullets: from each one on,
that screen's Back is right end to end, and the bug is gone from it.

There is **no Phase 0**: the PRD is explicit that the prototype is not
amended. `exitPlayer`, `goSettings`, `saveMovie`, `backFromAdd` and
`goBrowse` already say where each leaving lands — push versus step is a
distinction a stateless screen switcher cannot draw, which is why the
prototype could never have caught this and why nothing in `docs/handoff/`
changes.

## Four things settled before any phase

- **Arriving pushes, leaving steps.** Every way _onto_ a screen — a card,
  Play, _Edit details_, _Resolve_, the gear, the Library rows, the logo — is a
  push and is untouched. Every **Leaving** — Back, Escape, a save, a Skip, a
  Delete — is a **History step**. The two exceptions are the prototype's two
  `goBrowse()` calls, the form's _Add to library_ and Import's _Finish_, which
  stay `navigate('/')` and mean a **Fresh home**.

- **Never a replace.** Not on a leaving, not on a **Landing**, not on a Fresh
  home. A replace is still a fresh entry under a new key, so the shelf's
  filters and the remembered scroll are both lost: it removes the duplicate
  and keeps the bug. The landing staying a push is what gives the screen it
  lands on a Back of its own, at the accepted cost of a two-step loop on a
  deep link nobody but a developer reaches.

- **The landing is read off the URL, never off fetched state.** The form's
  `editing` and `resolving` are both `null` until a fetch lands, so a landing
  read off them would send an early Back on a deep-linked edit to Settings.
  The mapping is over the two query parameters the form already reads, and it
  is right from the first render.

- **Three screens are already correct and stay untouched.** `GenreLayout`,
  `MoviePage` and `SettingsHeader` call the hook with no argument and keep the
  library as their landing; `useDeleteMovie` and `useRestoredScroll` are not
  opened at all. The delete-after-Play case and the detail page's lost scroll
  are both fixed by the player's handler alone — the entry stepped onto is the
  entry scroll restoration remembered.

---

## Architectural decisions

Durable decisions that apply across all phases.

- **Routes.** None. No new route, no HTTP route, no schema change, no entry in
  `src/types/`. Every URL in the app is what it already is; only the history
  operation that reaches them changes.

- **No location state.** Nothing carries a `from`. The router's own stack is
  the only record of where a screen came from, and the landing is the only
  thing a screen says about where it goes when that stack is empty.

- **The hook, amended in place.** `useGoBack(fallback = '/')` — same folder,
  same file, same test file, one more case. The parameter keeps the name
  `fallback`, because that is what the hook has always called it, even though
  the PRD's word for the value is **Landing**. No second hook, and no
  `navigate(-1)` written anywhere but inside it.

- **The landings, one per screen:**

  | Screen                                         | Landing           | Steps on                                 | Push kept            |
  | ---------------------------------------------- | ----------------- | ---------------------------------------- | -------------------- |
  | Player                                         | `/movie/:id`      | Back pill, Escape                        | —                    |
  | Import                                         | `/settings`       | Back                                     | Finish → `/`         |
  | Movie form, Import context                     | `/import`         | Back, _Skip this one_, _Save & continue_ | —                    |
  | Movie form, edit                               | `/movie/:id`      | Back, Cancel, _Save changes_             | —                    |
  | Movie form, add                                | `/settings`       | Back, Cancel                             | Add to library → `/` |
  | GenreLayout, MoviePage, SettingsHeader, delete | `/` (the default) | unchanged                                | —                    |

- **The probe.** `LocationProbe` gains a fourth spelling beside `pathname`,
  `search` and `url`: `navigationType`, off the router's `useNavigationType()`
  — `POP` after a step, `PUSH` after a push. It is the assertion that would
  have caught this, because "landed on the right URL" was the one every suite
  already made and it was passing. Test support, never imported by shipping
  code; `withBack` stays as it is and goes unused here, its button being named
  _Back_ where all three screens have one.

- **The proof is a second press.** Every journey test in Phases 2–5 presses
  Back twice, or presses a leaving and then Back. The first press was always
  right — that is why this survived three initiatives.

---

## Phase 1: The two tools

**User stories**: 25, 26, 27, 32, and 23 as the guarantee that nothing else
moves.

### What to build

`useGoBack` takes an optional landing, a route string defaulting to `'/'`, and
pushes it when `location.key === 'default'` instead of pushing the library.
Everything else about the hook is unchanged: the same check, the same
`navigate(-1)` behind it, the same push rather than replace on the fallback,
the same doc comment grown by the one sentence that says a screen may name its
own.

Beside it, `LocationProbe` renders `navigationType` as a fourth `data-testid`,
so a suite can say _a step, not a push_.

No caller changes in this phase. The four existing callers pass nothing and
behave exactly as they do today, which is the point of the phase: the rule
grows a parameter without any screen noticing.

### Acceptance criteria

- [ ] `useGoBack()` with no argument steps back when there is history and
      pushes `/` when there is none — both existing tests pass unchanged
- [ ] `useGoBack('/somewhere')` on a deep-linked screen lands on `/somewhere`,
      not `/`
- [ ] That landing is a push: the screen it lands on has history behind it and
      is not the first entry of the session
- [ ] With history behind it, the landing is never reached — the step wins
- [ ] `LocationProbe` renders `navigationType`, reading `POP` after a step and
      `PUSH` after a push, with its own test for both
- [ ] `GenreLayout`, `MoviePage`, `SettingsHeader` and `useDeleteMovie` are not
      edited, and their suites are green

---

## Phase 2: The player steps

**User stories**: 1–8, 24, 30, 40.

### What to build

The player's `leave` stops pushing the movie's path and becomes the hook's
callback with that path as its landing. The Back pill and Escape keep sharing
the one handler they already share, so the change reaches both at once.

This is the slice that carries three of the four reproduced symptoms. Play →
Back → Back lands on the library rather than back in the player. The detail
page comes back scrolled to where it was left, because `useRestoredScroll`
keys on the history entry and the entry stepped onto is the one it remembered
— it is not touched. And a film deleted after a player visit lands on the
library, because the stack after Play → Back is `[/, /movie/1]` and
`useDeleteMovie`'s own `useGoBack` steps onto `/` — also untouched.

The deleted movie's page still sits in the forward stack and answers
not-found, exactly as the Delete initiative decided.

### Acceptance criteria

- [ ] Back in the player is a `POP` onto the movie's page
- [ ] Play → Back → Back lands on `/`
- [ ] Escape is the same `POP` as the Back pill, through the same handler
- [ ] A deep-linked player's Back lands on its movie's page, as a `PUSH`, and
      that page's own Back then works
- [ ] The detail page's scroll is restored on return from the player
- [ ] A delete after a player visit lands on `/`, with `useDeleteMovie`
      unedited
- [ ] `Player.tsx` contains no `navigate(` call for leaving

---

## Phase 3: Import steps

**User stories**: 9, 10, 11, 12.

### What to build

`ImportFlow`'s Back stops pushing `/settings` and becomes the hook's callback
with Settings as its landing — the prototype's `goSettings()`, read as a step.
_Finish_ on the Review step is left exactly as it is: a push to `/`, the
**Fresh home** that puts the films the run just added on their shelves, at the
top and unfiltered.

Back during a run still leaves the run where it is. Nothing cancels, because
the run is the server's **Current run** and Import re-attaches to it on the
next visit — this phase does not go near `useImportRun`.

### Acceptance criteria

- [ ] Back on Import is a `POP` onto Settings
- [ ] Settings → Import → Back → Back lands on `/`
- [ ] A deep-linked Import's Back lands on `/settings`, as a `PUSH`
- [ ] Back during a running import leaves the run alone — no cancel is sent
- [ ] _Finish_ is still a `PUSH` to `/`
- [ ] `ImportFlow.tsx` has one `navigate` left, and it is Finish's

---

## Phase 4: The form's landing, and the edit and add contexts

**User stories**: 13, 14, 15, 21, 22, 29, and the edit and add halves of 20.

### What to build

The **Form context** mapping, as a small local function in the form's hook
over the two query parameters it already reads: the **Review step** when
`?problem=` is present, the movie's page when `?movie=` is, Settings
otherwise. That mapping is what the hook's landing is built from, and it is
read at the top of the hook, before any fetch — never off `editing` or
`resolving`, which are `null` until a read lands.

With the landing in place, the edit and add contexts get their leavings: Back
and Cancel already go through `goBack` and now go through it with the right
landing behind them, and _Save changes_ stops pushing `afterEdit(editing)`
after its `PATCH` and steps instead. _Add to library_ stays the push it is —
the second **Fresh home**, and the only push the form has left when Phase 5
closes.

The Import context is untouched in this phase and still pushes `/import`;
Phase 5 is where it stops.

### Acceptance criteria

- [ ] The landing is `/movie/:id` for `?movie=`, `/import` for `?problem=`,
      and `/settings` for neither — read from the URL on the first render
- [ ] _Save changes_ is a `POP` onto the movie's page; movie → _Edit details_ →
      _Save changes_ → Back lands on `/`
- [ ] Back and Cancel on an edit are `POP`s onto the movie's page
- [ ] A deep-linked edit's Back lands on its movie's page, pressed before the
      record has been read
- [ ] A deep-linked add's Back lands on `/settings`
- [ ] _Add to library_ is still a `PUSH` to `/`
- [ ] The form reached from Settings still leaves the way it did — no
      regression in the existing "the same way out" tests

---

## Phase 5: The form in Import context

**User stories**: 16, 17, 18, 19, 31, and the resolve half of 20.

### What to build

The three leavings that still push `/import` become steps through the same
`goBack` Phase 4 gave the form: Back, _Skip this one_ after its dismiss, and
_Save & continue_ after its resolve — the last of them in both its shapes, the
plain resolve and the edit-then-dismiss. `AFTER_RESOLVE` is gone as a push and
survives only as the Import context's landing.

The form's existing comment — _the list is where they go, whatever the history
says was behind the form_ — is superseded and replaced. _Resolve_ is a link
from the review, so the entry behind the form is always Import; a deep link
reaches the same place through the landing. The step is what makes the Review
step return one row shorter without a refetch of its own: the review is the
Current run's state rather than the entry's, and Import re-attaches on mount.

After this phase the form holds one `navigate` — _Add to library_ — and the
app holds no `navigate(-1)` outside the hook and no `from` in location state.

### Acceptance criteria

- [ ] _Save & continue_ is a `POP` onto the Review step, in both the resolve
      and the edit-then-dismiss shapes, and the row it fixed is gone from the
      list
- [ ] _Skip this one_ dismisses and is a `POP` onto the Review step
- [ ] Back in Import context is a `POP` onto the Review step with the row still
      listed, and nothing dismissed
- [ ] Import → Resolve → _Save & continue_ → Back lands on `/settings`
- [ ] A deep-linked Resolve's Back lands on `/import`, pressed before the
      problem has been read
- [ ] No `navigate(-1)` exists outside `useGoBack`, and no route state carries
      a `from`

---

## Phase 6: Docs and the refactor filing

**User stories**: 33, 34, 35, 36, 37, 38, 39 — the initiative's close, as the
FAB's Phase 3 and the Snackbar's Phase 4 were for theirs.

### What to build

`docs/ubiquitous-language.md`'s **Back rule**, **History step**, **Leaving**,
**Landing** and **Fresh home** entries checked against what shipped;
CLAUDE.md's `hooks/` line and its `test-support/LocationProbe` note saying the
hook takes a landing and the probe tells a step from a push; the dev journal
paragraph, which records that the bug was only ever visible on the second
press, that the probe's new spelling is what makes that assertable, and that
Series and Enrichment inherit the rule with a landing each. Then
`request-refactor-plan` over the round.

**The feature list's _Back navigation_ row is ticked ✅ when the refactor
closes, not here** — in README and CLAUDE.md. The build-order chain then loses
step 3, and the remaining six keep their numbers and their gates.

### Acceptance criteria

- [ ] The glossary's five entries match the shipped code, including `fallback`
      as the parameter's name against **Landing** as the concept's
- [ ] CLAUDE.md and README describe the hook's parameter and the probe's fourth
      spelling
- [ ] The dev journal carries the round's paragraph
- [ ] `docs/handoff/` is unedited — no prototype amendment
- [ ] A refactor issue is filed by `request-refactor-plan`, and the feature
      list's tick and the chain's step 3 both wait for it
