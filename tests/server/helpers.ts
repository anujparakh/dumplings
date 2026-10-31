import type { AccessVerifier } from '../../server/auth';

export const fakeVerifier =
  (email: string): AccessVerifier =>
  async () => ({ email });
