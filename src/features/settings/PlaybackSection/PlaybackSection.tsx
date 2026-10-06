import { FilterDropdown } from '@/components';
import { Toggle } from '@/primitives';
import { SUBTITLE_LANGUAGES, type FilterOption } from '@/types';

import { CodecRow } from '../CodecRow/CodecRow';
import { ComponentDropZone } from '../ComponentDropZone/ComponentDropZone';
import { codecRows, codecSummary, componentRow } from '../codecView/codecView';
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
  ComingSoon,
  Header,
  Report,
  Row,
  RowDesc,
  RowRule,
  RowTitle,
  RowTitleLine,
  Rows,
  SubtitlesHeader,
  Summary,
} from './PlaybackSection.styles';

/**
 * The Settings hub's Playback **Settings group**, from
 * `page.SettingsPage.dc.html`: the `Playback` **Group heading** over a
 * **Section card** that opens with _Codecs_ and its lede, over the **Codec
 * report**.
 *
 * The lede is both of the prototype's sentences, and the second one points at
 * the _Add a codec pack_ zone the report draws under the rows.
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
        <CodecReport />

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

/**
 * The **Codec report** as the card drew it before the **Codecs page** — the
 * summary over the codec rows, the **Component row** last, the zone under all
 * of it — kept here for the one slice the report shows in both places (26 —
 * Codecs page, Phase 1). Phase 2 puts the **Codecs row** in its place.
 */
function CodecReport() {
  const { capabilities, upload, installComponent, removeComponent } =
    useCapabilities();

  if (capabilities === null) {
    return null;
  }

  const component = componentRow(capabilities);

  return (
    <Report>
      <Summary>{codecSummary(capabilities)}</Summary>
      <Rows>
        {codecRows(capabilities).map((row) => (
          <CodecRow key={row.key} row={row} />
        ))}
        {component !== null && (
          <CodecRow
            key={component.key}
            row={component}
            onRemove={
              component.removable
                ? () => {
                    void removeComponent();
                  }
                : undefined
            }
          />
        )}
      </Rows>
      <ComponentDropZone
        upload={upload}
        onFiles={(files) => {
          void installComponent(files);
        }}
      />
    </Report>
  );
}
