import { useEffect, useState } from 'react';
import { api } from './api';

export function useEditor(): { email: string | null; loading: boolean } {
  const [state, setState] = useState<{ email: string | null; loading: boolean }>({ email: null, loading: true });
  useEffect(() => {
    let active = true;
    api.me().then((m) => {
      if (active) setState({ email: m?.email ?? null, loading: false });
    });
    return () => {
      active = false;
    };
  }, []);
  return state;
}
