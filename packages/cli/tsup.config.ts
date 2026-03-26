import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: false,
  clean: true,
  platform: 'node',
  banner: {
    js: '#!/usr/bin/env node',
  },
})
