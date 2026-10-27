import { BedDouble, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useState } from 'react';

import { useTranslation } from '../../../i18n';
import { FocusDayEndDrop, FocusGapRow, FocusLegRow, FocusStopRow } from './FocusAgendaRows';
import { FocusChip } from './FocusChip';
import { FocusFreeSlots } from './FocusFreeSlots';
import { FocusGapPicker } from './FocusGapPicker';
import { clock } from './focusModel';
import { useFocusFormat } from './useFocusFormat';
import type { FocusWorkspaceState } from './useFocusWorkspace';

interface FocusDayAgendaProps {
  ws: FocusWorkspaceState;
  canEdit: boolean;
  onPlaceClick: (placeId: number, assignmentId?: number) => void;
}

const NAV_BUTTON =
  'flex size-11 shrink-0 items-center justify-center rounded-xl border border-edge text-content hover:bg-surface-hover disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

function AgendaHeader({ ws }: { ws: FocusWorkspaceState }) {
  const { t } = useTranslation();
  const fmt = useFocusFormat();
  const free = ws.agendaFilter === 'free';
  const index = ws.day ? ws.days.findIndex((d) => d.id === ws.day?.id) : -1;
  const go = (step: number) => {
    const next = ws.days[index + step];
    if (next) ws.selectDay(next.id);
  };
  return (
    <div className="sticky top-0 z-10 rounded-t-2xl border-b border-edge bg-surface-card">
      <div className="flex items-center gap-3 px-6 pb-3 pt-4">
        <button
          type="button"
          className={NAV_BUTTON}
          aria-label={t('trip.focus.prevDay')}
          disabled={free || index <= 0}
          onClick={() => go(-1)}
        >
          <ChevronLeft size={18} aria-hidden className="rtl:-scale-x-100" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-title font-semibold text-content">
            {free
              ? t('trip.focus.freeSlotsTitle')
              : [t('dayplan.dayN', { n: ws.dayNumber }), fmt.date(ws.day?.date, 'full')].filter(Boolean).join(' · ')}
          </h2>
          {!free && ws.day?.title && <div className="truncate text-body text-content-muted">{ws.day.title}</div>}
        </div>
        <button
          type="button"
          className={NAV_BUTTON}
          aria-label={t('trip.focus.nextDay')}
          disabled={free || index < 0 || index >= ws.days.length - 1}
          onClick={() => go(1)}
        >
          <ChevronRight size={18} aria-hidden className="rtl:-scale-x-100" />
        </button>
      </div>
      <div role="group" aria-label={t('trip.focus.filterDay')} className="flex flex-wrap gap-1.5 px-6 pb-3">
        <FocusChip on={ws.agendaFilter === 'all'} onClick={() => ws.setAgendaFilter('all')}>
          {`${t('trip.focus.wholeDay')} · ${ws.totalStops}`}
        </FocusChip>
        {ws.dayCategories.map(({ category, count }) => (
          <FocusChip
            key={category.id}
            on={ws.agendaFilter === category.id}
            dot={category.color}
            onClick={() => ws.setAgendaFilter(category.id)}
          >
            {`${category.name} · ${count}`}
          </FocusChip>
        ))}
        <FocusChip on={free} onClick={() => ws.setAgendaFilter('free')}>
          <Clock size={14} aria-hidden />
          {t('trip.focus.freeSlots')}
        </FocusChip>
      </div>
    </div>
  );
}

function StayLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 py-2 text-body text-content-muted">
      <BedDouble size={16} aria-hidden />
      {text}
    </div>
  );
}

function DayRows({ ws, canEdit, onPlaceClick }: FocusDayAgendaProps) {
  const { t } = useTranslation();
  const filtered = typeof ws.agendaFilter === 'number' ? ws.categoryById.get(ws.agendaFilter) : undefined;
  return (
    <div className="px-6 pb-2 pt-3">
      {filtered && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-surface-secondary px-3 py-2 text-body text-content-secondary">
          <span className="flex-1">{t('trip.focus.filteredBy', { category: filtered.name })}</span>
          <button
            type="button"
            onClick={() => ws.setAgendaFilter('all')}
            className="rounded-lg border border-edge bg-surface-card px-2.5 py-1 text-caption font-semibold text-content"
          >
            {t('trip.focus.showWholeDay')}
          </button>
        </div>
      )}
      {!filtered && ws.stays.from && (
        <StayLine
          text={t('trip.focus.startFrom', { name: ws.stays.from.place_name || ws.stays.from.reservation_title || '' })}
        />
      )}
      {ws.totalStops === 0 && (
        <div className="my-2 rounded-2xl border-2 border-dashed border-edge px-5 py-7 text-center">
          <div className="text-subtitle font-semibold text-content">{t('trip.focus.emptyDayTitle')}</div>
          <p className="mt-1.5 text-body text-content-muted">{t('trip.focus.emptyDayHint')}</p>
        </div>
      )}
      <ol className="flex flex-col">
        {ws.rows.map((row) => (
          <li key={row.key}>
            {row.kind === 'stop' && (
              <FocusStopRow
                ws={ws}
                stop={row}
                category={row.categoryId != null ? ws.categoryById.get(row.categoryId) : undefined}
                canEdit={canEdit}
                onOpen={onPlaceClick}
              />
            )}
            {row.kind === 'leg' && <FocusLegRow leg={row} />}
            {row.kind === 'gap' && (
              <>
                <FocusGapRow ws={ws} gap={row} canEdit={canEdit} />
                {canEdit && ws.gap?.key === row.key && <FocusGapPicker ws={ws} gap={row} />}
              </>
            )}
          </li>
        ))}
      </ol>
      {!filtered && <FocusDayEndDrop ws={ws} canEdit={canEdit} />}
      {!filtered && ws.stays.night && (
        <StayLine
          text={t('trip.focus.nightAt', { name: ws.stays.night.place_name || ws.stays.night.reservation_title || '' })}
        />
      )}
    </div>
  );
}

const minutesOf = (value: string) => {
  const [h, m] = value.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

/** What free time is counted against, said where it shows, and changed in place. */
function DayWindowLine({ ws }: { ws: FocusWorkspaceState }) {
  const { t } = useTranslation();
  const fmt = useFocusFormat();
  const [editing, setEditing] = useState(false);
  const { window, change } = ws.dayWindow;
  const field = (label: string, value: number, apply: (m: number) => void) => (
    <label className="flex items-center gap-2 text-caption text-content-secondary">
      {label}
      <input
        type="time"
        step={900}
        value={clock(value)}
        onChange={(e) => {
          const m = minutesOf(e.target.value);
          if (m != null) apply(m);
        }}
        className="rounded-lg border border-edge bg-surface-input px-2 py-1 text-body text-content"
      />
    </label>
  );
  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        {field(t('trip.focus.dayStart'), window.start, (start) => change({ ...window, start }))}
        {field(t('trip.focus.dayEnd'), window.end, (end) => change({ ...window, end }))}
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-lg border border-edge bg-surface-card px-2.5 py-1 text-caption font-semibold text-content"
        >
          {t('common.close')}
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-caption text-content-muted">
      <span>{t('trip.focus.dayWindow', { from: fmt.time(window.start), to: fmt.time(window.end) })}</span>
      <button type="button" onClick={() => setEditing(true)} className="font-semibold text-accent hover:underline">
        {t('common.change')}
      </button>
    </div>
  );
}

function DaySummary({ ws }: { ws: FocusWorkspaceState }) {
  const { t } = useTranslation();
  const fmt = useFocusFormat();
  const load = ws.load && ws.load.stops > 0 ? ws.load : null;
  const parts = load
    ? [
        t('trip.focus.planned', { time: fmt.duration(load.busy) }),
        load.travel > 0 ? t('trip.focus.travel', { time: fmt.duration(load.travel) }) : null,
        load.free > 0 ? t('trip.focus.free', { time: fmt.duration(load.free) }) : null,
      ].filter((p): p is string => p != null)
    : [];
  return (
    <div className="flex flex-col gap-2 rounded-b-2xl border-t border-edge bg-surface-secondary px-6 py-3.5">
      {parts.length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-body text-content-secondary">
          {parts.map((p) => (
            <span key={p}>{p}</span>
          ))}
        </div>
      )}
      <DayWindowLine ws={ws} />
    </div>
  );
}

/** The middle of the workspace: one day as a schedule, or every free slot of the trip. */
export function FocusDayAgenda(props: FocusDayAgendaProps) {
  const { ws } = props;
  return (
    <section className="flex min-w-0 max-w-3xl flex-1 flex-col overflow-y-auto rounded-2xl border border-edge bg-surface-card">
      <AgendaHeader ws={ws} />
      {ws.agendaFilter === 'free' ? (
        <FocusFreeSlots ws={ws} />
      ) : (
        <>
          <DayRows {...props} />
          <div className="mt-auto">
            <DaySummary ws={ws} />
          </div>
        </>
      )}
    </section>
  );
}
