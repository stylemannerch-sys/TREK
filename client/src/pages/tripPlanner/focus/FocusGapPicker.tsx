import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useTranslation } from '../../../i18n';
import type { FocusGap } from './focusModel';
import { useFocusFormat } from './useFocusFormat';
import type { FocusWorkspaceState } from './useFocusWorkspace';

/**
 * Filling one gap, right under it: the nearby places on no day yet that fit
 * the free time with the way there and back, or any that fit and match a
 * search. Each one goes into the gap with one button. The whole trip stays in
 * the Places panel beside the agenda.
 */
export function FocusGapPicker({ ws, gap }: { ws: FocusWorkspaceState; gap: FocusGap }) {
  const { t } = useTranslation();
  const fmt = useFocusFormat();
  const [text, setText] = useState('');
  const choices = useMemo(() => ws.gapChoices(text), [ws, text]);
  return (
    <div className="mb-2 ms-20 flex flex-col gap-2 rounded-xl border border-edge bg-surface-secondary p-3">
      <div className="text-caption text-content-secondary">
        {t('trip.focus.gapHint', { day: ws.dayNumber, from: fmt.time(gap.from), to: fmt.time(gap.to) })}
      </div>
      <label className="flex min-h-10 items-center gap-2 rounded-lg border border-edge bg-surface-input px-3 focus-within:border-accent">
        <Search size={15} aria-hidden className="shrink-0 text-content-faint" />
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('places.search')}
          aria-label={t('places.search')}
          className="min-w-0 flex-1 bg-transparent text-body text-content outline-none placeholder:text-content-faint"
        />
      </label>
      {choices.length === 0 ? (
        <p className="px-1 py-2 text-body text-content-muted">{t('trip.focus.trayEmptyGap')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {choices.map(({ place }) => {
            const category = place.category_id != null ? ws.categoryById.get(place.category_id) : undefined;
            return (
              <li key={place.id} className="flex items-center gap-2.5 rounded-lg bg-surface-card px-3 py-2">
                {category && (
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: category.color }} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-body font-semibold text-content">{place.name}</div>
                  <div className="truncate text-caption text-content-muted">
                    {[category?.name, place.duration_minutes ? fmt.duration(place.duration_minutes) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={t('trip.focus.addToAria', { name: place.name, day: ws.dayNumber })}
                  onClick={() => void ws.addPlace(place.id)}
                  className="inline-flex h-9 min-w-11 shrink-0 items-center justify-center gap-1 rounded-lg bg-accent px-3 text-caption font-semibold text-accent-text hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <Plus size={14} aria-hidden />
                  {fmt.time(gap.from + 10)}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
