---
name: prd-to-plan
description: Turn a PRD into a multi-phase implementation plan using
tracer-bullet vertical slices. Use when user wants to break down a PRD,
create an implementation plan, plan phases from a PRD, or mentions
"tracer bullets".
---

# PRD to Plan

Break a PRD into a phased implementation plan using vertical slices
(tracer bullets). Output is saved to `docs/PRDs/`.

## Before starting

1. Read `docs/PRDs/` and find the most recent PRD file
2. Read the corresponding GitHub issue for full context
3. Use these as the source of truth — do not ask the user to
   paste the PRD if it can be found in the above locations

## Process

### 1. Confirm the PRD is in context

The PRD should be found in `docs/PRDs/`. If it cannot be located,
ask the user to point you to the file or GitHub issue.

### 2. Explore the codebase

If you have not already explored the codebase, do so to understand
the current architecture, existing patterns, and integration layers.

### 3. Identify durable architectural decisions

Before slicing, identify high-level decisions unlikely to change
throughout implementation:

- Route structures / URL patterns
- Database schema shape
- Key data models
- Third-party service boundaries

These go in the plan header so every phase can reference them.

### 4. Draft vertical slices

Break the PRD into tracer bullet phases. Each phase is a thin
vertical slice that cuts through ALL integration layers end-to-end,
NOT a horizontal slice of one layer.

Each phase must:

- Deliver a narrow but complete path through every layer
  (schema, API, UI, tests)
- Be demoable or verifiable on its own when complete
- Prefer many thin slices over few thick ones
- Not include specific file names or function names that are
  likely to change as later phases are built
- Include durable decisions: route paths, schema shapes,
  data model names

### 5. Quiz the user

Present the proposed breakdown as a numbered list. For each phase:

- **Title**: short descriptive name
- **User stories covered**: which stories from the PRD this addresses

Ask the user:

- Does the granularity feel right?
- Should any phases be merged or split further?

Iterate until the user approves the breakdown.

### 6. Write the plan file

Use this template:

---

# Plan: [Feature Name]

> Source PRD: [GitHub issue link]

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: ...
- **Schema**: ...
- **Key models**: ...

---

## Phase 1: [Title]

**User stories**: [list from PRD]

### What to build

A concise description of this vertical slice. Describe the
end-to-end behaviour, not layer-by-layer implementation.

### Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

---

## Phase 2: [Title]

**User stories**: [list from PRD]

### What to build

...

### Acceptance criteria

- [ ] ...

---

## After writing the plan file

1. Save to `docs/PRDs/` as `[nn]-[feature-name]-plan.md`
2. Add the plan as a comment on the existing GitHub PRD issue:
   `gh issue comment <number> --body-file <plan-file>`
3. Confirm to the user which file was saved and which issue
   was updated
