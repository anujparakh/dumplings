import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, beforeEach, afterEach } from 'vitest';
import type { Spot } from '../../shared/types';
import { text } from '../../src/config/text';
import { api } from '../../src/lib/api';
import { SpotPage } from '../../src/pages/SpotPage';

vi.mock('../../src/lib/api', () => ({ api: { getSpot: vi.fn(), me: vi.fn() } }));
const mocked = vi.mocked(api);

const been: Spot = {
  id: 's1', name: 'Golden Steamer', address: '123 Main St', lat: 29.7, lng: -95.4,
  status: 'been', rating: 4, notes: 'Line one\nLine two', visitedOn: '2026-10-12',
  tags: ['Dumplings', 'Fully veg menu'],
  photos: [
    { id: 'p1', url: '/api/photos/p1', width: 800, height: 600 },
    { id: 'p2', url: '/api/photos/p2', width: 800, height: 600 },
  ],
  createdAt: '', updatedAt: '',
};
const want: Spot = { ...been, id: 's2', status: 'want', rating: null, visitedOn: null, photos: [], notes: '' };

function renderPage(id: string): void {
  render(
    <MemoryRouter initialEntries={[`/spot/${id}`]}>
      <Routes>
        <Route path="/spot/:id" element={<SpotPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocked.me.mockResolvedValue(null);
  mocked.getSpot.mockImplementation(async (id: string) => (id === 's1' ? been : id === 's2' ? want : null));
});
afterEach(() => {
  vi.restoreAllMocks();
  Object.assign(navigator, { share: undefined, clipboard: undefined });
});

test('been spot shows rating, notes, tags, formatted date', async () => {
  renderPage('s1');
  expect(await screen.findByRole('heading', { name: 'Golden Steamer' })).toBeInTheDocument();
  expect(screen.getByText(/123 Main St/)).toHaveTextContent('Visited Oct 12, 2026');
  expect(screen.getByRole('img', { name: text.rating.valueLabel(4) })).toBeInTheDocument();
  expect(screen.getByText('Fully veg menu')).toBeInTheDocument();
  expect(screen.getByText(/Line one/)).toHaveClass('whitespace-pre-line');
  expect(screen.getAllByRole('img', { name: /^Photo \d of 2$/ })).toHaveLength(2);
  expect(screen.getByRole('link', { name: text.spot.directions })).toHaveAttribute(
    'href',
    'https://www.google.com/maps/dir/?api=1&destination=29.7,-95.4',
  );
});

test('want spot shows no rating and, when signed in, an I went! link to ?went=1', async () => {
  mocked.me.mockResolvedValue({ email: 'r@x.com' });
  renderPage('s2');
  const went = await screen.findByRole('link', { name: text.spot.iWent });
  expect(went).toHaveAttribute('href', '/admin/spot/s2/edit?went=1');
  expect(screen.getByRole('link', { name: text.spot.edit })).toHaveAttribute('href', '/admin/spot/s2/edit');
  expect(screen.queryByRole('img', { name: /Rated|Not rated/ })).not.toBeInTheDocument();
});

test('unknown id shows text.notFound', async () => {
  renderPage('nope');
  expect(await screen.findByText(text.notFound)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: new RegExp(text.spot.backToMap) })).toHaveAttribute('href', '/');
});

test('share falls back to clipboard when navigator.share is missing', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { share: undefined, clipboard: { writeText } });
  renderPage('s1');
  fireEvent.click(await screen.findByRole('button', { name: text.spot.share }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.href));
  expect(await screen.findByText(text.spot.linkCopied)).toBeInTheDocument();
});

test('share uses navigator.share when available', async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { share });
  renderPage('s1');
  fireEvent.click(await screen.findByRole('button', { name: text.spot.share }));
  await waitFor(() => expect(share).toHaveBeenCalledWith({ title: 'Golden Steamer', url: window.location.href }));
});

test('Edit/I went! hidden when signed out', async () => {
  renderPage('s2');
  await screen.findByRole('heading', { name: 'Golden Steamer' });
  expect(screen.queryByRole('link', { name: text.spot.edit })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: text.spot.iWent })).not.toBeInTheDocument();
});

test('non-404 failure shows the generic error', async () => {
  mocked.getSpot.mockRejectedValue(new Error('boom'));
  renderPage('s1');
  expect(await screen.findByText(text.spot.loadFailed)).toBeInTheDocument();
});
