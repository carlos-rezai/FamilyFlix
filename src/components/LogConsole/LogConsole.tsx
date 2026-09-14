import { useLayoutEffect, useRef } from 'react';

import type { LogLine } from '@/types';
import { Box, Line } from './LogConsole.styles';

/** The prototype's default box height. */
const DEFAULT_HEIGHT = 200;

export interface LogConsoleProps {
  /** The lines to draw, oldest first. The caller caps the buffer. */
  lines: LogLine[];
  /** The box's height in px — the prototype's `maxHeight`. */
  height?: number;
}

/**
 * The **Activity log**'s box, from `mol.LogConsole.dc.html`: mono lines, each
 * coloured by its **Log kind**, in a scrolling box that follows the newest
 * line — the installer-style console the running step reads the run from.
 * The parent caps the buffer; the box only draws what it is handed.
 *
 * An ARIA `log`: a region whose new lines arrive in order, which is exactly
 * what the role names.
 */
export function LogConsole({
  lines,
  height = DEFAULT_HEIGHT,
}: LogConsoleProps) {
  const box = useRef<HTMLDivElement>(null);

  // Pinned to the bottom: on mount and on every line that arrives, before
  // the frame is painted, so the box never shows a scroll it then jumps from.
  useLayoutEffect(() => {
    if (box.current !== null) {
      box.current.scrollTop = box.current.scrollHeight;
    }
  }, [lines]);

  return (
    <Box ref={box} role="log" $height={height}>
      {lines.map((line, index) => (
        <Line key={index} $kind={line.kind}>
          {line.text}
        </Line>
      ))}
    </Box>
  );
}
