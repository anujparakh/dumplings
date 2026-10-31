import { Link } from 'react-router-dom';
import { icons } from '../config/icons';
import { text } from '../config/text';

interface Props {
  /** Show the unlock button that leads to sign-in (signed-out visitors). */
  showSignIn?: boolean;
}

export function Header({ showSignIn = false }: Props): JSX.Element {
  return (
    <header className="flex items-center gap-2 bg-surface px-4 py-3 shadow-sm">
      <Link to="/" className="flex flex-1 items-center gap-2">
        <img src={icons.logo} alt="" className="h-7 w-7" />
        <h1 className="text-lg font-bold text-ink">{text.appTitle}</h1>
      </Link>
      {showSignIn && (
        <Link
          to="/login"
          aria-label={text.signIn}
          title={text.signIn}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-tag"
        >
          <img src={icons.unlock} alt="" className="h-5 w-5" />
        </Link>
      )}
    </header>
  );
}
