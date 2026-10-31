import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '../components/Header';
import { text } from '../config/text';
import { api, ApiError } from '../lib/api';

// Only same-site paths, so a crafted link cannot send her somewhere else after signing in.
const safeNext = (next: string | null): string => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/');

export function LoginPage(): JSX.Element {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(password);
      navigate(safeNext(params.get('next')), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? text.login.wrongPassword : text.login.failed);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-surface">
      <Header />
      <form onSubmit={submit} className="mx-auto flex max-w-sm flex-col gap-3 px-4 py-8">
        <h2 className="text-xl font-bold text-ink">{text.login.title}</h2>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          {text.login.password}
          <input
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-card border border-surface-muted bg-surface px-3 py-2 text-base text-ink"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-primary">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !password}
          className="rounded-card bg-primary px-4 py-2 font-bold text-primary-contrast disabled:opacity-50"
        >
          {busy ? text.login.submitting : text.login.submit}
        </button>
      </form>
    </div>
  );
}
