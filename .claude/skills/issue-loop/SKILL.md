---
name: issue-loop
description: Drive an initiative's buildable slices through tdd → RED commit → build → GREEN commit → close, one issue at a time, unattended.
disable-model-invocation: true
---

# Issue Loop

The loop after `prd-to-issues`. For each buildable slice a fresh subagent runs
`tdd` and commits RED, a second runs `build` and commits GREEN, and the
driver — this skill, in your session — grabs the next. Nobody is watching: the
issue stands in for every approval the two skills ask for, the commit is the
checkpoint, and a step that cannot reach its commit stops the loop.

## The initiative

`$ARGUMENTS` is the initiative for the commit bracket (`[delete-movie]`).
Given nothing, take the bracket from the latest commit naming the parent PRD:
`git log -1 --grep='issue #<prd>' --format=%s`.

## Per issue

### 1. Grab

The next slice is the lowest-numbered open issue with a `## Parent PRD`
section whose every `Blocked by` issue is closed (`gh issue list --state open`,
`gh issue view <n>` for the body, `gh issue view <m> --json state` per
blocker).

Stop, before dispatching anything, when the next slice

- is marked **HITL** in its body,
- binds nothing under `src/` or `server/` (a prototype amendment, the
  docs-and-refactor-filing slice), or
- does not exist — no open slice, or every open slice waits on an open blocker.

Those are the human's turns; report which and why, and the loop resumes when
typed again.

The tree must be clean: `git status --porcelain` empty. A dirty tree is a step
a previous run left half-done — report it and stop.

### 2. RED

Dispatch a fresh `general-purpose` subagent with the RED prompt below and wait
for it. Its completion criterion, which you verify rather than take from its
report: `git log -1 --format=%s` reads
`test: [<initiative>] issue #<n> <description>, RED` and the tree is clean.
Anything else — the subagent stopped short, the gate refused, the tree is
dirty — stops the loop with the subagent's report.

### 3. GREEN

Dispatch a second fresh subagent with the GREEN prompt and verify the same way:
`git log -1` reads `feat: [<initiative>] issue #<n> <description>`, the tree is
clean, and `gh issue view <n> --json state` says `CLOSED`.

### 4. Next

Back to 1.

## Reporting

When the loop stops — out of slices, or a failed step — report one line per
issue taken and the reason it stopped:

```
#116  RED a1b2c3 (84k)  GREEN d4e5f6 (61k)
```

The bracketed figure is the subagent's token count from its completion notice
— the budget is 100k a step, and a step over it says the slice was too thick
for `prd-to-issues`, so keep the number. A failed step's report goes in
verbatim. What a subagent left in the tree is what the
human diagnoses: leave it as it is.

## The prompts

Both carry the two overrides that let the skills run without a person: the
issue is the approval, and the commit closes the step. Fill `<n>` and
`<initiative>`.

### RED

> Run the `tdd` skill for issue #<n> in this repository and follow it to its
> end.
>
> Nobody is present. Where the skill asks the user to confirm the interface or
> the behaviour list: the issue's **What to build** and the parent PRD's
> **Implementation Decisions** section are the interface, and the issue's
> **Acceptance criteria** are the behaviour list — every one of them gets a
> test. Decide from those and ask nothing.
>
> Your context is the budget. Read the PRD's Implementation Decisions section,
> not the file; grep `docs/ubiquitous-language.md` for the terms the issue
> bolds rather than reading it; open only the units the tests touch.
>
> When every new test is confirmed RED for the right reason, commit: `git add`
> only the files you wrote, then
> `git commit -m "test: [<initiative>] issue #<n> <description>, RED"` with a
> description under 50 characters. The commit gate typechecks a `test:`
> commit's shipping code only, so a test against a module that does not exist
> yet passes it. Never `--no-verify`. If the gate refuses, stop and report what
> it said.
>
> Report: the test files, the count of RED tests, the commit hash — or the
> reason you stopped short.

### GREEN

> Run the `build` skill for issue #<n> in this repository and follow it to its
> end.
>
> Nobody is present. The skill's definition of done is the review: when every
> box holds, commit without waiting —
> `git commit -m "feat: [<initiative>] issue #<n> <description>"`, description
> under 50 characters — then close the issue as the skill says. Never
> `--no-verify`. If the suite, the typecheck or the commit gate will not go
> green, stop and report what is red and why, leaving the tree as it is.
>
> Your context is the budget: the failing tests and the units they import are
> the spec; open the PRD's Implementation Decisions section only when a test
> leaves a shape undecided.
>
> Report: the commit hash, the issue closed — or the reason you stopped short.
