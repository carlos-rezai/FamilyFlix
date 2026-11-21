import { LogoLoader } from '@/primitives';

import { Layer } from './DialogLoader.styles';

export interface DialogLoaderProps {
  /** What the work is, drawn under the loader: _Erasing everything_. */
  label: string;
}

/**
 * The **Dialog loader**: a 64px `LogoLoader` with its label, the layer a
 * `Modal` given a `loader` draws over its hidden idle face. It has no `Modal`
 * of its own: the card it sits in is the dialog's own, so no second dialog
 * pops in once a Delete or Reset is **Shown**.
 */
export function DialogLoader({ label }: DialogLoaderProps) {
  return (
    <Layer>
      <LogoLoader size={64} label={label} />
    </Layer>
  );
}
