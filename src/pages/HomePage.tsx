import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { SpotSummary } from '../../shared/types';
import { EmptyState } from '../components/EmptyState';
import { FilterBar } from '../components/FilterBar';
import { Header } from '../components/Header';
import { SpotCard } from '../components/SpotCard';
import { SpotDrawer } from '../components/SpotDrawer';
import { text } from '../config/text';
import { api } from '../lib/api';
import { useEditor } from '../lib/useEditor';
import { useUserLocation } from '../lib/useUserLocation';

// Lazy so maplibre (WebGL) only loads in the browser on the map view, never in tests.
const MapView = lazy(() => import('../components/MapView'));

type View = 'map' | 'feed';

// Filter state lives in the URL so a filtered view can be shared, e.g. ?view=feed&tag=Momos.
// Defaults (map view, both chips on, all foods) are left out of the URL.
function useHomeQuery() {
  const [params, setParams] = useSearchParams();
  const state = {
    view: (params.get('view') === 'feed' ? 'feed' : 'map') as View,
    showBeen: params.get('been') !== '0',
    showWant: params.get('want') !== '0',
    tag: params.get('tag') || null,
  };
  const set = (key: string, value: string | null): void => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === null) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };
  return {
    ...state,
    setView: (v: View) => set('view', v === 'map' ? null : v),
    setShowBeen: (on: boolean) => set('been', on ? null : '0'),
    setShowWant: (on: boolean) => set('want', on ? null : '0'),
    setTag: (t: string | null) => set('tag', t),
  };
}

export function HomePage(): JSX.Element {
  const q = useHomeQuery();
  const { signedIn, loading } = useEditor();
  const userLocation = useUserLocation();
  const navigate = useNavigate();
  const [all, setAll] = useState<SpotSummary[] | null>(null);
  // The tag `all` was loaded for. The map refits when this changes, i.e. once the new tag's spots arrive.
  const [loadedTag, setLoadedTag] = useState('');
  const [failed, setFailed] = useState(false);
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    api.listTags().then(setTags, () => setTags([]));
  }, []);

  useEffect(() => {
    let active = true;
    api.listSpots(q.tag ? { tag: q.tag } : {}).then(
      (s) => {
        if (!active) return;
        setAll(s);
        setLoadedTag(q.tag ?? '');
        setFailed(false);
      },
      () => {
        if (!active) return;
        setAll([]);
        setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [q.tag]);

  const spots = useMemo(
    () => (all ?? []).filter((s) => (s.status === 'been' ? q.showBeen : q.showWant)),
    [all, q.showBeen, q.showWant],
  );
  // Nothing to say while the first load is in flight.
  // With a tag picked or a chip off, an empty list means the filters hide everything, not "no spots yet".
  const filtered = q.tag !== null || !q.showBeen || !q.showWant;
  const emptyMessage =
    all === null ? undefined : failed ? text.errors.loadSpots : filtered ? text.empty.noMatches : text.empty.noSpots;

  const addButton = signedIn ? (
    <Link
      to="/admin/new"
      aria-label={text.addSpot}
      className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-2xl text-primary-contrast shadow-md"
    >
      {text.addSpotSymbol}
    </Link>
  ) : null;

  const top = (
    // Pointer events pass through the gaps to the map; only the controls catch taps.
    <div className="pointer-events-none flex flex-col gap-2 p-2.5 *:pointer-events-auto">
      <div className="*:rounded-card">
        <Header showSignIn={!loading && !signedIn} />
      </div>
      <div className="self-start">
        <FilterBar
          showBeen={q.showBeen}
          showWant={q.showWant}
          tag={q.tag}
          tags={tags}
          onShowBeen={q.setShowBeen}
          onShowWant={q.setShowWant}
          onTag={q.setTag}
        />
      </div>
      <div role="group" aria-label={text.views.label} className="flex self-end overflow-hidden rounded-card bg-surface text-sm shadow-sm">
        {(['map', 'feed'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={q.view === v}
            onClick={() => q.setView(v)}
            className={`px-3 py-1 ${q.view === v ? 'bg-ink text-surface' : 'text-ink'}`}
          >
            {text.views[v]}
          </button>
        ))}
      </div>
    </div>
  );

  if (q.view === 'feed') {
    return (
      <div className="min-h-dvh bg-surface-muted">
        <div className="sticky top-0 z-10 bg-surface-muted">{top}</div>
        <main className="flex flex-col gap-3 px-2.5 pb-24">
          {spots.length === 0 && emptyMessage && (
            <EmptyState message={emptyMessage} />
          )}
          {spots.map((s) => (
            <SpotCard key={s.id} spot={s} variant="card" />
          ))}
        </main>
        {addButton && <div className="fixed bottom-4 right-4 z-10">{addButton}</div>}
      </div>
    );
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-surface-muted">
      <div className="absolute inset-0">
        <Suspense fallback={null}>
          <MapView spots={spots} fitKey={loadedTag} onSelect={(id) => navigate(`/spot/${id}`)} />
        </Suspense>
      </div>
      <div className="absolute inset-x-0 top-0 z-10">{top}</div>
      <SpotDrawer spots={spots} userLocation={userLocation} emptyMessage={emptyMessage} action={addButton} />
    </div>
  );
}
