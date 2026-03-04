# Primavera UI — Agent Guide

## Overview

Spec-first, framework-agnostic web component library. Zero runtime dependencies. Vanilla Custom Elements (no Shadow DOM). Monorepo managed with **Bun workspaces**, built with **Vite** and **TypeScript**.

**Author:** Daniel Gormly | **License:** MIT

## Repo Structure

```
primavera-ui/
├── packages/
│   └── components/          # @primavera-ui/components — the core library
│       ├── src/
│       │   ├── index.ts     # Main entry (currently empty)
│       │   ├── otp/         # OTP input component
│       │   └── dnd/         # Drag-and-drop component
│       ├── vite.config.ts   # Vite lib build (3 entry points: index, otp, dnd)
│       ├── tsconfig.json    # ES2022, ESNext modules, strict
│       └── package.json
├── docs/                    # Astro 5 documentation site (GitHub Pages)
│   ├── src/
│   │   ├── layouts/Layout.astro
│   │   └── pages/           # index.astro, otp.astro
│   ├── astro.config.mjs     # base: /primavera-ui
│   └── package.json
├── .github/workflows/deploy.yml  # CI: build components → build docs → deploy
├── package.json             # Workspace root
└── readme.md
```

## Commands

```bash
# Install
bun install

# Components
cd packages/components
bun run dev        # Vite dev server
bun run build      # Build JS + emit .d.ts

# Docs
cd docs
bun run dev        # Astro dev server
bun run build      # Build static site
```

## Build & Exports

Vite library mode with **3 entry points**, ESM only:

| Export path | Entry file | Registers |
|---|---|---|
| `@primavera-ui/components` | `src/index.ts` | — |
| `@primavera-ui/components/otp` | `src/otp/index.ts` | `<primavera-otp>`, `<primavera-otp-input>` |
| `@primavera-ui/components/dnd` | `src/dnd/index.ts` | `<primavera-dnd>` |

Each export has a `register()` function that defines the custom elements.

## Component Architecture Patterns

- **No Shadow DOM** — Light DOM for SSR compatibility and easy consumer styling
- **Spec-first** — Each component has a `spec.md` in its directory; code is written to match the spec
- **State separation** — State logic lives in dedicated classes (e.g., `OTPState`, `DndSource`), not in the element
- **Custom events** for inter-component communication
- **ARIA attributes** and keyboard navigation throughout
- **`connectedCallback`** for init; `observedAttributes` + `attributeChangedCallback` for reactive props

## OTP Component (`src/otp/`)

A one-time-password input with configurable length and validation.

| File | Role |
|---|---|
| `index.ts` | Exports & `register()` |
| `otp-container.ts` | `<primavera-otp>` — orchestration, events, DOM |
| `otp-input.ts` | `<primavera-otp-input>` — thin input wrapper |
| `otp-state.ts` | Value storage, validation, insert/delete/paste |
| `otp-keyboard.ts` | Keyboard event mapping |
| `spec.md` | Component specification |

## DnD Component (`src/dnd/`)

Virtualized drag-and-drop list with multi-selection. Modular subsystem architecture.

| File | Subsystem | Role |
|---|---|---|
| `index.ts` | — | Exports & `register()` |
| `dnd-types.ts` | Types | Shared TypeScript interfaces |
| `dnd-container.ts` | Container | `<primavera-dnd>` — main orchestrator (largest file ~29KB) |
| `dnd-source.ts` | Data | Data source with **two-phase commit** (optimistic UI) |
| `dnd-selection.ts` | Selection | Multi-block selection model with merge logic |
| `dnd-virtualization.ts` | Virtualization | Virtual scrolling (visible range, positions, overscan) |
| `dnd-canvas.ts` | Canvas | Canvas-based placeholder/drop-indicator rendering |
| `dnd-autoscroll.ts` | Autoscroll | Auto-scroll during drag with acceleration |
| `dnd-drag-overlay.ts` | Overlay drag | Cursor-following stacked preview |
| `dnd-drag-native.ts` | Native drag | HTML5 DataTransfer drag/drop |
| `dnd-touch.ts` | Touch | 150ms hold threshold, 3px drag buffer |
| `dnd-keyboard.ts` | Keyboard | Platform-aware key bindings |
| `spec.md` | — | Component specification |

**Key DnD props:** `drag-type` (native/overlay), `overscan`, `item-height`, `rounded-select`, `nudge`, `confine-autoscroll`, `autoscroll-buffer`, `drag-stack-count`, `autofocus`

## TypeScript

- **Target:** ES2022, **Module:** ESNext, **Resolution:** bundler
- **Strict mode** enabled
- Declarations emitted to `dist/`
- Libs: ES2022, DOM, DOM.Iterable

## Deployment

GitHub Actions → GitHub Pages at `https://danielgormly.github.io/primavera-ui`
Trigger: push to `main` or manual dispatch.
