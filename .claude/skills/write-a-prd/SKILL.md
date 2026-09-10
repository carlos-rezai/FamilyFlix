---
name: write-a-prd
description: Create a PRD through user interview, codebase exploration,
and module design, then submit as a GitHub issue. Use when user wants
to write a PRD, create a product requirements document, or plan a new
feature.
---

# Write a PRD

## Before starting

1. Read `docs/design-logs/` and find the most recent file
2. Read `docs/ubiquitous-language.md`
3. Use these as the source of truth — skip any interview questions
   already answered in the design log
4. Only ask questions about gaps not covered in the design log

## Steps

You may skip steps if you don't consider them necessary.

1. Ask the user for any additional context not already covered in
   the design log. If the design log is complete, skip this step.

2. Explore the repo to verify assertions and understand the current
   state of the codebase.

3. Interview the user about any unresolved branches only — do not
   re-ask questions already answered in the design log.

4. Sketch out the major modules you will need to build or modify.
   Actively look for opportunities to extract deep modules that can
   be tested in isolation.

   A deep module encapsulates a lot of functionality behind a simple,
   testable interface that rarely changes. Prefer deep modules over
   shallow ones.

   Check with the user that these modules match their expectations
   and which modules they want tests written for.

5. Write the PRD using the template below and file it as a GitHub
   issue. Always use `--body-file` with a temp file:
   `gh issue create --title "..." --body-file /tmp/prd.md`

   Issue title format: `[Feature Name]: [short description]`
   Do NOT use conventional commit prefixes in issue titles.

## PRD Template

---

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A LONG, numbered list of user stories in the format:

1. As a [actor], I want [feature], so that [benefit]

This list should be extensive and cover all aspects of the feature,
including edge cases, error states, and empty states.

## Implementation Decisions

A list of implementation decisions that were made. This can include:

- The modules that will be built/modified
- The interfaces of those modules
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets — they may end
up being outdated very quickly.

## Testing Decisions

A list of testing decisions that were made. Include:

- A description of what makes a good test (only test external
  behaviour, not implementation details)
- Which modules will be tested
- Prior art for the tests (similar types of tests in the codebase)

## Out of Scope

A description of the things that are out of scope for this PRD.

## Further Notes

Any further notes about the feature.

---

## After filing the GitHub issue

Save a local copy of the PRD to `docs/PRDs/` using the same
numbering as the design log — e.g. `01-[feature-name].md`.
Confirm to the user which GitHub issue was created and which
local file was saved.
