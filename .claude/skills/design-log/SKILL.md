---
name: design-log
description: Create or update a design log file for a feature.
Use before making changes (check existing logs), when wrapping up a
grill-me session, after write-a-prd, after build, or after refactor.
Use when user says "update the design log", "log this decision", or
"check the design log".
---

# Design Log

## Before making any changes

1. Check `docs/design-logs/` for existing logs related to the feature
2. If a log exists, read it fully before proceeding — it contains
   decisions already made that must not be contradicted silently
3. Reference existing logs by filename when relevant

## When creating a new design log entry

Structure every entry as:

### Background

What context is needed to understand this decision?

### Problem

What specific problem or question is being resolved?

### Questions and Answers

List each question raised during grill-me with its answer.
Keep questions in the file even after they are answered.

### Design

The agreed solution. Include:

- Data structures or type signatures where relevant
- File paths for where things will live
- Use ✅ for chosen approach, ❌ for rejected alternatives with reason

### Implementation Plan

Numbered phases. Each phase is a thin working vertical slice.
Phase 1 should be the thinnest possible end-to-end path.

### Trade-offs

What does this design make easier? What does it make harder?
What was explicitly ruled out of scope and why?

## File naming

Each feature has its own numbered file in `docs/design-logs/`:

- `01-[feature-name].md`
- `02-[feature-name].md`
- `03-[feature-name].md`

Create the file if it does not exist.
Append to it if it does — never overwrite existing entries.

## When implementing

1. Append an "Implementation Results" section as you go
2. Document any deviation from the design and explain why
3. Include test results (X/Y passing) when relevant
4. Do not edit the original design sections once implementation starts

## Rules

- Design logs are immutable snapshots — once written, the original
  sections are never edited
- Discoveries during build or refactor go in the dev-journal,
  not the design log
- Be specific: include file paths and type signatures
- Be brief: short explanations, only what is most relevant
- Draw diagrams: use Mermaid inline diagrams when structure is complex
- Never delete existing entries
- After writing, confirm to the user which file was written or updated

## After writing

After confirming the file was written, run the ubiquitous-language
skill to extract and add any new terms introduced in this session.
