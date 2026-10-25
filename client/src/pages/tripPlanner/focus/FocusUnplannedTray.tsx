import { Plus, X } from 'lucide-react';

import { useTranslation } from '../../../i18n';
import { FocusChip } from './FocusChip';
import { useFocusFormat } from './useFocusFormat';
import type { FocusWorkspaceState } from './useFocusWorkspace';

/**
 * The places on no day yet, nearest to the selected day first. Each one goes
 * onto the day with one button, into the picked gap when there is one. Beside
 * the agenda on a wide screen, a drawer over it on a narrower one.
 */
export function FocusUnplannedTray({ ws, canEdit }: { ws: FocusWorkspaceState; canEdit: boolean }) {
  const { t } = useTranslation();
  const fmt = useFocusFormat();
  const empty =
    ws.unplannedCount === 0
      ? t('trip.focus.allPlanned')
      : ws.gap
        ? t('trip.focus.trayEmptyGap')
        : t('trip.focus.trayEmpty');
  return (
    <aside
      aria-label={t('trip.focus.trayTitle')}
      className={`${ws.trayOpen ? 'flex' : 'hidden'} absolute inset-y-4 end-4 z-30 w-80 flex-col overflow-y-auto rounded-2xl border border-edge bg-surface-card shadow-elevated lg:static lg:flex lg:shrink-0 lg:shadow-none`}
    >
      <div className="sticky top-0 z-10 flex flex-col gap-2.5 rounded-t-2xl border-b border-edge bg-surface-card px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-subtitle font-semibold text-content">{t('trip.focus.trayTitle')}</h2>
          <span className="text-caption text-content-muted">{ws.unplannedCount}</span>
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={() => ws.setTrayOpen(false)}
            className="ms-auto flex size-9 items-center justify-center rounded-lg text-content-muted hover:bg-surface-hover lg:hidden"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        {ws.gap && ws.day && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-accent-subtle px-3 py-2 text-body text-content">
            <span className="flex-1">
              {t('trip.focus.gapHint', { day: ws.dayNumber, from: fmt.time(ws.gap.from), to: fmt.time(ws.gap.to) })}
            </span>
            <button
              type="button"
              onClick={() => ws.toggleGap(ws.gap?.key ?? '')}
              className="rounded-lg border border-edge bg-surface-card px-2.5 py-1 text-caption font-semibold text-content"
            >
              {t('trip.focus.showAll')}
            </button>
          </div>
        )}
        <div role="group" aria-label={t('trip.focus.trayFilter')} className="flex flex-wrap gap-1.5">
          <FocusChip on={ws.trayFilter === 'near' || !!ws.gap} onClick={() => ws.chooseTrayFilter('near')}>
            {`${t('trip.focus.near', { day: ws.dayNumber })} · ${ws.nearCount}`}
          </FocusChip>
          {ws.trayCategories.map(({ category, count }) => (
            <FocusChip
              key={category.id}
              on={!ws.gap && ws.trayFilter === category.id}
              dot={category.color}
              onClick={() => ws.chooseTrayFilter(category.id)}
            >
              {`${category.name} · ${count}`}
            </FocusChip>
          ))}
          <FocusChip on={!ws.gap && ws.trayFilter === 'all'} onClick={() => ws.chooseTrayFilter('all')}>
            {`${t('common.all')} · ${ws.unplannedCount}`}
          </FocusChip>
        </div>
      </div>
      <ul className="flex flex-col gap-2 px-4 pb-4 pt-3">
        {ws.tray.map(({ place }) => {
          const category = place.category_id != null ? ws.categoryById.get(place.category_id) : undefined;
          return (
            <li key={place.id} className="flex items-center gap-2.5 rounded-xl border border-edge px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-body font-semibold text-content">{place.name}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-caption text-content-muted">
                  {category && (
                    <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: category.color }} />
                  )}
                  <span className="truncate">
                    {[category?.name, place.duration_minutes ? fmt.duration(place.duration_minutes) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              </div>
              {canEdit && ws.day && (
                <button
                  type="button"
                  aria-label={t('trip.focus.addToAria', { name: place.name, day: ws.dayNumber })}
                  onClick={() => void ws.addPlace(place.id)}
                  className="inline-flex h-10 min-w-11 shrink-0 items-center gap-1 rounded-lg bg-accent px-3 text-caption font-semibold text-accent-text hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <Plus size={14} aria-hidden />
                  {t('dayplan.dayN', { n: ws.dayNumber })}
                </button>
              )}
            </li>
          );
        })}
        {ws.tray.length === 0 && <li className="px-2 py-4 text-center text-body text-content-muted">{empty}</li>}
      </ul>
    </aside>
  );
}
