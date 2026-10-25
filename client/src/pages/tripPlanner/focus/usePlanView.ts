import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';

const STORAGE_KEY = 'plannerView';

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'focus';
  } catch {
    return false;
  }
}

function writeStored(focus: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, focus ? 'focus' : 'map');
  } catch {
    // Private mode: the choice holds for this visit only.
  }
}

/**
 * Which face the desktop Plan tab shows: the map with its floating panels, or
 * the focus workspace. Remembered per browser like the panel widths, and
 * `?view=focus` / `?view=map` opens a trip in either (a bookmark, a shared link).
 *
 * Where focus has no room (the phone shell, road trip mode) the map shows, and
 * the stored choice is kept for the next trip.
 */
export function usePlanView(available: boolean) {
  const [searchParams] = useSearchParams();
  const [focus, setFocus] = useState(() => {
    const asked = searchParams.get('view');
    if (asked === 'focus' || asked === 'map') writeStored(asked === 'focus');
    return asked ? asked === 'focus' : readStored();
  });
  const choose = useCallback((next: 'map' | 'focus') => {
    writeStored(next === 'focus');
    setFocus(next === 'focus');
  }, []);
  return { available, active: available && focus, choose };
}

export type PlanView = ReturnType<typeof usePlanView>;
