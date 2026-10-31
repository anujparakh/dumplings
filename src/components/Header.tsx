import { icons } from '../config/icons';
import { text } from '../config/text';

export function Header(): JSX.Element {
  return (
    <header className="flex items-center gap-2 bg-surface px-4 py-3 shadow-sm">
      <img src={icons.logo} alt="" className="h-7 w-7" />
      <h1 className="flex-1 text-lg font-bold text-ink">{text.appTitle}</h1>
      <button type="button" aria-label={text.menu} className="rounded-card px-2 py-1 text-ink-muted">
        <span aria-hidden="true">&#9776;</span>
      </button>
    </header>
  );
}
