import { PillTabs } from '@/components';
import { Toggle } from '@/primitives';
import { useDisplayPreference } from '@/App/useDisplayPreference/useDisplayPreference';
import { libraryTabOptions } from '@/utils';

import { Card, GroupHeading, Row, RowDesc, RowTitle } from '../section.styles';

/**
 * The Settings hub's Display **Settings group**: the `Display` **Group
 * heading** over one **Section card** holding four rows: _Ultrawide margins_,
 * _Fill in ratings from TMDB_, _Show video quality_ (each a title, its line
 * and the `Toggle` on the right) and _Start on_, whose **Pill tabs** choose
 * the **Start tab** with no snackbar. _Show video quality_ turns the
 * **Quality tag** on the posters on or off, nothing else (log 73), and its
 * line says so in one sentence. All read and write through
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
    qualityTags,
    setQualityTags,
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
        <Row>
          <div>
            <RowTitle>Show video quality</RowTitle>
            <RowDesc>
              Tag each poster with how sharp its video is: 4K, 1080p, 720p, 480p
              or SD.
            </RowDesc>
          </div>
          {qualityTags === null ? null : (
            <Toggle
              checked={qualityTags}
              label="Show video quality"
              onToggle={() => {
                void setQualityTags(!qualityTags);
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
