import { CodecManager } from '../CodecManager/CodecManager';
import { Card, GroupHeading, ItemDesc, ItemTitle } from '../section.styles';
import { Header } from './PlaybackSection.styles';

/**
 * The Settings hub's Playback **Settings group**, from
 * `page.SettingsPage.dc.html`: the `Playback` **Group heading** over a
 * **Section card** that opens with _Codecs_ and its lede, over the **Codec
 * report**.
 *
 * The lede keeps both of the prototype's sentences though the _Add a codec
 * pack_ zone the second one points at is not drawn — so the copy does not
 * move when the **Playback component upload** lands. The divider and the
 * Subtitles half of the card arrive in the next slice.
 */
export function PlaybackSection() {
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
      </Card>
    </>
  );
}
