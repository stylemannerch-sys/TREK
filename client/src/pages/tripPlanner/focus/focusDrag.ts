import { type DragEvent, useState } from 'react';

/** A stop of the agenda being dragged: its own type, so nothing outside the workspace mistakes it for a place. */
const STOP_TYPE = 'application/x-trek-focus-stop';
/** What the Places panel and the map markers put on a drag (startPlaceDrag); lower-cased in `types` by the browser. */
const PLACE_TYPE = 'placeId';

export type FocusDrop = { kind: 'place'; placeId: number } | { kind: 'stop'; assignmentId: number; fromDayId: number };

export function startStopDrag(e: DragEvent, assignmentId: number, fromDayId: number): void {
  e.dataTransfer.setData(STOP_TYPE, JSON.stringify({ assignmentId, fromDayId }));
  e.dataTransfer.effectAllowed = 'move';
}

/** What a drag carries, by its types alone: the browser hides the data itself until the drop. */
function carried(e: DragEvent): 'stop' | 'place' | null {
  const types = Array.from(e.dataTransfer?.types ?? []).map((t) => t.toLowerCase());
  if (types.includes(STOP_TYPE)) return 'stop';
  return types.includes(PLACE_TYPE.toLowerCase()) ? 'place' : null;
}

/** What was dropped, read once on drop; the browser hides the data while the drag is still moving. */
function readDrop(e: DragEvent): FocusDrop | null {
  const stop = e.dataTransfer.getData(STOP_TYPE);
  if (stop) {
    try {
      const { assignmentId, fromDayId } = JSON.parse(stop) as { assignmentId: unknown; fromDayId: unknown };
      if (typeof assignmentId === 'number' && typeof fromDayId === 'number') {
        return { kind: 'stop', assignmentId, fromDayId };
      }
    } catch {
      return null;
    }
  }
  const placeId = Number(e.dataTransfer.getData(PLACE_TYPE));
  return Number.isFinite(placeId) && placeId > 0 ? { kind: 'place', placeId } : null;
}

/**
 * Props for one drop target: it lights up while a place or a stop is over it
 * and hands the drop on. Disabled (no props, never lit) without the right to edit.
 */
export function useDropTarget(onDrop: ((drop: FocusDrop) => void) | undefined) {
  const [over, setOver] = useState(false);
  if (!onDrop) return { over: false, props: {} };
  return {
    over,
    props: {
      onDragOver: (e: DragEvent) => {
        const kind = carried(e);
        if (!kind) return;
        e.preventDefault();
        // A place is offered as a copy (startPlaceDrag), a stop as a move; any other effect refuses the drop.
        e.dataTransfer.dropEffect = kind === 'place' ? 'copy' : 'move';
        if (!over) setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: DragEvent) => {
        setOver(false);
        const drop = readDrop(e);
        if (!drop) return;
        e.preventDefault();
        e.stopPropagation();
        onDrop(drop);
      },
    },
  };
}
