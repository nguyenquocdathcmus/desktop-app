import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

/**
 * Sprint 14 US-116 — a single Vitest project covering both main-process logic
 * (pure Node, no Electron APIs touched by the functions under test) and
 * renderer store logic (jsdom, since Zustand stores are imported as-is).
 * Deliberately narrow: this targets the highest-risk pure-logic code
 * (Exporter.ts filter builders, useProjectStore.ts migrate/history/segments),
 * not a blanket "test everything" pass — see SPRINT_14.md for the reasoning.
 */
export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      // Renderer-side stores touch `window` even outside jsdom-only APIs
      // (Zustand's create() + the store module itself), so they need jsdom;
      // main-process/shared logic (Exporter.ts filter builders) is plain Node.
      ['test/unit/**/*store*.test.ts', 'jsdom']
    ],
    // Unit tests (fast, no ffmpeg) run by default via `npm test`. Integration
    // tests (spawn real ffmpeg, ~several seconds each) are opt-in via
    // `npm run test:integration` — see package.json.
    include: ['test/unit/**/*.test.ts'],
    globals: true
  },
  resolve: {
    alias: {
      '@main': resolve(__dirname, 'src/main'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  }
})
