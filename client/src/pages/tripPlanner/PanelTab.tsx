import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import React from 'react';

import { Tooltip } from '../../components/shared/Tooltip';

interface PanelTabProps {
  hidden: boolean;
  label: string;
  onToggle: () => void;
  side?: 'left' | 'right';
}

/**
 * A side panel's tab: a flap on its edge while open, a raised accent tile once it is tucked away.
 * One component for both panels in every view, so each states whether its panel is open and shows a focus ring.
 */
export function PanelTab({ hidden, label, onToggle, side = 'left' }: PanelTabProps): React.ReactElement {
  const look = hidden
    ? 'bg-accent text-accent-text shadow-md hover:opacity-90'
    : 'text-content-faint hover:text-content';
  const left = side === 'left';
  const [Open, Close] = left ? [PanelLeftOpen, PanelLeftClose] : [PanelRightOpen, PanelRightClose];
  return (
    <Tooltip label={label} placement={left ? 'right' : 'left'}>
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        aria-expanded={!hidden}
        className={`${look} focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent`}
        style={{
          position: hidden ? 'fixed' : 'absolute',
          top: hidden ? 'calc(var(--nav-h) + 44px + 14px)' : 14,
          ...(left
            ? { left: hidden ? 10 : undefined, right: hidden ? undefined : -28 }
            : { right: hidden ? 10 : undefined, left: hidden ? undefined : -28 }),
          zIndex: -1,
          width: 36,
          height: 36,
          borderRadius: hidden ? 10 : left ? '0 10px 10px 0' : '10px 0 0 10px',
          background: hidden ? undefined : 'var(--sidebar-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.15s',
        }}
      >
        {hidden ? <Open size={16} /> : <Close size={16} />}
      </button>
    </Tooltip>
  );
}
