import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { SpotSummary } from '../../shared/types';
import { text } from '../config/text';
import { distanceMiles, formatDistance, type LatLng } from '../lib/geo';
import { SpotCard } from './SpotCard';

interface Props {
  spots: SpotSummary[];
  userLocation: LatLng | null;
  /** Shown instead of the list when there are no spots (empty or error message). */
  emptyMessage?: string;
  /** Floats above the sheet's top-right corner and moves with it (the "+" button). */
  action?: ReactNode;
}

// A drag shorter than this (pixels) on the handle counts as a tap.
const DRAG_THRESHOLD = 30;

export function SpotDrawer({ spots, userLocation, emptyMessage, action }: Props): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const dragStart = useRef<number | null>(null);

  const rows = useMemo(() => {
    const withDistance = spots.map((spot) => ({
      spot,
      miles: userLocation ? distanceMiles(userLocation, spot) : null,
    }));
    if (userLocation) withDistance.sort((a, b) => (a.miles ?? 0) - (b.miles ?? 0));
    return withDistance;
  }, [spots, userLocation]);

  // A drag on the handle opens or closes the sheet by direction. A tap (or Enter/Space)
  // arrives as a click and toggles it; the click that follows a drag is ignored.
  const dragged = useRef(false);
  const onPointerUp = (y: number): void => {
    const start = dragStart.current;
    dragStart.current = null;
    if (start === null) return;
    const dy = y - start;
    dragged.current = Math.abs(dy) > DRAG_THRESHOLD;
    if (dragged.current) setExpanded(dy < 0);
  };
  const onClick = (): void => {
    if (dragged.current) dragged.current = false;
    else setExpanded((e) => !e);
  };

  return (
    <section
      className={`absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-2xl bg-surface shadow-sheet transition-[height] duration-300 ${
        expanded ? 'h-[75dvh]' : 'h-60'
      }`}
    >
      {action && <div className="absolute -top-16 right-4">{action}</div>}
      <button
        type="button"
        aria-label={expanded ? text.drawer.collapse : text.drawer.expand}
        aria-expanded={expanded}
        className="flex w-full touch-none justify-center py-3"
        onPointerDown={(e) => {
          dragStart.current = e.clientY;
          dragged.current = false;
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onPointerUp={(e) => onPointerUp(e.clientY)}
        onPointerCancel={() => {
          dragStart.current = null;
        }}
        onClick={onClick}
      >
        <span className="h-1 w-9 rounded-full bg-ink-muted opacity-40" />
      </button>
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-muted">{emptyMessage}</p>
        ) : (
          rows.map(({ spot, miles }) => (
            <SpotCard key={spot.id} spot={spot} variant="row" distance={miles === null ? undefined : formatDistance(miles)} />
          ))
        )}
      </div>
    </section>
  );
}
