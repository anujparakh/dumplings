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

test('menu button only renders when it has a sign-in item', () => {
  const { unmount } = render(<MemoryRouter><Header /></MemoryRouter>);
  expect(screen.queryByRole('button', { name: text.menu })).not.toBeInTheDocument();
  unmount();
  render(<MemoryRouter><Header showSignIn /></MemoryRouter>);
  expect(screen.getByRole('button', { name: text.menu })).toBeInTheDocument();
});

test('logo and title link back to the main page', () => {
  render(<MemoryRouter initialEntries={['/spot/abc']}><Header /></MemoryRouter>);
  expect(screen.getByRole('link', { name: text.appTitle })).toHaveAttribute('href', '/');
});
