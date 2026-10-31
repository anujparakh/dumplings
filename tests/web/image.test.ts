import { fitWithin } from '../../src/lib/image';

test('fitWithin', () => {
  expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
  expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
});

test('fitWithin rounds to whole pixels', () => {
  expect(fitWithin(3000, 1999, 1600)).toEqual({ width: 1600, height: 1066 });
});
