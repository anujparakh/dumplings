import { text } from '../config/text';

/** Shown when a write fails because her sign-in expired. The link opens in a new tab so the form is kept. */
export function SignedOutNotice({ className = '' }: { className?: string }): JSX.Element {
  return (
    <p role="alert" className={`text-sm text-primary ${className}`}>
      {text.form.signedOut}{' '}
      {/* Full page load in a new tab so Cloudflare Access can sign her in again. */}
      <a href="/admin" target="_blank" rel="noopener" className="font-bold underline">
        {text.form.signInAgain}
      </a>
    </p>
  );
}
