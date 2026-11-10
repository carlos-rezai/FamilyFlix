// @vitest-environment node
//
// 60, Rebuild edges, Phase 3 (issue #566): any Excel's sheet reads.
//
// The **Sheet dialect**: how a CSV sheet is spelled, read off its bytes. A
// UTF-8 BOM or valid UTF-8 is UTF-8, anything else cp1252, which is what a
// Windows Excel saves "CSV" as. The separator is `;` when the header row holds
// more `;` than `,` outside quotes, else `,`; a European Excel saves `;`.

import { describe, expect, it } from 'vitest';

import { sheetDialect } from './sheetDialect';

/** A UTF-8 byte order mark, as Excel and the **Sheet writer** put it. */
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

const utf8 = (text: string): Buffer => Buffer.from(text, 'utf8');

/** Bytes as cp1252 spells them: for these letters, one byte each. */
const cp1252 = (text: string): Buffer => Buffer.from(text, 'latin1');

describe('sheetDialect: the encoding', () => {
  it('reads a sheet behind a UTF-8 BOM as UTF-8', () => {
    const bytes = Buffer.concat([BOM, utf8('Title,Year\nAmélie,2001\n')]);

    expect(sheetDialect(bytes).encoding).toBe('utf-8');
  });

  it('reads BOM-less valid UTF-8 as UTF-8', () => {
    expect(sheetDialect(utf8('Title,Year\nAmélie,2001\n')).encoding).toBe(
      'utf-8'
    );
  });

  it('reads bytes that are not UTF-8 as cp1252', () => {
    const bytes = cp1252('Title,Year\nAm\xe9lie,2001\n');
    expect(bytes.includes(0xe9)).toBe(true);

    expect(sheetDialect(bytes).encoding).toBe('windows-1252');
  });
});

describe('sheetDialect: the separator', () => {
  it('reads a `;` header as `;`', () => {
    expect(
      sheetDialect(
        utf8('Type;Folder;Title;Rating\nMovie;Heat (1995);Heat;8,5\n')
      ).separator
    ).toBe(';');
  });

  it('reads a `,` header as `,`, whatever the rows below hold', () => {
    expect(
      sheetDialect(utf8('Type,Folder,Title\nMovie;a;b;c,Heat (1995),Heat\n'))
        .separator
    ).toBe(',');
  });

  it('does not count a `;` inside a quoted header cell', () => {
    expect(
      sheetDialect(utf8('"Title;Name;Film",Year\nHeat,1995\n')).separator
    ).toBe(',');
  });

  it('reads the separator of a cp1252 sheet behind no BOM', () => {
    expect(sheetDialect(cp1252('Title;Year\nAm\xe9lie;2001\n'))).toEqual({
      encoding: 'windows-1252',
      separator: ';',
    });
  });
});
