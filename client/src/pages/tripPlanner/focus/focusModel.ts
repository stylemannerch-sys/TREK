import type { Accommodation, Assignment, Day, Place, Reservation } from '../../../types';
import { parseTimeToMinutes } from '../../../utils/dayMerge';
import { haversineKm } from '../../../utils/geo';

/** A gap shorter than this is just slack between two stops, not time to plan. */
const MIN_GAP_MINUTES = 60;
/** How far a place may lie from a day's stops or hotel and still count as near that day. */
const NEAR_KM = 4;
/** What a stop without a duration of its own is counted as. */
export const DEFAULT_STOP_MINUTES = 60;
/** Walking there and away again, kept free around a stop dropped into a gap. */
const GAP_EDGE_MINUTES = 10;
/** A day with more than this many busy minutes reads as full. */
export const FULL_DAY_MINUTES = 510;

export interface FocusStop {
  kind: 'stop';
  key: string;
  assignmentId: number;
  placeId: number;
  name: string;
  categoryId: number | null;
  notes: string | null;
  /** Minutes after midnight, as planned; null when the stop has no time yet. */
  start: number | null;
  end: number | null;
  minutes: number | null;
  /** For an untimed stop that follows a timed one: when it would start, travel included. */
  suggested: number | null;
  booked: boolean;
}

export interface FocusLeg {
  kind: 'leg';
  key: string;
  minutes: number;
  metres: number;
  mode: 'walk' | 'transit';
}

export interface FocusGap {
  kind: 'gap';
  key: string;
  from: number;
  to: number;
  /** Where a stop filling the gap goes in the day's order. */
  position: number;
  afterName: string;
  beforeName: string;
}

export type FocusRow = FocusStop | FocusLeg | FocusGap;

export interface DayLoad {
  busy: number;
  travel: number;
  free: number;
  stops: number;
  full: boolean;
}

export interface FreeSlot {
  key: string;
  dayId: number;
  /** Null for a day with nothing planned at all. */
  gap: FocusGap | null;
}

export interface Point {
  lat: number;
  lng: number;
}

function pointOf(p: { lat?: number | null; lng?: number | null } | null | undefined): Point | null {
  return p && typeof p.lat === 'number' && typeof p.lng === 'number' ? { lat: p.lat, lng: p.lng } : null;
}

/**
 * A rough door-to-door time from the straight-line distance: a walk up to
 * 1.5 km, else transit with ten minutes for getting to and waiting at a stop.
 * The planner's real routes come from a routing service; this only has to be
 * good enough to tell a short hop from a trip across town.
 */
export function estimateLeg(a: Point, b: Point): { minutes: number; metres: number; mode: 'walk' | 'transit' } {
  const metres = Math.round(haversineKm(a, b) * 1000 * 1.3);
  if (metres <= 1500) return { metres, mode: 'walk', minutes: Math.max(2, Math.round(metres / 80)) };
  return { metres, mode: 'transit', minutes: Math.round(10 + (metres / 1000) * 2.5) };
}

const floorTo5 = (minutes: number) => Math.floor(minutes / 5) * 5;
const ceilTo5 = (minutes: number) => Math.ceil(minutes / 5) * 5;

function sortedAssignments(list: readonly Assignment[] | undefined): Assignment[] {
  return (list ?? []).slice().sort((a, b) => a.order_index - b.order_index);
}

function stopOf(a: Assignment, dayId: number, reservations: readonly Reservation[]): FocusStop {
  const start = parseTimeToMinutes(a.place.place_time);
  const endTime = parseTimeToMinutes(a.place.end_time);
  const own = a.place.duration_minutes && a.place.duration_minutes > 0 ? a.place.duration_minutes : null;
  const minutes = start != null && endTime != null && endTime > start ? endTime - start : own;
  return {
    kind: 'stop',
    key: `s${a.id}`,
    assignmentId: a.id,
    placeId: a.place_id,
    name: a.place.name,
    categoryId: a.place.category_id ?? null,
    notes: a.notes || a.place.notes || null,
    start,
    end: start != null ? start + (minutes ?? DEFAULT_STOP_MINUTES) : null,
    minutes,
    suggested: null,
    booked: reservations.some((r) => r.place_id === a.place_id && (r.day_id == null || r.day_id === dayId)),
  };
}

/**
 * A day as the focus agenda reads it: its stops in order, the travel between
 * two located stops, and a gap wherever an hour or more stays free between two
 * timed ones. A stop without a time gets a suggested start from the one before.
 */
export function buildDayRows(
  dayId: number,
  assignments: readonly Assignment[] | undefined,
  reservations: readonly Reservation[]
): FocusRow[] {
  const ordered = sortedAssignments(assignments);
  const rows: FocusRow[] = [];
  let prev: { stop: FocusStop; point: Point | null; end: number | null } | null = null;
  ordered.forEach((a, index) => {
    const stop = stopOf(a, dayId, reservations);
    const point = pointOf(a.place);
    const leg = prev?.point && point ? estimateLeg(prev.point, point) : null;
    const prevEnd = prev?.end ?? null;
    const arrival = prevEnd != null ? prevEnd + (leg?.minutes ?? 0) : null;
    // The travel is an estimate, so the free time it leaves is read on a 5-minute grid, never later than it is.
    const leaveBy = stop.start != null ? floorTo5(stop.start - (leg?.minutes ?? 0)) : null;
    if (prev && prevEnd != null && leaveBy != null && leaveBy - prevEnd >= MIN_GAP_MINUTES) {
      rows.push({
        kind: 'gap',
        key: `g${a.id}`,
        from: prevEnd,
        to: leaveBy,
        position: index,
        afterName: prev.stop.name,
        beforeName: stop.name,
      });
    }
    if (leg) rows.push({ kind: 'leg', key: `l${a.id}`, ...leg });
    if (stop.start == null && arrival != null) stop.suggested = ceilTo5(arrival);
    rows.push(stop);
    const startsAt = stop.start ?? stop.suggested;
    prev = { stop, point, end: startsAt != null ? startsAt + (stop.minutes ?? DEFAULT_STOP_MINUTES) : null };
  });
  return rows;
}

export function dayLoad(rows: readonly FocusRow[]): DayLoad {
  let busy = 0;
  let travel = 0;
  let free = 0;
  let stops = 0;
  for (const row of rows) {
    if (row.kind === 'stop') {
      stops += 1;
      busy += row.minutes ?? DEFAULT_STOP_MINUTES;
    } else if (row.kind === 'leg') travel += row.minutes;
    else free += row.to - row.from;
  }
  return { busy, travel, free, stops, full: busy + travel > FULL_DAY_MINUTES };
}

/** Every gap worth planning across the trip, plus every day with nothing on it, in trip order. */
export function freeSlots(days: readonly Day[], rowsByDay: ReadonlyMap<number, FocusRow[]>): FreeSlot[] {
  const slots: FreeSlot[] = [];
  for (const day of days) {
    const rows = rowsByDay.get(day.id) ?? [];
    if (!rows.some((r) => r.kind === 'stop')) {
      slots.push({ key: `d${day.id}`, dayId: day.id, gap: null });
      continue;
    }
    for (const row of rows) if (row.kind === 'gap') slots.push({ key: row.key, dayId: day.id, gap: row });
  }
  return slots;
}

/** Category id → how many of the day's stops carry it. */
export function categoryCounts(rows: readonly FocusRow[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const row of rows) {
    if (row.kind === 'stop' && row.categoryId != null)
      counts.set(row.categoryId, (counts.get(row.categoryId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Where a day happens: its located stops, and the hotel it starts or ends at.
 * Positions are a day's index in the trip, so a stay is matched by its span.
 */
export function dayAnchors(
  day: Day,
  dayIndex: ReadonlyMap<number, number>,
  assignments: readonly Assignment[] | undefined,
  accommodations: readonly Accommodation[]
): Point[] {
  const at = dayIndex.get(day.id) ?? -1;
  const points = (assignments ?? []).map((a) => pointOf(a.place)).filter((p): p is Point => p != null);
  for (const acc of accommodations) {
    const from = dayIndex.get(acc.start_day_id) ?? -2;
    const to = dayIndex.get(acc.end_day_id) ?? -2;
    const point = pointOf({ lat: acc.place_lat, lng: acc.place_lng });
    if (point && at >= from && at <= to) points.push(point);
  }
  return points;
}

export function distanceToAnchors(place: Place, anchors: readonly Point[]): number | null {
  const point = pointOf(place);
  if (!point || anchors.length === 0) return null;
  return Math.min(...anchors.map((a) => haversineKm(point, a)));
}

/** The trip's places that are on no day yet, leaving out the hotels, which are planned through their stay. */
export function unplannedPlaces(
  places: readonly Place[],
  assignments: Readonly<Record<string, readonly Assignment[]>>,
  accommodations: readonly Accommodation[]
): Place[] {
  const used = new Set<number>();
  for (const list of Object.values(assignments)) for (const a of list) used.add(a.place_id);
  for (const acc of accommodations) if (acc.place_id != null) used.add(acc.place_id);
  return places.filter((p) => !used.has(p.id));
}

export type TrayFilter = 'near' | 'all' | number;

export interface TrayPlace {
  place: Place;
  /** Kilometres to the nearest stop or hotel of the day; null without coordinates on either side. */
  km: number | null;
  near: boolean;
}

/**
 * The unplanned places the tray shows for a day: near it, all, or one category,
 * and with a gap picked only the near ones that fit it. Nearest first, then by name.
 */
export function trayPlaces(
  unplanned: readonly Place[],
  anchors: readonly Point[],
  filter: TrayFilter,
  gap: FocusGap | null
): TrayPlace[] {
  const rows = unplanned.map((place) => {
    const km = distanceToAnchors(place, anchors);
    return { place, km, near: km != null && km <= NEAR_KM };
  });
  const shown = rows.filter((r) => {
    if (gap) return r.near && fitsGap(r.place, gap);
    if (filter === 'near') return r.near;
    if (filter === 'all') return true;
    return r.place.category_id === filter;
  });
  return shown.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity) || a.place.name.localeCompare(b.place.name));
}

export function fitsGap(place: Place, gap: FocusGap): boolean {
  const minutes = place.duration_minutes && place.duration_minutes > 0 ? place.duration_minutes : DEFAULT_STOP_MINUTES;
  return minutes + 2 * GAP_EDGE_MINUTES <= gap.to - gap.from;
}

/** The stay a day starts from and the one it ends at, by the day's position in the trip. */
export function dayStays(
  day: Day,
  dayIndex: ReadonlyMap<number, number>,
  accommodations: readonly Accommodation[]
): { from: Accommodation | null; night: Accommodation | null } {
  const at = dayIndex.get(day.id) ?? -1;
  let from: Accommodation | null = null;
  let night: Accommodation | null = null;
  for (const acc of accommodations) {
    const start = dayIndex.get(acc.start_day_id) ?? -2;
    const end = dayIndex.get(acc.end_day_id) ?? -2;
    if (start < at && at <= end) from = acc;
    if (start <= at && at < end) night = acc;
  }
  return { from, night };
}

export function clock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
