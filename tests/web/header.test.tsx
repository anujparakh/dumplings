import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Header } from '../../src/components/Header';
import { text } from '../../src/config/text';

test('header shows the app title from text config', () => {
  render(<MemoryRouter><Header /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: text.appTitle })).toBeInTheDocument();
});

test("app title is Ruchi's Dumpling Map", () => {
  expect(text.appTitle).toBe("Ruchi's Dumpling Map");
});
