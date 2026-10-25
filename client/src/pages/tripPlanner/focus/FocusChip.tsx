import type { ReactNode } from 'react';

interface FocusChipProps {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  /** A category's own colour, shown as a dot beside its name. */
  dot?: string;
}

/** A filter toggle in the workspace: says whether it is on in words for screen readers, not colour alone. */
export function FocusChip({ on, onClick, children, dot }: FocusChipProps) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-caption focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
        on
          ? 'border-inverse bg-inverse font-semibold text-inverse-text'
          : 'border-edge bg-surface-card text-content-secondary hover:bg-surface-hover'
      }`}
    >
      {dot && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: dot }} />}
      {children}
    </button>
  );
}
