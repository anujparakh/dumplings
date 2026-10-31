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

test('unlock button goes straight to sign-in, only when asked for', () => {
  const { unmount } = render(<MemoryRouter><Header /></MemoryRouter>);
  expect(screen.queryByRole('link', { name: text.signIn })).not.toBeInTheDocument();
  unmount();
  render(<MemoryRouter><Header showSignIn /></MemoryRouter>);
  expect(screen.getByRole('link', { name: text.signIn })).toHaveAttribute('href', '/login');
});

test('logo and title link back to the main page', () => {
  render(<MemoryRouter initialEntries={['/spot/abc']}><Header /></MemoryRouter>);
  expect(screen.getByRole('link', { name: text.appTitle })).toHaveAttribute('href', '/');
});
