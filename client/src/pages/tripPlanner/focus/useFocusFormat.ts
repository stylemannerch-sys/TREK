import { formatDurationShort } from '@trek/shared/roadtrip';
import { useCallback } from 'react';

import { useTranslation } from '../../../i18n';
import { useSettingsStore } from '../../../store/settingsStore';
import { formatClockTime } from '../../../utils/formatters';
import { clock } from './focusModel';

/** Clock times, durations and day labels as the user reads them elsewhere in the planner. */
export function useFocusFormat() {
  const { locale } = useTranslation();
  const is12h = useSettingsStore((s) => s.settings.time_format) === '12h';
  const time = useCallback((minutes: number) => formatClockTime(clock(minutes), is12h), [is12h]);
  const duration = useCallback((minutes: number) => formatDurationShort(minutes * 60), []);
  const date = useCallback(
    (iso: string | null | undefined, style: 'weekday' | 'full') => {
      if (!iso) return '';
      const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleDateString(
        locale,
        style === 'weekday' ? { weekday: 'short' } : { weekday: 'short', day: 'numeric', month: 'short' }
      );
    },
    [locale]
  );
  return { time, duration, date };
}
