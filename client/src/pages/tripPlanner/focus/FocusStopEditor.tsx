import { useState } from 'react';

import { useTranslation } from '../../../i18n';
import { clock, type FocusStop } from './focusModel';
import { useFocusFormat } from './useFocusFormat';
import type { FocusWorkspaceState } from './useFocusWorkspace';

const minutesOf = (value: string): number | null => {
  const [h, m] = value.split(':').map(Number);
  return value && Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

const FIELD = 'rounded-lg border border-edge bg-surface-input px-2 py-1 text-body text-content';
const BUTTON = 'rounded-lg border border-edge px-3 py-1.5 text-caption font-semibold';

/**
 * A stop's time and day, changed in place: start and end (an end before the
 * start is dropped), no time at all, or another day of the trip. The same
 * writes the planner makes from its own time field and day menu.
 */
export function FocusStopEditor({
  ws,
  stop,
  onDone,
}: {
  ws: FocusWorkspaceState;
  stop: FocusStop;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const fmt = useFocusFormat();
  const dayId = ws.day?.id ?? 0;
  const [start, setStart] = useState(stop.start != null ? clock(stop.start) : '');
  const [end, setEnd] = useState(stop.end != null && stop.start != null ? clock(stop.end) : '');
  const [toDay, setToDay] = useState(dayId);
  const save = () => {
    // Times first: the write finds the stop on the day it is on now, before a move takes it elsewhere.
    ws.setStopTimes(dayId, stop, minutesOf(start), minutesOf(end));
    if (toDay !== dayId) ws.moveStop(dayId, stop, toDay);
    onDone();
  };
  return (
    <div className="mb-2 ms-20 flex flex-wrap items-end gap-3 rounded-xl border border-edge bg-surface-secondary p-3">
      <label className="flex flex-col gap-1 text-caption text-content-secondary">
        {t('trip.focus.start')}
        <input type="time" step={300} value={start} onChange={(e) => setStart(e.target.value)} className={FIELD} />
      </label>
      <label className="flex flex-col gap-1 text-caption text-content-secondary">
        {t('trip.focus.end')}
        <input type="time" step={300} value={end} onChange={(e) => setEnd(e.target.value)} className={FIELD} />
      </label>
      <label className="flex flex-col gap-1 text-caption text-content-secondary">
        {t('trip.focus.dayLabel')}
        <select value={toDay} onChange={(e) => setToDay(Number(e.target.value))} className={FIELD}>
          {ws.days.map((d, i) => (
            <option key={d.id} value={d.id}>
              {[t('dayplan.dayN', { n: i + 1 }), fmt.date(d.date, 'full')].filter(Boolean).join(' · ')}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} className={`${BUTTON} border-accent bg-accent text-accent-text`}>
          {t('common.save')}
        </button>
        <button type="button" onClick={onDone} className={`${BUTTON} bg-surface-card text-content`}>
          {t('common.cancel')}
        </button>
        {stop.start != null && (
          <button
            type="button"
            onClick={() => {
              ws.setStopTimes(dayId, stop, null, null);
              onDone();
            }}
            className={`${BUTTON} bg-surface-card text-content-secondary`}
          >
            {t('trip.focus.removeTime')}
          </button>
        )}
      </div>
    </div>
  );
}
