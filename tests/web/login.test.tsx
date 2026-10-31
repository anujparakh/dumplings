import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import { text } from '../../src/config/text';
import { api, ApiError } from '../../src/lib/api';
import { LoginPage } from '../../src/pages/LoginPage';

vi.mock('../../src/lib/api', async (importOriginal) => ({
  ApiError: (await importOriginal<typeof import('../../src/lib/api')>()).ApiError,
  api: { login: vi.fn() },
}));
const mocked = vi.mocked(api);

function Where(): JSX.Element {
  const l = useLocation();
  return <div data-testid="location">{l.pathname + l.search}</div>;
}

function renderAt(url: string): void {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

const signIn = (password: string): void => {
  fireEvent.change(screen.getByLabelText(text.login.password), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: text.login.submit }));
};

afterEach(() => vi.resetAllMocks());

test('right password goes to the next page', async () => {
  mocked.login.mockResolvedValue(undefined);
  renderAt(`/login?next=${encodeURIComponent('/admin/new')}`);
  signIn('secret');
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/admin\/new$/));
  expect(mocked.login).toHaveBeenCalledWith('secret');
});

test('next pointing off-site falls back to the map', async () => {
  mocked.login.mockResolvedValue(undefined);
  renderAt(`/login?next=${encodeURIComponent('//evil.example')}`);
  signIn('secret');
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/));
});

test('wrong password shows a message and stays put', async () => {
  mocked.login.mockRejectedValue(new ApiError(401, 'wrong_password'));
  renderAt('/login');
  signIn('nope');
  expect(await screen.findByRole('alert')).toHaveTextContent(text.login.wrongPassword);
  expect(screen.getByTestId('location')).toHaveTextContent('/login');
});

test('other failures show the connection message', async () => {
  mocked.login.mockRejectedValue(new TypeError('offline'));
  renderAt('/login');
  signIn('secret');
  expect(await screen.findByRole('alert')).toHaveTextContent(text.login.failed);
});
