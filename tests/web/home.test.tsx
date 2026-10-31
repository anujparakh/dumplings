import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import type { SpotSummary } from '../../shared/types';
import { text } from '../../src/config/text';
import { api } from '../../src/lib/api';
import { HomePage } from '../../src/pages/HomePage';

vi.mock('../../src/lib/api', () => ({
  api: { listSpots: vi.fn(), listTags: vi.fn(), me: vi.fn() },
  ApiError: class extends Error {},
}));

vi.mock('../../src/components/MapView', () => ({
  default: ({ spots }: { spots: SpotSummary[] }) => <div data-testid="map">{spots.length}</div>,
}));

const mocked = vi.mocked(api);

function spot(over: Partial<SpotSummary>): SpotSummary {
  return {
    id: 'x',
    name: 'X',
    address: null,
    lat: 29.76,
    lng: -95.37,
    status: 'been',
    rating: 4,
    notes: '',
    visitedOn: null,
    tags: ['Dumplings'],
    coverPhoto: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...over,
  };
}

const golden = spot({
  id: 'g1',
  name: 'Golden Steamer',
  visitedOn: '2026-10-12',
  notes: 'Crispy bottoms',
  coverPhoto: { id: 'p1', url: '/api/photos/p1', width: 800, height: 600 },
});
const momo = spot({ id: 'm1', name: 'Momo House', rating: 3, visitedOn: '2026-09-28', tags: ['Momos'] });
const lab = spot({ id: 'w1', name: 'Dumpling Lab', status: 'want', rating: null, lat: 29.8, lng: -95.4 });

function LocationProbe(): JSX.Element {
  return <div data-testid="location">{useLocation().search}</div>;
}

function renderHome(url = '/'): void {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <HomePage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function stubGeolocation(ok: boolean): void {
  vi.stubGlobal('navigator', {
    ...navigator,
    geolocation: {
      getCurrentPosition: (success: PositionCallback, error: PositionErrorCallback) =>
        ok
          ? success({ coords: { latitude: 29.7604, longitude: -95.3698 } } as GeolocationPosition)
          : error({ code: 1, message: 'denied' } as GeolocationPositionError),
    },
  });
}

beforeEach(() => {
  mocked.listSpots.mockResolvedValue([golden, momo, lab]);
  mocked.listTags.mockResolvedValue(['Dumplings', 'Momos']);
  mocked.me.mockResolvedValue(null);
  stubGeolocation(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test('feed view lists spots newest first as cards', async () => {
  renderHome('/');
  fireEvent.click(await screen.findByRole('button', { name: text.views.feed }));
  await waitFor(() => expect(screen.queryByTestId('map')).not.toBeInTheDocument());
  expect(screen.getByTestId('location')).toHaveTextContent('view=feed');

  const links = await screen.findAllByRole('link', { name: /Golden Steamer|Momo House|Dumpling Lab/ });
  expect(links.map((l) => l.textContent)).toEqual([
    expect.stringContaining('Golden Steamer'),
    expect.stringContaining('Momo House'),
    expect.stringContaining('Dumpling Lab'),
  ]);
  expect(links.map((l) => l.getAttribute('href'))).toEqual(['/spot/g1', '/spot/m1', '/spot/w1']);
  expect(within(links[0]).getByRole('img', { name: text.rating.valueLabel(4) })).toBeInTheDocument();
});

test('turning off Want-to-go chip hides want spots', async () => {
  renderHome('/?view=feed');
  expect(await screen.findByRole('link', { name: /Dumpling Lab/ })).toBeInTheDocument();
  const chip = screen.getByRole('button', { name: text.filters.want });
  expect(chip).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(chip);
  expect(chip).toHaveAttribute('aria-pressed', 'false');
  expect(screen.queryByRole('link', { name: /Dumpling Lab/ })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Golden Steamer/ })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Momo House/ })).toBeInTheDocument();
});

test('tag dropdown filters and writes ?tag= to URL', async () => {
  mocked.listSpots.mockImplementation(async (f) => (f.tag === 'Momos' ? [momo] : [golden, momo, lab]));
  renderHome('/?view=feed');
  expect(await screen.findByRole('link', { name: /Golden Steamer/ })).toBeInTheDocument();

  const select = screen.getByRole('combobox', { name: text.filters.tagLabel });
  expect(within(select).getByRole('option', { name: text.filters.allFoods })).toBeInTheDocument();
  await within(select).findByRole('option', { name: 'Momos' });

  fireEvent.change(select, { target: { value: 'Momos' } });
  await waitFor(() => expect(screen.queryByRole('link', { name: /Golden Steamer/ })).not.toBeInTheDocument());
  expect(screen.getByRole('link', { name: /Momo House/ })).toBeInTheDocument();
  expect(mocked.listSpots).toHaveBeenLastCalledWith({ tag: 'Momos' });
  expect(screen.getByTestId('location')).toHaveTextContent('tag=Momos');
  expect(screen.getByTestId('location')).toHaveTextContent('view=feed');
});

test('+ button only when signed in', async () => {
  renderHome('/');
  await waitFor(() => expect(mocked.me).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: text.menu }));
  expect(await screen.findByRole('link', { name: text.signIn })).toHaveAttribute('href', '/admin');
  expect(screen.queryByRole('link', { name: text.addSpot })).not.toBeInTheDocument();
});

test('+ button shown when signed in, links to /admin/new', async () => {
  mocked.me.mockResolvedValue({ email: 'r@x.com' });
  renderHome('/');
  expect(await screen.findByRole('link', { name: text.addSpot })).toHaveAttribute('href', '/admin/new');
  expect(screen.queryByRole('button', { name: text.menu })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: text.signIn })).not.toBeInTheDocument();
});

test('want spot card shows text.wantToGo and no rating', async () => {
  renderHome('/?view=feed');
  const card = await screen.findByRole('link', { name: /Dumpling Lab/ });
  expect(within(card).getByText(text.wantToGo)).toBeInTheDocument();
  expect(within(card).queryAllByRole('img')).toHaveLength(0);
});

test('geolocation denied: no distance text rendered', async () => {
  renderHome('/');
  const row = await screen.findByRole('link', { name: /Golden Steamer/ });
  expect(row).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(new RegExp(`\\d ${text.units.miles}\\b`));
});

test('geolocation granted: drawer rows show distance, nearest first', async () => {
  stubGeolocation(true);
  renderHome('/');
  const row = await screen.findByRole('link', { name: /Golden Steamer/ });
  expect(within(row).getByText(`0.0 ${text.units.miles}`)).toBeInTheDocument();
  const names = screen.getAllByRole('link', { name: /Golden Steamer|Momo House|Dumpling Lab/ }).map((l) => l.getAttribute('href'));
  expect(names[names.length - 1]).toBe('/spot/w1');
});

test('no spots: shows text.empty.noSpots', async () => {
  mocked.listSpots.mockResolvedValue([]);
  renderHome('/');
  expect(await screen.findByText(text.empty.noSpots)).toBeInTheDocument();
});

test('map view renders the lazy map with filtered spots', async () => {
  renderHome('/?want=0');
  expect(await screen.findByTestId('map')).toHaveTextContent('2');
  expect(screen.getByRole('button', { name: text.filters.want })).toHaveAttribute('aria-pressed', 'false');
});

test('spots exist but the chips hide them all: shows text.empty.noMatches', async () => {
  renderHome('/?view=feed&been=0&want=0');
  expect(await screen.findByText(text.empty.noMatches)).toBeInTheDocument();
  expect(screen.queryByText(text.empty.noSpots)).not.toBeInTheDocument();
});

test('a tag with no spots: shows text.empty.noMatches', async () => {
  mocked.listSpots.mockResolvedValue([]);
  renderHome('/?view=feed&tag=Momos');
  expect(await screen.findByText(text.empty.noMatches)).toBeInTheDocument();
});
