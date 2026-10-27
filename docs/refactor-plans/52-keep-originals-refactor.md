# Refactor plan: Keep originals, the list read without its trash, comments that say what the code does now, suites that test what is left, and the docs that close step 35

> Source initiative: `keep-originals`, issue 473 (step 35).
> Shipped by issues 474–480. The prototype revisions are 474 `b00386ab` and
> 475 `f6533642`; the build slices, RED and GREEN each, are 476 to 480
> (`f232a3b2` to `a8533b14`).
> Design log: `docs/design-logs/52-keep-originals.md`.
> PRD: `docs/PRDs/52-keep-originals.md` (473). Plan:
> `docs/PRDs/52-keep-originals-plan.md`.
> This is the initiative's closing round. It ticks **Keep originals** and
> closes 473. Filed as issue 481.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._

## Problem Statement

`keep-originals` shipped every slice of log 52's plan. At `a8533b14` the full
suite has **10977 tests across 677 files, all passing**. `tsc -b --force` is
clean. `eslint src server electron` reports one error and 138 warnings,
against one and 148 when Library audit closed: the four `*.recycle` suites
and the Shell trash's suites went, and four new warnings came in with this
initiative's suites (section 4).

The design held. No Delete reaches an **Original**: both Delete routes read
no query, record the title's **Left-out videos**, then remove the rows, then
the **Media folder**. The **Shell trash** is gone whole: `ServerMessage` is
`ready | fatal`, `ShellCommand` is `shutdown`, `createMedia` takes its media
path alone. The Delete dialog is one dialog everywhere, with no card, no
callout and no refusal. `admitFolder` answers the **Media directory
refusal**. `routes.keepsOriginals` exercises every removal FamilyFlix makes
and finds every original byte-identical.

The shipping code is small and mostly clean; the seams are where a removal
left a shape behind it, and in the tests, which were written RED by agents
that each had to prove a mechanism had gone. Every finding was checked
against the code for this plan. They fall into five families.

### 1. A shape the trash left behind, on the server

- **`LibraryTitleList` is a wrapper around one field.** It was born (issue 414) as `{ titles, linkedFilesOf }`, so a Delete could read a title's
  trashable paths off the same list. `linkedFilesOf` went in 478; the
  interface is now `{ titles }`, and all three callers in the routes unwrap
  it (`.titles`, `const { titles } = …`). Its docblock reads "its titles,
  each Linked files a kind", which is not a sentence.
- **The two Delete routes say different things about the same step.** Both
  now open with `storage.leaveOut(titleVideos(…))`. The series route's
  comment gained two lines, unwrapped from the paragraph above ("It reads no
  query: the title's **Left-out videos** are recorded first…"); the movie
  route's says nothing about Left-out videos or originals at all.
- **`admitFolder`'s docblock was edited mid-line and never rewrapped.** One
  line runs to about 100 columns ("…directory** (the **Media directory
  refusal\*\*). Answers a value and never throws — two adds").

### 2. Comments that still describe the refusal

- **`useLibraryTitles`**: `deleteTitle` "deletes a title over its unchanged
  route": unchanged from what the Recycle choice did, which nothing now
  knows. The hook's docblock had "and the delete with its refusal" cut out
  and was never rewrapped (a ten-word line).
- **`ManageLibrary`'s docblock** was cut the same way ("states are
  `useLibraryTitles`';" alone on a line).
- **`DeleteMovieDialog`'s docblock** likewise ("nothing changed. Dismissing
  does not cancel the" ends short).
- **`useDeleteMovie` and `useDeleteSeries`** each say `deleteMovie` /
  `deleteSeries` "rejects … when the server refused". _Refused_ was the
  `409`'s word; any failure rejects now.
- **`DeleteTitleBody` wraps its confirm in an arrow** (`onClick={() =>
onConfirm()}`) that was there to pass the chosen files; `onConfirm` is now
  `() => void`, `Button`'s own `onClick` type. It is the only such wrapper
  in `src/`.

### 3. Tests that assert a mechanism is gone

Two kinds, both written to make a RED commit fail:

- **Two suites read the source.** `deleteTitleAt.noRecycleChoice` greps
  every file in `src/` for `DeleteFiles`, `DeleteOutcome` and `?files=`.
  `shellHandshake.noTrash` parses `electron/`, `server/src/` and `src/` with
  the TypeScript compiler (a 120 s timeout) to find any identifier matching
  `/trash/i`, to count `createMedia`'s parameters at every call, and to read
  `src/types/shell.ts`' union members. Nothing else in the repo reads its
  own source to test it. Each assertion is either the compiler's job (the
  arity, the union), or a name that cannot come back by accident and would
  not catch a delete under another name. The guarantee itself is
  `routes.keepsOriginals`, which tests what happens to files.
- **Absence assertions on words no shipping file holds.** The dev journal's
  precedent (Add movie's refactor) deleted "a test that asserted the absence
  of words no shipping file has held … and so could not fail". This
  initiative wrote three kinds:
  - the old `409` sentences (_Couldn’t move … to the Recycle Bin_, _Only the
    desktop app can move…_) as fixtures, in `deleteTitleAt`, `deleteSeries`,
    `useLibraryTitles`, `ManageLibrary`, `DeleteMovieDialog`,
    `DeleteSeriesDialog`, `MovieDetail` and `SeriesDetail`: each a "`409` is
    a failure like any other" case beside the suite's own `500` case, except
    on the two detail pages, which have no other delete failure;
  - `CALLOUT` and `/Recycle Bin/` queried for absence in
    `DeleteTitleDialog`, `ManageLibrary`, `DeleteMovieDialog` and
    `DeleteSeriesDialog`;
  - `not.toHaveProperty('refusalFor')` in `useLibraryTitles`, and the
    `useDeleteMovie` / `useDeleteSeries` "answers … and no refusal" cases,
    which pin a hook's key list.

  What can fail stays: in the shell (a **Folder bridge** present) the dialog
  draws no `radio` (the PRD's story 3: no option that removes files) and the
  confirm sends a plain `DELETE` with no query.

### 4. The server's delete suites, five ways to say one thing

- **A stray `?files=trash` is pinned in five suites.** Log 52 Q6: "ignored,
  as every route ignores a query it does not read". `routes.keepsOriginals`
  runs its three Delete cases under both a plain Delete and the old client's
  query, which is the PRD's story 32. `routes.deleteKeepsFiles` has two more
  `describe`s of it (`?files=trash changes nothing`, `no Delete answers 409,
even with no shell`) and runs its copied case under it;
  `routes.linkedDelete`'s `remove` helper sends it on **every** request;
  `routes.leftOut` has a `describe` of it; `routes.linkedVideo` sends it in
  its two Delete cases.
- **Test names name a party that no longer exists.** _never asking the
  shell_ (five cases in `deleteKeepsFiles`), _never asks the Trash_ / _without
  a word to the Trash_ (`linkedDelete`), _never asking the Trash_
  (`linkedVideo`). There is no shell or Trash in the harness for them to ask,
  so the clause asserts nothing.
- **The suites' headers narrate the slices** ("Since issue #476 a Delete
  keeps every video…, and since issue #478 the Media domain has no shell to
  ask"; "The Media domain is made from its media path alone (issue #478):
  there is no shell for a Delete to ask"). A header says what the suite pins
  and which initiative and phase wrote it, not what changed later.
- **Four new lint warnings**, `no-non-null-assertion`, in suites this
  initiative wrote: `deleteTitleAt.test` (`mock.calls[0]!`),
  `ManageLibrary.test`, `DeleteMovieDialog.test` and `DeleteSeriesDialog.test`
  (one each, in the _in the shell_ cases).
- **Twenty-odd em dashes were added** after the rule against them: suite
  headers (`52 — Keep originals, issue #479`) and `describe` titles
  (`DeleteTitleDialog — a linked title, in the shell`,
  `admitFolder — the Media directory refusal`, `useDeleteMovie — what it
answers`). Library audit's round settled the forms: `52, Keep originals,
…` and `admitFolder: the Media directory refusal`.

### 5. The documents (log 52 Q13)

- **Feature checklist**: the _Keep originals_ row is 🔜, and there is no
  step 35 entry.
- **README**: the Library paragraph still says Deleting a title leaves its
  files "unless you ask for the Recycle Bin".
- **CLAUDE.md**: _Product Rules_ **Media** still says a linked video is
  "kept by a Delete unless the household asks, then only to the Recycle
  Bin".
- **Release checklist**: _The Shell trash_ smoke expects the folder in the
  Recycle Bin, and _A locked file_ expects a Delete to be refused naming the
  file. Neither can happen now.
- **Glossary**: the _Keep originals_ section is still `(new)` and "Planned
  (🔜)". Its dialogue says "his originals" of Dad; the glossary's own word
  everywhere else is the household's.

## Solution

One round, in five groups, each commit leaving the suite green and the
typecheck clean:

1. **The list read without its trash.** `libraryTitleList` answers
   `LibraryTitles`; both Delete routes say the same thing about Left-out
   videos and originals; `admitFolder`'s docblock is rewrapped.
2. **Comments that say what the code does now.** The client's docblocks lose
   the refusal; `DeleteTitleBody` hands `Button` its confirm.
3. **Suites that test what is left, on the client.** The two source readers
   go; the `409`s become the failure they now are; absence assertions on dead
   words go, the shell's no-choice assertion stays.
4. **One place pins a stray query, on the server.** `routes.keepsOriginals`
   keeps it; the other four suites send a plain Delete and name what they
   test.
5. **Lint, prose and the docs that close step 35.**

No behaviour changes. No wire shape changes: `libraryTitleList` is
server-internal. Nothing on the schema, Settings or the prototype changes.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [keep-originals] issue #481 …`, except where a commit is named
`test:` or `docs:`.

### Group 1: the list read without its trash

1. **`libraryTitleList` answers the titles.**
   - `libraryTitleList(storage, mediaPath): Promise<LibraryTitles>`; the
     `LibraryTitleList` interface goes. Its docblock is the read's own
     paragraph, unchanged but for the closing sentence (it answers the
     titles, A to Z, and never throws).
   - The three route callers (`deleteFactsOf`, `GET /library-titles`, the
     clear's echo) read the answer directly.
   - `libraryTitleList.test.ts` follows the shape: `(await
libraryTitleList(…)).titles` becomes the call itself. No assertion
     changes.
   - Guarded by `libraryTitleList.test.ts`, `routes.libraryTitles`,
     `routes.test` (the detail reads' `deleteFacts`) and
     `routes.keepsOriginals`.
2. **Both Delete routes say the same thing.**
   - Each route's comment carries one sentence, in the same words, in its
     own paragraph: the title's **Left-out videos** are recorded first, so a
     scan won't add it again, and every **Original** stays where it lies; the
     route reads no query. The series route's appended two lines fold into
     it; the movie route gains it.
   - Comments only. Guarded by `routes.deleteKeepsFiles` and
     `routes.keepsOriginals`, unchanged.
3. **`admitFolder`'s docblock is rewrapped** to 80 columns, the rules listed
   in the order the code checks them. Its older em dash is kept, as Library
   audit's round kept the dashes it only rewrapped. Comments only.

### Group 2: comments that say what the code does now

4. **The client's docblocks lose the refusal.**
   - `useLibraryTitles`: `deleteTitle` sends "a plain `DELETE`" (no
     "unchanged route"); the hook's docblock is rewrapped.
   - `ManageLibrary` and `DeleteMovieDialog`: their docblocks are rewrapped
     where the refusal's words were cut out.
   - `useDeleteMovie` and `useDeleteSeries`: `deleteMovie` / `deleteSeries`
     reject "with the request's own error when the delete failed", and
     nothing moved.
   - Comments only; no suite changes.
5. **`DeleteTitleBody` hands `Button` its confirm.** `onClick={onConfirm}`,
   as `ClearDialog`'s confirm, its neighbour, passes its own. Guarded by
   `DeleteTitleDialog.test`' _confirms asking nothing of the files_ and the
   three dialogs' confirm cases, unchanged.

### Group 3: suites that test what is left, on the client

6. **`test: [keep-originals] issue #481 the source readers go`.**
   - `deleteTitleAt.noRecycleChoice.test.ts` and
     `shellHandshake.noTrash.test.ts` are deleted.
   - What they asserted is held elsewhere: `createMedia`'s one parameter and
     the handshake's three members by the compiler (`tsc -b --force`), and by
     `serverHandle.test` and `shellHandshake.test`, which drive `ready`,
     `fatal` and `shutdown` both ways; the absence of `DeleteFiles` and `DeleteOutcome` by the
     compiler too, since nothing exports them; a Delete that keeps every
     original by `routes.keepsOriginals`.
   - The commit body says why, citing the dev journal's precedent: an
     absence that cannot fail is not a test, and a test that reads its own
     source is testing names, not behaviour.
   - The suite count drops by two files.
7. **`test: [keep-originals] issue #481 the delete wire and hooks fail as one`.**
   - `deleteTitleAt.test` and `deleteSeries.test`: _rejects a 409, even one
     naming its reason_ and _rejects on a 500_ become one
     `it.each([409, 500])('rejects on a %i')`, with no sentence in the body;
     the trash `SENTENCE` constants go. `deleteMovie.test` already has no
     `409`.
   - `useLibraryTitles.test`: the `a 409` `describe` goes, the suite's own
     _never rejects on %s: false, and the list as it was_ (a server error, a
     network failure) carrying it; so does
     `not.toHaveProperty('refusalFor')`.
   - `useDeleteMovie.test` and `useDeleteSeries.test`: the _what it answers_
     `describe`s go (a hook's key list is an implementation detail; its
     callers' suites read `deleting` and the confirm). _stays where it is
     when the delete is refused_ keeps its body and is renamed _…when the
     delete fails_, the word the hooks' docblocks now use.
   - No shipping change.
8. **`test: [keep-originals] issue #481 the Delete dialogs test what they draw`.**
   - `DeleteTitleDialog.test`: `CALLOUT` goes with the two _draws no callout_
     cases; the _in the shell_ `it.each` keeps its `radio` and What goes /
     What stays assertions and drops the `/Recycle Bin/` and `CALLOUT`
     queries.
   - `ManageLibrary.test`: `NO_SHELL` and `CALLOUT` go; _takes a 409 as any
     failure_ goes, the suite's existing delete-failure case carrying it;
     _opens the linked Delete dialog; a browser keeps the files, no callout_
     keeps its What stays assertion and loses the callout query, renamed
     _…a browser keeps the files_. The _in the shell_ cases keep `radio` and
     drop `/Recycle Bin/`.
   - `DeleteMovieDialog.test` and `DeleteSeriesDialog.test`: the _a 409 is a
     failure like any other_ `describe`s go (each suite's `failure` /
     _stays put when the delete is refused_ case carries it), with their
     `SENTENCE`s; the _in the shell_ cases drop `/Recycle Bin/`.
   - `MovieDetail.test` and `SeriesDetail.test`: _stays on the film / show
     on a 409, no refusal line drawn_ becomes _stays on the film / show when
     the delete fails_, answered by `serverErrorResponse()`; `NO_SHELL` goes.
     These are the pages' only delete failure cases, so they stay.
   - Each touched block's comment says what it pins now, not which issue
     removed what.
   - No shipping change.

### Group 4: one place pins a stray query, on the server

9. **`test: [keep-originals] issue #481 the delete contract suites send a plain Delete`.**
   - `routes.deleteKeepsFiles`: the `?files=trash changes nothing` and `no
Delete answers 409, even with no shell` `describe`s go, but for the
     `404` case, which joins the first `describe` as _answers 404 for an
     unknown film or show_ over a plain Delete. Its copied case sends a plain
     Delete and its `describe` is _a copied title's Delete_. Every _, never
     asking the shell_ clause leaves its case name. The header says the
     contract in its last two sentences, without the issue history.
   - `routes.linkedDelete`: `remove` sends a plain Delete and its docblock
     goes with the old client; _DELETE a copied title, never asks the Trash_
     is _DELETE a copied title_, its two cases _deletes a copied film / show,
     its Media folder gone_. Header likewise.
   - What is lost is covered once: `routes.keepsOriginals`' `QUERIES` runs a
     linked movie, a linked series and a copied movie under `?files=trash`
     with byte-identical originals and the Left-out entries.
10. **`test: [keep-originals] issue #481 the left-out and linked-video suites send a plain Delete`.**
    - `routes.leftOut`: the _an old client's ?files=trash Delete leaves its
      videos out too_ `describe` goes; its header's third bullet goes.
    - `routes.linkedVideo`: its two Delete cases send a plain Delete and lose
      _, never asking the Trash_; the header's last sentence about issues 476
      and 478 goes.
    - Guarded by `routes.keepsOriginals`, as commit 9.

### Group 5: lint, prose and the docs

11. **`test: [keep-originals] issue #481 the new suites lint clean`.** The
    four new non-null assertions are dropped (`mock.calls[0]`, read bare),
    as Library audit's commit 23 did: the project does not set
    `noUncheckedIndexedAccess`. The round ends at one error and 134
    warnings.
12. **The initiative's em dashes go.**
    - Suite headers read `52, Keep originals, …`; `describe` titles take a
      colon (`DeleteTitleDialog: a linked title, in the shell`). The
      headers of suites from earlier initiatives that this initiative only
      appended to keep their own first line (`47 — Manage library, …`)
      and lose the dash only on the line this initiative wrote.
    - The household's copy keeps its dashes: _Its files on … — they can’t be
      reached right now_ and _Your original in its library folder — Scan
      folders would bring it back_ are the prototype's words.
    - No code changes; every suite passes with the same count.
13. **`docs: [keep-originals] issue #481 the docs know originals are kept`.**
    - **Feature checklist**: the _Keep originals_ row goes ✅. A step 35
      entry under step 34's, in its shape, says where it came from (a
      linked series' Delete sent a thousand episodes to a Recycle Bin that
      purged them) and what shipped: a Delete never touches a file in a
      Library folder, linked or copied, with nothing to choose; the dialog
      is the same in the app and a browser; the app's own media folder
      can't be added as a Library folder.
    - **README**: the Library paragraph's "unless you ask for the Recycle
      Bin, and a file another title plays is never thrown away" becomes
      "and never deletes a file of yours".
    - **CLAUDE.md**: _Product Rules_ **Media**: "A linked video is played
      read-only and never deleted: FamilyFlix deletes nothing outside the
      **Managed media directory**" (log 52 Q13).
    - **Release checklist**: _The Shell trash_ becomes _Keep originals_: in
      the shell over a sandbox Library folder, delete a linked film, a linked
      series and a copied film; every original is still there, and _Scan
      folders_ does not bring them back. _A locked file_ goes: no Delete is
      refused now. A new line adds the media directory as a Library folder
      and reads the refusal.
    - **Glossary**: the _Keep originals_ section loses `(new)` and
      "Planned (🔜)"; the dialogue's "his originals" reads "the household's
      originals". The other dialogue sections are snapshots and stay.
14. **`docs: [keep-originals] issue #481 the journal`.** A newest-first
    entry in `docs/dev-journal.md`, in the last entry's shape:
    - what shipped;
    - what each group changed;
    - where the round left the plan;
    - what was deliberately not changed;
    - the follow-ups.

    The commit closes 473 in words, not with a keyword, and this issue with
    one.

## Decision Document

- **`libraryTitleList` answers `LibraryTitles`.** The wrapper existed to
  carry `linkedFilesOf` beside the titles; with that gone, a one-field
  object is a second name for the answer. The read keeps its name: it is
  still the Manage library page's list, read off the disk now.
- **The Delete routes keep their inlined `leaveOut`.** Log 52 Q6 inlined it
  in both routes on purpose, as `recycleChoiceFirst`'s replacement; the two
  routes already share every other step by shape, not by helper. Only their
  comments are made to agree.
- **Source-reading tests go, not move.** Nothing else in the repo reads its
  own source, and the compiler holds every structural claim they made. The
  behaviour they stood for (no Delete touches an original) has its own
  suite, which tests files on disk. Keeping a 120 s whole-repo parse for a
  name is the wrong trade.
- **An absence assertion stays only where a plausible change could make it
  fail.** A choice card coming back into the Delete dialog is plausible, so
  the shell's `radio` check stays (story 3). The Recycle Bin's sentences,
  `refusalFor` and the callout's words exist nowhere in shipping code, so
  their absence checks go.
- **A `409` is a failure like any other, so it is tested as one.** The wire
  folds `409` and `500` into one case; the hooks and dialogs keep their own
  `500` case; the two pages, which had only the `409`, take a `500`.
- **One suite pins the stray query.** The PRD's story 32 asks that an old
  client's `?files=trash` triggers nothing; `routes.keepsOriginals` asserts
  exactly that, byte for byte. Every route ignores a query it does not read,
  so a second, third and fourth copy pin a route's indifference, not a
  product rule.
- **`deleteKeepsFiles` and `linkedDelete` stay as suites.** They pin what
  `keepsOriginals` does not: the `404`, an unreachable Library folder, the
  Media folder's art and subtitles going, a copied title with no original.
  Folding them would mix the guarantee with the contract.
- **Em dashes**: only those this initiative wrote; household copy keeps
  its own, as Library audit's round decided.
- **Nothing on the schema, the wire, Settings or the prototype changes.**

## Testing Decisions

- **A good test asserts what a caller or a household sees**: the files on
  disk and their bytes, the rows held, the status answered, the request
  sent, the words drawn, the choices offered. It never asserts which helper
  ran, what a hook's keys are, or what its own source spells.
- **The initiative's behavioural suites carry every refactor commit
  unchanged**: `routes.keepsOriginals` (every removal, both Delete queries),
  `routes.deleteKeepsFiles`, `routes.linkedDelete`, `routes.leftOut`,
  `routes.libraryFolders`, `admitFolder`, `linkedFiles`,
  `libraryTitleList`, `libraryTitleView`, and the three Delete dialogs'
  What goes / What stays cases.
- **Characterization before change.** Groups 1 and 2 change no assertion;
  commit 1 follows the answer's shape in one suite. Groups 3 and 4 only
  remove, rename or re-fixture cases, each with its reason in the commit
  body, and the count of what goes is in the journal. A suite that needs to
  change anywhere else is reading an implementation detail, and is fixed in
  the same commit with the reason in the body.
- **No new suite.** Prior art for each surviving shape: `useLibraryTitles`'
  _never rejects on %s_ for one failure case over several answers; Library audit's
  commit 23 for bare `mock.calls[0]`.
- **The gate:** the full suite at the end of each commit; `tsc -b --force`
  (an incremental build can miss a spec file) and `eslint src server
electron` at the end of each group. The round ends at one error and 134
  warnings.

## Out of Scope

- **`useDeleteMovie` and `useDeleteSeries` as twins.** With the refusal gone
  they differ only in their wire call and their **Landing**; a shared hook
  would be the first in `src/hooks/` to take a wire call as a parameter.
  Carried from Library audit's list.
- **The Delete routes as a domain step.** Left-out videos, rows, then the
  Media folder is orchestration across `library/` and `media/` in the
  routes file, as it was before this initiative; a `deleteTitle` domain
  operation is the routes file's own round, beside its two reserve-or-reuse
  closures.
- **`linkedFiles`' `folder` / `videos` split.** It now only words What
  stays (_Its folder_ / _Its video file(s)_), but those are the prototype's
  two lines, so the kind stays.
- **`ShellCommand` as a one-member union**: the handshake's shape, kept
  open for the next command as `ServerMessage` is.
- **A boot-time check** of Library folders already listed against the
  Managed media directory (log 52 Q10).
- **Em dashes older than this initiative**, and the household's copy.
- **Step 30's frozen handoff** (`handoff-manage-library/`).
- Anything log 52 put out of scope: Loading states, Scan new folders, any
  way to free a linked title's disk space inside FamilyFlix.

## Further Notes

- Group 3 is the round's reason to exist: the tests that proved a mechanism
  had gone were the right RED, and the wrong thing to keep. After it, every
  suite this initiative touched tests something that could break.
- Order: commit 1 before 2 (both touch the routes file; 1 is the code
  change). Commits 7 and 8 before 11 (the lint lines sit in suites they
  touch; 11 drops whatever `!` survives). Commit 12 after 6 to 11, so it
  rewrites only the headers that stay. Groups are otherwise independent.
- Follow-ups this plan already sees, each for the journal, not this round:
  - the Delete routes as a domain step, with the routes file's
    reserve-or-reuse closures;
  - `useDeleteMovie` and `useDeleteSeries` as one hook;
  - from earlier entries: a shared error-reason helper and a plural helper,
    a text-button primitive, the `routes.enrichment` 409 case under load
    and the sandbox teardown flake, a shared held-response and
    player-harness test helper, the repo-wide em dash pass, and the lint
    error in `EnrichmentReview.test.tsx`.
