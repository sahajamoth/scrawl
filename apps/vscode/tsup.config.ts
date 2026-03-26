import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/extension.ts'],
  format: ['cjs'],
  dts: false,
  sourcemap: false,
  clean: true,
  platform: 'node',
  external: ['vscode'],
  noExternal: ['@scrawl/core'],
  target: 'es2022',
})
