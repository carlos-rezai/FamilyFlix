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
}

/**
 * The **Import mode**, from `feat.ImportFlow.dc.html` and
 * `page.LibraryFoldersPage.dc.html`, `EnrichCheckCard`'s precedent: the
 * caption _Files_ — the **Group heading**, as _Folders_ and _Scan_ are drawn —
 * over two `ChoiceCard`s in a `radiogroup` labelled by it,
 * Link then Copy. Presentational: a press hands back the mode pressed.
 */
export function ImportModeChoice({ mode, onChange }: ImportModeChoiceProps) {
  const captionId = useId();

  return (
    <div>
      <GroupHeading id={captionId}>Files</GroupHeading>
      <Cards role="radiogroup" aria-labelledby={captionId}>
        {IMPORT_MODES.map((key) => (
          <ChoiceCard
            key={key}
            label={MODE_COPY[key].label}
            line={MODE_COPY[key].line}
            checked={mode === key}
            onSelect={() => onChange(key)}
          />
        ))}
      </Cards>
    </div>
  );
}
