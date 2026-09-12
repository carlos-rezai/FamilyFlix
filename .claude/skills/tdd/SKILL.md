---
name: tdd
description: Write all failing tests for a GitHub issue and stop at RED.
Use before /build. Confirms the interface and behaviour list with the
user before any implementation begins.
---

# Test-Driven Development

## Before starting

1. Read the GitHub issue with `gh issue view <number> --comments`
2. Grep `docs/ubiquitous-language.md` for the terms the issue bolds — the
   glossary is far too large to read whole
3. The issue's acceptance criteria are the behaviours to test — every one,
   and only those

## Project test setup

- The runner, the never-`npx` rule and where a test lives (beside its unit)
  are in CLAUDE.md
- Doubles live in `src/test-support/` and `server/src/test-support/` — reach
  for one before writing a mock; see [mocking.md](mocking.md) for the
  boundaries they cover

## Philosophy

**Core principle**: Tests should verify behavior through public
interfaces, not implementation details. Code can change entirely;
tests shouldn't.

**Good tests** are integration-style: they exercise real code paths
through public APIs. They describe _what_ the system does, not _how_
it does it. A good test reads like a specification — "the family can
resume a film where they left it" tells you exactly what capability
exists. These tests survive refactors because they don't care about
internal structure.

**Bad tests** are coupled to implementation. They mock internal
collaborators, test private methods, or verify through external means.
The warning sign: your test breaks when you refactor, but behavior
hasn't changed.

## Workflow

### 1. Planning

Before writing any code:

- [ ] Confirm with user what interface changes are needed
- [ ] Confirm with user which behaviors to test (prioritize)
- [ ] Identify opportunities for [deep modules](deep-modules.md)
- [ ] Design interfaces for [testability](interface-design.md)
- [ ] List the behaviors to test (not implementation steps)
- [ ] Get user approval on the plan

Ask: "What should the public interface look like? Which behaviors
are most important to test?"

**You can't test everything.** Confirm with the user exactly which
behaviors matter most. Focus on critical paths and complex logic,
not every possible edge case.

### 2. Write all failing tests (RED only)

Write all tests for the approved behaviors. Do not write any
implementation code.

Rules:

- Write tests against the planned public interface, even if the
  module doesn't exist yet
- Each test should fail for the right reason (missing module,
  missing export, or assertion failure — not a syntax error)
- Run the full test suite after writing all tests and confirm
  every new test is RED
- Do not write any implementation to make tests pass

### 3. Confirm and hand off

After all tests are written and confirmed failing:

- Report which test file(s) were created
- Show the failure output from the run
- Confirm each test fails for the right reason
- Tell the user to run `/build` to implement

## Checklist

```
[ ] Test describes behavior, not implementation
[ ] Test uses public interface only
[ ] Test would survive internal refactor
[ ] No implementation code written
[ ] Every new test is confirmed RED before stopping
```
