/**
 * The **Sheet dialect**: how a CSV sheet is spelled. Its encoding, for the
 * decoder, and its separator, for the parser.
 */
export interface SheetDialect {
  encoding: 'utf-8' | 'windows-1252';
  separator: ',' | ';';
}

/** A UTF-8 byte order mark, as Excel and the **Sheet writer** put it. */
const BOM = [0xef, 0xbb, 0xbf];

const hasBom = (bytes: Buffer): boolean =>
  BOM.every((byte, index) => bytes[index] === byte);

/** Whether the bytes decode as UTF-8 without a single malformed sequence. */
function isUtf8(bytes: Buffer): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/** The header row's `;` and `,` counts, a quoted cell's own left uncounted. */
function separatorOf(text: string): SheetDialect['separator'] {
  let quoted = false;
  let semicolons = 0;
  let commas = 0;
  for (const char of text) {
    if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && (char === '\n' || char === '\r')) {
      break;
    } else if (!quoted && char === ';') {
      semicolons += 1;
    } else if (!quoted && char === ',') {
      commas += 1;
    }
  }
  return semicolons > commas ? ';' : ',';
}

/**
 * A CSV's **Sheet dialect**, read off its bytes. A UTF-8 BOM or valid UTF-8
 * is UTF-8, anything else cp1252, which is what a Windows Excel saves "CSV"
 * as. The separator is `;` when the header row holds more `;` than `,`
 * outside quotes, else `,`; a European Excel saves `;`.
 */
export function sheetDialect(bytes: Buffer): SheetDialect {
  const encoding = hasBom(bytes) || isUtf8(bytes) ? 'utf-8' : 'windows-1252';
  const text = new TextDecoder(encoding).decode(bytes);
  return { encoding, separator: separatorOf(text) };
}
