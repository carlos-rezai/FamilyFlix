---
name: ubiquitous-language
description: Extract a DDD-style ubiquitous language glossary from the
current conversation, flagging ambiguities and proposing canonical terms.
Saves to docs/ubiquitous-language.md. Use when user wants to define
domain terms, build a glossary, harden terminology, create a ubiquitous
language, or mentions "domain model" or "DDD".
---

# Ubiquitous Language

Extract and formalize domain terminology from the current conversation
into a consistent glossary, saved to `docs/ubiquitous-language.md`.

## Process

1. **Scan the conversation** for domain-relevant nouns, verbs, and concepts
2. **Identify problems**:
   - Same word used for different concepts (ambiguity)
   - Different words used for the same concept (synonyms)
   - Vague or overloaded terms
3. **Propose a canonical glossary** with opinionated term choices
4. **Write to `docs/ubiquitous-language.md`** in the project root
5. **Output a summary** inline in the conversation

## Output Format

Write `docs/ubiquitous-language.md` with this structure:

```md
# Ubiquitous Language

## Order lifecycle

| Term        | Definition                                              | Aliases to avoid      |
| ----------- | ------------------------------------------------------- | --------------------- |
| **Order**   | A customer's request to purchase one or more items      | Purchase, transaction |
| **Invoice** | A request for payment sent to a customer after delivery | Bill, payment request |

## People

| Term         | Definition                                  | Aliases to avoid       |
| ------------ | ------------------------------------------- | ---------------------- |
| **Customer** | A person or organization that places orders | Client, buyer, account |
| **User**     | An authentication identity in the system    | Login, account         |

## Relationships

- An **Invoice** belongs to exactly one **Customer**
- An **Order** produces one or more **Invoices**

## Example dialogue

> **Dev:** "When a **Customer** places an **Order**, do we create the
> **Invoice** immediately?"
> **Domain expert:** "No — an **Invoice** is only generated once a
> **Fulfillment** is confirmed. A single **Order** can produce multiple
> **Invoices** if items ship in separate **Shipments**."
> **Dev:** "So if a **Shipment** is cancelled before dispatch, no
> **Invoice** exists for it?"
> **Domain expert:** "Exactly. The **Invoice** lifecycle is tied to the
> **Fulfillment**, not the **Order**."

## Flagged ambiguities

- "account" was used to mean both **Customer** and **User** — these are
  distinct concepts: a **Customer** places orders, while a **User** is
  an authentication identity that may or may not represent a **Customer**.
```

## Rules

- **Be opinionated.** When multiple words exist for the same concept,
  pick the best one and list the others as aliases to avoid.
- **Flag conflicts explicitly.** If a term is used ambiguously, call it
  out in the "Flagged ambiguities" section with a clear recommendation.
- **Keep definitions tight.** One sentence max. Define what it IS,
  not what it does.
- **Show relationships.** Use bold term names and express cardinality
  where obvious.
- **Only include domain terms.** Skip generic programming concepts
  (array, function, endpoint) unless they have domain-specific meaning.
- **Group terms into multiple tables** when natural clusters emerge.
  Each group gets its own heading and table.
- **Write an example dialogue.** A short conversation (3-5 exchanges)
  that demonstrates how the terms interact naturally and clarifies
  boundaries between related concepts.

## Re-running

When invoked again in the same conversation:

1. Read the existing `docs/ubiquitous-language.md`
2. Incorporate any new terms from subsequent discussion
3. Update definitions if understanding has evolved
4. Mark changed entries with "(updated)" and new entries with "(new)"
5. Re-flag any new ambiguities
6. Rewrite the example dialogue to incorporate new terms

## After writing

After confirming new terms were added to `docs/ubiquitous-language.md`,
tell the user the grill-me → design-log → ubiquitous-language chain
is complete and they are ready to move to write-a-prd.
