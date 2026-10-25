/**
 * FE-PLANNER-FOCUSMODEL-001 to FE-PLANNER-FOCUSMODEL-011
 *
 * The focus workspace's pure model: a day's rows (stops, travel, free gaps),
 * its load, the trip's free slots, and which places are still unplanned and
 * near a day.
 */
import { describe, expect, it } from 'vitest';

import type { Accommodation, Assignment, Day, Place, Reservation } from '../../../types';
import {
  buildDayRows,
  categoryCounts,
  clock,
  dayAnchors,
  dayLoad,
  dayStays,
  distanceToAnchors,
  estimateLeg,
  fitsGap,
  freeSlots,
  trayPlaces,
  unplannedPlaces,
  type FocusGap,
  type FocusRow,
} from './focusModel';

// Shibuya Crossing and two points ~450 m and ~5 km from it.
const SHIBUYA = { lat: 35.6595, lng: 139.7005 };
const PARCO = { lat: 35.6623, lng: 139.6987 };
const GINZA = { lat: 35.6717, lng: 139.765 };

function place(id: number, extra: Partial<Place> = {}): Place {
  return { id, trip_id: 1, name: `Place ${id}`, lat: null, lng: null, category_id: null, ...extra } as Place;
}

function assignment(
  id: number,
  order: number,
  p: Partial<Place> & { id: number },
  extra: Partial<Assignment> = {}
): Assignment {
  return {
    id,
    day_id: 10,
    place_id: p.id,
    order_index: order,
    notes: null,
    place: { name: `Place ${p.id}`, lat: null, lng: null, category_id: null, ...p },
    ...extra,
  } as Assignment;
}

function day(id: number): Day {
  return { id, trip_id: 1, day_number: id } as Day;
}

const stops = (rows: FocusRow[]) => rows.filter((r) => r.kind === 'stop');

describe('focusModel', () => {
  it('FE-PLANNER-FOCUSMODEL-001: a short hop is a walk, across town is transit', () => {
    const near = estimateLeg(SHIBUYA, PARCO);
    expect(near.mode).toBe('walk');
    expect(near.minutes).toBeGreaterThanOrEqual(2);
    expect(near.minutes).toBeLessThan(15);
    const far = estimateLeg(SHIBUYA, GINZA);
    expect(far.mode).toBe('transit');
    expect(far.minutes).toBeGreaterThan(15);
  });

  it('FE-PLANNER-FOCUSMODEL-002: rows follow order_index, with travel between located stops', () => {
    const rows = buildDayRows(
      10,
      [
        assignment(2, 1, { id: 22, ...PARCO, place_time: '11:00' }),
        assignment(1, 0, { id: 21, ...SHIBUYA, place_time: '10:00' }),
      ],
      []
    );
    expect(rows.map((r) => r.kind)).toEqual(['stop', 'leg', 'stop']);
    expect(stops(rows).map((s) => s.assignmentId)).toEqual([1, 2]);
  });

  it('FE-PLANNER-FOCUSMODEL-003: an hour or more between two timed stops becomes a gap that ends before the travel', () => {
    const rows = buildDayRows(
      10,
      [
        assignment(1, 0, { id: 21, ...SHIBUYA, place_time: '09:00', end_time: '10:00' }),
        assignment(2, 1, { id: 22, ...PARCO, place_time: '13:00' }),
      ],
      []
    );
    const gap = rows.find((r): r is FocusGap => r.kind === 'gap');
    const leg = rows.find((r) => r.kind === 'leg');
    expect(gap).toMatchObject({
      from: 600,
      to: Math.floor((780 - (leg?.kind === 'leg' ? leg.minutes : 0)) / 5) * 5,
      position: 1,
      afterName: 'Place 21',
      beforeName: 'Place 22',
    });
  });

  it('FE-PLANNER-FOCUSMODEL-004: no gap under an hour, and an untimed stop gets a suggested start after the one before', () => {
    const rows = buildDayRows(
      10,
      [
        assignment(1, 0, { id: 21, place_time: '09:00', duration_minutes: 90 }),
        assignment(2, 1, { id: 22, place_time: '10:45' }),
        assignment(3, 2, { id: 23 }),
      ],
      []
    );
    expect(rows.some((r) => r.kind === 'gap')).toBe(false);
    const third = stops(rows)[2];
    expect(third.start).toBeNull();
    expect(third.suggested).toBe(645 + 60);
  });

  it('FE-PLANNER-FOCUSMODEL-005: a stop with a booking for its place on that day is booked', () => {
    const reservations = [{ id: 5, place_id: 21, day_id: 10 }] as Reservation[];
    const rows = buildDayRows(10, [assignment(1, 0, { id: 21 }), assignment(2, 1, { id: 22 })], reservations);
    expect(stops(rows).map((s) => s.booked)).toEqual([true, false]);
  });

  it('FE-PLANNER-FOCUSMODEL-006: the load adds stops (an hour when unknown), travel and free time, and says when a day is full', () => {
    const rows = buildDayRows(
      10,
      [
        assignment(1, 0, { id: 21, ...SHIBUYA, place_time: '09:00', duration_minutes: 480 }),
        assignment(2, 1, { id: 22, ...GINZA }),
      ],
      []
    );
    const load = dayLoad(rows);
    expect(load.stops).toBe(2);
    expect(load.busy).toBe(540);
    expect(load.travel).toBeGreaterThan(0);
    expect(load.full).toBe(true);
    expect(dayLoad([]).full).toBe(false);
  });

  it('FE-PLANNER-FOCUSMODEL-007: free slots list the gaps and every empty day, in trip order', () => {
    const rowsByDay = new Map<number, FocusRow[]>([
      [
        1,
        buildDayRows(
          1,
          [assignment(1, 0, { id: 21, place_time: '09:00' }), assignment(2, 1, { id: 22, place_time: '14:00' })],
          []
        ),
      ],
      [2, []],
    ]);
    const slots = freeSlots([day(1), day(2)], rowsByDay);
    expect(slots.map((s) => [s.dayId, s.gap ? 'gap' : 'day'])).toEqual([
      [1, 'gap'],
      [2, 'day'],
    ]);
  });

  it('FE-PLANNER-FOCUSMODEL-008: unplanned leaves out places on a day and hotels; near means close to the day', () => {
    const places = [place(21, SHIBUYA), place(22, PARCO), place(23, GINZA), place(24)];
    const assignments = { '10': [assignment(1, 0, { id: 21, ...SHIBUYA })] };
    const hotel = {
      id: 7,
      place_id: 24,
      start_day_id: 10,
      end_day_id: 11,
      place_lat: null,
      place_lng: null,
    } as Accommodation;
    expect(unplannedPlaces(places, assignments, [hotel]).map((p) => p.id)).toEqual([22, 23]);

    const index = new Map([[10, 0]]);
    const anchors = dayAnchors(day(10), index, assignments['10'], []);
    expect(distanceToAnchors(places[1], anchors)).toBeLessThan(1);
    expect(distanceToAnchors(places[2], anchors)).toBeGreaterThan(4);
    expect(distanceToAnchors(places[3], anchors)).toBeNull();
  });

  it('FE-PLANNER-FOCUSMODEL-009: a hotel anchors the days of its stay, and says where a day starts and ends', () => {
    const index = new Map([
      [1, 0],
      [2, 1],
      [3, 2],
    ]);
    const hotel = { id: 7, start_day_id: 1, end_day_id: 2, place_lat: 35.69, place_lng: 139.7 } as Accommodation;
    expect(dayAnchors(day(2), index, [], [hotel])).toHaveLength(1);
    expect(dayAnchors(day(3), index, [], [hotel])).toHaveLength(0);
    expect(dayStays(day(1), index, [hotel])).toEqual({ from: null, night: hotel });
    expect(dayStays(day(2), index, [hotel])).toEqual({ from: hotel, night: null });
  });

  it('FE-PLANNER-FOCUSMODEL-010: a place fits a gap with travel on both sides; counts and clock read plainly', () => {
    const gap = { kind: 'gap', key: 'g', from: 600, to: 690, position: 1, afterName: '', beforeName: '' } as FocusGap;
    expect(fitsGap(place(1, { duration_minutes: 60 }), gap)).toBe(true);
    expect(fitsGap(place(1, { duration_minutes: 75 }), gap)).toBe(false);
    expect(fitsGap(place(1), gap)).toBe(true);

    const rows = buildDayRows(
      10,
      [
        assignment(1, 0, { id: 21, category_id: 3 }),
        assignment(2, 1, { id: 22, category_id: 3 }),
        assignment(3, 2, { id: 23 }),
      ],
      []
    );
    expect([...categoryCounts(rows)]).toEqual([[3, 2]]);
    expect(clock(545)).toBe('09:05');
    expect(clock(1440 + 30)).toBe('00:30');
  });

  it('FE-PLANNER-FOCUSMODEL-011: the tray shows near places nearest first, all, one category, or what fits a gap', () => {
    const near = place(1, { ...PARCO, name: 'B near', category_id: 2, duration_minutes: 120 });
    const nearer = place(2, { ...SHIBUYA, name: 'A nearer', category_id: 3 });
    const far = place(3, { lat: 34.69, lng: 135.5, name: 'Osaka', category_id: 2 });
    const unplaced = place(4, { name: 'No coordinates' });
    const anchors = [SHIBUYA];
    const all = [near, nearer, far, unplaced];

    expect(trayPlaces(all, anchors, 'near', null).map((r) => r.place.id)).toEqual([2, 1]);
    expect(trayPlaces(all, anchors, 'all', null).map((r) => r.place.id)).toEqual([2, 1, 3, 4]);
    expect(trayPlaces(all, anchors, 2, null).map((r) => r.place.id)).toEqual([1, 3]);
    const gap = { kind: 'gap', key: 'g', from: 600, to: 690, position: 1, afterName: '', beforeName: '' } as FocusGap;
    expect(trayPlaces(all, anchors, 'all', gap).map((r) => r.place.id)).toEqual([2]);
  });
});
