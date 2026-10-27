import { Footprints, GripVertical, Lock, PlusCircle, TrainFront } from 'lucide-react';
import { useState } from 'react';

import { useTranslation } from '../../../i18n';
import type { Category } from '../../../types';
import { startStopDrag, useDropTarget } from './focusDrag';
import type { FocusGap, FocusLeg, FocusStop } from './focusModel';
import { FocusStopEditor } from './FocusStopEditor';
import { useFocusFormat } from './useFocusFormat';
import type { FocusWorkspaceState } from './useFocusWorkspace';

interface StopRowProps {
  ws: FocusWorkspaceState;
  stop: FocusStop;
  category: Category | undefined;
  canEdit: boolean;
  onOpen: (placeId: number, assignmentId: number) => void;
}

const LIT = 'ring-2 ring-accent';

/** The time column of a stop: its start and end, or that it has none; a button to change them when editing is allowed. */
function StopTime({ stop, onEdit }: { stop: FocusStop; onEdit?: () => void }) {
  const { t } = useTranslation();
  const fmt = useFocusFormat();
  const body =
    stop.start != null ? (
      <>
        <span className="block text-body font-semibold text-content">{fmt.time(stop.start)}</span>
        {stop.end != null && <span className="block text-caption text-content-muted">{fmt.time(stop.end)}</span>}
      </>
    ) : (
      <span className="block text-caption text-content-faint">{t('trip.focus.noTime')}</span>
    );
  if (!onEdit) return <div className="w-16 shrink-0 pt-0.5 text-end">{body}</div>;
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={t('trip.focus.editTime')}
      title={t('trip.focus.editTime')}
      className="-my-1 w-16 shrink-0 rounded-lg py-1 pe-1 text-end hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      {body}
    </button>
  );
}

interface StopDetailsProps {
  stop: FocusStop;
  category: Category | undefined;
  onOpen: (placeId: number, assignmentId: number) => void;
  onSuggest?: () => void;
}

/** What a stop is: its name (which opens it), booked or not, category and length, its notes, and a suggested start. */
function StopDetails({ stop, category, onOpen, onSuggest }: StopDetailsProps) {
  const { t } = useTranslation();
  const fmt = useFocusFormat();
  return (
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
      {onSuggest && (
        <button
          type="button"
          onClick={onSuggest}
          className="mt-2 rounded-lg border border-edge px-2.5 py-1 text-caption font-semibold text-accent hover:bg-surface-hover"
        >
          {t('trip.focus.setTime', { time: fmt.time(stop.suggested ?? 0) })}
        </button>
      )}
    </div>
  );
}

/**
 * One stop: its time on the left, then what it is, how long, and its notes in
 * full. With editing allowed it can be dragged (onto a gap, another stop or a
 * day in the rail), takes a drop right after it, and its time opens an editor.
 */
export function FocusStopRow({ ws, stop, category, canEdit, onOpen }: StopRowProps) {
  const [editing, setEditing] = useState(false);
  const dayId = ws.day?.id ?? 0;
  const draggable = canEdit && stop.assignmentId > 0;
  const drop = useDropTarget(canEdit ? (d) => ws.dropAt(dayId, stop.position + 1, d) : undefined);
  const canSuggest = canEdit && !editing && stop.start == null && stop.suggested != null && stop.assignmentId > 0;
  return (
    <>
      <div
        {...drop.props}
        draggable={draggable}
        onDragStart={draggable ? (e) => startStopDrag(e, stop.assignmentId, dayId) : undefined}
        className={`group flex gap-4 rounded-xl px-3 py-2.5 ${stop.booked ? 'bg-accent-subtle' : ''} ${drop.over ? LIT : ''} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <StopTime stop={stop} onEdit={canEdit ? () => setEditing((v) => !v) : undefined} />
        <div
          aria-hidden
          className="w-1 shrink-0 rounded-full bg-edge"
          style={category ? { background: category.color } : undefined}
        />
        <StopDetails
          stop={stop}
          category={category}
          onOpen={onOpen}
          onSuggest={canSuggest ? () => ws.applySuggestion(stop) : undefined}
        />
        {draggable && (
          <GripVertical
            size={16}
            aria-hidden
            className="mt-0.5 shrink-0 text-content-faint opacity-0 transition-opacity group-hover:opacity-100"
          />
        )}
      </div>
      {editing && <FocusStopEditor ws={ws} stop={stop} onDone={() => setEditing(false)} />}
    </>
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
  ws: FocusWorkspaceState;
  gap: FocusGap;
  canEdit: boolean;
}

/** Free time in the day: a button that opens what fits it, and a target for a place or stop dropped into it. */
export function FocusGapRow({ ws, gap, canEdit }: GapRowProps) {
  const { t } = useTranslation();
  const fmt = useFocusFormat();
  const active = ws.gap?.key === gap.key;
  const dayId = ws.day?.id ?? 0;
  const drop = useDropTarget(canEdit ? (d) => ws.dropAt(dayId, gap.position, d) : undefined);
  const label = t('trip.focus.gap', { time: fmt.duration(gap.to - gap.from), end: fmt.time(gap.to) });
  return (
    <div {...drop.props} className="flex items-center gap-4 px-3 py-1">
      <div className="w-16 shrink-0 text-end text-caption text-content-muted">{fmt.time(gap.from)}</div>
      {canEdit ? (
        <button
          type="button"
          aria-pressed={active}
          onClick={() => ws.toggleGap(gap.key)}
          className={`flex min-h-11 flex-1 items-center gap-2 rounded-xl border-2 px-3.5 text-start text-body focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
            active || drop.over
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

/** The end of the day as a drop target, so a place can go onto a day with no gap left, or none at all yet. */
export function FocusDayEndDrop({ ws, canEdit }: { ws: FocusWorkspaceState; canEdit: boolean }) {
  const { t } = useTranslation();
  const dayId = ws.day?.id ?? 0;
  const drop = useDropTarget(canEdit ? (d) => ws.dropAt(dayId, undefined, d) : undefined);
  if (!canEdit) return null;
  return (
    <div
      {...drop.props}
      className={`ms-20 mt-2 rounded-xl border-2 border-dashed px-4 py-3 text-center text-caption ${
        drop.over ? 'border-accent bg-accent-subtle text-content' : 'border-edge text-content-faint'
      }`}
    >
      {t('trip.focus.dropHere', { day: ws.dayNumber })}
    </div>
  );
}
