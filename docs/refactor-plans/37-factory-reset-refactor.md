# Refactor plan: Factory reset — the reset wire's refusals made a table, its route and its comment back in their places, a failed erase that says only what is true, and the record of what shipped

> Source initiative: [`factory-reset`, issue #297](https://github.com/carlos-rezai/FamilyFlix/issues/297)
> Shipped so far by issue 298 (`b8b6573` RED, `bb076d7` GREEN). Issue 299,
> the Factory reset row and the Reset dialog, is **open**: it is HITL, and its
> prototype revision waits for the maintainer.
> Design log: `docs/design-logs/37-factory-reset.md`. Plan:
> `docs/PRDs/37-factory-reset-plan.md`.
> Filed as issue 300.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._

## Problem Statement

`factory-reset` shipped its first slice, the wire, as log 37 Q9 ruled: one
RED and one GREEN. The slice added `db/resetDatabase` with `ERASED_TABLES` and
`KEPT_TABLES`, `LibraryStorage.reset()`, `Media.emptyRoot()` and
`POST /api/reset`, with three suites: `resetDatabase.test`, four new leaves
in `createMedia.test`, and `routes.reset.test`.

Every log-37 ruling that applies to the wire was checked against the code for
this plan. Q1–Q4 hold:

- the two lists are spelled once, child-first, with the genre pool kept and
  its ids untouched;
- the guard reads `sqlite_master` after every migration;
- the transaction is all or nothing, `user_version` is untouched and there is
  no `VACUUM`;
- the router reaches SQLite only through `storage.reset()`;
- `emptyRoot` keeps the root, swallows each entry's failure and never follows
  a link;
- the route checks, cancels and erases in Q4's order.

The three suites are green: 92 leaves across 3 files. What the slice left
behind falls into four groups.

### 1. The route's refusals are not a table, and sit in the wrong place

- **The shape.** Every refusal table in `routes/index.ts` has the shape
  `{ status, error }`: `KEY_REFUSALS`, `START_REFUSALS`, `DECISION_REFUSALS`,
  `FOLDER_REFUSALS`, and `EXPORT_REFUSALS` since issue 296 restored it.
  `RESET_REFUSALS` is a flat map of sentences, and the route writes `409` and
  `500` as literals beside it. Issue 296's refactor fixed exactly this drift
  in `EXPORT_REFUSALS` a day earlier.
- **The placement.** `RESET_REFUSALS` was inserted between
  `createApiRouter`'s docblock and the function it documents. The long
  docblock about the six injected domains now attaches to a constant, and
  `createApiRouter` has none. Every other table sits above that docblock.
- **The route's place.** `POST /reset` and its comment were inserted between
  `DELETE /movies/:id`'s comment and its handler. The Delete dialog's comment
  now runs straight into the reset's, and `DELETE /movies/:id` has none of its
  own. The route belongs to the Storage card, so it belongs beside
  `GET /storage`, where the routes are grouped by the screen that calls them.
- **Two spellings of one rule.** Log 37 says a run waiting in review is let
  go. The import check says that: `run.phase !== 'review'`. The Sync check
  says the opposite way round: `sync.phase === 'running'`. Both are correct
  over today's unions, but they are one rule spelled twice.

### 2. A failed erase that log 37 did not name, and that nothing tests

The build added a third refusal, `500 { error: 'Could not erase the library.
Nothing was changed.' }`, for a `storage.reset()` that throws. Log 37 Q4 has
no such step. Catching it is right: in Express 5 an uncaught throw would
answer the default error page, not JSON. But:

- **No leaf reaches it.** It is the one answer of the route that no suite
  checks, so it can't be shown to run before `emptyRoot` and
  `removeComponent`, which is the point of "the database first".
- **The sentence claims too much.** `enrichment.cancel()` has already let a
  Sync in review go by the time the transaction is tried, so "Nothing was
  changed" isn't true in that case. Every other `500` in the router reads
  `Could not <verb> the <noun>`, with no full stop and no claim beyond that.
- **The record.** The deviation isn't written down anywhere.

### 3. Test tidies

- **A leaf that checks a type, not a behaviour.** `routes.reset.test`'s
  _gives LibraryStorage a reset of its own_ asserts
  `typeof storage.reset === 'function'`. The typecheck already proves that,
  and `resetDatabase.test`'s _LibraryStorage.reset_ leaf proves what it does.
- **A slot double under a second name.** `routes.settings.test` writes a
  `removableSlot({ outcome })` for the Component row's ✕. `routes.reset.test`
  writes the same double as `uploadedSlot(outcome)`, with a positional
  argument. `fixedSlot`'s docblock sanctions a suite writing its own slot "for
  a component changing mid-run", but two suites shouldn't call one double by
  two names.

### 4. Docs that describe the wire wrongly or not at all

- **CLAUDE.md, step 20** says "genres re-seeded" and "focus on _Cancel_".
  Log 37 Q1 keeps the pool and doesn't re-seed it, and Q6 keeps focus on the
  card. It also doesn't say that `storage.reset()` is how the route reaches
  the database.
- **CLAUDE.md's tree.** The `db/` line names `seriesSeed/` and not
  `resetDatabase/`. The `createMedia/` line still lists "the three removals"
  where there are four.
- **The dev journal** has no entry for the build, and none for this round.

## Solution

Four groups. The tree is working and green after every commit:

0. **The record.** The build's journal entry goes first, so it describes what
   shipped before this round changes anything.
1. **The server.** The refusal table and where it sits, one spelling of the
   review rule, a truthful and tested `500`, and the route moved beside the
   Storage card's read.
2. **The tests' tidies.** The type-only leaf retired, and the slot double
   under the name it already has.
3. **The docs.** CLAUDE.md's wire lines and the round's journal entry.

That's nine commits. No pixel, schema, status or prototype changes. One wire
sentence changes: the `500`'s, which no client reads yet (issue 299 is
unbuilt, and its plan rejects on anything but `204` and `409`).

**This round doesn't close 297, and doesn't tick step 20.** The surface is
still to be built. Step 20, the Maintainer tools entry and the README stay
🔜 until 299 ships and its own refactor round closes the initiative. That
follows the rule that a feature is Done only after its refactor.

## Commits

### Group 0: the record of what was built

1. **The journal's factory-reset build entry.** A new top entry, _Factory
   reset — the reset wire (issue #298)_, with the same sections as the earlier
   build entries:
   - **What shipped:** `resetDatabase` and its two lists, the table guard in
     its suite, `LibraryStorage.reset()`, `Media.emptyRoot()` (the fourth
     removal), and `POST /api/reset` with its two `409`s. That was one RED and
     one GREEN.
   - **The deviation the build made:** the `500` for a throwing
     `storage.reset()`, which log 37 Q4 doesn't have, and its sentence.
   - **The judgement calls left for this round:** groups 1–3 above, by name.
   - **What's still to build:** issue 299 (HITL, the prototype first).
   - **The counts** at the end of the build, measured at `bb076d7`.
   - **The follow-ups:** this plan, by bare number.

   Docs only.

### Group 1: the server

2. **`RESET_REFUSALS` is a refusal table.** It becomes
   `Record<'import' | 'sync' | 'failed', { status: number; error: string }>`:
   `import` and `sync` at `409`, `failed` at `500`, with the sentences
   unchanged. That's `DECISION_REFUSALS`' shape, an inline union for refusals
   the route decides itself. It moves up to sit after `EXPORT_REFUSALS`, above
   `createApiRouter`'s docblock, so that docblock is its function's again. Its
   own docblock says that each refusal is answered with a status and one
   sentence. The route reads `const { status, error } = RESET_REFUSALS[…]`
   and answers `res.status(status)`, as the folder add does. Every route leaf
   passes unchanged, because the answers are byte-identical.

3. **Both runs refused by one rule.** The Sync check becomes
   `sync.phase !== 'review'`, the import check's spelling of log 37's rule: a
   run waiting in review is let go, and any other phase refuses. The route's
   comment already says it this way. Every leaf passes unchanged, because
   `EnrichmentRun['phase']` is `'running' | 'review'`.

4. **A failed erase says only what is true, and is tested.** `failed`'s
   sentence becomes `Could not erase the library`, the shape of every other
   `500` in the router. "Nothing was changed" goes, because a Sync in review
   has already been let go by then. One new `routes.reset.test` leaf, _a
   database that refuses_:
   - `storage.reset` is spied to throw;
   - the route answers `500` with the sentence;
   - the media root still holds its files, `removes()` is `0` and the
     component is still the upload.

   That proves the database goes first, and that nothing after it runs when it
   fails. Prior art: `vi.spyOn(component, 'decoders')` over a real member in `createPlayback.test`.

5. **The reset route beside the Storage card's read.** `POST /reset` and its
   comment move, unchanged, to sit right after `GET /storage`, the other route
   the Storage card calls. `DELETE /movies/:id`'s comment, the Delete dialog's
   confirm, sits directly over its handler again. This is a pure move, so
   every leaf passes unchanged.

### Group 2: the tests' tidies

6. **The type-only leaf retired.** `routes.reset.test`'s _gives
   LibraryStorage a reset of its own_ is deleted. The typecheck holds the
   member, and `resetDatabase.test`'s _LibraryStorage.reset_ holds its
   behaviour. The boundary describe keeps its one real guard, that no routes
   file imports `db/`. Test only, one leaf fewer.

7. **The removable slot under one name.** `routes.reset.test`'s
   `uploadedSlot(outcome)` becomes `removableSlot({ outcome })`, with
   `routes.settings.test`'s name and its options object. It still answers
   `{ slot, removes }`, and its docblock says it is that suite's ✕ double
   with a count. The two stay apart, because each suite's fake component is
   its own (the settings suite's carries decoders). A third writer is the
   point at which it graduates to `test-support/`. Test only, and the leaf
   count is unchanged.

### Group 3: the docs

8. **CLAUDE.md describes the wire.**
   - The `db/` line names `resetDatabase/` beside `seriesSeed/`: the two
     lists, the one transaction and the guard in its suite.
   - The `createMedia/` line lists "the four removals", naming `emptyRoot`
     (the root emptied best-effort and kept).
   - Step 20 reads "the **Genre pool** kept, not re-seeded" in place of
     "genres re-seeded", and "focus on the card" in place of "focus on
     _Cancel_". It names `storage.reset()` as the route's way to
     `db/resetDatabase`.
   - Step 20 and the Maintainer tools entry **stay 🔜**.

   Docs only.

9. **The refactor's journal entry.** A new top entry, _Factory reset — the
   wire's refactor (issue 300)_, with the same sections as issue 296's entry:
   - what each group changed;
   - the one wire sentence that moved (the `500`'s);
   - the counts;
   - what is left: issue 299, then the initiative's closing round, which
     ticks step 20.

   Docs only. Closes this issue.

## Decision Document

- **Every refusal table is `{ status, error }`.** `RESET_REFUSALS` joins
  `DECISION_REFUSALS`' shape: an inline union, because the route decides
  these refusals itself and no domain answers a kind. The route reads every
  status off its table, and no status is written as a literal.
- **Tables sit above `createApiRouter`'s docblock.** Nothing goes between a
  docblock and the declaration it documents.
- **A route sits with the screen that calls it.** The reset is the Storage
  card's, so it sits after `GET /storage`. It cites `DELETE /movies/:id` as
  its precedent in words, not by being its neighbour.
- **"Let go in review" is spelled the same for both runs:** a phase other
  than `review` refuses.
- **A `500` says what failed and nothing more.** `Could not erase the
library`, the router's `Could not <verb> the <noun>`. The `500` stays: an
  uncaught throw in Express 5 would answer HTML, not JSON. The issue 299
  client already rejects on it.
- **The database goes first, and nothing after it runs on failure.** That is
  now tested, not just ordered.
- **Unchanged:** both `409` sentences, the order of Q4's eight steps,
  `ERASED_TABLES` and `KEPT_TABLES`, `resetDatabase`, `LibraryStorage.reset`,
  `Media.emptyRoot`, the guard, the glossary (its **Factory reset** and
  **Reset dialog** entries already read as log 37 rules), the README, and the
  prototype.

## Testing Decisions

- A good test checks what a unit answers, what the wire carries, or what is
  left on disk and in the database. It doesn't check how a unit is wired
  inside, or that a member exists, which the typecheck already holds.
- **Routes:** one new leaf, the throwing database. It checks the status, the
  sentence, a media root untouched and a component never removed. Prior art:
  `createPlayback.test`'s `vi.spyOn(component, 'decoders')`, a spy on one
  member of a real object. One leaf retired, the `typeof` check. Commits
  2, 3 and 5 must leave every answer byte-identical, which the existing leaves
  check.
- **`resetDatabase`, `createMedia`:** no changes. Their leaves already pin
  the transaction, the kept pool, the guard, the root kept and the link not
  followed.
- Every commit runs the touched suites, `tsc -b --force`, ESLint and
  Prettier, and they must be green. The full suite runs before the docs
  group.

## Out of Scope

- **Issue 299**, the surface: the prototype revision, `factoryReset`,
  `useFactoryReset`, `ResetDialog`, the Storage card's row and
  `stubLocation`. It is HITL and still unbuilt. It gets its own refactor
  round, which closes 297 and ticks step 20 in CLAUDE.md and the README.
- **A rejecting `importer.cancel()` after the erase.** It is the route's last
  `await`, over a run that is only in review, so it has no copy to roll back.
  If it ever rejected, Express 5 would answer its default `500`. The journal
  records this. Wrapping it would be a new behaviour with no case that
  reaches it.
- **Moving `enrichment.cancel()` after the transaction**, so that a failed
  erase lets nothing go. Log 37 Q4 fixed the order. Commit 4 makes the
  sentence true instead of reopening the order.
- **Graduating `removableSlot` to `test-support/`.** There are two writers,
  each over its own fake component. A third would graduate it.
- **A shared server `shippingSources`.** `routes.reset.test`'s walk is the
  server's only one. The frontend's `src/test-support/shippingSources/` is a
  different build target.
- Splitting `routes.reset.test`, or moving the _LibraryStorage.reset_ leaf
  out of `resetDatabase.test`. It sits beside the unit it hands over to.

## Further Notes

- Log 37 is an immutable snapshot. The journal records the `500` it doesn't
  name, and commit 4 is where that `500` gets a leaf and a truthful sentence.
- CLAUDE.md's step 20 was written from log 32 Q3a and Q3c, before log 37
  refined both ("re-seeded" became "kept", and focus on _Cancel_ became focus
  on the card). Commit 8 brings it in line with log 37. The glossary was
  already updated by `6c7efdb`.
