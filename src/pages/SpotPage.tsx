import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Spot } from '../../shared/types';
import { Header } from '../components/Header';
import { DumplingRating } from '../components/DumplingRating';
import { PhotoCarousel } from '../components/PhotoCarousel';
import { settings } from '../config/settings';
import { text } from '../config/text';
import { api } from '../lib/api';
import { useEditor } from '../lib/useEditor';

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'missing' } | { kind: 'ready'; spot: Spot };

const BUTTON = 'flex-1 rounded-card border border-primary px-3 py-2 text-center text-primary';
const BUTTON_SOLID = 'flex-1 rounded-card bg-primary px-3 py-2 text-center text-primary-contrast';

function BackLink(): JSX.Element {
  return (
    <Link to="/" aria-label={text.spot.backToMap} className="inline-block px-4 py-2 text-ink">
      <span aria-hidden="true">{text.spot.backSymbol}</span> {text.spot.backToMap}
    </Link>
  );
}

export function SpotPage(): JSX.Element {
  const { id = '' } = useParams();
  const { signedIn } = useEditor();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setState({ kind: 'loading' });
    api
      .getSpot(id)
      .then((spot) => active && setState(spot ? { kind: 'ready', spot } : { kind: 'missing' }))
      .catch(() => active && setState({ kind: 'error' }));
    return () => {
      active = false;
    };
  }, [id]);

  async function share(spot: Spot): Promise<void> {
    const url = window.location.href;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: spot.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }

  if (state.kind !== 'ready') {
    const message =
      state.kind === 'loading' ? text.spot.loading : state.kind === 'error' ? text.spot.loadFailed : text.notFound;
    return (
      <>
        <Header />
        <p className="px-4 py-6 text-ink-muted">{message}</p>
        {state.kind !== 'loading' && <BackLink />}
      </>
    );
  }

  const { spot } = state;
  const want = spot.status === 'want';
  const editPath = `/admin/spot/${spot.id}/edit`;
  return (
    <>
      <Header />
      <BackLink />
      <main className="bg-surface pb-6">
        <PhotoCarousel photos={spot.photos} />
        <div className="space-y-2 px-4 pt-3">
          <h2 className="text-xl font-bold text-ink">{spot.name}</h2>
          <p className="text-xs text-ink-muted">
            {[spot.address, spot.visitedOn && text.spot.visited(text.formatVisitDate(spot.visitedOn))]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {want ? (
            <p className="text-sm text-ink-muted">{text.wantToGo}</p>
          ) : (
            <DumplingRating value={spot.rating} size="lg" />
          )}
          {spot.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1">
              {spot.tags.map((t) => (
                <li key={t} className="rounded-full bg-tag px-2 py-0.5 text-xs text-ink">
                  {t}
                </li>
              ))}
            </ul>
          )}
          {spot.notes && (
            <p className="whitespace-pre-line rounded-card bg-surface-muted px-3 py-2 text-ink">{spot.notes}</p>
          )}
          <div className="flex gap-2 pt-2">
            <a
              href={settings.directionsUrl(spot.lat, spot.lng)}
              target="_blank"
              rel="noreferrer"
              className={BUTTON}
            >
              {text.spot.directions}
            </a>
            <button type="button" onClick={() => void share(spot)} className={BUTTON}>
              {text.spot.share}
            </button>
          </div>
          {copied && (
            <p role="status" className="text-center text-sm text-ink-muted">
              {text.spot.linkCopied}
            </p>
          )}
          {signedIn && (
            <div className="flex gap-2">
              <Link to={editPath} className={BUTTON}>
                {text.spot.edit}
              </Link>
              {want && (
                <Link to={`${editPath}?went=1`} className={BUTTON_SOLID}>
                  {text.spot.iWent}
                </Link>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
