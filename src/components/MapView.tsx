import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { SpotSummary } from '../../shared/types';
import { icons } from '../config/icons';
import { settings } from '../config/settings';
import type { LatLng } from '../lib/geo';

interface Props {
  spots: SpotSummary[];
  onSelect?: (id: string) => void;
  onMapTap?: (p: LatLng) => void;
  /** A single picked point (used by "drop a pin" when adding a spot). */
  marker?: LatLng | null;
  /** Initial camera; defaults to settings.defaultCenter and settings.defaultZoom. */
  center?: LatLng;
  zoom?: number;
  /** The map fits to the spots on the first non-empty load and again whenever this changes. */
  fitKey?: string;
}

function pinElement(src: string, label?: string): HTMLElement {
  const el = document.createElement(label ? 'button' : 'div');
  if (label) {
    el.setAttribute('type', 'button');
    el.setAttribute('aria-label', label);
  }
  el.className = 'block h-10 w-8 cursor-pointer';
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.className = 'h-full w-full';
  el.appendChild(img);
  return el;
}

// Default export so HomePage can React.lazy() it and tests never load maplibre (WebGL).
export default function MapView({ spots, onSelect, onMapTap, marker, center, zoom, fitKey }: Props): JSX.Element {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  // Keep the latest callbacks without re-creating the map or markers.
  const handlers = useRef({ onSelect, onMapTap });
  handlers.current = { onSelect, onMapTap };
  // The fitKey the camera was last fitted for; null until the first fit.
  const fittedFor = useRef<{ key: string | undefined } | null>(null);

  useEffect(() => {
    const m = new maplibregl.Map({
      container: container.current!,
      style: settings.mapStyleUrl,
      center: [(center ?? settings.defaultCenter).lng, (center ?? settings.defaultCenter).lat],
      zoom: zoom ?? settings.defaultZoom,
      attributionControl: { compact: true },
    });
    m.on('click', (e) => handlers.current.onMapTap?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // center and zoom only set the initial camera.
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const markers = spots.map((spot) => {
      const el = pinElement(spot.status === 'been' ? icons.pinBeen : icons.pinWant, spot.name);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.current.onSelect?.(spot.id);
      });
      return new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([spot.lng, spot.lat]).addTo(m);
    });
    // Toggling chips only hides pins, so the camera stays put; a new fitKey (e.g. a tag) refits.
    if (spots.length > 0 && (fittedFor.current === null || fittedFor.current.key !== fitKey)) {
      fittedFor.current = { key: fitKey };
      const bounds = new maplibregl.LngLatBounds();
      spots.forEach((s) => bounds.extend([s.lng, s.lat]));
      m.fitBounds(bounds, { padding: settings.mapFitPadding, maxZoom: settings.mapFitMaxZoom, duration: 0 });
    }
    return () => markers.forEach((mk) => mk.remove());
  }, [spots, fitKey]);

  const lat = marker?.lat;
  const lng = marker?.lng;
  useEffect(() => {
    const m = map.current;
    if (!m || lat === undefined || lng === undefined) return;
    const mk = new maplibregl.Marker({ element: pinElement(icons.pinPicked), anchor: 'bottom' })
      .setLngLat([lng, lat])
      .addTo(m);
    return () => {
      mk.remove();
    };
  }, [lat, lng]);

  return <div ref={container} className="h-full w-full" />;
}
