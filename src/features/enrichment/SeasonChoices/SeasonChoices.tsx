import { useState } from 'react';

import type { SeasonChoice } from '@/types';
import { formatEpisodeTag, gradientFromId } from '@/utils';
import {
  Cards,
  ChoiceCard,
  GroupHeading,
  Held,
  HeldArt,
  HeldCaption,
  HeldTile,
  Numeral,
  Picker,
  Poster,
  PosterImage,
  Rule,
  SeasonCard,
  SeriesPill,
} from './SeasonChoices.styles';

export interface SeasonChoicesProps {
  seasons: readonly SeasonChoice[];
  /** A choice pressed: its season, and the TMDB path it names. */
  onChoose: (season: number, path: string) => void;
}

const HEADING_ID = 'enrichment-seasons-heading';

/**
 * The **Seasons** section of a single-series review, from
 * `feat.EnrichmentFlow.dc.html`: the Group heading _Seasons_, then one card
 * per **Season choice** — the held tile, `S02` over its Season poster or the
 * gradient, then one `CandidatePicker`-style card per choice it is handed —
 * the server caps them at `SEASON_CHOICE_CAP` — with no title, meta or score,
 * the series' marked _Series poster_. A press reports
 * `onChoose(season, path)`; which choice was pressed is the section's own.
 */
export function SeasonChoices({ seasons, onChoose }: SeasonChoicesProps) {
  const [picked, setPicked] = useState<Record<number, string>>({});
  if (seasons.length === 0) return null;

  return (
    <div role="group" aria-labelledby={HEADING_ID}>
      <GroupHeading id={HEADING_ID}>Seasons</GroupHeading>
      <Cards>
        {seasons.map(({ season, posterUrl, choices }) => {
          const label = formatEpisodeTag({ season });
          const { g1, g2 } = gradientFromId(label);
          return (
            <SeasonCard key={season}>
              <Picker role="group" aria-label={`Posters for ${label}`}>
                <Held>
                  <HeldTile>
                    <HeldArt url={posterUrl} g1={g1} g2={g2} />
                    <Numeral>{label}</Numeral>
                  </HeldTile>
                  <HeldCaption>
                    {posterUrl === null ? 'No poster yet' : 'Current poster'}
                  </HeldCaption>
                </Held>
                <Rule aria-hidden="true" />
                {choices.map((choice, i) => {
                  const series = choice.source === 'series';
                  const chosen = picked[season] === choice.path;
                  const art = gradientFromId(choice.path);
                  return (
                    <ChoiceCard
                      key={choice.path}
                      type="button"
                      aria-label={`${series ? 'Series poster' : 'Poster'} ${
                        i + 1
                      } for ${label}`}
                      aria-pressed={chosen}
                      $picked={chosen}
                      onClick={() => {
                        setPicked((held) => ({
                          ...held,
                          [season]: choice.path,
                        }));
                        onChoose(season, choice.path);
                      }}
                    >
                      <Poster $g1={art.g1} $g2={art.g2}>
                        <PosterImage src={choice.url} alt="" />
                      </Poster>
                      {series ? <SeriesPill>Series poster</SeriesPill> : null}
                    </ChoiceCard>
                  );
                })}
              </Picker>
            </SeasonCard>
          );
        })}
      </Cards>
    </div>
  );
}
