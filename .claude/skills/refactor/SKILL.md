---
name: refactor
description: Execute a refactor plan commit by commit. Use after
request-refactor-plan has filed a work item. Each commit must leave
the codebase in a working state with all tests passing.
---

# Refactor

## Before starting

1. Read the refactor plan work item
2. Read `docs/refactor-plans/[nn]-[feature-name]-refactor.md`
3. Read `docs/ubiquitous-language.md` for correct terminology
4. Check CLAUDE.md for the correct test command for this project
5. Run the full test suite to confirm green before touching anything

## Steps

1. Work through the Commits section of the refactor plan one commit
   at a time

2. Before each commit, state which commit you are implementing and
   what it changes

3. After each commit, run the full test suite — do not proceed to
   the next commit until all tests pass

4. Wait for the user to review and approve before committing —
   do not commit speculatively

5. After the user approves, commit with:
   `refactor: [feature] [short description from plan]`

6. Repeat for each commit in the plan

7. After the final commit, close the refactor plan work item:
   `gh issue close [issue-number] --comment "Refactor complete."`
   Then confirm to the user which issue was closed

## Rules

- No new features — if something outside the plan is discovered,
  add it to the dev-journal and continue
- No skipping commits — each one must be reviewed individually
- If a commit would break tests, stop and report to the user
  before proceeding
- Do not modify design logs — they are immutable snapshots
