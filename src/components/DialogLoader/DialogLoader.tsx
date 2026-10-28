import { LogoLoader } from '@/primitives';

import { Modal } from '../Modal/Modal';
import { Body } from './DialogLoader.styles';

export interface DialogLoaderProps {
  /** What the work is, drawn under the loader: _Erasing everything_. */
  label: string;
}

/** Nothing to ask for: a locked modal has no way out. */
const stay = () => undefined;

/**
 * The **Dialog loader**: a 64px `LogoLoader` with its label, `aria-busy`,
 * drawn inside a **Bare** `Modal` that is locked. What a Delete or Reset
 * dialog becomes once its action is **Shown**: no heading, no ✕, no Cancel.
 */
export function DialogLoader({ label }: DialogLoaderProps) {
  return (
    <Modal open bare locked title={label} onClose={stay}>
      <Body aria-busy="true">
        <LogoLoader size={64} label={label} />
      </Body>
    </Modal>
  );
}
