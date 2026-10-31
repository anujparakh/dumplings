import { text } from '../config/text';

/** Shown when a write fails because her sign-in expired. The link opens in a new tab so the form is kept. */
export function SignedOutNotice({ className = '' }: { className?: string }): JSX.Element {
  return (
    <p role="alert" className={`text-sm text-primary ${className}`}>
      {text.form.signedOut}{' '}
      {/* A new tab keeps this form; the sign-in cookie is shared with this tab. */}
      <a href="/login" target="_blank" rel="noopener" className="font-bold underline">
        {text.form.signInAgain}
      </a>
    </p>
  );
}
