import { PillTabs } from '@/components';
import { Toggle } from '@/primitives';
import { useDisplayPreference } from '@/App/useDisplayPreference/useDisplayPreference';
import { libraryTabOptions } from '@/utils';

import { Card, GroupHeading, Row, RowDesc, RowTitle } from '../section.styles';

/**
 * The Settings hub's Display **Settings group**: the `Display` **Group
 * heading** over one **Section card** holding three rows: _Ultrawide
 * margins_, _Fill in ratings from TMDB_ (each a title, its line and the
 * `Toggle` on the right) and _Start on_, whose **Pill tabs** choose the
 * **Start tab** with no snackbar; all reading and writing through
 * `useDisplayPreference`, so the **Content frame** follows a press at once.
 * Each control is not drawn while its value is `null`: **Blank until it
 * lands**.
 */
export function DisplaySection() {
  const {
    ultrawideMargins,
    setUltrawideMargins,
    tmdbRatings,
    setTmdbRatings,
    startTab,
    setStartTab,
  } = useDisplayPreference();

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
        <Row>
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
        <Row $last>
          <div>
            <RowTitle>Start on</RowTitle>
            <RowDesc>
              Which shelf FamilyFlix opens on. You can still switch between
              Movies and Series at the top of the library.
            </RowDesc>
          </div>
          {startTab === null ? null : (
            <PillTabs
              label="Start on"
              options={libraryTabOptions()}
              value={startTab}
              onChange={(tab) => {
                void setStartTab(tab);
              }}
            />
          )}
        </Row>
      </Card>
    </>
  );
}
