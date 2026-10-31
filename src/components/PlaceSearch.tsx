import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { PlaceResult } from '../../shared/types';
import { settings } from '../config/settings';
import { text } from '../config/text';
import { api, isSignedOut } from '../lib/api';
import type { LatLng } from '../lib/geo';
import { SignedOutNotice } from './SignedOutNotice';

// Lazy so maplibre (WebGL) only loads in the browser when she opens "drop a pin", never in tests.
const MapView = lazy(() => import('./MapView'));

interface Props {
  /** The spot name; typing in it also searches for places. */
  name: string;
  onNameChange: (name: string) => void;
  /** The device location, if known: biases search results and centers the pin map. */
  userLocation: LatLng | null;
  /** The place chosen so far, if any. */
  place: { address: string | null; lat: number; lng: number } | null;
  onPick: (p: PlaceResult) => void;
  onPin: (p: LatLng) => void;
}

export function PlaceSearch({ name, onNameChange, userLocation, place, onPick, onPin }: Props): JSX.Element {
  // Only text she types is searched; null after a pick or when loaded from a saved spot.
  const [query, setQuery] = useState<string | null>(null);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [failed, setFailed] = useState<'error' | 'signedOut' | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const latest = useRef(0);
  const nearRef = useRef(userLocation ?? settings.defaultCenter);
  nearRef.current = userLocation ?? settings.defaultCenter;
  // The pin map opens at the picked place, else her location, else the default view.
  // MapView only reads these when it mounts, so a location that arrives later leaves the camera alone.
  const pinCenter = place ? { lat: place.lat, lng: place.lng } : userLocation;

  useEffect(() => {
    // Each change bumps the counter so a slow, older response is ignored.
    const seq = ++latest.current;
    const q = query?.trim() ?? '';
    if (q.length < settings.searchMinChars) {
      setResults([]);
      setFailed(null);
      return;
    }
    const timer = setTimeout(() => {
      api.searchPlaces(q, nearRef.current).then(
        (r) => {
          if (seq !== latest.current) return;
          setResults(r);
          setFailed(null);
        },
        (e: unknown) => {
          if (seq !== latest.current) return;
          setResults([]);
          setFailed(isSignedOut(e) ? 'signedOut' : 'error');
        },
      );
    }, settings.searchDebounceMs);
    return () => clearTimeout(timer);
  }, [query]);

  const pick = (r: PlaceResult): void => {
    setQuery(null);
    setMapOpen(false);
    onPick(r);
  };

  return (
    <div className="flex flex-col gap-1">
      <input
        type="text"
        aria-label={text.form.name}
        placeholder={text.form.searchPlaceholder}
        value={name}
        autoComplete="off"
        onChange={(e) => {
          onNameChange(e.target.value);
          setQuery(e.target.value);
        }}
        className="rounded-card border border-surface-muted bg-surface px-3 py-2 text-base text-ink"
      />
      {place && results.length === 0 && (
        <p className="px-1 text-xs text-ink-muted">{place.address ?? text.form.pinSet}</p>
      )}
      {failed === 'error' && <p className="px-1 text-xs text-primary">{text.form.searchFailed}</p>}
      {failed === 'signedOut' && <SignedOutNotice className="px-1" />}
      <div className="overflow-hidden rounded-card border border-surface-muted">
        {results.map((r, i) => (
          <button
            key={`${r.lat},${r.lng},${i}`}
            type="button"
            onClick={() => pick(r)}
            className="block w-full border-b border-surface-muted px-3 py-2 text-left"
          >
            <span className="block font-bold text-ink">{r.name}</span>
            {r.address && <span className="block text-xs text-ink-muted">{r.address}</span>}
          </button>
        ))}
        <button
          type="button"
          aria-expanded={mapOpen}
          onClick={() => setMapOpen((o) => !o)}
          className="block w-full px-3 py-2 text-left text-sm text-ink-muted"
        >
          {mapOpen ? text.form.hideMap : text.form.dropPin}
        </button>
      </div>
      {mapOpen && (
        <>
          <p className="px-1 text-xs text-ink-muted">{text.form.pinHint}</p>
          <div className="h-56 overflow-hidden rounded-card">
            <Suspense fallback={null}>
              <MapView
                spots={[]}
                onMapTap={onPin}
                marker={place ? { lat: place.lat, lng: place.lng } : null}
                center={pinCenter ?? settings.defaultCenter}
                zoom={pinCenter ? settings.pinZoom : settings.defaultZoom}
              />
            </Suspense>
          </div>
        </>
      )}
    </div>
  );
}
