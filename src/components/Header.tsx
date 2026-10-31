import { useState } from 'react';
import { Link } from 'react-router-dom';
import { icons } from '../config/icons';
import { text } from '../config/text';

interface Props {
  /** Show the sign-in link in the menu (signed-out visitors). */
  showSignIn?: boolean;
}

export function Header({ showSignIn = false }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <header className="relative flex items-center gap-2 bg-surface px-4 py-3 shadow-sm">
      <Link to="/" className="flex flex-1 items-center gap-2">
        <img src={icons.logo} alt="" className="h-7 w-7" />
        <h1 className="text-lg font-bold text-ink">{text.appTitle}</h1>
      </Link>
      {/* The menu only holds the sign-in link, so there is no menu button without it. */}
      {showSignIn && (
        <button
          type="button"
          aria-label={text.menu}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="rounded-card px-2 py-1 text-ink-muted"
        >
          <span aria-hidden="true">{text.menuSymbol}</span>
        </button>
      )}
      {open && showSignIn && (
        <nav className="absolute right-2 top-full z-20 mt-1 rounded-card bg-surface py-1 shadow-md">
          <Link to="/login" className="block px-4 py-2 text-ink">
            {text.signIn}
          </Link>
        </nav>
      )}
    </header>
  );
}
