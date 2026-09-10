---
name: grill-me
description: Interview the user relentlessly about a plan or design
until reaching shared understanding, resolving each branch of the
decision tree. Use when user wants to stress-test a plan, get grilled
on their design, or mentions "grill me".
---

# Grill Me

Interview the user relentlessly about every aspect of this plan until
reaching a shared understanding. Walk down each branch of the design
tree, resolving dependencies between decisions one by one. For each
question, provide your recommended answer.

If a question can be answered by exploring the codebase, explore the
codebase instead of asking the user.

## Rules

- One question at a time — never ask multiple questions at once
- Always provide your recommended answer alongside the question
- Resolve dependencies before moving to the next branch
- Do not move on until the current question is answered

## On wrap-up

When the user confirms shared understanding:

1. Produce a full summary of all decisions made
2. Run the design-log skill to write the entry
3. Wait for the full design-log → ubiquitous-language chain
   to complete before confirming done
4. Confirm which files were written
