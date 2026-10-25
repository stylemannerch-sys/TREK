import { LayoutList, Map as MapIcon } from 'lucide-react';

import { useTranslation } from '../../../i18n';
import { FocusDayAgenda } from './FocusDayAgenda';
import { FocusTripRail } from './FocusTripRail';
import { FocusUnplannedTray } from './FocusUnplannedTray';
import { type FocusWorkspaceInput, useFocusWorkspace } from './useFocusWorkspace';
import type { PlanView } from './usePlanView';

function FocusWorkspace(props: FocusWorkspaceInput) {
  const ws = useFocusWorkspace(props);
  return (
    <div className="absolute inset-0 z-20 flex gap-4 bg-surface-secondary p-4 pb-20">
      <FocusTripRail ws={ws} />
      <FocusDayAgenda ws={ws} canEdit={props.canEdit} onPlaceClick={props.onPlaceClick} />
      <FocusUnplannedTray ws={ws} canEdit={props.canEdit} />
    </div>
  );
}

const SEGMENT =
  'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3.5 text-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

/** The labelled Map | Focus switch, in the same spot over both faces of the Plan tab. */
function PlanViewSwitch({ view }: { view: PlanView }) {
  const { t } = useTranslation();
  const options = [
    { id: 'map' as const, label: t('trip.focus.viewMap'), Icon: MapIcon, on: !view.active },
    { id: 'focus' as const, label: t('trip.focus.viewFocus'), Icon: LayoutList, on: view.active },
  ];
  return (
    <div
      role="group"
      aria-label={t('trip.focus.viewLabel')}
      className="absolute inset-x-0 bottom-4 z-30 mx-auto flex w-fit gap-1 rounded-xl border border-edge bg-surface-elevated p-1 shadow-elevated"
    >
      {options.map(({ id, label, Icon, on }) => (
        <button
          key={id}
          type="button"
          aria-pressed={on}
          onClick={() => view.choose(id)}
          className={`${SEGMENT} ${on ? 'bg-inverse font-semibold text-inverse-text' : 'text-content-secondary hover:bg-surface-hover'}`}
        >
          <Icon size={16} aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * The focus face of the desktop Plan tab and the switch between it and the map.
 * The map stays mounted underneath (hidden, not removed), so it keeps its view
 * and needs no rebuild when the planner comes back to it.
 */
export function PlanFocusLayer({ view, ...input }: FocusWorkspaceInput & { view: PlanView }) {
  if (!view.available) return null;
  return (
    <>
      {view.active && <FocusWorkspace {...input} />}
      <PlanViewSwitch view={view} />
    </>
  );
}
