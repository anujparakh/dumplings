import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import type { Photo, Spot, SpotInput } from '../../shared/types';
import { settings } from '../../src/config/settings';
import { text } from '../../src/config/text';
import { api, ApiError } from '../../src/lib/api';
import { resizeImage } from '../../src/lib/image';
import { SpotFormPage } from '../../src/pages/SpotFormPage';

vi.mock('../../src/lib/api', async (importOriginal) => ({
  isSignedOut: (await importOriginal<typeof import('../../src/lib/api')>()).isSignedOut,
  api: {
    getSpot: vi.fn(),
    listTags: vi.fn(),
    createSpot: vi.fn(),
    updateSpot: vi.fn(),
    deleteSpot: vi.fn(),
    uploadPhoto: vi.fn(),
    deletePhoto: vi.fn(),
    searchPlaces: vi.fn(),
    isSignedIn: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string) {
      super(code);
    }
  },
}));

vi.mock('../../src/lib/image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/image')>()),
  resizeImage: vi.fn(),
}));

type MapProps = { onMapTap?: (p: { lat: number; lng: number }) => void; center?: unknown; zoom?: number };
const mapProps = vi.hoisted(() => ({ last: null as unknown }));
vi.mock('../../src/components/MapView', () => ({
  default: (props: MapProps) => {
    mapProps.last = props;
    return <button type="button" data-testid="map" onClick={() => props.onMapTap?.({ lat: 29.7, lng: -95.4 })} />;
  },
}));

const mocked = vi.mocked(api);
const mockedResize = vi.mocked(resizeImage);

function LocationProbe(): JSX.Element {
  const l = useLocation();
  return <div data-testid="location">{l.pathname + l.search}</div>;
}

function renderAt(url: string): void {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/" element={null} />
        <Route path="/login" element={null} />
        <Route path="/spot/:id" element={null} />
        <Route path="/admin/new" element={<SpotFormPage />} />
        <Route path="/admin/spot/:id/edit" element={<SpotFormPage />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

const location = (): HTMLElement => screen.getByTestId('location');

function spot(over: Partial<Spot>): Spot {
  return {
    id: 'g1',
    name: 'Golden Steamer',
    address: '123 Main St',
    lat: 29.76,
    lng: -95.37,
    status: 'been',
    rating: 4,
    notes: 'Crispy',
    visitedOn: '2026-10-12',
    tags: ['Dumplings'],
    photos: [],
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...over,
  };
}

function today(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const blobs: Record<string, Blob> = {};
function file(name: string): File {
  return new File(['raw'], name, { type: 'image/heic' });
}

function pickPhotos(...names: string[]): void {
  fireEvent.change(screen.getByLabelText(text.form.addPhotos), { target: { files: names.map(file) } });
}

function photo(id: string): Photo {
  return { id, url: `/api/photos/${id}`, width: 1600, height: 1200 };
}

async function placeByPin(name: string): Promise<void> {
  fireEvent.change(screen.getByLabelText(text.form.name), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: text.form.dropPin }));
  fireEvent.click(await screen.findByTestId('map'));
}

const saveButton = (): HTMLElement => screen.getByRole('button', { name: text.form.save });

beforeEach(() => {
  mocked.isSignedIn.mockResolvedValue(true);
  mocked.listTags.mockResolvedValue(['Dumplings', 'Momos']);
  mocked.searchPlaces.mockResolvedValue([]);
  mocked.createSpot.mockImplementation(async (i: SpotInput) => spot({ ...i, id: 'new1' }));
  mocked.updateSpot.mockImplementation(async (id: string, i: SpotInput) => spot({ ...i, id }));
  mocked.uploadPhoto.mockImplementation(async () => photo('up'));
  mocked.deletePhoto.mockResolvedValue(undefined);
  mocked.deleteSpot.mockResolvedValue(undefined);
  mockedResize.mockImplementation(async (f: File) => {
    blobs[f.name] = new Blob([f.name], { type: 'image/jpeg' });
    return f.name.startsWith('a')
      ? { blob: blobs[f.name], width: 1600, height: 1200 }
      : { blob: blobs[f.name], width: 1200, height: 1600 };
  });
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

test('want to go hides rating, date and photos', async () => {
  renderAt('/admin/new');
  expect(screen.getByRole('group', { name: text.form.rating })).toBeInTheDocument();
  expect(screen.getByLabelText(text.form.visitedOn)).toBeInTheDocument();
  expect(screen.getByLabelText(text.form.addPhotos)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: text.form.want }));
  expect(screen.getByRole('button', { name: text.form.want })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('group', { name: text.form.rating })).not.toBeInTheDocument();
  expect(screen.queryByLabelText(text.form.visitedOn)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(text.form.addPhotos)).not.toBeInTheDocument();
  expect(screen.getByLabelText(text.form.notes)).toBeInTheDocument();
});

test('saving a want spot sends rating null and visitedOn null', async () => {
  renderAt('/admin/new');
  await placeByPin('Dumpling Lab');
  fireEvent.click(screen.getByRole('button', { name: text.rating.setLabel(3) }));
  fireEvent.click(screen.getByRole('button', { name: text.form.want }));
  fireEvent.click(saveButton());

  await waitFor(() => expect(location()).toHaveTextContent('/spot/new1'));
  expect(mocked.createSpot).toHaveBeenCalledWith({
    name: 'Dumpling Lab',
    address: null,
    lat: 29.7,
    lng: -95.4,
    status: 'want',
    rating: null,
    visitedOn: null,
    notes: '',
    tags: [...settings.newSpotTags],
  });
  expect(mocked.uploadPhoto).not.toHaveBeenCalled();
});

test('picking a search result fills name/address/lat/lng', async () => {
  mocked.searchPlaces.mockResolvedValue([
    { name: 'Golden Steamer', address: '123 Main St', lat: 29.75, lng: -95.36 },
  ]);
  renderAt('/admin/new');
  fireEvent.change(screen.getByLabelText(text.form.name), { target: { value: 'go' } });
  fireEvent.change(screen.getByLabelText(text.form.name), { target: { value: 'golden ste' } });

  fireEvent.click(await screen.findByRole('button', { name: /Golden Steamer/ }));
  expect(mocked.searchPlaces).toHaveBeenCalledTimes(1);
  expect(mocked.searchPlaces).toHaveBeenCalledWith('golden ste', settings.defaultCenter);
  expect(screen.getByLabelText(text.form.name)).toHaveValue('Golden Steamer');
  expect(screen.getByText('123 Main St')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Golden Steamer/ })).not.toBeInTheDocument();

  fireEvent.click(saveButton());
  await waitFor(() => expect(mocked.createSpot).toHaveBeenCalled());
  expect(mocked.createSpot.mock.calls[0][0]).toMatchObject({
    name: 'Golden Steamer',
    address: '123 Main St',
    lat: 29.75,
    lng: -95.36,
    status: 'been',
    visitedOn: today(),
  });
});

test('search failure shows a message and still allows dropping a pin', async () => {
  mocked.searchPlaces.mockRejectedValue(new ApiError(502, 'search_failed'));
  renderAt('/admin/new');
  fireEvent.change(screen.getByLabelText(text.form.name), { target: { value: 'golden' } });
  expect(await screen.findByText(text.form.searchFailed)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: text.form.dropPin }));
  fireEvent.click(await screen.findByTestId('map'));
  expect(screen.getByText(text.form.pinSet)).toBeInTheDocument();
  expect(saveButton()).toBeEnabled();
});

test('search failing with 401 shows the sign-in hint instead of the generic message', async () => {
  mocked.searchPlaces.mockRejectedValue(new ApiError(401, 'signed_out'));
  renderAt('/admin/new');
  fireEvent.change(screen.getByLabelText(text.form.name), { target: { value: 'golden' } });
  expect(await screen.findByText(text.form.signedOut, { exact: false })).toBeInTheDocument();
  expect(screen.queryByText(text.form.searchFailed)).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: text.form.signInAgain })).toHaveAttribute('href', '/login');
});

test('save while signed out shows the sign-in link and keeps the form', async () => {
  mocked.createSpot.mockRejectedValueOnce(new ApiError(401, 'signed_out'));
  renderAt('/admin/new');
  await placeByPin('Golden Steamer');
  fireEvent.click(screen.getByRole('button', { name: text.rating.setLabel(4) }));
  fireEvent.change(screen.getByLabelText(text.form.notes), { target: { value: 'Crispy' } });
  fireEvent.click(saveButton());

  expect(await screen.findByText(text.form.signedOut, { exact: false })).toBeInTheDocument();
  expect(screen.queryByText(text.form.saveFailed)).not.toBeInTheDocument();
  const link = screen.getByRole('link', { name: text.form.signInAgain });
  expect(link).toHaveAttribute('href', '/login');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener');
  expect(location()).toHaveTextContent('/admin/new');
  expect(screen.getByLabelText(text.form.name)).toHaveValue('Golden Steamer');
  expect(screen.getByLabelText(text.form.notes)).toHaveValue('Crispy');

  // After signing in again in the other tab, Save works without re-entering anything.
  fireEvent.click(saveButton());
  await waitFor(() => expect(location()).toHaveTextContent('/spot/new1'));
  expect(mocked.createSpot.mock.calls[1][0]).toMatchObject({ name: 'Golden Steamer', rating: 4, notes: 'Crispy' });
});

test('out-of-order search responses are ignored', async () => {
  let resolveFirst: (v: Awaited<ReturnType<typeof api.searchPlaces>>) => void = () => {};
  mocked.searchPlaces
    .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
    .mockResolvedValueOnce([{ name: 'Newer Place', address: null, lat: 1, lng: 2 }]);
  renderAt('/admin/new');
  fireEvent.change(screen.getByLabelText(text.form.name), { target: { value: 'old' } });
  await waitFor(() => expect(mocked.searchPlaces).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText(text.form.name), { target: { value: 'newer' } });
  expect(await screen.findByRole('button', { name: /Newer Place/ })).toBeInTheDocument();
  resolveFirst([{ name: 'Stale Place', address: null, lat: 3, lng: 4 }]);
  await new Promise((r) => setTimeout(r, 0));
  expect(screen.queryByRole('button', { name: /Stale Place/ })).not.toBeInTheDocument();
});

test('save creates spot, uploads photos in order, then navigates', async () => {
  let finishFirst: (p: Photo) => void = () => {};
  mocked.uploadPhoto.mockImplementationOnce(() => new Promise((r) => (finishFirst = r)));
  renderAt('/admin/new');
  await placeByPin('Golden Steamer');
  fireEvent.click(screen.getByRole('button', { name: text.rating.setLabel(4) }));
  pickPhotos('a.heic', 'b.heic');
  await waitFor(() => expect(screen.getAllByRole('button', { name: text.form.removePhoto })).toHaveLength(2));

  fireEvent.click(saveButton());
  await waitFor(() => expect(mocked.uploadPhoto).toHaveBeenCalledTimes(1));
  expect(mocked.createSpot.mock.calls[0][0]).toMatchObject({ rating: 4, status: 'been', visitedOn: today() });
  expect(mocked.createSpot.mock.invocationCallOrder[0]).toBeLessThan(mocked.uploadPhoto.mock.invocationCallOrder[0]);
  expect(mocked.uploadPhoto).toHaveBeenNthCalledWith(1, 'new1', blobs['a.heic'], 1600, 1200);

  finishFirst(photo('p1'));
  await waitFor(() => expect(location()).toHaveTextContent('/spot/new1'));
  expect(mocked.uploadPhoto).toHaveBeenCalledTimes(2);
  expect(mocked.uploadPhoto).toHaveBeenNthCalledWith(2, 'new1', blobs['b.heic'], 1200, 1600);
});

test('photo upload failure shows error and stays on page', async () => {
  mocked.uploadPhoto
    .mockResolvedValueOnce(photo('p1'))
    .mockRejectedValueOnce(new ApiError(500, 'http_500'));
  renderAt('/admin/new');
  await placeByPin('Golden Steamer');
  pickPhotos('a.heic', 'b.heic');
  await waitFor(() => expect(screen.getAllByRole('button', { name: text.form.removePhoto })).toHaveLength(2));
  fireEvent.click(saveButton());

  expect(await screen.findByText(text.form.photoUploadFailed)).toBeInTheDocument();
  expect(location()).toHaveTextContent('/admin/spot/new1/edit');
  expect(mocked.getSpot).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: text.form.retry }));
  await waitFor(() => expect(location()).toHaveTextContent('/spot/new1'));
  expect(mocked.uploadPhoto).toHaveBeenCalledTimes(3);
  expect(mocked.uploadPhoto).toHaveBeenLastCalledWith('new1', blobs['b.heic'], 1200, 1600);
  expect(mocked.createSpot).toHaveBeenCalledTimes(1);
});

test("?went=1 preselects Been there with today's date", async () => {
  mocked.getSpot.mockResolvedValue(spot({ id: 'w1', status: 'want', rating: null, visitedOn: null }));
  renderAt('/admin/spot/w1/edit?went=1');
  const group = await screen.findByRole('group', { name: text.form.rating });
  expect(screen.getByRole('button', { name: text.form.been })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByLabelText(text.form.visitedOn)).toHaveValue(today());
  await waitFor(() => expect(group).toHaveFocus());
});

test('save disabled until a place (lat/lng) and name are set', async () => {
  renderAt('/admin/new');
  expect(saveButton()).toBeDisabled();
  fireEvent.change(screen.getByLabelText(text.form.name), { target: { value: 'Golden' } });
  expect(saveButton()).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: text.form.dropPin }));
  fireEvent.click(await screen.findByTestId('map'));
  expect(saveButton()).toBeEnabled();
  fireEvent.change(screen.getByLabelText(text.form.name), { target: { value: '  ' } });
  expect(saveButton()).toBeDisabled();
});

test('edit: removing an existing photo deletes it after saving; no switch to want with photos', async () => {
  mocked.getSpot.mockResolvedValue(spot({ photos: [photo('p1')] }));
  renderAt('/admin/spot/g1/edit');
  expect(await screen.findByLabelText(text.form.name)).toHaveValue('Golden Steamer');
  expect(screen.getByRole('button', { name: text.form.want })).toBeDisabled();
  expect(screen.getByText(text.form.wantHasPhotos)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: text.form.removePhoto }));
  fireEvent.click(saveButton());
  await waitFor(() => expect(location()).toHaveTextContent('/spot/g1'));
  expect(mocked.updateSpot).toHaveBeenCalledWith('g1', expect.objectContaining({ name: 'Golden Steamer', rating: 4 }));
  expect(mocked.deletePhoto).toHaveBeenCalledWith('p1');
  expect(mocked.updateSpot.mock.invocationCallOrder[0]).toBeLessThan(mocked.deletePhoto.mock.invocationCallOrder[0]);
});

test('tags: new spot starts with newSpotTags; suggestions and free text add tags', async () => {
  renderAt('/admin/new');
  const tags = screen.getByRole('group', { name: text.form.tags });
  for (const t of settings.newSpotTags) {
    expect(within(tags).getByRole('button', { name: text.form.removeTag(t) })).toBeInTheDocument();
  }
  fireEvent.click(await within(tags).findByRole('button', { name: text.form.addTagSuggestion('Momos') }));
  fireEvent.click(within(tags).getByRole('button', { name: text.form.addTagSuggestion('Fully veg menu') }));
  const input = within(tags).getByLabelText(text.form.newTag);
  fireEvent.change(input, { target: { value: 'Bao' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.click(within(tags).getByRole('button', { name: text.form.removeTag('Dumplings') }));

  await placeByPin('Golden Steamer');
  fireEvent.click(saveButton());
  await waitFor(() => expect(mocked.createSpot).toHaveBeenCalled());
  expect(mocked.createSpot.mock.calls[0][0].tags).toEqual(['Momos', 'Fully veg menu', 'Bao']);
});

test('tags: typing an existing tag in other casing reuses the existing casing', async () => {
  renderAt('/admin/new');
  const tags = screen.getByRole('group', { name: text.form.tags });
  await within(tags).findByRole('button', { name: text.form.addTagSuggestion('Momos') });
  const input = within(tags).getByLabelText(text.form.newTag);
  fireEvent.change(input, { target: { value: 'momos' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(within(tags).getByRole('button', { name: text.form.removeTag('Momos') })).toBeInTheDocument();
  expect(within(tags).queryByRole('button', { name: text.form.removeTag('momos') })).not.toBeInTheDocument();
});

test('delete asks for confirmation, then deletes and goes home', async () => {
  mocked.getSpot.mockResolvedValue(spot({}));
  const confirm = vi.fn(() => true);
  vi.stubGlobal('confirm', confirm);
  renderAt('/admin/spot/g1/edit');
  fireEvent.click(await screen.findByRole('button', { name: text.form.delete }));
  expect(confirm).toHaveBeenCalledWith(text.form.confirmDelete);
  await waitFor(() => expect(location()).toHaveTextContent(/^\/$/));
  expect(mocked.deleteSpot).toHaveBeenCalledWith('g1');
});

describe('pin map camera', () => {
  async function openPinMap(): Promise<MapProps> {
    fireEvent.click(screen.getByRole('button', { name: text.form.dropPin }));
    await screen.findByTestId('map');
    return mapProps.last as MapProps;
  }

  test('opens at the existing place, street level', async () => {
    mocked.getSpot.mockResolvedValue(spot({ lat: 30.1, lng: -95.9 }));
    renderAt('/admin/spot/g1/edit');
    await screen.findByLabelText(text.form.name);
    expect(await openPinMap()).toMatchObject({ center: { lat: 30.1, lng: -95.9 }, zoom: settings.pinZoom });
  });

  test("opens at the user's location when no place is picked", async () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: 29.71, longitude: -95.41 } } as GeolocationPosition),
      },
    });
    renderAt('/admin/new');
    expect(await openPinMap()).toMatchObject({ center: { lat: 29.71, lng: -95.41 }, zoom: settings.pinZoom });
  });

  test('falls back to the default view with neither', async () => {
    renderAt('/admin/new');
    expect(await openPinMap()).toMatchObject({ center: settings.defaultCenter, zoom: settings.defaultZoom });
  });
});

test('signed-out visitors are sent to sign in, then back here', async () => {
  mocked.isSignedIn.mockResolvedValue(false);
  mocked.getSpot.mockResolvedValue(spot({}));
  renderAt('/admin/spot/g1/edit?went=1');
  await waitFor(() => expect(location()).toHaveTextContent(`/login?next=${encodeURIComponent('/admin/spot/g1/edit?went=1')}`));
});
