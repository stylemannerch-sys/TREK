import { useTranslation } from '../../../i18n';
import { useFocusFormat } from './useFocusFormat';
import type { FocusWorkspaceState } from './useFocusWorkspace';

/** Every gap of an hour or more across the trip, and every empty day, each a way into filling it. */
export function FocusFreeSlots({ ws }: { ws: FocusWorkspaceState }) {
  const { t } = useTranslation();
  const fmt = useFocusFormat();
  const dayById = new Map(ws.days.map((d, i) => [d.id, { day: d, number: i + 1 }]));
  return (
    <div className="flex flex-col gap-2 px-6 pb-6 pt-4">
      <p className="mb-1 text-body text-content-muted">{t('trip.focus.freeSlotsIntro')}</p>
      {ws.slots.length === 0 && <p className="text-body text-content-muted">{t('trip.focus.noFreeSlots')}</p>}
      {ws.slots.map((slot) => {
        const entry = dayById.get(slot.dayId);
        if (!entry) return null;
        const { gap } = slot;
        return (
          <button
            key={slot.key}
            type="button"
            onClick={() => ws.pickSlot(slot)}
            className="flex min-h-14 w-full items-center gap-4 rounded-xl border-2 border-dashed border-edge px-3.5 py-2.5 text-start hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <div className="w-16 shrink-0">
              <div className="text-body font-semibold text-content">{t('dayplan.dayN', { n: entry.number })}</div>
              <div className="text-caption text-content-muted">{fmt.date(entry.day.date, 'weekday')}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-body font-semibold text-content">
                {gap ? `${fmt.time(gap.from)} – ${fmt.time(gap.to)}` : t('trip.focus.wholeDayFree')}
              </div>
              <div className="truncate text-caption text-content-muted">
                {gap
                  ? gap.afterName && gap.beforeName
                    ? t('trip.focus.between', { after: gap.afterName, before: gap.beforeName })
                    : gap.beforeName
                      ? t('trip.focus.freeBefore', { before: gap.beforeName })
                      : t('trip.focus.freeAfter', { after: gap.afterName })
                  : entry.day.title || fmt.date(entry.day.date, 'full')}
              </div>
            </div>
            {gap && (
              <span className="rounded-lg bg-accent-subtle px-2 py-1 text-caption font-semibold text-accent">
                {fmt.duration(gap.to - gap.from)}
              </span>
            )}
            <span className="text-caption font-semibold text-accent">{t('trip.focus.fill')}</span>
          </button>
        );
      })}
    </div>
  );
}
