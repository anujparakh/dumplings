import { useEffect, useState } from 'react';
import type { LatLng } from './geo';

/** The device location, or null while unknown or if permission is denied. */
export function useUserLocation(): LatLng | null {
  const [loc, setLoc] = useState<LatLng | null>(null);
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setLoc(null),
    );
  }, []);
  return loc;
}
