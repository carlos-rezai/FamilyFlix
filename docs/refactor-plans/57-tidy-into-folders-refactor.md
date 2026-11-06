# Refactor plan: tidy into folders, one rule for a noisy year, a show that clashes, a move that says why it failed, extras in the media domain, and the spec that matches the build

> Source initiative: `tidy-into-folders`, issue 523 (step 40).
> Shipped by issues 524 to 530 (up to `345ef4c3`), driven by `issue-loop`;
> 531, the documents, closes the build.
> Design log: `docs/design-logs/57-tidy-into-folders.md`.
> PRD: `docs/PRDs/57-tidy-into-folders.md` (523). Plan:
> `docs/PRDs/57-tidy-into-folders-plan.md`.
> This is the initiative's closing round. It ticks **Tidy into folders**.
> Filed as issue 532.
> Planned alone, on the maintainer's standing instruction; the maintainer
> approved every recommendation in advance.

## Problem Statement

`tidy-into-folders` shipped every phase of its plan: a Folder scan files a
`loose` **Problem** per **Loose video**, _Tidy into_ and _Tidy all_ move and
import from review, and the **Folder row**'s **Tidy dialog** moves on its own.
Each slice was built by a fresh subagent from its tests alone, and each left
a decision the tests did not settle. Verified in the code at `345ef4c3`:

### 1. A noisy stem loses its year

Log 57 Q6 says `Apex.2026.1080p.BluRay.mkv` goes into `Apex (2026)\`. The
**Tidy folder name** is `titleWithYear(titleGuess(stem), yearInName(stem))`,
and `titleGuess` drops **Release noise** first while `yearInName` does not:
its tail pattern allows a resolution after the year but nothing after that,
so the file goes into `Apex\`. The tests used `Apex.2026.1080p.mkv`, which
both read the same way. The Folder scan's `no-row` guess and `matchRows`'
folder year share the same blind spot for a folder named
`Die.Hard.1988.1080p.BluRay`.

### 2. A show's folder is never checked for a clash

`tidyPlan` checks a film's folder name against every entry in the root, case
folded, and keeps a clash with its sentence (log 57 Q7). A show's folder is
not checked. With `Breaking Bad\` already in the root and loose
`Breaking.Bad.S02E01.mkv` beside it, the scan files a show tidy whose press
fails at the exclusive `mkdir` with _A folder called “Breaking Bad” is
already here._, where a film would have been listed as a clash up front.
The two kinds should follow one rule.

### 3. The importer reads the move's failure from its wording

`tidyIntoFolder` answers `{ ok: false; reason }`. The Importer tells an
unreachable root from any other failure with `reason.startsWith(UNREACHABLE)`,
and a failed rollback with `reason.endsWith('Some of its files are in …')`.
The stop rule of the bulk and the redraw's sentence both hang on copy: a
rewording breaks them with no type error.

### 4. The media domain imports from import-export

`readLooseVideos` imports `isExtra` from `splitCollections`. It is the first
time `media/` depends on `import-export/`; every other dependency runs the
other way. Whether a filename names an extra is a fact about a file, the
media domain's business.

### 5. The spec and the build disagree in three places

- **The destination.** `COMPONENT-SPEC.md`'s `ProblemRow` row (amended in 524) draws `<root>\<folder>\`. The build follows log 57: the row draws
  `→ <folder>\<video>`, and the Tidy dialog draws the video in mono and
  `→ <folder>\` beside it.
- **Where the Tidy dialog opens.** It lives in `FolderListEditor`, which
  Import setup also draws, so a folder's _Tidy_ opens there too. That is
  right (it is the same Folder row, and no run is going), but the spec only
  names the Library folders page.
- **`KeptLoose` carries `folder`.** The PRD gives `{ files, reason }`; the
  build adds an optional `folder`, the clash's Tidy folder name, which the
  clash Problem takes as its title. It is the right shape and undocumented.

### 6. Copy no document holds

- A failed rollback redraws _Couldn't move it: <why> Some of its files are
  in “<folder>”._ (no _Nothing was moved._, which would be false).
- An untitled episode's kept reason: _Doesn't name its show, left where it
  is._, the Warning line's words for one file.
- One video moved: _Moved 1 video into folders of their own. Scan all
  folders to add them._ The plural's grammar, wrong for one.

### 7. Two wiring gaps no test covers

`ImportFlow` hands `onTidy` and `onTidyMany` from `useImportRun` to
`ImportReview`; no test presses through that seam, so a dropped prop would
ship green.

## Solution

Fix the two behaviours the log already decided (the noisy year, the show
clash), give the move's failure a typed cause, move the extras rule to the
media domain, settle the one wrong sentence, cover the wiring, and bring the
spec and glossary in line with what was built. No new feature, no new
route, no schema.

## Commits

1. **`yearInName` reads past Release noise.** Read the year through
   `dropReleaseNoise`, as `titleGuess` already does, so a name and its guess
   agree on the year. Tests first, in `titleKey`'s suite:
   `Apex.2026.1080p.BluRay` answers 2026; `Die Hard (1988)`,
   `Die.Hard.1988.1080p` and a name with no year answer as before. Then a
   `tidyPlan` test: `Apex.2026.1080p.BluRay.mkv` plans into `Apex (2026)`.
   The Folder scan's `no-row` guess and `matchRows` pick the fix up with no
   change of their own; their suites stay green.

2. **A show's folder clashes like a film's.** In `tidyPlan`, a show tidy
   whose folder name is already in the root's names, case folded, goes to
   `kept` with the clash sentence and `folder`, carrying every episode and
   companion of the group. Tests: a root holding `Breaking Bad\` and two
   loose episodes plans no tidy and one kept entry with the sentence; a
   `createImporter` test files one `loose` clash Problem titled
   `Breaking Bad`, with no `tidy` and no Tidy button.

3. **The move answers its cause.** `TidyMove`'s failure gains
   `unreachable: boolean` and `stranded: boolean` beside `reason`.
   `tidyIntoFolder`'s tests assert the flags on the root-gone case and the
   failed-rollback case (both false elsewhere). The Importer reads the flags
   and drops the `startsWith` and `endsWith`; its existing tidy, bulk-stop
   and redraw tests stay green unchanged. `UNREACHABLE` stops being
   exported if nothing else reads it.

4. **`isExtra` moves to the media domain.** A new `media/isExtra/` unit holds
   the extras rule and its own test (the cases `splitCollections` already
   exercises: a trailer, a sample, a featurette, and a title that merely
   contains the word). `splitCollections` and `readLooseVideos` import it
   from media. No behaviour change; both suites stay green.

5. **One moved video reads in the singular.** The Tidy dialog's snackbar for
   one: _Moved 1 video into a folder of its own. Scan all folders to add
   it._ Test in `TidyDialog.move.test.tsx`, beside the plural case.

6. **The review's tidy wiring is tested.** An `ImportFlow` test over a run
   with `loose` Problems: _Tidy into_ posts to the single route and _Tidy
   all_ posts the ids to the bulk route, the run redrawn from each answer.
   Prior art: `ImportFlow`'s _Import all as guessed_ test.

7. **The documents match the build.** In `COMPONENT-SPEC.md`: the
   `ProblemRow` row's destination as `→ <folder>\<video>`; the Tidy dialog's
   rows as the video in mono with `→ <folder>\`; the Folder row's _Tidy_
   opening the dialog wherever the row is drawn (Library folders page and
   Import setup); the rollback, untitled-episode and singular sentences. In
   `docs/ubiquitous-language.md`: **Tidy plan**'s kept entries carry the
   clash's **Tidy folder name**; a show's folder clashes like a film's. The
   shared `tidy` types' docblock names `KeptLoose.folder`. Then
   `docs/feature-checklist.md` ticks step 40 ✅ and the dev journal records
   the round.

## Decision Document

- **The year rule is fixed at its source**, `yearInName`, not in
  `tidyPlan`: log 57 Q6 defines the Tidy folder name as the `no-row` guess's
  spelling, so the two must change together. The change widens what reads
  as a year (a year followed by Release noise) and narrows nothing.
- **A show clash is kept, never merged.** A show whose folder exists is left
  loose, as a film is (log 57 Q7): moving episodes into an existing folder
  stays out of scope, and _Resolve_ covers it.
- **`TidyMove` failure shape**:
  `{ ok: false; reason: string; unreachable: boolean; stranded: boolean }`.
  `reason` stays the full sentence the row and dialog draw; the flags are
  what code branches on.
- **`isExtra` belongs to the media domain**; import-export depends on media,
  never the reverse.
- **`KeptLoose.folder` stays**, optional, present on a clash: the clash
  Problem's title. Documented, not removed.
- **The Tidy dialog opens wherever a Folder row is drawn**, Import setup
  included. A tidy is refused only while a run scans or imports.
- **Approved copy**: the rollback redraw, _Doesn't name its show, left where
  it is._, and the singular snackbar above.
- **`moved` counts videos**, so a show counts each episode, matching _Moved
  N videos_.

## Testing Decisions

- A good test drives a unit through its public face and asserts what a
  caller or the maintainer sees: the plan answered, the files on disk, the
  rows and buttons drawn, the request posted. It never asserts which helper
  ran.
- `titleKey` (`yearInName`), `tidyPlan`, `tidyIntoFolder`, the new
  `isExtra`, `createImporter` (the show clash Problem), `TidyDialog` (the
  singular) and `ImportFlow` (the wiring) gain tests; every other suite
  must stay green untouched, which is the proof of the pure moves.
- Prior art: `titleKey`'s table tests, `tidyPlan`'s and `tidyIntoFolder`'s
  own suites, `splitCollections`' extras cases, `createImporter.looseShows`,
  `TidyDialog.move`, `ImportFlow`'s bulk-action test.

## Out of Scope

- Moving into an existing folder, renaming files, naming a show by hand.
- A new folder's loose count before the list is read again (it shows 0
  until then).
- Retrying only the failed ids after a partial failure (a second press
  re-posts the drawn ids, and the fresh plan skips what already moved).
- A separate busy label for _Tidy into_.

## Further Notes

- Every finding came from the `issue-loop` subagents' hand-backs: the slice
  that built a unit was not the one that saw its seam.
- The RED step of 525 ran to 147k tokens against a 100k budget, and 529's
  GREEN to 119k: the scan-side slice carried three new units and the
  importer's filing at once. Worth remembering for `prd-to-issues`.
