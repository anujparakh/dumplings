import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Photo, Spot, SpotInput, SpotStatus } from '../../shared/types';
import { DumplingRating } from '../components/DumplingRating';
import { Header } from '../components/Header';
import { PhotoPicker, type PendingPhoto } from '../components/PhotoPicker';
import { PlaceSearch } from '../components/PlaceSearch';
import { SignedOutNotice } from '../components/SignedOutNotice';
import { TagEditor } from '../components/TagEditor';
import { settings } from '../config/settings';
import { text } from '../config/text';
import { api, isSignedOut } from '../lib/api';
import { useUserLocation } from '../lib/useUserLocation';

interface Form {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  status: SpotStatus;
  rating: number | null;
  visitedOn: string; // YYYY-MM-DD, or '' when not set
  notes: string;
  tags: string[];
}

/** Today's date as YYYY-MM-DD in local time. */
function today(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const blankForm = (): Form => ({
  name: '',
  address: null,
  lat: null,
  lng: null,
  status: 'been',
  rating: null,
  visitedOn: today(),
  notes: '',
  tags: [...settings.newSpotTags],
});

const formFromSpot = (s: Spot, went: boolean): Form => ({
  name: s.name,
  address: s.address,
  lat: s.lat,
  lng: s.lng,
  status: went ? 'been' : s.status,
  rating: s.rating,
  visitedOn: went ? today() : (s.visitedOn ?? ''),
  notes: s.notes,
  tags: s.tags,
});

const LABEL = 'mt-3 mb-1 block text-xs text-ink-muted';
const FIELD = 'w-full rounded-card border border-surface-muted bg-surface px-3 py-2 text-base text-ink';

function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div>
      <span className={LABEL}>{label}</span>
      {children}
    </div>
  );
}

export function SpotFormPage(): JSX.Element {
  const { id } = useParams();
  const [params] = useSearchParams();
  const went = params.get('went') === '1';
  const navigate = useNavigate();
  const userLocation = useUserLocation();

  const [form, setForm] = useState<Form>(blankForm);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'notFound' | 'failed' | 'signedOut'>(id ? 'loading' : 'ready');
  const [tagOptions, setTagOptions] = useState<string[]>([...settings.defaultTags]);
  // Photos already on the server (kept), ones she removed (deleted after save), and new picks.
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [resizing, setResizing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set with error when the failure was an expired sign-in: shows the sign-in link instead.
  const [signedOut, setSignedOut] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  // The id of the spot this form just saved, so moving from /admin/new to its edit URL does not reload it.
  const savedId = useRef<string | null>(null);
  const ratingRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const set = <K extends keyof Form>(key: K, value: Form[K]): void => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    api.listTags().then(
      (tags) => setTagOptions([...settings.defaultTags, ...tags]),
      () => undefined,
    );
  }, []);

  useEffect(() => {
    if (!id || id === savedId.current) return;
    let active = true;
    setLoadState('loading');
    api.getSpot(id).then(
      (s) => {
        if (!active) return;
        if (!s) return setLoadState('notFound');
        setForm(formFromSpot(s, went));
        setPhotos(s.photos);
        setRemoved([]);
        setPending([]);
        setLoadState('ready');
      },
      (e: unknown) => active && setLoadState(isSignedOut(e) ? 'signedOut' : 'failed'),
    );
    return () => {
      active = false;
    };
    // `went` only matters on the first load of a spot, so it is not a dependency.
  }, [id]);

  useEffect(() => {
    if (went && loadState === 'ready') ratingRef.current?.focus();
  }, [went, loadState]);

  useEffect(() => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), []);

  // The server refuses to turn a spot with photos back into a want spot.
  const wantLocked = photos.length + removed.length > 0;
  const been = form.status === 'been';
  const canSave = form.name.trim() !== '' && form.lat !== null && form.lng !== null && !busy && !resizing;

  const toInput = (): SpotInput => ({
    name: form.name.trim(),
    address: form.address,
    lat: form.lat!,
    lng: form.lng!,
    status: form.status,
    rating: been ? form.rating : null,
    visitedOn: been ? form.visitedOn || null : null,
    notes: form.notes,
    tags: form.tags,
  });

  // Upload new photos one at a time, then delete removed ones, then show the spot.
  // On failure the spot is already saved: stay on its edit page and offer a retry.
  const finishPhotos = async (spotId: string, isNew: boolean, uploads: PendingPhoto[], deletes: string[]): Promise<void> => {
    const fail = (e: unknown, message: string): void => {
      if (isNew) navigate(`/admin/spot/${spotId}/edit`, { replace: true });
      showError(e, message);
      setCanRetry(true);
      setBusy(false);
    };
    for (const p of uploads) {
      try {
        const uploaded = await api.uploadPhoto(spotId, p.blob, p.width, p.height);
        URL.revokeObjectURL(p.previewUrl);
        setPending((ps) => ps.filter((x) => x.key !== p.key));
        setPhotos((ps) => [...ps, uploaded]);
      } catch (e) {
        return fail(e, text.form.photoUploadFailed);
      }
    }
    for (const photoId of deletes) {
      try {
        await api.deletePhoto(photoId);
        setRemoved((ids) => ids.filter((x) => x !== photoId));
      } catch (e) {
        return fail(e, text.form.photoDeleteFailed);
      }
    }
    // A new spot replaces /admin/new in history, so Back from the spot page does not reopen a blank form.
    navigate(`/spot/${spotId}`, { replace: isNew });
  };

  const showError = (e: unknown, message: string): void => {
    setSignedOut(isSignedOut(e));
    setError(message);
  };

  const start = (): void => {
    setBusy(true);
    setError(null);
    setSignedOut(false);
    setCanRetry(false);
  };

  const save = async (): Promise<void> => {
    start();
    let saved: Spot;
    try {
      saved = id ? await api.updateSpot(id, toInput()) : await api.createSpot(toInput());
    } catch (e) {
      showError(e, text.form.saveFailed);
      setBusy(false);
      return;
    }
    savedId.current = saved.id;
    await finishPhotos(saved.id, !id, been ? pending : [], removed);
  };

  const retry = (): void => {
    start();
    void finishPhotos(savedId.current ?? id!, false, been ? pending : [], removed);
  };

  const remove = async (): Promise<void> => {
    if (!id || !confirm(text.form.confirmDelete)) return;
    start();
    try {
      await api.deleteSpot(id);
      navigate('/');
    } catch (e) {
      showError(e, text.form.deleteFailed);
      setBusy(false);
    }
  };

  const setStatus = (status: SpotStatus): void =>
    setForm((f) => ({ ...f, status, visitedOn: status === 'been' && !f.visitedOn ? today() : f.visitedOn }));

  if (loadState === 'signedOut') {
    return (
      <div className="min-h-dvh bg-surface">
        <Header />
        <SignedOutNotice className="px-4 py-8 text-center" />
      </div>
    );
  }
  if (loadState !== 'ready') {
    const message = { loading: text.form.loading, notFound: text.notFound, failed: text.form.loadFailed }[loadState];
    return (
      <div className="min-h-dvh bg-surface">
        <Header />
        <p className="px-4 py-8 text-center text-sm text-ink-muted">{message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-surface">
      <Header />
      <form
        className="mx-auto flex max-w-xl flex-col px-4 pb-10 pt-3"
        // Enter in a field (or the phone's Go key) must not save half-filled; only the Save button saves.
        onSubmit={(e) => e.preventDefault()}
      >
        <h2 className="mb-2 text-lg font-bold text-ink">{id ? text.form.editTitle : text.form.addTitle}</h2>

        <PlaceSearch
          name={form.name}
          onNameChange={(name) => set('name', name)}
          userLocation={userLocation}
          place={form.lat !== null && form.lng !== null ? { address: form.address, lat: form.lat, lng: form.lng } : null}
          onPick={(p) => setForm((f) => ({ ...f, name: p.name, address: p.address, lat: p.lat, lng: p.lng }))}
          onPin={(p) => setForm((f) => ({ ...f, address: null, lat: p.lat, lng: p.lng }))}
        />

        <div role="group" aria-label={text.form.statusLabel} className="mt-3 flex overflow-hidden rounded-card border border-surface-muted">
          {(['been', 'want'] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={form.status === s}
              disabled={s === 'want' && wantLocked && form.status !== 'want'}
              onClick={() => setStatus(s)}
              className={`flex-1 py-2 text-sm disabled:opacity-40 ${form.status === s ? 'bg-primary text-primary-contrast' : 'text-ink'}`}
            >
              {text.form[s]}
            </button>
          ))}
        </div>
        {been && wantLocked && <p className="mt-1 text-xs text-ink-muted">{text.form.wantHasPhotos}</p>}

        {been && (
          <>
            <span id="rating-label" className={LABEL}>
              {text.form.rating}
            </span>
            <div ref={ratingRef} role="group" aria-labelledby="rating-label" tabIndex={-1} className="self-start outline-none">
              <DumplingRating value={form.rating} onChange={(v) => set('rating', v)} size="lg" />
            </div>

            <label className={LABEL} htmlFor="visited-on">
              {text.form.visitedOn}
            </label>
            <input
              id="visited-on"
              type="date"
              value={form.visitedOn}
              max={today()}
              onChange={(e) => set('visitedOn', e.target.value)}
              className={FIELD}
            />

            <Field label={text.form.photos}>
              <PhotoPicker
                existing={photos}
                pending={pending}
                onAdd={(p) => setPending((ps) => [...ps, p])}
                onRemoveExisting={(photoId) => {
                  setPhotos((ps) => ps.filter((p) => p.id !== photoId));
                  setRemoved((ids) => [...ids, photoId]);
                }}
                onRemovePending={(key) => {
                  pending.filter((p) => p.key === key).forEach((p) => URL.revokeObjectURL(p.previewUrl));
                  setPending((ps) => ps.filter((p) => p.key !== key));
                }}
                onBusyChange={setResizing}
              />
            </Field>
          </>
        )}

        <label className={LABEL} htmlFor="notes">
          {text.form.notes}
        </label>
        <textarea
          id="notes"
          rows={been ? 3 : 4}
          value={form.notes}
          placeholder={been ? text.form.notesPlaceholderBeen : text.form.notesPlaceholderWant}
          onChange={(e) => set('notes', e.target.value)}
          className={FIELD}
        />

        <Field label={text.form.tags}>
          <TagEditor value={form.tags} onChange={(tags) => set('tags', tags)} suggestions={tagOptions} />
        </Field>

        {error && signedOut && <SignedOutNotice className="mt-4" />}
        {error && !signedOut && (
          <p role="alert" className="mt-4 text-sm text-primary">
            {error}
          </p>
        )}
        {canRetry && (
          <button
            type="button"
            disabled={busy}
            onClick={retry}
            className="mt-2 rounded-card border border-primary py-2 text-primary disabled:opacity-50"
          >
            {text.form.retry}
          </button>
        )}
        <button
          type="button"
          disabled={!canSave}
          onClick={() => void save()}
          className="mt-4 rounded-card bg-primary py-3 font-bold text-primary-contrast disabled:opacity-50"
        >
          {busy ? text.form.saving : text.form.save}
        </button>
        {id && (
          <button type="button" disabled={busy} onClick={() => void remove()} className="mt-6 py-2 text-sm text-primary">
            {text.form.delete}
          </button>
        )}
      </form>
    </div>
  );
}
