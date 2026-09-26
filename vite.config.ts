import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * GitHub Pages では `https://<owner>.github.io/<repo>/` 配下に配信されるため、
 * CI 上では GITHUB_REPOSITORY からリポジトリ名を取り出して base を決める。
 * `<owner>.github.io` 形式のリポジトリはルート配信なので base は '/'。
 * ローカル開発時は常に '/'。
 */
function resolveBase(): string {
  const explicit = process.env.VITE_BASE;
  if (explicit) return explicit;
  const full = process.env.GITHUB_REPOSITORY;
  if (!full) return '/';
  const [owner, repo] = full.split('/');
  if (!repo || repo.toLowerCase() === `${owner.toLowerCase()}.github.io`) return '/';
  return `/${repo}/`;
}

export default defineConfig({
  plugins: [react()],
  base: resolveBase(),
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
