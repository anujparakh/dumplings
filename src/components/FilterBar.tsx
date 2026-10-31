import { text } from '../config/text';

interface Props {
  showBeen: boolean;
  showWant: boolean;
  tag: string | null;
  tags: string[];
  onShowBeen: (on: boolean) => void;
  onShowWant: (on: boolean) => void;
  onTag: (tag: string | null) => void;
}

const CHIP = 'rounded-card px-3 py-1 text-sm shadow-sm';

function Chip({ label, on, onToggle }: { label: string; on: boolean; onToggle: (on: boolean) => void }): JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onToggle(!on)}
      className={`${CHIP} ${on ? 'bg-primary text-primary-contrast' : 'bg-surface text-ink'}`}
    >
      {label}
    </button>
  );
}

export function FilterBar({ showBeen, showWant, tag, tags, onShowBeen, onShowWant, onTag }: Props): JSX.Element {
  // A shared link can name a tag that is not (yet) in the list; keep it selectable.
  const options = tag && !tags.includes(tag) ? [tag, ...tags] : tags;
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip label={text.filters.been} on={showBeen} onToggle={onShowBeen} />
      <Chip label={text.filters.want} on={showWant} onToggle={onShowWant} />
      <select
        aria-label={text.filters.tagLabel}
        value={tag ?? ''}
        onChange={(e) => onTag(e.target.value || null)}
        className={`${CHIP} ${tag ? 'bg-primary text-primary-contrast' : 'bg-surface text-ink'}`}
      >
        <option value="">{text.filters.allFoods}</option>
        {options.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}
