import { useCallback, useMemo, useState } from 'react';

import type { Accommodation, AssignmentsMap, Category, Day, Place, Reservation } from '../../../types';
import type { FocusDrop } from './focusDrag';
import {
  buildDayRows,
  categoryCounts,
  clock,
  dayAnchors,
  dayLoad,
  dayStays,
  type DayWindow,
  DEFAULT_STOP_MINUTES,
  type FocusGap,
  type FocusRow,
  type FocusStop,
  type FreeSlot,
  freeSlots,
  type Point,
  reorderIds,
  sortedIds,
  trayPlaces,
  unplannedPlaces,
} from './focusModel';
import { useDayWindow } from './useDayWindow';

export type AgendaFilter = 'all' | 'free' | number;

/** A gap is filled from a short list; the Places panel beside it has the whole trip. */
const GAP_CHOICES = 8;

export interface FocusWorkspaceInput {
  tripId: number | string;
  days: Day[];
  places: Place[];
  categories: Category[];
  assignments: AssignmentsMap;
  reservations: Reservation[];
  accommodations: Accommodation[];
  selectedDayId: number | null;
  canEdit: boolean;
  onSelectDay: (dayId: number) => void;
  onAssignToDay: (placeId: number, dayId?: number, position?: number) => Promise<boolean | undefined> | boolean | void;
  onSetTimes: (
    dayId: number,
    assignmentId: number,
    times: { place_time: string | null; end_time: string | null }
  ) => Promise<void>;
  onMoveToDay: (assignmentId: number, fromDayId: number, toDayId: number, position?: number) => Promise<void> | void;
  onReorder: (dayId: number, orderedIds: number[]) => void;
  onPlaceClick: (placeId: number, assignmentId?: number) => void;
  /** Pixels the planner's Places panel takes at the end of the stage; the workspace leaves them free. */
  reserveEnd?: number;
}

/** Everything the workspace derives from the trip, recomputed only when the trip or the day window changes. */
function useFocusData(input: FocusWorkspaceInput, window: DayWindow) {
  const { days, places, assignments, reservations, accommodations } = input;
  return useMemo(() => {
    const ordered = days.slice().sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0));
    const dayIndex = new Map(ordered.map((d, i) => [d.id, i]));
    const rowsByDay = new Map<number, FocusRow[]>(
      ordered.map((d) => [d.id, buildDayRows(d.id, assignments[String(d.id)], reservations, window)])
    );
    const loads = new Map(ordered.map((d) => [d.id, dayLoad(rowsByDay.get(d.id) ?? [])]));
    return {
      ordered,
      dayIndex,
      rowsByDay,
      loads,
      slots: freeSlots(ordered, rowsByDay),
      unplanned: unplannedPlaces(places, assignments, accommodations),
    };
  }, [days, places, assignments, reservations, accommodations, window]);
}

/** What can go into the picked gap for a search: nearby places that fit it, or any that fit and match. */
function useGapChoices(unplanned: Place[], anchors: Point[], gap: FocusGap | null) {
  return useCallback(
    (text: string) => {
      if (!gap) return [];
      const { near, elsewhere } = trayPlaces(unplanned, anchors, { text, categoryId: null }, gap);
      return [...near, ...elsewhere].slice(0, GAP_CHOICES);
    },
    [unplanned, anchors, gap]
  );
}

/**
 * Changes made in the agenda, through the planner's own handlers: a drop of a
 * place or a stop at a slot of a day (or at its end), a stop's times, and a
 * stop moved to another day.
 */
function useFocusEdits(input: FocusWorkspaceInput) {
  const { assignments, onAssignToDay, onMoveToDay, onReorder, onSetTimes } = input;
  const dropAt = useCallback(
    (dayId: number, position: number | undefined, drop: FocusDrop) => {
      if (drop.kind === 'place') {
        void onAssignToDay(drop.placeId, dayId, position);
      } else if (drop.fromDayId !== dayId) {
        void onMoveToDay(drop.assignmentId, drop.fromDayId, dayId, position);
      } else {
        const ids = sortedIds(assignments[String(dayId)]);
        const next = reorderIds(ids, drop.assignmentId, position ?? ids.length);
        if (next.some((id, i) => id !== ids[i])) onReorder(dayId, next);
      }
    },
    [assignments, onAssignToDay, onMoveToDay, onReorder]
  );
  const setStopTimes = useCallback(
    (dayId: number, stop: FocusStop, start: number | null, end: number | null) => {
      if (stop.assignmentId < 0) return;
      void onSetTimes(dayId, stop.assignmentId, {
        place_time: start != null ? clock(start) : null,
        end_time: start != null && end != null && end > start ? clock(end) : null,
      });
    },
    [onSetTimes]
  );
  const moveStop = useCallback(
    (fromDayId: number, stop: FocusStop, toDayId: number) => {
      if (toDayId !== fromDayId) void onMoveToDay(stop.assignmentId, fromDayId, toDayId);
    },
    [onMoveToDay]
  );
  return { dropAt, setStopTimes, moveStop };
}

/**
 * The focus workspace for the desktop Plan tab: a rail of days, one day as an
 * agenda, and the places not on any day yet. Reads the trip from the planner
 * and writes only through the planner's own handlers, so undo, toasts, the
 * offline queue and the route refresh behave as they do in the map view.
 */
export function useFocusWorkspace(input: FocusWorkspaceInput) {
  const { categories, accommodations, assignments, selectedDayId, onSelectDay, onAssignToDay, onSetTimes } = input;
  const edits = useFocusEdits(input);
  const dayWindow = useDayWindow(input.tripId);
  const data = useFocusData(input, dayWindow.window);
  const [agendaFilter, setAgendaFilter] = useState<AgendaFilter>('all');
  const [gapKey, setGapKey] = useState<string | null>(null);

  const day = data.ordered.find((d) => d.id === selectedDayId) ?? data.ordered[0] ?? null;
  const rows = useMemo(() => (day ? (data.rowsByDay.get(day.id) ?? []) : []), [data, day]);
  const counts = useMemo(() => categoryCounts(rows), [rows]);
  const activeFilter: AgendaFilter =
    typeof agendaFilter === 'number' && !counts.has(agendaFilter) ? 'all' : agendaFilter;
  const gap = (gapKey && rows.find((r): r is FocusGap => r.kind === 'gap' && r.key === gapKey)) || null;
  const visibleRows =
    typeof activeFilter === 'number' ? rows.filter((r) => r.kind === 'stop' && r.categoryId === activeFilter) : rows;
  const anchors = useMemo(
    () => (day ? dayAnchors(day, data.dayIndex, assignments[String(day.id)], accommodations) : []),
    [day, data.dayIndex, assignments, accommodations]
  );
  const gapChoices = useGapChoices(data.unplanned, anchors, gap);
  const dayCategories = categories
    .filter((c) => counts.has(c.id))
    .map((c) => ({ category: c, count: counts.get(c.id) ?? 0 }));
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const selectDay = useCallback(
    (dayId: number) => {
      onSelectDay(dayId);
      setGapKey(null);
      setAgendaFilter((f) => (f === 'free' ? 'all' : f));
    },
    [onSelectDay]
  );
  const pickSlot = useCallback(
    (slot: FreeSlot) => {
      onSelectDay(slot.dayId);
      setAgendaFilter('all');
      setGapKey(slot.gap?.key ?? null);
    },
    [onSelectDay]
  );
  const toggleGap = useCallback((key: string) => setGapKey((k) => (k === key ? null : key)), []);
  const addPlace = useCallback(
    async (placeId: number) => {
      if (!day) return;
      const ok = await onAssignToDay(placeId, day.id, gap?.position);
      if (ok !== false) setGapKey(null);
    },
    [day, gap, onAssignToDay]
  );
  const applySuggestion = useCallback(
    (stop: FocusStop) => {
      // A stop still waiting for its server id cannot take a time yet; it gets the button again once it has one.
      if (!day || stop.suggested == null || stop.assignmentId < 0) return;
      const end = stop.suggested + (stop.minutes ?? DEFAULT_STOP_MINUTES);
      void onSetTimes(day.id, stop.assignmentId, { place_time: clock(stop.suggested), end_time: clock(end) });
    },
    [day, onSetTimes]
  );

  return {
    days: data.ordered,
    loads: data.loads,
    slots: data.slots,
    day,
    dayNumber: day ? (data.dayIndex.get(day.id) ?? 0) + 1 : 0,
    stays: day ? dayStays(day, data.dayIndex, accommodations) : { from: null, night: null },
    load: day ? data.loads.get(day.id) : undefined,
    rows: visibleRows,
    totalStops: rows.filter((r) => r.kind === 'stop').length,
    agendaFilter: activeFilter,
    setAgendaFilter,
    dayCategories,
    dayWindow,
    gap,
    toggleGap,
    clearGap: () => setGapKey(null),
    pickSlot,
    selectDay,
    gapChoices,
    addPlace,
    ...edits,
    applySuggestion,
    categoryById,
  };
}

export type FocusWorkspaceState = ReturnType<typeof useFocusWorkspace>;
