import { useTranslation } from '../../../i18n';
import { FULL_DAY_MINUTES } from './focusModel';
import { useFocusFormat } from './useFocusFormat';
import type { FocusWorkspaceState } from './useFocusWorkspace';

/** The whole trip at a glance: one row per day with how full it is, and a way into it. */
export function FocusTripRail({ ws }: { ws: FocusWorkspaceState }) {
  const { t } = useTranslation();
  const fmt = useFocusFormat();
  return (
    <nav aria-label={t('trip.focus.days')} className="flex w-60 shrink-0 flex-col gap-2 overflow-y-auto pe-1">
      <div className="px-1 text-caption font-semibold uppercase tracking-[0.08em] text-content-faint">
        {t('trip.focus.days')}
      </div>
      {ws.days.map((d, i) => {
        const load = ws.loads.get(d.id);
        const empty = !load || load.stops === 0;
        const busy = load ? load.busy + load.travel : 0;
        const selected = d.id === ws.day?.id && ws.agendaFilter !== 'free';
        return (
          <button
            key={d.id}
            type="button"
            aria-current={selected ? 'true' : undefined}
            onClick={() => ws.selectDay(d.id)}
            className={`rounded-xl border px-3 py-2.5 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
              selected ? 'border-accent bg-surface-selected' : 'border-edge bg-surface-card hover:bg-surface-hover'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 shrink-0 text-center">
                <div className="text-subtitle font-semibold leading-none text-content">{i + 1}</div>
                <div className="mt-0.5 text-caption text-content-muted">{fmt.date(d.date, 'weekday')}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-body font-semibold text-content">
                  {d.title || fmt.date(d.date, 'full')}
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-tertiary">
                  <div
                    className={`h-full rounded-full ${load?.full ? 'bg-warning' : 'bg-accent'}`}
                    style={{ width: `${Math.min(100, Math.round((busy / (FULL_DAY_MINUTES + 90)) * 100))}%` }}
                  />
                </div>
                <div className="mt-1 text-caption text-content-muted">
                  {empty
                    ? t('trip.focus.nothingPlanned')
                    : [
                        t('trip.focus.busy', { time: fmt.duration(busy) }),
                        load && load.free > 0 ? t('trip.focus.free', { time: fmt.duration(load.free) }) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </div>
              </div>
              {empty && (
                <span className="rounded-md border border-dashed border-edge px-1.5 text-caption font-semibold text-content-muted">
                  {t('trip.focus.emptyBadge')}
                </span>
              )}
            </div>
          </button>
        );
      })}
      <p className="px-1 text-caption text-content-muted">{t('trip.focus.fullHint')}</p>
    </nav>
  );
}
