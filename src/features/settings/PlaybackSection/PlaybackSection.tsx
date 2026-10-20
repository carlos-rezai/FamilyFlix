import { FilterDropdown } from '@/components';
import { MicrochipIcon, Toggle } from '@/primitives';
import { LANGUAGE_POOL, type FilterOption } from '@/types';

import { codecSummary } from '../codecView/codecView';
import { useCapabilities } from '../useCapabilities/useCapabilities';
import { useSettings } from '../useSettings/useSettings';
import {
  Card,
  Divider,
  GroupHeading,
  ItemDesc,
  ItemTitle,
  Row,
  RowDesc,
  RowTitle,
} from '../section.styles';
import {
  CodecsRow,
  ComingSoon,
  ItemHeader,
  RowRule,
  RowTitleLine,
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
 * _Preferred subtitle language_ with `FilterDropdown` on the right, the seven
 * names of the **Language pool** as its options and the fetched value as its
 * value. Then a divider and _Preferred audio language_, the same dropdown over
 * the **Preferred audio language** — a row alone, no item title or lede over
 * it; no audio on/off toggle.
 *
 * The section owns `useSettings`, and takes only the read of
 * `useCapabilities` — the writes are the Codecs page's. Each pill is not drawn
 * while its language is `null`, its row's title and lede drawn all the same —
 * a refused read shows no default the server never confirmed.
 */
export function PlaybackSection() {
  const {
    subtitleLanguage,
    chooseSubtitleLanguage,
    audioLanguage,
    chooseAudioLanguage,
  } = useSettings();
  const { capabilities } = useCapabilities();

  /** One pill's options: the **Language pool**, `value` marked, each a choice. */
  const poolOptions = (
    value: string | null,
    choose: (language: string) => Promise<void>
  ): FilterOption[] =>
    LANGUAGE_POOL.map((name) => ({
      label: name,
      selected: name === value,
      onSelect: () => {
        void choose(name);
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

        <ItemHeader>
          <ItemTitle>Subtitles</ItemTitle>
          <ItemDesc>How subtitles behave when a movie has them.</ItemDesc>
        </ItemHeader>

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
            <RowTitle>Preferred subtitle language</RowTitle>
            <RowDesc>Which track to use whenever subtitles are shown.</RowDesc>
          </div>
          {subtitleLanguage !== null ? (
            <FilterDropdown
              label="Preferred subtitle language"
              showLabel={false}
              value={subtitleLanguage}
              options={poolOptions(subtitleLanguage, chooseSubtitleLanguage)}
              menuWidth={200}
            />
          ) : null}
        </Row>

        <Divider />

        <Row $last>
          <div>
            <RowTitle>Preferred audio language</RowTitle>
            <RowDesc>Which track to play when a movie has several.</RowDesc>
          </div>
          {audioLanguage !== null ? (
            <FilterDropdown
              label="Preferred audio language"
              showLabel={false}
              value={audioLanguage}
              options={poolOptions(audioLanguage, chooseAudioLanguage)}
              menuWidth={200}
            />
          ) : null}
        </Row>
      </Card>
    </>
  );
}
