import { distanceMiles, formatDistance } from '../../src/lib/geo';

test('distanceMiles Houston downtown to Rice Village ~ 4 mi', () =>
  expect(distanceMiles({ lat: 29.7604, lng: -95.3698 }, { lat: 29.7174, lng: -95.4136 })).toBeCloseTo(3.9, 0));

test('formatDistance', () => {
  expect(formatDistance(null)).toBe('');
  expect(formatDistance(0.44)).toBe('0.4 mi');
  expect(formatDistance(12.3)).toBe('12 mi');
});
