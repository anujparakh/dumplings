import { useEffect, useState } from 'react';
import { api } from './api';

export function useEditor(): { signedIn: boolean; loading: boolean } {
  const [state, setState] = useState({ signedIn: false, loading: true });
  useEffect(() => {
    let active = true;
    api.isSignedIn().then((signedIn) => {
      if (active) setState({ signedIn, loading: false });
    });
    return () => {
      active = false;
    };
  }, []);
  return state;
}
