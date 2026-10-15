import { useId, type ReactNode } from 'react';

import {
  Actions,
  Body,
  Card,
  Chevron,
  Count,
  HeaderRow,
  Label,
  Marks,
  Toggle,
} from './Accordion.styles';

export interface AccordionProps {
  label: string;
  count: number;
  /** Whether the body is open — the caller holds it. */
  expanded: boolean;
  onToggle: () => void;
  /** Drawn inside the toggle, between the label and the count. */
  marks?: ReactNode;
  /** Drawn beside the toggle, never inside it. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * The **Accordion** — `mol.Accordion.dc.html`: a header over a body, the body
 * unmounted while closed. The header row is the toggle — one button holding
 * the chevron, the label, the caller's marks and the count pill — then the
 * caller's actions beside it, so a button never nests in a button.
 * Controlled: it holds no open state. Domain-free.
 */
export function Accordion({
  label,
  count,
  expanded,
  onToggle,
  marks,
  actions,
  children,
}: AccordionProps) {
  const bodyId = useId();

  return (
    <Card>
      <HeaderRow>
        <Toggle
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={onToggle}
        >
          <Chevron
            $expanded={expanded}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Chevron>
          <Label>{label}</Label>
          {marks ? <Marks>{marks}</Marks> : null}
          <Count>{count}</Count>
        </Toggle>
        {actions ? <Actions>{actions}</Actions> : null}
      </HeaderRow>
      {expanded ? (
        <Body id={bodyId} role="region" aria-label={label}>
          {children}
        </Body>
      ) : null}
    </Card>
  );
}
