# Lockin

A student-focused desktop browser built with Electron, React, Vite, and TypeScript.

## Requirements

- Node.js 20+
- macOS or Windows

## Develop

```bash
npm install
npm run dev
```

This starts Vite for the browser chrome and launches Electron with hot reload.

## Build

```bash
npm run build
```

Outputs bundled main, preload, and renderer into `out/`.

## Package

```bash
# Current platform helpers
npm run package:mac
npm run package:win

# Both (from a machine that can build both targets)
npm run package
```

Installers land in `release/`.

## Scaffold features

- Multi-tab browsing via Electron `WebContentsView`
- Back / forward / reload
- URL bar (domains get `https://`; free text goes to Google Search)
- Secure chrome: `contextIsolation`, no Node in the renderer

## Project layout

```
src/main/       Electron main process + tab manager
src/preload/    contextBridge API (`window.lockin`)
src/renderer/   React chrome (tabs + nav)
src/shared/     Shared IPC types
```
