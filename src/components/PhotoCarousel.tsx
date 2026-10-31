import { useState } from 'react';
import type { Photo } from '../../shared/types';
import { text } from '../config/text';

interface Props {
  photos: Photo[];
}

export function PhotoCarousel({ photos }: Props): JSX.Element | null {
  const [index, setIndex] = useState(0);
  if (photos.length === 0) return null;
  return (
    <div className="relative">
      <div
        className="flex snap-x snap-mandatory overflow-x-auto"
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
      >
        {photos.map((p, i) => (
          <img
            key={p.id}
            src={p.url}
            width={p.width}
            height={p.height}
            alt={text.spot.photoLabel(i + 1, photos.length)}
            className="h-64 w-full shrink-0 snap-center object-cover"
          />
        ))}
      </div>
      {photos.length > 1 && (
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5" data-testid="carousel-dots">
          {photos.map((p, i) => (
            <span
              key={p.id}
              className={`h-2 w-2 rounded-full ${i === index ? 'bg-surface' : 'bg-surface opacity-50'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
