import { vi } from 'vitest';
import { directionsUrl } from '../../src/lib/directions';

afterEach(() => vi.unstubAllGlobals());

function stubDevice(userAgent: string, platform = '', maxTouchPoints = 0): void {
  vi.stubGlobal('navigator', { userAgent, platform, maxTouchPoints });
}

test('iPhone and iPad open Apple Maps', () => {
  stubDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
  expect(directionsUrl(29.7, -95.4)).toBe('https://maps.apple.com/?daddr=29.7,-95.4');
  stubDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5);
  expect(directionsUrl(29.7, -95.4)).toContain('maps.apple.com');
});

test('Android and desktop open Google Maps', () => {
  stubDevice('Mozilla/5.0 (Linux; Android 15; Pixel 9)', 'Linux armv8l', 5);
  expect(directionsUrl(29.7, -95.4)).toBe('https://www.google.com/maps/dir/?api=1&destination=29.7,-95.4');
  stubDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0);
  expect(directionsUrl(29.7, -95.4)).toContain('google.com/maps');
});
