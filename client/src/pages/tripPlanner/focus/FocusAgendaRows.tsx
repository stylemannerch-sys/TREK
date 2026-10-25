import { Footprints, Lock, PlusCircle, TrainFront } from 'lucide-react';

import { useTranslation } from '../../../i18n';
import type { Category } from '../../../types';
import type { FocusGap, FocusLeg, FocusStop } from './focusModel';
import { useFocusFormat } from './useFocusFormat';

interface StopRowProps {
  stop: FocusStop;
  category: Category | undefined;
  canEdit: boolean;
  onOpen: (placeId: number, assignmentId: number) => void;
  onApplySuggestion: (stop: FocusStop) => void;
}

/** One stop: its time on the left, then what it is, how long, and its notes in full. */
export function FocusStopRow({ stop, category, canEdit, onOpen, onApplySuggestion }: StopRowProps) {
  const { t } = useTranslation();
  const fmt = useFocusFormat();
  const canSuggest = canEdit && stop.start == null && stop.suggested != null && stop.assignmentId > 0;
  return (
    <div className={`flex gap-4 rounded-xl px-3 py-2.5 ${stop.booked ? 'bg-accent-subtle' : ''}`}>
      <div className="w-16 shrink-0 pt-0.5 text-end">
        {stop.start != null ? (
          <>
            <div className="text-body font-semibold text-content">{fmt.time(stop.start)}</div>
            {stop.end != null && <div className="text-caption text-content-muted">{fmt.time(stop.end)}</div>}
          </>
        ) : (
          <div className="text-caption text-content-faint">{t('trip.focus.noTime')}</div>
        )}
      </div>
      <div
        aria-hidden
        className="w-1 shrink-0 rounded-full bg-edge"
        style={category ? { background: category.color } : undefined}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button
            type="button"
            onClick={() => onOpen(stop.placeId, stop.assignmentId)}
            className="text-start text-body font-semibold text-content hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {stop.name}
          </button>
          {stop.booked && (
            <span className="inline-flex items-center gap-1 rounded-md bg-surface-card px-1.5 py-0.5 text-caption font-semibold text-accent">
              <Lock size={12} aria-hidden />
              {t('trip.focus.booked')}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-caption text-content-muted">
          {[category?.name, stop.minutes ? fmt.duration(stop.minutes) : null].filter(Boolean).join(' · ')}
        </div>
        {stop.notes && <p className="mt-1.5 whitespace-pre-line text-body text-content-secondary">{stop.notes}</p>}
        {canSuggest && (
          <button
            type="button"
            onClick={() => onApplySuggestion(stop)}
            className="mt-2 rounded-lg border border-edge px-2.5 py-1 text-caption font-semibold text-accent hover:bg-surface-hover"
          >
            {t('trip.focus.setTime', { time: fmt.time(stop.suggested ?? 0) })}
          </button>
        )}
      </div>
    </div>
  );
}

/** The way from one stop to the next, as an estimate: it is marked so, with how it was made. */
export function FocusLegRow({ leg }: { leg: FocusLeg }) {
  const { t } = useTranslation();
  const fmt = useFocusFormat();
  const Icon = leg.mode === 'walk' ? Footprints : TrainFront;
  return (
    <div className="flex items-center gap-4 px-3 text-caption text-content-muted">
      <div className="w-16 shrink-0" />
      <div
        className="flex items-center gap-1.5 border-s-2 border-dotted border-edge py-1.5 ps-5"
        title={t('trip.focus.estimateHint')}
      >
        <Icon size={14} aria-hidden />
        {t(leg.mode === 'walk' ? 'trip.focus.walk' : 'trip.focus.transit', { time: fmt.duration(leg.minutes) })}
      </div>
    </div>
  );
}

interface GapRowProps {
  gap: FocusGap;
  active: boolean;
  canEdit: boolean;
  onToggle: (key: string) => void;
}

/** Free time between two stops, as a target to drop a place into. */
export function FocusGapRow({ gap, active, canEdit, onToggle }: GapRowProps) {
  const { t } = useTranslation();
  const fmt = useFocusFormat();
  const label = t('trip.focus.gap', { time: fmt.duration(gap.to - gap.from), end: fmt.time(gap.to) });
  return (
    <div className="flex items-center gap-4 px-3 py-1">
      <div className="w-16 shrink-0 text-end text-caption text-content-muted">{fmt.time(gap.from)}</div>
      {canEdit ? (
        <button
          type="button"
          aria-pressed={active}
          onClick={() => onToggle(gap.key)}
          className={`flex min-h-11 flex-1 items-center gap-2 rounded-xl border-2 px-3.5 text-start text-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
            active
              ? 'border-solid border-accent bg-accent-subtle text-content'
              : 'border-dashed border-edge text-content-secondary hover:bg-surface-hover'
          }`}
        >
          <PlusCircle size={16} aria-hidden />
          <span>{label}</span>
          <span className="ms-auto font-semibold">{t(active ? 'trip.focus.pickPlace' : 'trip.focus.fillGap')}</span>
        </button>
      ) : (
        <div className="flex-1 rounded-xl border-2 border-dashed border-edge px-3.5 py-2.5 text-body text-content-secondary">
          {label}
        </div>
      )}
    </div>
  );
}
