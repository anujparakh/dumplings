import { useState } from 'react';
import { text } from '../config/text';

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Tags offered with one tap (already chosen ones are left out). */
  suggestions: string[];
}

const TAG = 'rounded-card px-2.5 py-1 text-sm';
const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

export function TagEditor({ value, onChange, suggestions }: Props): JSX.Element {
  const [draft, setDraft] = useState('');
  const add = (raw: string): void => {
    const typed = raw.trim().replace(/\s+/g, ' ');
    // Reuse an existing tag's casing so "dumplings" and "Dumplings" stay one tag.
    const tag = suggestions.find((s) => same(s, typed)) ?? typed;
    if (tag && !value.some((t) => same(t, tag))) onChange([...value, tag]);
  };
  const offered = suggestions.filter((s, i) => !value.some((t) => same(t, s)) && suggestions.findIndex((o) => same(o, s)) === i);

  return (
    <div role="group" aria-label={text.form.tags} className="flex flex-wrap items-center gap-1.5">
      {value.map((t) => (
        <button
          key={t}
          type="button"
          aria-label={text.form.removeTag(t)}
          onClick={() => onChange(value.filter((v) => v !== t))}
          className={`${TAG} bg-tag text-ink`}
        >
          {t} <span aria-hidden="true">{text.form.removeSymbol}</span>
        </button>
      ))}
      {offered.map((s) => (
        <button key={s} type="button" onClick={() => add(s)} className={`${TAG} bg-surface-muted text-ink-muted`}>
          {text.form.addTagSuggestion(s)}
        </button>
      ))}
      <input
        type="text"
        aria-label={text.form.newTag}
        placeholder={text.form.newTagPlaceholder}
        value={draft}
        enterKeyHint="done"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          add(draft);
          setDraft('');
        }}
        onBlur={() => {
          add(draft);
          setDraft('');
        }}
        className={`${TAG} w-24 bg-surface-muted text-ink`}
      />
    </div>
  );
}
