import { FilterDropdown } from '@/components';
import { MicrochipIcon, Toggle } from '@/primitives';
import { SUBTITLE_LANGUAGES, type FilterOption } from '@/types';

import { codecSummary } from '../codecView/codecView';
import { useCapabilities } from '../useCapabilities/useCapabilities';
import { useSettings } from '../useSettings/useSettings';
import {
  Card,
  Divider,
  GroupHeading,
  ItemDesc,
  ItemTitle,
} from '../section.styles';
import {
  CodecsRow,
  ComingSoon,
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
 * **Section card** that opens with the **Codecs row**, a `NavigationRow` —
 * the microchip in its tile, _Codecs_, the **Codec summary** as its line
 * (blank until the read lands, blank still after a refusal), and a chevron.
 * Pressed, it pushes `/settings/codecs`, the **Codecs page**, which reads the
 * report again for itself (log 26 Q13).
 *
 * Under the row, the second half of the card: the divider; _Subtitles_ with
 * its lede; _Turn on automatically_ beside a **Coming soon** pill over a
 * `Toggle` drawn off and disabled — it stores nothing and presses to nothing,
 * auto-on staying on the roadmap exactly as log 10 decided; a rule; and
 * _Preferred language_ with `FilterDropdown` on the right, the seven names of
 * the **Language pool** as its options and the fetched value as its value.
 *
 * The section owns `useSettings`, and takes only the read of
 * `useCapabilities` — the writes are the Codecs page's. The pill is not drawn
 * while the settings are `null` — a refused read shows no default the server
 * never confirmed.
 */
export function PlaybackSection() {
  const { settings, chooseSubtitleLanguage } = useSettings();
  const { capabilities } = useCapabilities();

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
        <CodecsRow
          glyph={<MicrochipIcon size={19} />}
          label="Codecs"
          line={capabilities === null ? '' : codecSummary(capabilities)}
          to="/settings/codecs"
        />

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
