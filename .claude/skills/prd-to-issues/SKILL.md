---
name: prd-to-issues
description: Break a PRD into independently-grabbable GitHub issues
using tracer-bullet vertical slices. Use when user wants to convert
a PRD to issues, create implementation tickets, or break down a PRD
into work items.
---

# PRD to Issues

Break a PRD into independently-grabbable GitHub issues using vertical
slices (tracer bullets).

## Process

### 1. Locate the PRD and plan

1. Read `docs/PRDs/` and find the most recent plan file
2. If the PRD GitHub issue is not already in context, fetch it
   with `gh issue view <number> --comments`
3. Use the plan phases as the basis for the issue breakdown —
   do not re-derive phases from the PRD

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand
the current state of the code.

### 3. Draft vertical slices

Break the plan phases into tracer bullet issues. Each issue is a
thin vertical slice that cuts through ALL integration layers
end-to-end, NOT a horizontal slice of one layer.

Slices may be HITL or AFK:

- **HITL** — requires human interaction (architectural decision,
  design review, approval)
- **AFK** — can be implemented and merged without human interaction

Prefer AFK over HITL where possible.

Each slice must:

- Deliver a narrow but complete path through every layer
  (schema, API, UI, tests)
- Be demoable or verifiable on its own when complete
- Prefer many thin slices over few thick ones

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each slice:

- **Title**: short descriptive name
- **Type**: HITL / AFK
- **Blocked by**: which other slices must complete first
- **User stories covered**: which stories from the PRD this addresses

Ask the user:

- Does the granularity feel right?
- Are the dependency relationships correct?
- Should any slices be merged or split further?
- Are the correct slices marked as HITL and AFK?

Iterate until the user approves the breakdown.

### 5. Create the GitHub issues

For each approved slice, create a GitHub issue using `gh issue create`.
Always use `--body-file` with a temp file — never pass the body inline.
This avoids shell quoting issues with markdown bodies containing `#`.

Create issues in dependency order (blockers first) so you can reference
real issue numbers in the "Blocked by" field.

Issue title format: `[Feature Name]: [short description]`
Do NOT use conventional commit prefixes in issue titles.

Use this template for the issue body:

---

## Parent PRD

#[prd-issue-number]

## What to build

A concise description of this vertical slice. Describe the
end-to-end behaviour, not layer-by-layer implementation. Reference
specific sections of the parent PRD rather than duplicating content.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- Blocked by #[issue-number] (if any)

Or "None — can start immediately" if no blockers.

## User stories addressed

Reference by number from the parent PRD:

- User story 3
- User story 7

---

Do NOT close or modify the parent PRD issue.

### 6. After creating all issues

Report to the user:

- How many issues were created
- Their GitHub issue numbers and titles in dependency order
- Confirm the parent PRD issue was not modified
