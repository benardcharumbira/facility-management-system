import { ChevronDown } from 'lucide-react';
import { Collapsible } from 'radix-ui';
import type { ReactNode } from 'react';

export interface DisclosureProps {
  /** Always visible, e.g. "Kitchen equipment, 14 items". */
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

/** A collapsible region. The trigger exposes `aria-expanded`; closed by default. */
export function Disclosure({ summary, children, defaultOpen = false }: DisclosureProps) {
  return (
    <Collapsible.Root
      defaultOpen={defaultOpen}
      className="group rounded-lg border border-line bg-surface"
    >
      <Collapsible.Trigger className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left font-medium hover:bg-sunken">
        <span>{summary}</span>
        <ChevronDown
          aria-hidden
          className="size-5 shrink-0 text-muted transition-transform group-data-[state=open]:rotate-180"
        />
      </Collapsible.Trigger>
      <Collapsible.Content className="border-t border-line px-4 py-3">
        {children}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
