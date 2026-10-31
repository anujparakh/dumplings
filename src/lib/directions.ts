import { settings } from '../config/settings';

// iPadOS reports itself as a Mac, so a touch-capable "Mac" counts as an iPad.
const isApple = (): boolean =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** A link that opens the phone's maps app with directions to the spot. */
export function directionsUrl(lat: number, lng: number): string {
  return isApple() ? settings.appleDirectionsUrl(lat, lng) : settings.directionsUrl(lat, lng);
}
