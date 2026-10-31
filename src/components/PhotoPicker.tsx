import { useState } from 'react';
import type { Photo } from '../../shared/types';
import { text } from '../config/text';
import { resizeImage } from '../lib/image';

/** A picked photo, already resized, waiting to be uploaded. */
export interface PendingPhoto {
  key: string;
  blob: Blob;
  width: number;
  height: number;
  previewUrl: string;
}

interface Props {
  existing: Photo[];
  pending: PendingPhoto[];
  onAdd: (p: PendingPhoto) => void;
  onRemoveExisting: (id: string) => void;
  onRemovePending: (key: string) => void;
  /** True while picked photos are being resized. */
  onBusyChange: (busy: boolean) => void;
}

const TILE = 'relative h-16 w-16 shrink-0 overflow-hidden rounded-lg';

function Thumb({ src, onRemove }: { src: string; onRemove: () => void }): JSX.Element {
  return (
    <div className={TILE}>
      <img src={src} alt="" className="h-full w-full object-cover" />
      <button
        type="button"
        aria-label={text.form.removePhoto}
        onClick={onRemove}
        className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs text-surface opacity-80"
      >
        <span aria-hidden="true">{text.form.removeSymbol}</span>
      </button>
    </div>
  );
}

let nextKey = 0;

export function PhotoPicker({ existing, pending, onAdd, onRemoveExisting, onRemovePending, onBusyChange }: Props): JSX.Element {
  const [failed, setFailed] = useState(false);

  const pick = async (files: File[]): Promise<void> => {
    setFailed(false);
    onBusyChange(true);
    // One at a time keeps memory low on a phone (each decoded 12 MP photo is ~48 MB).
    for (const file of files) {
      try {
        const r = await resizeImage(file);
        onAdd({ key: `p${nextKey++}`, ...r, previewUrl: URL.createObjectURL(r.blob) });
      } catch {
        setFailed(true);
      }
    }
    onBusyChange(false);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1.5">
        {existing.map((p) => (
          <Thumb key={p.id} src={p.url} onRemove={() => onRemoveExisting(p.id)} />
        ))}
        {pending.map((p) => (
          <Thumb key={p.key} src={p.previewUrl} onRemove={() => onRemovePending(p.key)} />
        ))}
        <label
          className={`${TILE} flex cursor-pointer items-center justify-center border border-dashed border-ink-muted bg-surface-muted text-2xl text-ink-muted`}
        >
          <span aria-hidden="true">{text.form.addPhotosSymbol}</span>
          <input
            type="file"
            accept="image/*"
            multiple
            aria-label={text.form.addPhotos}
            className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (files.length) void pick(files);
            }}
          />
        </label>
      </div>
      {failed && <p className="text-xs text-primary">{text.form.photoResizeFailed}</p>}
    </div>
  );
}
