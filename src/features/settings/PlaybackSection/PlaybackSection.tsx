import { FilterDropdown } from '@/components';
import { Toggle } from '@/primitives';
import { SUBTITLE_LANGUAGES, type FilterOption } from '@/types';

import { CodecManager } from '../CodecManager/CodecManager';
import { useSettings } from '../useSettings/useSettings';
import {
  Card,
  Divider,
  GroupHeading,
  ItemDesc,
  ItemTitle,
} from '../section.styles';
import {
  ComingSoon,
  Header,
  Row,
  RowDesc,
  RowRule,
  RowTitle,
  RowTitleLine,
  SubtitlesHeader,
} from './PlaybackSection.styles';

/**
 * The Settings hub's Playback **Settings group**, from
 * `page.SettingsPage.dc.html`: the `Playback` **Group heading** over a
 * **Section card** that opens with _Codecs_ and its lede, over the **Codec
 * report**.
 *
 * The lede keeps both of the prototype's sentences though the _Add a codec
 * pack_ zone the second one points at is not drawn — so the copy does not
 * move when the **Playback component upload** lands.
 *
 * Under the report, the second half of the card: the divider; _Subtitles_ with
 * its lede; _Turn on automatically_ beside a **Coming soon** pill over a
 * `Toggle` drawn off and disabled — it stores nothing and presses to nothing,
 * auto-on staying on the roadmap exactly as log 10 decided; a rule; and
 * _Preferred language_ with `FilterDropdown` on the right, the seven names of
 * the **Language pool** as its options and the fetched value as its value.
 *
 * The section owns `useSettings`. The pill is not drawn while the settings
 * are `null` — a refused read shows no default the server never confirmed.
 */
export function PlaybackSection() {
  const { settings, chooseSubtitleLanguage } = useSettings();

  const languageOptions: FilterOption[] = SUBTITLE_LANGUAGES.map((name) => ({
    label: name,
    selected: name === settings?.subtitleLanguage,
    onSelect: () => {
      void chooseSubtitleLanguage(name);
    },
  }));

  return (
    <>
      <GroupHeading>Playback</GroupHeading>
      <Card>
        <Header>
          <div>
            <ItemTitle>Codecs</ItemTitle>
            <ItemDesc>
              These decide which video files FamilyFlix can play. Common formats
              work out of the box — add a pack only if a movie won’t play.
            </ItemDesc>
          </div>
        </Header>
        <CodecManager />

        <Divider />

        <SubtitlesHeader>
          <ItemTitle>Subtitles</ItemTitle>
          <ItemDesc>How subtitles behave when a movie has them.</ItemDesc>
        </SubtitlesHeader>

        <Row>
          <div>
            <RowTitleLine>
              <RowTitle>Turn on automatically</RowTitle>
              <ComingSoon>Coming soon</ComingSoon>
            </RowTitleLine>
            <RowDesc>Show subtitles by default when a movie has them.</RowDesc>
          </div>
          <Toggle
            checked={false}
            disabled
            label="Turn on automatically"
            onToggle={() => undefined}
          />
        </Row>

        <RowRule />

        <Row $last>
          <div>
            <RowTitle>Preferred language</RowTitle>
            <RowDesc>Which track to use whenever subtitles are shown.</RowDesc>
          </div>
          {settings ? (
            <FilterDropdown
              label="Preferred language"
              showLabel={false}
              value={settings.subtitleLanguage}
              options={languageOptions}
              menuWidth={200}
            />
          ) : null}
        </Row>
      </Card>
    </>
  );
}
