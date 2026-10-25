import { useId } from 'react';

import { IMPORT_MODES, type ImportMode } from '@/types';
import { ChoiceCard } from '../ChoiceCard/ChoiceCard';
import { Cards, GroupHeading } from './ImportModeChoice.styles';

/** Each mode's card: its name and the line under it. */
const MODE_COPY: Record<ImportMode, { label: string; line: string }> = {
  link: {
    label: 'Link',
    line: 'Play videos where they are. Nothing is copied.',
  },
  copy: {
    label: 'Copy',
    line: 'Keep FamilyFlix’s own copy, playable with the drive unplugged.',
  },
};

export interface ImportModeChoiceProps {
  /** The **Import mode** chosen — the caller holds it, Link on every visit. */
  mode: ImportMode;
  onChange: (mode: ImportMode) => void;
  /**
   * Link can't be chosen — a file under no **Library folder** — its card
   * disabled, reading {@link LINK_DISABLED_LINE} in place of its line.
   */
  linkDisabled?: boolean;
}

/** The disabled Link card's line. */
const LINK_DISABLED_LINE = 'Only for files inside one of your library folders.';

/**
 * The **Import mode**, from `feat.ImportFlow.dc.html` and
 * `page.LibraryFoldersPage.dc.html`, `EnrichCheckCard`'s precedent: the
 * caption _Link or copy_ — the **Group heading**, as _Folders_ and _Scan_ are drawn —
 * over two `ChoiceCard`s in a `radiogroup` labelled by it,
 * Link then Copy. Presentational: a press hands back the mode pressed, and
 * Link can be disabled with its line.
 */
export function ImportModeChoice({
  mode,
  onChange,
  linkDisabled = false,
}: ImportModeChoiceProps) {
  const captionId = useId();

  return (
    <div>
      <GroupHeading id={captionId}>Link or copy</GroupHeading>
      <Cards role="radiogroup" aria-labelledby={captionId}>
        {IMPORT_MODES.map((key) => {
          const disabled = linkDisabled && key === 'link';
          return (
            <ChoiceCard
              key={key}
              label={MODE_COPY[key].label}
              line={disabled ? LINK_DISABLED_LINE : MODE_COPY[key].line}
              checked={mode === key}
              disabled={disabled}
              onSelect={() => onChange(key)}
            />
          );
        })}
      </Cards>
    </div>
  );
}
