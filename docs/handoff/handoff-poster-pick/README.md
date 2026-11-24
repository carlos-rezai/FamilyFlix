# Poster pick: handoff

Step 57, design log `docs/design-logs/75-poster-pick.md`. This README is the
spec for the **Poster pick** until phase 3 amends `feat.EnrichmentFlow.dc.html`
and `COMPONENT-SPEC.md` to it; after that the prototype rules, as everywhere.
Nothing here is newly drawn but one line on one card: the rest of the step is
the server's.

## Sync with TMDB → review → Seasons

A **Season choice**'s card, after a press TMDB or the disk refused, once the
season's Busy phase is back to `idle`:

| Part           | Value                                                                   |
| -------------- | ----------------------------------------------------------------------- |
| Poster refusal | `That poster wasn’t saved. Try again.`                                  |
| Place          | inside the card, under the picker, 10px above                           |
| Face           | 13px sans, `--color-danger`, line-height 1.5, `role="status"`           |
| Pressed mark   | none on that season's choices while the line is drawn                   |
| Held caption   | unchanged: _No poster yet_ or _Current poster_, whatever the tile holds |
| Gone           | at that season's next press; another season's card is untouched         |

Every other part of the section is unchanged: the heading, the held tile, the
rule, the choices, the _Series poster_ pill, the Busy overlay's _Saving
poster…_, and still no snackbar and no confirm.
