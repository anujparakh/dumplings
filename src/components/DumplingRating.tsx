import { icons } from '../config/icons';
import { settings } from '../config/settings';
import { text } from '../config/text';

interface Props {
  value: number | null;
  onChange?: (v: number) => void;
  size?: 'sm' | 'lg';
}

const SIZE = { sm: 'h-4 w-4', lg: 'h-8 w-8' } as const;
// Tap area around each editable icon; lg is at least 44px for fingers.
const HIT = { sm: '', lg: 'h-11 w-11' } as const;

export function DumplingRating({ value, onChange, size = 'sm' }: Props): JSX.Element {
  const ns = Array.from({ length: settings.ratingMax }, (_, i) => i + 1);
  const icon = (n: number): JSX.Element => (
    <img
      key={n}
      src={icons.rating}
      alt=""
      className={`${SIZE[size]} ${n <= (value ?? 0) ? 'opacity-100' : 'opacity-30'}`}
    />
  );
  if (!onChange) {
    return (
      <span role="img" aria-label={text.rating.valueLabel(value)} className="inline-flex gap-0.5">
        {ns.map(icon)}
      </span>
    );
  }
  return (
    <span className="inline-flex gap-1">
      {ns.map((n) => (
        <button
          key={n}
          type="button"
          aria-label={text.rating.setLabel(n)}
          onClick={() => onChange(n)}
          className={`${HIT[size]} flex items-center justify-center`}
        >
          {icon(n)}
        </button>
      ))}
    </span>
  );
}
