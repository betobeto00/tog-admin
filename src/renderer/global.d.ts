// Renderer-side global type declarations.
// The `api` surface is exposed by src/main/preload.ts via contextBridge.
// We declare it loosely here to keep the renderer independent of preload's
// TypeScript project. The actual implementation is in src/main/preload.ts.

export {}

declare global {
  interface Window {
    api: any
  }
}
