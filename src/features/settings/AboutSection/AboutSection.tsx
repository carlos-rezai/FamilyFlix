import { GroupHeading } from '../section.styles';
import {
  AboutCard,
  Brand,
  Family,
  Flix,
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
 * No _Software update_ row and no rule above the brand row: the card does not
 * say _You're up to date_ with no updater to know it. The section owns no
 * hook — the version is `__APP_VERSION__`, `package.json`'s `version` baked
 * in at build by Vite's `define`, so the card and the installer can never
 * disagree.
 */
export function AboutSection() {
  return (
    <>
      <GroupHeading>About</GroupHeading>
      <AboutCard>
        <Brand>
          <Family>Family</Family>
          <Flix>Flix</Flix>
        </Brand>
        <Version>{__APP_VERSION__}</Version>
        <Tagline>Offline · local-only · no account</Tagline>
      </AboutCard>
    </>
  );
}
