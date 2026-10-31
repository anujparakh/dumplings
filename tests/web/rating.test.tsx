import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { DumplingRating } from '../../src/components/DumplingRating';
import { settings } from '../../src/config/settings';
import { text } from '../../src/config/text';

test('rating input: clicking 4th dumpling calls onChange(4)', () => {
  const onChange = vi.fn();
  render(<DumplingRating value={2} onChange={onChange} />);
  expect(screen.getAllByRole('button')).toHaveLength(settings.ratingMax);
  fireEvent.click(screen.getByRole('button', { name: text.rating.setLabel(4) }));
  expect(onChange).toHaveBeenCalledWith(4);
});

test('rating display: 3 of 5 filled, labelled', () => {
  const { container } = render(<DumplingRating value={3} />);
  expect(screen.getByRole('img', { name: text.rating.valueLabel(3) })).toBeInTheDocument();
  expect(screen.queryAllByRole('button')).toHaveLength(0);
  const icons = container.querySelectorAll('img[src]');
  expect(icons).toHaveLength(settings.ratingMax);
  const filled = Array.from(icons).filter((i) => !i.className.includes('opacity-30'));
  expect(filled).toHaveLength(3);
});
