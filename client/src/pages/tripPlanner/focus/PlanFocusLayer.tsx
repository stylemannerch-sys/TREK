import { LayoutList, Map as MapIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { useTranslation } from '../../../i18n';
import { FocusDayAgenda } from './FocusDayAgenda';
import { FocusTripRail } from './FocusTripRail';
import { type FocusWorkspaceInput, useFocusWorkspace } from './useFocusWorkspace';
import type { PlanView } from './usePlanView';

/**
 * The rail and the agenda. The planner's own Places panel stays beside them
 * where it always sits, so the workspace leaves its width free.
 */
function FocusWorkspace(props: FocusWorkspaceInput) {
  const ws = useFocusWorkspace(props);
  const reserve = props.reserveEnd ? props.reserveEnd + 26 : 16;
  return (
    <div
      className="absolute inset-0 z-20 flex gap-4 bg-surface-secondary p-4 pb-20"
      style={{ paddingRight: reserve }} // rtl-lint-disable: the Places panel is placed by a physical right offset
    >
      <FocusTripRail ws={ws} canEdit={props.canEdit} />
      <FocusDayAgenda ws={ws} canEdit={props.canEdit} onPlaceClick={props.onPlaceClick} />
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
 * A place picked in the Places panel opens its details, which live on the map:
 * so a pick made while focus is on goes back to the map, as a stop opened from
 * the agenda does. Only a new pick counts, not one already open on arrival.
 */
function useMapForPickedPlace(view: PlanView, selectedPlaceId: number | null | undefined) {
  const seen = useRef(selectedPlaceId);
  const { active, choose } = view;
  useEffect(() => {
    if (active && selectedPlaceId != null && selectedPlaceId !== seen.current) choose('map');
    seen.current = selectedPlaceId;
  }, [active, choose, selectedPlaceId]);
}

/**
 * The focus face of the desktop Plan tab and the switch between it and the map.
 * The map stays mounted underneath (hidden, not removed), so it keeps its view
 * and needs no rebuild when the planner comes back to it.
 */
export function PlanFocusLayer({
  view,
  selectedPlaceId,
  ...input
}: FocusWorkspaceInput & { view: PlanView; selectedPlaceId?: number | null }) {
  useMapForPickedPlace(view, selectedPlaceId);
  if (!view.available) return null;
  return (
    <>
      {view.active && <FocusWorkspace {...input} />}
      <PlanViewSwitch view={view} />
    </>
  );
}
