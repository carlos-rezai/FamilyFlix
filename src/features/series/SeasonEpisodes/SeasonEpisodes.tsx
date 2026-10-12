import { useNavigate, useParams } from 'react-router-dom';

import { BackButton, EpisodeRow, PageHeader } from '@/components';
import { Button } from '@/primitives';
import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { episodePlayPath, range, seasonPath, seriesPath } from '@/utils';
import { useSeasonEpisodes } from '../useSeasonEpisodes/useSeasonEpisodes';
import {
  Column,
  CountRow,
  CountText,
  Spacer,
  ToggleAllButton,
  EpisodeList,
  OtherSeasons,
  OtherSeasonsHeading,
  Pills,
  SeasonPill,
  SkeletonRow,
  Message,
} from './SeasonEpisodes.styles';

/** Back's name here: it goes to the series, the page's **Landing**. */
const BACK_LABEL = 'Back to series';

/** Placeholder rows held while the series loads. */
const SKELETON_ROWS = 4;

/**
 * The season page's organism — `page.SeasonPage` over the series read:
 * _Back to series_, the show's title over _Season N_, the _Resume E04_ /
 * _Play E01_ button, the count line with _Mark season watched_, one **Episode
 * row** per episode, and the _Other seasons_ pills. Everything it draws was
 * decided by `seasonView`.
 *
 * The box and the season button flip at once and flip back on refusal. The
 * pills are a **Sideways move** — a `replace` — so Back is one step to the
 * series page, which is also the page's **Landing**. The play button and a
 * row open the player on their episode, as a push.
 */
export function SeasonEpisodes() {
  const { id = '' } = useParams<{ id: string }>();
  const goBack = useGoBack(seriesPath(id));

  // Back is drawn once, above whichever state the season is in, so the button
  // a parent reaches for is the same element while it loads and after.
  return (
    <>
      <BackButton onClick={goBack} label={BACK_LABEL} />
      <SeasonBody />
    </>
  );
}

/** The season in whichever state its read is in: loading, missing, or there. */
function SeasonBody() {
  const navigate = useNavigate();
  const { id = '', n = '' } = useParams<{ id: string; n: string }>();
  const number = Number(n);
  const view = useSeasonEpisodes(id, number);

  if (view.status === 'loading') {
    return (
      <Column role="status" aria-label="Loading season">
        {range(SKELETON_ROWS).map((row) => (
          <SkeletonRow key={row} />
        ))}
      </Column>
    );
  }
  if (view.status === 'not-found') {
    return view.seriesFound ? (
      <Message
        title="That season isn’t here"
        body="This series has no season by that number."
        action={
          <Button
            label="Back to series"
            to={seriesPath(id)}
            variant="secondary"
          />
        }
      />
    ) : (
      <Message
        title="That series isn’t here"
        body="It may have been removed from your library."
        action={<Button label="Back to library" to="/" variant="secondary" />}
      />
    );
  }
  if (view.status === 'error') {
    return (
      <Message
        title="Couldn’t load this season"
        body="Something went wrong reading it."
        action={
          <Button label="Retry" variant="secondary" onClick={view.retry} />
        }
      />
    );
  }

  const { season } = view;
  const playId = season.playEpisodeId;

  return (
    <Column>
      <PageHeader
        eyebrow={season.seriesTitle}
        heading={season.seasonLabel}
        end={
          <Button
            label={season.playLabel}
            variant="primary"
            size="md"
            icon="play"
            onClick={
              playId === null
                ? undefined
                : () => navigate(episodePlayPath(playId))
            }
          />
        }
      />

      <CountRow>
        <CountText>{season.countLabel}</CountText>
        <CountText aria-hidden="true">·</CountText>
        <CountText>{season.watchedLabel}</CountText>
        <Spacer />
        <ToggleAllButton type="button" onClick={view.toggleSeason}>
          {season.toggleAllLabel}
        </ToggleAllButton>
      </CountRow>

      <EpisodeList>
        {season.episodes.map((episode) => (
          <EpisodeRow
            key={episode.id}
            episode={episode}
            onOpen={() => navigate(episodePlayPath(episode.id))}
            onToggleWatched={() => view.toggleEpisode(episode.id)}
          />
        ))}
      </EpisodeList>

      {season.otherSeasons.length === 0 ? null : (
        <OtherSeasons>
          <OtherSeasonsHeading>Other seasons</OtherSeasonsHeading>
          <Pills>
            {season.otherSeasons.map((other) => (
              <SeasonPill
                key={other.number}
                type="button"
                onClick={() =>
                  navigate(seasonPath(season.seriesId, other.number), {
                    replace: true,
                  })
                }
              >
                {other.label}
              </SeasonPill>
            ))}
          </Pills>
        </OtherSeasons>
      )}
    </Column>
  );
}
