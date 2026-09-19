## Problem Statement

I am the maintainer, and my family are the people who use this app. Between us
there is a whole class of thing the app cannot say: **something happened away
from where you are looking.**

Every screen in FamilyFlix answers in place. A refused rating save reverts the
star, and the revert is the feedback. The Export dialog swaps to its **Export
ready** face. The Codec manager redraws from the report the route echoed. A
delete returns to browse. Six design logs looked at a snackbar and each turned
it down on the same double-grounded reason: the system did not exist **and** the
prototype drew none on that path. All six were right, and the app is better for
each of those refusals.

But there is one moment the app is about to have that has nowhere to land, and
it is the reason this exists at all. **Software update**
(`docs/design-logs/17-software-update.md`) designs a check with four outcomes,
and two of them — _a refused check_ and _you're already on the latest version_ —
cannot be drawn by the row that asked the question. Worse, the **Update offer**
is not for me: it must reach whoever is sitting in front of the television,
wherever in the app they are, and persist until they press **Update now** or
dismiss it. There is no surface in FamilyFlix that speaks across a route.

Log 17 originally carried the Snackbar as its own phase 1. Q32 of that log then
reordered itself: the bridge cannot go first, because two of its four outcomes
have nowhere to go; and the Snackbar needs no Electron, so making it wait behind
a gate it does not share buys nothing. That left a slice that is buildable
**today**, alone, and first — and a slice that runs alone deserves its own grill,
which is `docs/design-logs/18-snackbar.md`.

The awkward part, stated plainly rather than glossed: **its only designed caller
is three initiatives away.** The Snackbar is the one thing in this app that will
ship with nothing on any screen pushing to it. That is not a component built on
speculation — log 17 wrote the consumer down to five rows of fixed copy, which
variant each takes, which one persists, and which id gets retracted when
**Update now** is pressed. What is missing is Electron, and Electron has nothing
to do with a notification queue. But it does mean the proof has to be the tests,
and the tests have to assert the _rule_ rather than the implementation, so that
the first real caller cannot quietly find a different system than the one
written here.

## Solution

The **Snackbar system**: the prototype's `mol.Snackbar` translated 1:1 as a
presentational molecule, and the stack, the queue and every timer as app-level
furniture in `App/`, reached by one hook with two functions.

**The molecule knows nothing and owns nothing.** A 360px card on `surface-2`
with a 4px accent bar down its left edge, one glyph per variant, an optional
bold title over a dim message, an optional bordered action button and a ✕,
entering on `ffSnackIn`. Four variants — `info` `success` `warning` `error` —
off the four status tokens. It has no timer, no `useEffect`, no idea it is
transient. It is handed props and draws them, and the thing that unmounts it is
the stack. That is the line `COMPONENT-SPEC.md` draws, and it is what makes the
molecule testable by rendering it.

**The stack is app furniture, not a component.** A fixed bottom-right
`column-reverse` column at `z-index: 200`, `pointer-events: none` with each
card's wrapper restoring its own — so a notice that lands while the Export
dialog is open is still readable and still pressable over the scrim. It lives in
`src/App/` beside the router, because `CLAUDE.md` defines that rung as _"the
router and the app-level providers every page renders inside"_, and a
notification queue is exactly that. Not `hooks/`, whose rule is "used across 2+
features" and which would be a lie on day one; not `components/`, because timers
and a queue are not a composed primitive.

**One timing rule, and no knob.** A notice carrying an **action persists** until
it is actioned or dismissed. Every other notice **dies at 5s**. That is
`COMPONENT-SPEC`'s stated convention and log 17 Q22's ruling, and once it is the
rule, a per-notice `duration` is a second rule with no caller asking for it —
the same sin as a component with no caller, one size down. Log 17's interface
sketch carried `duration?`; this initiative owns the interface, and it is
dropped.

**Pressing the action dismisses its own notice, then runs it.** The prototype's
container does this by hand — `runUpdate` dismisses the offer by the id it
stashed — which works, and makes every future actionable caller remember a step.
One rule in one place instead. `dismiss(id)` stays public for the other case:
retracting a notice nobody pressed, which is precisely what the update flow
needs when the maintainer installs from the Settings row while the offer is
still up.

**Nothing is capped, deduped or coalesced.** No designed caller can flood it,
and two presses that each got an answer honestly produce two answers. A cap
would be a policy with no failing case, and dedupe would make the second answer
silent — the trap log 16 Q13 named.

**Nothing existing changes.** Not one of the six screens that refused a snackbar
is reopened. The prototype still draws none on any of those paths, and the
prototype is the spec; a retrofit would be redesigning six settled screens to
give a seventh something to do.

## User Stories

### The family, on any screen

1. As a family member, I want a notice that appears in the bottom-right corner
   without covering what I am looking at, so that the app can tell me something
   without taking over the screen.
2. As a family member, I want a notice carrying a button to stay on screen until
   I act on it, so that something I actually need to answer is not taken away
   while I am reaching for the remote.
3. As a family member, I want a notice with nothing to press to disappear on its
   own after five seconds, so that a confirmation does not become clutter I have
   to clear.
4. As a family member, I want every notice to carry a ✕, so that I can take any
   of them away at once whether or not it has a button.
5. As a family member, I want pressing a notice's button to take the notice away
   and then do the thing, so that I never have to dismiss a card I have already
   answered.
6. As a family member, I want the newest notice nearest the corner, so that the
   thing that just happened is the thing my eye lands on.
7. As a family member, I want a second notice to push the first upward rather
   than replace it, so that two things that happened are two things I can read.
8. As a family member, I want a notice to survive my moving between the browse
   screen, a movie page and Settings, so that something important is not lost
   because I navigated while it was up.
9. As a family member, I want a notice that lands while a dialog is open to be
   readable and pressable above it, so that the app is never speaking behind its
   own scrim.
10. As a family member using a screen reader, I want a confirmation announced
    politely and a refusal announced immediately, so that the urgency of what I
    am hearing matches what happened.
11. As a family member using a keyboard, I want the ✕ and the action button to be
    reachable by Tab like any other control, so that I can answer a notice
    without a mouse.
12. As a family member using a screen reader, I want the ✕ to announce itself as
    **Dismiss**, so that a bare glyph is not read out as punctuation.
13. As a family member, I want the notice to slide up as it arrives rather than
    snap into place, so that something appearing in the corner reads as an
    arrival and not as a glitch.
14. As a family member watching a film fullscreen, I accept that a notice raised
    behind the fullscreen surface is not seen until I leave it — an actionable
    one is waiting on the other side, and a five-second confirmation about
    something I did not do is no loss.

### The maintainer, and the callers to come

15. As the maintainer, I want one call — `notify({ variant, message })` — to be
    the whole of raising a notice, so that no future feature has to make a
    timing decision of its own.
16. As the maintainer, I want `notify` to answer the id it can be retracted by,
    so that a caller that raised a notice can take it back when the thing it was
    about is handled elsewhere.
17. As the maintainer, I want `dismiss(id)` on a notice that is already gone to
    be harmless, so that a caller retracting something the family already
    dismissed is not an error path anybody has to write.
18. As the maintainer, I want `notify` and `dismiss` to keep the same identity
    for the life of the app, so that an effect depending on `notify` never
    re-fires and a "once per launch" notice stays once per launch.
19. As the maintainer, I want `useSnackbar()` outside a provider to throw and
    name itself, so that a wiring mistake is found at the call site rather than
    blamed on the feature whose notice never appeared.
20. As the maintainer, I want the four variants to exist even though today's
    only copy table uses three, so that the variant the next caller reaches for
    is not a thing I have to go and add.
21. As the maintainer, I want the molecule to be reusable by anything, so that a
    notice about an import, an update or a codec is the same card with different
    words.
22. As the maintainer, I want a notice raised by one screen to outlive a route
    change, so that "something happened away from where you are looking" is
    literally true rather than aspirational.
23. As the maintainer, I want two identical notices to be two notices, so that
    the app never silently swallows the second answer to a question that was
    asked twice.
24. As the maintainer, I want every outstanding timer cleared when the provider
    unmounts, so that a test never leaks one and a teardown never fires against
    a gone tree.

### The screens, states and edges

25. As a family member, I want a notice with a title to draw the title in bold
    above the message, and one without to draw the message alone, so that a
    single-line confirmation does not carry an empty heading.
26. As a family member, I want a notice with no action label to draw no button at
    all, so that a card with nothing to press has nothing that looks pressable.
27. As a family member, I want the accent bar, the glyph and the action button's
    border to all take the variant's colour, so that the severity is legible
    before I have read a word.
28. As a family member, I want an `info` notice to draw a circled `i`, a
    `success` a circled tick, a `warning` a triangle with a bang, and an `error`
    a circled ✕, so that each kind is recognisable at a glance.
29. As a family member on a narrow window, I want the card to shrink rather than
    push the page sideways, so that a notice never causes a horizontal scroll.
30. As a family member, I want the stack to paint nothing at all when there is
    nothing in it, so that the corner of every screen is empty until the app has
    something to say.
31. As the maintainer, I want the stack's node to exist in the tree even when
    empty, so that assistive technology has a region that precedes its content
    rather than one that appears carrying it.
32. As a family member, I want a notice's glyph not to be announced separately
    from its message, so that the picture is not read out as a second sentence.
33. As the maintainer, I want the stack mounted above the route table rather than
    inside any route, so that no screen can be the reason a notice did not
    appear.

### What is deliberately absent

34. As the maintainer, I want no notice to carry its own duration, so that there
    is exactly one timing rule to read and exactly one to test.
35. As the maintainer, I want no cap, no dedupe and no coalescing, so that the
    stack has no policy that was never asked for by a failing case.
36. As the maintainer, I want no exit animation, so that a notice's removal is
    the node going away rather than a prop-driven transition across re-renders
    that `mol.Fab`'s spec note already warns is unreliable.
37. As the maintainer, I want `prefers-reduced-motion` left unhonoured here, so
    that a convention belonging to `GlobalStyle` and to all six animations at
    once is not started in one component.
38. As the maintainer, I want no snackbar retrofitted into ratings, add, delete,
    import, export or the codec manager, so that six settled screens are not
    redesigned to give a seventh feature something to do.
39. As the maintainer, I want Escape not to dismiss, so that the one key that
    closes the Modal keeps one meaning in this app.
40. As the maintainer, I want no route to suppress or re-parent the stack, so
    that app furniture never moves inside a feature.

## Implementation Decisions

### The units

Five folders and one amended file, in three phases:

- **`primitives/Icon/`** gains four glyph files — a circled `i`, a circled tick,
  a triangle with a bang, a circled ✕ — each on the shared `IconBase` frame at
  the prototype's 20px, paths copied from `mol.Snackbar.dc.html`'s SVG. Named
  for **what they draw**, because a primitive knows nothing about the domain;
  the molecule is where a variant becomes a picture. Not a reuse of the existing
  tick glyph, which is the bare tick of the watched toggle and a different
  shape. Not inline SVG in the molecule: every glyph in this app is an Icon
  atom. All four are re-exported from the `primitives/` barrel.
- **`components/Snackbar/`** — the molecule, its test and its styles, re-exported
  from the `components/` barrel with its props and variant types. A composed,
  domain-free block.
- **`App/useSnackbar/`** — the context, the hook and the notice type. This unit
  owns the context object; the provider imports it and supplies its value. One
  direction, provider → hook, so a consumer never pulls the provider module and
  its styles in behind the hook, and the hook is testable with nothing but a
  bare `Provider` around it.
- **`App/SnackbarProvider/`** — the fixed column, the queue, the id counter, the
  timers and the dismiss-then-run action, plus its styles.
- **`App/App.tsx`** — the provider mounted inside `ThemeProvider`:
  `ThemeProvider` › `GlobalStyle` › `SnackbarProvider` › `Routes`. The provider
  renders its children and then the stack.

`App.tsx` does **not** move into a nested folder of its own. `src/App/` is
already App's own folder — source and test co-located, which is what the
one-folder-per-unit rule asks for — and it is simultaneously the category the
two new units join. And there is **no barrel** at this rung: the four category
barrels are `primitives/`, `components/`, `utils/` and `tokens/`, so the two new
units are imported by path, on `api/`'s and `test-support/`'s precedent.

### The molecule's contract

Flat, and 1:1 with the prototype's `data-props` in its order — `CLAUDE.md`'s
rule is that the `data-props` **is** the prop interface:

- `variant` — one of `info` / `success` / `warning` / `error`, required.
- `title?` — the optional bold line above the message.
- `message` — required.
- `actionLabel?` and `onAction?` — with a label, the bordered button under the
  message; without one, no button is drawn.
- `dismissible?` — defaulting to true, the ✕.
- `onDismiss?` — what the ✕ asks for.

The action is **not** nested as `{ label, onClick }` here to match the stack's
notice. The two shapes differ on purpose: the molecule mirrors the prototype,
and the queue nests because a label with no handler is meaningless to a thing
that must wire the dismissal to it.

`dismissible` is kept even though the stack never passes `false` — every notice
the app raises can be dismissed. This is the one place where _1:1 fidelity_ and
_no knob without a caller_ disagree, and the prototype wins, because it is the
spec and the molecule is the thing being translated.

### The molecule's geometry, 1:1

`position: relative`, flex row, `align-items: flex-start`, 12px gap, 360px wide
with `max-width: calc(100vw - 48px)`, `14px 14px 14px 18px` padding, `surface-2`
background, a 1px `border` outline, the `md` radius, `0 16px 44px rgba(0,0,0,.5)`
shadow, `overflow: hidden`, and `animation: ffSnackIn .26s ease` — which is
already in `GlobalStyle` from the tokens translation. The accent bar is
absolutely positioned at `left: 0`, full height, 4px wide, in the variant's
colour. The glyph wrapper takes that same colour with `margin-top: 1px`. The
title is 15px/600 in `text`; the message 14px/1.45 in `text-dim`. The action
button is `margin-top: 10px`, `7px 14px`, transparent, a 1px border in the
variant's colour, 8px radius, 13px/700 in that colour, `opacity: .82` on hover.
The ✕ is 28px, transparent → `surface-3` on hover, `text-faint` → `text-dim`,
7px radius, `margin: -2px -4px 0 0`.

The ✕ is the molecule's **own** button in its styles, not the `RemoveButton`
primitive. That atom is the Movie form's destructive ✕ — it names itself
_Remove `<thing>`_ and turns the danger colour on hover. This one dismisses a
notice and destroys nothing. `Modal`'s own `CloseButton` is the precedent for a
dialog-shaped thing drawing its own.

The variant → colour map is the prototype's: `info` → `info`, `success` →
`success`, `warning` → `warning`, `error` → **`danger`**. The token is called
`danger` and the variant is called `error`, and both names are kept as they are:
the prototype declares the enum and the token file is already translated.

### Roles, and the live region

`role="status"` for `info` and `success`, `role="alert"` for `warning` and
`error` — a refusal interrupts, a confirmation waits its turn. This amends the
prototype's flat `role="status"` by variant, per log 17 Q20, and keeps its
`aria-label="Dismiss"` on the ✕ exactly as written. The glyphs are decorative and
stay `aria-hidden`: the variant is carried by the role, not by the picture.

**The stack container carries no live-region attribute.** The roles stay on the
cards alone. A `polite` region wrapping cards that each declare their own role
risks a double announcement, and an `alert` card inside a `polite` region is
ambiguous. The stack is still **always mounted**, empty or not — a stable node
in the tree rather than one that appears and disappears with its content, which
is also a deviation from the prototype's `sc-if hasSnackbars` and is invisible
either way, since an empty flex column paints nothing.

### The stack's geometry

1:1: `position: fixed`, `right: 24px`, `bottom: 24px`, `z-index: 200`,
`display: flex`, `flex-direction: column-reverse`, `gap: 12px`,
`align-items: flex-end`, `pointer-events: none`, with each card's wrapper
restoring `pointer-events: auto`. The prototype's `absolute` becomes `fixed` for
the same reason the Modal's scrim did: the prototype draws inside a framed
device, and the real app draws in a viewport. 200 clears the Modal's scrim at 90
and the header chrome at 40.

**No portal.** The Modal portals because it mounts deep inside a page, where a
scrim would scroll with a container and a card would lose to a stacking context.
The provider sits directly inside `App`, above the routes: `position: fixed`
there has nothing to escape, and `#root` carries no transform. One less
indirection, and one less jsdom concern.

**Order: newest nearest the corner.** Notices are appended to the array — DOM
order is oldest-first — and `column-reverse` puts the last one at the bottom.

The stack container carries a `data-testid`, which is the **first in shipping
code** in this repo. It is the queryable handle the App-level mount test needs
(see Testing Decisions), chosen over an `aria-label` — invalid on a roleless div
and not the announcement we want — and over `aria-live`, which is ruled out
above. Accepted as a small, honest deviation rather than shaping either the
markup's semantics or `App`'s props around a test.

### The queue's contract

`useSnackbar()` answers two functions:

- **`notify(notice)`** — raises a **Snackbar notice** and answers the `number`
  id it can be retracted by.
- **`dismiss(id)`** — takes one off early. Harmless against an id that is
  already gone: the filter finds nothing.

A **Snackbar notice** is `{ variant, title?, message, action? }`, where `action`
is `{ label, onClick }`. Its presence **is** the timing: present, the notice
persists until it is actioned or dismissed; absent, it dies at 5s. It carries no
`duration` and no `dismissible` — one rule covers the first, and the second is
always true.

It is named **`SnackbarNotice`**, not log 17's `Notice`: **Player notice** is
already a glossary term for the message in the big-play circle, and two Notices
in one glossary is the ambiguity this project runs a whole skill to avoid. The
house style is compound and qualified anyway.

Outside a provider, `useSnackbar()` **throws**, naming itself in the message —
the `useGenreMovies` precedent. The provider is mounted in `App`, so a consumer
out there is a wiring mistake; a no-op would hide it, and the missing snackbar
would be blamed on the feature that pushed it.

Both functions update through functional `setState` and close over no state, so
the context value is memoised once and **never changes identity**. An effect
depending on `notify` therefore never re-fires — which is precisely what lets
the update flow push its offer once per launch. StrictMode's double-invoked
effects remain the **caller's** guard, not the stack's: two `notify` calls are
two notices, because the stack does not dedupe.

Ids are a `useRef` counter, monotonically increasing, `number` — the prototype's
`_snackSeq`. Not `crypto.randomUUID` (absent in older jsdom, and a uniqueness
this does not need), and not `useId` (per component, not per notice).

### The timers

One `setTimeout` per notice **without** an action, held in a ref keyed by id.
Cleared when the notice goes by the ✕, by its action or by `dismiss`, and every
outstanding one cleared when the provider unmounts. A timer that fires against a
gone notice is harmless — the filter finds nothing — but a test that leaks one is
not.

### Nothing in `src/types/`

No `types/snackbar.ts`. That folder is the contract the frontend and the server
both import, and no route will ever see a snackbar. The variant and props types
come off the molecule through the `components/` barrel — `ModalProps`'
precedent — and the notice type off `useSnackbar`.

### Prototype amendment

One, inherited from log 17's amendment 2: in `FamilyFlix.dc.html`,
`checkForUpdates()`'s "You're on the latest version." confirmation carries
`duration: 4000`, and becomes `5000`. It moves to this initiative because it is
the Snackbar's timing rule that it makes consistent. Log 17 keeps its amendment
1 (the Settings row's _Installing and restarting…_ copy). Made **before** the
build, as `CLAUDE.md` requires.

### What is not built

No caller. No `types/` entry. No `test-support/` double. No portal, cap, dedupe,
coalescing, per-notice duration, exit animation, reduced-motion handling,
Escape-to-dismiss, hover-to-pause, or route-based suppression. And not one line
of log 17's copy table, which stays log 17's and arrives with its row.

## Testing Decisions

**A good test here asserts the rule, not the implementation.** This is the one
slice in FamilyFlix that ships unexercised by a screen, so its tests are the
whole proof until step 5 lands — and that only works if they describe the system
a future caller will meet. So: render the molecule and read what is on screen;
drive the queue through the hook and assert which notices are present, in what
order, after what elapsed. Never reach for a timer's handle, a state variable or
a styled-component's class. The prior art is the suite's own: `Modal.test.tsx`
proves the dismissal contract by pressing things, and `GenreMovies` proves a
provider by rendering a consumer under it.

### `Snackbar.test.tsx` — the molecule, by rendering it

- Each of the four variants draws its own glyph and carries its own role —
  `status` for `info` and `success`, `alert` for `warning` and `error`.
- A `title` draws the bold line; no `title` draws no line at all.
- The `message` is always drawn.
- An `actionLabel` draws a button carrying those words, and pressing it asks
  `onAction`; no `actionLabel` draws no button.
- The ✕ is present by default, announces itself as **Dismiss**, and asks
  `onDismiss` when pressed; `dismissible={false}` draws no ✕.
- The glyph is `aria-hidden`, so the picture is not a second sentence.

### `SnackbarProvider.test.tsx` — the rule, on fake timers

Driven through a small consumer rendered under the real provider — no fake, no
double:

- A notice **with an action** is still on screen after 5s and beyond.
- A notice **without** one is gone at 5s.
- The **newest is nearest the corner** — asserted with the `comesBefore`
  test-support helper over document order, not by reading a CSS property.
- Pressing the action **takes its own notice off first, then runs `onClick`** —
  observable as the notice being gone by the time the handler's effect is
  visible.
- The ✕ takes a notice off.
- `dismiss(id)` retracts a notice nobody pressed, and `dismiss` on a
  already-gone id does nothing.
- Two identical notices are two notices — nothing is deduped or coalesced.
- Unmounting the provider clears every outstanding timer, so nothing fires
  afterwards.
- The stack renders nothing visible when empty, and its node is present anyway.

### `useSnackbar.test.tsx` — the hook alone

- Calling it outside a provider **throws**, and the message names the hook.
- `notify` and `dismiss` keep a **stable identity across renders**, so an effect
  depending on `notify` fires once — the property the once-per-launch offer
  rests on.
- `notify` answers an id, and successive calls answer different ids.

### The four Icon tests

One test file per glyph, on the `UploadIcon` / `MicrochipIcon` / `DownloadIcon`
precedent: the path data matches the prototype's, the icon renders at the size
given on the shared 24×24 frame, it strokes in `currentColor` at the
prototype's widths, and it is decorative unless titled. **This amends design log
18 Q10**, which ruled the four untested on the grounds that `Icon/` is flat and
untested but for three; with three test files already there, four glyphs copied
path-for-path from a prototype are worth pinning the same way.

### `App.test.tsx` — the mount

One addition: **the stack's node is present on several different routes.**
Present everywhere means the provider is above the route table rather than
inside one route, which is the single failure mode no other test can see. Its
reachability is carried by the hook's own throw test — the stack renders only
from inside a provider — and by the provider's suite.

This is deliberately **not** a probe component mocked into a route. `App` takes
no props, and `vi.mock` appears nowhere in the frontend suite today; it also
hoists file-wide, which would reshape every other test in that file for one
assertion. A `children` prop on `App` was likewise rejected as shipping code
shaped by a test. The cost of the route-presence test instead is the
`data-testid` noted above, and it is the cheaper of the two.

## Out of Scope

- **A caller.** Nothing on any existing screen pushes a notice. Ratings, add,
  delete, import, export and the codec manager each refused one on their own
  merits, the prototype still draws none on any of those paths, and none of the
  six is reopened.
- **The update copy table.** The five moments, their variants, their persistence
  and the once-per-launch rule are all log 17's and arrive with its row.
- **The Back-to-top FAB.** Step 2, its own prototype file (`mol.Fab.dc.html`),
  its own log. Two unblocked slices are not one initiative because they are both
  unblocked.
- **Per-notice durations**, and every other timing knob.
- **A cap, a dedupe, or coalescing.**
- **An exit animation**, and `prefers-reduced-motion`.
- **Escape-to-dismiss** and **hover-to-pause**.
- **A portal**, a `types/snackbar.ts`, and a `test-support/` double.
- **A snackbar suppressed or re-parented by route**, including inside the
  fullscreen player.
- **Undo inside a notice.**
- **A snackbar for a backgrounded import** — 🧭 Roadmap.
- **Moving `App.tsx` into a folder of its own.**

## Further Notes

**The refusal this answers is its own.** Log 17 Q2 turned down a Snackbar built
alone as _"a component with no caller, the thing this project refuses to
build"_, and log 18 Q2 builds it alone anyway. The distinction is not a
loophole: what Q2 refused was a **speculative** component, one built before
anything had said what it is for. By the time log 17 finished, the consumer was
designed in full — the **Update offer snackbar**, its variant, its copy and its
persistence all written down. What was missing was Electron, which a
notification queue does not need.

**The tests are the price of the ordering, and they are named as such.** This
ships unexercised by a screen. The mitigation is that every test above asserts
the rule a caller will meet rather than the shape of the code underneath, so the
update flow cannot arrive and quietly find a different system. It is stated here
rather than glossed, because it is the one real cost of Q32's reordering.

**`prefers-reduced-motion` stays unhonoured, now across six animations rather
than five.** `ffFade`, `ffPop`, `ffBar`, `ffSpin`, the Skeleton's pulse and now
`ffSnackIn` all run unconditionally. One component is the wrong place to start a
convention belonging to `GlobalStyle`, and the day it is fixed it will be fixed
for all six at once.

**The molecule being inert is what makes the whole system testable in two
files.** One that renders a card and reads it; one that runs a queue and watches
the clock. Every timing question is in one place, and every drawing question is
in the other.

**A notice raised behind a fullscreen player is not seen until fullscreen
exits.** The stack is outside the element that went fullscreen, so the
compositor will not draw it. Accepted: an actionable notice persists and is
waiting on the other side, and a 5s confirmation about something the family did
not do is no loss. Suppressing or re-parenting by route was rejected — log 17
already ruled out a snackbar suppressed by route, and re-parenting into the
fullscreen element would put app furniture inside a feature.

**The `<Mono>`-shaped disagreement, resolved in the prototype's favour.**
`dismissible` is a prop with no caller that will ever pass `false`, kept because
the `data-props` is the prop interface. It is the only such knob in the
interface, and it is worth noting that the queue's own type — which this
initiative does own — dropped both of its equivalents (`duration` and
`dismissible`) on exactly the opposite reasoning.

**What gets ticked, and when.** **Snackbar system** ✅ in README and
`CLAUDE.md`'s feature lists, and `COMPONENT-SPEC.md`'s `mol.Snackbar` row — all
of it **after this initiative's refactor**, not when the build issues close. The
build-order chain loses step 1, and the remaining four keep their numbers and
their gates. Log 17 keeps the **Software update** tick; it no longer ticks two
lines.

---

Design log: `docs/design-logs/18-snackbar.md`
Glossary: the **Snackbar system** section of `docs/ubiquitous-language.md`
