---
name: build
description: Implement a feature to make all failing tests pass.
Use after the tdd skill has written failing tests. Use when user
says "build this", "implement this", or "make the tests pass".
Do not write code that is not required by a test or AC.
---

# Build

## Before starting

1. Read the issue in the issue tracker and all comments
2. Read the failing test files to understand expected behaviour
3. Read CLAUDE.md for project-specific stack rules and boundaries
4. Do not implement anything not covered by a failing test or AC

## Running tests

Check CLAUDE.md for the correct test command for this project.
Run the full test suite after each change to confirm nothing regresses.

## Process

1. Read the failing tests first — understand what is expected
   before writing anything
2. Implement the minimum code to make each test pass, one at a time
3. After each passing test, run the full suite — nothing else should break
4. Only touch files required by the current issue
5. Do not refactor during build — that is a separate step

## Hard rules

- No `any` types — ever
- No business logic in components or pages — extract to hooks or lib
- No `console.log` in committed code
- Check CLAUDE.md for any additional project-specific rules

## Definition of done

- [ ] All tests pass
- [ ] No TypeScript errors (if applicable): `npx tsc --noEmit`
- [ ] ACs in the issue checked off
- [ ] No console.log in code

## After completing

Report the definition of done checklist to the user.
Wait for the user to review and approve before committing.
When the user approves:

1. Check if there are uncommitted changes: `git status`
2. If there are changes, commit with:
   `feat: [feature] issue #[n] [short description]`
3. If nothing to commit, confirm the work was already committed
   during the TDD session and skip to step 4
4. Close the issue in the issue tracker
5. Confirm to the user which issue was closed and the commit hash
