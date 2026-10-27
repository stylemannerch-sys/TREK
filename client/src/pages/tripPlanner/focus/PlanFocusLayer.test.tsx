/**
 * FE-PLANNER-FOCUS-001 to FE-PLANNER-FOCUS-016
 *
 * The focus face of the desktop Plan tab: the Map | Focus switch, the trip
 * rail, one day as an agenda with travel and free gaps, the trip's free
 * slots, and the unplanned places, wired to the planner's own handlers.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Assignment, AssignmentsMap, Category, Day, Place } from '../../../types';
import { PlanFocusLayer } from './PlanFocusLayer';
import { usePlanView } from './usePlanView';

const SHIBUYA = { lat: 35.6595, lng: 139.7005 };
const PARCO = { lat: 35.6623, lng: 139.6987 };

const categories = [
  { id: 3, name: 'Food', color: '#ef4444', icon: '' },
  { id: 4, name: 'Sights', color: '#8b5cf6', icon: '' },
] as Category[];

function place(id: number, extra: Partial<Place> = {}): Place {
  return { id, trip_id: 1, name: `Place ${id}`, lat: null, lng: null, category_id: null, ...extra } as Place;
}

function assign(id: number, dayId: number, order: number, p: Place): Assignment {
  return { id, day_id: dayId, place_id: p.id, order_index: order, notes: null, place: { ...p } } as Assignment;
}

const temple = place(21, { ...SHIBUYA, name: 'Temple', category_id: 4, place_time: '09:00', end_time: '10:00' });
const lunch = place(22, { ...PARCO, name: 'Lunch', category_id: 3, place_time: '13:00', end_time: '14:00' });
const untimed = place(25, { ...PARCO, name: 'Arcade', category_id: 4 });
const ramen = place(23, { ...SHIBUYA, name: 'Ramen', category_id: 3, duration_minutes: 45 });
const osaka = place(24, { lat: 34.69, lng: 135.5, name: 'Osaka castle', category_id: 4 });

const days = [
  { id: 10, trip_id: 1, day_number: 1, date: '2026-10-25', title: 'Tokyo' },
  { id: 11, trip_id: 1, day_number: 2, date: '2026-10-26', title: null },
] as Day[];
const assignments: AssignmentsMap = {
  '10': [assign(1, 10, 0, temple), assign(2, 10, 1, lunch), assign(3, 10, 2, untimed)],
  '11': [],
};

const handlers = {
  onSelectDay: vi.fn(),
  onAssignToDay: vi.fn(async () => true),
  onSetTimes: vi.fn(async () => undefined),
  onPlaceClick: vi.fn(),
  onMoveToDay: vi.fn(),
  onReorder: vi.fn(),
};

function Harness({ available = true, pickedPlaceId = null }: { available?: boolean; pickedPlaceId?: number | null }) {
  const view = usePlanView(available);
  const [selectedDayId, setSelectedDayId] = useState<number | null>(10);
  return (
    <PlanFocusLayer
      view={view}
      tripId={1}
      days={days}
      places={[temple, lunch, untimed, ramen, osaka]}
      categories={categories}
      assignments={assignments}
      reservations={[]}
      accommodations={[]}
      selectedDayId={selectedDayId}
      canEdit
      onSelectDay={(id) => {
        handlers.onSelectDay(id);
        setSelectedDayId(id);
      }}
      onAssignToDay={handlers.onAssignToDay}
      onSetTimes={handlers.onSetTimes}
      onPlaceClick={handlers.onPlaceClick}
      onMoveToDay={handlers.onMoveToDay}
      onReorder={handlers.onReorder}
      reserveEnd={300}
      selectedPlaceId={pickedPlaceId}
    />
  );
}

function setup(path = '/trips/1?view=focus', available = true) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Harness available={available} />
    </MemoryRouter>
  );
}

const agenda = () =>
  screen
    .getByRole('heading', { level: 2, name: /dayplan\.dayN|trip\.focus\.freeSlotsTitle/ })
    .closest('section') as HTMLElement;

/** A drag as the browser hands it to a drop target: its types while moving, its data on drop. */
function dragOf(data: Record<string, string>) {
  return { types: Object.keys(data), getData: (type: string) => data[type] ?? '', dropEffect: 'none' };
}
const placeDrag = (placeId: number) => dragOf({ placeId: String(placeId) });
const stopDrag = (assignmentId: number, fromDayId: number) =>
  dragOf({ 'application/x-trek-focus-stop': JSON.stringify({ assignmentId, fromDayId }) });
function dropOn(target: HTMLElement, dataTransfer: ReturnType<typeof dragOf>) {
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
}

describe('PlanFocusLayer', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('FE-PLANNER-FOCUS-001: starts on the map, the switch opens focus and is remembered', () => {
    const { unmount } = setup('/trips/1');
    expect(screen.getByRole('button', { name: /trip\.focus\.viewMap/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('navigation', { name: 'trip.focus.days' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /trip\.focus\.viewFocus/ }));
    expect(screen.getByRole('navigation', { name: 'trip.focus.days' })).toBeInTheDocument();
    unmount();
    setup('/trips/1');
    expect(screen.getByRole('navigation', { name: 'trip.focus.days' })).toBeInTheDocument();
  });

  it('FE-PLANNER-FOCUS-002: renders nothing where focus is not available', () => {
    const { container } = setup('/trips/1?view=focus', false);
    expect(container).toBeEmptyDOMElement();
  });

  it('FE-PLANNER-FOCUS-003: the rail lists every day and picks one through the planner', () => {
    setup();
    const rail = screen.getByRole('navigation', { name: 'trip.focus.days' });
    const buttons = within(rail).getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAttribute('aria-current', 'true');
    expect(within(buttons[1]).getByText('trip.focus.emptyBadge')).toBeInTheDocument();
    fireEvent.click(buttons[1]);
    expect(handlers.onSelectDay).toHaveBeenCalledWith(11);
    expect(within(agenda()).getByText('trip.focus.emptyDayTitle')).toBeInTheDocument();
  });

  it('FE-PLANNER-FOCUS-004: the agenda shows the stops with their times, the travel and the free gap', () => {
    setup();
    const day = agenda();
    expect(within(day).getByRole('button', { name: 'Temple' })).toBeInTheDocument();
    expect(within(day).getByText('09:00')).toBeInTheDocument();
    expect(within(day).getAllByText('trip.focus.walk').length).toBeGreaterThan(0);
    expect(within(day).getAllByRole('button', { name: /trip\.focus\.fillGap/ }).length).toBeGreaterThan(0);
    fireEvent.click(within(day).getByRole('button', { name: 'Lunch' }));
    expect(handlers.onPlaceClick).toHaveBeenCalledWith(22, 2);
  });

  it('FE-PLANNER-FOCUS-005: picking a gap opens a picker under it with what fits nearby, and adds into the gap', () => {
    setup();
    expect(screen.queryByText('trip.focus.gapHint')).toBeNull();
    fireEvent.click(within(agenda()).getAllByRole('button', { name: /trip\.focus\.fillGap/ })[0]);
    expect(within(agenda()).getByText('trip.focus.gapHint')).toBeInTheDocument();
    expect(within(agenda()).getByText('Ramen')).toBeInTheDocument();
    expect(within(agenda()).queryByText('Osaka castle')).toBeNull();
    fireEvent.click(within(agenda()).getByRole('button', { name: 'trip.focus.addToAria' }));
    expect(handlers.onAssignToDay).toHaveBeenCalledWith(23, 10, 1);
  });

  it('FE-PLANNER-FOCUS-006: a search in the gap picker reaches places further away that still fit', () => {
    setup();
    fireEvent.click(within(agenda()).getAllByRole('button', { name: /trip\.focus\.fillGap/ })[0]);
    fireEvent.change(within(agenda()).getByRole('searchbox', { name: 'places.search' }), {
      target: { value: 'osaka' },
    });
    expect(within(agenda()).getByText('Osaka castle')).toBeInTheDocument();
    expect(within(agenda()).queryByText('Ramen')).toBeNull();
    fireEvent.change(within(agenda()).getByRole('searchbox', { name: 'places.search' }), {
      target: { value: 'nothing like it' },
    });
    expect(within(agenda()).getByText('trip.focus.trayEmptyGap')).toBeInTheDocument();
  });

  it('FE-PLANNER-FOCUS-007: a category chip narrows the day, and the whole day comes back', () => {
    setup();
    fireEvent.click(within(agenda()).getByRole('button', { name: /Food · 1/ }));
    expect(within(agenda()).getByRole('button', { name: 'Lunch' })).toBeInTheDocument();
    expect(within(agenda()).queryByRole('button', { name: 'Temple' })).toBeNull();
    fireEvent.click(within(agenda()).getByRole('button', { name: 'trip.focus.showWholeDay' }));
    expect(within(agenda()).getByRole('button', { name: 'Temple' })).toBeInTheDocument();
  });

  it('FE-PLANNER-FOCUS-008: free slots list the gaps and empty days of the trip, and open one', () => {
    setup();
    fireEvent.click(within(agenda()).getByRole('button', { name: /trip\.focus\.freeSlots/ }));
    const slots = within(agenda()).getAllByRole('button', { name: /trip\.focus\.fill$/ });
    expect(slots).toHaveLength(3);
    expect(within(agenda()).getByText('trip.focus.freeAfter')).toBeInTheDocument();
    expect(within(agenda()).getByText('trip.focus.wholeDayFree')).toBeInTheDocument();
    fireEvent.click(slots[2]);
    expect(handlers.onSelectDay).toHaveBeenCalledWith(11);
  });

  it('FE-PLANNER-FOCUS-009: an untimed stop after a timed one offers its suggested start', () => {
    setup();
    fireEvent.click(within(agenda()).getByRole('button', { name: 'trip.focus.setTime' }));
    expect(handlers.onSetTimes).toHaveBeenCalledWith(
      10,
      3,
      expect.objectContaining({ place_time: expect.stringMatching(/^14:\d\d$/) })
    );
  });

  it('FE-PLANNER-FOCUS-010: the workspace leaves the width of the Places panel free beside it', () => {
    setup();
    const workspace = screen.getByRole('navigation', { name: 'trip.focus.days' }).parentElement as HTMLElement;
    expect(workspace.style.paddingRight).toBe('326px');
  });

  it('FE-PLANNER-FOCUS-011: the day window says what free time counts against, and an earlier start opens the morning', () => {
    setup();
    const before = within(agenda()).getAllByRole('button', { name: /trip\.focus\.fillGap/ }).length;
    expect(within(agenda()).getByText('trip.focus.dayWindow')).toBeInTheDocument();
    fireEvent.click(within(agenda()).getByRole('button', { name: 'common.change' }));
    fireEvent.change(within(agenda()).getByLabelText('trip.focus.dayStart'), { target: { value: '07:30' } });
    expect(within(agenda()).getAllByRole('button', { name: /trip\.focus\.fillGap/ })).toHaveLength(before + 1);
    expect(JSON.parse(localStorage.getItem('plannerDayWindow:1') ?? '{}')).toMatchObject({ start: 450 });
  });

  it('FE-PLANNER-FOCUS-012: a place picked in the Places panel opens on the map, one already open does not', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/trips/1?view=focus']}>
        <Harness pickedPlaceId={21} />
      </MemoryRouter>
    );
    expect(screen.getByRole('navigation', { name: 'trip.focus.days' })).toBeInTheDocument();
    rerender(
      <MemoryRouter initialEntries={['/trips/1?view=focus']}>
        <Harness pickedPlaceId={23} />
      </MemoryRouter>
    );
    expect(screen.queryByRole('navigation', { name: 'trip.focus.days' })).toBeNull();
    expect(screen.getByRole('button', { name: /trip\.focus\.viewMap/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('FE-PLANNER-FOCUS-013: a place dragged from the Places panel onto a gap lands in it', () => {
    setup();
    const gap = within(agenda()).getAllByRole('button', { name: /trip\.focus\.fillGap/ })[0]
      .parentElement as HTMLElement;
    dropOn(gap, placeDrag(23));
    expect(handlers.onAssignToDay).toHaveBeenCalledWith(23, 10, 1);
  });

  it('FE-PLANNER-FOCUS-014: a stop dropped on another day of the rail moves there, on a gap of its day it is reordered', () => {
    setup();
    const rail = screen.getByRole('navigation', { name: 'trip.focus.days' });
    dropOn(within(rail).getAllByRole('button')[1], stopDrag(1, 10));
    expect(handlers.onMoveToDay).toHaveBeenCalledWith(1, 10, 11, undefined);
    const gap = within(agenda()).getAllByRole('button', { name: /trip\.focus\.fillGap/ })[0]
      .parentElement as HTMLElement;
    dropOn(gap, stopDrag(3, 10));
    expect(handlers.onReorder).toHaveBeenCalledWith(10, [1, 3, 2]);
  });

  it('FE-PLANNER-FOCUS-015: the end of the day takes a drop, onto the end of the day', () => {
    setup();
    dropOn(within(agenda()).getByText('trip.focus.dropHere'), placeDrag(24));
    expect(handlers.onAssignToDay).toHaveBeenCalledWith(24, 10, undefined);
  });

  it('FE-PLANNER-FOCUS-016: a stop time is changed in place, and the editor can move it to another day', () => {
    setup();
    fireEvent.click(within(agenda()).getAllByRole('button', { name: 'trip.focus.editTime' })[0]);
    fireEvent.change(within(agenda()).getByLabelText('trip.focus.start'), { target: { value: '08:30' } });
    fireEvent.change(within(agenda()).getByLabelText('trip.focus.dayLabel'), { target: { value: '11' } });
    fireEvent.click(within(agenda()).getByRole('button', { name: 'common.save' }));
    expect(handlers.onSetTimes).toHaveBeenCalledWith(10, 1, { place_time: '08:30', end_time: '10:00' });
    expect(handlers.onMoveToDay).toHaveBeenCalledWith(1, 10, 11);
    fireEvent.click(within(agenda()).getAllByRole('button', { name: 'trip.focus.editTime' })[1]);
    fireEvent.click(within(agenda()).getByRole('button', { name: 'trip.focus.removeTime' }));
    expect(handlers.onSetTimes).toHaveBeenLastCalledWith(10, 2, { place_time: null, end_time: null });
  });
});
