import { Link } from 'react-router-dom';
import type { SpotSummary } from '../../shared/types';
import { text } from '../config/text';
import { directionsUrl } from '../lib/directions';
import { SpotCard } from './SpotCard';

interface Props {
  spot: SpotSummary;
  distance?: string;
  onClose: () => void;
}

const BUTTON = 'flex-1 rounded-card px-3 py-2 text-center font-semibold';

/** The card that slides up when a pin is tapped: a quick look, directions, and a link to the full page. */
export function SpotPreview({ spot, distance, onClose }: Props): JSX.Element {
  return (
    <section
      aria-label={spot.name}
      className="absolute inset-x-0 bottom-0 z-10 rounded-t-2xl bg-surface px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-sheet"
    >
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <SpotCard spot={spot} variant="row" distance={distance} />
        </div>
        <button
          type="button"
          aria-label={text.pinCard.close}
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted"
        >
          <span aria-hidden="true">{text.pinCard.closeSymbol}</span>
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <a href={directionsUrl(spot.lat, spot.lng)} target="_blank" rel="noreferrer" className={`${BUTTON} bg-primary text-primary-contrast`}>
          {text.spot.directions}
        </a>
        <Link to={`/spot/${spot.id}`} className={`${BUTTON} border border-primary text-primary`}>
          {text.pinCard.details}
        </Link>
      </div>
    </section>
  );
}
