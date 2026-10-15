import { Toggle } from '@/primitives';
import { useDisplayPreference } from '@/App/useDisplayPreference/useDisplayPreference';

import { Card, GroupHeading, Row, RowDesc, RowTitle } from '../section.styles';

/**
 * The Settings hub's Display **Settings group**: the `Display` **Group
 * heading** over one **Section card** holding two rows — _Ultrawide
 * margins_ and, under it, _Fill in ratings from TMDB_ — each a title, its line
 * and the `Toggle` on the right, reading and writing through
 * `useDisplayPreference`, so the **Content frame** follows a press at once.
 * Each Toggle is not drawn while its value is `null` — **Blank until it
 * lands**.
 */
export function DisplaySection() {
  const { ultrawideMargins, setUltrawideMargins, tmdbRatings, setTmdbRatings } =
    useDisplayPreference();

  return (
    <>
      <GroupHeading>Display</GroupHeading>
      <Card>
        <Row>
          <div>
            <RowTitle>Ultrawide margins</RowTitle>
            <RowDesc>
              Keep everything in the middle of a very wide screen, so the rows
              fit without turning your head. Smaller screens look the same
              either way.
            </RowDesc>
          </div>
          {ultrawideMargins === null ? null : (
            <Toggle
              checked={ultrawideMargins}
              label="Ultrawide margins"
              onToggle={() => {
                void setUltrawideMargins(!ultrawideMargins);
              }}
            />
          )}
        </Row>
        <Row $last>
          <div>
            <RowTitle>Fill in ratings from TMDB</RowTitle>
            <RowDesc>
              When the family hasn&apos;t rated a title, show TMDB&apos;s score
              as its stars, marked TMDB. Your own ratings always come first.
            </RowDesc>
          </div>
          {tmdbRatings === null ? null : (
            <Toggle
              checked={tmdbRatings}
              label="Fill in ratings from TMDB"
              onToggle={() => {
                void setTmdbRatings(!tmdbRatings);
              }}
            />
          )}
        </Row>
      </Card>
    </>
  );
}
