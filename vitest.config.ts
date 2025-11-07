import { defineConfig, configDefaults } from 'vitest/config';
// import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  // plugins: [tsconfigPaths()],
  test: {
    // alias: {
    //   '~/': new URL('./src/', import.meta.url).pathname,
    // },
    coverage: {
      exclude: [
        ...configDefaults.coverage.exclude ?? [],
        'examples',
      ],
      provider: 'istanbul',
      enabled: true,
    },
  },
});