import { Link } from 'react-router-dom';
import type { SpotSummary } from '../../shared/types';
import { icons } from '../config/icons';
import { text } from '../config/text';
import { DumplingRating } from './DumplingRating';

interface Props {
  spot: SpotSummary;
  variant: 'row' | 'card';
  distance?: string;
}

function Distance({ value }: { value?: string }): JSX.Element | null {
  return value ? <span className="text-xs text-ink-muted">{value}</span> : null;
}

function Row({ spot, distance }: Omit<Props, 'variant'>): JSX.Element {
  const want = spot.status === 'want';
  return (
    <Link to={`/spot/${spot.id}`} className="flex gap-3 border-b border-surface-muted py-2 last:border-b-0">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg ${
          want ? 'border border-dashed border-ink-muted bg-surface-muted' : 'bg-tag'
        }`}
      >
        {spot.coverPhoto ? (
          <img src={spot.coverPhoto.url} alt="" className="h-full w-full object-cover" />
        ) : (
          <img src={want ? icons.pinWant : icons.rating} alt="" className="h-6 w-6" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold text-ink">{spot.name}</div>
        <div className="flex items-center gap-2">
          {want ? <span className="text-xs text-ink-muted">{text.wantToGo}</span> : <DumplingRating value={spot.rating} />}
          <Distance value={distance} />
        </div>
        {spot.notes && <div className="truncate text-xs text-ink-muted">{spot.notes}</div>}
      </div>
    </Link>
  );
}

function Card({ spot, distance }: Omit<Props, 'variant'>): JSX.Element {
  const want = spot.status === 'want';
  return (
    <Link to={`/spot/${spot.id}`} className="block overflow-hidden rounded-card bg-surface shadow-sm">
      {spot.coverPhoto ? (
        <img src={spot.coverPhoto.url} alt="" className="h-40 w-full object-cover" />
      ) : (
        <div className="flex h-24 items-center justify-center bg-surface-muted text-sm text-ink-muted">
          {want ? text.wantToGo : <img src={icons.rating} alt="" className="h-10 w-10 opacity-60" />}
        </div>
      )}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-bold text-ink">{spot.name}</span>
          {!want && <DumplingRating value={spot.rating} />}
        </div>
        <div className="flex gap-2 text-xs text-ink-muted">
          {spot.visitedOn && <span className="shrink-0">{text.formatVisitDate(spot.visitedOn)}</span>}
          {spot.notes && <span className="truncate">{spot.notes}</span>}
          <Distance value={distance} />
        </div>
      </div>
    </Link>
  );
}

export function SpotCard({ variant, ...rest }: Props): JSX.Element {
  return variant === 'row' ? <Row {...rest} /> : <Card {...rest} />;
}
