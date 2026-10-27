import { useCallback, useState } from 'react';

import { DEFAULT_DAY_WINDOW, type DayWindow } from './focusModel';

const keyOf = (tripId: number | string) => `plannerDayWindow:${tripId}`;

function read(tripId: number | string): DayWindow {
  try {
    const raw = localStorage.getItem(keyOf(tripId));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as DayWindow).start === 'number' &&
      typeof (parsed as DayWindow).end === 'number' &&
      (parsed as DayWindow).start < (parsed as DayWindow).end
    ) {
      return parsed as DayWindow;
    }
  } catch {
    // Unreadable or private mode: the default window holds.
  }
  return DEFAULT_DAY_WINDOW;
}

/**
 * The hours of a day the traveller plans with on this trip (09:00–21:00 unless
 * changed), which is what free time is counted against. Kept per trip in this
 * browser, beside the panel widths and the Map | Focus choice.
 */
export function useDayWindow(tripId: number | string) {
  const [current, setCurrent] = useState<DayWindow>(() => read(tripId));
  const change = useCallback(
    (next: DayWindow) => {
      if (next.start >= next.end) return;
      setCurrent(next);
      try {
        localStorage.setItem(keyOf(tripId), JSON.stringify(next));
      } catch {
        // Private mode: the window holds for this visit only.
      }
    },
    [tripId]
  );
  return { window: current, change };
}
