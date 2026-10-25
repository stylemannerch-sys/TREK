import { useCallback, useMemo, useState } from 'react';

import type { Accommodation, AssignmentsMap, Category, Day, Place, Reservation } from '../../../types';
import {
  buildDayRows,
  categoryCounts,
  clock,
  dayAnchors,
  dayLoad,
  dayStays,
  DEFAULT_STOP_MINUTES,
  type FocusGap,
  type FocusRow,
  type FocusStop,
  type FreeSlot,
  freeSlots,
  type TrayFilter,
  trayPlaces,
  unplannedPlaces,
} from './focusModel';

export type AgendaFilter = 'all' | 'free' | number;

export interface FocusWorkspaceInput {
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
  onSetTimes: (dayId: number, assignmentId: number, times: { place_time: string; end_time: string }) => Promise<void>;
  onPlaceClick: (placeId: number, assignmentId?: number) => void;
}

/** Everything the workspace derives from the trip, recomputed only when the trip changes. */
function useFocusData(input: FocusWorkspaceInput) {
  const { days, places, assignments, reservations, accommodations } = input;
  return useMemo(() => {
    const ordered = days.slice().sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0));
    const dayIndex = new Map(ordered.map((d, i) => [d.id, i]));
    const rowsByDay = new Map<number, FocusRow[]>(
      ordered.map((d) => [d.id, buildDayRows(d.id, assignments[String(d.id)], reservations)])
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
  }, [days, places, assignments, reservations, accommodations]);
}

/**
 * The focus workspace for the desktop Plan tab: a rail of days, one day as an
 * agenda, and the places not on any day yet. Reads the trip from the planner
 * and writes only through the planner's own handlers, so undo, toasts, the
 * offline queue and the route refresh behave as they do in the map view.
 */
export function useFocusWorkspace(input: FocusWorkspaceInput) {
  const { categories, accommodations, assignments, selectedDayId, onSelectDay, onAssignToDay, onSetTimes } = input;
  const data = useFocusData(input);
  const [agendaFilter, setAgendaFilter] = useState<AgendaFilter>('all');
  const [trayFilter, setTrayFilter] = useState<TrayFilter>('near');
  const [gapKey, setGapKey] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);

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
  const tray = useMemo(
    () => trayPlaces(data.unplanned, anchors, trayFilter, gap),
    [data.unplanned, anchors, trayFilter, gap]
  );
  const nearCount = useMemo(() => trayPlaces(data.unplanned, anchors, 'near', null).length, [data.unplanned, anchors]);
  const trayCategories = useMemo(() => {
    const byId = new Map<number, number>();
    for (const p of data.unplanned)
      if (p.category_id != null) byId.set(p.category_id, (byId.get(p.category_id) ?? 0) + 1);
    return categories.filter((c) => byId.has(c.id)).map((c) => ({ category: c, count: byId.get(c.id) ?? 0 }));
  }, [data.unplanned, categories]);
  const dayCategories = categories
    .filter((c) => counts.has(c.id))
    .map((c) => ({ category: c, count: counts.get(c.id) ?? 0 }));
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const selectDay = useCallback(
    (dayId: number) => {
      onSelectDay(dayId);
      setGapKey(null);
      setTrayFilter('near');
      setAgendaFilter((f) => (f === 'free' ? 'all' : f));
    },
    [onSelectDay]
  );
  const pickSlot = useCallback(
    (slot: FreeSlot) => {
      onSelectDay(slot.dayId);
      setAgendaFilter('all');
      setTrayFilter('near');
      setGapKey(slot.gap?.key ?? null);
      setTrayOpen(true);
    },
    [onSelectDay]
  );
  const toggleGap = useCallback((key: string) => {
    setGapKey((k) => (k === key ? null : key));
    setTrayOpen(true);
  }, []);
  const chooseTrayFilter = useCallback((f: TrayFilter) => {
    setTrayFilter(f);
    setGapKey(null);
  }, []);

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
    gap,
    toggleGap,
    pickSlot,
    selectDay,
    tray,
    trayFilter,
    chooseTrayFilter,
    trayCategories,
    nearCount,
    unplannedCount: data.unplanned.length,
    trayOpen,
    setTrayOpen,
    addPlace,
    applySuggestion,
    categoryById,
  };
}

export type FocusWorkspaceState = ReturnType<typeof useFocusWorkspace>;
