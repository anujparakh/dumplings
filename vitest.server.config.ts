import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'));
  return {
    plugins: [
      cloudflareTest({
        miniflare: {
          compatibilityDate: '2025-01-01',
          compatibilityFlags: ['nodejs_compat'],
          d1Databases: ['DB'],
          r2Buckets: ['PHOTOS'],
          bindings: {
            TEST_MIGRATIONS: migrations,
            EDITOR_EMAILS: 'ruchi@example.com,owner@example.com',
          },
        },
      }),
    ],
    test: {
      include: ['tests/server/**/*.test.ts'],
      setupFiles: ['tests/server/setup.ts'],
      globals: true,
    },
  };
});
