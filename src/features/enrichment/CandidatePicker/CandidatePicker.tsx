import { SearchIcon } from '@/primitives';
import type { Candidate } from '@/types';
import { gradientFromId } from '@/utils';
import {
  CandidateCard,
  CandidateMeta,
  CandidateTitle,
  Picker,
  Poster,
  PosterImage,
  Score,
  SearchCard,
} from './CandidatePicker.styles';

export interface CandidatePickerProps {
  candidates: readonly Candidate[];
  /** A card pressed, by its TMDB id. */
  onPick: (tmdbId: number) => void;
  /** The dashed _Search by title_ card pressed. */
  onSearchByTitle: () => void;
}

/** Above this, a candidate's _% match_ wears the watched green. */
const STRONG_SCORE = 70;

/** Year · genre · language, whichever TMDB knows. */
function metaOf(candidate: Candidate): string {
  return [candidate.year, candidate.genre, candidate.language]
    .filter((part) => part !== null && part !== '')
    .join(' · ');
}

/**
 * An `ambiguous` **Decision**'s face, from `feat.EnrichmentFlow.dc.html`: one
 * horizontal row of **Candidate** cards — the poster over its Gradient
 * fallback, the title, year · genre · language and _% match_ — closed by the
 * dashed _Search by title_ card. It reports presses and holds no state.
 */
export function CandidatePicker({
  candidates,
  onPick,
  onSearchByTitle,
}: CandidatePickerProps) {
  return (
    <Picker>
      {candidates.map((candidate) => {
        const { g1, g2 } = gradientFromId(String(candidate.tmdbId));
        return (
          <CandidateCard
            key={candidate.tmdbId}
            type="button"
            onClick={() => onPick(candidate.tmdbId)}
          >
            <Poster $g1={g1} $g2={g2}>
              {candidate.posterUrl === null ? null : (
                <PosterImage src={candidate.posterUrl} alt="" />
              )}
            </Poster>
            <CandidateTitle>{candidate.title}</CandidateTitle>
            <CandidateMeta>{metaOf(candidate)}</CandidateMeta>{' '}
            <Score $strong={candidate.score > STRONG_SCORE}>
              {candidate.score}% match
            </Score>
          </CandidateCard>
        );
      })}
      <SearchCard type="button" onClick={onSearchByTitle}>
        <SearchIcon size={20} />
        Search by title
      </SearchCard>
    </Picker>
  );
}
