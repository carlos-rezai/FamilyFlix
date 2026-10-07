import { SoftwareUpdateRow } from '@/features/software-update/SoftwareUpdateRow/SoftwareUpdateRow';
import { GroupHeading } from '../section.styles';
import {
  AboutCard,
  Brand,
  BrandRow,
  Tagline,
  Version,
} from './AboutSection.styles';

/**
 * The Settings hub's About **Settings group**, from
 * `page.SettingsPage.dc.html`: the `About` **Group heading** over a **Section
 * card** holding one row — the brand row. **Family** in serif then **Flix**
 * in the accent, the **App version** in mono beside it, and _Offline ·
 * local-only · no account_ pushed to the far end.
 *
 * Under the **Desktop shell** the card's first row is _Software update_, the
 * `LibrarySection` → `ExportModal` precedent: a section mounting another
 * feature's organism. In a browser that row draws nothing and the card is
 * exactly today's. The version is `__APP_VERSION__`, `package.json`'s
 * `version` baked in at build by Vite's `define`, so the card and the
 * installer can never disagree.
 */
export function AboutSection() {
  return (
    <>
      <GroupHeading>About</GroupHeading>
      <AboutCard>
        <SoftwareUpdateRow />
        <BrandRow>
          <Brand />
          <Version>{__APP_VERSION__}</Version>
          <Tagline>Offline · local-only · no account</Tagline>
        </BrandRow>
      </AboutCard>
    </>
  );
}
