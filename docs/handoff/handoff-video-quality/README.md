# Video quality: handoff

Step 52, design log `docs/design-logs/70-video-quality.md`. This README is the
spec for **Video quality** until phase 1 amends `mol.PosterCard.dc.html`,
`page.LibraryPage.dc.html`, `page.SettingsPage.dc.html`, the model in
`FamilyFlix.dc.html` and `COMPONENT-SPEC.md` to it; after that the prototype
rules, as everywhere. One atom is new, `prim.MetaTag`; everything else is a
piece the prototype already draws.

## `prim.MetaTag`

A word in a hairline box. Never a control, never focusable.

| Part        | Value                                   |
| ----------- | --------------------------------------- |
| Prop        | `label: string`                         |
| Font        | sans, 11px, weight 600, `.04em` spacing |
| Line height | 1                                       |
| Padding     | `2px 6px`                               |
| Border      | `1px solid var(--color-border)`         |
| Radius      | `4px`                                   |
| Text        | `var(--color-text-dim)`                 |
| Fill        | none                                    |

## The Poster card

The **Star row** (`starRow`, `marginTop: 5px`) becomes a flex row,
`justify-content: space-between`, `align-items: center`: the stars on the
left as today, a `prim.MetaTag` reading the title's **Video quality** on the
right. No tag when the title has none or _Show video quality_ is off; the row
then looks as it does today. The art, its corners and its bottom edge are
unchanged. The card's accessible name stays its title.

| Title                              | Tag     |
| ---------------------------------- | ------- |
| a `3840x1600` film                 | `4K`    |
| a `1920x800` film                  | `1080p` |
| a DVD rip, `720x576`               | `480p`  |
| a series, 6 episodes 1080p, 4 720p | `1080p` |
| a series, 2 episodes 1080p, 2 720p | `1080p` |
| a file nothing could probe         | none    |

The model gives Die Hard `1080p`, Amelie `720p`, Tidewater `4K`, and one
title none.

## The Quality pill

A `mol.FilterDropdown` in the browse header, between _Rating_ and _Sort_:

| Part        | Value                                                       |
| ----------- | ----------------------------------------------------------- |
| Label       | `Quality`                                                   |
| Value shown | `All qualities`, or the chosen row                          |
| Options     | `All qualities`, `4K`, `1080p+`, `720p+`, `480p+`, in order |
| Counts      | none                                                        |
| Not drawn   | while _Show video quality_ is off, or before settings land  |

A row keeps titles at or above it; a title with no quality is kept only by
_All qualities_. It writes `?quality=` (`4k`, `1080p`, `720p`, `480p`); _All
qualities_ takes it off. No snackbar.

## Settings → Display

A row after _Fill in ratings from TMDB_, before _Start on_:

| Part        | Value                                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| Title       | `Show video quality`                                                                                                        |
| Description | `Tag each poster with how sharp its video is: 4K, 1080p, 720p, 480p or SD. Turning this off also hides the quality filter.` |
| Control     | `prim.Toggle`, on by default, labelled `Show video quality`                                                                 |
| Not drawn   | until the settings read lands                                                                                               |

No snackbar.
