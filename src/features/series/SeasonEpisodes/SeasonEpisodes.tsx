import { useNavigate, useParams } from 'react-router-dom';

import { EpisodeRow } from '@/components';
import { Button, ChevronLeftIcon, IconButton } from '@/primitives';
import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { range, seasonPath, seriesPath } from '@/utils';
import { useSeasonEpisodes } from '../useSeasonEpisodes/useSeasonEpisodes';
import {
  Column,
  HeaderRow,
  HeaderText,
  Eyebrow,
  Heading,
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
 * series page, which is also the page's **Landing**. The play button and the
 * rows are inert until episode playback exists.
 */
export function SeasonEpisodes() {
  const navigate = useNavigate();
  const { id = '', n = '' } = useParams<{ id: string; n: string }>();
  const number = Number(n);
  const goBack = useGoBack(seriesPath(id));
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

  return (
    <Column>
      <HeaderRow>
        <IconButton
          label="Back to series"
          title="Back to series"
          size={42}
          variant="outline"
          onClick={goBack}
        >
          <ChevronLeftIcon size={18} />
        </IconButton>
        <HeaderText>
          <Eyebrow>{season.seriesTitle}</Eyebrow>
          <Heading>{season.seasonLabel}</Heading>
        </HeaderText>
        <Button
          label={season.playLabel}
          variant="primary"
          size="md"
          icon="play"
        />
      </HeaderRow>

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
            onOpen={() => undefined}
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
